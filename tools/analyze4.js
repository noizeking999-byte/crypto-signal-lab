// Analysis round 4: survivorship bias, long-only, 1d, strategy combo, volatility sizing, risk controls.
// Runs in GitHub Actions. Writes tools/results4.md + results4.json
const fs = require('fs');
const path = require('path');
const C = require('../core.js');

const FIXED = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LTCUSDT', 'LINKUSDT', 'SOLUSDT', 'AVAXUSDT'];
// Wide candidate pool incl. coins that were big in earlier years (some have faded); delisted pairs are unavailable → reported
const POOL = (process.env.SMALL ? FIXED.slice(0, 6) : FIXED).concat(process.env.SMALL ? ['LUNAUSDT'] : ['DOTUSDT', 'TRXUSDT', 'EOSUSDT', 'BCHUSDT', 'XLMUSDT', 'ETCUSDT', 'NEOUSDT', 'IOTAUSDT', 'ATOMUSDT', 'VETUSDT', 'THETAUSDT',
  'FILUSDT', 'UNIUSDT', 'ICPUSDT', 'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'SHIBUSDT', 'NEARUSDT', 'APEUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT', 'PEPEUSDT',
  'AAVEUSDT', 'ALGOUSDT', 'XTZUSDT', 'ZECUSDT', 'DASHUSDT', 'ONTUSDT', 'QTUMUSDT', 'FTTUSDT', 'MATICUSDT', 'LUNAUSDT', 'XMRUSDT', 'WAVESUSDT', 'BTTUSDT']);
const START = Date.UTC(2018, 0, 1), SPLIT = Date.UTC(2022, 3, 1) / 1000;
const UA = { 'User-Agent': 'Mozilla/5.0 (crypto-signal-lab analysis)' };
const BASE = { strategy: 'breakout', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 3, tpR: 3, risk: 1, lev: 1,
  fee: 0.1, slip: 0.05, funding: 0, bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3, exitMode: 'fixed', trailAtr: 4, maxBars: 0 };
const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '–' : v.toFixed(d));
const ORIG = Object.fromEntries(Object.keys(C.STRATS).map(k => [k, C.STRATS[k].fn]));
const randomControl = on => { for (const k of Object.keys(C.STRATS)) { const fn = ORIG[k]; C.STRATS[k].fn = on ? (cs, I, i, p) => { const d = fn(cs, I, i, p), x = (Math.sin(cs[i].time) * 1e4) % 1; return d && Math.abs(x) > 0.5 ? d : 0; } : fn; } };

async function getJSON(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
async function klines(sym, tf) {
  let out = [], start = START;
  for (;;) {
    const rows = await getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000&startTime=${start}`);
    if (!rows.length) break;
    out = out.concat(rows); start = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
  }
  return out.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5], qv: +k[7] }));
}
async function yahoo(sym) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`);
  const r = j.chart.result[0], m = {};
  r.timestamp.forEach((t, i) => { const c = r.indicators.quote[0].close[i]; if (c != null) m[new Date(t * 1000).toISOString().slice(0, 10)] = c; });
  return m;
}
const halves = tr => [tr.filter(t => t.time < SPLIT), tr.filter(t => t.time >= SPLIT)].map(x => (x.length ? x.reduce((a, t) => a + t.r, 0) / x.length : null));

(async () => {
  let md = `# Analysis round 4: survivorship, direction, timeframe, combos, sizing, risk controls\n\nGenerated ${new Date().toISOString()} · portfolio backtests, spot costs (0.1% + 0.05% slip), risk 1%/trade, start 1000 · halves: before/after ${new Date(SPLIT * 1000).toISOString().slice(0, 10)}\n\n`;
  const dxy = await yahoo('DX-Y.NYB').catch(() => null);
  const data = { '4h': {}, '1d': {} }, missing = [];
  for (const tf of ['4h', '1d']) for (const s of POOL) {
    try {
      const cs = await klines(s, tf);
      if (cs.length < 300) { if (tf === '4h') missing.push(`${s} (too short)`); continue; }
      const ind = C.indicators(cs, BASE);
      ind.ext = { dxy: dxy ? C.alignDailyTrend(cs, dxy) : null };
      data[tf][s] = { sym: s, cs, ind };
    } catch (e) { if (tf === '4h') missing.push(`${s} (${e.message})`); }
  }
  md += `Pool: ${Object.keys(data['4h']).length} coins with data. Unavailable (delisted/renamed → residual survivorship bias): ${missing.join(', ') || 'none'}\n`;

  const sets = (tf, syms) => syms.filter(s => data[tf][s]).map(s => data[tf][s]);
  const run = (tf, uni, p, maxPos = 3, opts = {}) => {
    const ss = uni === 'fixed' ? sets(tf, FIXED) : Object.values(data[tf]);
    const o = { ...opts }; if (uni === 'dynamic') o.eligible = C.dynamicUniverse(ss, 10);
    const pf = C.portfolioBacktest(ss, { ...BASE, ...p }, maxPos, -Infinity, Infinity, o), s = C.stats(pf);
    return { s, h: halves(pf.trades), pf };
  };
  const row = (label, r) => `| ${label} | ${fmt(r.s.cagr, 1)} | ${fmt(r.s.dd, 1)} | ${fmt(r.s.cagr / Math.max(r.s.dd, 1), 2)} | ${r.s.n} | ${fmt(r.s.win, 1)} | ${fmt(r.s.avgR)} | ${fmt(r.h[0])} → ${fmt(r.h[1])} |\n`;
  const head = `| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |\n|---|---|---|---|---|---|---|---|\n`;
  const all = [];
  const test = (label, tf, uni, p, maxPos, opts) => { const r = run(tf, uni, p, maxPos, opts); all.push({ label, tf, uni, p, maxPos, opts, ...r }); return row(label, r); };

  md += `\n## A. Survivorship bias: fixed 10 coins (today's winners) vs point-in-time top-10 by volume each month (4h)\n\n` + head;
  for (const k of ['breakout', 'ema']) for (const f of [{}, { fDxy: true }]) for (const uni of ['fixed', 'dynamic'])
    md += test(`${k} ${f.fDxy ? '+DXY' : ''} · ${uni}`, '4h', uni, { strategy: k, ...f });

  md += `\n## B. Long + Short vs Long only vs Short only (dynamic universe)\n\n` + head;
  const SIDES = [['long+short', { shorts: true }], ['long only', { shorts: false }], ['short only', { shorts: true, longs: false }], ['short only + DXY', { shorts: true, longs: false, fDxy: true }], ['long+short + DXY', { shorts: true, fDxy: true }]];
  for (const tf of ['4h', '1d']) for (const k of ['breakout', 'ema']) for (const [lab, sd] of SIDES)
    md += test(`${tf} ${k} · ${lab}`, tf, 'dynamic', { strategy: k, ...sd });

  md += `\n## C. Strategy combo, exits and volatility sizing (dynamic universe; each config as long+short and long only)\n\n` + head;
  for (const tf of ['4h', '1d']) for (const both of [true, false]) {
    const side = both ? ' · L+S' : ' · long only', sh = both;
    md += test(`${tf} breakout+ema${side}`, tf, 'dynamic', { strategy: 'breakout', strategy2: 'ema', shorts: sh });
    md += test(`${tf} breakout+ema · vol sizing${side}`, tf, 'dynamic', { strategy: 'breakout', strategy2: 'ema', shorts: sh, volAdj: true });
    md += test(`${tf} breakout · vol sizing${side}`, tf, 'dynamic', { strategy: 'breakout', shorts: sh, volAdj: true });
    md += test(`${tf} breakout · trail 4 ATR${side}`, tf, 'dynamic', { strategy: 'breakout', shorts: sh, exitMode: 'trail' });
    md += test(`${tf} breakout+ema · trail 4 ATR${side}`, tf, 'dynamic', { strategy: 'breakout', strategy2: 'ema', shorts: sh, exitMode: 'trail' });
    md += test(`${tf} breakout+ema · +DXY${side}`, tf, 'dynamic', { strategy: 'breakout', strategy2: 'ema', shorts: sh, fDxy: true });
  }

  md += `\n## D. Risk controls (dynamic, 4h, breakout+ema, long+short)\n\n` + head;
  const pd = { strategy: 'breakout', strategy2: 'ema', shorts: true };
  for (const [lab, mp, o, extra] of [['maxPos 3', 3, {}, {}], ['maxPos 5', 5, {}, {}], ['maxPos 5 · max 3 same direction', 5, { maxSameDir: 3 }, {}],
    ['maxPos 3 · daily loss stop 3%', 3, {}, { dailyLoss: 3 }], ['maxPos 5 · same-dir 3 · daily stop 3%', 5, { maxSameDir: 3 }, { dailyLoss: 3 }]])
    md += test(`4h ${lab}`, '4h', 'dynamic', { ...pd, ...extra }, mp, o);

  // pick best: positive in both halves, >= 150 trades, max CAGR/DD
  const mar = r => r.s.cagr / Math.max(r.s.dd, 1);
  const cand = all.filter(r => r.uni === 'dynamic' && r.p.shorts !== false && r.p.longs !== false && r.s.n >= 150 && r.h.every(v => v > 0)).sort((a, b) => mar(b) - mar(a));
  const best = cand[0], bestAny = all.filter(r => r.uni === 'dynamic' && r.s.n >= 150 && r.h.every(v => v > 0)).sort((a, b) => mar(b) - mar(a))[0];
  if (bestAny && bestAny !== best) md += `\nBest of any side (for comparison): **${bestAny.label}** · CAGR ${fmt(bestAny.s.cagr, 1)}% · DD ${fmt(bestAny.s.dd, 1)}%\n`;
  if (best) { const sideR = d => { const t = best.pf.trades.filter(x => x.dir === d); return t.length ? `${t.length} trades, avg R ${fmt(t.reduce((a, x) => a + x.r, 0) / t.length)}` : 'none'; }; md += `\nBest long+short config by side: Long ${sideR(1)} · Short ${sideR(-1)}\n`; }
  if (best) {
    randomControl(true); const rc = run(best.tf, 'dynamic', best.p, best.maxPos, best.opts); randomControl(false);
    md += `\n## E. Best robust LONG+SHORT config: **${best.label}** (${best.tf}, maxPos ${best.maxPos})\n\n` + head + row('best', best) + row('same + random entry filter (control)', rc);
    md += `\n| year | trades | win% | avg R |\n|---|---|---|---|\n` + C.byYear(best.pf.trades).map(y => `| ${y.year} | ${y.n} | ${fmt(y.win, 1)} | ${fmt(y.avgR)} |`).join('\n') + '\n';
    const eq = best.pf.curve; let peak = 0, ddStart = null, longest = 0;
    for (const c of eq) { if (c.value >= peak) { if (ddStart != null) longest = Math.max(longest, c.time - ddStart); peak = c.value; ddStart = null; } else if (ddStart == null) ddStart = c.time; }
    md += `\nLongest time under previous equity high: ${fmt(longest / 86400, 0)} days · final equity ${fmt(best.pf.equity, 0)} from 1000\n`;
  } else md += `\n## E. No configuration was positive in both halves with ≥150 trades.\n`;
  fs.writeFileSync(path.join(__dirname, 'results4.md'), md);
  fs.writeFileSync(path.join(__dirname, 'results4.json'), JSON.stringify({ best: best && { label: best.label, tf: best.tf, p: best.p, maxPos: best.maxPos, opts: best.opts, s: best.s, h: best.h } }));
  console.log(md);
})().catch(e => { console.error(e); process.exit(1); });
