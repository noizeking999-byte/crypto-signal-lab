// Crypto Signal Lab — core logic (no DOM). Loaded by index.html and by tests (node).
const Core = (() => {
  const nul = n => new Array(n).fill(null);
  const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const ok = (...v) => v.every(x => x != null && isFinite(x));

  // ---------- Basic series ----------
  function sma(src, n) {
    const out = nul(src.length);
    let sum = 0, cnt = 0;
    for (let i = 0; i < src.length; i++) {
      if (src[i] == null) { sum = 0; cnt = 0; continue; }
      sum += src[i]; cnt++;
      if (cnt > n) { sum -= src[i - n]; cnt = n; }
      if (cnt === n) out[i] = sum / n;
    }
    return out;
  }
  // EMA seeded with SMA of first n values; leading nulls skipped
  function ema(src, n) {
    const out = nul(src.length), k = 2 / (n + 1);
    let prev = null, sum = 0, cnt = 0;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      if (v == null) continue;
      if (prev == null) { sum += v; if (++cnt === n) out[i] = prev = sum / n; continue; }
      out[i] = prev = v * k + prev * (1 - k);
    }
    return out;
  }
  // Wilder smoothing (RMA)
  function rma(src, n) {
    const out = nul(src.length);
    let prev = null, sum = 0, cnt = 0;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      if (v == null) continue;
      if (prev == null) { sum += v; if (++cnt === n) out[i] = prev = sum / n; continue; }
      out[i] = prev = (prev * (n - 1) + v) / n;
    }
    return out;
  }
  const hh = (a, n, i) => { let m = -Infinity; for (let j = i - n + 1; j <= i; j++) m = Math.max(m, a[j]); return m; };
  const ll = (a, n, i) => { let m = Infinity; for (let j = i - n + 1; j <= i; j++) m = Math.min(m, a[j]); return m; };

  // ---------- Indicators ----------
  function rsi(c, n) {
    const out = nul(c.length);
    let g = 0, l = 0;
    const calc = () => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (let i = 1; i < c.length; i++) {
      const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = calc(); } }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = calc(); }
    }
    return out;
  }
  function trueRange(h, l, c) {
    return c.map((_, i) => (i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
  }
  const atr = (h, l, c, n) => rma(trueRange(h, l, c), n);
  function macd(c, f = 12, s = 26, sig = 9) {
    const ef = ema(c, f), es = ema(c, s);
    const line = c.map((_, i) => (ok(ef[i], es[i]) ? ef[i] - es[i] : null));
    const signal = ema(line, sig);
    return { line, signal, hist: line.map((v, i) => (ok(v, signal[i]) ? v - signal[i] : null)) };
  }
  function bollinger(c, n = 20, k = 2) {
    const mid = sma(c, n), up = nul(c.length), lo = nul(c.length);
    for (let i = n - 1; i < c.length; i++) {
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += (c[j] - mid[i]) ** 2;
      const sd = Math.sqrt(s / n);
      up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd;
    }
    return { mid, up, lo };
  }
  function stoch(h, l, c, n = 14, sk = 3, sd = 3) {
    const raw = c.map((_, i) => { if (i < n - 1) return null; const H = hh(h, n, i), L = ll(l, n, i); return H === L ? 50 : 100 * (c[i] - L) / (H - L); });
    const k = sma(raw, sk);
    return { k, d: sma(k, sd) };
  }
  function adx(h, l, c, n = 14) {
    const L = c.length, pdm = nul(L), mdm = nul(L), tr = nul(L);
    for (let i = 1; i < L; i++) {
      const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      pdm[i] = up > dn && up > 0 ? up : 0;
      mdm[i] = dn > up && dn > 0 ? dn : 0;
      tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    }
    const sp = rma(pdm, n), sm = rma(mdm, n), st = rma(tr, n), pdi = nul(L), mdi = nul(L), dx = nul(L);
    for (let i = 0; i < L; i++) if (st[i]) {
      pdi[i] = 100 * sp[i] / st[i]; mdi[i] = 100 * sm[i] / st[i];
      const s = pdi[i] + mdi[i];
      dx[i] = s ? 100 * Math.abs(pdi[i] - mdi[i]) / s : 0;
    }
    return { pdi, mdi, adx: rma(dx, n) };
  }
  function supertrend(h, l, c, a, m = 3) {
    const L = c.length, dir = nul(L), line = nul(L);
    let fu = null, fl = null, d = 1;
    for (let i = 0; i < L; i++) {
      if (a[i] == null) continue;
      const mid = (h[i] + l[i]) / 2, bu = mid + m * a[i], bl = mid - m * a[i];
      if (fu == null) { fu = bu; fl = bl; }
      else {
        const pc = c[i - 1];
        fu = bu < fu || pc > fu ? bu : fu;
        fl = bl > fl || pc < fl ? bl : fl;
      }
      if (d === 1 && c[i] < fl) d = -1; else if (d === -1 && c[i] > fu) d = 1;
      dir[i] = d; line[i] = d === 1 ? fl : fu;
    }
    return { dir, line };
  }
  function ichimoku(h, l, c) {
    const L = c.length, mid = (n, i) => (i < n - 1 ? null : (hh(h, n, i) + ll(l, n, i)) / 2);
    const tenkan = nul(L), kijun = nul(L), spanA = nul(L), spanB = nul(L);
    for (let i = 0; i < L; i++) {
      tenkan[i] = mid(9, i); kijun[i] = mid(26, i); spanB[i] = mid(52, i);
      spanA[i] = ok(tenkan[i], kijun[i]) ? (tenkan[i] + kijun[i]) / 2 : null;
    }
    // cloud at bar i was plotted 26 bars ahead from i-26
    const cloudTop = c.map((_, i) => (i >= 26 && ok(spanA[i - 26], spanB[i - 26]) ? Math.max(spanA[i - 26], spanB[i - 26]) : null));
    const cloudBot = c.map((_, i) => (i >= 26 && ok(spanA[i - 26], spanB[i - 26]) ? Math.min(spanA[i - 26], spanB[i - 26]) : null));
    return { tenkan, kijun, cloudTop, cloudBot };
  }
  function psar(h, l, c, step = 0.02, max = 0.2) {
    const L = c.length, sar = nul(L), dir = nul(L);
    if (L < 3) return { sar, dir };
    let up = c[1] > c[0], ep = up ? h[1] : l[1], s = up ? l[0] : h[0], af = step;
    sar[1] = s; dir[1] = up ? 1 : -1;
    for (let i = 2; i < L; i++) {
      s = s + af * (ep - s);
      if (up) {
        s = Math.min(s, l[i - 1], l[i - 2]);
        if (l[i] < s) { up = false; s = ep; ep = l[i]; af = step; }
        else if (h[i] > ep) { ep = h[i]; af = Math.min(af + step, max); }
      } else {
        s = Math.max(s, h[i - 1], h[i - 2]);
        if (h[i] > s) { up = true; s = ep; ep = h[i]; af = step; }
        else if (l[i] < ep) { ep = l[i]; af = Math.min(af + step, max); }
      }
      sar[i] = s; dir[i] = up ? 1 : -1;
    }
    return { sar, dir };
  }
  function cci(h, l, c, n = 20) {
    const tp = c.map((_, i) => (h[i] + l[i] + c[i]) / 3), m = sma(tp, n), out = nul(c.length);
    for (let i = n - 1; i < c.length; i++) {
      let md = 0;
      for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]);
      md /= n;
      out[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0;
    }
    return out;
  }
  const willr = (h, l, c, n = 14) => c.map((_, i) => { if (i < n - 1) return null; const H = hh(h, n, i), L = ll(l, n, i); return H === L ? -50 : -100 * (H - c[i]) / (H - L); });
  function mfi(h, l, c, v, n = 14) {
    const tp = c.map((_, i) => (h[i] + l[i] + c[i]) / 3), out = nul(c.length);
    for (let i = n; i < c.length; i++) {
      let pos = 0, neg = 0;
      for (let j = i - n + 1; j <= i; j++) {
        const mf = tp[j] * v[j];
        if (tp[j] > tp[j - 1]) pos += mf; else if (tp[j] < tp[j - 1]) neg += mf;
      }
      out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
    }
    return out;
  }
  function obv(c, v) {
    const out = new Array(c.length).fill(0);
    for (let i = 1; i < c.length; i++) out[i] = out[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0);
    return out;
  }
  function vwap(h, l, c, v, n = 20) {
    const out = nul(c.length);
    for (let i = n - 1; i < c.length; i++) {
      let pv = 0, vv = 0;
      for (let j = i - n + 1; j <= i; j++) { pv += (h[j] + l[j] + c[j]) / 3 * v[j]; vv += v[j]; }
      out[i] = vv ? pv / vv : null;
    }
    return out;
  }
  // Donchian channel of the PREVIOUS n bars (breakout reference)
  function donchian(h, l, n = 20) {
    return { up: h.map((_, i) => (i < n ? null : hh(h, n, i - 1))), lo: l.map((_, i) => (i < n ? null : ll(l, n, i - 1))) };
  }

  // ---------- All indicators + confluence votes ----------
  const VOTE_NAMES = ['EMA เทรนด์', 'EMA เร็ว/ช้า', 'MACD', 'RSI', 'Stochastic', 'Bollinger', 'ADX/DMI', 'Supertrend', 'Ichimoku', 'Parabolic SAR', 'CCI', 'Williams %R', 'MFI', 'OBV', 'VWAP', 'Donchian'];

  function indicators(cs, p) {
    const c = cs.map(x => x.close), h = cs.map(x => x.high), l = cs.map(x => x.low), v = cs.map(x => x.volume || 0);
    const ind = {
      fast: ema(c, p.fast), slow: ema(c, p.slow), trend: ema(c, p.trend), rsi: rsi(c, p.rsi), atr: atr(h, l, c, p.atr),
      macd: macd(c), bb: bollinger(c), stoch: stoch(h, l, c), adx: adx(h, l, c), ich: ichimoku(h, l, c),
      psar: psar(h, l, c), cci: cci(h, l, c), willr: willr(h, l, c), mfi: mfi(h, l, c, v), vwap: vwap(h, l, c, v), don: donchian(h, l)
    };
    ind.st = supertrend(h, l, c, atr(h, l, c, 10), 3);
    ind.obv = obv(c, v); ind.obvE = ema(ind.obv, 20);
    ind.htf = ema(c, 800); // ≈ EMA200 of a 4x higher timeframe
    ind.score = cs.map((_, i) => score(votes(cs, ind, i, p)));
    return ind;
  }
  function votes(cs, ind, i, p) {
    const c = cs[i].close, I = ind, nz = (cond, f) => (cond ? f() : null);
    return [
      nz(ok(I.trend[i]), () => sgn(c - I.trend[i])),
      nz(ok(I.fast[i], I.slow[i]), () => sgn(I.fast[i] - I.slow[i])),
      nz(ok(I.macd.hist[i]), () => sgn(I.macd.hist[i])),
      nz(ok(I.rsi[i]), () => (I.rsi[i] > 55 ? 1 : I.rsi[i] < 45 ? -1 : 0)),
      nz(ok(I.stoch.k[i], I.stoch.d[i]), () => sgn(I.stoch.k[i] - I.stoch.d[i])),
      nz(ok(I.bb.mid[i]), () => sgn(c - I.bb.mid[i])),
      nz(ok(I.adx.adx[i], I.adx.pdi[i], I.adx.mdi[i]), () => (I.adx.adx[i] >= p.adxMin ? sgn(I.adx.pdi[i] - I.adx.mdi[i]) : 0)),
      I.st.dir[i],
      nz(ok(I.ich.cloudTop[i]), () => (c > I.ich.cloudTop[i] ? 1 : c < I.ich.cloudBot[i] ? -1 : 0)),
      I.psar.dir[i],
      nz(ok(I.cci[i]), () => sgn(I.cci[i])),
      nz(ok(I.willr[i]), () => (I.willr[i] > -50 ? 1 : -1)),
      nz(ok(I.mfi[i]), () => sgn(I.mfi[i] - 50)),
      nz(ok(I.obvE[i]), () => sgn(I.obv[i] - I.obvE[i])),
      nz(ok(I.vwap[i]), () => sgn(c - I.vwap[i])),
      nz(ok(I.don.up[i]), () => (c > I.don.up[i] ? 1 : c < I.don.lo[i] ? -1 : 0))
    ];
  }
  // -100..+100 ; null until at least 12 of 16 indicators are ready
  function score(vs) {
    const a = vs.filter(x => x != null);
    return a.length < 12 ? null : a.reduce((s, x) => s + x, 0) / a.length * 100;
  }

  // ---------- Strategies (return 1 long, -1 short, 0 none) ----------
  const STRATS = {
    confluence: { name: 'รวมทุกอินดิเคเตอร์ (Confluence)', fn: (cs, I, i, p) => {
      const s = I.score[i], q = I.score[i - 1];
      if (!ok(s, q)) return 0;
      return s >= p.conf && q < p.conf ? 1 : s <= -p.conf && q > -p.conf ? -1 : 0;
    } },
    ema: { name: 'EMA Cross + RSI', fn: (cs, I, i) => {
      const f = I.fast, s = I.slow, t = I.trend[i], r = I.rsi[i], c = cs[i].close;
      if (!ok(f[i], f[i - 1], s[i], s[i - 1], t, r)) return 0;
      if (f[i] > s[i] && f[i - 1] <= s[i - 1] && c > t && r > 50) return 1;
      if (f[i] < s[i] && f[i - 1] >= s[i - 1] && c < t && r < 50) return -1;
      return 0;
    } },
    macd: { name: 'MACD Cross + เทรนด์', fn: (cs, I, i) => {
      const m = I.macd, t = I.trend[i], c = cs[i].close;
      if (!ok(m.line[i], m.line[i - 1], m.signal[i], m.signal[i - 1], t)) return 0;
      if (m.line[i] > m.signal[i] && m.line[i - 1] <= m.signal[i - 1] && c > t) return 1;
      if (m.line[i] < m.signal[i] && m.line[i - 1] >= m.signal[i - 1] && c < t) return -1;
      return 0;
    } },
    supertrend: { name: 'Supertrend', fn: (cs, I, i) => {
      const d = I.st.dir;
      if (!ok(d[i], d[i - 1]) || d[i] === d[i - 1]) return 0;
      return d[i];
    } },
    breakout: { name: 'Donchian Breakout', fn: (cs, I, i) => {
      const D = I.don, c = cs[i].close, pc = cs[i - 1].close, t = I.trend[i];
      if (!ok(D.up[i], D.up[i - 1], t)) return 0;
      if (c > D.up[i] && pc <= D.up[i - 1] && c > t) return 1;
      if (c < D.lo[i] && pc >= D.lo[i - 1] && c < t) return -1;
      return 0;
    } },
    meanrev: { name: 'RSI + Bollinger (เด้งกลับ)', fn: (cs, I, i) => {
      const B = I.bb, c = cs[i].close, pc = cs[i - 1].close, r = I.rsi[i];
      if (!ok(B.lo[i], B.lo[i - 1], r)) return 0;
      if (pc < B.lo[i - 1] && c > B.lo[i] && r < 40) return 1;
      if (pc > B.up[i - 1] && c < B.up[i] && r > 60) return -1;
      return 0;
    } }
  };

  // Trading styles: short-term to long-term presets
  const STYLES = {
    scalp: { name: 'Scalp (สั้นมาก)', tf: '5m', slAtr: 3, tpR: 1.5 },
    day: { name: 'Day trade (สั้น)', tf: '15m', slAtr: 3, tpR: 2 },
    swing: { name: 'Swing (กลาง) แนะนำ', tf: '4h', slAtr: 3, tpR: 3 },
    position: { name: 'Position (ยาว)', tf: '1d', slAtr: 3, tpR: 3 }
  };

  // SL distance = ATR × slAtr, but never below minSl % of price, and wide enough that
  // the TP distance is at least minEdge × round-trip costs (fees + slippage, both sides)
  function minRiskPct(p) {
    const roundTrip = 2 * ((p.fee || 0) + (p.slip || 0));
    return Math.max(p.minSl || 0, (p.minEdge || 0) * roundTrip / (p.tpR || 1));
  }
  function levels(dir, entry, atrV, p) {
    const risk = Math.max(atrV * p.slAtr, entry * minRiskPct(p) / 100);
    return { dir, entry, sl: entry - dir * risk, tp: entry + dir * risk * p.tpR };
  }
  // ---------- Entry filters (validated in tools/results2.md) ----------
  // ext (optional, aligned to bars): dxy/gold/oil = {val, sma} daily (previous day), fng = daily value, btcUp = bool
  function trendOk(d, s, i, sign) {
    if (!s || s.val[i] == null || s.sma[i] == null) return true; // no data → don't block
    const up = s.val[i] > s.sma[i];
    return d === 1 ? up === (sign === 1) : up !== (sign === 1);
  }
  const FILTERS = {
    fDxy: { name: 'ดอลลาร์ (DXY): Long เมื่อดอลลาร์อ่อน / Short เมื่อแข็ง', fn: (d, cs, I, i) => trendOk(d, I.ext?.dxy, i, -1) },
    fGold: { name: 'ทองคำ: Long เมื่อทองขาขึ้น / Short เมื่อขาลง', fn: (d, cs, I, i) => trendOk(d, I.ext?.gold, i, 1) },
    fOil: { name: 'น้ำมัน: Long เมื่อน้ำมันขาขึ้น / Short เมื่อขาลง', fn: (d, cs, I, i) => trendOk(d, I.ext?.oil, i, 1) },
    fFng: { name: 'Fear & Greed: ไม่ Long ตอนโลภสุด (≥75) / ไม่ Short ตอนกลัวสุด (≤25)', fn: (d, cs, I, i) => { const f = I.ext?.fng?.[i]; return f == null || (d === 1 ? f < 75 : f > 25); } },
    fBtc: { name: 'เทรนด์ BTC: Long altcoin เมื่อ BTC เหนือ EMA200', fn: (d, cs, I, i) => { const b = I.ext?.btcUp?.[i]; return b == null || (d === 1 ? b : !b); } },
    fAdx: { name: 'ADX ≥ 25 + เทรนด์ใหญ่ (EMA800)', fn: (d, cs, I, i) => I.adx.adx[i] >= 25 && I.htf[i] != null && (d === 1 ? cs[i].close > I.htf[i] : cs[i].close < I.htf[i]) }
  };
  const passFilters = (d, cs, I, i, p) => Object.keys(FILTERS).every(k => !p[k] || FILTERS[k].fn(d, cs, I, i));
  function signalAt(cs, ind, i, p) {
    if (i < 1 || !ok(ind.atr[i])) return null;
    const d = (STRATS[p.strategy] || STRATS.confluence).fn(cs, ind, i, p);
    return d && passFilters(d, cs, ind, i, p) ? levels(d, cs[i].close, ind.atr[i], p) : null;
  }
  const blockedBy = (d, cs, I, i, p) => Object.keys(FILTERS).filter(k => p[k] && !FILTERS[k].fn(d, cs, I, i)).map(k => FILTERS[k].name.split(':')[0]);
  // Most recent signal (any age, up to maxBack bars) and what happened after it
  function lastSignal(cs, ind, p, i, maxBack = 3000) {
    for (let j = i; j > Math.max(0, i - maxBack); j--) {
      const sig = signalAt(cs, ind, j, p);
      if (!sig) continue;
      const st = newState(1e6), q = { ...p, limit: false };
      if (!openPos(st, sig, cs[j].time, q, 'x')) return { at: j, ago: i - j, sig, status: 'open' };
      for (let k = j + 1; k <= i && st.pos; k++) {
        stepExits(st, cs, ind, k, q);
        const o = signalAt(cs, ind, k, q);
        if (st.pos && o && o.dir !== st.pos.dir && q.exitOpp) closePos(st, cs[k].time, cs[k].close, 'กลับตัว', q);
      }
      const t = st.trades[0];
      return { at: j, ago: i - j, sig, status: st.pos ? 'open' : t.reason, exit: t?.exit, r: t ? t.r : unreal(st, cs[i].close, cs[i].time, q) / st.pos.riskAmt };
    }
    return null;
  }
  // What would trigger the next entry on each side (trigger price when the strategy has one)
  function plan(cs, ind, p, i) {
    const c = cs[i].close, a = ind.atr[i], hhv = (n, k) => { let m = -Infinity; for (let j = k - n + 1; j <= k; j++) m = Math.max(m, cs[j].high); return m; };
    const llv = (n, k) => { let m = Infinity; for (let j = k - n + 1; j <= k; j++) m = Math.min(m, cs[j].low); return m; };
    const t = ind.trend[i], out = {};
    for (const d of [1, -1]) {
      let trig = null, cond = '';
      switch (p.strategy) {
        case 'breakout':
          trig = d === 1 ? hhv(20, i) : llv(20, i);
          cond = `ปิด${d === 1 ? 'เหนือ' : 'ใต้'}กรอบ 20 แท่ง และ${d === 1 ? 'เหนือ' : 'ใต้'} EMA${p.trend}`;
          if (t != null && (d === 1 ? trig < t : trig > t)) trig = t; // must also clear the trend EMA
          break;
        case 'supertrend':
          if (ind.st.dir[i] === -d) { trig = ind.st.line[i]; cond = `ปิด${d === 1 ? 'เหนือ' : 'ใต้'}เส้น Supertrend`; } else cond = 'Supertrend อยู่ฝั่งนี้แล้ว รอรอบใหม่';
          break;
        case 'meanrev':
          trig = d === 1 ? ind.bb.lo[i] : ind.bb.up[i];
          cond = `หลุด${d === 1 ? 'ล่าง' : 'บน'} Bollinger แล้วปิดกลับเข้ามา + RSI ${d === 1 ? '< 40' : '> 60'}`;
          break;
        case 'ema': cond = `EMA${p.fast} ตัด${d === 1 ? 'ขึ้น' : 'ลง'} EMA${p.slow} + ราคา${d === 1 ? 'เหนือ' : 'ใต้'} EMA${p.trend} + RSI ${d === 1 ? '> 50' : '< 50'}`; break;
        case 'macd': cond = `MACD ตัด${d === 1 ? 'ขึ้น' : 'ลง'} Signal + ราคา${d === 1 ? 'เหนือ' : 'ใต้'} EMA${p.trend}`; break;
        default: cond = `คะแนนรวม${d === 1 ? 'ขึ้นถึง +' : 'ลงถึง -'}${p.conf}`;
      }
      const entry = trig ?? c, lv = a != null ? levels(d, entry, a, p) : null, bl = blockedBy(d, cs, ind, i, p);
      out[d === 1 ? 'long' : 'short'] = { ...lv, trigger: trig, cond, blocked: bl, allowed: !bl.length && (d === 1 || p.shorts) };
    }
    return out;
  }
  // Align daily map {YYYY-MM-DD: close} to bars using the PREVIOUS day (no look-ahead)
  function alignDaily(cs, map) {
    const days = Object.keys(map).sort(), out = new Array(cs.length).fill(null);
    let j = -1;
    for (let i = 0; i < cs.length; i++) {
      const today = new Date(cs[i].time * 1000).toISOString().slice(0, 10);
      while (j + 1 < days.length && days[j + 1] < today) j++;
      out[i] = j >= 0 ? map[days[j]] : null;
    }
    return out;
  }
  function alignDailyTrend(cs, map, n = 50) {
    const days = Object.keys(map).sort(), m = sma(days.map(d => map[d]), n), sm = {};
    days.forEach((d, k) => { if (m[k] != null) sm[d] = m[k]; });
    return { val: alignDaily(cs, map), sma: alignDaily(cs, sm) };
  }
  // Last value at or before each bar's open time; pts sorted [[timeSec, v]]
  function alignSeries(cs, pts) {
    const out = new Array(cs.length).fill(null);
    let j = -1;
    for (let i = 0; i < cs.length; i++) { while (j + 1 < pts.length && pts[j + 1][0] <= cs[i].time) j++; out[i] = j >= 0 ? pts[j][1] : null; }
    return out;
  }

  // ---------- Trading engine with costs ----------
  // p.fee = taker fee % per side, p.slip = slippage % per side (market orders), p.funding = funding % per 8h
  // p.limit = enter + take profit with limit orders (maker fee p.makerFee, no slippage; entry must be touched next bar)
  // p.exitMode: 'fixed' | 'be' (SL→entry after +1R) | 'trail' (ATR trailing, no TP) | 'partial' (50% at +1R, then SL→entry)
  // p.trailAtr = trailing distance in ATR, p.maxBars = time stop in bars (0 = off)
  function newState(balance) { return { start: balance, equity: balance, pos: null, pending: null, trades: [], curve: [], lastTime: null }; }
  function openPos(st, lv, time, p, src, maker = false) {
    const fee = maker ? (p.makerFee ?? p.fee) : p.fee;
    const entry = maker ? lv.entry : lv.entry * (1 + lv.dir * p.slip / 100); // market = worse fill
    const dist = lv.dir * (entry - lv.sl);
    if (!(dist > 0) || st.equity <= 0) return false;
    // size so that hitting SL (entry fee + taker exit fee + exit slippage) loses ~risk%
    const costPerUnit = entry * fee / 100 + lv.sl * p.fee / 100 + lv.sl * p.slip / 100;
    let qty = (st.equity * p.risk / 100) / (dist + costPerUnit);
    qty = Math.min(qty, st.equity * p.lev / entry);
    const trail = p.exitMode === 'trail';
    st.pos = { dir: lv.dir, entry, sl: lv.sl, tp: trail ? lv.dir * Infinity : lv.tp, qty, time, riskAmt: qty * (dist + costPerUnit), src,
      feeIn: fee, oneR: dist, sl0: lv.sl, realized: 0, bars: 0, best: entry, beDone: false, partDone: false };
    return true;
  }
  // P/L of closing `q` units at `price` (fees + funding included)
  function legPnl(ps, q, exit, time, p, exitFee) {
    const fees = (ps.entry * ps.feeIn + exit * exitFee) * q / 100;
    const funding = ps.dir * (p.funding || 0) / 100 * ps.entry * q * Math.max(0, time - ps.time) / 3600 / 8;
    return (exit - ps.entry) * q * ps.dir - fees - funding;
  }
  const fill = (ps, price, p, maker) => (maker ? price : price * (1 - ps.dir * p.slip / 100));
  function closePos(st, time, price, reason, p, maker = false) {
    const ps = st.pos, exit = fill(ps, price, p, maker);
    const pnl = legPnl(ps, ps.qty, exit, time, p, maker ? (p.makerFee ?? p.fee) : p.fee);
    st.equity += pnl;
    const total = pnl + ps.realized;
    st.trades.push({ dir: ps.dir, entry: ps.entry, sl: ps.sl, tp: ps.tp, time: ps.time, src: ps.src, exit, exitTime: time, reason, pnl: total, r: total / ps.riskAmt });
    st.pos = null;
  }
  function closePart(st, time, price, frac, p, maker) {
    const ps = st.pos, q = ps.qty * frac, exit = fill(ps, price, p, maker);
    const pnl = legPnl(ps, q, exit, time, p, maker ? (p.makerFee ?? p.fee) : p.fee);
    st.equity += pnl; ps.realized += pnl; ps.qty -= q; ps.partDone = true; ps.sl = ps.entry;
  }
  const hit = (ps, bar, lvl) => (ps.dir === 1 ? bar.high >= lvl : bar.low <= lvl);
  const hitStop = (ps, bar) => (ps.dir === 1 ? bar.low <= ps.sl : bar.high >= ps.sl);
  // SL / partial / TP inside a closed bar. SL is checked first (conservative when both are touched).
  function checkBar(st, bar, p) {
    const ps = st.pos;
    if (!ps || bar.time <= ps.time) return;
    if (hitStop(ps, bar))
      return closePos(st, bar.time, ps.dir === 1 ? Math.min(bar.open, ps.sl) : Math.max(bar.open, ps.sl), ps.partDone || ps.beDone ? 'SL (ทุน)' : ps.sl !== ps.sl0 && p.exitMode === 'trail' ? 'Trailing' : 'SL', p);
    if (p.exitMode === 'partial' && !ps.partDone) {
      const lvl = ps.entry + ps.dir * ps.oneR;
      if (hit(ps, bar, lvl)) closePart(st, bar.time, ps.dir === 1 ? Math.max(bar.open, lvl) : Math.min(bar.open, lvl), 0.5, p, !!p.limit);
    }
    if (hit(ps, bar, ps.tp))
      return closePos(st, bar.time, ps.dir === 1 ? Math.max(bar.open, ps.tp) : Math.min(bar.open, ps.tp), 'TP', p, !!p.limit);
  }
  // Stop management at bar close (applies from the next bar → no look-ahead)
  function manage(st, cs, ind, i, p) {
    const ps = st.pos, bar = cs[i];
    if (!ps || bar.time <= ps.time) return;
    ps.bars++;
    if (p.exitMode === 'be' && !ps.beDone && hit(ps, bar, ps.entry + ps.dir * ps.oneR)) { ps.beDone = true; ps.sl = ps.dir === 1 ? Math.max(ps.sl, ps.entry) : Math.min(ps.sl, ps.entry); }
    if (p.exitMode === 'trail' && ind.atr[i] != null) {
      ps.best = ps.dir === 1 ? Math.max(ps.best, bar.close) : Math.min(ps.best, bar.close);
      const ns = ps.best - ps.dir * (p.trailAtr || 3) * ind.atr[i];
      ps.sl = ps.dir === 1 ? Math.max(ps.sl, ns) : Math.min(ps.sl, ns);
    }
    if (p.maxBars > 0 && ps.bars >= p.maxBars) closePos(st, bar.time, bar.close, 'หมดเวลา', p);
  }
  // Live tick check (paper trading)
  function checkPrice(st, price, time, p) {
    const ps = st.pos;
    if (!ps) return;
    if (ps.dir === 1 ? price <= ps.sl : price >= ps.sl) return closePos(st, time, price, ps.partDone || ps.beDone ? 'SL (ทุน)' : 'SL', p);
    if (p.exitMode === 'partial' && !ps.partDone && (ps.dir === 1 ? price >= ps.entry + ps.oneR : price <= ps.entry - ps.oneR)) closePart(st, time, price, 0.5, p, !!p.limit);
    if (ps.dir === 1 ? price >= ps.tp : price <= ps.tp) return closePos(st, time, price, 'TP', p, !!p.limit);
  }
  // unrealized P/L net of estimated exit costs (+ realized partial)
  function unreal(st, price, time, p) {
    const ps = st.pos;
    if (!ps) return 0;
    return legPnl(ps, ps.qty, fill(ps, price, p, false), time ?? ps.time, p, p.fee);
  }
  // Pending limit entry: fill if next bar touches the price; if that bar also breaches SL, stop out (conservative)
  function fillPending(st, bar, p) {
    const pe = st.pending;
    if (!pe || bar.time <= pe.time) return;
    st.pending = null;
    if (st.pos || !(pe.lv.dir === 1 ? bar.low <= pe.lv.entry : bar.high >= pe.lv.entry)) return;
    if (!openPos(st, pe.lv, bar.time, p, pe.src, true)) return;
    if (hitStop(st.pos, bar)) closePos(st, bar.time, st.pos.sl, 'SL', p);
  }
  function stepExits(st, cs, ind, i, p) {
    fillPending(st, cs[i], p);
    checkBar(st, cs[i], p);
    manage(st, cs, ind, i, p);
  }
  // returns true if a new position/order was placed
  function stepEntry(st, cs, ind, i, p, sig, src = 'auto') {
    const bar = cs[i];
    if (!sig) return false;
    if (st.pos && sig.dir !== st.pos.dir && p.exitOpp) closePos(st, bar.time, bar.close, 'กลับตัว', p);
    if (st.pos || st.pending || !(sig.dir === 1 || p.shorts)) return false;
    if (p.limit) { st.pending = { lv: sig, time: bar.time, src }; return true; }
    return openPos(st, sig, bar.time, p, src);
  }
  function step(st, cs, ind, i, p, auto = true) {
    const bar = cs[i];
    stepExits(st, cs, ind, i, p);
    if (auto) stepEntry(st, cs, ind, i, p, signalAt(cs, ind, i, p));
    st.curve.push({ time: bar.time, value: st.equity + unreal(st, bar.close, bar.time, p) });
    st.lastTime = bar.time;
  }
  function backtest(cs, ind, p, lastClosed) {
    const st = newState(p.bal);
    for (let i = 1; i <= lastClosed; i++) step(st, cs, ind, i, p);
    return st;
  }

  // ---------- Portfolio: many coins, shared equity, at most maxPos open positions ----------
  // sets: [{ sym, cs, ind, last }] ; per-position notional capped at equity × lev / maxPos
  function newPortfolio(balance, syms) {
    const pf = { start: balance, equity: balance, trades: [], curve: [], lastTime: null, slots: {} };
    for (const s of syms) pf.slots[s] = makeSlot(pf, s);
    return pf;
  }
  function makeSlot(pf, sym) {
    return { sym, pos: null, pending: null, lastClose: null, lastTime: null,
      get equity() { return pf.equity; }, set equity(v) { pf.equity = v; },
      trades: { push: t => pf.trades.push({ ...t, sym }) } };
  }
  const openCount = pf => Object.values(pf.slots).filter(s => s.pos || s.pending).length;
  // process all sets for bar time t (each set: index i with cs[i].time === t)
  function portfolioStep(pf, items, p, maxPos) {
    const q = { ...p, lev: p.lev / maxPos };
    for (const { slot, cs, ind, i } of items) { stepExits(slot, cs, ind, i, q); slot.lastClose = cs[i].close; slot.lastTime = cs[i].time; }
    const sigs = items.map(x => ({ ...x, sig: signalAt(x.cs, x.ind, x.i, q) })).filter(x => x.sig)
      .sort((a, b) => Math.abs(b.ind.score[b.i] ?? 0) - Math.abs(a.ind.score[a.i] ?? 0));
    for (const x of sigs) {
      const s = x.slot;
      if (s.pos && x.sig.dir !== s.pos.dir && q.exitOpp) closePos(s, x.cs[x.i].time, x.cs[x.i].close, 'กลับตัว', q);
      if (!s.pos && !s.pending && openCount(pf) < maxPos) stepEntry(s, x.cs, x.ind, x.i, q, x.sig);
    }
    const t = items[0].cs[items[0].i].time;
    let u = 0;
    for (const s of Object.values(pf.slots)) if (s.pos && s.lastClose != null) u += unreal(s, s.lastClose, s.lastTime, q);
    pf.curve.push({ time: t, value: pf.equity + u });
    pf.lastTime = t;
  }
  function portfolioBacktest(sets, p, maxPos = 5, fromTime = -Infinity, toTime = Infinity) {
    const pf = newPortfolio(p.bal, sets.map(s => s.sym)), byTime = new Map();
    for (const s of sets) {
      const last = s.last ?? s.cs.length - 2;
      for (let i = 1; i <= last; i++) {
        const t = s.cs[i].time;
        if (t < fromTime || t > toTime) continue;
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t).push({ slot: pf.slots[s.sym], cs: s.cs, ind: s.ind, i });
      }
    }
    for (const t of [...byTime.keys()].sort((a, b) => a - b)) portfolioStep(pf, byTime.get(t), p, maxPos);
    return pf;
  }
  // per-year breakdown of trades
  function byYear(trades) {
    const y = {};
    for (const t of trades) { const k = new Date(t.exitTime * 1000).getUTCFullYear(); (y[k] ||= { n: 0, w: 0, r: 0 }); y[k].n++; y[k].r += t.r; if (t.pnl > 0) y[k].w++; }
    return Object.entries(y).map(([year, v]) => ({ year: +year, n: v.n, win: v.w / v.n * 100, avgR: v.r / v.n }));
  }
  function stats(st) {
    const t = st.trades, wins = t.filter(x => x.pnl > 0);
    const gw = wins.reduce((a, x) => a + x.pnl, 0), gl = -t.filter(x => x.pnl <= 0).reduce((a, x) => a + x.pnl, 0);
    let peak = -Infinity, dd = 0;
    for (const c of st.curve) { peak = Math.max(peak, c.value); dd = Math.max(dd, (peak - c.value) / peak); }
    return {
      n: t.length, win: t.length ? wins.length / t.length * 100 : 0,
      net: (st.equity - st.start) / st.start * 100, pf: gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0),
      dd: dd * 100, avgR: t.length ? t.reduce((a, x) => a + x.r, 0) / t.length : 0,
      years: st.curve.length > 1 ? (st.curve[st.curve.length - 1].time - st.curve[0].time) / 31557600 : 0,
      cagr: (() => { const yrs = st.curve.length > 1 ? (st.curve[st.curve.length - 1].time - st.curve[0].time) / 31557600 : 0; return yrs > 0.1 && st.equity > 0 ? ((st.equity / st.start) ** (1 / yrs) - 1) * 100 : null; })(),
      // win rate needed to break even given the actual average win / loss (in R)
      beWin: (() => { const W = wins.map(x => x.r), L = t.filter(x => x.pnl <= 0).map(x => -x.r);
        if (!W.length || !L.length) return null; const aw = W.reduce((a, x) => a + x, 0) / W.length, al = L.reduce((a, x) => a + x, 0) / L.length; return al / (aw + al) * 100; })()
    };
  }
  function backtestRange(cs, ind, p, from, to) {
    const st = newState(p.bal);
    for (let i = from; i <= to; i++) step(st, cs, ind, i, p);
    return st;
  }
  // Pick best SL/TP on first `split` of data, test on the rest
  function walkForward(cs, ind, p, lastClosed, split = 0.6) {
    const cut = Math.floor(lastClosed * split), grid = [];
    for (const sl of [1, 1.5, 2, 3]) for (const tp of [1, 1.5, 2, 3]) {
      const q = { ...p, slAtr: sl, tpR: tp }, tr = stats(backtestRange(cs, ind, q, 1, cut));
      grid.push({ sl, tp, train: tr });
    }
    const cand = grid.filter(g => g.train.n >= 10).sort((a, b) => b.train.avgR - a.train.avgR);
    const best = cand[0] || null;
    const test = best ? stats(backtestRange(cs, ind, { ...p, slAtr: best.sl, tpR: best.tp }, cut + 1, lastClosed)) : null;
    const cur = stats(backtestRange(cs, ind, p, cut + 1, lastClosed));
    return { cut, best, test, cur, grid };
  }
  function compareAll(cs, ind, p, lastClosed) {
    return Object.keys(STRATS).map(k => ({ key: k, name: STRATS[k].name, ...stats(backtest(cs, ind, { ...p, strategy: k }, lastClosed)) }));
  }

  return { sma, ema, rma, rsi, atr, macd, bollinger, stoch, adx, supertrend, ichimoku, psar, cci, willr, mfi, obv, vwap, donchian,
    VOTE_NAMES, STRATS, STYLES, FILTERS, passFilters, alignDaily, alignDailyTrend, alignSeries, indicators, votes, score, minRiskPct, levels, signalAt, lastSignal, plan, backtestRange, walkForward,
    newState, openPos, closePos, closePart, checkBar, manage, checkPrice, unreal, fillPending, stepExits, stepEntry, step, backtest, stats, compareAll,
    newPortfolio, portfolioStep, portfolioBacktest, byYear };
})();
if (typeof module !== 'undefined') module.exports = Core;
