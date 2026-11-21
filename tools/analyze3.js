// Analysis round 3: long history (2018+), 10 coins, exit methods, limit orders, portfolio, per-year stability.
// Runs in GitHub Actions. Writes tools/results3.md
const fs = require('fs');
const path = require('path');
const C = require('../core.js');

const SYMS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LTCUSDT', 'LINKUSDT', 'SOLUSDT', 'AVAXUSDT'];
const START = Date.UTC(2018, 0, 1), SPLIT = Date.UTC(2022, 3, 1) / 1000; // halves: 2018–Mar 2022 vs Apr 2022–now
const UA = { 'User-Agent': 'Mozilla/5.0 (crypto-signal-lab analysis)' };
const BASE = { strategy: 'breakout', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 3, tpR: 3, risk: 1, lev: 1,
  fee: 0.1, slip: 0.05, funding: 0, bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3, exitMode: 'fixed', trailAtr: 3, maxBars: 0 };
const STRATS = ['breakout', 'ema', 'macd', 'supertrend', 'confluence'];
const ORIG = Object.fromEntries(Object.keys(C.STRATS).map(k => [k, C.STRATS[k].fn]));
const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '–' : v.toFixed(d));

async function getJSON(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }
async function klines(sym, tf, startMs) {
  let out = [], start = startMs;
  for (;;) {
    const rows = await getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000&startTime=${start}`);
    if (!rows.length) break;
    out = out.concat(rows);
    start = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
  }
  return out.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
}
async function yahoo(sym) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`);
  const r = j.chart.result[0], m = {};
  r.timestamp.forEach((t, i) => { const c = r.indicators.quote[0].close[i]; if (c != null) m[new Date(t * 1000).toISOString().slice(0, 10)] = c; });
  return m;
}
function withRandomControl(on) {
  for (const k of Object.keys(C.STRATS)) {
    const fn = ORIG[k];
    C.STRATS[k].fn = on ? (cs, I, i, p) => { const d = fn(cs, I, i, p); const x = (Math.sin(cs[i].time) * 1e4) % 1; return d && Math.abs(x) > 0.5 ? d : 0; } : fn;
  }
}
function agg(sts) {
  let n = 0, w = 0, r = 0;
  for (const st of sts) for (const t of st.trades) { n++; r += t.r; if (t.pnl > 0) w++; }
  return { n, win: n ? w / n * 100 : 0, avgR: n ? r / n : 0 };
}
const halves = trades => [trades.filter(t => t.time < SPLIT), trades.filter(t => t.time >= SPLIT)].map(ts => ts.length ? ts.reduce((a, t) => a + t.r, 0) / ts.length : null);

(async () => {
  let md = `# Analysis round 3: long history, exits, limit orders, portfolio\n\nGenerated ${new Date().toISOString()} · coins: ${SYMS.join(', ')} · halves: before / after ${new Date(SPLIT * 1000).toISOString().slice(0, 10)}\n\n`;
  const macro = {};
  for (const [k, s] of [['dxy', 'DX-Y.NYB'], ['gold', 'GC=F'], ['oil', 'CL=F']]) { try { macro[k] = await yahoo(s); } catch (e) { md += `- ${k} failed: ${e.message}\n`; } }
  let fng = {};
  try { (await getJSON('https://api.alternative.me/fng/?limit=0&format=json')).data.forEach(x => fng[new Date(+x.timestamp * 1000).toISOString().slice(0, 10)] = +x.value); } catch (e) { md += `- fng failed\n`; }

  const load = async (tf, startMs) => {
    const sets = [];
    for (const s of SYMS) {
      const cs = await klines(s, tf, startMs), ind = C.indicators(cs, BASE);
      ind.ext = { fng: C.alignDaily(cs, fng) };
      for (const k of Object.keys(macro)) ind.ext[k] = C.alignDailyTrend(cs, macro[k]);
      sets.push({ sym: s, cs, ind });
      console.log('loaded', s, tf, cs.length, new Date(cs[0].time * 1000).toISOString().slice(0, 10));
    }
    return sets;
  };
  const sets = await load('4h', START);
  md += sets.map(s => `- ${s.sym}: ${s.cs.length} bars from ${new Date(s.cs[0].time * 1000).toISOString().slice(0, 10)}`).join('\n') + '\n';
  const single = (p, ss = sets) => ss.map(s => C.backtest(s.cs, s.ind, p, s.cs.length - 2));

  // 1. per-year stability (single-coin backtests, aggregated)
  md += `\n## 1. Per-year avg R (4h, SL 3×ATR, TP 3R, spot costs; each coin traded alone)\n\n`;
  const years = [...new Set(sets.flatMap(s => s.cs.map(c => new Date(c.time * 1000).getUTCFullYear())))].sort();
  md += `| strategy | filter | ${years.join(' | ')} | all R | trades | 1st half → 2nd half |\n|---|---|${years.map(() => '---').join('|')}|---|---|---|\n`;
  for (const k of STRATS) for (const [fname, fp] of [['none', {}], ['DXY', { fDxy: true }], ['DXY+gold', { fDxy: true, fGold: true }], ['DXY+F&G', { fDxy: true, fFng: true }], ['random', 'R']]) {
    withRandomControl(fp === 'R');
    const sts = single({ ...BASE, strategy: k, ...(fp === 'R' ? {} : fp) }), trades = sts.flatMap(s => s.trades), by = Object.fromEntries(C.byYear(trades).map(y => [y.year, y]));
    const a = agg(sts), h = halves(trades);
    md += `| ${k} | ${fname} | ${years.map(y => by[y] ? fmt(by[y].avgR) : '–').join(' | ')} | ${fmt(a.avgR)} | ${a.n} | ${fmt(h[0])} → ${fmt(h[1])} |\n`;
  }
  withRandomControl(false);

  // 2. exit methods
  const EXITS = [['fixed SL3/TP3', {}], ['fixed SL2/TP3', { slAtr: 2 }], ['fixed SL3/TP2', { tpR: 2 }], ['break-even', { exitMode: 'be' }], ['partial 50%@1R', { exitMode: 'partial' }],
    ['trail 2 ATR', { exitMode: 'trail', trailAtr: 2 }], ['trail 3 ATR', { exitMode: 'trail', trailAtr: 3 }], ['trail 4 ATR', { exitMode: 'trail', trailAtr: 4 }],
    ['time stop 30 bars', { maxBars: 30 }], ['trail 3 + time 60', { exitMode: 'trail', trailAtr: 3, maxBars: 60 }]];
  md += `\n## 2. Exit methods (4h, DXY filter on). Cell = avg R · win% · trades · halves\n\n| exit | ${STRATS.join(' | ')} |\n|---|${STRATS.map(() => '---').join('|')}|\n`;
  const exitScore = {};
  for (const [name, ex] of EXITS) {
    md += `| ${name} | ` + STRATS.map(k => {
      const sts = single({ ...BASE, strategy: k, fDxy: true, ...ex }), a = agg(sts), h = halves(sts.flatMap(s => s.trades));
      (exitScore[k] ||= []).push({ name, ex, a, h });
      return `${fmt(a.avgR)} · ${fmt(a.win, 0)}% · ${a.n} · ${fmt(h[0])}→${fmt(h[1])}`;
    }).join(' | ') + ' |\n';
  }

  // 3. order type & costs
  md += `\n## 3. Costs: spot market vs futures market vs futures limit (best exit per strategy from §2 by min(half) R)\n\n| strategy | exit | spot taker 0.1%+slip | futures taker 0.05%+slip 0.02% | futures limit maker 0.02% |\n|---|---|---|---|---|\n`;
  const bestExit = {};
  for (const k of STRATS) {
    const b = exitScore[k].filter(x => x.a.n >= 100).sort((p, q) => Math.min(...q.h.map(v => v ?? -9)) - Math.min(...p.h.map(v => v ?? -9)))[0];
    bestExit[k] = b;
    const r = extra => { const a = agg(single({ ...BASE, strategy: k, fDxy: true, ...b.ex, ...extra })); return `${fmt(a.avgR)} (${a.n})`; };
    md += `| ${k} | ${b.name} | ${r({})} | ${r({ fee: 0.05, slip: 0.02 })} | ${r({ fee: 0.05, slip: 0.02, limit: true, makerFee: 0.02 })} |\n`;
  }

  // 4. portfolio
  md += `\n## 4. Portfolio (10 coins, shared equity, risk 1%/trade, spot costs, start 1000)\n\nCAGR / max drawdown / trades / final equity. Each row compared with no filter and with a random control.\n\n| strategy | exit | filter | maxPos | CAGR % | max DD % | trades | win% | avg R | 1st → 2nd half R | final |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const pfRows = [];
  for (const k of ['breakout', 'ema', 'macd', 'supertrend']) {
    const ex = bestExit[k];
    for (const [fname, fp] of [['none', {}], ['DXY', { fDxy: true }], ['DXY+F&G', { fDxy: true, fFng: true }], ['random', 'R']]) for (const maxPos of [3, 5]) {
      withRandomControl(fp === 'R');
      const pf = C.portfolioBacktest(sets, { ...BASE, strategy: k, ...ex.ex, ...(fp === 'R' ? {} : fp) }, maxPos), s = C.stats(pf), h = halves(pf.trades);
      pfRows.push({ k, ex: ex.name, fname, maxPos, s, h, by: C.byYear(pf.trades) });
      md += `| ${k} | ${ex.name} | ${fname} | ${maxPos} | ${fmt(s.cagr, 1)} | ${fmt(s.dd, 1)} | ${s.n} | ${fmt(s.win, 1)} | ${fmt(s.avgR)} | ${fmt(h[0])} → ${fmt(h[1])} | ${fmt(pf.equity, 0)} |\n`;
    }
  }
  withRandomControl(false);
  const best = pfRows.filter(r => r.fname !== 'random' && r.s.n >= 100 && r.h.every(v => v > 0)).sort((a, b) => (b.s.cagr / Math.max(b.s.dd, 1)) - (a.s.cagr / Math.max(a.s.dd, 1)))[0];
  if (best) {
    md += `\n### Best portfolio by CAGR / maxDD (positive in both halves): ${best.k} · ${best.ex} · ${best.fname} · maxPos ${best.maxPos}\n\n| year | trades | win% | avg R |\n|---|---|---|---|\n`;
    best.by.forEach(y => { md += `| ${y.year} | ${y.n} | ${fmt(y.win, 1)} | ${fmt(y.avgR)} |\n`; });
  } else md += `\n### No portfolio configuration was positive in both halves.\n`;

  // 5. 1h check on recent data with the best settings
  if (best) {
    const sets1h = await load('1h', Date.UTC(2023, 0, 1));
    const p = { ...BASE, strategy: best.k, ...(exitScore[best.k].find(x => x.name === best.ex).ex), ...(best.fname === 'DXY' ? { fDxy: true } : best.fname === 'DXY+F&G' ? { fDxy: true, fFng: true } : {}) };
    const pf = C.portfolioBacktest(sets1h, p, best.maxPos), s = C.stats(pf);
    md += `\n## 5. Same settings on 1h (2023+): CAGR ${fmt(s.cagr, 1)}% · max DD ${fmt(s.dd, 1)}% · trades ${s.n} · avg R ${fmt(s.avgR)}\n`;
  }
  fs.writeFileSync(path.join(__dirname, 'results3.md'), md);
  fs.writeFileSync(path.join(__dirname, 'results3.json'), JSON.stringify({ best: best && { k: best.k, ex: best.ex, fname: best.fname, maxPos: best.maxPos, s: best.s } }));
  console.log(md);
})().catch(e => { console.error(e); process.exit(1); });
