import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const htmlPath = path.join(distDir, 'index.html');

console.log('Starting self-contained standalone HTML bundle process...');

if (!fs.existsSync(htmlPath)) {
  console.error('Error: dist/index.html not found. Please run "npm run build" first.');
  process.exit(1);
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');

const standaloneBootstrap = `<script>
window.__AURA_STANDALONE__ = true;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(() => {});
}
if ('caches' in window) {
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('aura-tracker-cache')).map(key => caches.delete(key))))
    .catch(() => {});
}
</script>`;

htmlContent = htmlContent
  .replace(/^\s*<link\s+rel="icon"[^>]*>\s*$/gm, '')
  .replace(/^\s*<link\s+rel="manifest"[^>]*>\s*$/gm, '')
  .replace(/^\s*<link\s+rel="apple-touch-icon"[^>]*>\s*$/gm, '');

// Find all CSS link tags in dist/index.html
// e.g., <link rel="stylesheet" crossorigin href="./assets/index-UAvBpLO9.css">
const cssRegex = /<link\s+[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>|<link\s+[^>]*href="([^"]+)"[^>]*rel="stylesheet"[^>]*>/g;

let match;
// We need to be careful with replacing content inside a loop where regex indices might change.
// So we will collect all replacements first, or do a global replace if there are matches.
const replacements = [];

let cssMatch;
while ((cssMatch = cssRegex.exec(htmlContent)) !== null) {
  const fullTag = cssMatch[0];
  const cssHref = cssMatch[1] || cssMatch[2];
  replacements.push({ fullTag, href: cssHref, type: 'css' });
}

// Find all JS script tags in dist/index.html
// e.g., <script type="module" crossorigin src="./assets/index-DxCQCgei.js"></script>
const jsRegex = /<script\s+[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g;
let jsMatch;
while ((jsMatch = jsRegex.exec(htmlContent)) !== null) {
  const fullTag = jsMatch[0];
  const jsSrc = jsMatch[1];
  replacements.push({ fullTag, href: jsSrc, type: 'js' });
}

// Perform all replacements
for (const replacement of replacements) {
  const { fullTag, href, type } = replacement;
  if (href && !href.startsWith('http')) {
    const absolutePath = path.join(distDir, href);
    if (fs.existsSync(absolutePath)) {
      console.log(`Inlining ${type.toUpperCase()}: ${href}`);
      const content = fs.readFileSync(absolutePath, 'utf8');
      let replacementTag = '';
      if (type === 'css') {
        replacementTag = `<style>\n${content}\n</style>`;
      } else {
        replacementTag = `${standaloneBootstrap}\n<script type="module">\n${content}\n</script>`;
      }
      htmlContent = htmlContent.replace(fullTag, () => replacementTag);
    } else {
      console.warn(`Warning: File not found at ${absolutePath}`);
    }
  }
}

// Save the standalone file
const standalonePath = path.join(distDir, 'aura-tracker-standalone.html');
fs.writeFileSync(standalonePath, htmlContent, 'utf8');
console.log(`\n🎉 Success! Standalone single-file HTML generated at:`);
console.log(`   ${standalonePath}`);

const rootStandalonePath = path.join(rootDir, 'aura-tracker-standalone.html');
fs.writeFileSync(rootStandalonePath, htmlContent, 'utf8');
console.log(`   Also copied to project root for easy access:`);
console.log(`   ${rootStandalonePath}`);

const rootRecoveryPath = path.join(rootDir, 'aura-tracker-live.html');
fs.writeFileSync(rootRecoveryPath, htmlContent, 'utf8');
console.log(`   Recovery copy for stale browser caches:`);
console.log(`   ${rootRecoveryPath}`);
