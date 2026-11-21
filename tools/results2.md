# Analysis round 2: external data

Generated 2026-11-21T21:07:22.950Z (GitHub runner, US)

## Data source check

| source | HTTP |
|---|---|
| Yahoo chart | 200 |
| Fear & Greed | 200 |
| Binance futures (fapi) | 451 |
| CoinDesk RSS | 200 |
| Cointelegraph RSS | 200 |
| ForexFactory calendar | 200 |

## 1. Daily correlation with BTC (last ~2 years)

same day = move together · next day = asset today vs BTC tomorrow (predictive?)

| asset | same day | next day | days |
|---|---|---|---|
| gold | 0.21 | 0.00 | 499 |
| oil | -0.04 | 0.03 | 499 |
| dxy | -0.12 | -0.05 | 499 |
| spx | 0.45 | -0.08 | 499 |
| vix | -0.41 | 0.04 | 499 |

## 2. Filters on new defaults (SL 3×ATR, TP 3R, spot costs). Cell = avg R (all) · first60% → last40% · trades

A filter is useful only if it beats "none" in BOTH halves.

### 4h

| filter | breakout | ema | macd | supertrend | confluence |
|---|---|---|---|---|---|
| none | 0.17 · 0.11→0.25 · 407 | 0.18 · 0.24→0.12 · 219 | -0.00 · -0.00→-0.07 · 349 | 0.01 · 0.10→-0.10 · 577 | -0.01 · 0.01→-0.05 · 736 |
| btcTrend | 0.19 · 0.08→0.35 · 347 | 0.19 · 0.24→0.15 · 174 | 0.04 · 0.11→-0.10 · 271 | 0.16 · 0.24→0.01 · 242 | 0.08 · 0.06→0.08 · 406 |
| fngContra | 0.21 · 0.08→0.42 · 358 | 0.31 · 0.30→0.37 · 188 | 0.06 · -0.01→0.18 · 289 | 0.06 · 0.11→-0.02 · 513 | 0.01 · 0.02→-0.01 · 641 |
| fngTrend | 0.07 · -0.00→0.23 · 237 | -0.13 · 0.01→-0.28 · 123 | 0.14 · 0.17→0.02 · 200 | -0.02 · -0.01→-0.06 · 167 | 0.04 · -0.04→0.19 · 243 |
| fundContra | 0.17 · 0.11→0.23 · 395 | 0.16 · 0.20→0.13 · 207 | -0.02 · -0.01→-0.09 · 348 | 0.02 · 0.11→-0.09 · 562 | -0.01 · 0.01→-0.04 · 723 |
| spx | 0.08 · 0.01→0.19 · 235 | 0.18 · 0.24→0.11 · 119 | -0.12 · -0.01→-0.24 · 192 | -0.00 · -0.03→0.03 · 194 | -0.10 · -0.17→0.03 · 274 |
| dxy | 0.38 · 0.14→0.69 · 202 | 0.46 · 0.34→0.61 · 101 | 0.07 · 0.06→0.13 · 187 | 0.28 · 0.18→0.35 · 192 | 0.17 · -0.02→0.45 · 254 |
| gold | 0.25 · 0.03→0.56 · 197 | 0.32 · 0.28→0.37 · 102 | 0.08 · 0.02→0.16 · 168 | 0.05 · -0.04→0.18 · 213 | 0.07 · -0.07→0.35 · 253 |
| oil | 0.26 · 0.16→0.37 · 201 | 0.45 · 0.57→0.36 · 110 | 0.09 · 0.15→-0.07 · 178 | 0.11 · 0.25→-0.11 · 224 | 0.01 · 0.11→-0.17 · 277 |
| vix | 0.18 · 0.10→0.29 · 397 | 0.21 · 0.24→0.20 · 211 | 0.02 · -0.02→-0.01 · 336 | -0.01 · 0.07→-0.11 · 556 | -0.01 · -0.01→-0.03 · 720 |
| random | 0.02 · 0.06→-0.03 · 310 | -0.02 · 0.04→-0.09 · 114 | -0.02 · -0.01→-0.08 · 225 | -0.01 · 0.06→-0.13 · 229 | -0.07 · -0.12→-0.03 · 482 |
| adxHtf | 0.20 · 0.02→0.51 · 168 | 0.09 · 0.27→-0.06 · 32 | 0.13 · 0.11→0.22 · 108 | -0.10 · 0.09→-0.32 · 59 | 0.05 · -0.12→0.35 · 140 |

### 1h

| filter | breakout | ema | macd | supertrend | confluence |
|---|---|---|---|---|---|
| none | -0.03 · -0.04→-0.04 · 417 | -0.20 · -0.13→-0.28 · 233 | -0.05 · -0.09→0.03 · 372 | -0.15 · -0.19→-0.08 · 613 | -0.13 · -0.14→-0.12 · 730 |
| btcTrend | -0.01 · 0.00→-0.05 · 354 | -0.22 · -0.16→-0.29 · 178 | -0.06 · -0.08→-0.02 · 311 | -0.13 · -0.23→0.02 · 270 | -0.10 · -0.15→-0.03 · 447 |
| fngContra | -0.02 · 0.01→-0.08 · 355 | -0.22 · -0.16→-0.29 · 207 | -0.07 · -0.07→-0.06 · 305 | -0.19 · -0.24→-0.12 · 506 | -0.16 · -0.18→-0.13 · 614 |
| fngTrend | 0.15 · 0.10→0.14 · 182 | -0.26 · -0.20→-0.34 · 114 | 0.08 · -0.05→0.21 · 188 | -0.18 · -0.32→0.03 · 203 | -0.01 · -0.10→0.09 · 230 |
| fundContra | -0.03 · -0.04→-0.04 · 415 | -0.19 · -0.13→-0.28 · 232 | -0.05 · -0.09→0.03 · 371 | -0.15 · -0.20→-0.08 · 609 | -0.13 · -0.14→-0.12 · 727 |
| spx | 0.10 · 0.06→0.04 · 203 | -0.34 · -0.32→-0.38 · 109 | -0.05 · -0.13→-0.02 · 210 | -0.10 · -0.04→-0.13 · 200 | -0.08 · -0.11→-0.04 · 258 |
| dxy | 0.35 · 0.26→0.31 · 216 | -0.07 · -0.15→-0.00 · 130 | 0.22 · 0.16→0.24 · 195 | 0.11 · -0.02→0.33 · 190 | 0.18 · 0.10→0.28 · 255 |
| gold | 0.38 · 0.32→0.34 · 206 | 0.03 · -0.02→0.08 · 130 | 0.22 · 0.04→0.42 · 199 | 0.16 · -0.16→0.67 · 199 | 0.23 · 0.04→0.43 · 246 |
| oil | 0.24 · 0.20→0.17 · 216 | -0.26 · -0.22→-0.34 · 129 | 0.22 · 0.10→0.34 · 195 | -0.08 · -0.14→0.03 · 228 | 0.06 · -0.00→0.14 · 282 |
| vix | -0.03 · -0.04→-0.04 · 417 | -0.20 · -0.13→-0.28 · 233 | -0.05 · -0.09→0.03 · 372 | -0.15 · -0.19→-0.07 · 610 | -0.13 · -0.14→-0.11 · 727 |
| random | -0.05 · -0.01→-0.11 · 322 | -0.31 · -0.25→-0.41 · 124 | -0.01 · -0.08→0.05 · 238 | -0.22 · -0.24→-0.17 · 296 | -0.15 · -0.12→-0.17 · 530 |
| adxHtf | 0.18 · 0.04→0.33 · 163 | 0.23 · -0.55→0.78 · 34 | 0.13 · 0.10→0.19 · 130 | 0.10 · -0.48→0.64 · 54 | 0.16 · -0.13→0.45 · 149 |

## 3. Robust improvements (beat "none" in both halves, ≥ 40 trades, better on ≥ 4 of 5 coins)

"random" is a control filter: if it shows up here, treat everything with suspicion.

| TF | strategy | filter | none R (A→B) | filter R (A→B) | trades | coins better |
|---|---|---|---|---|---|---|
| 4h | breakout | dxy | 0.11→0.25 | 0.14→0.69 | 202 | 5/5 |
| 1h | supertrend | gold | -0.19→-0.08 | -0.16→0.67 | 199 | 5/5 |
| 4h | ema | dxy | 0.24→0.12 | 0.34→0.61 | 101 | 4/5 |
| 1h | confluence | adxHtf | -0.14→-0.12 | -0.13→0.45 | 149 | 5/5 |
| 1h | confluence | gold | -0.14→-0.12 | 0.04→0.43 | 246 | 5/5 |
| 1h | macd | gold | -0.09→0.03 | 0.04→0.42 | 199 | 5/5 |
| 4h | breakout | oil | 0.11→0.25 | 0.16→0.37 | 201 | 5/5 |
| 4h | ema | fngContra | 0.24→0.12 | 0.30→0.37 | 188 | 4/5 |
| 4h | ema | oil | 0.24→0.12 | 0.57→0.36 | 110 | 5/5 |
| 4h | supertrend | dxy | 0.10→-0.10 | 0.18→0.35 | 192 | 5/5 |
| 1h | macd | oil | -0.09→0.03 | 0.10→0.34 | 195 | 5/5 |
| 1h | breakout | gold | -0.04→-0.04 | 0.32→0.34 | 206 | 5/5 |
| 1h | breakout | adxHtf | -0.04→-0.04 | 0.04→0.33 | 163 | 4/5 |
| 1h | supertrend | dxy | -0.19→-0.08 | -0.02→0.33 | 190 | 5/5 |
| 1h | breakout | dxy | -0.04→-0.04 | 0.26→0.31 | 216 | 5/5 |
| 1h | confluence | dxy | -0.14→-0.12 | 0.10→0.28 | 255 | 5/5 |
| 1h | macd | dxy | -0.09→0.03 | 0.16→0.24 | 195 | 5/5 |
| 1h | macd | fngTrend | -0.09→0.03 | -0.05→0.21 | 188 | 5/5 |
| 1h | macd | adxHtf | -0.09→0.03 | 0.10→0.19 | 130 | 5/5 |
| 1h | breakout | oil | -0.04→-0.04 | 0.20→0.17 | 216 | 5/5 |
| 1h | confluence | oil | -0.14→-0.12 | -0.00→0.14 | 282 | 5/5 |
| 1h | breakout | fngTrend | -0.04→-0.04 | 0.10→0.14 | 182 | 4/5 |
| 1h | confluence | fngTrend | -0.14→-0.12 | -0.10→0.09 | 230 | 5/5 |
| 4h | confluence | btcTrend | 0.01→-0.05 | 0.06→0.08 | 406 | 4/5 |
| 1h | ema | gold | -0.13→-0.28 | -0.02→0.08 | 130 | 4/5 |
| 1h | macd | random | -0.09→0.03 | -0.08→0.05 | 238 | 4/5 |
| 1h | breakout | spx | -0.04→-0.04 | 0.06→0.04 | 203 | 5/5 |
| 4h | macd | fngTrend | -0.00→-0.07 | 0.17→0.02 | 200 | 4/5 |
| 4h | supertrend | btcTrend | 0.10→-0.10 | 0.24→0.01 | 242 | 4/5 |
| 4h | confluence | fngContra | 0.01→-0.05 | 0.02→-0.01 | 641 | 4/5 |
| 4h | supertrend | fngContra | 0.10→-0.10 | 0.11→-0.02 | 513 | 5/5 |
| 4h | supertrend | fundContra | 0.10→-0.10 | 0.11→-0.09 | 562 | 4/5 |

## 4. Combinations of top 4h filters (dxy, oil, fngContra)

| strategy | combo | avg R all | A→B | trades | win% |
|---|---|---|---|---|---|
| breakout | dxy+oil | 0.42 | 0.16→0.62 | 113 | 41.6 |
| breakout | dxy+fngContra | 0.44 | 0.11→0.91 | 190 | 40.5 |
| breakout | oil+fngContra | 0.30 | 0.25→0.39 | 186 | 35.5 |
| breakout | dxy+oil+fngContra | 0.39 | 0.10→0.61 | 107 | 39.3 |
| ema | dxy+oil | 0.70 | 0.60→0.80 | 50 | 48.0 |
| ema | dxy+fngContra | 0.63 | 0.34→1.08 | 89 | 46.1 |
| ema | oil+fngContra | 0.50 | 0.59→0.50 | 104 | 41.3 |
| ema | dxy+oil+fngContra | 0.78 | 0.60→1.00 | 46 | 47.8 |
| macd | dxy+oil | 0.21 | 0.27→0.23 | 106 | 33.0 |
| macd | dxy+fngContra | 0.27 | 0.08→0.68 | 151 | 35.1 |
| macd | oil+fngContra | 0.24 | 0.34→0.13 | 152 | 32.9 |
| macd | dxy+oil+fngContra | 0.38 | 0.33→0.45 | 86 | 37.2 |
| supertrend | dxy+oil | 0.17 | 0.07→0.23 | 107 | 33.6 |
| supertrend | dxy+fngContra | 0.33 | 0.16→0.48 | 184 | 40.2 |
| supertrend | oil+fngContra | 0.10 | 0.25→-0.11 | 217 | 35.0 |
| supertrend | dxy+oil+fngContra | 0.14 | 0.05→0.21 | 99 | 32.3 |
| confluence | dxy+oil | 0.13 | -0.10→0.41 | 144 | 32.6 |
| confluence | dxy+fngContra | 0.23 | -0.02→0.63 | 238 | 39.5 |
| confluence | oil+fngContra | 0.06 | 0.17→-0.10 | 252 | 32.5 |
| confluence | dxy+oil+fngContra | 0.18 | -0.10→0.54 | 132 | 34.1 |

## Log

- gold: 1258 days
- oil: 1257 days
- dxy: 1257 days
- spx: 1255 days
- vix: 1257 days
- fng: 3212 days
- fapi funding BTCUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000&startTime=1723305600000
- BTCUSDT 4h: 5000 bars, funding 2466 pts (data.binance.vision)
- fapi funding ETHUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1000&startTime=1723305600000
- ETHUSDT 4h: 5000 bars, funding 2466 pts (data.binance.vision)
- fapi funding SOLUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=SOLUSDT&limit=1000&startTime=1723305600000
- SOLUSDT 4h: 5000 bars, funding 2466 pts (data.binance.vision)
- fapi funding BNBUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=BNBUSDT&limit=1000&startTime=1723305600000
- BNBUSDT 4h: 5000 bars, funding 2466 pts (data.binance.vision)
- fapi funding XRPUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=XRPUSDT&limit=1000&startTime=1723305600000
- XRPUSDT 4h: 5000 bars, funding 2466 pts (data.binance.vision)
- fapi funding BTCUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000&startTime=1777298400000
- BTCUSDT 1h: 5000 bars, funding 642 pts (data.binance.vision)
- fapi funding ETHUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1000&startTime=1777298400000
- ETHUSDT 1h: 5000 bars, funding 642 pts (data.binance.vision)
- fapi funding SOLUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=SOLUSDT&limit=1000&startTime=1777298400000
- SOLUSDT 1h: 5000 bars, funding 642 pts (data.binance.vision)
- fapi funding BNBUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=BNBUSDT&limit=1000&startTime=1777298400000
- BNBUSDT 1h: 5000 bars, funding 642 pts (data.binance.vision)
- fapi funding XRPUSDT: HTTP 451 https://fapi.binance.com/fapi/v1/fundingRate?symbol=XRPUSDT&limit=1000&startTime=1777298400000
- XRPUSDT 1h: 5000 bars, funding 642 pts (data.binance.vision)
