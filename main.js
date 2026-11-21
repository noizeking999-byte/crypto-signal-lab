const { app, BrowserWindow, session, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

// Hosts the local page reads directly (public market data, news RSS, economic calendar)
const BINANCE = ['https://api.binance.com/*', 'https://data-api.binance.vision/*', 'https://fapi.binance.com/*',
  'https://query1.finance.yahoo.com/*', 'https://api.alternative.me/*', 'https://nfs.faireconomy.media/*',
  'https://www.coindesk.com/*', 'https://cointelegraph.com/*'];
let win;

function setupUpdater() {
  if (!app.isPackaged) return; // only in installed build
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['รีสตาร์ทเลย', 'ทีหลัง'], defaultId: 0,
      message: `มีเวอร์ชันใหม่ v${info.version} ดาวน์โหลดเสร็จแล้ว`,
      detail: 'กด "รีสตาร์ทเลย" เพื่ออัปเดต หรือจะอัปเดตเองตอนปิดโปรแกรม'
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', err => console.error('updater:', err?.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 60 * 60 * 1000); // every hour
}

app.setAppUserModelId('com.noizeking.cryptosignallab'); // Windows notifications

app.whenReady().then(() => {
  // Allow the local page to read Binance public REST responses (CORS) — Binance hosts only
  session.defaultSession.webRequest.onHeadersReceived({ urls: BINANCE }, (d, cb) => {
    const h = d.responseHeaders || {};
    for (const k of Object.keys(h)) if (k.toLowerCase() === 'access-control-allow-origin') delete h[k];
    h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  win = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: '#0e1116', autoHideMenuBar: true,
    title: `Crypto Signal Lab v${app.getVersion()}`,
    webPreferences: { contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.on('page-title-updated', e => e.preventDefault()); // keep version in title
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadFile('index.html');
  setupUpdater();
});
app.on('window-all-closed', () => app.quit());
