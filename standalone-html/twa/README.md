# TWA Notes

This folder is PWA and Trusted Web Activity ready.

## Included

- `index.html` includes the web manifest and registers `sw.js`.
- `manifest.json` defines the app name, colors, scope, start URL, and icons.
- `sw.js` precaches the standalone app shell for offline loading.
- `.well-known/assetlinks.template.json` is the Digital Asset Links template Android needs to verify your app.
- `twa/bubblewrap-manifest.template.json` is a starter Bubblewrap config.

## Before publishing a TWA

1. Upload this folder to GitHub Pages over HTTPS.
2. Replace `USERNAME`, `portfolio-repo`, and `com.example.quotatracker` in the TWA template files.
3. Generate/sign your Android app, then replace `REPLACE_WITH_YOUR_ANDROID_SIGNING_CERT_SHA256` in `.well-known/assetlinks.template.json`.
4. Rename `.well-known/assetlinks.template.json` to `.well-known/assetlinks.json` only after the real package name and SHA-256 fingerprint are filled in.

The final Android TWA still needs a real hosted URL and Android signing key, so those values cannot be safely guessed inside this local folder.
