// Crypto Signal Lab — whale tracking logic (no DOM). Loaded by index.html and by tests (node).
const Whale = (() => {
  const STABLE = /^(USDC|FDUSD|TUSD|USDP|DAI|BUSD|EUR|AEUR|EURI|USDE|XUSD|BFUSD|PYUSD|USD1|UST|USTC|PAX|SUSD)USDT$/;
  const LEVERAGED = /(UP|DOWN|BULL|BEAR)USDT$/;

  // Top USDT pairs by 24h quote volume (stablecoins / leveraged tokens excluded); `must` symbols always included
  function topSymbols(tickers, n, must = []) {
    const list = tickers
      .filter(t => t.symbol.endsWith('USDT') && !STABLE.test(t.symbol) && !LEVERAGED.test(t.symbol) && +t.quoteVolume > 0)
      .sort((a, b) => +b.quoteVolume - +a.quoteVolume)
      .slice(0, n).map(t => t.symbol);
    must.forEach(s => { if (s && !list.includes(s)) list.unshift(s); });
    return list;
  }

  // Merge aggTrades from the same taker order (same symbol, side and trade time) into one order
  function merger(onOrder) {
    const pend = {};
    const flush = s => { const p = pend[s]; if (p) { delete pend[s]; p.price = p.usd / p.qty; onOrder(p); } };
    return {
      push(sym, T, price, qty, isSell) {
        const p = pend[sym];
        if (p && (p.T !== T || p.isSell !== isSell)) flush(sym);
        const q = pend[sym] || (pend[sym] = { sym, T, isSell, usd: 0, qty: 0 });
        q.usd += price * qty; q.qty += qty;
      },
      flushAll() { Object.keys(pend).forEach(flush); }
    };
  }

  // Per-symbol minute buckets: book[sym][minute] = [buyUsd, sellUsd, buyCount, sellCount]
  const newBook = () => ({});
  function add(book, sym, tMs, usd, isSell) {
    const m = Math.floor(tMs / 60000), b = book[sym] || (book[sym] = {}), x = b[m] || (b[m] = [0, 0, 0, 0]);
    if (isSell) { x[1] += usd; x[3]++; } else { x[0] += usd; x[2]++; }
  }
  function sum(book, sym, nowMs, winMs) {
    let buy = 0, sell = 0, nb = 0, ns = 0;
    const b = book[sym], from = Math.floor((nowMs - winMs) / 60000);
    if (b) for (const k in b) if (+k > from) { const x = b[k]; buy += x[0]; sell += x[1]; nb += x[2]; ns += x[3]; }
    return { buy, sell, net: buy - sell, nb, ns };
  }
  function prune(book, nowMs, keepMs = 864e5) {
    const from = Math.floor((nowMs - keepMs) / 60000);
    for (const s in book) {
      for (const k in book[s]) if (+k <= from) delete book[s][k];
      if (!Object.keys(book[s]).length) delete book[s];
    }
  }
  function oldest(book) {
    let m = Infinity;
    for (const s in book) for (const k in book[s]) m = Math.min(m, +k);
    return isFinite(m) ? m * 60000 : null;
  }
  // +1 whales net buying, -1 net selling, 0 balanced, null no whale trades
  function spotVote(s) {
    const tot = s.buy + s.sell;
    if (!tot) return null;
    const x = s.net / tot;
    return x > 0.1 ? 1 : x < -0.1 ? -1 : 0;
  }

  // Order-book walls: bucket notional by price (bucketPct of price) within ±rangePct, return biggest
  function walls(depth, price, { bucketPct = 0.1, rangePct = 3, n = 3 } = {}) {
    const step = price * bucketPct / 100;
    let bidUsd = 0, askUsd = 0;
    const agg = (rows, isBid) => {
      const m = new Map();
      for (const [ps, qs] of rows) {
        const p = +ps, usd = p * +qs;
        if (Math.abs(p - price) / price * 100 > rangePct) continue;
        if (isBid) bidUsd += usd; else askUsd += usd;
        const k = isBid ? Math.floor(p / step) : Math.ceil(p / step);
        m.set(k, (m.get(k) || 0) + usd);
      }
      return [...m].map(([k, usd]) => ({ price: k * step, usd, dist: (k * step - price) / price * 100 }))
        .sort((a, b) => b.usd - a.usd).slice(0, n);
    };
    const bids = agg(depth.bids || [], true), asks = agg(depth.asks || [], false);
    const tot = bidUsd + askUsd;
    return { bids, asks, bidUsd, askUsd, imbalance: tot ? (bidUsd - askUsd) / tot * 100 : 0 };
  }

  // Binance futures stats (arrays oldest → newest, period 5m)
  function futuresSummary({ top, global, oi, taker }) {
    const r = { notes: [] }, f = a => a && a.length ? a[0] : null, l = a => a && a.length ? a[a.length - 1] : null;
    if (top?.length) { r.topLong = +l(top).longAccount * 100; r.topLongChg = r.topLong - +f(top).longAccount * 100; }
    if (global?.length) { r.retailLong = +l(global).longAccount * 100; r.retailChg = r.retailLong - +f(global).longAccount * 100; }
    if (oi?.length) { r.oiUsd = +l(oi).sumOpenInterestValue; r.oiChg = (r.oiUsd / +f(oi).sumOpenInterestValue - 1) * 100; }
    if (taker?.length) {
      const b = taker.reduce((s, x) => s + +x.buyVol, 0), s = taker.reduce((t, x) => t + +x.sellVol, 0);
      r.takerRatio = s ? b / s : null;
    }
    if (r.topLongChg > 1) r.notes.push(['g', 'รายใหญ่ทยอยเพิ่ม Long']);
    else if (r.topLongChg < -1) r.notes.push(['r', 'รายใหญ่ทยอยเพิ่ม Short']);
    if (r.topLong != null && r.retailLong != null) {
      if (r.topLong - r.retailLong > 5) r.notes.push(['g', 'รายใหญ่ถือ Long มากกว่ารายย่อย']);
      else if (r.retailLong - r.topLong > 5) r.notes.push(['r', 'รายย่อยถือ Long มากกว่ารายใหญ่ (ระวังแรงเทขาย)']);
    }
    if (r.oiChg > 1) r.notes.push(['m', 'Open Interest เพิ่ม → มีเงินใหม่เข้าตลาด']);
    else if (r.oiChg < -1) r.notes.push(['m', 'Open Interest ลด → มีการปิดสถานะ']);
    if (r.takerRatio > 1.1) r.notes.push(['g', 'แรงซื้อ Market ฝั่ง Futures เด่น']);
    else if (r.takerRatio != null && r.takerRatio < 0.9) r.notes.push(['r', 'แรงขาย Market ฝั่ง Futures เด่น']);
    r.vote = r.topLongChg == null ? null : r.topLongChg > 1 ? 1 : r.topLongChg < -1 ? -1 : 0;
    return r;
  }

  const usd = v => v == null || !isFinite(v) ? '–' : (v < 0 ? '-' : '') + '$' + (Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (Math.abs(v) / 1e3).toFixed(0) + 'K' : Math.abs(v).toFixed(0));

  return { topSymbols, merger, newBook, add, sum, prune, oldest, spotVote, walls, futuresSummary, usd };
})();
if (typeof module !== 'undefined') module.exports = Whale;
