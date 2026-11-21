// Unit + regression tests. Run: node tests/run.js  (CI runs this before every release)
const assert = require('assert');
const C = require('../core.js'), W = require('../whale.js'), F = require('./fixtures.js');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error('FAIL', name, '\n ', e.message); } };
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, `${msg || ''} ${a} != ${b}`);
const Z = { ...F.P, fee: 0, slip: 0, funding: 0, risk: 1, lev: 100, minSl: 0, minEdge: 0 };
const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c, volume: 1 });
const ind0 = n => ({ atr: new Array(n).fill(2) });

test('regression: engine unchanged vs saved baseline', () => {
  const cs = F.candles(), ind = C.indicators(cs, F.P), base = require('./regression.json');
  for (const k of Object.keys(C.STRATS)) for (const v of [{}, { slAtr: 3, tpR: 3 }, { exitOpp: false, shorts: false }]) {
    const st = C.backtest(cs, ind, { ...F.P, strategy: k, ...v }, cs.length - 2);
    const o = { eq: st.equity.toFixed(8), n: st.trades.length, last: st.trades.slice(-1)[0] && st.trades.slice(-1)[0].pnl.toFixed(8) };
    assert.deepStrictEqual(o, base[k + JSON.stringify(v)], k + JSON.stringify(v));
  }
});
test('SL hit loses exactly 1R with costs included', () => {
  const cs = F.candles(), ind = C.indicators(cs, F.P), st = C.backtest(cs, ind, { ...F.P, funding: 0 }, cs.length - 2);
  st.trades.filter(t => t.reason === 'SL').forEach(t => near(t.r, -1, 1e-3)); // exit fee on slipped price → tiny difference
});
test('break-even: SL moves to entry after +1R', () => {
  const st = C.newState(1000), p = { ...Z, exitMode: 'be' };
  C.openPos(st, { dir: 1, entry: 100, sl: 95, tp: 120 }, 0, p, 't');
  const cs = [bar(0, 100, 100, 100, 100), bar(1, 100, 105.5, 99, 104), bar(2, 104, 104, 99, 99)];
  C.stepExits(st, cs, ind0(3), 1, p); assert.strictEqual(st.pos.sl, 100);
  C.stepExits(st, cs, ind0(3), 2, p); assert.strictEqual(st.pos, null); near(st.trades[0].pnl, 0);
});
test('partial: 50% at +1R then rest at TP = 1.5R', () => {
  const st = C.newState(1000), p = { ...Z, exitMode: 'partial' };
  C.openPos(st, { dir: 1, entry: 100, sl: 95, tp: 110 }, 0, p, 't');
  const cs = [bar(0, 100, 100, 100, 100), bar(1, 100, 106, 99, 105), bar(2, 105, 111, 104, 110)];
  C.stepExits(st, cs, ind0(3), 1, p); assert.ok(st.pos.partDone); assert.strictEqual(st.pos.sl, 100);
  C.stepExits(st, cs, ind0(3), 2, p); near(st.trades[0].r, 1.5);
  near(st.equity, 1000 + st.trades[0].pnl);
});
test('trailing: no TP, stop follows close - k*ATR', () => {
  const st = C.newState(1000), p = { ...Z, exitMode: 'trail', trailAtr: 2 };
  C.openPos(st, { dir: 1, entry: 100, sl: 95, tp: 110 }, 0, p, 't');
  assert.strictEqual(st.pos.tp, Infinity);
  const cs = [bar(0, 100, 100, 100, 100), bar(1, 100, 120, 99, 120), bar(2, 120, 120, 115, 116)];
  C.stepExits(st, cs, ind0(3), 1, p); near(st.pos.sl, 116);
  C.stepExits(st, cs, ind0(3), 2, p); assert.strictEqual(st.pos, null); near(st.trades[0].exit, 116);
});
test('time stop closes after maxBars', () => {
  const st = C.newState(1000), p = { ...Z, maxBars: 2 };
  C.openPos(st, { dir: -1, entry: 100, sl: 105, tp: 90 }, 0, p, 't');
  const cs = [bar(0, 100, 100, 100, 100), bar(1, 100, 101, 99, 99), bar(2, 99, 100, 98, 98)];
  C.stepExits(st, cs, ind0(3), 1, p); assert.ok(st.pos);
  C.stepExits(st, cs, ind0(3), 2, p); assert.strictEqual(st.trades[0].reason, 'หมดเวลา'); near(st.trades[0].exit, 98);
});
test('limit entry: fills only when touched, maker fee, no slippage', () => {
  const p = { ...Z, limit: true, fee: 0.1, makerFee: 0.02, slip: 0.05 };
  const cs = [bar(0, 100, 100, 100, 100), bar(1, 101, 103, 100.5, 102), bar(2, 102, 103, 99.5, 101)];
  let st = C.newState(1000); st.pending = { lv: { dir: 1, entry: 100, sl: 95, tp: 110 }, time: 0, src: 't' };
  C.fillPending(st, cs[1], p); assert.strictEqual(st.pos, null); assert.strictEqual(st.pending, null);
  st.pending = { lv: { dir: 1, entry: 100, sl: 95, tp: 110 }, time: 1, src: 't' };
  C.fillPending(st, cs[2], p); assert.strictEqual(st.pos.entry, 100); assert.strictEqual(st.pos.feeIn, 0.02);
});
test('portfolio: never more than maxPos open, equity = start + realized', () => {
  const sets = [3, 5, 7, 9].map((seed, k) => { const cs = F.candles(1500, seed); return { sym: 'S' + k, cs, ind: C.indicators(cs, F.P) }; });
  const p = { ...F.P, strategy: 'breakout', slAtr: 3, tpR: 3, exitMode: 'partial' }, maxPos = 2;
  const pf = C.newPortfolio(1000, sets.map(s => s.sym));
  for (let i = 1; i < 1499; i++) {
    C.portfolioStep(pf, sets.map(s => ({ slot: pf.slots[s.sym], cs: s.cs, ind: s.ind, i })), p, maxPos);
    assert.ok(Object.values(pf.slots).filter(s => s.pos || s.pending).length <= maxPos);
  }
  const realizedOpen = Object.values(pf.slots).reduce((a, s) => a + (s.pos ? s.pos.realized : 0), 0);
  near(pf.equity, 1000 + pf.trades.reduce((a, t) => a + t.pnl, 0) + realizedOpen, 1e-6);
  assert.ok(pf.trades.length > 10);
});
test('daily alignment uses previous day only (no look-ahead)', () => {
  const cs = F.candles(200, 3, 3600), map = {};
  for (let d = -2; d < 12; d++) map[new Date((1.7e9 + d * 86400) * 1000).toISOString().slice(0, 10)] = d;
  const a = C.alignDaily(cs, map);
  cs.forEach((c, i) => { const day = new Date(c.time * 1000).toISOString().slice(0, 10); assert.ok(Object.keys(map).filter(k => k < day).pop() === Object.keys(map).find(k => map[k] === a[i])); });
});
test('min SL distance respects costs', () => {
  const p = { slAtr: 1.5, tpR: 2, fee: 0.1, slip: 0.05, minSl: 0.2, minEdge: 3 };
  const lv = C.levels(1, 100, 0.01, p); near((lv.tp - 100) / 100 * 100, 0.9, 1e-9);
});
test('walk-forward returns a grid of 16', () => {
  const cs = F.candles(), ind = C.indicators(cs, F.P), w = C.walkForward(cs, ind, { ...F.P, strategy: 'breakout' }, cs.length - 2);
  assert.strictEqual(w.grid.length, 16);
});
test('whale: merge, sums, walls, futures summary', () => {
  const out = [], m = W.merger(o => out.push(o));
  m.push('X', 1, 100, 1, false); m.push('X', 1, 101, 1, false); m.push('X', 1, 101, 1, true); m.flushAll();
  assert.strictEqual(out.length, 2); near(out[0].usd, 201);
  const b = W.newBook(), now = 1e12; W.add(b, 'X', now - 30e3, 100, false); W.add(b, 'X', now - 10 * 60e3, 50, true);
  assert.strictEqual(W.sum(b, 'X', now, 3600e3).net, 50);
  const w = W.walls({ bids: [['99.95', '10'], ['98', '100']], asks: [['101.5', '50']] }, 100);
  assert.strictEqual(w.bids[0].usd, 9800);
  assert.strictEqual(W.futuresSummary({ top: [{ longAccount: '0.5' }, { longAccount: '0.53' }] }).vote, 1);
});
test('vol sizing: high volatility → smaller position', () => {
  const st1 = C.newState(1000), st2 = C.newState(1000), p = { ...Z, lev: 100 };
  C.openPos(st1, { dir: 1, entry: 100, sl: 95, tp: 110, volMult: 1 }, 0, p, 't');
  C.openPos(st2, { dir: 1, entry: 100, sl: 95, tp: 110, volMult: 0.5 }, 0, p, 't');
  near(st2.pos.qty, st1.pos.qty / 2);
});
test('strategy2 adds signals (OR) and never removes them', () => {
  const cs = F.candles(), ind = C.indicators(cs, F.P), p = { ...F.P, strategy: 'breakout' };
  let a = 0, b = 0;
  for (let i = 1; i < cs.length - 1; i++) { if (C.signalAt(cs, ind, i, p)) a++; if (C.signalAt(cs, ind, i, { ...p, strategy2: 'ema' })) b++; }
  assert.ok(b >= a && b > 0);
});
test('daily loss stop blocks new entries after the limit', () => {
  const st = C.newState(1000), p = { dailyLoss: 3 };
  assert.ok(C.dayGuard(st, 86400 * 10 + 10, p)); st.equity = 960;
  assert.ok(!C.dayGuard(st, 86400 * 10 + 500, p)); assert.ok(C.dayGuard(st, 86400 * 11 + 1, p));
});
test('portfolio: maxSameDir and eligibility respected', () => {
  const sets = [3, 5, 7, 9, 11].map((seed, k) => { const cs = F.candles(1500, seed); return { sym: 'S' + k, cs, ind: C.indicators(cs, F.P) }; });
  const p = { ...F.P, strategy: 'breakout', slAtr: 3, tpR: 3 }, pf = C.newPortfolio(1000, sets.map(s => s.sym));
  const opts = { maxSameDir: 1, eligible: s => s !== 'S4' };
  for (let i = 1; i < 1499; i++) {
    C.portfolioStep(pf, sets.map(s => ({ slot: pf.slots[s.sym], cs: s.cs, ind: s.ind, i })), p, 4, opts);
    for (const d of [1, -1]) assert.ok(Object.values(pf.slots).filter(s => s.pos && s.pos.dir === d).length <= 1);
  }
  assert.ok(!pf.trades.some(t => t.sym === 'S4'));
});
test('dynamic universe picks top volume per month', () => {
  const mk = (sym, v) => ({ sym, cs: Array.from({ length: 2000 }, (_, i) => ({ time: 1.7e9 + i * 14400, close: 1, volume: v, qv: v })) });
  const u = C.dynamicUniverse([mk('A', 10), mk('B', 5), mk('C', 1)], 2);
  const t = 1.7e9 + 1500 * 14400;
  assert.ok(u('A', t) && u('B', t) && !u('C', t));
});
console.log(`tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
