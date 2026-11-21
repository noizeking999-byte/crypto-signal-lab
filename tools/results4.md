# Analysis round 4: survivorship, direction, timeframe, combos, sizing, risk controls

Generated 2026-11-21T23:24:05.986Z · portfolio backtests, spot costs (0.1% + 0.05% slip), risk 1%/trade, start 1000 · halves: before/after 2022-04-01

Pool: 47 coins with data. Unavailable (delisted/renamed → residual survivorship bias): none

## A. Survivorship bias: fixed 10 coins (today's winners) vs point-in-time top-10 by volume each month (4h)

| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |
|---|---|---|---|---|---|---|---|
| breakout  · fixed | 26.8 | 23.4 | 1.14 | 1029 | 33.2 | 0.23 | 0.31 → 0.17 |
| breakout  · dynamic | 24.9 | 21.5 | 1.16 | 882 | 34.1 | 0.25 | 0.34 → 0.18 |
| breakout +DXY · fixed | 15.1 | 32.0 | 0.47 | 641 | 33.2 | 0.23 | 0.21 → 0.24 |
| breakout +DXY · dynamic | 10.3 | 44.1 | 0.23 | 648 | 31.8 | 0.17 | 0.12 → 0.20 |
| ema  · fixed | 13.4 | 31.4 | 0.43 | 735 | 30.7 | 0.17 | 0.34 → 0.05 |
| ema  · dynamic | 7.9 | 30.5 | 0.26 | 720 | 29.3 | 0.11 | 0.25 → 0.00 |
| ema +DXY · fixed | 12.3 | 23.9 | 0.51 | 445 | 34.4 | 0.27 | 0.21 → 0.32 |
| ema +DXY · dynamic | 5.3 | 27.0 | 0.19 | 390 | 30.5 | 0.15 | 0.16 → 0.14 |

## B. Long + Short vs Long only vs Short only (dynamic universe)

| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |
|---|---|---|---|---|---|---|---|
| 4h breakout · long+short | 24.9 | 21.5 | 1.16 | 882 | 34.1 | 0.25 | 0.34 → 0.18 |
| 4h breakout · long only | 9.7 | 35.6 | 0.27 | 765 | 29.4 | 0.14 | 0.23 → 0.05 |
| 4h breakout · short only | 10.6 | 21.1 | 0.50 | 484 | 32.9 | 0.21 | 0.17 → 0.25 |
| 4h breakout · short only + DXY | 6.8 | 32.5 | 0.21 | 324 | 33.0 | 0.22 | 0.05 → 0.37 |
| 4h breakout · long+short + DXY | 10.3 | 44.1 | 0.23 | 648 | 31.8 | 0.17 | 0.12 → 0.20 |
| 4h ema · long+short | 7.9 | 30.5 | 0.26 | 720 | 29.3 | 0.11 | 0.25 → 0.00 |
| 4h ema · long only | 1.8 | 45.0 | 0.04 | 527 | 27.7 | 0.06 | 0.26 → -0.10 |
| 4h ema · short only | 9.3 | 22.7 | 0.41 | 373 | 31.9 | 0.24 | 0.28 → 0.20 |
| 4h ema · short only + DXY | 4.4 | 27.8 | 0.16 | 197 | 33.0 | 0.23 | 0.07 → 0.40 |
| 4h ema · long+short + DXY | 5.3 | 27.0 | 0.19 | 390 | 30.5 | 0.15 | 0.16 → 0.14 |
| 1d breakout · long+short | 0.4 | 17.0 | 0.03 | 108 | 26.9 | 0.05 | 0.22 → -0.08 |
| 1d breakout · long only | 7.5 | 15.8 | 0.47 | 138 | 37.0 | 0.50 | 0.79 → 0.28 |
| 1d breakout · short only | -0.1 | 14.9 | -0.01 | 37 | 29.7 | -0.01 | 0.14 → -0.22 |
| 1d breakout · short only + DXY | -0.7 | 15.4 | -0.04 | 37 | 24.3 | -0.14 | 0.12 → -0.53 |
| 1d breakout · long+short + DXY | 2.1 | 9.9 | 0.21 | 86 | 33.7 | 0.24 | 0.48 → -0.04 |
| 1d ema · long+short | 0.6 | 10.8 | 0.06 | 59 | 28.8 | 0.11 | 0.27 → -0.04 |
| 1d ema · long only | 5.3 | 12.1 | 0.44 | 77 | 40.3 | 0.64 | 1.00 → 0.44 |
| 1d ema · short only | -1.5 | 15.3 | -0.10 | 32 | 18.8 | -0.42 | -0.33 → -0.56 |
| 1d ema · short only + DXY | -1.7 | 17.3 | -0.10 | 27 | 11.1 | -0.55 | -0.61 → -0.52 |
| 1d ema · long+short + DXY | 0.8 | 17.2 | 0.05 | 60 | 28.3 | 0.14 | 0.60 → -0.13 |

## C. Strategy combo, exits and volatility sizing (dynamic universe; each config as long+short and long only)

| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |
|---|---|---|---|---|---|---|---|
| 4h breakout+ema · L+S | 16.1 | 21.6 | 0.75 | 1055 | 30.5 | 0.15 | 0.20 → 0.11 |
| 4h breakout+ema · vol sizing · L+S | 14.6 | 24.6 | 0.59 | 1055 | 30.5 | 0.15 | 0.20 → 0.11 |
| 4h breakout · vol sizing · L+S | 21.7 | 24.5 | 0.89 | 882 | 34.1 | 0.25 | 0.34 → 0.18 |
| 4h breakout · trail 4 ATR · L+S | 40.4 | 20.8 | 1.94 | 1248 | 37.0 | 0.29 | 0.45 → 0.17 |
| 4h breakout+ema · trail 4 ATR · L+S | 35.9 | 21.1 | 1.70 | 1316 | 36.6 | 0.25 | 0.36 → 0.16 |
| 4h breakout+ema · +DXY · L+S | 12.1 | 41.7 | 0.29 | 665 | 32.8 | 0.18 | 0.12 → 0.24 |
| 4h breakout+ema · long only | 10.7 | 34.3 | 0.31 | 799 | 29.8 | 0.14 | 0.26 → 0.03 |
| 4h breakout+ema · vol sizing · long only | 8.4 | 38.0 | 0.22 | 799 | 29.8 | 0.14 | 0.26 → 0.03 |
| 4h breakout · vol sizing · long only | 7.5 | 39.7 | 0.19 | 765 | 29.4 | 0.14 | 0.23 → 0.05 |
| 4h breakout · trail 4 ATR · long only | 30.2 | 33.7 | 0.90 | 776 | 33.1 | 0.38 | 0.59 → 0.21 |
| 4h breakout+ema · trail 4 ATR · long only | 26.5 | 34.0 | 0.78 | 828 | 32.1 | 0.32 | 0.56 → 0.12 |
| 4h breakout+ema · +DXY · long only | 5.8 | 36.2 | 0.16 | 390 | 30.8 | 0.16 | 0.23 → 0.10 |
| 1d breakout+ema · L+S | 2.8 | 9.4 | 0.30 | 101 | 36.6 | 0.26 | 0.19 → 0.33 |
| 1d breakout+ema · vol sizing · L+S | 3.2 | 11.7 | 0.27 | 101 | 36.6 | 0.26 | 0.19 → 0.33 |
| 1d breakout · vol sizing · L+S | 0.8 | 15.1 | 0.05 | 108 | 26.9 | 0.05 | 0.22 → -0.08 |
| 1d breakout · trail 4 ATR · L+S | 11.1 | 16.4 | 0.67 | 194 | 44.3 | 0.53 | 1.11 → 0.15 |
| 1d breakout+ema · trail 4 ATR · L+S | 11.7 | 17.0 | 0.69 | 191 | 46.1 | 0.56 | 0.97 → 0.27 |
| 1d breakout+ema · +DXY · L+S | 1.4 | 9.7 | 0.14 | 93 | 31.2 | 0.15 | 0.48 → -0.17 |
| 1d breakout+ema · long only | 8.4 | 20.4 | 0.41 | 141 | 38.3 | 0.55 | 0.83 → 0.35 |
| 1d breakout+ema · vol sizing · long only | 9.6 | 22.6 | 0.42 | 141 | 38.3 | 0.55 | 0.83 → 0.35 |
| 1d breakout · vol sizing · long only | 8.2 | 18.3 | 0.45 | 138 | 37.0 | 0.50 | 0.79 → 0.28 |
| 1d breakout · trail 4 ATR · long only | 13.0 | 14.6 | 0.89 | 110 | 44.5 | 1.11 | 2.06 → 0.53 |
| 1d breakout+ema · trail 4 ATR · long only | 13.2 | 17.7 | 0.74 | 116 | 43.1 | 1.07 | 2.06 → 0.51 |
| 1d breakout+ema · +DXY · long only | 3.9 | 16.1 | 0.24 | 92 | 34.8 | 0.40 | 0.84 → 0.08 |

## D. Risk controls (dynamic, 4h, breakout+ema, long+short)

| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |
|---|---|---|---|---|---|---|---|
| 4h maxPos 3 | 16.1 | 21.6 | 0.75 | 1055 | 30.5 | 0.15 | 0.20 → 0.11 |
| 4h maxPos 5 | 29.7 | 22.5 | 1.32 | 1550 | 32.0 | 0.19 | 0.23 → 0.15 |
| 4h maxPos 5 · max 3 same direction | 22.0 | 17.8 | 1.24 | 1288 | 30.1 | 0.16 | 0.21 → 0.12 |
| 4h maxPos 3 · daily loss stop 3% | 16.2 | 21.6 | 0.75 | 1053 | 30.6 | 0.15 | 0.21 → 0.11 |
| 4h maxPos 5 · same-dir 3 · daily stop 3% | 22.0 | 17.8 | 1.24 | 1288 | 30.1 | 0.16 | 0.21 → 0.12 |

Best long+short config by side: Long 632 trades, avg R 0.43 · Short 616 trades, avg R 0.16

## E. Best robust LONG+SHORT config: **4h breakout · trail 4 ATR · L+S** (4h, maxPos undefined)

| config | CAGR % | max DD % | CAGR/DD | trades | win% | avg R | 1st → 2nd half R |
|---|---|---|---|---|---|---|---|
| best | 40.4 | 20.8 | 1.94 | 1248 | 37.0 | 0.29 | 0.45 → 0.17 |
| same + random entry filter (control) | 40.5 | 24.2 | 1.67 | 1063 | 36.6 | 0.35 | 0.52 → 0.22 |

| year | trades | win% | avg R |
|---|---|---|---|
| 2018 | 103 | 46.6 | 0.52 |
| 2019 | 140 | 38.6 | 0.30 |
| 2020 | 142 | 35.9 | 0.40 |
| 2021 | 142 | 37.3 | 0.66 |
| 2022 | 143 | 37.1 | 0.13 |
| 2023 | 147 | 32.0 | 0.39 |
| 2024 | 151 | 35.8 | 0.17 |
| 2025 | 153 | 37.3 | 0.06 |
| 2026 | 127 | 35.4 | 0.09 |

Longest time under previous equity high: 287 days · final equity 20408 from 1000
