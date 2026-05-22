import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const isStandaloneHtml = (window as Window & { __AURA_STANDALONE__?: boolean }).__AURA_STANDALONE__;

// Register service worker for installable PWA experience
if (!isStandaloneHtml && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Quota Tracker: Service worker registered successfully!', reg.scope))
      .catch(err => console.error('Quota Tracker: Service worker registration failed:', err));
  });
}
