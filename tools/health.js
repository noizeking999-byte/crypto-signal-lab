// Monthly health check of the app's default strategy on fresh data (GitHub Actions → branch "health" → health.json)
// Config mirrors the app defaults (index.html): 4h · Donchian breakout · trailing 4 ATR · long + short · no filter · portfolio max 3 · point-in-time top-10 by volume
const C = require('../core.js');
const POOL = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LTCUSDT', 'LINKUSDT', 'SOLUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'EOSUSDT', 'BCHUSDT',
  'XLMUSDT', 'ETCUSDT', 'NEOUSDT', 'IOTAUSDT', 'ATOMUSDT', 'VETUSDT', 'THETAUSDT', 'FILUSDT', 'UNIUSDT', 'ICPUSDT', 'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'SHIBUSDT', 'NEARUSDT',
  'APEUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT', 'PEPEUSDT', 'AAVEUSDT', 'ALGOUSDT', 'XTZUSDT', 'ZECUSDT', 'DASHUSDT', 'ONTUSDT', 'QTUMUSDT', 'FTTUSDT', 'MATICUSDT', 'LUNAUSDT', 'XMRUSDT', 'WAVESUSDT', 'BTTUSDT'];
const P = { strategy: 'breakout', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 3, tpR: 3, risk: 1, lev: 1, fee: 0.1, slip: 0.05, funding: 0,
  bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3, exitMode: 'trail', trailAtr: 4, maxBars: 0 };
const MAXPOS = 3;
async function klines(sym) {
  let out = [], start = Date.UTC(2018, 0, 1);
  for (;;) {
    const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=4h&limit=1000&startTime=${start}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json(); if (!rows.length) break;
    out = out.concat(rows); start = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
  }
  return out.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5], qv: +k[7] }));
}
(async () => {
  const sets = [];
  for (const s of POOL) { try { const cs = await klines(s); if (cs.length > 300) sets.push({ sym: s, cs, ind: C.indicators(cs, P) }); } catch {} }
  const pf = C.portfolioBacktest(sets, P, MAXPOS, -Infinity, Infinity, { eligible: C.dynamicUniverse(sets, 10) });
  const now = Date.now() / 1000, sum = tr => (tr.length ? { avgR: tr.reduce((a, t) => a + t.r, 0) / tr.length, n: tr.length, win: tr.filter(t => t.pnl > 0).length / tr.length * 100 } : { avgR: 0, n: 0, win: 0 });
  const longRun = sum(pf.trades), m12 = sum(pf.trades.filter(t => t.exitTime > now - 365 * 86400)), m6 = sum(pf.trades.filter(t => t.exitTime > now - 182 * 86400));
  const status = m12.n >= 20 && m12.avgR <= 0 ? 'bad' : m6.n >= 10 && m6.avgR <= 0 ? 'watch' : 'good';
  const st = C.stats(pf);
  console.log(JSON.stringify({ generated: new Date().toISOString(), config: '4h · Breakout · Trailing 4 ATR · Long+Short · พอร์ต 3 ไม้ · Top 10 ตามวอลุ่ม', status, longRun, m12, m6, cagr: st.cagr, dd: st.dd, coins: sets.length }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
