// Deterministic synthetic candles for tests
module.exports.candles = (n = 3000, seed = 3, step = 14400) => {
  let p = 100, s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; const cs = [];
  for (let i = 0; i < n; i++) { const o = p; p *= 1 + (rnd() - 0.5) * 0.02 + Math.sin(i / 300) * 0.002; const h = Math.max(o, p) * (1 + rnd() * 0.005), l = Math.min(o, p) * (1 - rnd() * 0.005); cs.push({ time: 1.7e9 + i * step, open: o, high: h, low: l, close: p, volume: 50 + rnd() * 500 }); }
  return cs;
};
module.exports.P = { strategy: 'confluence', conf: 60, adxMin: 20, fast: 20, slow: 50, trend: 200, rsi: 14, atr: 14, slAtr: 1.5, tpR: 2, risk: 1, lev: 1, fee: 0.1, slip: 0.05, funding: 0.01, bal: 1000, shorts: true, exitOpp: true, minSl: 0.2, minEdge: 3 };
