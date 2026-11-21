# Crypto Signal Lab

Desktop app (Windows): real-time crypto signals (entry / SL / TP), backtest and paper trading using live Binance data. Auto-updates from GitHub Releases.

## Release a new version
1. Change `version` in `package.json` (e.g. 1.0.1)
2. Commit and push to `main`
3. GitHub Actions builds the installer and publishes release `v<version>` (tag is created automatically). Installed apps update automatically (checked at start and every hour).

## Dev
```
npm install
npm start
```
