# Crypto Signal Lab

Desktop app (Windows): real-time crypto signals (entry / SL / TP), backtest and paper trading using live Binance data. Auto-updates from GitHub Releases.

## Release a new version
1. Change `version` in `package.json` (e.g. 1.0.1)
2. Commit, then tag and push:
   ```
   git tag v1.0.1
   git push && git push --tags
   ```
3. GitHub Actions builds the installer and publishes the release. Installed apps update automatically (checked at start and every hour).

## Dev
```
npm install
npm start
```
