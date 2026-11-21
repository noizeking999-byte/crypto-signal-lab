// Offline analysis on real Binance data (runs in GitHub Actions). Writes tools/results.md + results.json
const fs = require('fs');
const path = require('path');
const C = require('../core.js');

const SYMS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const TFS = ['15m', '1h', '4h'];
const BARS = 5000;
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api.binance.us'];
const BASE = { strategy: 'confluence', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 1.5, tpR: 2, risk: 1, lev: 1,
  fee: 0.1, slip: 0.05, funding: 0, bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3 };
const STRATS = Object.keys(C.STRATS);
const ORIG = Object.fromEntries(STRATS.map(k => [k, C.STRATS[k].fn]));

async function klines(sym, tf) {
  for (const h of HOSTS) {
    try {
      let out = [], end = null;
      while (out.length < BARS) {
        const lim = Math.min(1000, BARS - out.length);
        const r = await fetch(`${h}/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${lim}` + (end ? `&endTime=${end}` : ''));
        if (!r.ok) throw new Error(h + ' HTTP ' + r.status);
        const rows = await r.json();
        if (!rows.length) break;
        out = rows.concat(out); end = rows[0][0] - 1;
        if (rows.length < lim) break;
      }
      return { host: h, cs: out.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })) };
    } catch (e) { console.error(sym, tf, e.message); }
  }
  throw new Error('no data ' + sym + ' ' + tf);
}

// Apply an entry filter by wrapping strategy functions
function setFilter(name) {
  for (const k of STRATS) {
    const fn = ORIG[k];
    C.STRATS[k].fn = name === 'none' ? fn : (cs, I, i, p) => {
      const d = fn(cs, I, i, p);
      if (!d) return 0;
      if (name === 'adx' || name === 'adx+htf') if (!(I.adx.adx[i] >= 25)) return 0;
      if (name === 'htf' || name === 'adx+htf') { const h = I.htf[i]; if (h == null || (d === 1 ? cs[i].close < h : cs[i].close > h)) return 0; }
      if (name === 'score') { const s = I.score[i]; if (s == null || d * s < 30) return 0; } // confluence must agree
      return d;
    };
  }
}

// Aggregate trades (in R) over many runs
function agg(runs) {
  let n = 0, w = 0, sumR = 0, gp = 0, gl = 0, net = 0;
  for (const st of runs) {
    for (const t of st.trades) { n++; sumR += t.r; if (t.pnl > 0) { w++; gp += t.r; } else gl -= t.r; }
    net += (st.equity - st.start) / st.start * 100;
  }
  return { n, win: n ? w / n * 100 : 0, avgR: n ? sumR / n : 0, pf: gl ? gp / gl : (gp ? 99 : 0), net: runs.length ? net / runs.length : 0 };
}
const runBT = (d, p, from = 1, to = null) => {
  const st = C.newState(p.bal), last = to ?? d.cs.length - 2;
  for (let i = from; i <= last; i++) C.step(st, d.cs, d.ind, i, p);
  return st;
};

// Raw signal edge: forward close-to-close return in signal direction after N bars (no SL/TP, no costs)
function edge(d, p, N) {
  const out = [];
  for (let i = 1; i < d.cs.length - 1 - N; i++) {
    const s = C.signalAt(d.cs, d.ind, i, p);
    if (s) out.push(s.dir * (d.cs[i + N].close / d.cs[i].close - 1) * 100);
  }
  return out;
}

(async () => {
  const data = {};
  const sources = new Set();
  for (const tf of TFS) for (const s of SYMS) {
    const { host, cs } = await klines(s, tf);
    sources.add(host);
    const ind = C.indicators(cs, BASE);
    ind.htf = C.ema(cs.map(x => x.close), 800); // ≈ EMA200 of a 4x higher timeframe
    data[`${s}|${tf}`] = { s, tf, cs, ind };
    console.log('loaded', s, tf, cs.length, new Date(cs[0].time * 1000).toISOString().slice(0, 10));
  }
  const keys = tf => Object.keys(data).filter(k => k.endsWith('|' + tf));
  const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '–' : v.toFixed(d));
  const res = { generated: new Date().toISOString(), sources: [...sources], sections: {} };
  let md = `# Analysis results\n\nGenerated ${res.generated} · data: ${res.sources.join(', ')} · ${SYMS.join(', ')} · ${BARS} bars each\n\n`;
  for (const tf of TFS) {
    const d0 = data[keys(tf)[0]];
    md += `- ${tf}: ${new Date(d0.cs[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(d0.cs[d0.cs.length - 1].time * 1000).toISOString().slice(0, 10)}\n`;
  }

  // A. Baseline (app defaults)
  setFilter('none');
  md += `\n## A. Baseline (app defaults: SL 1.5 ATR, TP 2R, fee 0.1% + slip 0.05% per side)\n\n| TF | strategy | trades | win% | avg R | PF(R) | avg net % |\n|---|---|---|---|---|---|---|\n`;
  res.sections.baseline = [];
  for (const tf of TFS) for (const k of STRATS) {
    const a = agg(keys(tf).map(key => runBT(data[key], { ...BASE, strategy: k })));
    res.sections.baseline.push({ tf, k, ...a });
    md += `| ${tf} | ${k} | ${a.n} | ${fmt(a.win, 1)} | ${fmt(a.avgR)} | ${fmt(a.pf)} | ${fmt(a.net, 1)} |\n`;
  }
  // A2. Same with futures-level costs
  md += `\n### A2. Baseline with futures costs (fee 0.05% + slip 0.02%)\n\n| TF | strategy | trades | win% | avg R | avg net % |\n|---|---|---|---|---|---|\n`;
  for (const tf of TFS) for (const k of STRATS) {
    const a = agg(keys(tf).map(key => runBT(data[key], { ...BASE, strategy: k, fee: 0.05, slip: 0.02 })));
    md += `| ${tf} | ${k} | ${a.n} | ${fmt(a.win, 1)} | ${fmt(a.avgR)} | ${fmt(a.net, 1)} |\n`;
  }

  // B. Raw signal edge
  md += `\n## B. Raw signal edge (avg forward return % in signal direction, before costs; round-trip cost ≈ 0.30%)\n\n| TF | strategy | signals | +5 bars | +10 bars | +20 bars | % positive @10 |\n|---|---|---|---|---|---|---|\n`;
  for (const tf of TFS) for (const k of STRATS) {
    const p = { ...BASE, strategy: k }, r = N => keys(tf).flatMap(key => edge(data[key], p, N));
    const e5 = r(5), e10 = r(10), e20 = r(20), avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
    md += `| ${tf} | ${k} | ${e10.length} | ${fmt(avg(e5), 3)} | ${fmt(avg(e10), 3)} | ${fmt(avg(e20), 3)} | ${fmt(e10.filter(x => x > 0).length / (e10.length || 1) * 100, 1)} |\n`;
  }

  // C. Filters
  md += `\n## C. Entry filters (avg R / win% / trades)\n\nnone = as app · adx = ADX ≥ 25 · htf = with EMA800 trend (≈ higher TF) · adx+htf · score = confluence score agrees ≥ 30\n\n| TF | strategy | none | adx | htf | adx+htf | score |\n|---|---|---|---|---|---|---|\n`;
  const FILTERS = ['none', 'adx', 'htf', 'adx+htf', 'score'];
  res.sections.filters = [];
  for (const tf of TFS) for (const k of STRATS) {
    const cells = FILTERS.map(f => { setFilter(f); const a = agg(keys(tf).map(key => runBT(data[key], { ...BASE, strategy: k }))); res.sections.filters.push({ tf, k, f, ...a }); return `${fmt(a.avgR)} / ${fmt(a.win, 0)}% / ${a.n}`; });
    md += `| ${tf} | ${k} | ${cells.join(' | ')} |\n`;
  }
  setFilter('none');

  // D. SL/TP grid + walk-forward (optimize on first 60%, test on last 40%)
  const SL = [1, 1.5, 2, 3], TP = [1, 1.5, 2, 3];
  md += `\n## D. Walk-forward: best SL/TP picked on first 60% of data, tested on last 40%\n\n| TF | strategy | best SL×ATR | best TP R | train avg R | test avg R | test win% | test trades |\n|---|---|---|---|---|---|---|---|\n`;
  res.sections.walk = [];
  for (const tf of TFS) for (const k of STRATS) {
    let best = null;
    for (const sl of SL) for (const tp of TP) {
      const p = { ...BASE, strategy: k, slAtr: sl, tpR: tp };
      const a = agg(keys(tf).map(key => { const d = data[key]; return runBT(d, p, 1, Math.floor(d.cs.length * 0.6)); }));
      if (a.n >= 20 && (!best || a.avgR > best.a.avgR)) best = { sl, tp, a };
    }
    if (!best) { md += `| ${tf} | ${k} | – | – | – | – | – | – |\n`; continue; }
    const p = { ...BASE, strategy: k, slAtr: best.sl, tpR: best.tp };
    const t = agg(keys(tf).map(key => { const d = data[key]; return runBT(d, p, Math.floor(d.cs.length * 0.6) + 1); }));
    res.sections.walk.push({ tf, k, sl: best.sl, tp: best.tp, train: best.a, test: t });
    md += `| ${tf} | ${k} | ${best.sl} | ${best.tp} | ${fmt(best.a.avgR)} | ${fmt(t.avgR)} | ${fmt(t.win, 1)} | ${t.n} |\n`;
  }

  // E. Exit on opposite signal on/off
  md += `\n## E. Exit on opposite signal (avg R): on vs off\n\n| TF | strategy | on | off |\n|---|---|---|---|\n`;
  for (const tf of TFS) for (const k of STRATS) {
    const on = agg(keys(tf).map(key => runBT(data[key], { ...BASE, strategy: k })));
    const off = agg(keys(tf).map(key => runBT(data[key], { ...BASE, strategy: k, exitOpp: false })));
    md += `| ${tf} | ${k} | ${fmt(on.avgR)} | ${fmt(off.avgR)} |\n`;
  }

  fs.writeFileSync(path.join(__dirname, 'results.md'), md);
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(res));
  console.log(md);
})().catch(e => { console.error(e); process.exit(1); });
