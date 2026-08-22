/* =============================================
   MINDFRAME SCHEDULE MANAGER — APP LOGIC
   ============================================= */

'use strict';

// ─── Firebase Cloud Sync Configuration ──────
const firebaseConfig = {
  apiKey: "AIzaSyBcceWtrTQYBlzyp7i8yucFYW2btrhFO3M",
  authDomain: "broll-81cec.firebaseapp.com",
  databaseURL: "https://broll-81cec-default-rtdb.firebaseio.com",
  projectId: "broll-81cec",
  storageBucket: "broll-81cec.firebasestorage.app",
  messagingSenderId: "916145882472",
  appId: "1:916145882472:web:a70bf79fcced22432302dd",
  measurementId: "G-FKN50B0ZHZ"
};

let db = null;
let rtdb = null;
let auth = null;
let isFirebaseReady = false;
let isApplyingRemoteChange = false;
let syncDebounceTimer = null;
let currentSyncState = 'syncing'; // 'synced' | 'syncing' | 'offline' | 'error'
let lastCloudTimestamp = 0;
let lastSyncError = null;
let broadcastChannel = null;

// Unique Device / Session ID
const DEVICE_ID = 'dev_' + Math.random().toString(36).substring(2, 9);

// ─── Storage ────────────────────────────────
const DB_KEY = 'mf_entries';
const DB_TIME_KEY = 'mf_last_updated';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}

function getLocalTimestamp() {
  try { return parseInt(localStorage.getItem(DB_TIME_KEY)) || 0; }
  catch { return 0; }
}

function updateSyncStatusUI(status, label) {
  currentSyncState = status;
  const badge = document.getElementById('syncBadge');
  const text = document.getElementById('syncStatusText');
  const sub = document.getElementById('cloudSyncSub');
  if (badge) {
    badge.className = `sync-badge status-${status}`;
  }
  if (text) {
    text.textContent = label || (status === 'synced' ? 'Synced' : status === 'syncing' ? 'Syncing' : status === 'error' ? 'Rules Locked' : 'Offline');
  }
  if (sub) {
    if (status === 'synced') sub.textContent = 'Live Global Synced (broll-81cec)';
    else if (status === 'syncing') sub.textContent = 'Syncing across devices...';
    else if (status === 'error') sub.textContent = 'Permission denied (Check Firebase Rules)';
    else sub.textContent = 'Offline (cached locally)';
  }
}

function saveEntries(newEntries, immediate = false) {
  const now = Date.now();
  const cleanEntries = JSON.parse(JSON.stringify(newEntries || []));
  localStorage.setItem(DB_KEY, JSON.stringify(cleanEntries));
  localStorage.setItem(DB_TIME_KEY, now.toString());

  // Broadcast to other open tabs instantly
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'LOCAL_UPDATE',
        entries: cleanEntries,
        updatedAt: now,
        sender: DEVICE_ID
      });
    } catch(e) {}
  }
  
  if (isApplyingRemoteChange) return;

  updateSyncStatusUI('syncing', 'Syncing');

  clearTimeout(syncDebounceTimer);
  if (immediate) {
    pushToCloud(cleanEntries, now);
  } else {
    syncDebounceTimer = setTimeout(() => {
      pushToCloud(cleanEntries, now);
    }, 150);
  }
}

function pushToCloud(dataToPush, timestamp) {
  const ts = timestamp || Date.now();
  lastCloudTimestamp = ts;

  if (!isFirebaseReady) {
    updateSyncStatusUI('offline', 'Offline');
    return;
  }

  const cleanEntries = JSON.parse(JSON.stringify(dataToPush || []));
  const payload = {
    entries: cleanEntries,
    updatedAt: ts,
    deviceId: DEVICE_ID
  };

  const promises = [];
  
  // 1. Write to Firestore
  if (db) {
    promises.push(
      db.collection('schedule_app').doc('main_schedule').set(payload)
        .then(() => ({ backend: 'firestore', ok: true }))
        .catch(err => {
          lastSyncError = err;
          console.warn('Firestore write error:', err.code, err.message);
          return { backend: 'firestore', ok: false, error: err };
        })
    );
  }

  // 2. Write to Realtime Database
  if (rtdb) {
    promises.push(
      rtdb.ref('schedule_data/main').set(payload)
        .then(() => ({ backend: 'rtdb', ok: true }))
        .catch(err => {
          lastSyncError = err;
          console.warn('RTDB write error:', err.code, err.message);
          return { backend: 'rtdb', ok: false, error: err };
        })
    );
  }

  if (promises.length === 0) {
    updateSyncStatusUI('offline', 'Offline');
    return;
  }

  Promise.all(promises).then((results) => {
    const hasSuccess = results.some(r => r.ok);
    if (hasSuccess) {
      lastSyncError = null;
      updateSyncStatusUI('synced', 'Synced');
    } else {
      const isPermissionDenied = results.some(r => r.error && (r.error.code === 'permission-denied' || String(r.error.message).includes('permission_denied')));
      if (isPermissionDenied) {
        updateSyncStatusUI('error', 'Rules Locked');
      } else {
        updateSyncStatusUI('offline', 'Offline');
      }
    }
  });
}

function handleIncomingRemoteData(remoteEntries, remoteUpdatedAt, senderDeviceId) {
  if (!Array.isArray(remoteEntries)) return;
  // If we originated this update, skip re-applying
  if (senderDeviceId === DEVICE_ID && remoteUpdatedAt && remoteUpdatedAt <= lastCloudTimestamp) return;

  const currentLocalStr = JSON.stringify(entries);
  const remoteStr = JSON.stringify(remoteEntries);

  // If remote data differs from current memory
  if (currentLocalStr !== remoteStr) {
    isApplyingRemoteChange = true;
    entries = remoteEntries;
    localStorage.setItem(DB_KEY, remoteStr);
    localStorage.setItem(DB_TIME_KEY, (remoteUpdatedAt || Date.now()).toString());
    checkAutoUpload();

    // Re-render active view
    if (currentPage === 'home') renderDashboard();
    else if (currentPage === 'calendar') renderCalendar();
    else if (currentPage === 'settings') renderSettings();
    else if (currentPage === 'detail' && editingId) renderDetail(editingId);

    updateSyncStatusUI('synced', 'Synced');
    showToast('Live updated from another device 🔄');
    sfx('schedule');
    isApplyingRemoteChange = false;
  } else {
    updateSyncStatusUI('synced', 'Synced');
  }
}

function setupRTDBListener() {
  if (!rtdb) return;
  try {
    rtdb.ref('schedule_data/main').on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data.entries)) {
        lastSyncError = null;
        handleIncomingRemoteData(data.entries, data.updatedAt, data.deviceId);
      } else if (!data && entries.length > 0) {
        pushToCloud(entries, getLocalTimestamp());
      }
    }, (error) => {
      console.warn('RTDB Listener notice:', error.code, error.message);
      lastSyncError = error;
      if (error.code === 'PERMISSION_DENIED' || String(error.message).includes('permission_denied')) {
        updateSyncStatusUI('error', 'Rules Locked');
      }
    });
  } catch(e) {
    console.warn('RTDB setup listener failed:', e);
  }
}

function setupRealtimeListeners() {
  if (db) {
    try {
      db.collection('schedule_app').doc('main_schedule')
        .onSnapshot((doc) => {
          lastSyncError = null;
          if (doc.exists) {
            const data = doc.data();
            if (data && Array.isArray(data.entries)) {
              handleIncomingRemoteData(data.entries, data.updatedAt, data.deviceId);
            }
          } else if (entries.length > 0) {
            pushToCloud(entries, getLocalTimestamp());
          }
        }, (error) => {
          console.warn('Firestore listener notice:', error.code, error.message);
          lastSyncError = error;
          if (error.code === 'permission-denied') {
            updateSyncStatusUI('error', 'Rules Locked');
          }
        });
    } catch(e) {
      console.warn('Firestore onSnapshot exception:', e);
    }
  }

  // Setup Realtime Database listener as well
  setupRTDBListener();
}

function initFirebaseSync() {
  // 1. Setup local BroadcastChannel for zero-latency multi-tab sync
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('mf_sync_channel');
      broadcastChannel.onmessage = (e) => {
        if (e.data && e.data.type === 'LOCAL_UPDATE' && e.data.sender !== DEVICE_ID) {
          handleIncomingRemoteData(e.data.entries, e.data.updatedAt, e.data.sender);
        }
      };
    }
  } catch(e) {}

  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded, running in local mode');
    updateSyncStatusUI('offline', 'Offline');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    updateSyncStatusUI('syncing', 'Connecting');

    // Initialize Auth (Anonymous sign-in for seamless multi-device access)
    try {
      auth = firebase.auth();
      auth.signInAnonymously().catch(err => {
        console.warn('Anonymous Auth notice (optional):', err.message);
      });
    } catch(e) {}

    // Initialize Firestore
    try {
      db = firebase.firestore();
    } catch (e) {
      console.warn('Firestore init notice:', e);
    }

    // Initialize Realtime Database
    try {
      rtdb = firebase.database();
    } catch (e) {
      console.warn('RTDB init notice:', e);
    }

    isFirebaseReady = true;
    setupRealtimeListeners();

    // Listen to browser network changes
    window.addEventListener('online', () => {
      updateSyncStatusUI('syncing', 'Reconnecting');
      pushToCloud(entries, getLocalTimestamp());
    });
    window.addEventListener('offline', () => {
      updateSyncStatusUI('offline', 'Offline');
    });

  } catch (err) {
    console.error('Firebase setup error:', err);
    updateSyncStatusUI('offline', 'Offline');
  }
}

function forceSyncNow() {
  sfx('save');
  showToast('Connecting & Syncing with Cloud ☁️');
  updateSyncStatusUI('syncing', 'Syncing');
  pushToCloud(entries, Date.now());
}

function openSyncModal() {
  const modal = document.getElementById('syncModal');
  const details = document.getElementById('syncModalDetails');
  const help = document.getElementById('syncRuleHelp');
  if (!modal) return;

  let msg = `<strong>Status:</strong> ${currentSyncState.toUpperCase()}<br>`;
  msg += `<strong>Firebase Project:</strong> broll-81cec<br>`;
  msg += `<strong>Device ID:</strong> ${DEVICE_ID}<br>`;
  msg += `<strong>Items in Database:</strong> ${entries.length} items<br>`;
  
  if (lastSyncError) {
    msg += `<br><span style="color:var(--rose)"><strong>Error:</strong> ${escHtml(lastSyncError.message || lastSyncError.code || 'Permission Denied')}</span>`;
    if (help) help.style.display = 'block';
  } else {
    msg += `<br><span style="color:var(--green)">✓ Realtime bi-directional listeners active.</span>`;
    if (help) help.style.display = (currentSyncState === 'error') ? 'block' : 'none';
  }

  if (details) details.innerHTML = msg;
  modal.classList.add('open');
}

function closeSyncModal() {
  const modal = document.getElementById('syncModal');
  if (modal) modal.classList.remove('open');
}

// ─── State ──────────────────────────────────
let entries = loadEntries();
let currentPage = 'home';
let activeFilter = 'upcoming';   // default to Upcoming
let searchQuery = '';
let editingId = null;
let pendingDeleteId = null;
let pendingDateEditId = null;
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

// ─── History (undo/redo) ─────────────────────
const MAX_HISTORY = 50;
let history = [];
let historyIndex = -1;

function pushHistory() {
  // Discard any redo future
  history = history.slice(0, historyIndex + 1);
  history.push(JSON.stringify(entries));
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length - 1;
  updateUndoRedoBtns();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  entries = JSON.parse(history[historyIndex]);
  saveEntries(entries);
  updateUndoRedoBtns();
  renderDashboard();
  sfx('undo');
  showToast('Undone');
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  entries = JSON.parse(history[historyIndex]);
  saveEntries(entries);
  updateUndoRedoBtns();
  renderDashboard();
  sfx('redo');
  showToast('Redone');
}

function updateUndoRedoBtns() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (!u || !r) return;
  u.disabled = historyIndex <= 0;
  r.disabled = historyIndex >= history.length - 1;
}

// ─── Routing ────────────────────────────────
function navigate(page, extra = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'home')     renderDashboard();
  if (page === 'add')      setupAddPage(extra);
  if (page === 'detail' && extra.id) renderDetail(extra.id);
  if (page === 'settings') renderSettings();
  if (page === 'calendar') renderCalendar();
}

// ─── Auto-upload check ──────────────────────
function checkAutoUpload() {
  let changed = false;
  entries = entries.map(e => {
    if (e.entryStatus === 'scheduled') {
      const d = e.rawDate ? parseEntryDate(e.rawDate) : null;
      const s = getStatus(d);
      if (s === 'today' || s === 'past') {
        changed = true;
        return { ...e, entryStatus: 'uploaded' };
      }
    }
    return e;
  });
  if (changed) { saveEntries(entries); }
}

// ─── Toast ──────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── SFX Engine (Web Audio API) ─────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function sfx(type) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const plays = {
      copy:      [[880, 0, 0.07, 'sine', 0.18]],
      schedule:  [[440, 0, 0.06, 'sine', 0.13], [660, 0.08, 0.06, 'sine', 0.13]],
      uploaded:  [[523, 0, 0.06, 'triangle', 0.14], [659, 0.08, 0.06, 'triangle', 0.14], [784, 0.16, 0.1, 'triangle', 0.18]],
      save:      [[440, 0, 0.06, 'sine', 0.15], [550, 0.08, 0.1, 'sine', 0.18]],
      delete:    [[330, 0, 0.06, 'sawtooth', 0.12], [220, 0.08, 0.1, 'sawtooth', 0.1]],
      undo:      [[350, 0, 0.08, 'sine', 0.1]],
      redo:      [[500, 0, 0.08, 'sine', 0.1]],
      error:     [[180, 0, 0.12, 'sawtooth', 0.1]],
      unschedule:[[300, 0, 0.06, 'sine', 0.08]],
    };
    const notes = plays[type] || plays.copy;
    notes.forEach(([freq, delay, dur, wave, vol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.01);
    });
  } catch(e) { /* SFX unsupported, silent fail */ }
}

// ─── Date Helpers ───────────────────────────
const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12
};

function parseEntryDate(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // New compact format: DDMM  e.g. "1207" = 12 July
  const compactMatch = s.match(/^(\d{2})(\d{2})$/);
  if (compactMatch) {
    const day   = parseInt(compactMatch[1]);
    const month = parseInt(compactMatch[2]);
    const year  = new Date().getFullYear();
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return new Date(year, month - 1, day);
  }

  // Legacy: "24 OCTOBER" or "24 OCTOBER 2025"
  const parts = s.toLowerCase().split(/\s+/);
  const day   = parseInt(parts[0]);
  const month = MONTHS[parts[1]] || null;
  const year  = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
  if (isNaN(day) || !month) return null;
  return new Date(year, month - 1, day);
}

function getStatus(dateObj) {
  if (!dateObj) return 'upcoming';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  if (d.getTime() === today.getTime()) return 'today';
  if (d < today) return 'past';
  return 'upcoming';
}

function formatDisplayDate(dateObj) {
  if (!dateObj) return '—';
  return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateObj) {
  if (!dateObj) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return Math.round((d - today) / 86400000);
}

// ─── Type Helpers ───────────────────────────
const TYPE_LABELS  = { P:'Part', S:'Short', E:'Episode', L:'Long' };
const TYPE_ACCENTS = { P:'var(--purple)', S:'var(--cyan)', E:'var(--amber)', L:'#06b6d4' };

// Sections expected per type — for missing-field detection
const SECTION_DEFS = {
  P: ['yttitle','ig','yt','tt','pin','script'],
  S: ['yttitle','ig','yt','tt','pin','script'],
  E: ['yttitle','ig','yt','tt','pin','script'],
  L: ['yttitle','yt'],
};
const SECTION_META = {
  yttitle: { icon:'▶️', iconClass:'yt',     label:'YouTube Title',       sublabel:'Video title' },
  ig:      { icon:'📸', iconClass:'ig',     label:'Instagram Caption',   sublabel:'Ready to copy' },
  yt:      { icon:'▶️', iconClass:'yt',     label:'YouTube Description', sublabel:'Video description' },
  tt:      { icon:'🎵', iconClass:'tt',     label:'TikTok Caption',      sublabel:'Ready to copy' },
  pin:     { icon:'📌', iconClass:'pin',    label:'Pinned Comment',      sublabel:'For YouTube' },
  script:  { icon:'📝', iconClass:'script', label:'Script',              sublabel:'Script lines' },
};
function getEntryField(e, sid) {
  switch(sid) {
    case 'yttitle': return e.youtubeTitle || '';
    case 'ig':      return e.instagram || '';
    case 'yt':      return e.youtube || '';
    case 'tt':      return e.tiktok || '';
    case 'pin':     return e.pinnedComment || '';
    case 'script':  return (e.script && e.script.length) ? e.script : [];
  }
  return '';
}

// ─── ID Generator ───────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ════════════════════════════════════════════
//   PARSER
// ════════════════════════════════════════════
function parseContent(raw) {
  const lines = raw.split('\n');
  const result = {
    type: '', number: '', date: '', rawDate: '',
    script: [],
    instagram: '', youtube: '', youtubeTitle: '',
    tiktok: '', pinnedComment: ''
  };

  // ── Line 1: header ──
  const headerLine = lines[0].trim();
  const compactHeader = headerLine.match(/^([A-Za-z]+)\s*(\d+)\s+(\d{4})$/i);
  if (compactHeader) {
    result.type    = compactHeader[1].toUpperCase().slice(0, 1);
    result.number  = compactHeader[2];
    result.rawDate = compactHeader[3].trim();
  } else {
    const headerMatch = headerLine.match(/^([A-Za-z]+)\s*(\d+)\s+(.+)$/i);
    if (headerMatch) {
      result.type    = headerMatch[1].toUpperCase().slice(0, 1);
      result.number  = headerMatch[2];
      result.rawDate = headerMatch[3].trim();
    } else {
      const m2 = headerLine.match(/([PSELpsел])\s*(\d+)/i);
      if (m2) {
        result.type    = m2[1].toUpperCase();
        result.number  = m2[2];
        result.rawDate = headerLine.replace(m2[0], '').trim();
      }
    }
  }

  // ── L (Long) type: title = first non-empty line, rest = description ──
  if (result.type === 'L') {
    let foundTitle = false;
    const descLines = [];
    for (let i = 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed && !foundTitle) continue; // skip blanks before title
      if (!foundTitle) {
        result.youtubeTitle = trimmed;
        foundTitle = true;
      } else {
        descLines.push(lines[i]);
      }
    }
    result.youtube = descLines.join('\n').trim();
    return result;
  }

  // ── Parse sections ──
  let mode = 'script';
  let igLines = [], ytLines = [], ttLines = [], pinLines = [], ytTitleLines = [];

  // Flags
  let inIG = false, inYT = false, inTT = false, inPin = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip ON-SCREEN TEXT section entirely
    if (/1️⃣|ON[-\s]?SCREEN\s*TEXT/i.test(trimmed)) {
      mode = 'skip';
      continue;
    }

    // READY-TO-COPY CAPTIONS
    if (/2️⃣|READY[-\s]?TO[-\s]?COPY\s*CAPTIONS/i.test(trimmed)) {
      mode = 'captions';
      inIG = false; inYT = false; inTT = false; inPin = false;
      continue;
    }

    // PINNED COMMENT
    if (/3️⃣|PINNED\s*COMMENT/i.test(trimmed)) {
      mode = 'pin';
      inIG = false; inYT = false; inTT = false; inPin = true;
      continue;
    }

    if (mode === 'script') {
      // Numbered script line: "23. text" or " 23. text"
      const scriptMatch = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
      if (scriptMatch) {
        result.script.push({ num: scriptMatch[1], text: scriptMatch[2] });
      }
      continue;
    }

    if (mode === 'skip') continue;

    if (mode === 'captions') {
      // Sub-mode detection
      if (/^INSTAGRAM$/i.test(trimmed)) { inIG = true; inYT = false; inTT = false; inPin = false; continue; }
      if (/^YOUTUBE\s*(SHORTS?)?$/i.test(trimmed)) { inIG = false; inYT = true; inTT = false; inPin = false; continue; }
      if (/^TIKTOK$/i.test(trimmed)) { inIG = false; inYT = false; inTT = true; inPin = false; continue; }

      // YouTube TITLE line
      if (/^TITLE:\s*/i.test(trimmed)) {
        const titleVal = trimmed.replace(/^TITLE:\s*/i, '').trim();
        ytTitleLines.push(titleVal);
        continue;
      }

      if (inIG) igLines.push(line);
      else if (inYT) ytLines.push(line);
      else if (inTT) ttLines.push(line);
    }

    if (mode === 'pin' && inPin) {
      pinLines.push(line);
    }
  }

  result.instagram    = igLines.join('\n').trim();
  result.youtube      = ytLines.join('\n').trim();
  result.youtubeTitle = ytTitleLines.join(' ').trim();
  result.tiktok       = ttLines.join('\n').trim();
  result.pinnedComment = pinLines.join('\n').trim();

  return result;
}

// ════════════════════════════════════════════
//   DASHBOARD
// ════════════════════════════════════════════
function renderDashboard() {
  let list = entries.map(e => ({
    ...e,
    _dateObj: e.rawDate ? parseEntryDate(e.rawDate) : null
  }));

  // Sort by date (soonest first, nulls last)
  list.sort((a, b) => {
    if (!a._dateObj && !b._dateObj) return 0;
    if (!a._dateObj) return 1;
    if (!b._dateObj) return -1;
    return a._dateObj - b._dateObj;
  });

  // Search
  const q = searchQuery.toLowerCase();
  if (q) {
    list = list.filter(e =>
      (e.type + e.number).toLowerCase().includes(q) ||
      (e.rawDate || '').toLowerCase().includes(q) ||
      (e.youtubeTitle || '').toLowerCase().includes(q) ||
      (e.instagram || '').toLowerCase().includes(q) ||
      (e.youtube || '').toLowerCase().includes(q) ||
      (e.tiktok || '').toLowerCase().includes(q) ||
      (e.script || []).some(s => s.text.toLowerCase().includes(q))
    );
  }

  // Filter
  if (activeFilter === 'upcoming') {
    list = list.filter(e => {
      const s = getStatus(e._dateObj);
      return s === 'upcoming' || s === 'today';
    });
  } else if (activeFilter === 'unscheduled') {
    list = list.filter(e => !e.entryStatus || e.entryStatus === 'none');
  } else if (activeFilter === 'scheduled') {
    list = list.filter(e => e.entryStatus === 'scheduled');
  } else if (activeFilter === 'uploaded') {
    list = list.filter(e => e.entryStatus === 'uploaded');
  }
  // 'all' = no filter

  // Count upcoming for badge
  const upcomingCount = entries.filter(e => {
    const d = e.rawDate ? parseEntryDate(e.rawDate) : null;
    const s = getStatus(d);
    return s === 'upcoming' || s === 'today';
  }).length;

  document.getElementById('upcomingBadge').textContent = `${upcomingCount} ahead`;
  document.getElementById('entryCountSub').textContent =
    entries.length === 0 ? 'No entries yet' :
    `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;

  // Agenda strip: next 5 upcoming
  const upcoming = entries
    .map(e => ({ ...e, _dateObj: e.rawDate ? parseEntryDate(e.rawDate) : null }))
    .filter(e => e._dateObj && (getStatus(e._dateObj) === 'upcoming' || getStatus(e._dateObj) === 'today'))
    .sort((a, b) => a._dateObj - b._dateObj)
    .slice(0, 6);

  const strip = document.getElementById('agendaStrip');
  if (upcoming.length > 0) {
    strip.innerHTML = upcoming.map(e => {
      const days = daysUntil(e._dateObj);
      const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days}d`;
      return `
        <div class="agenda-card" onclick="navigate('detail', {id:'${e.id}'})">
          <div class="agenda-card-date">${dayLabel}</div>
          <div class="agenda-card-code" style="color:${TYPE_ACCENTS[e.type] || 'var(--purple)'}">${e.type}${e.number}</div>
          <div class="agenda-card-type">${TYPE_LABELS[e.type] || e.type}</div>
        </div>
      `;
    }).join('');
    strip.style.display = '';
  } else {
    strip.innerHTML = '';
    strip.style.display = 'none';
  }

  // Cards
  const container = document.getElementById('cardsList');
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗓️</div>
        <div class="empty-title">${entries.length === 0 ? 'No entries yet' : 'No matches found'}</div>
        <div class="empty-sub">${entries.length === 0 ? 'Import your first content block using the Import tab.' : 'Try a different search or filter.'}</div>
      </div>`;
    return;
  }

  container.innerHTML = list.map(e => {
    const status  = getStatus(e._dateObj);
    const accent  = TYPE_ACCENTS[e.type] || 'var(--purple)';
    const preview = e.instagram || e.youtube || e.tiktok || '';
    const days    = e._dateObj ? daysUntil(e._dateObj) : null;
    const dateDisplay = e._dateObj ? formatDisplayDate(e._dateObj) : (e.rawDate || '—');
    const statusLabel = status === 'today' ? 'Today' : status === 'upcoming' ? `In ${days}d` : 'Past';
    const statusClass = `status-${status}`;

    // Card bg class based on entryStatus
    const entryStatus = e.entryStatus || 'none';
    const cardBgClass = entryStatus === 'scheduled' ? 'card-scheduled' : entryStatus === 'uploaded' ? 'card-uploaded' : '';

    // Platform quick-copy buttons
    const plats = [];
    if (e.instagram) plats.push(
      `<button class="plat-btn" title="Copy Instagram" onclick="quickCopy(event,'${e.id}','instagram')">📸</button>`
    );
    if (e.youtubeTitle) plats.push(
      `<button class="plat-btn" title="Copy YouTube Title" onclick="quickCopy(event,'${e.id}','youtubeTitle')">🎬</button>`
    );
    if (e.youtube) plats.push(
      `<button class="plat-btn" title="Copy YouTube Description" onclick="quickCopy(event,'${e.id}','youtube')">▶️</button>`
    );
    if (e.tiktok) plats.push(
      `<button class="plat-btn" title="Copy TikTok" onclick="quickCopy(event,'${e.id}','tiktok')">🎵</button>`
    );
    if (e.pinnedComment) plats.push(
      `<button class="plat-btn" title="Copy Pinned Comment" onclick="quickCopy(event,'${e.id}','pinnedComment')">📌</button>`
    );
    if (e.script && e.script.length) plats.push(
      `<button class="plat-btn" title="View Script" onclick="navigate('detail',{id:'${e.id}'})">📝</button>`
    );

    // Status cycle button
    const statusCycleClass = entryStatus === 'scheduled' ? 'state-scheduled' : entryStatus === 'uploaded' ? 'state-uploaded' : '';
    const statusCycleIcon  = entryStatus === 'scheduled' ? '🗓️' : entryStatus === 'uploaded' ? '✓' : '○';
    const statusCycleTitle = entryStatus === 'scheduled' ? 'Scheduled — tap to mark Uploaded' : entryStatus === 'uploaded' ? 'Uploaded — tap to reset' : 'Tap to mark Scheduled';

    return `
      <div class="entry-card ${cardBgClass}" style="--card-accent:${accent}" onclick="navigate('detail', {id:'${e.id}'})">
        <div class="card-top">
          <div class="card-code">
            <span class="type-pill type-${e.type}">${TYPE_LABELS[e.type] || e.type}</span>
            <span class="code-num">${e.type}${e.number}</span>
          </div>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
        ${e.youtubeTitle ? `<div class="card-title">${escHtml(e.youtubeTitle)}</div>` : ''}
        <button class="card-date-btn" onclick="openDateEdit(event,'${e.id}')" title="Tap to change date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${dateDisplay}
        </button>
        ${preview ? `<div class="card-preview">${escHtml(preview.slice(0, 100))}</div>` : ''}
        <div class="card-bottom-row">
          <div class="card-platforms">${plats.join('')}</div>
          <button class="status-cycle-btn ${statusCycleClass}" title="${statusCycleTitle}" onclick="cycleStatus(event,'${e.id}')">${statusCycleIcon}</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Quick copy from card ────────────────────
function quickCopy(event, id, field) {
  event.stopPropagation();
  const e = entries.find(en => en.id === id);
  if (!e) return;
  let text = '';
  if (field === 'script') {
    text = (e.script || []).map(s => `${s.num}. ${s.text}`).join('\n');
  } else {
    text = e[field] || '';
  }
  if (!text) { showToast('Nothing to copy'); return; }

  const btn = event.currentTarget;
  const original = btn.textContent;

  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    btn.classList.add('plat-btn--copied');
    const labels = { instagram:'Instagram', youtubeTitle:'YT Title', youtube:'YT Desc', tiktok:'TikTok', pinnedComment:'Pinned' };
    showToast(`${labels[field] || field} copied ✓`);
    sfx('copy');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('plat-btn--copied'); }, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied ✓');
    sfx('copy');
  });
}

// ── Status Cycle ─────────────────────────────
const STATUS_CYCLE = ['none', 'scheduled', 'uploaded'];
function cycleStatus(event, id) {
  event.stopPropagation();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  pushHistory();
  const cur = entries[idx].entryStatus || 'none';
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
  entries[idx] = { ...entries[idx], entryStatus: next };
  saveEntries(entries);
  if (next === 'scheduled') { sfx('schedule'); showToast('Marked as Scheduled 🗓️'); }
  else if (next === 'uploaded') { sfx('uploaded'); showToast('Marked as Uploaded ✓'); }
  else { sfx('unschedule'); showToast('Reset to unscheduled'); }
  renderDashboard();
}

// ── Date Edit ────────────────────────────────
function openDateEdit(event, id) {
  event.stopPropagation();
  pendingDateEditId = id;
  const e = entries.find(en => en.id === id);
  const input = document.getElementById('dateEditInput');
  input.value = e ? (e.rawDate || '') : '';
  updateDatePreview(input.value);
  document.getElementById('dateEditModal').classList.add('open');
  setTimeout(() => input.focus(), 120);
}

function closeDateEditModal() {
  document.getElementById('dateEditModal').classList.remove('open');
  pendingDateEditId = null;
}

function updateDatePreview(val) {
  const prev = document.getElementById('dateEditPreview');
  const d = parseEntryDate(val.trim());
  prev.textContent = d ? `→ ${formatDisplayDate(d)}` : (val.length === 4 ? 'Invalid date' : '');
}

function saveDateEdit() {
  const val = document.getElementById('dateEditInput').value.trim();
  if (!val) { sfx('error'); showToast('Enter a date'); return; }
  const d = parseEntryDate(val);
  if (!d) { sfx('error'); showToast('Invalid — use DDMM e.g. 1207'); return; }
  const idx = entries.findIndex(e => e.id === pendingDateEditId);
  if (idx === -1) return;
  pushHistory();
  entries[idx] = { ...entries[idx], rawDate: val };
  saveEntries(entries);
  closeDateEditModal();
  sfx('save');
  showToast(`Date updated → ${formatDisplayDate(d)}`);
  renderDashboard();
}

// ════════════════════════════════════════════
//   ADD / EDIT PAGE
// ════════════════════════════════════════════
function setupAddPage(extra = {}) {
  editingId = extra.editId || null;
  document.getElementById('addPageTitle').textContent = editingId ? 'Edit Entry' : 'Import Content';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('saveBtn').textContent = editingId ? 'Update Entry' : 'Save Entry';

  if (editingId) {
    const entry = entries.find(e => e.id === editingId);
    if (entry) {
      // Reconstruct raw text for editing
      const raw = reconstructRaw(entry);
      document.getElementById('pasteInput').value = raw;
    }
  } else {
    document.getElementById('pasteInput').value = '';
  }
}

function reconstructRaw(e) {
  let out = `${e.type}${e.number} ${e.rawDate}\n\n`;
  if (e.script && e.script.length) {
    out += e.script.map(s => `${s.num}. ${s.text}`).join('\n') + '\n\n';
  }
  out += `2️⃣ READY-TO-COPY CAPTIONS\n`;
  if (e.instagram) out += `INSTAGRAM\n${e.instagram}\n\n`;
  if (e.youtube || e.youtubeTitle) {
    out += `YOUTUBE SHORTS\n${e.youtube}\n\nTITLE: ${e.youtubeTitle}\n\n`;
  }
  if (e.tiktok) out += `TIKTOK\n${e.tiktok}\n\n`;
  if (e.pinnedComment) out += `3️⃣ PINNED COMMENT\n${e.pinnedComment}\n`;
  return out;
}

function handleParse() {
  const raw = document.getElementById('pasteInput').value.trim();
  if (!raw) { showToast('Paste some content first'); return; }

  const parsed = parseContent(raw);

  if (!parsed.type || !parsed.number) {
    showToast('Could not detect code. Check format (e.g. P6, S3, E12)');
    return;
  }

  // Show preview
  document.getElementById('previewSection').style.display = 'block';

  const pill = document.getElementById('previewCodePill');
  pill.textContent = TYPE_LABELS[parsed.type] || parsed.type;
  pill.className = `type-pill type-${parsed.type}`;

  document.getElementById('previewCodeNum').textContent = `${parsed.type}${parsed.number}`;
  document.getElementById('previewDate').textContent = parsed.rawDate;

  const fields = [];
  if (parsed.script.length) {
    fields.push({ label: 'Script', value: parsed.script.map(s => `${s.num}. ${s.text}`).join('\n'), mono: true });
  }
  if (parsed.instagram) fields.push({ label: '📸 Instagram Caption', value: parsed.instagram });
  if (parsed.youtubeTitle) fields.push({ label: '▶️ YouTube Title', value: parsed.youtubeTitle });
  if (parsed.youtube) fields.push({ label: '▶️ YouTube Description', value: parsed.youtube });
  if (parsed.tiktok) fields.push({ label: '🎵 TikTok Caption', value: parsed.tiktok });
  if (parsed.pinnedComment) fields.push({ label: '📌 Pinned Comment', value: parsed.pinnedComment });

  document.getElementById('previewFields').innerHTML = fields.map(f => `
    <div class="field-item">
      <div class="field-label">${f.label}</div>
      <div class="field-value ${f.mono ? 'mono' : ''}">${escHtml(f.value)}</div>
    </div>
  `).join('');

  // Scroll preview into view
  document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Store parsed for saving
  document.getElementById('saveBtn').dataset.parsed = JSON.stringify(parsed);
}

function handleSave() {
  const parsedRaw = document.getElementById('saveBtn').dataset.parsed;
  if (!parsedRaw) { showToast('Parse content first'); return; }
  const parsed = JSON.parse(parsedRaw);

  const entry = {
    id: editingId || genId(),
    type: parsed.type,
    number: parsed.number,
    rawDate: parsed.rawDate,
    script: parsed.script,
    instagram: parsed.instagram,
    youtube: parsed.youtube,
    youtubeTitle: parsed.youtubeTitle,
    tiktok: parsed.tiktok,
    pinnedComment: parsed.pinnedComment,
    createdAt: editingId ? (entries.find(e => e.id === editingId)?.createdAt || Date.now()) : Date.now(),
    updatedAt: Date.now()
  };

  if (editingId) {
    entries = entries.map(e => e.id === editingId ? entry : e);
    showToast('Entry updated ✓');
  } else {
    entries.push(entry);
    showToast('Entry saved ✓');
  }

  pushHistory();
  saveEntries(entries);
  editingId = null;
  document.getElementById('pasteInput').value = '';
  document.getElementById('previewSection').style.display = 'none';
  navigate('detail', { id: entry.id });
}

// ════════════════════════════════════════════
//   DETAIL VIEW
// ════════════════════════════════════════════
function renderDetail(id) {
  const e = entries.find(en => en.id === id);
  if (!e) { navigate('home'); return; }

  const dateObj = e.rawDate ? parseEntryDate(e.rawDate) : null;
  const status  = getStatus(dateObj);

  // Hero
  const pill = document.getElementById('detailTypePill');
  pill.textContent = TYPE_LABELS[e.type] || e.type;
  pill.className = `type-pill type-${e.type}`;
  document.getElementById('detailCodeNum').textContent = `${e.type}${e.number}`;
  document.getElementById('detailDate').textContent = dateObj ? `📅 ${formatDisplayDate(dateObj)}` : `📅 ${e.rawDate}`;

  const statusPill = document.getElementById('detailStatusPill');
  const days = dateObj ? daysUntil(dateObj) : null;
  statusPill.className = `status-pill status-${status}`;
  statusPill.textContent = status === 'today' ? 'Today' : status === 'upcoming' ? `In ${days} day${days !== 1 ? 's' : ''}` : 'Past';

  // Wire edit/delete
  document.getElementById('editEntryBtn').onclick = () => navigate('add', { editId: id });
  document.getElementById('deleteEntryBtn').onclick = () => openDeleteModal(id);

  // Build sections using SECTION_DEFS — show all expected, mark missing red
  const expectedSids = SECTION_DEFS[e.type] || SECTION_DEFS['P'];
  const container = document.getElementById('contentSections');

  container.innerHTML = expectedSids.map((sid, idx) => {
    const meta    = SECTION_META[sid];
    const rawVal  = getEntryField(e, sid);
    const isEmpty = !rawVal || (Array.isArray(rawVal) && rawVal.length === 0);

    // Body HTML
    let bodyHTML;
    if (sid === 'script' && !isEmpty) {
      bodyHTML = `<div class="script-lines">${rawVal.map(sl =>
        `<div class="script-line"><span class="line-num">${sl.num}</span><span class="line-text">${escHtml(sl.text)}</span></div>`
      ).join('')}</div>`;
    } else if (!isEmpty) {
      bodyHTML = escHtml(rawVal);
    } else {
      bodyHTML = `<span style="color:var(--rose);font-size:12px">⚠️ No content — edit entry to add.</span>`;
    }

    const copyBtn = (!isEmpty && sid !== 'script')
      ? `<button class="copy-btn" id="copy-${sid}" onclick="copySection(event,'${sid}',${JSON.stringify(String(rawVal)).replace(/'/g, "\\'")})" title="Copy">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           Copy
         </button>`
      : '';
    const missingBadge = isEmpty ? `<span class="block-missing-badge">Missing</span>` : '';

    return `
      <div class="content-block${isEmpty ? ' block-missing' : ''}" id="block-${sid}">
        <div class="block-header" onclick="toggleBlock('${sid}')">
          <div class="block-header-left">
            <div class="block-icon ${meta.iconClass}">${meta.icon}</div>
            <div>
              <div class="block-label">${meta.label}</div>
              <div class="block-sublabel">${meta.sublabel}</div>
            </div>
          </div>
          <div class="block-actions">
            ${missingBadge}
            ${copyBtn}
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="block-body collapsed" id="body-${sid}">${bodyHTML}</div>
      </div>
    `;
  }).join('');

  // Auto-expand first non-missing block
  const firstFilled = expectedSids.find(sid => {
    const v = getEntryField(e, sid);
    return v && !(Array.isArray(v) && v.length === 0);
  });
  if (firstFilled) toggleBlock(firstFilled, true);
}

function toggleBlock(id, forceOpen = false) {
  const block = document.getElementById(`block-${id}`);
  const body = document.getElementById(`body-${id}`);
  if (!block || !body) return;
  const isCollapsed = body.classList.contains('collapsed');
  if (forceOpen || isCollapsed) {
    body.classList.remove('collapsed');
    block.classList.add('expanded');
  } else {
    body.classList.add('collapsed');
    block.classList.remove('expanded');
  }
}

function copySection(event, id, text) {
  event.stopPropagation();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(`copy-${id}`);
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    }
    showToast('Copied to clipboard ✓');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied ✓');
  });
}

// ════════════════════════════════════════════
//   CALENDAR
// ════════════════════════════════════════════
const MONTH_NAMES = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
const DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function renderCalendar() {
  document.getElementById('calMonthTitle').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  // Map rawDate key (DDMM) → entry for this month/year
  const entryMap = {};
  entries.forEach(e => {
    const d = e.rawDate ? parseEntryDate(e.rawDate) : null;
    if (d && d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const key = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}`;
      entryMap[key] = e;
    }
  });

  // Find Monday of the week containing day 1
  const firstOfMonth = new Date(calYear, calMonth, 1);
  const lastOfMonth  = new Date(calYear, calMonth + 1, 0);
  const startCursor  = new Date(firstOfMonth);
  const dow = (firstOfMonth.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  startCursor.setDate(startCursor.getDate() - dow);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Build week groups
  const weeks = [];
  const cursor = new Date(startCursor);
  while (cursor <= lastOfMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.some(d => d.getMonth() === calMonth)) weeks.push(week);
  }

  const container = document.getElementById('calendarBody');
  container.innerHTML = weeks.map(week => {
    const wStart = week[0], wEnd = week[6];
    const sName = DAY_NAMES[(wStart.getDay()+6)%7];
    const eName = DAY_NAMES[(wEnd.getDay()+6)%7];
    const weekLabel = `${sName} ${wStart.getDate()} ${MONTH_NAMES[wStart.getMonth()].slice(0,3)} → ${eName} ${wEnd.getDate()} ${MONTH_NAMES[wEnd.getMonth()].slice(0,3)}`;

    const daysHTML = week.map(day => {
      const isCurrentMonth = day.getMonth() === calMonth;
      const dayNum   = day.getDate();
      const monthNum = day.getMonth() + 1;
      const key      = `${String(dayNum).padStart(2,'0')}${String(monthNum).padStart(2,'0')}`;
      const entry    = entryMap[key];
      const dayName  = DAY_NAMES[(day.getDay()+6)%7];
      const isToday  = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` === todayKey;
      const todayCls = isToday ? ' cal-day--today' : '';
      const otherCls = !isCurrentMonth ? ' cal-day--other-month' : '';

      if (entry) {
        const eStatus = entry.entryStatus || 'none';
        const accent  = TYPE_ACCENTS[entry.type] || 'var(--purple)';
        return `
          <div class="cal-day cal-day--filled cal-day--${eStatus}${todayCls}" onclick="navigate('detail',{id:'${entry.id}'})">
            <span class="cal-day-name">${dayName}</span>
            <span class="cal-day-num">${dayNum}</span>
            <div class="cal-day-content">
              <span class="cal-day-code" style="color:${accent}">${entry.type}${entry.number}</span>
              ${entry.youtubeTitle ? `<span class="cal-day-ytitle">${escHtml(entry.youtubeTitle)}</span>` : ''}
            </div>
            <div class="cal-day-dot"></div>
          </div>`;
      } else {
        return `
          <div class="cal-day cal-day--empty${todayCls}${otherCls}">
            <span class="cal-day-name">${dayName}</span>
            <span class="cal-day-num">${dayNum}</span>
          </div>`;
      }
    }).join('');

    return `<div class="cal-week"><div class="cal-week-header">${weekLabel}</div>${daysHTML}</div>`;
  }).join('');
}

// ════════════════════════════════════════════
//   DELETE MODAL
// ════════════════════════════════════════════
function openDeleteModal(id) {
  pendingDeleteId = id;
  const e = entries.find(en => en.id === id);
  document.getElementById('deleteModalSub').textContent =
    e ? `This will permanently delete ${e.type}${e.number} (${e.rawDate}).` : 'This action cannot be undone.';
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  pendingDeleteId = null;
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  pushHistory();
  entries = entries.filter(e => e.id !== pendingDeleteId);
  saveEntries(entries);
  closeDeleteModal();
  sfx('delete');
  showToast('Entry deleted');
  navigate('home');
}

// ════════════════════════════════════════════
//   SETTINGS
// ════════════════════════════════════════════
function renderSettings() {
  document.getElementById('statTotal').textContent = entries.length;
  const upcoming = entries.filter(e => {
    const d = e.rawDate ? parseEntryDate(e.rawDate) : null;
    return getStatus(d) === 'upcoming' || getStatus(d) === 'today';
  }).length;
  document.getElementById('statUpcoming').textContent = upcoming;
}

function exportData() {
  const data = JSON.stringify(entries, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindframe-schedule-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ✓');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      entries = imported;
      saveEntries(entries);
      renderSettings();
      showToast(`Imported ${imported.length} entries ✓`);
    } catch {
      showToast('Import failed — invalid file');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm('Delete ALL entries? This cannot be undone.')) {
    entries = [];
    saveEntries(entries);
    renderSettings();
    showToast('All data cleared');
  }
}

// ─── Util ───────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ════════════════════════════════════════════
//   INIT
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // ── Undo / Redo buttons ──
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });

  // ── Nav buttons ──
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // ── Back button ──
  document.getElementById('backBtn').addEventListener('click', () => navigate('home'));

  // ── Add page buttons ──
  document.getElementById('parseBtn').addEventListener('click', handleParse);
  document.getElementById('saveBtn').addEventListener('click', handleSave);
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('pasteInput').value = '';
    document.getElementById('previewSection').style.display = 'none';
  });
  document.getElementById('cancelSaveBtn').addEventListener('click', () => {
    document.getElementById('previewSection').style.display = 'none';
  });

  // ── Search toggle ──
  const searchWrap  = document.getElementById('searchWrap');
  const searchInput = document.getElementById('searchInput');
  document.getElementById('searchToggleBtn').addEventListener('click', () => {
    const open = searchWrap.style.display !== 'none';
    searchWrap.style.display = open ? 'none' : '';
    if (!open) { searchInput.focus(); }
    else { searchInput.value = ''; searchQuery = ''; renderDashboard(); }
  });
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderDashboard();
  });

  // ── Filter chips ──
  document.getElementById('filterRow').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderDashboard();
  });

  // ── Delete modal ──
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });

  // ── Date edit modal ──
  document.getElementById('cancelDateBtn').addEventListener('click', closeDateEditModal);
  document.getElementById('saveDateBtn').addEventListener('click', saveDateEdit);
  document.getElementById('dateEditModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('dateEditModal')) closeDateEditModal();
  });
  document.getElementById('dateEditInput').addEventListener('input', (e) => {
    updateDatePreview(e.target.value);
  });
  document.getElementById('dateEditInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveDateEdit();
    if (e.key === 'Escape') closeDateEditModal();
  });

  // ── Calendar navigation ──
  document.getElementById('calPrevBtn').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('calNextBtn').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById('calTodayBtn').addEventListener('click', () => {
    calMonth = new Date().getMonth();
    calYear  = new Date().getFullYear();
    renderCalendar();
  });

  // ── Settings ──
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () =>
    document.getElementById('importFileInput').click()
  );
  document.getElementById('importFileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
  
  // ── Cloud Sync Buttons & Modal ──
  const syncBadge = document.getElementById('syncBadge');
  if (syncBadge) syncBadge.addEventListener('click', openSyncModal);
  const forceSyncBtn = document.getElementById('forceSyncBtn');
  if (forceSyncBtn) forceSyncBtn.addEventListener('click', forceSyncNow);
  const closeSyncModalBtn = document.getElementById('closeSyncModalBtn');
  if (closeSyncModalBtn) closeSyncModalBtn.addEventListener('click', closeSyncModal);
  const modalForceSyncBtn = document.getElementById('modalForceSyncBtn');
  if (modalForceSyncBtn) modalForceSyncBtn.addEventListener('click', () => {
    forceSyncNow();
    closeSyncModal();
  });
  const syncModal = document.getElementById('syncModal');
  if (syncModal) syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) closeSyncModal();
  });

  // ── Initial ──
  checkAutoUpload();   // auto-mark past scheduled → uploaded
  pushHistory();       // seed undo history
  renderDashboard();
  initFirebaseSync();  // connect and real-time sync with Firebase

  // ── PWA Service Worker ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
