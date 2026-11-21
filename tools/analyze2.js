// Analysis round 2: external data (gold, oil, DXY, S&P 500, VIX, funding, Fear & Greed, BTC trend) as entry filters.
// Runs in GitHub Actions. Writes tools/results2.md
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const C = require('../core.js');

const SYMS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const TFS = ['4h', '1h'];
const BARS = 5000;
const UA = { 'User-Agent': 'Mozilla/5.0 (crypto-signal-lab analysis)' };
const BASE = { strategy: 'breakout', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 3, tpR: 3, risk: 1, lev: 1,
  fee: 0.1, slip: 0.05, funding: 0, bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3 };
const TEST_STRATS = ['breakout', 'ema', 'macd', 'supertrend', 'confluence'];
const ORIG = Object.fromEntries(Object.keys(C.STRATS).map(k => [k, C.STRATS[k].fn]));
const log = [];
const note = s => { console.log(s); log.push(s); };

async function getJSON(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }

async function klines(sym, tf) {
  let out = [], end = null;
  while (out.length < BARS) {
    const lim = Math.min(1000, BARS - out.length);
    const rows = await getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${lim}` + (end ? `&endTime=${end}` : ''));
    if (!rows.length) break;
    out = rows.concat(out); end = rows[0][0] - 1;
    if (rows.length < lim) break;
  }
  return out.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
}

// Daily series from Yahoo Finance: Map 'YYYY-MM-DD' -> close
async function yahoo(sym) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5y&interval=1d`);
  const r = j.chart.result[0], m = new Map();
  r.timestamp.forEach((t, i) => { const c = r.indicators.quote[0].close[i]; if (c != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), c); });
  return m;
}
async function fearGreed() {
  const j = await getJSON('https://api.alternative.me/fng/?limit=0&format=json');
  return new Map(j.data.map(x => [new Date(+x.timestamp * 1000).toISOString().slice(0, 10), +x.value]));
}
// Funding history: sorted [[timeSec, rate]]; try futures API, then monthly zips from data.binance.vision
async function funding(sym, fromSec) {
  try {
    let out = [], start = fromSec * 1000;
    for (let k = 0; k < 20; k++) {
      const rows = await getJSON(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1000&startTime=${start}`);
      if (!rows.length) break;
      out = out.concat(rows.map(x => [x.fundingTime / 1000, +x.fundingRate]));
      start = rows[rows.length - 1].fundingTime + 1;
      if (rows.length < 1000) break;
    }
    if (out.length) return { src: 'fapi', data: out };
  } catch (e) { note(`fapi funding ${sym}: ${e.message}`); }
  const out = [], d = new Date(fromSec * 1000), now = new Date();
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m < now.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`, f = path.join(os.tmpdir(), `${sym}-${ym}.zip`);
    try {
      const r = await fetch(`https://data.binance.vision/data/futures/um/monthly/fundingRate/${sym}/${sym}-fundingRate-${ym}.zip`);
      if (!r.ok) continue;
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      execSync(`unzip -p ${f}`).toString().trim().split('\n').forEach(line => {
        const [t, , rate] = line.split(',');
        if (/^\d+$/.test(t)) out.push([+t / 1000, +rate]);
      });
    } catch (e) { /* skip month */ }
  }
  return { src: 'data.binance.vision', data: out.sort((a, b) => a[0] - b[0]) };
}

// Align a daily map to bars using the PREVIOUS completed day (no look-ahead)
function alignDaily(cs, map) {
  const days = [...map.keys()].sort(), vals = days.map(d => map.get(d)), out = new Array(cs.length).fill(null);
  let j = -1;
  for (let i = 0; i < cs.length; i++) {
    const today = new Date(cs[i].time * 1000).toISOString().slice(0, 10);
    while (j + 1 < days.length && days[j + 1] < today) j++;
    out[i] = j >= 0 ? vals[j] : null;
  }
  return out;
}
// Daily close + SMA(n) of a daily map, aligned
function alignDailyTrend(cs, map, n = 50) {
  const days = [...map.keys()].sort(), sma = C.sma(days.map(d => map.get(d)), n), sm = new Map(days.map((d, i) => [d, sma[i]]));
  return { val: alignDaily(cs, map), sma: alignDaily(cs, sm) };
}
function alignSeries(cs, pts) { // pts sorted [[timeSec, v]]: last value with time <= bar open
  const out = new Array(cs.length).fill(null);
  let j = -1;
  for (let i = 0; i < cs.length; i++) { while (j + 1 < pts.length && pts[j + 1][0] <= cs[i].time) j++; out[i] = j >= 0 ? pts[j][1] : null; }
  return out;
}

const FILTERS = {
  none: () => true,
  btcTrend: (d, x, i) => x.btcUp[i] == null || (d === 1 ? x.btcUp[i] : !x.btcUp[i]),
  fngContra: (d, x, i) => x.fng[i] == null || (d === 1 ? x.fng[i] < 75 : x.fng[i] > 25),
  fngTrend: (d, x, i) => x.fng[i] == null || (d === 1 ? x.fng[i] >= 50 : x.fng[i] < 50),
  fundContra: (d, x, i) => x.fund[i] == null || (d === 1 ? x.fund[i] <= 0.0003 : x.fund[i] >= -0.0001),
  spx: (d, x, i) => trendOk(d, x.spx, i, 1),
  dxy: (d, x, i) => trendOk(d, x.dxy, i, -1),
  gold: (d, x, i) => trendOk(d, x.gold, i, 1),
  oil: (d, x, i) => trendOk(d, x.oil, i, 1),
  vix: (d, x, i) => x.vix.val[i] == null || (d === 1 ? x.vix.val[i] < 25 : true),
  random: (d, x, i, cs) => (Math.sin(cs[i].time) * 1e4) % 1 > 0.5 || (Math.sin(cs[i].time) * 1e4) % 1 < -0.5, // control: blocks ~half at random
  adxHtf: (d, x, i, cs, I) => I.adx.adx[i] >= 25 && x.htf[i] != null && (d === 1 ? cs[i].close > x.htf[i] : cs[i].close < x.htf[i])
};
function trendOk(d, s, i, sign) { // sign 1: asset up = bullish crypto ; -1: asset up = bearish crypto
  if (!s || s.val[i] == null || s.sma[i] == null) return true;
  const up = s.val[i] > s.sma[i];
  return d === 1 ? up === (sign === 1) : up !== (sign === 1);
}
function setFilter(names) {
  for (const k of Object.keys(C.STRATS)) {
    const fn = ORIG[k];
    C.STRATS[k].fn = (cs, I, i, p) => { const d = fn(cs, I, i, p); return d && names.every(n => FILTERS[n](d, I.ext, i, cs, I)) ? d : 0; };
  }
}
function agg(runs) {
  let n = 0, w = 0, sumR = 0;
  for (const st of runs) for (const t of st.trades) { n++; sumR += t.r; if (t.pnl > 0) w++; }
  return { n, win: n ? w / n * 100 : 0, avgR: n ? sumR / n : 0 };
}
const runBT = (d, p, from, to) => { const st = C.newState(p.bal); for (let i = from; i <= to; i++) C.step(st, d.cs, d.ind, i, p); return st; };
function corr(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return cov / Math.sqrt(va * vb);
}

(async () => {
  const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '–' : v.toFixed(d));
  // --- source availability (for the app's news / calendar panel) ---
  const probes = {
    'Yahoo chart': 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=5d&interval=1d',
    'Fear & Greed': 'https://api.alternative.me/fng/?limit=1',
    'Binance futures (fapi)': 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
    'CoinDesk RSS': 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'Cointelegraph RSS': 'https://cointelegraph.com/rss',
    'ForexFactory calendar': 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
  };
  let md = `# Analysis round 2: external data\n\nGenerated ${new Date().toISOString()} (GitHub runner, US)\n\n## Data source check\n\n| source | HTTP |\n|---|---|\n`;
  for (const [k, u] of Object.entries(probes)) { let s; try { s = (await fetch(u, { headers: UA })).status; } catch (e) { s = 'ERR ' + e.message; } md += `| ${k} | ${s} |\n`; }

  const macro = {};
  for (const [k, s] of [['gold', 'GC=F'], ['oil', 'CL=F'], ['dxy', 'DX-Y.NYB'], ['spx', '^GSPC'], ['vix', '^VIX']]) {
    try { macro[k] = await yahoo(s); note(`${k}: ${macro[k].size} days`); } catch (e) { note(`${k} failed: ${e.message}`); }
  }
  let fng = new Map();
  try { fng = await fearGreed(); note(`fng: ${fng.size} days`); } catch (e) { note('fng failed: ' + e.message); }

  // --- correlations (daily) ---
  md += `\n## 1. Daily correlation with BTC (last ~2 years)\n\nsame day = move together · next day = asset today vs BTC tomorrow (predictive?)\n\n| asset | same day | next day | days |\n|---|---|---|---|\n`;
  const btcD = await klines('BTCUSDT', '1d'), btc = new Map(btcD.map(c => [new Date(c.time * 1000).toISOString().slice(0, 10), c.close]));
  for (const k of ['gold', 'oil', 'dxy', 'spx', 'vix']) {
    const m = macro[k]; if (!m) { md += `| ${k} | – | – | 0 |\n`; continue; }
    const days = [...m.keys()].filter(d => btc.has(d)).sort().slice(-500), ra = [], rb = [], la = [], lb = [];
    for (let i = 1; i < days.length; i++) {
      const a = m.get(days[i]) / m.get(days[i - 1]) - 1, b = btc.get(days[i]) / btc.get(days[i - 1]) - 1;
      ra.push(a); rb.push(b);
      if (i + 1 < days.length) { la.push(a); lb.push(btc.get(days[i + 1]) / btc.get(days[i]) - 1); }
    }
    md += `| ${k} | ${fmt(corr(ra, rb))} | ${fmt(corr(la, lb))} | ${ra.length} |\n`;
  }

  // --- load crypto + attach external series ---
  const data = {};
  for (const tf of TFS) {
    const btcCs = await klines('BTCUSDT', tf), btcE = C.ema(btcCs.map(c => c.close), 200);
    const btcUpPts = btcCs.map((c, i) => [c.time, btcE[i] == null ? null : c.close > btcE[i]]);
    for (const s of SYMS) {
      const cs = s === 'BTCUSDT' ? btcCs : await klines(s, tf), ind = C.indicators(cs, BASE);
      const f = await funding(s, cs[0].time);
      ind.ext = {
        btcUp: alignSeries(cs, btcUpPts), fng: alignDaily(cs, fng), fund: alignSeries(cs, f.data),
        htf: C.ema(cs.map(c => c.close), 800)
      };
      for (const k of ['gold', 'oil', 'dxy', 'spx', 'vix']) ind.ext[k] = macro[k] ? alignDailyTrend(cs, macro[k]) : null;
      data[`${s}|${tf}`] = { cs, ind };
      note(`${s} ${tf}: ${cs.length} bars, funding ${f.data.length} pts (${f.src})`);
    }
  }
  const keys = tf => Object.keys(data).filter(k => k.endsWith('|' + tf));

  // --- filters: full period + stability (first 60% vs last 40%) ---
  const FL = Object.keys(FILTERS);
  md += `\n## 2. Filters on new defaults (SL 3×ATR, TP 3R, spot costs). Cell = avg R (all) · first60% → last40% · trades\n\nA filter is useful only if it beats "none" in BOTH halves.\n`;
  const summary = {};
  for (const tf of TFS) {
    md += `\n### ${tf}\n\n| filter | ${TEST_STRATS.join(' | ')} |\n|---|${TEST_STRATS.map(() => '---').join('|')}|\n`;
    for (const fl of FL) {
      setFilter([fl]);
      const cells = TEST_STRATS.map(k => {
        const p = { ...BASE, strategy: k };
        const runs = keys(tf).map(key => { const d = data[key]; return runBT(d, p, 1, d.cs.length - 2); });
        const all = agg(runs), per = runs.map(st => agg([st]).avgR);
        const a = agg(keys(tf).map(key => { const d = data[key]; return runBT(d, p, 1, Math.floor(d.cs.length * 0.6)); }));
        const b = agg(keys(tf).map(key => { const d = data[key]; return runBT(d, p, Math.floor(d.cs.length * 0.6) + 1, d.cs.length - 2); }));
        (summary[`${tf}|${k}`] ||= {})[fl] = { all, a, b, per };
        return `${fmt(all.avgR)} · ${fmt(a.avgR)}→${fmt(b.avgR)} · ${all.n}`;
      });
      md += `| ${fl} | ${cells.join(' | ')} |\n`;
    }
  }
  // robust filters: better than none in both halves with >= 40 trades
  md += `\n## 3. Robust improvements (beat "none" in both halves, ≥ 40 trades, better on ≥ 4 of 5 coins)\n\n"random" is a control filter: if it shows up here, treat everything with suspicion.\n\n| TF | strategy | filter | none R (A→B) | filter R (A→B) | trades | coins better |\n|---|---|---|---|---|---|---|\n`;
  const robust = [];
  for (const [key, v] of Object.entries(summary)) {
    const [tf, k] = key.split('|'), n0 = v.none;
    for (const fl of FL) {
      if (fl === 'none') continue;
      const x = v[fl];
      const better = x.per.filter((r, j) => r > n0.per[j]).length;
      if (x.all.n >= 40 && x.a.avgR > n0.a.avgR && x.b.avgR > n0.b.avgR && better >= 4) robust.push({ tf, k, fl, n0, x, better });
    }
  }
  robust.sort((p, q) => q.x.b.avgR - p.x.b.avgR).forEach(r => { md += `| ${r.tf} | ${r.k} | ${r.fl} | ${fmt(r.n0.a.avgR)}→${fmt(r.n0.b.avgR)} | ${fmt(r.x.a.avgR)}→${fmt(r.x.b.avgR)} | ${r.x.all.n} | ${r.better}/5 |\n`; });

  // --- combos of top robust filters on best strategies ---
  const top = [...new Set(robust.filter(r => r.tf === '4h' && r.fl !== 'random').slice(0, 4).map(r => r.fl))];
  md += `\n## 4. Combinations of top 4h filters (${top.join(', ') || 'none'})\n\n| strategy | combo | avg R all | A→B | trades | win% |\n|---|---|---|---|---|---|\n`;
  const combos = [];
  for (let m = 1; m < (1 << top.length); m++) combos.push(top.filter((_, b) => m & (1 << b)));
  for (const k of TEST_STRATS) for (const cmb of combos.filter(c => c.length >= 2)) {
    setFilter(cmb);
    const p = { ...BASE, strategy: k };
    const all = agg(keys('4h').map(key => { const d = data[key]; return runBT(d, p, 1, d.cs.length - 2); }));
    const a = agg(keys('4h').map(key => { const d = data[key]; return runBT(d, p, 1, Math.floor(d.cs.length * 0.6)); }));
    const b = agg(keys('4h').map(key => { const d = data[key]; return runBT(d, p, Math.floor(d.cs.length * 0.6) + 1, d.cs.length - 2); }));
    md += `| ${k} | ${cmb.join('+')} | ${fmt(all.avgR)} | ${fmt(a.avgR)}→${fmt(b.avgR)} | ${all.n} | ${fmt(all.win, 1)} |\n`;
  }
  md += `\n## Log\n\n` + log.map(s => `- ${s}`).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'results2.md'), md);
  console.log(md);
})().catch(e => { console.error(e); process.exit(1); });
