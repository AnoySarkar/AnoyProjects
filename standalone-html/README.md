# Quota Tracker Standalone HTML + TWA Ready

This folder is ready to upload to a GitHub portfolio repository and includes the web-side files needed for a Trusted Web Activity (TWA).

## Files

- `index.html` - the complete standalone Quota Tracker app in one HTML file.
- `manifest.json` - PWA manifest used by browsers and TWA tooling.
- `sw.js` - service worker for offline shell caching.
- `favicon.svg` and `pwa-icon-512.png` - app icons.
- `.well-known/assetlinks.template.json` - Android Digital Asset Links template.
- `twa/bubblewrap-manifest.template.json` - starter Bubblewrap TWA config.
- `twa/README.md` - TWA-specific setup notes.
- `.nojekyll` - keeps GitHub Pages from applying Jekyll processing.

## Deploy

Copy this folder into your portfolio repository, or copy `index.html` into the project folder where you want the tracker to live.

For GitHub Pages, the app works from either:

- `https://USERNAME.github.io/portfolio-repo/quota-tracker/`
- `https://USERNAME.github.io/portfolio-repo/` if `index.html` is placed at the repo root.

No build step or package install is needed for this standalone version.

## TWA Setup

A final TWA needs a real HTTPS URL, Android package name, and signing certificate fingerprint. Fill those values into the files under `.well-known` and `twa` after you know your GitHub Pages URL and Android signing key.
