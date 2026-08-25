'use strict';

/* ══════════════════════════════════════════════════════════════
   B-ROLL TRACKER v5
   New: Used-Set Tracking per score · Global Prefix/Suffix
   ══════════════════════════════════════════════════════════════ */

/* ── Score Colors ──────────────────────────────────────────── */
const C = {
  null: { bg:'#16162a', border:'rgba(255,255,255,0.05)', glow:'transparent' },
  0:    { bg:'#16162a', border:'rgba(255,255,255,0.05)', glow:'transparent' },
  0.5:  { bg:'#180000', border:'#220000',                glow:'rgba(34,0,0,0.35)' },
  1:    { bg:'#200000', border:'#2e0101',                glow:'rgba(46,1,1,0.35)' },
  1.5:  { bg:'#280000', border:'#3c0202',                glow:'rgba(60,2,2,0.36)' },
  2:    { bg:'#300101', border:'#4a0303',                glow:'rgba(74,3,3,0.36)' },
  2.5:  { bg:'#380101', border:'#590404',                glow:'rgba(89,4,4,0.38)' },
  3:    { bg:'#400202', border:'#680606',                glow:'rgba(104,6,6,0.38)' },
  3.5:  { bg:'#480303', border:'#780909',                glow:'rgba(120,9,9,0.38)' },
  4:    { bg:'#500404', border:'#880c0c',                glow:'rgba(136,12,12,0.40)' },
  4.5:  { bg:'#580606', border:'#981010',                glow:'rgba(152,16,16,0.40)' },
  5:    { bg:'#600808', border:'#a91515',                glow:'rgba(169,21,21,0.40)' },
  5.5:  { bg:'#680c0c', border:'#ba1a1a',                glow:'rgba(186,26,26,0.40)' },
  6:    { bg:'#701010', border:'#cb2020',                glow:'rgba(203,32,32,0.40)' },
  6.5:  { bg:'#781414', border:'#dc2626',                glow:'rgba(220,38,38,0.40)' },
  7:    { bg:'#7f1d1d', border:'#e11d48',                glow:'rgba(225,29,72,0.40)' },
  7.5:  { bg:'#831843', border:'#f43f5e',                glow:'rgba(244,63,94,0.40)' },
  8:    { bg:'#7c2d12', border:'#f97316',                glow:'rgba(249,115,22,0.50)' }, // 8 is Orange
  8.5:  { bg:'#785900', border:'#facc15',                glow:'rgba(250,204,21,0.50)' }, // 8.5 is Yellow
  9:    { bg:'#00922e', border:'#00c040',                glow:'rgba(0,192,64,0.55)' },
  9.5:  { bg:'#006e22', border:'#009832',                glow:'rgba(0,152,50,0.55)' },
  10:   { bg:'#004c16', border:'#007028',                glow:'rgba(0,112,40,0.60)' },
};



const STEPS = [0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10];

function snap(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n <= 0) return 0;
  if (n >= 10) return 10;
  return STEPS.reduce((p, c) => Math.abs(c - n) < Math.abs(p - n) ? c : p);
}
function getC(score) { return C[snap(score)] ?? C[null]; }
function scoreLbl(s) { return (s === null || s === undefined) ? '—' : `${s}`; }

/* ── State ─────────────────────────────────────────────────── */
const ST = {
  brolls:            [],
  scores:            {},
  prompts:           {},
  batches:           [],
  usedSets:          {},
  setRatings:        {},   // { [brollNum]: { [setIdx]: { score, why } } }
  ratingBatches:     [],   // [ { id, label, date, raw, brolls, count } ]
  activeRatingBatch: 'new',
  myRatings:         {},   // { [brollNum]: { [setIdx]: { score, comment, date } } }
  covered:           {},   // { [brollNum]: true } -> marked as covered with other clip (9+ in Real Overview)
  showBengali:       localStorage.getItem('br_show_bengali') !== 'false',
  bengaliScript:     '',
  bengaliLines:      {},   // { [brollNum]: "বাংলা লাইন..." }
  quickRateTier1:    parseFloat(localStorage.getItem('br_qr_tier1')) || 5,
  quickRateTier2:    parseFloat(localStorage.getItem('br_qr_tier2')) || 9,
  prefix:            '',
  suffix:            '',
  labelEnabled:      true, // Prepend "14S6" label to copied prompts
  mainRatingLocked:  true, // Lock main rating slider to prevent mistouch (default true)
  filterTarget:      'main', // 'main' or 'real'
  filter:            'all',
  sortBy:            'num',
  activeBatch:       'new',
  inputOpen:         true,
  libOpen:           false,
  csetOpen:          false,
  overviewScroll:    false, // false = auto-compressed full view, true = horizontal scrollable
};






/* ── Firebase Realtime Cloud Sync ────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDd6YU-594_K55H98ZoVwf9hgcVCCuaaqQ",
  authDomain: "broll-38319.firebaseapp.com",
  databaseURL: "https://broll-38319-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "broll-38319",
  storageBucket: "broll-38319.firebasestorage.app",
  messagingSenderId: "54189067078",
  appId: "1:54189067078:web:a33c8129977a0d27fdb347",
  measurementId: "G-JXH7R79WDV"
};

const CLIENT_ID = 'c_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
let _fbDb = null;
let _fbRef = null;
let _fbSyncTimer = null;
let _isApplyingRemote = false;
let _remoteTimer = null;
let _hasPendingLocalChange = false; // track if a save was blocked during remote apply
let _lastLocalSaveTime = 0;        // timestamp of last successful local write
let _lastFirebaseSaveTime = 0;     // timestamp of last successful firebase write
let _fbConnected = false;
let _fbRetryTimer = null;
let _fbRetryCount = 0;

function setApplyingRemote(val) {
  _isApplyingRemote = !!val;
  if (_remoteTimer) clearTimeout(_remoteTimer);
  if (val) {
    // Safety: always release after 1.5 seconds max, then flush any pending save
    _remoteTimer = setTimeout(() => {
      _isApplyingRemote = false;
      if (_hasPendingLocalChange) {
        _hasPendingLocalChange = false;
        pushToFirebase(true);
      }
    }, 1500);
  } else {
    // Released early — flush pending save immediately
    if (_hasPendingLocalChange) {
      _hasPendingLocalChange = false;
      pushToFirebase(true);
    }
  }
}

let _lastSavedStatus = 'synced';
let _lastRemoteUpdatedAt = 0;

function updateSavedTimeDisplay() {
  const dot = _el('sync-dot');
  const txt = _el('sync-text');
  const pill = _el('sync-status');
  if (!dot || !txt) return;

  if (_lastSavedStatus === 'syncing') {
    dot.className = 'sync-dot syncing';
    txt.textContent = 'Saving…';
    if (pill) pill.title = 'Uploading changes to Firebase…';
    return;
  }
  if (_lastSavedStatus === 'offline') {
    dot.className = 'sync-dot offline';
    txt.textContent = _fbConnected ? 'Save Error' : 'Offline';
    if (pill) pill.title = 'Not saved to cloud. Click to retry.';
    return;
  }

  dot.className = 'sync-dot';
  if (_lastFirebaseSaveTime > 0) {
    const diff = Math.max(0, Math.floor((Date.now() - _lastFirebaseSaveTime) / 1000));
    let timeStr = 'Saved just now';
    if (diff >= 5 && diff < 60) timeStr = `Saved ${diff}s ago`;
    else if (diff >= 60 && diff < 3600) timeStr = `Saved ${Math.floor(diff / 60)}m ago`;
    else if (diff >= 3600) timeStr = `Saved ${Math.floor(diff / 3600)}h ago`;
    txt.textContent = timeStr;
    if (pill) pill.title = `Cloud synced — ${timeStr}\nClick to force sync now`;
  } else {
    txt.textContent = 'Cloud';
    if (pill) pill.title = 'Click to sync';
  }
}

setInterval(updateSavedTimeDisplay, 1000);

function updateSyncUI(status, text) {
  // Do NOT reset _lastFirebaseSaveTime here (connection events are not saves)
  _lastSavedStatus = status;
  updateSavedTimeDisplay();
}

/* ── Deep merge helpers ─────────────────────────────────────── */
// Merges two rating objects: keeps all entries, prefers the one with newer 'date'
function _mergeMyRatings(cloud, local) {
  const result = {};
  const allNums = new Set([...Object.keys(cloud || {}), ...Object.keys(local || {})]);
  allNums.forEach(num => {
    const cSets = cloud?.[num] || {};
    const lSets = local?.[num] || {};
    const allIdxs = new Set([...Object.keys(cSets), ...Object.keys(lSets)]);
    result[num] = {};
    allIdxs.forEach(idx => {
      const c = cSets[idx], l = lSets[idx];
      if (!c) { result[num][idx] = l; }
      else if (!l) { result[num][idx] = c; }
      else {
        // Both exist — prefer whichever has a newer date
        result[num][idx] = ((l.date || 0) >= (c.date || 0)) ? l : c;
      }
    });
    if (!Object.keys(result[num]).length) delete result[num];
  });
  return result;
}

// Merges scores: for each num, prefer whichever is non-null; if both exist, keep local (user just changed it)
function _mergeScores(cloud, local) {
  return { ...(cloud || {}), ...(local || {}) };
}

// Merges covered: union — if either device marked it done, keep it done; local can also unmark
function _mergeCovered(cloud, local) {
  return { ...(cloud || {}), ...(local || {}) };
}

// Merges prompts: keep all prompts from both devices; local wins for same num
function _mergePrompts(cloud, local) {
  const result = { ...(cloud || {}) };
  Object.entries(local || {}).forEach(([num, lPrompts]) => {
    if (!result[num] || !result[num].length) {
      result[num] = lPrompts;
    } else {
      // Merge by batchId: keep all batches, local prompts for matching batchId win
      const cPrompts = result[num] || [];
      const localBatchIds = new Set(lPrompts.map(p => p.batchId).filter(Boolean));
      const cloudOnlyPrompts = cPrompts.filter(p => p.batchId && !localBatchIds.has(p.batchId));
      result[num] = [...cloudOnlyPrompts, ...lPrompts];
    }
  });
  return result;
}

// Merges batches arrays: union by id
function _mergeBatches(cloud, local) {
  const map = new Map();
  (cloud || []).forEach(b => map.set(b.id, b));
  (local || []).forEach(b => map.set(b.id, b)); // local wins on conflict
  return Array.from(map.values());
}

// Full project-level merge: local changes applied on top of cloud state
function _mergeProject(cloudProj, localProj) {
  if (!cloudProj) return localProj;
  if (!localProj) return cloudProj;
  return {
    name:          localProj.name || cloudProj.name || 'Script',
    script:        localProj.script !== undefined ? localProj.script : (cloudProj.script || ''),
    bengaliScript: localProj.bengaliScript !== undefined ? localProj.bengaliScript : (cloudProj.bengaliScript || ''),
    bengaliLines:  localProj.bengaliLines || cloudProj.bengaliLines || parseAltScript(localProj.bengaliScript || cloudProj.bengaliScript || ''),
    scores:        _mergeScores(cloudProj.scores, localProj.scores),
    myRatings:     _mergeMyRatings(cloudProj.myRatings, localProj.myRatings),
    covered:       _mergeCovered(cloudProj.covered, localProj.covered),
    prompts:       _mergePrompts(cloudProj.prompts, localProj.prompts),
    batches:       _mergeBatches(cloudProj.batches, localProj.batches),
    usedSets:      { ...(cloudProj.usedSets || {}), ...(localProj.usedSets || {}) },
    setRatings:    { ...(cloudProj.setRatings || {}), ...(localProj.setRatings || {}) },
    ratingBatches: _mergeBatches(cloudProj.ratingBatches, localProj.ratingBatches),
  };
}

function pushToFirebase(immediate = false) {
  if (!_fbRef) return;

  if (_isApplyingRemote) {
    _hasPendingLocalChange = true;
    return;
  }

  if (_fbSyncTimer) clearTimeout(_fbSyncTimer);
  _lastSavedStatus = 'syncing';
  updateSavedTimeDisplay();

  const doPush = () => {
    if (_isApplyingRemote) {
      _hasPendingLocalChange = true;
      _lastSavedStatus = 'synced';
      updateSavedTimeDisplay();
      return;
    }

    // Build local payload first
    try {
      const ta = _el('script-textarea');
      const savedScript = ta && ta.value !== undefined && ta.value !== null
        ? ta.value
        : (PROJECTS[ACTIVE_PID]?.script || '');

      const bnTa = _el('script-bengali-textarea');
      const savedBnScript = bnTa && bnTa.value !== undefined && bnTa.value !== null
        ? bnTa.value
        : (PROJECTS[ACTIVE_PID]?.bengaliScript || ST.bengaliScript || '');

      if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
        PROJECTS[ACTIVE_PID].script = savedScript;
        PROJECTS[ACTIVE_PID].bengaliScript = savedBnScript;
        PROJECTS[ACTIVE_PID].bengaliLines = JSON.parse(JSON.stringify(ST.bengaliLines || {}));
      }
    } catch {}

    const now = Date.now();
    const localProjects = JSON.parse(JSON.stringify(PROJECTS));

    // READ current cloud state first, then MERGE local changes on top, then WRITE
    _fbRef.once('value').then(snap => {
      const cloudData = snap.val();

      let mergedProjects = localProjects;

      // If cloud has data from another device that's newer, merge carefully
      if (cloudData && cloudData.projects && cloudData.lastUpdatedBy !== CLIENT_ID) {
        mergedProjects = {};
        const allPids = new Set([
          ...Object.keys(cloudData.projects),
          ...Object.keys(localProjects)
        ]);
        allPids.forEach(pid => {
          mergedProjects[pid] = _mergeProject(cloudData.projects[pid], localProjects[pid]);
        });
      }

      const payload = {
        active: ACTIVE_PID,
        projects: mergedProjects,
        globalCset: { prefix: ST.prefix || '', suffix: ST.suffix || '', labelEnabled: ST.labelEnabled !== false },
        lastUpdatedBy: CLIENT_ID,
        updatedAt: now
      };

      return _fbRef.set(payload);
    })
    .then(() => {
      _lastFirebaseSaveTime = Date.now();
      _lastRemoteUpdatedAt = now;
      _lastSavedStatus = 'synced';
      _fbRetryCount = 0;
      updateSavedTimeDisplay();
      if (_hasPendingLocalChange) {
        _hasPendingLocalChange = false;
        pushToFirebase(true);
      }
    })
    .catch(err => {
      console.warn('Firebase push failed:', err);
      _lastSavedStatus = 'error';
      updateSavedTimeDisplay();
      if (_fbRetryCount < 5) {
        _fbRetryCount++;
        if (_fbRetryTimer) clearTimeout(_fbRetryTimer);
        _fbRetryTimer = setTimeout(() => pushToFirebase(true), Math.min(1000 * Math.pow(2, _fbRetryCount), 30000));
      }
    });
  };

  if (immediate) {
    doPush();
  } else {
    _fbSyncTimer = setTimeout(doPush, 2000);
  }
}

function applyRemoteData(data) {
  if (!data || !data.projects || typeof data.projects !== 'object') return;

  // A local change is "newer" if it was saved to localStorage more recently than the remote timestamp
  const remoteUpdatedAt = data.updatedAt || 0;
  if (_lastLocalSaveTime > 0 && _lastLocalSaveTime > remoteUpdatedAt && data.lastUpdatedBy !== CLIENT_ID) {
    // Our local state is newer — push it instead of applying remote
    console.log('Local state newer than remote, pushing local instead of applying remote.');
    pushToFirebase(true);
    return;
  }

  setApplyingRemote(true);
  try {

    // 1. Sync projects dictionary
    for (const k of Object.keys(PROJECTS)) delete PROJECTS[k];
    for (const [k, v] of Object.entries(data.projects)) {
      PROJECTS[k] = {
        name: v.name || 'Script',
        script: v.script || '',
        bengaliScript: v.bengaliScript || '',
        bengaliLines: v.bengaliLines || parseAltScript(v.bengaliScript || ''),
        scores: _migrateScores(v.scores),
        prompts: _migratePrompts(v.prompts || {}),
        batches: v.batches || [],
        usedSets: _migrateUsedSets(v.usedSets),
        setRatings: _migrateSetRatings(v.setRatings || {}),
        ratingBatches: v.ratingBatches || [],
        myRatings: _migrateMyRatings(v.myRatings || {}),
        covered: _migrateCovered(v.covered || {})
      };
    }

    // 2. Sync active project ID (keep current active script if valid so user doesn't get kicked)
    const savedActivePid = localStorage.getItem('br_last_active_pid');
    if (savedActivePid && PROJECTS[savedActivePid]) {
      ACTIVE_PID = savedActivePid;
    } else if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
      // keep current script tab active
    } else if (data.active && PROJECTS[data.active]) {
      ACTIVE_PID = data.active;
    } else {
      ACTIVE_PID = Object.keys(PROJECTS)[0] || null;
    }

    // 3. Sync global prefix/suffix/labelEnabled
    if (data.globalCset) {
      ST.prefix = data.globalCset.prefix || '';
      ST.suffix = data.globalCset.suffix || '';
      if (data.globalCset.labelEnabled !== undefined) {
        ST.labelEnabled = data.globalCset.labelEnabled !== false;
      }
      try { localStorage.setItem(GLOBAL_CSET_KEY, JSON.stringify({ prefix: ST.prefix, suffix: ST.suffix, labelEnabled: ST.labelEnabled })); } catch {}
      syncCsetUI();
    }

    // 4. Update localStorage cache
    try {
      localStorage.setItem(PROJ_KEY, JSON.stringify({ active: ACTIVE_PID, projects: PROJECTS }));
      if (ACTIVE_PID) localStorage.setItem('br_last_active_pid', ACTIVE_PID);
    } catch {}

    // 5. Update active project working state
    if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
      const proj = PROJECTS[ACTIVE_PID];
      ST.scores            = _migrateScores(proj.scores);
      ST.prompts           = _migratePrompts(proj.prompts);
      ST.batches           = proj.batches       || [];
      ST.usedSets          = _migrateUsedSets(proj.usedSets);
      ST.setRatings        = _migrateSetRatings(proj.setRatings);
      ST.ratingBatches     = proj.ratingBatches || [];
      ST.myRatings         = _migrateMyRatings(proj.myRatings);
      ST.covered           = _migrateCovered(proj.covered || {});
      ST.bengaliScript     = proj.bengaliScript || '';
      ST.bengaliLines      = proj.bengaliLines || parseAltScript(proj.bengaliScript || '');
      ST.brolls            = parseScript(proj.script || '');

      const ta = _el('script-textarea');
      if (ta && document.activeElement !== ta) {
        ta.value = proj.script || '';
      }
      if (ST.brolls.length) collapseInput();
    }


    // 6. Re-render UI
    renderProjectTabs();
    renderHeatmap();
    renderStats();
    renderCards(false);
    updateAllPromptChips();
    renderBatchTabs();
    renderBatchPanel();
    updateLibBadge();
    renderRatingTabs();
    renderRatingPanel();
    updateSratingHint();

    _lastRemoteUpdatedAt = remoteUpdatedAt;
    _lastFirebaseSaveTime = remoteUpdatedAt || Date.now();
    _lastSavedStatus = 'synced';
    updateSavedTimeDisplay();
    toast('☁️ Synced from Cloud');
  } catch (err) {
    console.error('Error applying remote data:', err);
  } finally {
    setApplyingRemote(false);
  }
}




function initFirebaseSync() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded, using local storage.');
    updateSyncUI('offline', 'Local Only');
    return;
  }
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _fbDb = firebase.database();
    _fbRef = _fbDb.ref('broll_app_data');

    // Monitor connection state — do NOT mark as "synced" just because connected
    _fbDb.ref('.info/connected').on('value', snap => {
      _fbConnected = !!snap.val();
      if (!_fbConnected) {
        _lastSavedStatus = 'offline';
        updateSavedTimeDisplay();
      } else if (_lastSavedStatus === 'offline') {
        // Reconnected — push any pending changes immediately
        _lastSavedStatus = 'syncing';
        updateSavedTimeDisplay();
        pushToFirebase(true);
      }
    });

    // Listen for remote updates (real-time listener)
    let isInitialRead = true;
    _fbRef.on('value', snap => {
      const data = snap.val();
      if (!data || !data.projects || Object.keys(data.projects).length === 0) {
        console.log('Firebase database empty, pushing local state...');
        pushToFirebase(true);
        isInitialRead = false;
        return;
      }
      if (isInitialRead) {
        isInitialRead = false;
        applyRemoteData(data);
        return;
      }
      // Skip updates we ourselves pushed
      if (data.lastUpdatedBy === CLIENT_ID) {
        return;
      }
      applyRemoteData(data);
    });

    // Multi-device: check for newer cloud data when tab becomes visible / gains focus
    const checkFreshRemote = () => {
      if (!_fbRef || _isApplyingRemote) return;
      _fbRef.once('value').then(snap => {
        const data = snap.val();
        if (!data || !data.updatedAt) return;
        // Only apply if remote is genuinely newer and from a different device
        if (data.lastUpdatedBy === CLIENT_ID) return;
        if (data.updatedAt > (_lastRemoteUpdatedAt || 0)) {
          applyRemoteData(data);
        }
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkFreshRemote();
    });
    window.addEventListener('focus', checkFreshRemote);

    // Click on sync status pill to manual force sync
    _el('sync-status')?.addEventListener('click', () => {
      toast('🔄 Force syncing with Cloud…');
      pushToFirebase(true);
    });

  } catch (err) {
    console.error('Firebase initialization error:', err);
    updateSyncUI('offline', 'Local Only');
  }
}


/* ── Global Prefix / Suffix (shared across all scripts) ─────── */
const GLOBAL_CSET_KEY = 'br_global_cset';
function saveGlobalCset() {
  try { localStorage.setItem(GLOBAL_CSET_KEY, JSON.stringify({ prefix: ST.prefix, suffix: ST.suffix, labelEnabled: ST.labelEnabled !== false })); } catch {}
}

function loadGlobalCset() {
  try {
    const d = JSON.parse(localStorage.getItem(GLOBAL_CSET_KEY) || 'null');
    if (d) {
      ST.prefix = d.prefix || '';
      ST.suffix = d.suffix || '';
      ST.labelEnabled = (d.labelEnabled !== false);
      return;
    }
  } catch {}
}

/* ── Multi-Project (Multi-Script) Store ─────────────────────── */
const PROJECTS   = {};
let   ACTIVE_PID = null;
const PROJ_KEY   = 'br_v6_proj';

function _projData(name) {
  return {
    name: name||'Script 1',
    script: '',
    bengaliScript: '',
    bengaliLines: {},
    scores: {},
    prompts: {},
    batches: [],
    usedSets: {},
    setRatings: {},
    ratingBatches: [],
    myRatings: {},
    covered: {}
  };
}

let _lastAutoBackupTime = 0;

function maybeAutoBackup() {
  const now = Date.now();
  if (now - _lastAutoBackupTime > 60000) { // Auto backup at most once every 60s
    _lastAutoBackupTime = now;
    createProjectBackup('Auto-save');
  }
}

function saveProjects(immediate = false) {
  if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
    const ta = _el('script-textarea');
    const savedScript = ta && ta.value !== undefined && ta.value !== null
      ? ta.value
      : (PROJECTS[ACTIVE_PID].script || '');

    const bnTa = _el('script-bengali-textarea');
    const savedBnScript = bnTa && bnTa.value !== undefined && bnTa.value !== null
      ? bnTa.value
      : (PROJECTS[ACTIVE_PID].bengaliScript || ST.bengaliScript || '');

    PROJECTS[ACTIVE_PID] = {
      ...PROJECTS[ACTIVE_PID],
      script:        savedScript,
      bengaliScript: savedBnScript,
      bengaliLines:  JSON.parse(JSON.stringify(ST.bengaliLines || {})),
      scores:        JSON.parse(JSON.stringify(ST.scores)),
      prompts:       JSON.parse(JSON.stringify(ST.prompts)),
      batches:       JSON.parse(JSON.stringify(ST.batches)),
      usedSets:      JSON.parse(JSON.stringify(ST.usedSets)),
      setRatings:    JSON.parse(JSON.stringify(ST.setRatings||{})),
      ratingBatches: JSON.parse(JSON.stringify(ST.ratingBatches||[])),
      myRatings:     JSON.parse(JSON.stringify(ST.myRatings||{})),
      covered:       JSON.parse(JSON.stringify(ST.covered||{})),
    };
  }
  // Always write to localStorage FIRST (instant, never fails due to network)
  try {
    localStorage.setItem(PROJ_KEY, JSON.stringify({ active: ACTIVE_PID, projects: PROJECTS }));
    if (ACTIVE_PID) localStorage.setItem('br_last_active_pid', ACTIVE_PID);
    _lastLocalSaveTime = Date.now(); // track when we last saved locally
  } catch {}
  saveGlobalCset();
  pushToFirebase(immediate); // then push to Firebase
  maybeAutoBackup();
}

function save(immediate = false) { saveProjects(immediate); }



function _migrateCovered(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const res = {};
  if (Array.isArray(raw)) {
    raw.forEach((v, idx) => { if (v) res[idx] = true; });
  } else {
    for (const [k, v] of Object.entries(raw)) {
      if (v) res[k] = true;
    }
  }
  return res;
}

function _migrateScores(raw) {
  if (!raw) return {};
  const migrated = {};
  if (Array.isArray(raw)) {
    raw.forEach((v, idx) => {
      if (v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v))) {
        migrated[idx] = parseFloat(v);
      }
    });
  } else if (typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v))) {
        migrated[k] = parseFloat(v);
      }
    }
  }
  return migrated;
}

function _migrateUsedSets(raw) {
  if (!raw) return {};
  const migrated = {};
  if (Array.isArray(raw)) {
    raw.forEach((v, idx) => {
      if (v !== null && v !== undefined && v !== '' && !isNaN(parseInt(v))) {
        migrated[idx] = parseInt(v);
      }
    });
  } else if (typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined && v !== '' && !isNaN(parseInt(v))) {
        migrated[k] = parseInt(v);
      }
    }
  }
  return migrated;
}

function _migrateMyRatings(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const migrated = {};
  for (const [brollNum, sets] of Object.entries(raw)) {
    if (!sets || typeof sets !== 'object') continue;
    for (const [setIdx, r] of Object.entries(sets)) {
      if (!r || typeof r !== 'object' || r.score === undefined || isNaN(parseFloat(r.score))) continue;
      if (!migrated[brollNum]) migrated[brollNum] = {};
      migrated[brollNum][setIdx] = {
        score: parseFloat(r.score),
        comment: r.comment || '',
        date: r.date || Date.now()
      };
    }
  }
  return migrated;
}

function _migratePrompts(rawPr) {
  const p = {};
  for (const [k,v] of Object.entries(rawPr||{})) {
    p[k] = (v||[]).map(x => typeof x === 'string' ? { text:x, batchId:null, copied:false } : x);
  }
  return p;
}

function _migrateSetRatings(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const migrated = {};
  for (const [brollNum, sets] of Object.entries(raw)) {
    if (!sets || typeof sets !== 'object') continue;
    migrated[brollNum] = {};
    for (const [setIdx, r] of Object.entries(sets)) {
      if (!r) continue;
      if (Array.isArray(r)) {
        migrated[brollNum][setIdx] = r.map(x => ({
          score: parseFloat(x.score) || 0,
          why: x.why || '',
          date: x.date || Date.now()
        }));
      } else if (typeof r === 'object' && r.score !== undefined) {
        migrated[brollNum][setIdx] = [{
          score: parseFloat(r.score) || 0,
          why: r.why || '',
          date: r.date || Date.now()
        }];
      }
    }
  }
  return migrated;
}

function loadProjects() {
  /* Try new multi-project store */
  try {
    const raw = JSON.parse(localStorage.getItem(PROJ_KEY)||'null');
    if (raw && raw.projects && Object.keys(raw.projects).length) {
      for (const [k,v] of Object.entries(raw.projects)) {
        PROJECTS[k] = {
          ...v,
          bengaliScript: v.bengaliScript || '',
          bengaliLines:  v.bengaliLines || parseAltScript(v.bengaliScript || ''),
          scores: _migrateScores(v.scores),
          prompts: _migratePrompts(v.prompts),
          usedSets: _migrateUsedSets(v.usedSets),
          setRatings: _migrateSetRatings(v.setRatings),
          myRatings: _migrateMyRatings(v.myRatings),
          covered: _migrateCovered(v.covered)
        };
      }
      const lastActive = localStorage.getItem('br_last_active_pid');
      if (lastActive && PROJECTS[lastActive]) {
        ACTIVE_PID = lastActive;
      } else {
        ACTIVE_PID = (raw.active && PROJECTS[raw.active]) ? raw.active : Object.keys(PROJECTS)[0];
      }
      // Migrate old per-project prefix/suffix to global store (first time only)
      if (!localStorage.getItem(GLOBAL_CSET_KEY)) {
        const proj = PROJECTS[ACTIVE_PID]||{};
        if (proj.prefix || proj.suffix) {
          ST.prefix = proj.prefix||''; ST.suffix = proj.suffix||'';
          saveGlobalCset();
        }
      }
      return;
    }
  } catch {}


  /* Migrate from old single-project keys */
  try {
    const sc  = localStorage.getItem('br_sc5')||localStorage.getItem('br_sc4')||'';
    const s   = JSON.parse(localStorage.getItem('br_s5')||localStorage.getItem('br_s4')||'{}');
    const pr  = _migratePrompts(JSON.parse(localStorage.getItem('br_p5')||'{}'));
    const ba  = JSON.parse(localStorage.getItem('br_b5')||'[]');
    const us  = JSON.parse(localStorage.getItem('br_us5')||'{}');
    const cs  = JSON.parse(localStorage.getItem('br_cs5')||'{}');
    const pid = uid();
    PROJECTS[pid] = { name:'Script 1', script:sc, bengaliScript:'', bengaliLines:{}, scores:s, prompts:pr, batches:ba, usedSets:us, setRatings:{}, ratingBatches:[], myRatings:{} };
    ACTIVE_PID = pid;
    localStorage.setItem('br_last_active_pid', pid);
    // Migrate prefix/suffix to global
    if (cs.prefix || cs.suffix) {
      ST.prefix = cs.prefix||''; ST.suffix = cs.suffix||'';
      saveGlobalCset();
    }
    saveProjects(); return;
  } catch {}
  /* Fresh start */
  const pid = uid();
  PROJECTS[pid] = _projData('Script 1');
  ACTIVE_PID = pid;
  localStorage.setItem('br_last_active_pid', pid);
  saveProjects();
}

function activateProject(pid) {
  if (!PROJECTS[pid]) return;

  // 1. If switching from another project, cleanly save that project first
  if (ACTIVE_PID && PROJECTS[ACTIVE_PID] && ACTIVE_PID !== pid) {
    const ta = _el('script-textarea');
    const bnTa = _el('script-bengali-textarea');
    PROJECTS[ACTIVE_PID].script = ta ? ta.value : (PROJECTS[ACTIVE_PID].script || '');
    PROJECTS[ACTIVE_PID].bengaliScript = bnTa ? bnTa.value : (PROJECTS[ACTIVE_PID].bengaliScript || ST.bengaliScript || '');
    PROJECTS[ACTIVE_PID].bengaliLines = JSON.parse(JSON.stringify(ST.bengaliLines || {}));
    PROJECTS[ACTIVE_PID].scores = JSON.parse(JSON.stringify(ST.scores || {}));
    PROJECTS[ACTIVE_PID].prompts = JSON.parse(JSON.stringify(ST.prompts || {}));
    PROJECTS[ACTIVE_PID].batches = JSON.parse(JSON.stringify(ST.batches || []));
    PROJECTS[ACTIVE_PID].usedSets = JSON.parse(JSON.stringify(ST.usedSets || {}));
    PROJECTS[ACTIVE_PID].setRatings = JSON.parse(JSON.stringify(ST.setRatings || {}));
    PROJECTS[ACTIVE_PID].ratingBatches = JSON.parse(JSON.stringify(ST.ratingBatches || []));
    PROJECTS[ACTIVE_PID].myRatings = JSON.parse(JSON.stringify(ST.myRatings || {}));
    PROJECTS[ACTIVE_PID].covered = JSON.parse(JSON.stringify(ST.covered || {}));
    try {
      localStorage.setItem(PROJ_KEY, JSON.stringify({ active: ACTIVE_PID, projects: PROJECTS }));
    } catch {}
  }

  // 2. Set new active PID
  ACTIVE_PID = pid;
  localStorage.setItem('br_last_active_pid', pid);

  // 3. Deep-clone the project data to prevent reference bleeding between scripts
  const proj = PROJECTS[pid];
  ST.scores            = JSON.parse(JSON.stringify(proj.scores || {}));
  ST.prompts           = JSON.parse(JSON.stringify(_migratePrompts(proj.prompts)));
  ST.batches           = JSON.parse(JSON.stringify(proj.batches || []));
  ST.usedSets          = JSON.parse(JSON.stringify(proj.usedSets || {}));
  ST.setRatings        = JSON.parse(JSON.stringify(_migrateSetRatings(proj.setRatings)));
  ST.ratingBatches     = JSON.parse(JSON.stringify(proj.ratingBatches || []));
  ST.myRatings         = JSON.parse(JSON.stringify(proj.myRatings || {}));
  ST.covered           = JSON.parse(JSON.stringify(_migrateCovered(proj.covered)));
  ST.bengaliScript     = proj.bengaliScript || '';
  ST.bengaliLines      = JSON.parse(JSON.stringify(proj.bengaliLines || parseAltScript(proj.bengaliScript || '')));
  ST.activeRatingBatch = 'new';
  ST.brolls            = parseScript(proj.script || '');

  // 4. Update UI
  ST.filterTarget = 'main'; ST.filter = 'all'; ST.sortBy = 'num'; ST.activeBatch = 'new';
  _el('fb-target-main')?.classList.add('active');
  _el('fb-target-real')?.classList.remove('active');
  const ta = _el('script-textarea'); if (ta) ta.value = proj.script || '';
  const bnTa = _el('script-bengali-textarea'); if (bnTa) bnTa.value = proj.bengaliScript || '';
  renderFilterChips();
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'num'));
  if (ST.brolls.length) collapseInput(); else expandInput();
  H.stack = []; H.pos = -1; refreshUR();
  renderProjectTabs();
  renderHeatmap(); renderStats(); renderCards(true); updateAllPromptChips();
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge(); syncCsetUI();
  updateSratingHint(); renderRatingTabs(); renderRatingPanel();
  renderBackupsListUI();

  updateLineCopyPreview();
  scrollToLastScoredBroll();
}


function createProject() {
  const defaultNum = Object.keys(PROJECTS).length + 1;
  const defaultName = `Script ${defaultNum}`;
  showModal(
    'Add New Script',
    `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
       <label style="font-size:12px;color:var(--text-2);">Script Name:</label>
       <input type="text" id="new-script-name-input" class="p-opt-input" style="width:100%;box-sizing:border-box;font-size:14px;padding:8px;" value="${defaultName}" />
     </div>`,
    () => {
      const inp = _el('new-script-name-input');
      const chosenName = (inp && inp.value.trim()) ? inp.value.trim() : defaultName;
      createProjectBackup('Before Create Script');

      // Save current project first
      saveProjects(true);

      // Create new empty project structure
      const pid = uid();
      PROJECTS[pid] = _projData(chosenName);

      // Switch to new project cleanly
      activateProject(pid);

      // Persist newly created project to local & cloud immediately
      saveProjects(true);

      expandInput();
      setTimeout(() => _el('script-textarea')?.focus(), 50);
      toast(`✅ "${chosenName}" created`);
    },
    null,
    'Create Script',
    'Cancel',
    'primary'
  );
  setTimeout(() => {
    const inp = _el('new-script-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
}

function deleteProject(pid) {
  if (Object.keys(PROJECTS).length <= 1) { toast('⚠️ Cannot delete the only script'); return; }
  const name = PROJECTS[pid]?.name || 'Script';
  createProjectBackup(`Before Delete ${name}`);
  delete PROJECTS[pid];
  saveProjects(true);
  if (ACTIVE_PID === pid) { activateProject(Object.keys(PROJECTS)[0]); }
  else { renderProjectTabs(); }
  toast(`🗑 Deleted "${name}"`);
}

function promptRenameProject(pid) {
  if (!PROJECTS[pid]) return;
  const old = PROJECTS[pid].name || 'Script';
  showModal(
    'Rename Script',
    `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
       <label style="font-size:12px;color:var(--text-2);">Script Name:</label>
       <input type="text" id="rename-script-input" class="p-opt-input" style="width:100%;box-sizing:border-box;font-size:14px;padding:8px;" value="${escHtml(old)}" />
     </div>`,
    () => {
      const inp = _el('rename-script-input');
      const newName = (inp && inp.value.trim()) ? inp.value.trim() : old;
      renameProject(pid, newName);
    },
    null,
    'Save Name',
    'Cancel',
    'primary'
  );
  setTimeout(() => {
    const inp = _el('rename-script-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
}

function renameProject(pid, newName) {
  if (!PROJECTS[pid] || !newName || !newName.trim()) return;
  PROJECTS[pid].name = newName.trim();
  saveProjects(true); // Immediate write & Firebase push
  renderProjectTabs();
  toast(`✏️ Renamed to "${PROJECTS[pid].name}"`);
}

function renderProjectTabs() {
  const bar = _el('project-bar'); if (!bar) return;
  bar.innerHTML = '';
  const pids = Object.keys(PROJECTS);
  pids.forEach(pid => {
    const proj = PROJECTS[pid];
    const isActive = pid === ACTIVE_PID;
    const tab = document.createElement('div');
    tab.className = 'proj-tab' + (isActive ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

    const nameEl = document.createElement('span');
    nameEl.className = 'proj-tab-name';
    nameEl.textContent = proj.name;
    nameEl.title = 'Double-click or right-click to rename';
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      promptRenameProject(pid);
    });
    tab.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      promptRenameProject(pid);
    });
    tab.appendChild(nameEl);

    /* clip count badge */
    const cnt = isActive ? ST.brolls.length : parseScript(proj.script || '').length;
    if (cnt > 0) {
      const badge = document.createElement('span');
      badge.className = 'proj-tab-badge'; badge.textContent = cnt;
      tab.appendChild(badge);
    }

    /* delete button (only if >1 project) */
    if (pids.length > 1) {
      const del = document.createElement('span');
      del.className = 'proj-tab-del'; del.textContent = '×';
      del.title = `Delete "${proj.name}"`;
      del.addEventListener('click', e => {
        e.stopPropagation();
        showModal(`Delete "${proj.name}"?`, 'All scores, prompts and batches will be removed.', () => deleteProject(pid));
      });
      tab.appendChild(del);
    }
    if (!isActive) tab.addEventListener('click', () => activateProject(pid));
    bar.appendChild(tab);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'proj-add-btn';
  addBtn.innerHTML = '<span>＋</span>';
  addBtn.title = 'Create new script';
  addBtn.addEventListener('click', createProject);
  bar.appendChild(addBtn);
}




/* ── Rating Colors for AI Prompt Sets ─────────────────────────── */
function getRatingColor(score) {
  if (score === null || score === undefined || score === '') return null;
  const s = parseFloat(score);
  if (isNaN(s)) return null;
  if (s >= 10)  return { border: '#9333ea', bg: 'rgba(147,51,234,0.15)', text: '#c084fc' }; // 10 is purple
  if (s >= 9.5) return { border: '#2563eb', bg: 'rgba(37,99,235,0.15)',  text: '#60a5fa' }; // 9.5 is blue
  if (s >= 9.0) return { border: '#16a34a', bg: 'rgba(22,163,74,0.15)',  text: '#4ade80' }; // 9 is green
  return null; // below 9 = no color
}

/* ── Real Rating Colors (Same as Main Rating bar palette + 0 Purple) ── */
function getMyRatingColor(score) {
  if (score === null || score === undefined || score === '') return null;
  const s = parseFloat(score);
  if (isNaN(s)) return null;

  // Real Rating 0: Purple (retry / model glitch)
  if (s === 0) {
    return {
      bg: '#3b0764',
      border: '#9333ea',
      glow: 'rgba(147,51,234,0.55)',
      text: '#c084fc',
      isRetry0: true
    };
  }

  const col = getC(s);
  let textColor = '#eaeaf5';
  if (s >= 9) textColor = '#4ade80';        // 9 and above: green
  else if (s >= 8.5) textColor = '#fde047';  // 8.5: yellow
  else if (s >= 8) textColor = '#fb923c';    // 8: orange
  else if (s > 0) textColor = '#f87171';     // below 8: red

  return {
    bg: col.bg,
    border: col.border,
    glow: col.glow,
    text: textColor
  };
}




/* ── Set Ratings: parse, apply, delete, tabs & panels ────────── */
function getSetRatingsList(num, setIdx) {
  const r = ST.setRatings?.[num]?.[setIdx];
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (typeof r === 'object' && r.score !== undefined) return [r];
  return [];
}

function getSetRatingSummary(num, setIdx) {
  const list = getSetRatingsList(num, setIdx);
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + (parseFloat(item.score) || 0), 0);
  const avg = Number((total / list.length).toFixed(1));
  const tenCount = list.filter(item => (parseFloat(item.score) || 0) >= 10).length;
  const isMajorityTen = (tenCount / list.length) >= 0.5;

  // If at least 50% of AI ratings gave 10/10, elevate color tier to purple
  let rColor = getRatingColor(avg);
  if (isMajorityTen) {
    rColor = getRatingColor(10);
  }

  return {
    ratings: list,
    count: list.length,
    avgScore: avg,
    tenCount,
    isMajorityTen,
    color: rColor
  };
}

/* ── My Personal Ratings (Training Database) ─────────────────── */
function parseMyRatingInput(str) {
  if (!str || !str.trim()) return null;
  let trimmed = str.trim();
  // Support comma as decimal separator (e.g. 8,5 -> 8.5)
  trimmed = trimmed.replace(/^(\d+),(\d+)/, '$1.$2');
  // Match score: leading number/decimal (e.g. 8.8, 10, 0, .5) followed by optional comment
  const m = trimmed.match(/^([+\-]?\d*\.?\d+)(?:\s*[:\-–,]?\s*(.*))?$/s);
  if (!m || !m[1]) return null;
  const score = parseFloat(m[1]);
  if (isNaN(score)) return null;
  let comment = (m[2] || '').trim();
  comment = comment.replace(/^[:\-–,]\s*/, '').trim();
  return { score, comment };
}

function getMyRating(num, setIdx) {
  return ST.myRatings?.[num]?.[setIdx] ?? null;
}

function updateDoneBtnUI(num) {
  const doneBtn = _el(`done-btn-${num}`);
  if (!doneBtn) return;
  const isCov = !!(ST.covered && ST.covered[num]);
  doneBtn.className = 'c-done-btn' + (isCov ? ' active' : '');
  doneBtn.innerHTML = isCov ? '✔' : '◻';
  doneBtn.title = isCov
    ? `B-roll #${num} is Done (9+ in Overview)\nClick to unmark`
    : `Mark B-roll #${num} as Done (9+ in Overview)`;
}

function saveMyRating(num, setIdx, score, comment) {
  const old = getMyRating(num, setIdx);
  const parsedScore = parseFloat(score);
  const newComment = comment || '';
  const oldCovered = !!(ST.covered && ST.covered[num]);
  const newCovered = (parsedScore >= 9) ? true : oldCovered;

  const apply = (val, cov) => {
    if (!ST.myRatings) ST.myRatings = {};
    if (val === null) {
      if (ST.myRatings[num]) {
        delete ST.myRatings[num][setIdx];
        if (!Object.keys(ST.myRatings[num]).length) delete ST.myRatings[num];
      }
    } else {
      if (!ST.myRatings[num]) ST.myRatings[num] = {};
      ST.myRatings[num][setIdx] = { score: val.score, comment: val.comment, date: val.date || Date.now() };
    }
    if (!ST.covered) ST.covered = {};
    if (cov) ST.covered[num] = true; else delete ST.covered[num];
    save(true);
    updateCardPrompts(num);
    updateDoneBtnUI(num);
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    updateLineCopyPreview();

  };

  record(
    () => apply(old, oldCovered),
    () => apply({ score: parsedScore, comment: newComment }, newCovered),
    `Real Rating #${num} Set ${setIdx+1}: ${parsedScore}`
  );
  apply({ score: parsedScore, comment: newComment }, newCovered);
}

function deleteMyRating(num, setIdx) {
  const old = getMyRating(num, setIdx);
  if (!old) return;
  const oldCovered = !!(ST.covered && ST.covered[num]);

  const apply = (val) => {
    if (!ST.myRatings) ST.myRatings = {};
    if (val === null) {
      if (ST.myRatings[num]) {
        delete ST.myRatings[num][setIdx];
        if (!Object.keys(ST.myRatings[num]).length) delete ST.myRatings[num];
      }
    } else {
      if (!ST.myRatings[num]) ST.myRatings[num] = {};
      ST.myRatings[num][setIdx] = { score: val.score, comment: val.comment, date: val.date || Date.now() };
    }
    save(true);
    updateCardPrompts(num);
    updateDoneBtnUI(num);
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    updateLineCopyPreview();

  };

  record(
    () => apply(old),
    () => apply(null),
    `Delete Real Rating #${num} Set ${setIdx+1}`
  );
  apply(null);
}




function updateMyDbBadge() { /* removed */ }


/* ── My Rating Modal ─────────────────────────────────────────── */
let _myRatingModal = null;
let _ignoreScrollSyncUntil = 0;

function closeMyRatingModal() {
  document.querySelectorAll('.myrating-modal').forEach(m => m.remove());
  _myRatingModal = null;
  _ignoreScrollSyncUntil = Date.now() + 350;
}

function toggleCoveredClip(num) {
  if (!ST.covered) ST.covered = {};
  const oldVal = !!ST.covered[num];
  const newVal = !oldVal;

  const apply = (val) => {
    if (!ST.covered) ST.covered = {};
    if (val) ST.covered[num] = true;
    else delete ST.covered[num];
    save(true);
    updateCardPrompts(num);
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    updateLineCopyPreview();
  };

  record(
    () => apply(oldVal),
    () => apply(newVal),
    newVal ? `Done #${num}` : `Unmark Done #${num}`
  );
  apply(newVal);
  toast(newVal ? `✔ B-roll #${num} marked as Done (9+ in Overview)` : `↺ B-roll #${num} unmarked as Done`);
}



function showMyRatingModal(triggerEl, num, setIdx) {
  closeMyRatingModal();
  _ignoreScrollSyncUntil = Date.now() + 700;
  highlightActiveBroll(num);

  const existing = getMyRating(num, setIdx);
  const entry = (ST.prompts[num]||[])[setIdx];
  const broll = ST.brolls.find(b => b.num === num);
  const promptText = entry ? entry.text : '';
  const brollLine = broll ? broll.line : `B-roll #${num}`;
  const isCovered = !!(ST.covered && ST.covered[num]);

  const modal = document.createElement('div');
  modal.className = 'myrating-modal';
  _myRatingModal = modal;

  // Position near trigger
  const rect = triggerEl.getBoundingClientRect();
  const top = Math.min(rect.bottom + 8, window.innerHeight - 340);
  const left = Math.min(rect.left, window.innerWidth - 310);
  modal.style.cssText = `top:${top + window.scrollY}px;left:${Math.max(8, left)}px`;

  const existingVal = existing ? (existing.score + (existing.comment ? ' ' + existing.comment : '')) : '';

  modal.innerHTML = `
    <div class="myrating-modal-hdr">
      <span class="myrating-modal-title">✏ My Rating — #${num} Set ${setIdx+1}</span>
      <button class="myrating-close" id="myrating-close">✕</button>
    </div>
    <div class="myrating-context">
      <div class="myrating-broll-line">📽 ${escHtml(brollLine)}</div>
      <div class="myrating-prompt-text">${escHtml(promptText.slice(0,200))}${promptText.length>200?'…':''}</div>
    </div>
    <div class="myrating-input-row">
      <input class="myrating-input" id="myrating-input" type="text"
        placeholder="8.8 perfect cinematic"
        value="${escHtml(existingVal)}">
    </div>
    <div class="myrating-hint">Format: <code>8.8 comment</code> &nbsp;·&nbsp; Comment is optional</div>
    <div class="myrating-actions">
      <button class="hbtn primary" id="myrating-save">✔ Save</button>
      ${existing ? `<button class="hbtn danger" id="myrating-delete">🗑 Delete</button>` : ''}
      <button class="hbtn" id="myrating-cancel">✕ Cancel</button>
    </div>
  `;


  document.body.appendChild(modal);

  const input = _el('myrating-input');
  setTimeout(() => {
    try {
      input?.focus({ preventScroll: true });
      input?.select();
    } catch {
      input?.focus();
    }
  }, 60);

  const doSave = () => {
    const val = input ? input.value.trim() : '';
    const parsed = parseMyRatingInput(val);
    if (!parsed) { toast('⚠️ Enter a score (e.g. 8.8 or 8.8 great shot)'); return; }
    closeMyRatingModal();
    saveMyRating(num, setIdx, parsed.score, parsed.comment);
    toast(`✔ Rated #${num} Set ${setIdx+1}: ${parsed.score}`);
  };



  _el('myrating-close')?.addEventListener('click', closeMyRatingModal);
  _el('myrating-cancel')?.addEventListener('click', closeMyRatingModal);
  _el('myrating-delete')?.addEventListener('click', () => {
    closeMyRatingModal();
    deleteMyRating(num, setIdx);
    toast(`🗑 Deleted rating for #${num} Set ${setIdx+1}`);
  });
  _el('myrating-save')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    doSave();
  });

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      doSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMyRatingModal();
    }
  });

  // Close on outside click
  setTimeout(() => {
    const outsideClick = (ev) => {
      if (!modal.contains(ev.target)) {
        closeMyRatingModal();
        document.removeEventListener('mousedown', outsideClick);
        document.removeEventListener('touchstart', outsideClick);
      }
    };
    document.addEventListener('mousedown', outsideClick);
    document.addEventListener('touchstart', outsideClick, { passive: true });
  }, 100);
}




function parseSetRatings(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) continue;

    // Format 1: 14S6: 9.5 (why) or 14S6 : 9.5 : why or 14S6 - 9.5 - why
    let m = l.match(/^#?(\d+)\s*[Ss]\s*(\d+)\s*[:\-–,]?\s*([\d.]+)\s*(?:[:\-–,]?\s*(.*))?$/);
    if (m) {
      const score = parseFloat(m[3]);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        let why = (m[4] || '').trim();
        if (why.startsWith('(') && why.endsWith(')')) why = why.slice(1, -1).trim();
        results.push({ brollNum: parseInt(m[1]), rawSetNum: parseInt(m[2]), score, why });
        continue;
      }
    }

    // Format 2: 1 : 6 : 9.5 : why or 1 : 6 - 9.5 - why or 1.6 : 9.5 : why
    m = l.match(/^#?(\d+)\s*[:\.]\s*(\d+)\s*[:\-–,]?\s*([\d.]+)\s*(?:[:\-–,]?\s*(.*))?$/);
    if (m) {
      const score = parseFloat(m[3]);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        let why = (m[4] || '').trim();
        if (why.startsWith('(') && why.endsWith(')')) why = why.slice(1, -1).trim();
        results.push({ brollNum: parseInt(m[1]), rawSetNum: parseInt(m[2]), score, why });
        continue;
      }
    }

    // Format 3: B-roll 1 Set 6: 9.5 (why) or BROLL 1 ALT 6: 9.5 (why)
    m = l.match(/^(?:broll|b-roll|clip)?\s*#?(\d+)\s*(?:set|alt|prompt|s)?\s*#?(\d+)\s*[:\-–,]?\s*([\d.]+)\s*(?:[:\-–,]?\s*(.*))?$/i);
    if (m) {
      const score = parseFloat(m[3]);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        let why = (m[4] || '').trim();
        if (why.startsWith('(') && why.endsWith(')')) why = why.slice(1, -1).trim();
        results.push({ brollNum: parseInt(m[1]), rawSetNum: parseInt(m[2]), score, why });
        continue;
      }
    }
  }
  return results;
}

function requestApplySetRatings(text) {
  const parsed = parseSetRatings(text);
  if (!parsed.length) { toast('⚠️ No valid rating lines found'); return; }

  const ratingsByBroll = {};
  parsed.forEach(item => {
    if (!ratingsByBroll[item.brollNum]) ratingsByBroll[item.brollNum] = [];
    ratingsByBroll[item.brollNum].push(item);
  });

  const brollNums = Object.keys(ratingsByBroll).map(Number).sort((a, b) => a - b);
  const summaryLines = [];

  for (const num of brollNums) {
    const items = ratingsByBroll[num];
    const sets = items.map(x => x.rawSetNum);
    summaryLines.push(`BROLL ${num} : SET ${sets.join(', ')} : ${items.length} TOTAL`);
  }

  const summaryText = summaryLines.join('\n');
  const minN = Math.min(...brollNums), maxN = Math.max(...brollNums);
  const tabLabel = minN === maxN ? `#${minN}` : `#${minN}–${maxN}`;

  showModal(
    `⭐ Confirm Rating Import — ${tabLabel}`,
    `<div style="font-size:12.5px;line-height:1.5">
       <p style="margin-bottom:8px;color:var(--text-2);">Summary of ratings to be applied:</p>
       <div class="import-summary-pre">${escHtml(summaryText)}</div>
       <p style="margin-top:8px;font-size:12px;font-weight:700;color:var(--accent);">TOTAL: ${parsed.length} Ratings across ${brollNums.length} B-rolls</p>
     </div>`,
    () => {
      applySetRatings(text, parsed, ratingsByBroll, brollNums, tabLabel);
    },
    () => {
      const ta = _el('srating-textarea');
      if (ta) ta.value = '';
      toast('✕ Rating import cancelled & input cleared');
    },
    '✔ Confirm & Apply',
    '✕ Reject & Clear',
    'primary'
  );
}

function applySetRatings(text, parsed, ratingsByBroll, brollsInBatch, tabLabel) {
  createProjectBackup(`Before Rating Import ${tabLabel}`);
  if (!ST.setRatings) ST.setRatings = {};
  if (!ST.ratingBatches) ST.ratingBatches = [];

  const batchId = uid();

  for (const [brollNumStr, items] of Object.entries(ratingsByBroll)) {
    const brollNum = parseInt(brollNumStr);
    if (!ST.setRatings[brollNum]) ST.setRatings[brollNum] = {};

    const prompts = ST.prompts[brollNum] || [];
    const totalPrompts = prompts.length;
    const maxRawSet = Math.max(...items.map(x => x.rawSetNum));

    // Intelligent offset for multi-batch ratings:
    let offset = 0;
    if (maxRawSet <= 6 && totalPrompts > 6) {
      for (let i = 0; i < totalPrompts; i += 6) {
        const hasRating = getSetRatingsList(brollNum, i).length > 0;
        if (!hasRating) {
          offset = i;
          break;
        }
      }
      if (offset === 0 && totalPrompts > items.length) {
        const lastBatchId = prompts[totalPrompts - 1]?.batchId;
        const firstIdxOfLastBatch = prompts.findIndex(p => p.batchId === lastBatchId);
        if (firstIdxOfLastBatch > 0) {
          offset = firstIdxOfLastBatch;
        }
      }
    }

    items.forEach(item => {
      let setIdx = (item.rawSetNum - 1) + offset;
      item.setIdx = setIdx;

      const existing = getSetRatingsList(brollNum, setIdx);
      existing.push({ score: item.score, why: item.why, batchId, date: Date.now() });
      ST.setRatings[brollNum][setIdx] = existing;
    });
  }

  const setsByBroll = {};
  for (const [brollNumStr, items] of Object.entries(ratingsByBroll)) {
    const brollNum = parseInt(brollNumStr);
    setsByBroll[brollNum] = items.map(x => x.setIdx);
  }

  ST.ratingBatches.push({
    id: batchId,
    label: tabLabel,
    date: Date.now(),
    raw: text,
    brolls: brollsInBatch,
    setsByBroll,
    count: parsed.length
  });

  // Stay on 'new' input tab and clear input textarea ready for next import
  ST.activeRatingBatch = 'new';
  const ta = _el('srating-textarea');
  if (ta) ta.value = '';

  save(true);
  updateAllPromptChips();
  updateSratingHint();
  renderRatingTabs();
  renderRatingPanel();

  toast(`⭐ Applied ${parsed.length} ratings for B-roll ${tabLabel}`);
}




function deleteSetRating(num, setIdx, ratingItemIdx = null) {
  if (!ST.setRatings?.[num] || ST.setRatings[num][setIdx] === undefined) return;
  const list = getSetRatingsList(num, setIdx);

  if (ratingItemIdx === null || list.length <= 1) {
    delete ST.setRatings[num][setIdx];
    if (!Object.keys(ST.setRatings[num]).length) delete ST.setRatings[num];
  } else {
    if (ratingItemIdx >= 0 && ratingItemIdx < list.length) {
      list.splice(ratingItemIdx, 1);
      ST.setRatings[num][setIdx] = list;
    }
  }

  save();
  updateAllPromptChips();
  updateSratingHint();
  renderRatingPanel();
  toast(ratingItemIdx === null ? `🗑 Removed ratings for #${num} Set ${setIdx+1}` : `🗑 Removed rating entry for #${num} Set ${setIdx+1}`);
}

function updateSratingHint() {
  let total = 0;
  let brolls = 0;
  if (ST.setRatings) {
    for (const [num, sets] of Object.entries(ST.setRatings)) {
      let hasR = false;
      for (const [idx, r] of Object.entries(sets || {})) {
        const list = getSetRatingsList(num, idx);
        if (list.length) {
          total += list.length;
          hasR = true;
        }
      }
      if (hasR) brolls++;
    }
  }
  const hint = _el('srating-hint');
  if (hint) {
    hint.textContent = total ? `${total} rating${total !== 1 ? 's' : ''}` : '0 ratings';
    hint.className = 'srating-hint' + (total ? ' active' : '');
  }
  const summary = _el('srating-summary');
  if (summary && total) {
    summary.textContent = `${total} rating${total!==1?'s':''} across ${brolls} B-roll${brolls!==1?'s':''}`;
  } else if (summary) { summary.textContent = ''; }
}

/* ── Rating Tabs & Detail Panel (matches Prompt Library design) ── */
function renderRatingTabs() {
  const bar = _el('srating-tab-bar'); if (!bar) return;
  bar.innerHTML = '';

  const newTab = document.createElement('button');
  newTab.className = 'batch-tab' + (ST.activeRatingBatch === 'new' ? ' active' : '');
  newTab.innerHTML = '<span>＋ New Import</span>';
  newTab.addEventListener('click', () => switchRatingTab('new'));
  bar.appendChild(newTab);

  [...(ST.ratingBatches || [])].reverse().forEach(b => {
    const tab = document.createElement('button');
    tab.className = 'batch-tab' + (ST.activeRatingBatch === b.id ? ' active' : '');
    const lbl = document.createElement('span'); lbl.className = 'btab-label'; lbl.textContent = b.label; tab.appendChild(lbl);
    const del = document.createElement('span'); del.className = 'btab-del'; del.textContent = '×'; del.title = 'Delete rating batch';
    del.addEventListener('click', e => { e.stopPropagation(); showDeleteRatingBatchModal(b.id); });
    tab.appendChild(del);
    tab.addEventListener('click', () => switchRatingTab(b.id));
    bar.appendChild(tab);
  });
}

/* ── Batch Sets Helper (100% Precise) ───────────────────────── */
function getBatchSetsForBroll(batch, num) {
  if (!batch) return null;
  // 1. If batch has setsByBroll
  if (batch.setsByBroll && Array.isArray(batch.setsByBroll[num]) && batch.setsByBroll[num].length > 0) {
    return batch.setsByBroll[num];
  }
  // 2. Check ST.setRatings[num] for items with r.batchId === batch.id
  const sets = ST.setRatings[num] || {};
  const matched = Object.keys(sets)
    .map(Number)
    .filter(idx => getSetRatingsList(num, idx).some(r => r.batchId === batch.id));
  if (matched.length > 0) return matched.sort((a, b) => a - b);

  // 3. Parse batch.raw if available
  if (batch.raw) {
    try {
      const parsed = parseSetRatings(batch.raw);
      const forThisBroll = parsed.filter(x => x.brollNum === num);
      if (forThisBroll.length > 0) {
        const rawIndices = forThisBroll.map(x => x.rawSetNum - 1);
        return Array.from(new Set(rawIndices)).sort((a, b) => a - b);
      }
    } catch {}
  }

  // 4. Default: return first 6 set indices if sets exist
  const allIndices = Object.keys(sets).map(Number).sort((a, b) => a - b);
  return allIndices.slice(0, 6);
}

function switchRatingTab(batchId) {
  ST.activeRatingBatch = batchId;
  renderRatingTabs();
  if (batchId === 'new') {
    ST.activeRatingBatchFilter = null;
    renderRatingPanel();
    const banner = document.getElementById('batch-filter-banner');
    if (banner) banner.remove();
  } else {
    ST.activeRatingBatchFilter = batchId;
    switchBottomTab('p');
    renderCards();
    const firstCard = document.querySelector('.broll-card');
    if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`⭐ Opened Rating Batch ${batchId} on Prompts page`);
  }
}

/* ── Bottom Tab Switcher (Global) ─────────────────────────── */
function switchBottomTab(tab) {
  document.querySelectorAll('.btab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== `tab-panel-${tab}`));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function renderRatingPanel() {
  const np = _el('srating-panel-new'), dp = _el('srating-panel-detail');
  if (!np || !dp) return;
  np.classList.remove('hidden');
  dp.classList.add('hidden');
}





function showDeleteRatingBatchModal(batchId) {
  const b = (ST.ratingBatches || []).find(x => x.id === batchId); if (!b) return;
  showModal(`Delete "${b.label}" ratings?`,
    `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
      <input type="checkbox" id="modal-del-ratings" checked style="width:14px;height:14px;accent-color:var(--accent)">
      <span>Also remove ratings from cards for these B-rolls</span>
    </label>`,
    () => deleteRatingBatch(batchId, _el('modal-del-ratings')?.checked)
  );
}

function deleteRatingBatch(batchId, delRatings) {
  const b = (ST.ratingBatches || []).find(x => x.id === batchId);
  if (delRatings && b && ST.setRatings) {
    for (const [num, sets] of Object.entries(ST.setRatings)) {
      if (!sets || typeof sets !== 'object') continue;
      for (const [setIdx, list] of Object.entries(sets)) {
        if (Array.isArray(list)) {
          const filtered = list.filter(r => r.batchId !== batchId);
          if (filtered.length) sets[setIdx] = filtered;
          else delete sets[setIdx];
        }
      }
      if (!Object.keys(sets).length) delete ST.setRatings[num];
    }
    updateAllPromptChips();
  }
  ST.ratingBatches = (ST.ratingBatches || []).filter(x => x.id !== batchId);
  if (ST.activeRatingBatch === batchId) switchRatingTab('new');
  save(true);
  renderRatingTabs();
  updateSratingHint();
  toast(delRatings ? '🗑 Rating batch + ratings removed' : '🗑 Rating batch removed (ratings kept)');
}


/* ── Why Popup (shows all ratings & reasons) ─────────────────── */
function showWhyPopup(e, num, setIdx) {
  document.getElementById('why-popup')?.remove();
  const summary = getSetRatingSummary(num, setIdx);
  const ratings = summary ? summary.ratings : [];
  const rColor = summary ? summary.color : null;

  const popup = document.createElement('div');
  popup.id = 'why-popup';
  popup.className = 'why-popup';

  const hdr = document.createElement('div');
  hdr.className = 'why-popup-hdr';

  const sb = document.createElement('span');
  sb.className = 'why-score-badge';
  if (summary) {
    sb.textContent = summary.avgScore;
    sb.style.color = rColor ? rColor.text : 'var(--text-2)';
    if (summary.count > 1) {
      sb.title = `Average of ${summary.count} ratings`;
    }
  } else {
    sb.textContent = '—';
    sb.style.color = 'var(--text-3)';
  }
  hdr.appendChild(sb);

  const hdrText = document.createElement('div');
  hdrText.className = 'why-hdr-text';

  const lbl = document.createElement('span');
  lbl.className = 'why-popup-label';
  lbl.textContent = `Set ${setIdx+1} for #${num}`;
  hdrText.appendChild(lbl);

  if (summary && summary.count > 1) {
    const sub = document.createElement('span');
    sub.className = 'why-popup-sub';
    sub.textContent = `${summary.count} AI ratings (Avg: ${summary.avgScore})`;
    hdrText.appendChild(sub);
  }
  hdr.appendChild(hdrText);

  if (ratings.length) {
    const delAllBtn = document.createElement('button');
    delAllBtn.className = 'why-del-btn';
    delAllBtn.textContent = '🗑';
    delAllBtn.title = ratings.length > 1 ? 'Remove all ratings for this set' : 'Remove this rating';
    delAllBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      deleteSetRating(num, setIdx);
      popup.remove();
    });
    hdr.appendChild(delAllBtn);
  }

  const cls = document.createElement('button');
  cls.className = 'why-close';
  cls.textContent = '×';
  cls.title = 'Close';
  cls.addEventListener('click', () => popup.remove());
  hdr.appendChild(cls);
  popup.appendChild(hdr);

  const listWrap = document.createElement('div');
  listWrap.className = 'why-body-list';

  if (!ratings.length) {
    const empty = document.createElement('div');
    empty.className = 'why-body';
    empty.textContent = 'No rating recorded for this set yet.';
    listWrap.appendChild(empty);
  } else {
    ratings.forEach((item, rIdx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'why-item';

      const itemHdr = document.createElement('div');
      itemHdr.className = 'why-item-hdr';

      const iColor = getRatingColor(item.score);
      const scoreTag = document.createElement('span');
      scoreTag.className = 'why-item-score';
      scoreTag.textContent = item.score;
      if (iColor) {
        scoreTag.style.borderColor = iColor.border;
        scoreTag.style.color = iColor.text;
        scoreTag.style.background = iColor.bg;
      } else {
        scoreTag.style.borderColor = 'var(--border)';
        scoreTag.style.color = 'var(--text-2)';
        scoreTag.style.background = 'var(--bg-3)';
      }
      itemHdr.appendChild(scoreTag);

      const tagLbl = document.createElement('span');
      tagLbl.className = 'why-item-label';
      tagLbl.textContent = ratings.length > 1 ? `Rating #${rIdx+1}` : `Reason`;
      itemHdr.appendChild(tagLbl);

      if (ratings.length > 1) {
        const itemDelBtn = document.createElement('button');
        itemDelBtn.className = 'why-item-del';
        itemDelBtn.textContent = '✕';
        itemDelBtn.title = 'Remove this rating entry';
        itemDelBtn.addEventListener('click', ev => {
          ev.stopPropagation();
          deleteSetRating(num, setIdx, rIdx);
          showWhyPopup(e, num, setIdx);
        });
        itemHdr.appendChild(itemDelBtn);
      }

      itemEl.appendChild(itemHdr);

      const itemText = document.createElement('div');
      itemText.className = 'why-item-text';
      itemText.textContent = item.why || 'No explanation text provided.';
      itemEl.appendChild(itemText);

      listWrap.appendChild(itemEl);
    });
  }

  popup.appendChild(listWrap);

  // Position near chip or mouse cursor / touch coordinates
  const rect = e.currentTarget?.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : null;
  let posX = (e.clientX !== undefined && e.clientX > 0) ? e.clientX : (rect ? rect.left : 20);
  let posY = (rect ? rect.bottom : ((e.clientY !== undefined ? e.clientY : 100))) + 6;
  if (rect) posX = rect.left;

  popup.style.left = Math.max(10, Math.min(posX, window.innerWidth - 325)) + 'px';
  popup.style.top  = Math.max(10, Math.min(posY, window.innerHeight - 260)) + 'px';

  popup.addEventListener('click', ev => ev.stopPropagation());
  document.body.appendChild(popup);

  // Close when clicking anywhere else
  setTimeout(() => {
    document.addEventListener('click', () => document.getElementById('why-popup')?.remove(), { once: true });
  }, 10);
}




/* ── Clear Copy History / Reset Ticks ───────────────────────── */
function clearCopyHistory() {
  const oldPromptsState = JSON.parse(JSON.stringify(ST.prompts));
  const applyReset = () => {
    Object.values(ST.prompts).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(e => { e.copied = false; });
    });
    save(true);
    updateAllPromptChips();
    renderLibraryView();
  };
  const applyRestore = (oldState) => {
    ST.prompts = JSON.parse(JSON.stringify(oldState));
    save(true);
    updateAllPromptChips();
    renderLibraryView();
  };
  record(
    () => applyRestore(oldPromptsState),
    () => applyReset(),
    'Reset all ticks for script'
  );
  applyReset();
  toast('⟲ All ticks reset for this script');
}


/* ── Undo / Redo ────────────────────────────────────────────── */
const H = { stack: [], pos: -1, MAX: 50 };

function record(undoFn, redoFn, desc = '') {
  H.stack.splice(H.pos + 1);
  H.stack.push({ undo: undoFn, redo: redoFn, desc });
  if (H.stack.length > H.MAX) H.stack.shift(); else H.pos++;
  refreshUR();
}
function doUndo() {
  if (H.pos < 0) return;
  const e = H.stack[H.pos]; H.pos--; e.undo(); refreshUR();
  toast(`↩ ${e.desc || 'Undone'}`);
}
function doRedo() {
  if (H.pos >= H.stack.length - 1) return;
  H.pos++; const e = H.stack[H.pos]; e.redo(); refreshUR();
  toast(`↪ ${e.desc || 'Redone'}`);
}
function refreshUR() {
  const u = _el('btn-undo'), r = _el('btn-redo');
  if (u) { u.disabled = H.pos < 0; u.classList.toggle('disabled', H.pos < 0); }
  if (r) { r.disabled = H.pos >= H.stack.length-1; r.classList.toggle('disabled', H.pos >= H.stack.length-1); }
}

/* ── Storage: delegate to saveProjects (defined at line ~372) ─ */

function loadStored() {
  // Now handled via loadProjects() / activateProject()
  const proj = PROJECTS[ACTIVE_PID]||{};
  return {
    scores:   proj.scores   || {},
    prompts:  _migratePrompts(proj.prompts),
    batches:  proj.batches  || [],
    usedSets: proj.usedSets || {},
    prefix:   proj.prefix   || '',
    suffix:   proj.suffix   || '',
    script:   proj.script   || '',
  };
}

/* ── Copy text with prefix/suffix ──────────────────────────── */
function getCopyText(rawText, num, setIdx) {
  const pre = ST.prefix.trim();
  const suf = ST.suffix.trim();
  // Label: e.g. "14S6" — only if enabled
  const label = (ST.labelEnabled && num !== undefined && setIdx !== undefined)
    ? `${num}S${setIdx + 1}`
    : null;

  let prefixBlock = pre;
  if (label) {
    if (prefixBlock) {
      // Added before prefix text on the same line (no extra gap)
      const preLines = prefixBlock.split('\n');
      preLines[0] = label + ' ' + preLines[0];
      prefixBlock = preLines.join('\n');
    } else {
      // If no prefix, label acts as its own prefix line (clean gap before prompt)
      prefixBlock = label;
    }
  }

  let result = rawText;
  if (prefixBlock) result = prefixBlock + '\n\n' + result;
  if (suf) result = result + '\n\n' + suf;
  return result;
}


function updateCsetHint() {
  const pre = ST.prefix.trim(), suf = ST.suffix.trim();
  const hint = _el('cset-hint');
  if (!hint) return;
  const parts = [];
  if (pre) parts.push('prefix');
  if (suf) parts.push('suffix');
  if (ST.labelEnabled) parts.push('tag');
  if (parts.length) {
    hint.textContent = parts.join(' + ');
    hint.className = 'cset-hint active';
  } else {
    hint.textContent = 'off';
    hint.className = 'cset-hint';
  }
}


/* ── Script Parsing ─────────────────────────────────────────── */
function parseScript(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
    .reduce((a, l) => {
      const m = l.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
      if (m) a.push({ num: parseFloat(m[1]), line: m[2].trim() });
      return a;
    }, [])
    .sort((a, b) => a.num - b.num);
}

/* ── Prompt Batch Parsing ───────────────────────────────────── */
function parsePromptBatch(text) {
  const result = {};
  for (const sec of text.split(/(?=BROLL\s+\d+\s*:)/i)) {
    const numM = sec.match(/^BROLL\s+(\d+)\s*:/i); if (!numM) continue;
    const num = parseInt(numM[1]);
    const vpIdx = sec.search(/VIDEO\s+PROMPT\s*:/i); if (vpIdx === -1) continue;
    const chunks = sec.slice(vpIdx).split(/(?:ALT|SET)\s+\d+\s*:/i).slice(1);
    if (!result[num]) result[num] = [];
    for (const c of chunks) { const t = c.trim(); if (t) result[num].push(t); }
  }
  return result;
}

function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function requestImportPrompts(text) {
  const parsed = parsePromptBatch(text);
  const keys   = Object.keys(parsed);
  if (!keys.length) { toast('⚠️ No valid BROLL blocks found'); return; }

  const brollNums = keys.map(Number).sort((a, b) => a - b);
  let totalPrompts = 0;
  const summaryLines = [];

  for (const num of brollNums) {
    const alts = parsed[String(num)] || [];
    const startSet = (ST.prompts[num] || []).length + 1;
    const setNums = alts.map((_, i) => startSet + i);
    totalPrompts += alts.length;
    summaryLines.push(`BROLL ${num} : SET ${setNums.join(', ')} : ${alts.length} TOTAL`);
  }

  const summaryText = summaryLines.join('\n');
  const minN = Math.min(...brollNums), maxN = Math.max(...brollNums);
  const tabLabel = minN === maxN ? `#${minN}` : `#${minN}–${maxN}`;

  showModal(
    `📥 Confirm Library Import — ${tabLabel}`,
    `<div style="font-size:12.5px;line-height:1.5">
       <p style="margin-bottom:8px;color:var(--text-2);">Summary of prompts to be added:</p>
       <div class="import-summary-pre">${escHtml(summaryText)}</div>
       <p style="margin-top:8px;font-size:12px;font-weight:700;color:var(--accent);">TOTAL: ${totalPrompts} Prompts across ${brollNums.length} B-rolls</p>
     </div>`,
    () => {
      applyImportPrompts(parsed, text, brollNums, totalPrompts, tabLabel);
    },
    () => {
      const ta = _el('prompt-textarea');
      if (ta) ta.value = '';
      toast('✕ Import cancelled & input cleared');
    },
    '✔ Confirm & Add',
    '✕ Reject & Clear',
    'primary'
  );
}

function applyImportPrompts(parsed, text, brollNums, total, tabLabel) {
  createProjectBackup(`Before Prompt Import ${tabLabel}`);
  const batchId = uid();
  const rawBlocks = [];

  for (const num of brollNums) {
    const alts = parsed[String(num)] || [];
    if (!ST.prompts[num]) ST.prompts[num] = [];
    const startSet = ST.prompts[num].length + 1;

    const blockLines = [`BROLL ${num}:`, 'VIDEO PROMPT:'];

    alts.forEach((t, i) => {
      const setNo = startSet + i;
      ST.prompts[num].push({ text: t, batchId, copied: false });
      blockLines.push(`SET ${setNo}: ${t}`);
    });

    rawBlocks.push(blockLines.join('\n'));
  }

  const formattedRaw = rawBlocks.join('\n\n');

  ST.batches.push({
    id: batchId,
    label: tabLabel,
    date: Date.now(),
    raw: formattedRaw,
    brollCount: brollNums.length,
    promptCount: total
  });

  // Stay on 'new' input tab and clear input textarea ready for next import
  ST.activeBatch = 'new';
  const ta = _el('prompt-textarea');
  if (ta) ta.value = '';

  save(true);
  renderBatchTabs();
  renderBatchPanel();
  updateAllPromptChips();
  renderLibraryView();
  updateLibBadge();

  toast(`✅ Imported ${total} prompts across ${brollNums.length} B-rolls`);
}





function deleteBatch(batchId, delPrompts) {
  if (delPrompts) {
    for (const num of Object.keys(ST.prompts)) {
      ST.prompts[num] = (ST.prompts[num]||[]).filter(p => p.batchId !== batchId);
      if (!ST.prompts[num].length) delete ST.prompts[num];
    }
    updateAllPromptChips(); renderLibraryView();
  }
  ST.batches = ST.batches.filter(b => b.id !== batchId);
  if (ST.activeBatch === batchId) switchBatchTab('new');
  save(); renderBatchTabs(); updateLibBadge();
  toast(delPrompts ? '🗑 Batch + prompts deleted' : '🗑 Batch removed (prompts kept)');
}

/* ── Delete individual prompt ───────────────────────────────── */
function deletePromptEntry(num, idx) {
  const arr = ST.prompts[num]; if (!arr || idx >= arr.length) return;
  const removed = arr[idx];
  const oldUsed = ST.usedSets[num];

  record(
    () => {
      if (!ST.prompts[num]) ST.prompts[num] = [];
      ST.prompts[num].splice(idx, 0, removed);
      if (oldUsed !== undefined) ST.usedSets[num] = oldUsed;
      save(); updateCardPrompts(num); renderLibraryView(); updateLibBadge();
    },
    () => {
      ST.prompts[num].splice(idx, 1);
      if (!ST.prompts[num].length) delete ST.prompts[num];
      if (ST.usedSets[num] >= idx) delete ST.usedSets[num];
      save(); updateCardPrompts(num); renderLibraryView(); updateLibBadge();
    },
    `Delete prompt ${idx+1} for #${num}`
  );

  arr.splice(idx, 1);
  if (!arr.length) delete ST.prompts[num];
  if (ST.usedSets[num] !== undefined && ST.usedSets[num] >= idx) delete ST.usedSets[num];
  save(); updateCardPrompts(num); renderLibraryView(); updateLibBadge();
}

/* ── Copy prompt ────────────────────────────────────────────── */
function copyPrompt(num, idx, triggerEl, toggle = true) {
  const entry = (ST.prompts[num]||[])[idx]; if (!entry) return;
  const text = getCopyText(entry.text, num, idx);
  const oldCopied = !!entry.copied;
  const newCopied = toggle ? !oldCopied : true;

  const doFlash = () => {
    const apply = (val) => {
      const e = (ST.prompts[num]||[])[idx];
      if (e) {
        e.copied = val;
        save(true);
        refreshCopyState(num, idx);
      }
    };
    record(
      () => apply(oldCopied),
      () => apply(newCopied),
      newCopied ? `Copy Set ${idx+1} for #${num} (Green)` : `Unmark Set ${idx+1} for #${num}`
    );
    apply(newCopied);
    toast(newCopied ? `📋 Copied Set ${idx+1} for #${num}` : `↺ Set ${idx+1} for #${num} unmarked`);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doFlash).catch(() => fbCopy(text, doFlash));
  } else { fbCopy(text, doFlash); }
}


function fbCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta); cb();
}
function refreshCopyState(num, idx) {
  // Rebuild the card chip so rating styling + copied state are both shown correctly
  updateCardPrompts(num);
  // Also update library chip
  const lc = _el(`lcp-${num}-${idx}`);
  if (lc) {
    const isCopied = ST.prompts[num]?.[idx]?.copied;
    lc.classList.toggle('copied', !!isCopied);
    const ck = lc.querySelector('.lib-chip-check');
    if (ck) ck.style.display = isCopied ? '' : 'none';
  }
}


/* ── Used Set ───────────────────────────────────────────────── */
function setUsedSet(num, idx) {
  // idx = null → clear; same idx clicked again → clear (toggle)
  const oldVal  = ST.usedSets[num];
  const newVal  = (oldVal === idx || idx === null) ? undefined : idx;

  const apply = (val) => {
    if (val === undefined) delete ST.usedSets[num];
    else ST.usedSets[num] = val;
    save(true);
    updateCardPrompts(num);
    updateSuBadge(num);
    updateLibraryUsedSet(num);
    updateHmCell(num);
  };

  record(
    () => apply(oldVal),
    () => apply(newVal),
    newVal !== undefined ? `Set Used #${num} S${newVal+1}` : `Clear Used #${num}`
  );
  apply(newVal);
}


function updateSuBadge(num) {
  const su = _el(`su-${num}`); if (!su) return;
  const used = ST.usedSets[num];
  if (used !== undefined) {
    su.textContent = `S${used + 1}`;
    su.classList.remove('hidden');
  } else {
    su.classList.add('hidden');
  }
}

function updateLibraryUsedSet(num) {
  const col = _el(`lc-${num}`); if (!col) return;
  const used = ST.usedSets[num];
  col.querySelectorAll('.lib-chip').forEach((chip, i) => {
    chip.classList.toggle('is-used', i === used);
    const pin = chip.querySelector('.lib-chip-pin');
    if (pin) pin.style.display = i === used ? '' : 'none';
  });
}

/* ── Batch Tab UI ───────────────────────────────────────────── */
function renderBatchTabs() {
  const bar = _el('batch-tab-bar'); if (!bar) return;
  bar.innerHTML = '';

  const newTab = document.createElement('button');
  newTab.type = 'button';
  newTab.className = 'batch-tab' + (ST.activeBatch === 'new' ? ' active' : '');
  newTab.innerHTML = '<span>＋ New Import</span>';
  newTab.addEventListener('click', (e) => {
    e.preventDefault();
    switchBatchTab('new');
  });
  bar.appendChild(newTab);

  [...ST.batches].reverse().forEach(b => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'batch-tab' + (ST.activeBatch === b.id ? ' active' : '');
    const lbl = document.createElement('span'); lbl.className = 'btab-label'; lbl.textContent = b.label; tab.appendChild(lbl);
    const del = document.createElement('span'); del.className = 'btab-del'; del.textContent = '×'; del.title = 'Delete batch';
    del.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); showDeleteBatchModal(b.id); });
    tab.appendChild(del);
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchBatchTab(b.id);
    });
    bar.appendChild(tab);
  });
}

function switchBatchTab(batchId) {
  if (ST.activeBatch === batchId && batchId !== 'new') {
    ST.activeBatch = 'new';
  } else {
    ST.activeBatch = batchId;
  }
  renderBatchTabs();
  renderBatchPanel();
}




function renderBatchPanel() {
  const np = _el('batch-panel-new'), dp = _el('batch-panel-detail'); if (!np || !dp) return;
  if (ST.activeBatch === 'new') { np.classList.remove('hidden'); dp.classList.add('hidden'); return; }
  np.classList.add('hidden'); dp.classList.remove('hidden');
  const b = ST.batches.find(x => x.id === ST.activeBatch);
  if (!b) { dp.innerHTML = '<p style="color:var(--text-3);font-size:12px;padding:12px">Batch not found.</p>'; return; }
  const dt = new Date(b.date);

  // Build used-set stats for this batch
  const brollsInBatch = Object.keys(ST.prompts)
    .filter(num => (ST.prompts[num]||[]).some(p => p.batchId === b.id))
    .map(Number).sort((a,c)=>a-c);

  const usedCount = brollsInBatch.filter(num => {
    const ui = ST.usedSets[num];
    return ui !== undefined && ST.prompts[num]?.[ui]?.batchId === b.id;
  }).length;

  dp.innerHTML = `
    <div class="batch-detail-header">
      <div class="bdh-info">
        <span class="bdh-label">${escHtml(b.label)}</span>
        <span class="bdh-meta">${dt.toLocaleString('en-IN')} · ${b.brollCount} B-rolls · ${b.promptCount} prompts · ${usedCount} marked as used</span>
      </div>
      <div class="bdh-actions">
        <button class="hbtn" id="btn-view-raw">📄 Raw</button>
        <button class="hbtn danger" id="btn-del-batch">🗑 Delete</button>
      </div>
    </div>
    <div id="batch-raw-wrap" class="hidden">
      <textarea class="batch-raw-ta" readonly>${escHtml(b.raw)}</textarea>
    </div>
  `;
  _el('btn-view-raw').addEventListener('click', () => {
    _el('batch-raw-wrap').classList.toggle('hidden');
    const doCopy = () => toast('📋 Raw text copied!');
    if (navigator.clipboard) navigator.clipboard.writeText(b.raw).then(doCopy).catch(() => fbCopy(b.raw, doCopy));
    else fbCopy(b.raw, doCopy);
  });
  _el('btn-del-batch').addEventListener('click', () => showDeleteBatchModal(b.id));
}

function showDeleteBatchModal(batchId) {
  const b = ST.batches.find(x => x.id === batchId); if (!b) return;
  showModal(`Delete "${b.label}"?`,
    `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
      <input type="checkbox" id="modal-del-prompts" style="width:14px;height:14px;accent-color:var(--accent)">
      <span>Also delete all <strong>${b.promptCount} prompts</strong> from this batch</span>
    </label>`,
    () => deleteBatch(batchId, _el('modal-del-prompts')?.checked)
  );
}

/* ── Library badge ──────────────────────────────────────────── */
function updateLibBadge() {
  const total = Object.values(ST.prompts).reduce((s,a) => s+(a?.length||0), 0);
  const el = _el('lib-badge');
  if (el) el.textContent = total ? `${total} prompts · ${ST.batches.length} batches` : '0 prompts';
}

/* ── Library view ───────────────────────────────────────────── */
function renderLibraryView() {
  const view = _el('library-view');
  if (view) view.innerHTML = '';
  updateLibBadge();
}



/* ── Build single prompt chip (Card & Library) ──────────────── */
function buildPromptChip(num, i, entry, idPrefix = '') {
  const chip = document.createElement('button');
  const isCopied = !!entry.copied;
  const isUsed = ST.usedSets[num] === i;


  const summary = getSetRatingSummary(num, i);
  const rColor = summary ? summary.color : null;

  // Base classes
  chip.className = 'p-chip' + (isCopied ? ' copied' : '') + (isUsed ? ' is-used' : '');
  chip.id = idPrefix ? `${idPrefix}pc-${num}-${i}` : `pc-${num}-${i}`;

  // Label span
  const sp = document.createElement('span');
  sp.className = 'p-chip-label';
  sp.textContent = `Set ${i+1}`;
  chip.appendChild(sp);

  // AI Rating badge if exists (colors ONLY the number badge)
  if (summary) {
    const rb = document.createElement('span');
    rb.className = 'p-chip-srating';
    if (summary.isMajorityTen) {
      rb.textContent = '10';
      rb.title = `Majority 10/10 (${summary.tenCount}/${summary.count} AI ratings)`;
    } else {
      rb.textContent = `${summary.avgScore}`;
      rb.title = `Average: ${summary.avgScore} (${summary.count} AI ratings)`;
    }
    if (rColor) {
      rb.style.color = rColor.text;
      rb.style.borderColor = rColor.border;
      rb.style.backgroundColor = rColor.bg;
    } else {
      rb.style.color = 'var(--text-3)';
    }
    chip.appendChild(rb);
  }

  const titleLines = [
    `Set ${i+1} for #${num}` + (summary ? ` · Avg: ${summary.avgScore}` + (summary.count > 1 ? ` (${summary.count} ratings)` : '') : ''),
    '',
    '• Click: Copy prompt & toggle green on/off',
    '• Right-click: View all AI ratings & reasons'
  ];
  chip.title = titleLines.join('\n');

  // Left-click / Tap: Copy & toggle green / ungreen
  chip.addEventListener('click', e => {
    e.stopPropagation();
    copyPrompt(num, i, chip, true);
  });


  // Right-click: View all ratings & reasons popup
  chip.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    showWhyPopup(e, num, i);
  });

  // Mobile 1.5-second hold feature (toggle green state)
  let holdTimer = null;
  let touchStartX = 0, touchStartY = 0;
  let didHoldTrigger = false;

  chip.addEventListener('touchstart', e => {
    didHoldTrigger = false;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      holdTimer = setTimeout(() => {
        didHoldTrigger = true;
        if (navigator.vibrate) try { navigator.vibrate(60); } catch {}
        const oldVal = !entry.copied;
        const newVal = !oldVal;
        const apply = (val) => {
          entry.copied = val;
          save(true);
          refreshCopyState(num, i);
        };
        record(
          () => apply(oldVal),
          () => apply(newVal),
          newVal ? `Mark Set ${i+1} for #${num}` : `Unmark Set ${i+1} for #${num}`
        );
        apply(newVal);
        toast(newVal ? `Set ${i+1} for #${num} marked green` : `Set ${i+1} for #${num} unmarked`);
      }, 1500);
    }
  }, { passive: true });



  chip.addEventListener('touchmove', e => {
    if (holdTimer && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 10 || dy > 10) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }
  }, { passive: true });

  chip.addEventListener('touchend', e => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (didHoldTrigger) {
      e.preventDefault();
    }
  });

  chip.addEventListener('touchcancel', () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  });


  // Wrap chip + Real Rating button together
  const wrapper = document.createElement('div');
  wrapper.className = 'p-chip-wrap';

  wrapper.appendChild(chip);

  // Real Rating (My Rating) ✏ button
  const myR = getMyRating(num, i);
  const myBtn = document.createElement('button');
  myBtn.className = 'myrating-chip-btn' + (myR ? ' has-rating' : '');
  myBtn.id = idPrefix ? `${idPrefix}myrb-${num}-${i}` : `myrb-${num}-${i}`;
  if (myR) {
    const mc = getMyRatingColor(myR.score);
    myBtn.textContent = myR.score === 0 ? '0 ↺' : myR.score;
    myBtn.style.color = mc ? mc.text : '#fff';
    myBtn.style.borderColor = mc ? mc.border : '#666';
    myBtn.style.background = mc ? mc.bg : 'var(--bg-3)';
    if (mc?.glow && mc.glow !== 'transparent') {
      myBtn.style.boxShadow = `0 0 8px ${mc.glow}`;
    }
    const tipTitle = myR.score === 0 ? 'Real Rating: 0 · Good prompt, model retry' : `Real Rating: ${myR.score}`;
    myBtn.title = `${tipTitle}${myR.comment ? ' — ' + myR.comment : ''}\nClick to edit`;
  } else {
    myBtn.textContent = '✏';
    myBtn.title = 'Add Real Rating (My Rating)';
  }
  myBtn.addEventListener('click', e => {
    e.stopPropagation();
    showMyRatingModal(myBtn, num, i);
  });

  // PC Mouse: Single Right-Click = Tier 1 (default 5), Double Right-Click = Tier 2 (default 9)
  let _rcTimer = null;
  myBtn.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    const t1 = ST.quickRateTier1 ?? 5;
    const t2 = ST.quickRateTier2 ?? 9;

    if (_rcTimer) {
      // Double right-click detected!
      clearTimeout(_rcTimer);
      _rcTimer = null;
      saveMyRating(num, i, t2, '');
      myBtn.classList.add('longpress-flash-tier2');
      setTimeout(() => myBtn?.classList.remove('longpress-flash-tier2'), 500);
      toast(`⚡ Double Right-Click: Quick rated #${num} Set ${i + 1}: ${t2}`);
    } else {
      _rcTimer = setTimeout(() => {
        _rcTimer = null;
        saveMyRating(num, i, t1, '');
        myBtn.classList.add('longpress-flash');
        setTimeout(() => myBtn?.classList.remove('longpress-flash'), 400);
        toast(`⚡ Quick rated #${num} Set ${i + 1}: ${t1}`);
      }, 300);
    }
  });

  // Mobile / Touchscreen: Hold 1.0s = Tier 1 (5), Hold 2.5s = Tier 2 (9)
  let _lpTimer1 = null;
  let _lpTimer2 = null;
  let _touchStartX = 0, _touchStartY = 0;

  myBtn.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;

    const t1 = ST.quickRateTier1 ?? 5;
    const t2 = ST.quickRateTier2 ?? 9;

    // 1.0 second hold -> Tier 1
    _lpTimer1 = setTimeout(() => {
      _lpTimer1 = null;
      if (navigator.vibrate) try { navigator.vibrate(50); } catch {}
      myBtn.classList.add('longpress-flash');
      saveMyRating(num, i, t1, '');
      toast(`⚡ 1s Hold: Quick rated #${num} Set ${i + 1}: ${t1}`);
      setTimeout(() => myBtn?.classList.remove('longpress-flash'), 400);
    }, 1000);

    // 2.5 seconds hold -> Tier 2
    _lpTimer2 = setTimeout(() => {
      _lpTimer2 = null;
      if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch {}
      myBtn.classList.add('longpress-flash-tier2');
      saveMyRating(num, i, t2, '');
      toast(`⚡ 2.5s Hold: Quick rated #${num} Set ${i + 1}: ${t2}`);
      setTimeout(() => myBtn?.classList.remove('longpress-flash-tier2'), 600);
    }, 2500);
  }, { passive: true });

  const cancelTouch = (e) => {
    if (e && e.touches && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - _touchStartX);
      const dy = Math.abs(e.touches[0].clientY - _touchStartY);
      if (dx < 10 && dy < 10) return;
    }
    if (_lpTimer1) { clearTimeout(_lpTimer1); _lpTimer1 = null; }
    if (_lpTimer2) { clearTimeout(_lpTimer2); _lpTimer2 = null; }
  };

  myBtn.addEventListener('touchend', cancelTouch);
  myBtn.addEventListener('touchcancel', cancelTouch);
  myBtn.addEventListener('touchmove', cancelTouch, { passive: true });

  wrapper.appendChild(myBtn);
  return wrapper;
}








function buildPromptChipsElement(num, prompts, allowedSetIndices = null, idPrefix = '') {
  if (!prompts || !prompts.length) return null;
  const filtered = prompts
    .map((entry, i) => ({ entry, i }))
    .filter(x => !allowedSetIndices || allowedSetIndices.includes(x.i));

  if (!filtered.length) return null;

  const prow = document.createElement('div');
  prow.className = 'c-prompts';
  prow.id = idPrefix ? `${idPrefix}cp-${num}` : `cp-${num}`;

  // Group prompts by batchId
  const batchMap = new Map();
  filtered.forEach(({ entry, i }) => {
    const bId = entry.batchId || 'default';
    if (!batchMap.has(bId)) batchMap.set(bId, []);
    batchMap.get(bId).push({ entry, i });
  });

  batchMap.forEach((items, bId) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'p-batch-group';
    groupEl.dataset.batchId = bId;

    items.forEach(({ entry, i }) => {
      groupEl.appendChild(buildPromptChip(num, i, entry, idPrefix));
    });

    prow.appendChild(groupEl);
  });

  return prow;
}



function updateCardPrompts(num) {
  const card = _el(`card-${num}`); if (!card) return;
  const existingPr = _el(`cp-${num}`);
  const mid = card.querySelector('.c-mid');
  const prompts = ST.prompts[num] || [];

  const activeRBatch = ST.activeRatingBatchFilter ? (ST.ratingBatches || []).find(x => x.id === ST.activeRatingBatchFilter) : null;
  const allowedSets = activeRBatch ? getBatchSetsForBroll(activeRBatch, num) : null;

  if (existingPr) existingPr.remove();
  const prow = buildPromptChipsElement(num, prompts, allowedSets);
  if (prow) mid.appendChild(prow);

  // Also refresh the Done button in the right column
  const doneBtn = _el(`done-btn-${num}`);
  if (doneBtn) {
    const isCovered = !!(ST.covered && ST.covered[num]);
    doneBtn.className = 'c-done-btn' + (isCovered ? ' active' : '');
    doneBtn.innerHTML = isCovered ? '✔' : '◻';
    doneBtn.title = isCovered
      ? `B-roll #${num} is Done (9+ in Overview)\nClick to unmark`
      : `Mark B-roll #${num} as Done (9+ in Overview)`;
  }
}






function updateAllPromptChips() { ST.brolls.forEach(b => updateCardPrompts(b.num)); }

/* ── Real Rating Line Representation ──────────────────────── */
function getLineRealRating(num) {
  const isCovered = !!(ST.covered && ST.covered[num]);
  const sets = ST.myRatings?.[num];
  let highestScore = null;
  let hasRetry = false;

  if (sets && typeof sets === 'object') {
    const validScores = Object.values(sets)
      .filter(val => val && typeof val === 'object' && val.score !== undefined && !isNaN(parseFloat(val.score)))
      .map(val => parseFloat(val.score));

    if (validScores.length) {
      if (validScores.includes(0)) hasRetry = true;
      highestScore = Math.max(...validScores);
    }
  }

  if (isCovered) {
    return {
      score: highestScore !== null ? Math.max(9, highestScore) : 9,
      isCovered: true,
      hasRetry: false,
      isRated: true
    };
  }

  if (highestScore !== null) {
    return {
      score: highestScore,
      isCovered: false,
      hasRetry: highestScore === 0,
      isRated: true
    };
  }

  return {
    score: null,
    isCovered: false,
    hasRetry: false,
    isRated: false
  };
}

/* ── Filter & Sort (Main Rating vs Real Rating) ─────────────── */
function passes(b) {
  const target = ST.filterTarget || 'main';
  const f = ST.filter;



  if (target === 'main') {
    const s = ST.scores[b.num] ?? null;
    if (f === 'all') return true;
    if (f === 'unscored' || f === 'unrated') return s === null;
    if (f === 'needs') return s === null || s < 9;
    if (f === 'retry') return s === 0;
    if (f.startsWith('above:')) return s !== null && s >= parseFloat(f.slice(6));
    if (f.startsWith('below:')) return s === null || s < parseFloat(f.slice(6));
    if (f === 'perfect') return s !== null && snap(s) === 10;
    return true;
  } else {
    // Real Rating filtering: represented by highest real score of the sets, or 9 if covered
    const lr = getLineRealRating(b.num);
    if (f === 'all') return true;
    if (f === 'unrated' || f === 'unscored') return !lr.isRated;
    if (f === 'retry') return lr.hasRetry;
    if (f === 'needs') return !lr.isRated || lr.score < 9;
    if (f === 'above:9' || f === '9plus') return lr.isRated && lr.score >= 9;
    if (f === 'perfect') return lr.isRated && lr.score >= 10;
    if (f === 'covered') return lr.isCovered;
    if (f.startsWith('above:')) return lr.isRated && lr.score >= parseFloat(f.slice(6));
    if (f.startsWith('below:')) return !lr.isRated || lr.score < parseFloat(f.slice(6));
    return true;
  }
}

function sortedList(arr) {
  const target = ST.filterTarget || 'main';
  if (ST.sortBy === 'num') return [...arr].sort((a, b) => a.num - b.num);

  if (target === 'main') {
    if (ST.sortBy === 'asc') return [...arr].sort((a, b) => (ST.scores[a.num] ?? -1) - (ST.scores[b.num] ?? -1));
    if (ST.sortBy === 'desc') return [...arr].sort((a, b) => (ST.scores[b.num] ?? -1) - (ST.scores[a.num] ?? -1));
  } else {
    const getScoreVal = num => {
      const lr = getLineRealRating(num);
      return lr.isRated ? lr.score : -1;
    };
    if (ST.sortBy === 'asc') return [...arr].sort((a, b) => getScoreVal(a.num) - getScoreVal(b.num));
    if (ST.sortBy === 'desc') return [...arr].sort((a, b) => getScoreVal(b.num) - getScoreVal(a.num));
  }
  return arr;
}


function getRealRatingOverviewData(num) {
  const isCovered = !!(ST.covered && ST.covered[num]);
  const sets = ST.myRatings?.[num];
  let ratingData = null;

  if (sets && typeof sets === 'object') {
    const list = Object.entries(sets)
      .filter(([idx, val]) => val && typeof val === 'object' && val.score !== undefined && !isNaN(parseFloat(val.score)))
      .map(([idx, val]) => ({ idx: parseInt(idx), score: parseFloat(val.score), comment: val.comment || '', date: val.date }));

    if (list.length) {
      const used = ST.usedSets?.[num];
      if (used !== undefined && sets[used] && sets[used].score !== undefined) {
        ratingData = { score: parseFloat(sets[used].score), comment: sets[used].comment || '', setIdx: used };
      } else {
        const retry = list.find(x => x.score === 0);
        if (retry) {
          ratingData = { score: 0, comment: retry.comment, setIdx: retry.idx };
        } else {
          list.sort((a, b) => b.score - a.score);
          ratingData = { score: list[0].score, comment: list[0].comment, setIdx: list[0].idx };
        }
      }
    }
  }

  // If marked as covered, the real rating overview bar displays Green 9+
  if (isCovered) {
    return {
      score: 9,
      isCovered: true,
      rawRating: ratingData,
      comment: 'Covered / Used alternative clip (9+)',
      setIdx: ratingData ? ratingData.setIdx : null
    };
  }

  return ratingData;
}

/* ── Overview Mode Toggle ────────────────────────────────────── */
function toggleOverviewScrollMode() {
  ST.overviewScroll = !ST.overviewScroll;
  try { localStorage.setItem('br_overview_scroll', ST.overviewScroll ? 'true' : 'false'); } catch {}
  updateOverviewModeUI();
  renderHeatmap();
  if (!ST.overviewScroll) {
    highlightActiveBroll(null);
  } else {
    syncOverviewBarToScroll(false);
  }
  toast(ST.overviewScroll ? '↔️ Overview: Scrollable View' : '🔍 Overview: Compressed Full View');
}

function updateOverviewModeUI() {
  const btn = _el('hm-view-toggle');
  const grid = _el('heatmap-grid');
  if (btn) {
    btn.classList.toggle('active', !!ST.overviewScroll);
    btn.innerHTML = ST.overviewScroll ? '↔' : '⇔';
    btn.title = ST.overviewScroll ? 'Switch to compressed full view' : 'Switch to scrollable view';
  }
  if (grid) {
    grid.classList.toggle('scrollable', !!ST.overviewScroll);
  }
}

/* ── Heatmap (Unified Linked 2-Tier: Top Main / Bottom Real) ── */
function renderHeatmap() {
  const grid = _el('heatmap-grid');
  if (!grid) return;
  grid.innerHTML = '';

  updateOverviewModeUI();

  if (!ST.brolls.length) {
    grid.innerHTML = '<span style="color:#44445a;font-size:11px;align-self:center;padding:0 4px">No script loaded</span>';
    return;
  }

  const N = ST.brolls.length;
  const isScroll = !!ST.overviewScroll;
  const W = grid.clientWidth || (window.innerWidth - 28);
  const cw = isScroll ? 18 : (W - (N - 1) * 1.5) / N;
  const showNum = isScroll || cw >= 13;
  const fs = isScroll ? 8.5 : (cw >= 22 ? 9.5 : cw >= 13 ? 7.5 : 0);

  ST.brolls.forEach(b => {
    const mainScore = ST.scores[b.num] ?? null;
    const mainCol = getC(mainScore);
    const rData = getRealRatingOverviewData(b.num);
    const rCol = rData ? (rData.isCovered ? getC(9) : getMyRatingColor(rData.score)) : getC(null);

    const col = document.createElement('div');
    col.className = 'hm-col';
    col.id = `hm-col-${b.num}`;
    if (isScroll) {
      col.style.width = '18px';
      col.style.flex = '0 0 18px';
    }

    // Top tier (Main)
    const topTier = document.createElement('div');
    topTier.className = 'hm-col-tier top';
    topTier.id = `hm-top-${b.num}`;
    topTier.style.background = mainCol.bg;

    // Bottom tier (Real)
    const botTier = document.createElement('div');
    botTier.className = 'hm-col-tier bottom';
    botTier.id = `hm-bot-${b.num}`;
    let botBg = rCol ? rCol.bg : '#151525';
    botTier.style.background = botBg;
    if (rData && rData.score === 0 && !rData.isCovered) {
      botTier.style.boxShadow = 'inset 0 0 4px #9333ea';
    }

    col.appendChild(topTier);
    col.appendChild(botTier);

    // Number overlay
    if (showNum && fs > 0) {
      const numSpan = document.createElement('span');
      numSpan.className = 'hm-col-num';
      numSpan.style.fontSize = fs + 'px';
      numSpan.textContent = b.num;
      col.appendChild(numSpan);
    }

    // Tooltip
    const mainTitle = mainScore !== null ? `Main: ${mainScore}/10` : 'Main: unscored';
    let realTitle = 'Real: unrated';
    if (rData) {
      if (rData.isCovered) {
        realTitle = 'Real: 9+ (Covered with other clip)';
      } else if (rData.score === 0) {
        realTitle = 'Real: 0 (Model Retry / Glitch)';
      } else {
        realTitle = `Real: ${rData.score}/10 (Set ${rData.setIdx + 1}${rData.comment ? ': ' + rData.comment : ''})`;
      }
    }
    col.title = `#${b.num} · ${mainTitle} · ${realTitle}\n"${b.line.slice(0, 70)}"`;

    col.addEventListener('click', (e) => {
      e.stopPropagation();
      _ignoreScrollSyncUntil = Date.now() + 700;
      if (ST.overviewScroll) highlightActiveBroll(b.num);
      _el(`card-${b.num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    grid.appendChild(col);
  });

  if (isScroll) {
    setTimeout(() => syncOverviewBarToScroll(false), 50);
  } else {
    highlightActiveBroll(null);
  }
}


/* ── Overview <-> Main Page Scroll Sync ─────────────────────── */
let _lastActiveBrollNum = null;
let _isUserTouchingOverview = false;
let _isUserScrollingOverview = false;
let _isUserScrollingPage = false;
let _overviewScrollEndTimer = null;
let _pageScrollEndTimer = null;
let _overviewScrollTicking = false;
let _gridScrollTicking = false;

function highlightActiveBroll(num) {
  if (!ST.overviewScroll) {
    // When overview bar is in full mode, highlighting stays OFF
    document.querySelectorAll('.hm-col.is-scrolled-active').forEach(el => el.classList.remove('is-scrolled-active'));
    document.querySelectorAll('.broll-card.is-active-focused').forEach(el => el.classList.remove('is-active-focused'));
    _lastActiveBrollNum = null;
    return;
  }

  if (num === null || num === undefined) {
    document.querySelectorAll('.hm-col.is-scrolled-active').forEach(el => el.classList.remove('is-scrolled-active'));
    document.querySelectorAll('.broll-card.is-active-focused').forEach(el => el.classList.remove('is-active-focused'));
    _lastActiveBrollNum = null;
    return;
  }

  if (num === _lastActiveBrollNum) return;
  _lastActiveBrollNum = num;

  // Highlight overview cell
  const grid = _el('heatmap-grid');
  if (grid) {
    grid.querySelectorAll('.hm-col.is-scrolled-active').forEach(el => el.classList.remove('is-scrolled-active'));
    const cell = _el(`hm-col-${num}`);
    if (cell) cell.classList.add('is-scrolled-active');
  }

  // Highlight card border
  document.querySelectorAll('.broll-card.is-active-focused').forEach(el => el.classList.remove('is-active-focused'));
  const card = _el(`card-${num}`);
  if (card) card.classList.add('is-active-focused');
}

function getActiveBrollNumInViewport() {
  if (!ST.brolls || !ST.brolls.length) return null;
  // Exact vertical middle of the screen
  const targetY = window.innerHeight * 0.5;
  let closestNum = null;
  let closestDist = Infinity;

  for (const b of ST.brolls) {
    const el = _el(`card-${b.num}`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const dist = Math.abs(cardCenter - targetY);
    if (dist < closestDist) {
      closestDist = dist;
      closestNum = b.num;
    }
  }
  return closestNum;
}

function syncOverviewBarToScroll(smooth = true) {
  if (!ST.overviewScroll || Date.now() < _ignoreScrollSyncUntil || _myRatingModal) return;
  const grid = _el('heatmap-grid');
  if (!grid) return;

  const activeNum = getActiveBrollNumInViewport();
  if (activeNum === null) return;

  highlightActiveBroll(activeNum);

  const cell = _el(`hm-col-${activeNum}`);
  if (!cell) return;

  const cellLeft = cell.offsetLeft;
  const cellWidth = cell.offsetWidth;
  const gridWidth = grid.clientWidth;
  const targetScrollLeft = cellLeft - (gridWidth / 2) + (cellWidth / 2);

  grid.scrollTo({
    left: Math.max(0, targetScrollLeft),
    behavior: smooth ? 'smooth' : 'auto'
  });
}





function updateHmCell(num) {
  const col = _el(`hm-col-${num}`);
  const topTier = _el(`hm-top-${num}`);
  const botTier = _el(`hm-bot-${num}`);
  if (!col) return;

  const mainScore = ST.scores[num] ?? null;
  const mainCol = getC(mainScore);
  if (topTier) topTier.style.background = mainCol.bg;

  const rData = getRealRatingOverviewData(num);
  const rCol = rData ? (rData.isCovered ? getC(9) : getMyRatingColor(rData.score)) : getC(null);
  if (botTier) {
    botTier.style.background = rCol ? rCol.bg : '#151525';
    if (rData && rData.score === 0 && !rData.isCovered) {
      botTier.style.boxShadow = 'inset 0 0 4px #9333ea';
    } else {
      botTier.style.boxShadow = 'none';
    }
  }

  const broll = ST.brolls.find(x => x.num === num);
  const mainTitle = mainScore !== null ? `Main: ${mainScore}/10` : 'Main: unscored';
  let realTitle = 'Real: unrated';
  if (rData) {
    if (rData.isCovered) {
      realTitle = 'Real: 9+ (Covered with other clip)';
    } else if (rData.score === 0) {
      realTitle = 'Real: 0 (Model Retry / Glitch)';
    } else {
      realTitle = `Real: ${rData.score}/10 (Set ${rData.setIdx + 1}${rData.comment ? ': ' + rData.comment : ''})`;
    }
  }
  col.title = `#${num} · ${mainTitle} · ${realTitle}\n"${broll ? broll.line.slice(0, 70) : ''}"`;
}

/* ── Stats ──────────────────────────────────────────────────── */
function renderStats() {
  const total = ST.brolls.length;

  // 🎯 Main Rating Stats
  const scored = ST.brolls.filter(b => ST.scores[b.num] !== undefined && ST.scores[b.num] !== null).length;
  const greens = ST.brolls.filter(b => (ST.scores[b.num] ?? -1) >= 9).length;
  const vals = ST.brolls.map(b => ST.scores[b.num]).filter(s => s !== null && s !== undefined);
  const avg = vals.length ? (vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : null;
  setText('st-total', total);
  setText('st-scored', `${scored}/${total}`);
  setText('st-green', greens);
  setText('st-avg', avg || '—');

  const ps = total ? Math.round((scored / total) * 100) : 0;
  const pg = total ? Math.round((greens / total) * 100) : 0;
  setStyle('prog-s', 'width', ps + '%');
  setStyle('prog-g', 'width', pg + '%');
  setText('prog-s-pct', ps + '%');
  setText('prog-g-pct', pg + '%');

  // ✏ Real Rating Stats
  let realScoredCount = 0;
  let realGreensCount = 0;
  let realRetriesCount = 0;

  ST.brolls.forEach(b => {
    const rData = getRealRatingOverviewData(b.num);
    if (rData) {
      realScoredCount++;
      const s = parseFloat(rData.score);
      if (s === 0 && !rData.isCovered) realRetriesCount++;
      else if (s >= 9 || rData.isCovered) realGreensCount++;
    }
  });

  const prs = total ? Math.round((realScoredCount / total) * 100) : 0;
  const prg = total ? Math.round((realGreensCount / total) * 100) : 0;
  const prz = total ? Math.round((realRetriesCount / total) * 100) : 0;

  setStyle('prog-real-s', 'width', prs + '%');
  setStyle('prog-real-g', 'width', prg + '%');
  setStyle('prog-real-z', 'width', prz + '%');
  setText('prog-real-s-pct', prs + '%');
  setText('prog-real-g-pct', prg + '%');
  setText('prog-real-z-pct', prz + '%');

  const hint = _el('hm-hint');
  if (hint) {
    hint.textContent = total
      ? `${scored}/${total} scored (Real: ${realGreensCount} ≥9/covered)`
      : 'load a script to begin';
  }

  const badge = _el('it-badge');
  if (badge) badge.textContent = total ? `${total} clips` : 'empty';
}

function renderFilterCount() {
  const vis=ST.brolls.filter(passes).length, el=_el('fb-count');
  if(el)el.innerHTML=`<strong>${vis}</strong>/${ST.brolls.length}`;
}

/* ── Cards ──────────────────────────────────────────────────── */
function renderCards(animate=false) {
  const box=_el('cards-container'), noRes=_el('no-results'), empty=_el('empty-state'), fbar=_el('filter-bar');
  if(!ST.brolls.length){
    box.innerHTML='';empty.classList.remove('hidden');noRes.style.display='none';fbar.classList.add('hidden');
    box.style.minHeight='';
    return;
  }
  empty.classList.add('hidden');fbar.classList.remove('hidden');

  let list = sortedList(ST.brolls.filter(passes));

  const activeRBatch = ST.activeRatingBatchFilter ? (ST.ratingBatches || []).find(x => x.id === ST.activeRatingBatchFilter) : null;
  if (activeRBatch) {
    list = list.filter(b => activeRBatch.brolls.includes(b.num));
  }

  renderFilterCount();

  const curHeight = box.offsetHeight;
  if (curHeight > 0) box.style.minHeight = curHeight + 'px';

  // Render batch filter banner if active
  const existingBanner = document.getElementById('batch-filter-banner');
  if (existingBanner) existingBanner.remove();

  if (activeRBatch) {
    const banner = document.createElement('div');
    banner.id = 'batch-filter-banner';
    banner.className = 'batch-filter-banner';
    banner.innerHTML = `
      <div class="bfb-info">
        <span class="bfb-badge">⭐ Rating Batch: ${escHtml(activeRBatch.label)}</span>
        <span class="bfb-meta">Showing ${list.length} B-rolls (${activeRBatch.count || list.length} ratings)</span>
      </div>
      <button class="hbtn" id="btn-clear-batch-filter">✕ Show All Cards</button>
    `;
    banner.querySelector('#btn-clear-batch-filter').addEventListener('click', () => {
      ST.activeRatingBatchFilter = null;
      ST.activeRatingBatch = 'new';
      renderRatingTabs();
      renderCards();
      toast('👁️ Showing all cards');
    });
    box.parentElement.insertBefore(banner, box);
  }

  if(!list.length){
    box.innerHTML='';noRes.style.display='block';
    requestAnimationFrame(() => { box.style.minHeight = ''; });
    return;
  }
  noRes.style.display='none'; box.innerHTML='';

  list.forEach((b,i)=>{
    const allowedSets = activeRBatch ? getBatchSetsForBroll(activeRBatch, b.num) : null;
    const card=buildCard(b, allowedSets);
    if (activeRBatch) card.classList.add('is-expanded');
    if(animate){card.style.animationDelay=`${Math.min(i*18,300)}ms`;card.classList.add('card-enter');}
    box.appendChild(card);
  });
  updateCompactViewUI();

  requestAnimationFrame(() => {
    box.style.minHeight = '';
  });
}




function buildCard(b, allowedSetIndices = null, idPrefix = '') {
  const score=ST.scores[b.num]??null, col=getC(score), prompts=ST.prompts[b.num]||[];
  const used=ST.usedSets[b.num];

  const card=document.createElement('div');
  card.className='broll-card';
  card.id = idPrefix ? `${idPrefix}card-${b.num}` : `card-${b.num}`;
  card.style.borderLeftColor=col.border;

  /* Badge */
  const badge=document.createElement('div');
  badge.className='c-num';
  badge.id = idPrefix ? `${idPrefix}cn-${b.num}` : `cn-${b.num}`;
  badge.style.background=col.bg;
  badge.style.boxShadow=col.glow!=='transparent'?`0 3px 14px ${col.glow}`:'none';
  badge.textContent=b.num; card.appendChild(badge);

  /* Middle */
  const mid=document.createElement('div'); mid.className='c-mid';
  const line=document.createElement('div'); line.className='c-line'; line.textContent=b.line; line.title=b.line;
  mid.appendChild(line);

  // Bengali / 2nd Language line
  const bnLine = ST.bengaliLines ? ST.bengaliLines[b.num] : null;
  if (ST.showBengali !== false && bnLine) {
    const bnEl = document.createElement('div');
    bnEl.className = 'c-line-bengali';
    bnEl.textContent = bnLine;
    bnEl.title = `Bengali: ${bnLine}`;
    mid.appendChild(bnEl);
  }


  /* Slider */
  const slRow=document.createElement('div'); slRow.className='c-slider-row';
  const l0=document.createElement('span'); l0.className='s-label'; l0.textContent='0'; slRow.appendChild(l0);
  const slWrap=document.createElement('div'); slWrap.className='slider-wrap' + (ST.mainRatingLocked ? ' is-locked' : '');
  const inp=document.createElement('input');
  inp.type='range'; inp.min='0'; inp.max='10'; inp.step='0.5'; inp.value=score!==null?score:'0';
  inp.className='score-slider';
  inp.id = idPrefix ? `${idPrefix}sl-${b.num}` : `sl-${b.num}`;
  inp.disabled = !!ST.mainRatingLocked;
  inp.setAttribute('list','score-steps'); inp.setAttribute('aria-label',`B-roll ${b.num} score`);
  applySliderStyle(inp, score);
  let lastSnap=snap(score);
  inp.addEventListener('input',()=>{
    if (ST.mainRatingLocked) return;
    const v=parseFloat(inp.value),s=snap(v);applySliderStyle(inp,v);updateScoreVal(b.num,v);if(s!==lastSnap){lastSnap=s;inp.classList.remove('snap-pop');void inp.offsetWidth;inp.classList.add('snap-pop');setTimeout(()=>inp&&inp.classList.remove('snap-pop'),160);}
  });
  inp.addEventListener('change',()=>{
    if (ST.mainRatingLocked) {
      toast('🔒 Main rating is locked. Click 🔒 in header to unlock.');
      return;
    }
    setScore(b.num,parseFloat(inp.value));
  });
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      if (ST.mainRatingLocked) {
        toast('🔒 Main rating is locked. Click 🔒 in header to unlock.');
        return;
      }
      setScore(b.num,parseFloat(inp.value));
      const idx=ST.brolls.findIndex(x=>x.num===b.num);
      if(idx<ST.brolls.length-1){const ns=_el(`sl-${ST.brolls[idx+1].num}`);if(ns){ns.focus();ns.scrollIntoView({behavior:'smooth',block:'center'});}}
    }
  });

  slWrap.addEventListener('click', () => {
    if (ST.mainRatingLocked) {
      toast('🔒 Main rating is locked. Click 🔒 in header to unlock.');
    }
  });

  slWrap.appendChild(inp);
  const ticks=document.createElement('div'); ticks.className='slider-ticks';
  STEPS.forEach(s=>{const t=document.createElement('div');t.className='s-tick'+(Number.isInteger(s)?' major':'');ticks.appendChild(t);});
  slWrap.appendChild(ticks); slRow.appendChild(slWrap);
  const l10=document.createElement('span'); l10.className='s-label'; l10.textContent='10'; slRow.appendChild(l10);
  mid.appendChild(slRow);

  /* Prompt chips (filtered to allowed sets if passed) */
  const prow = buildPromptChipsElement(b.num, prompts, allowedSetIndices, idPrefix);
  if (prow) mid.appendChild(prow);

  card.appendChild(mid);

  /* Right: score wrap + copy line + done + expand */
  const right=document.createElement('div'); right.className='c-right';

  const scoreWrap=document.createElement('div'); scoreWrap.className='c-score-wrap';
  const val=document.createElement('div'); val.className='score-val';
  val.id = idPrefix ? `${idPrefix}sv-${b.num}` : `sv-${b.num}`;
  val.style.background=col.bg; val.style.borderColor=col.border; val.textContent=scoreLbl(score);
  scoreWrap.appendChild(val);

  const suBadge=document.createElement('div');
  suBadge.className='su-badge'+(used!==undefined?'':' hidden');
  suBadge.id = idPrefix ? `${idPrefix}su-${b.num}` : `su-${b.num}`;
  suBadge.textContent=used!==undefined?`S${used+1}`:''; suBadge.title=used!==undefined?`Used set ${used+1} for this rating`:'';
  scoreWrap.appendChild(suBadge);
  right.appendChild(scoreWrap);

  const copyLineBtn = document.createElement('button');
  copyLineBtn.className = 'c-copy-line';
  copyLineBtn.textContent = '📋';
  copyLineBtn.title = `Copy line #${b.num}:\n"${b.line}"`;
  copyLineBtn.setAttribute('aria-label', `Copy text for B-roll ${b.num}`);
  copyLineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = b.line;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast(`📋 Copied Line #${b.num}`))
        .catch(() => fbCopy(text, () => toast(`📋 Copied Line #${b.num}`)));
    } else {
      fbCopy(text, () => toast(`📋 Copied Line #${b.num}`));
    }
  });
  right.appendChild(copyLineBtn);

  // Done toggle button (below copy line)
  const isCov = !!(ST.covered && ST.covered[b.num]);
  const doneBtn = document.createElement('button');
  doneBtn.className = 'c-done-btn' + (isCov ? ' active' : '');
  doneBtn.id = idPrefix ? `${idPrefix}done-btn-${b.num}` : `done-btn-${b.num}`;
  doneBtn.innerHTML = isCov ? '✔' : '◻';
  doneBtn.title = isCov
    ? `B-roll #${b.num} is Done (9+ in Overview)\nClick to unmark`
    : `Mark B-roll #${b.num} as Done (9+ in Overview)`;
  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCoveredClip(b.num);
  });
  right.appendChild(doneBtn);

  const countDisplay = allowedSetIndices ? allowedSetIndices.length : prompts.length;
  // Open / Expand prompt boxes button (below Copy & Done buttons)
  if (countDisplay > 0) {
    const expBtn = document.createElement('button');
    expBtn.className = 'c-exp-card-btn';
    expBtn.id = idPrefix ? `${idPrefix}exp-btn-${b.num}` : `exp-btn-${b.num}`;
    expBtn.innerHTML = `<span class="exp-count">${countDisplay}</span><span class="exp-arrow">▾</span>`;
    expBtn.title = `Expand prompt sets for #${b.num} (${countDisplay} set${countDisplay>1?'s':''})`;
    expBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExp = card.classList.toggle('is-expanded');
      expBtn.classList.toggle('active', isExp);
      const arr = expBtn.querySelector('.exp-arrow');
      if (arr) arr.textContent = isExp ? '▴' : '▾';
    });
    right.appendChild(expBtn);
  }

  card.appendChild(right);
  return card;
}





/* ── Slider helpers ─────────────────────────────────────────── */
function applySliderStyle(inp,score){const col=getC(score);const pct=score!==null?(parseFloat(score)/10*100).toFixed(1)+'%':'0%';inp.style.setProperty('--fp',pct);inp.style.setProperty('--fc',score!==null?col.bg:'#1c1c28');inp.style.setProperty('--tg',col.glow!=='transparent'?col.glow:'rgba(255,255,255,0.06)');}
function updateScoreVal(num,val){const sv=_el(`sv-${num}`);if(!sv)return;const col=getC(val);sv.textContent=(val!==null&&val!==undefined)?`${snap(val)}`:'—';sv.style.background=col.bg;sv.style.borderColor=col.border;}

/* ── Score actions ──────────────────────────────────────────── */
function setScore(num, val) {
  const oldScore = ST.scores[num] ?? null, newScore = snap(val);
  if (oldScore === newScore) return;
  if (newScore !== null) {
    try { localStorage.setItem('br_last_scored_' + ACTIVE_PID, num); } catch {}
  }
  const oldCovered = !!(ST.covered && ST.covered[num]);
  const newCovered = (newScore !== null && newScore >= 9) ? true : oldCovered;

  const apply = (s, cov) => {
    if (s === null) delete ST.scores[num]; else ST.scores[num] = s;
    if (!ST.covered) ST.covered = {};
    if (cov) ST.covered[num] = true; else delete ST.covered[num];
    save(true);
    updateCardVisuals(num, s);
    updateDoneBtnUI(num);
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    updateLineCopyPreview();
  };

  record(
    () => apply(oldScore, oldCovered),
    () => apply(newScore, newCovered),
    `Score #${num}: ${scoreLbl(oldScore)} → ${scoreLbl(newScore)}`
  );
  apply(newScore, newCovered);
}

function clearScore(num) {
  const old = ST.scores[num] ?? null; if (old === null) return;
  const oldCovered = !!(ST.covered && ST.covered[num]);

  const apply = (s) => {
    if (s === null) delete ST.scores[num]; else ST.scores[num] = s;
    save(true);
    updateCardVisuals(num, s);
    updateDoneBtnUI(num);
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    updateLineCopyPreview();
  };

  record(
    () => apply(old),
    () => apply(null),
    `Clear score #${num}`
  );
  apply(null);
}


function scrollToLastScoredBroll() {
  if (!ST.brolls.length) return;
  let targetNum = null;
  try {
    const saved = localStorage.getItem('br_last_scored_' + ACTIVE_PID);
    if (saved && ST.scores[saved] !== undefined && ST.scores[saved] !== null) {
      targetNum = parseInt(saved);
    }
  } catch {}
  if (!targetNum) {
    const scoredBrolls = ST.brolls.filter(b => ST.scores[b.num] !== undefined && ST.scores[b.num] !== null);
    if (scoredBrolls.length) {
      targetNum = scoredBrolls[scoredBrolls.length - 1].num;
    }
  }
  if (targetNum) {
    setTimeout(() => {
      const el = _el(`card-${targetNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('card-highlight');
        setTimeout(() => el.classList.remove('card-highlight'), 1400);
      }
    }, 280);
  }
}

function updateCardVisuals(num,score){
  const col=getC(score),card=_el(`card-${num}`),cn=_el(`cn-${num}`),sv=_el(`sv-${num}`),sl=_el(`sl-${num}`);
  if(!card)return;
  card.style.borderLeftColor=col.border;
  if(cn){cn.style.background=col.bg;cn.style.boxShadow=col.glow!=='transparent'?`0 3px 14px ${col.glow}`:'none';cn.classList.remove('pop');void cn.offsetWidth;cn.classList.add('pop');setTimeout(()=>cn&&cn.classList.remove('pop'),320);}
  if(sv){sv.textContent=score!==null?`${score}`:'—';sv.style.background=col.bg;sv.style.borderColor=col.border;}
  if(sl){sl.value=score!==null?score:'0';applySliderStyle(sl,score);}
  const brl=ST.brolls.find(x=>x.num===num);
  if(brl&&!passes(brl)){card.style.opacity='0.35';card.style.transform='translateX(6px)';setTimeout(()=>renderCards(),500);}
}

/* ── Bengali / 2nd Language Script Parser ──────────────────── */
function parseAltScript(text) {
  const map = {};
  if (!text) return map;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/^#?(?:broll|b-roll|clip)?\s*(\d+(?:\.\d+)?)\s*[:\.\-–]?\s+(.+)/i);
    if (m) {
      map[parseFloat(m[1])] = m[2].trim();
    }
  }
  return map;
}

/* ── Load script ────────────────────────────────────────────── */
function loadScript(text, keepScores = true) {
  const ta = _el('script-textarea');
  const bnTa = _el('script-bengali-textarea');
  const enText = (text !== undefined && text !== null) ? text : (ta ? ta.value : '');
  const bnText = bnTa ? bnTa.value : (ST.bengaliScript || '');

  const brolls = parseScript(enText);
  if (!brolls.length && enText.trim().length > 0) {
    toast('⚠️ No valid lines found in English script');
    return;
  }

  createProjectBackup('Before Load Script');

  ST.brolls = brolls;
  ST.bengaliScript = bnText;
  ST.bengaliLines = parseAltScript(bnText);

  if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
    PROJECTS[ACTIVE_PID].script = enText;
    PROJECTS[ACTIVE_PID].bengaliScript = bnText;
    PROJECTS[ACTIVE_PID].bengaliLines = ST.bengaliLines;
  }

  if (!keepScores) ST.scores = {};
  collapseInput();
  save(true);
  renderProjectTabs();
  renderHeatmap();
  renderStats();
  renderCards(true);
  updateAllPromptChips();
  updateLineCopyPreview();
  toast(brolls.length ? `✅ Loaded ${brolls.length} B-roll clips` : 'ℹ️ Script cleared');
}


function collapseInput(){_el('input-section')?.classList.add('collapsed');ST.inputOpen=false;const ch=document.querySelector('#input-section .it-chevron');if(ch)ch.textContent='▼';}
function expandInput(){_el('input-section')?.classList.remove('collapsed');ST.inputOpen=true;const ch=document.querySelector('#input-section .it-chevron');if(ch)ch.textContent='▲';}

/* ── Filter Target & Chips ───────────────────────────────────── */
function renderFilterChips() {
  const wrap = _el('fb-chips');
  if (!wrap) return;
  wrap.innerHTML = '';

  const target = ST.filterTarget || 'main';
  const isReal = (target === 'real');

  const chips = isReal ? [
    { label: 'All', filter: 'all' },
    { label: 'Unrated', filter: 'unrated' },
    { label: 'Retry (0) ↺', filter: 'retry' },
    { label: 'Needs (<9)', filter: 'needs' },
    { label: '9+ / Covered ✅', filter: 'above:9' },
    { label: '10 🏆', filter: 'perfect' },
    { label: 'Covered ✔', filter: 'covered' },
  ] : [
    { label: 'All', filter: 'all' },
    { label: 'Unscored', filter: 'unscored' },
    { label: 'Needs Work (<9)', filter: 'needs' },
    { label: '9+ ✅', filter: 'above:9' },
    { label: '10 🏆', filter: 'perfect' },
  ];

  chips.forEach(c => {
    const btn = document.createElement('button');
    const isActive = ST.filter === c.filter;
    btn.className = 'chip' + (isActive ? ' active' : '') + (isReal ? ' real-chip' : '');
    btn.dataset.filter = c.filter;
    btn.textContent = c.label;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.addEventListener('click', () => setFilter(c.filter));
    wrap.appendChild(btn);
  });
}

function setFilterTarget(target) {
  ST.filterTarget = target;
  ST.filter = 'all'; // reset to all when switching target
  _el('fb-target-main')?.classList.toggle('active', target === 'main');
  _el('fb-target-real')?.classList.toggle('active', target === 'real');
  const belowInp = _el('fb-below'); if (belowInp) belowInp.value = '';
  const aboveInp = _el('fb-above'); if (aboveInp) aboveInp.value = '';
  renderFilterChips();
  renderCards();
  renderFilterCount();
  toast(target === 'real' ? '✏ Filter target: Real Rating' : '🎯 Filter target: Main Rating');
}

function setFilter(f) {
  ST.filter = f;
  const isReal = (ST.filterTarget === 'real');
  document.querySelectorAll('#fb-chips .chip').forEach(c => {
    const isAct = (c.dataset.filter === f);
    c.classList.toggle('active', isAct);
    c.setAttribute('aria-pressed', isAct ? 'true' : 'false');
  });
  _el('tb-needs-work')?.classList.toggle('active', f === 'needs');
  if (!f.startsWith('below:')) { const e = _el('fb-below'); if (e) e.value = ''; }
  if (!f.startsWith('above:')) { const e = _el('fb-above'); if (e) e.value = ''; }
  renderCards();
  renderFilterCount();
}


/* ── Line Copy & Filter Tool ────────────────────────────────── */
let LC_TARGET = 'main';

function getFilteredLines() {
  const minVal = _el('lc-min-score')?.value?.trim();
  const maxVal = _el('lc-max-score')?.value?.trim();
  const min = (minVal !== undefined && minVal !== '') ? parseFloat(minVal) : 0;
  const max = (maxVal !== undefined && maxVal !== '') ? parseFloat(maxVal) : 8.9;
  const includeUnscored = _el('lc-include-unscored') ? _el('lc-include-unscored').checked : true;
  const skipReal9 = _el('lc-skip-real-9') ? _el('lc-skip-real-9').checked : false;
  const target = LC_TARGET;

  const matches = [];

  for (const b of (ST.brolls || [])) {
    if (!b || !b.line) continue;

    // If skipReal9 is active, check if this line already has Real Rating >= 9 or is marked as Done
    if (skipReal9) {
      const lr = getLineRealRating(b.num);
      if (lr.isRated && lr.score >= 9) {
        continue;
      }
    }

    let score = null;
    let isRated = false;

    if (target === 'main') {
      const s = ST.scores[b.num] ?? null;
      if (s !== null) {
        score = s;
        isRated = true;
      }
    } else {
      const lr = getLineRealRating(b.num);
      if (lr.isRated) {
        score = lr.score;
        isRated = true;
      }
    }

    if (!isRated) {
      if (includeUnscored) {
        matches.push(b);
      }
    } else {
      if (score >= min && score <= max) {
        matches.push(b);
      }
    }
  }

  return matches;
}


function formatBatch5Lines(matches, includeNum, lineGap) {
  const formattedLines = matches.map(b => {
    const prefix = includeNum ? `${b.num} ` : '';
    return `${prefix}${b.line}`;
  });

  const chunks = [];
  for (let i = 0; i < formattedLines.length; i += 5) {
    const chunk = formattedLines.slice(i, i + 5);
    const itemSep = lineGap ? '\n\n' : '\n';
    chunks.push(chunk.join(itemSep));
  }

  // 2 line gap (2 blank lines = \n\n\n) between each batch of 5
  const batchSep = lineGap ? '\n\n\n\n' : '\n\n\n';
  return chunks.join(batchSep);
}

function updateLineCopyPreview() {
  const ta = _el('lc-preview-textarea');
  const countBadge = _el('lc-count-badge');
  const hint = _el('line-copy-hint');
  if (!ta) return;

  const matches = getFilteredLines();
  const includeNum = _el('lc-include-num') ? _el('lc-include-num').checked : true;
  const lineGap = _el('lc-line-gap') ? _el('lc-line-gap').checked : true;

  const text = formatBatch5Lines(matches, includeNum, lineGap);
  ta.value = text;

  const countText = `${matches.length} line${matches.length === 1 ? '' : 's'} matching filter`;
  if (countBadge) countBadge.textContent = countText;
  if (hint) hint.textContent = `${matches.length} lines`;
}

function setLineCopyTarget(target) {
  LC_TARGET = target;
  _el('lc-target-main')?.classList.toggle('active', target === 'main');
  _el('lc-target-real')?.classList.toggle('active', target === 'real');
  updateLineCopyPreview();
  toast(target === 'real' ? '✏ Line Copy: Real Rating' : '🎯 Line Copy: Main Rating');
}

function copyFilteredLines() {
  const ta = _el('lc-preview-textarea');
  if (!ta || !ta.value.trim()) {
    toast('⚠️ No lines match the filter');
    return;
  }
  const text = ta.value.trim();
  const matches = getFilteredLines();
  const doConfirm = () => toast(`📋 Copied ${matches.length} filtered lines in batches of 5!`);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doConfirm).catch(() => fbCopy(text, doConfirm));
  } else {
    fbCopy(text, doConfirm);
  }
}

function getNeedsWorkLines() {
  if (!ST.brolls || !ST.brolls.length) return [];
  const skipReal9 = _el('lc-skip-real-9') ? _el('lc-skip-real-9').checked : true;

  return ST.brolls.filter(b => {
    // If skip real >= 9 or covered is checked
    if (skipReal9) {
      if (ST.covered && ST.covered[b.num]) return false;
      const lr = getLineRealRating(b.num);
      if (lr.isRated && lr.score >= 9) return false;
    }

    if (LC_TARGET === 'main') {
      const s = ST.scores[b.num] ?? null;
      return s === null || s < 9;
    } else {
      const lr = getLineRealRating(b.num);
      return !lr.isRated || lr.score < 9;
    }
  });
}

function copyNeedsWorkLines() {
  const matches = getNeedsWorkLines();
  if (!matches.length) {
    toast('🎉 All lines are 9+! No lines need work.');
    return;
  }
  const includeNum = _el('lc-include-num') ? _el('lc-include-num').checked : true;
  const lineGap = _el('lc-line-gap') ? _el('lc-line-gap').checked : true;

  const text = formatBatch5Lines(matches, includeNum, lineGap);

  const doConfirm = () => toast(`📋 Copied ${matches.length} "Needs Work" lines in batches of 5!`);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doConfirm).catch(() => fbCopy(text, doConfirm));
  } else {
    fbCopy(text, doConfirm);
  }
}



/* ── Export / Import ────────────────────────────────────────── */

function exportData(){
  saveProjects(true);
  const ta = _el('script-textarea');
  const bnTa = _el('script-bengali-textarea');
  const scriptVal = ta ? ta.value : (PROJECTS[ACTIVE_PID]?.script || '');
  const bnScriptVal = bnTa ? bnTa.value : (PROJECTS[ACTIVE_PID]?.bengaliScript || ST.bengaliScript || '');

  const d = {
    v: 7,
    date: new Date().toISOString(),
    active: ACTIVE_PID,
    projects: JSON.parse(JSON.stringify(PROJECTS)),
    script: scriptVal,
    bengaliScript: bnScriptVal,
    bengaliLines: JSON.parse(JSON.stringify(ST.bengaliLines || {})),
    scores: JSON.parse(JSON.stringify(ST.scores)),
    prompts: JSON.parse(JSON.stringify(ST.prompts)),
    batches: JSON.parse(JSON.stringify(ST.batches)),
    usedSets: JSON.parse(JSON.stringify(ST.usedSets)),
    setRatings: JSON.parse(JSON.stringify(ST.setRatings || {})),
    ratingBatches: JSON.parse(JSON.stringify(ST.ratingBatches || [])),
    myRatings: JSON.parse(JSON.stringify(ST.myRatings || {})),
    covered: JSON.parse(JSON.stringify(ST.covered || {})),
    prefix: ST.prefix,
    suffix: ST.suffix,
    labelEnabled: ST.labelEnabled,
  };
  const json = JSON.stringify(d, null, 2);
  const filename = `broll-tracker-${new Date().toISOString().slice(0,10)}.json`;
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  toast('📥 Exported complete backup');
}

function importJSON(file){
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      createProjectBackup('Before Import JSON');

      // If full multi-project export
      if (d.projects && typeof d.projects === 'object' && Object.keys(d.projects).length) {
        for (const k of Object.keys(PROJECTS)) delete PROJECTS[k];
        for (const [k, v] of Object.entries(d.projects)) {
          PROJECTS[k] = {
            name: v.name || 'Script',
            script: v.script || '',
            bengaliScript: v.bengaliScript || '',
            bengaliLines: v.bengaliLines || parseAltScript(v.bengaliScript || ''),
            scores: _migrateScores(v.scores),
            prompts: _migratePrompts(v.prompts || {}),
            batches: v.batches || [],
            usedSets: _migrateUsedSets(v.usedSets),
            setRatings: _migrateSetRatings(v.setRatings || {}),
            ratingBatches: v.ratingBatches || [],
            myRatings: _migrateMyRatings(v.myRatings || {}),
            covered: _migrateCovered(v.covered || {})
          };
        }
        const activePid = (d.active && PROJECTS[d.active]) ? d.active : Object.keys(PROJECTS)[0];
        if (d.prefix !== undefined) ST.prefix = d.prefix;
        if (d.suffix !== undefined) ST.suffix = d.suffix;
        if (d.labelEnabled !== undefined) ST.labelEnabled = d.labelEnabled;
        saveGlobalCset();
        activateProject(activePid);
      } else {
        // Single project import format
        const pid = ACTIVE_PID || uid();
        const bnScript = d.bengaliScript || '';
        PROJECTS[pid] = {
          name: PROJECTS[pid]?.name || 'Script 1',
          script: d.script || '',
          bengaliScript: bnScript,
          bengaliLines: d.bengaliLines || parseAltScript(bnScript),
          scores: _migrateScores(d.scores),
          prompts: _migratePrompts(d.prompts || {}),
          batches: d.batches || [],
          usedSets: _migrateUsedSets(d.usedSets),
          setRatings: _migrateSetRatings(d.setRatings || {}),
          ratingBatches: d.ratingBatches || [],
          myRatings: _migrateMyRatings(d.myRatings || {}),
          covered: _migrateCovered(d.covered || {})
        };
        if (d.prefix !== undefined) ST.prefix = d.prefix;
        if (d.suffix !== undefined) ST.suffix = d.suffix;
        if (d.labelEnabled !== undefined) ST.labelEnabled = d.labelEnabled;
        saveGlobalCset();
        activateProject(pid);
      }

      save(true);
      toast('📤 Backup imported successfully');
    } catch(err) {
      console.error('Import error:', err);
      toast('❌ Invalid JSON file');
    }
  };
  r.readAsText(file);
}



function syncCsetUI(){
  const pre=_el('cset-prefix'), suf=_el('cset-suffix'), chk=_el('cset-label-toggle');
  if(pre)pre.value=ST.prefix; if(suf)suf.value=ST.suffix;
  if(chk)chk.checked=ST.labelEnabled !== false;
  updateCsetHint();
}

/* ── Toast & Modal ──────────────────────────────────────────── */
let _t;
function toast(msg){const el=_el('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(_t);_t=setTimeout(()=>el.classList.remove('show'),2800);}

function showModal(title, bodyHtml, onOk, onCancel = null, okText = 'Confirm', cancelText = 'Cancel', okClass = 'danger') {
  const titleEl = _el('modal-title'); if (titleEl) titleEl.textContent = title;
  const bodyEl = _el('modal-body'); if (bodyEl) bodyEl.innerHTML = bodyHtml;
  const ov = _el('modal-overlay'); if (!ov) return;
  ov.classList.add('show');

  const okBtn = _el('modal-ok');
  if (okBtn) {
    okBtn.textContent = okText;
    okBtn.className = `hbtn ${okClass}`;
    okBtn.onclick = () => {
      ov.classList.remove('show');
      if (onOk) onOk();
    };
  }

  const cancelBtn = _el('modal-cancel');
  if (cancelBtn) {
    cancelBtn.textContent = cancelText;
    cancelBtn.onclick = () => {
      ov.classList.remove('show');
      if (onCancel) onCancel();
    };
  }

  ov.onclick = ev => {
    if (ev.target === ov) {
      ov.classList.remove('show');
      if (onCancel) onCancel();
    }
  };
}

function _el(id){return document.getElementById(id);}
function setText(id,v){const e=_el(id);if(e)e.textContent=v;}
function setStyle(id,p,v){const e=_el(id);if(e)e.style[p]=v;}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ── 10 Rolling Local Backups System ────────────────────────── */
let _workingStateBeforePreview = null;

function createProjectBackup(reason = 'Manual Save') {
  if (!ACTIVE_PID || !PROJECTS[ACTIVE_PID]) return;
  const pid = ACTIVE_PID;
  const proj = PROJECTS[pid];
  if (!proj) return;

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('br_backups_' + pid) || '[]');
  } catch {}

  const now = Date.now();
  const backup = {
    id: 'bk_' + now.toString(36) + Math.random().toString(36).slice(2, 5),
    pid,
    name: proj.name || 'Script',
    reason,
    date: now,
    dateStr: new Date(now).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    brollsCount: ST.brolls.length,
    scoresCount: Object.keys(ST.scores || {}).length,
    promptsCount: Object.values(ST.prompts || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0),
    ratingsCount: Object.values(ST.setRatings || {}).reduce((acc, obj) => acc + Object.keys(obj || {}).length, 0),
    data: JSON.parse(JSON.stringify(proj))
  };

  list.unshift(backup);
  if (list.length > 10) list = list.slice(0, 10);
  try {
    localStorage.setItem('br_backups_' + pid, JSON.stringify(list));
  } catch {}
  renderBackupsListUI();
}

function renderBackupsListUI() {
  const container = _el('backups-list-container');
  if (!container) return;
  const pid = ACTIVE_PID;
  if (!pid) {
    container.innerHTML = '<span style="font-size:11px;color:var(--text-3);">No active script</span>';
    return;
  }

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('br_backups_' + pid) || '[]');
  } catch {}

  if (!list.length) {
    container.innerHTML = '<span style="font-size:11px;color:var(--text-3);padding:6px 0;">No backups created yet. Click "＋ Save Backup Now" to create one.</span>';
    return;
  }

  container.innerHTML = '';
  list.forEach(b => {
    const card = document.createElement('div');
    card.className = 'backup-card';
    card.innerHTML = `
      <div class="backup-card-info">
        <div class="backup-card-title">
          <span>🕒 ${escHtml(b.dateStr)}</span>
          <span class="backup-tag">${escHtml(b.reason || 'Backup')}</span>
        </div>
        <div class="backup-card-sub">${b.brollsCount} B-rolls · ${b.scoresCount} scored · ${b.promptsCount} prompts · ${b.ratingsCount} ratings</div>
      </div>
      <div class="backup-card-actions">
        <button class="hbtn primary btn-preview-backup" style="font-size:10.5px;padding:3px 8px;">👁️ Load &amp; Preview</button>
        <button class="hbtn danger btn-del-backup" style="font-size:10px;padding:3px 6px;" title="Delete backup">🗑</button>
      </div>
    `;

    card.querySelector('.btn-preview-backup').addEventListener('click', () => previewBackup(b.id));
    card.querySelector('.btn-del-backup').addEventListener('click', () => deleteBackup(b.id));
    container.appendChild(card);
  });
}

function deleteBackup(backupId) {
  const pid = ACTIVE_PID;
  if (!pid) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem('br_backups_' + pid) || '[]'); } catch {}
  list = list.filter(b => b.id !== backupId);
  try { localStorage.setItem('br_backups_' + pid, JSON.stringify(list)); } catch {}
  renderBackupsListUI();
  toast('🗑 Backup deleted');
}

function previewBackup(backupId) {
  const pid = ACTIVE_PID;
  if (!pid) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem('br_backups_' + pid) || '[]'); } catch {}
  const backup = list.find(b => b.id === backupId);
  if (!backup) { toast('⚠️ Backup not found'); return; }

  // Save current working state to revert if cancelled
  _workingStateBeforePreview = JSON.parse(JSON.stringify(PROJECTS[pid]));

  // Temporarily load backup state
  PROJECTS[pid] = JSON.parse(JSON.stringify(backup.data));
  activateProject(pid);
  switchBottomTab('p');

  // Inject floating preview banner
  const existing = _el('backup-preview-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'backup-preview-banner';
  banner.className = 'backup-preview-banner';
  banner.innerHTML = `
    <div class="bpb-left">
      <span class="bpb-title">⏮ Previewing Backup: <strong>${escHtml(backup.dateStr)}</strong></span>
      <span class="bpb-sub">Inspect cards and ratings. Click Confirm to make this backup the latest save, or Cancel.</span>
    </div>
    <div class="bpb-actions">
      <button class="hbtn primary" id="btn-confirm-restore-backup">✔ Confirm as Latest Save</button>
      <button class="hbtn danger" id="btn-cancel-restore-backup">✕ Cancel</button>
    </div>
  `;

  banner.querySelector('#btn-confirm-restore-backup').addEventListener('click', () => {
    _workingStateBeforePreview = null;
    banner.remove();
    save(true);
    createProjectBackup('Restored Backup');
    toast(`✅ Restored backup from ${backup.dateStr} as latest save!`);
  });

  banner.querySelector('#btn-cancel-restore-backup').addEventListener('click', () => {
    if (_workingStateBeforePreview) {
      PROJECTS[pid] = JSON.parse(JSON.stringify(_workingStateBeforePreview));
      _workingStateBeforePreview = null;
      activateProject(pid);
    }
    banner.remove();
    toast('↩ Cancelled preview, returned to current save.');
  });

  const appEl = _el('app');
  if (appEl) appEl.insertBefore(banner, appEl.firstChild);
}

/* ── Settings Center Sync ──────────────────────────────────── */
function syncSettingsUI() {
  const comp = _el('setting-compact-view');
  if (comp) comp.checked = !!ST.compactView;

  const ovScroll = _el('setting-overview-scroll');
  if (ovScroll) ovScroll.checked = !!ST.overviewScroll;

  const slLock = _el('setting-slider-lock');
  if (slLock) slLock.checked = !!ST.mainRatingLocked;

  const ad9 = _el('setting-autodone-9');
  if (ad9) ad9.checked = (ST.autoDone9 !== false);

  const showBn = _el('setting-show-bengali');
  if (showBn) showBn.checked = (ST.showBengali !== false);

  const qr1 = _el('setting-qr-tier1');
  if (qr1) qr1.value = ST.quickRateTier1 ?? 5;

  const qr2 = _el('setting-qr-tier2');
  if (qr2) qr2.value = ST.quickRateTier2 ?? 9;

  renderBackupsListUI();
}


function updateRatingLockUI() {
  const btn = _el('rating-lock-btn');
  const ic = _el('lock-icon');
  const tx = _el('lock-text');
  const isLocked = !!ST.mainRatingLocked;
  if (btn) {
    btn.classList.toggle('locked', isLocked);
    btn.classList.toggle('unlocked', !isLocked);
    btn.title = isLocked ? 'Main rating is LOCKED to prevent mistouch (click to unlock)' : 'Main rating is UNLOCKED (click to lock)';
  }
  if (ic) ic.textContent = isLocked ? '🔒' : '🔓';
  if (tx) tx.textContent = isLocked ? 'Locked' : 'Unlocked';

  document.querySelectorAll('.score-slider').forEach(inp => {
    inp.disabled = isLocked;
  });
  document.querySelectorAll('.slider-wrap').forEach(sw => {
    sw.classList.toggle('is-locked', isLocked);
  });
  syncSettingsUI();
}

function toggleMainRatingLock() {
  ST.mainRatingLocked = !ST.mainRatingLocked;
  try { localStorage.setItem('br_main_rating_locked', ST.mainRatingLocked ? 'true' : 'false'); } catch {}
  updateRatingLockUI();
  toast(ST.mainRatingLocked ? '🔒 Main rating locked to prevent accidental changes' : '🔓 Main rating unlocked for editing');
}

/* ── Compact Cards View (Hide Prompt Boxes) ─────────────────── */
function updateCompactViewUI() {
  const isCompact = !!ST.compactView;
  _el('cards-container')?.classList.toggle('compact-cards', isCompact);
  _el('tb-compact-toggle')?.classList.toggle('active', isCompact);
  syncSettingsUI();
}

function toggleCompactView() {
  ST.compactView = !ST.compactView;
  try { localStorage.setItem('br_compact_cards', ST.compactView ? 'true' : 'false'); } catch {}
  updateCompactViewUI();
  toast(ST.compactView ? '🗜️ Compact View: Prompts hidden' : '👁️ Normal View: Prompts visible');
}


/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  loadProjects();
  const proj = PROJECTS[ACTIVE_PID] || {};
  ST.scores        = proj.scores        || {};
  ST.prompts       = _migratePrompts(proj.prompts);
  ST.batches       = proj.batches       || [];
  ST.usedSets      = proj.usedSets      || {};
  ST.setRatings    = _migrateSetRatings(proj.setRatings);
  ST.ratingBatches = proj.ratingBatches || [];
  ST.myRatings     = proj.myRatings     || {};
  ST.covered       = _migrateCovered(proj.covered || {});
  ST.brolls        = parseScript(proj.script || '');

  loadGlobalCset();   // Load prefix/suffix from global key

  try {
    const savedLock = localStorage.getItem('br_main_rating_locked');
    ST.mainRatingLocked = (savedLock !== 'false'); // default true
  } catch {}

  try {
    const savedCompact = localStorage.getItem('br_compact_cards');
    ST.compactView = (savedCompact !== 'false'); // default true
  } catch {
    ST.compactView = true;
  }


  try {
    const savedScroll = localStorage.getItem('br_overview_scroll');
    ST.overviewScroll = (savedScroll === 'true');
  } catch {}

  const ta = _el('script-textarea'); if (ta) ta.value = proj.script || '';

  _el('library-section')?.classList.add('collapsed');
  _el('cset-section')?.classList.add('collapsed');

  if (ST.brolls.length) collapseInput();


  renderProjectTabs();
  renderFilterChips();
  renderHeatmap(); renderStats(); renderCards(!!ST.brolls.length);
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge();

  syncCsetUI(); updateSratingHint(); renderRatingTabs(); renderRatingPanel(); refreshUR();

  updateLineCopyPreview();
  updateRatingLockUI();
  updateOverviewModeUI();

  _el('hm-view-toggle')?.addEventListener('click', toggleOverviewScrollMode);
  _el('rating-lock-btn')?.addEventListener('click', toggleMainRatingLock);

  scrollToLastScoredBroll();
  initFirebaseSync();


  let rT; window.addEventListener('resize',()=>{clearTimeout(rT);rT=setTimeout(renderHeatmap,120);});

  // Vertical page scroll -> updates overview bar and highlights in scroll mode
  window.addEventListener('scroll', () => {
    if (!ST.overviewScroll) return;
    if (!_overviewScrollTicking) {
      _overviewScrollTicking = true;
      requestAnimationFrame(() => {
        syncOverviewBarToScroll(true);
        _overviewScrollTicking = false;
      });
    }
  }, { passive: true });





  // Keyboard: Ctrl+Z, Ctrl+Y
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&!e.altKey){
      if(e.key==='z'&&!e.shiftKey){e.preventDefault();doUndo();}
      if(e.key==='y'||(e.key==='z'&&e.shiftKey)){e.preventDefault();doRedo();}
    }
  });

  /* Script */
  /* Script Tabs & Load */
  const tabEn = _el('tab-script-en');
  const tabBn = _el('tab-script-bn');
  const scriptTa = _el('script-textarea');
  const bnTa = _el('script-bengali-textarea');

  tabEn?.addEventListener('click', () => {
    tabEn.classList.add('active');
    tabBn?.classList.remove('active');
    scriptTa?.classList.remove('hidden');
    bnTa?.classList.add('hidden');
  });

  tabBn?.addEventListener('click', () => {
    tabBn.classList.add('active');
    tabEn?.classList.remove('active');
    bnTa?.classList.remove('hidden');
    scriptTa?.classList.add('hidden');
  });

  _el('btn-load')?.addEventListener('click', () => {
    loadScript();
  });
  scriptTa?.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') _el('btn-load')?.click();
  });
  bnTa?.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') _el('btn-load')?.click();
  });

  const autoPad = (ta) => {
    setTimeout(() => {
      if (!ta.value.endsWith('\n\n')) ta.value = ta.value.trimEnd() + '\n\n';
      ta.scrollTop = ta.scrollHeight;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 10);
  };
  scriptTa?.addEventListener('paste', () => autoPad(scriptTa));
  bnTa?.addEventListener('paste', () => autoPad(bnTa));
  _el('prompt-textarea')?.addEventListener('paste', () => autoPad(_el('prompt-textarea')));
  _el('srating-textarea')?.addEventListener('paste', () => autoPad(_el('srating-textarea')));

  _el('input-toggle')?.addEventListener('click',()=>{if(ST.inputOpen)collapseInput();else expandInput();});

  /* Header */
  _el('btn-clear')?.addEventListener('click',()=>showModal('Clear this script?','Script + scores + prompts for this script will be removed.',()=>{
    const sta = _el('script-textarea'); if (sta) sta.value='';
    const bta = _el('script-bengali-textarea'); if (bta) bta.value='';
    ST.brolls=[];ST.scores={};ST.prompts={};ST.batches=[];ST.usedSets={};ST.setRatings={};ST.ratingBatches=[];ST.activeRatingBatch='new';
    ST.bengaliScript=''; ST.bengaliLines={};
    save(); expandInput();
    renderProjectTabs();
    renderHeatmap();renderStats();renderCards();renderBatchTabs();renderBatchPanel();renderLibraryView();updateLibBadge();updateSratingHint();renderRatingTabs();renderRatingPanel();
    toast('🗑️ Cleared');
  }));
  _el('btn-reset')?.addEventListener('click', () => {
    showModal(
      'Reset all ticks for this script?',
      'All green "copied" checkmarks for all prompt sets in this script will be unticked. Prompts, scores, and ratings will remain untouched.',
      () => {
        clearCopyHistory();
      }
    );
  });

  _el('btn-undo')?.addEventListener('click',doUndo);
  _el('btn-redo')?.addEventListener('click',doRedo);
  _el('btn-export')?.addEventListener('click',exportData);
  _el('btn-import')?.addEventListener('click',()=>_el('file-input')?.click());
  _el('file-input')?.addEventListener('change',e=>{if(e.target.files[0]){importJSON(e.target.files[0]);e.target.value='';}});

  /* Copy Settings — handlers save to GLOBAL cset key */
  _el('cset-toggle')?.addEventListener('click',()=>{
    const sec=_el('cset-section');if(!sec)return;
    ST.csetOpen=!ST.csetOpen;sec.classList.toggle('collapsed',!ST.csetOpen);
    const ch = document.querySelector('#cset-toggle .it-chevron');
    if (ch) ch.textContent=ST.csetOpen?'▲':'▼';
  });
  _el('cset-prefix')?.addEventListener('input',e=>{ST.prefix=e.target.value;saveGlobalCset();updateCsetHint();});
  _el('cset-suffix')?.addEventListener('input',e=>{ST.suffix=e.target.value;saveGlobalCset();updateCsetHint();});
  _el('cset-label-toggle')?.addEventListener('change', e => {
    ST.labelEnabled = e.target.checked;
    saveGlobalCset();
    updateCsetHint();
    toast(ST.labelEnabled ? '🏷️ B-roll & Set tag enabled' : '🏷️ B-roll & Set tag disabled');
  });
  _el('cset-clear-pre')?.addEventListener('click',()=>{ST.prefix='';const cp=_el('cset-prefix');if(cp)cp.value='';saveGlobalCset();updateCsetHint();toast('Prefix cleared');});
  _el('cset-clear-suf')?.addEventListener('click',()=>{ST.suffix='';const cs=_el('cset-suffix');if(cs)cs.value='';saveGlobalCset();updateCsetHint();toast('Suffix cleared');});

  /* Settings Center Switch Listeners */
  _el('setting-compact-view')?.addEventListener('change', e => {
    ST.compactView = e.target.checked;
    try { localStorage.setItem('br_compact_cards', ST.compactView ? 'true' : 'false'); } catch {}
    updateCompactViewUI();
    toast(ST.compactView ? '🗜️ Compact View: Prompts hidden' : '👁️ Normal View: Prompts visible');
  });

  _el('setting-overview-scroll')?.addEventListener('change', () => {
    toggleOverviewScrollMode();
    syncSettingsUI();
  });

  _el('setting-slider-lock')?.addEventListener('change', () => {
    toggleMainRatingLock();
    syncSettingsUI();
  });

  _el('setting-autodone-9')?.addEventListener('change', e => {
    ST.autoDone9 = e.target.checked;
    try { localStorage.setItem('br_auto_done_9', ST.autoDone9 ? 'true' : 'false'); } catch {}
    toast(ST.autoDone9 ? '✔ Auto-Done on 9+ enabled' : '◻ Auto-Done on 9+ disabled');
  });

  _el('setting-show-bengali')?.addEventListener('change', e => {
    ST.showBengali = e.target.checked;
    try { localStorage.setItem('br_show_bengali', ST.showBengali ? 'true' : 'false'); } catch {}
    renderCards(false);
    toast(ST.showBengali ? '🇧🇩 Bengali script visible' : 'Bengali script hidden');
  });

  _el('setting-qr-tier1')?.addEventListener('change', e => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      ST.quickRateTier1 = val;
      try { localStorage.setItem('br_qr_tier1', val); } catch {}
      toast(`⚡ Tier 1 quick-rate set to ${val}`);
    }
  });

  _el('setting-qr-tier2')?.addEventListener('change', e => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      ST.quickRateTier2 = val;
      try { localStorage.setItem('br_qr_tier2', val); } catch {}
      toast(`⚡ Tier 2 quick-rate set to ${val}`);
    }
  });

  _el('btn-create-manual-backup')?.addEventListener('click', () => {
    createProjectBackup('Manual Backup');
    toast('💾 Backup saved successfully!');
  });

  _el('setting-force-sync')?.addEventListener('click', () => {
    toast('🔄 Cloud sync in progress…');
    pushToFirebase(true);
  });

  _el('setting-export-json')?.addEventListener('click', exportData);
  _el('setting-import-json')?.addEventListener('click', () => _el('file-input')?.click());

  /* Line Copy & Filter section */
  _el('line-copy-toggle')?.addEventListener('click', () => {
    const sec = _el('line-copy-section'); if (!sec) return;
    sec.classList.toggle('collapsed');
    const isCollapsed = sec.classList.contains('collapsed');
    const ch = document.querySelector('#line-copy-toggle .it-chevron');
    if (ch) ch.textContent = isCollapsed ? '▼' : '▲';
    if (!isCollapsed) updateLineCopyPreview();
  });
  _el('lc-target-main')?.addEventListener('click', () => setLineCopyTarget('main'));
  _el('lc-target-real')?.addEventListener('click', () => setLineCopyTarget('real'));
  _el('lc-min-score')?.addEventListener('input', updateLineCopyPreview);
  _el('lc-max-score')?.addEventListener('input', updateLineCopyPreview);
  _el('lc-include-unscored')?.addEventListener('change', updateLineCopyPreview);
  _el('lc-skip-real-9')?.addEventListener('change', updateLineCopyPreview);
  _el('lc-include-num')?.addEventListener('change', updateLineCopyPreview);
  _el('lc-line-gap')?.addEventListener('change', updateLineCopyPreview);
  _el('btn-copy-filtered-lines')?.addEventListener('click', copyFilteredLines);
  _el('btn-copy-needs-work-lines')?.addEventListener('click', copyNeedsWorkLines);

  /* Set Ratings section */
  _el('srating-toggle')?.addEventListener('click',()=>{
    const sec=_el('srating-section');if(!sec)return;
    sec.classList.toggle('collapsed');
    const ch = document.querySelector('#srating-toggle .it-chevron');
    if (ch) ch.textContent=sec.classList.contains('collapsed')?'▼':'▲';
  });
  _el('btn-apply-ratings')?.addEventListener('click',()=>{
    const t=_el('srating-textarea')?.value.trim();if(!t){toast('⚠️ Paste rating lines first');return;}
    requestApplySetRatings(t);
  });
  _el('btn-paste-ratings')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('⚠️ Clipboard is empty'); return; }
      const ta = _el('srating-textarea');
      if (!ta) return;
      if (ta.value.trim()) {
        ta.value = ta.value.trimEnd() + '\n\n' + text;
      } else {
        ta.value = text;
      }
      setTimeout(() => {
        if (!ta.value.endsWith('\n\n')) ta.value = ta.value.trimEnd() + '\n\n';
        ta.scrollTop = ta.scrollHeight;
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.focus();
      }, 10);
      toast('📋 Pasted ratings from clipboard');
    } catch {
      toast('⚠️ Cannot read clipboard — use Ctrl+V');
    }
  });
  _el('btn-clear-rating-input')?.addEventListener('click',()=>{const ta=_el('srating-textarea');if(ta)ta.value='';});
  _el('btn-clear-all-ratings')?.addEventListener('click',()=>showModal('Clear all set ratings?','All set ratings and why text will be removed.',()=>{
    ST.setRatings={};ST.ratingBatches=[];ST.activeRatingBatch='new';save();updateAllPromptChips();updateSratingHint();renderRatingTabs();renderRatingPanel();toast('🗑️ Set ratings cleared');
  }));

  /* Clear copy history — event delegation on project-bar */
  _el('project-bar')?.addEventListener('click',e=>{
    if(e.target.closest('#btn-clear-copy')){
      showModal('Clear copy history?','All green "copied" marks for this script will be removed.',()=>{
        clearCopyHistory();toast('⟲ Copy history cleared');
      });
    }
  });

  /* Filter Target & Inputs */
  _el('fb-target-main')?.addEventListener('click', () => setFilterTarget('main'));
  _el('fb-target-real')?.addEventListener('click', () => setFilterTarget('real'));

  _el('fb-below')?.addEventListener('input', e => {
    const v = e.target.value.trim();
    if (!v) { setFilter('all'); return; }
    const n = parseFloat(v);
    if (!isNaN(n)) {
      ST.filter = `below:${n}`;
      document.querySelectorAll('#fb-chips .chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      renderCards();
      renderFilterCount();
    }
  });

  _el('fb-above')?.addEventListener('input', e => {
    const v = e.target.value.trim();
    if (!v) { setFilter('all'); return; }
    const n = parseFloat(v);
    if (!isNaN(n)) {
      ST.filter = `above:${n}`;
      document.querySelectorAll('#fb-chips .chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      renderCards();
      renderFilterCount();
    }
  });

  /* Sort */
  document.querySelectorAll('.sort-btn').forEach(btn=>btn.addEventListener('click',()=>{ST.sortBy=btn.dataset.sort;document.querySelectorAll('.sort-btn').forEach(b=>b.classList.toggle('active',b.dataset.sort===ST.sortBy));renderCards();}));

  /* Library */
  _el('library-toggle')?.addEventListener('click',()=>{const sec=_el('library-section');if(!sec)return;ST.libOpen=!ST.libOpen;sec.classList.toggle('collapsed',!ST.libOpen);const ch=document.querySelector('#library-toggle .it-chevron');if(ch)ch.textContent=ST.libOpen?'▲':'▼';});
  _el('btn-import-prompts')?.addEventListener('click',()=>{const t=_el('prompt-textarea')?.value.trim();if(!t){toast('⚠️ Paste prompt batch first');return;}requestImportPrompts(t);});
  _el('btn-clear-prompt-input')?.addEventListener('click',()=>{const pta=_el('prompt-textarea');if(pta)pta.value='';});
  _el('btn-clear-prompts')?.addEventListener('click',()=>showModal('Clear ALL prompts?','Removes every prompt and all batch history.',()=>{
    ST.prompts={};ST.batches=[];ST.usedSets={};ST.activeBatch='new';
    save();updateAllPromptChips();renderBatchTabs();renderBatchPanel();renderLibraryView();updateLibBadge();toast('🗑️ All prompts cleared');
  }));

  /* Paste button in library */
  _el('btn-paste-prompt')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('⚠️ Clipboard is empty'); return; }
      const ta = _el('prompt-textarea');
      if (!ta) return;
      if (ta.value.trim()) {
        ta.value = ta.value.trimEnd() + '\n\n' + text;
      } else {
        ta.value = text;
      }
      setTimeout(() => {
        if (!ta.value.endsWith('\n\n')) ta.value = ta.value.trimEnd() + '\n\n';
        ta.scrollTop = ta.scrollHeight;
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.focus();
      }, 10);
      toast('📋 Pasted from clipboard');
    } catch {
      toast('⚠️ Cannot read clipboard — use Ctrl+V');
    }
  });

  /* Jump to top / bottom */
  const jt = _el('jump-top'), jb = _el('jump-bottom');
  window.addEventListener('scroll', () => {
    const atTop = scrollY < 300;
    const atBottom = (window.innerHeight + scrollY) >= document.body.scrollHeight - 300;
    jt?.classList.toggle('visible', !atTop);
    jb?.classList.toggle('visible', !atBottom);
  }, { passive: true });
  jt?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  jb?.addEventListener('click', () => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  if (document.body.scrollHeight > window.innerHeight + 300) jb?.classList.add('visible');

  /* ── Bottom Tab Bar ─────────────────────────────────────── */
  document.querySelectorAll('.btab').forEach(b => {
    b.addEventListener('click', () => switchBottomTab(b.dataset.tab));
  });


  /* ── Toolbar 🔍: toggle filter bar ──────────────────────── */
  _el('tb-filter-toggle')?.addEventListener('click', () => {
    const fb = _el('filter-bar');
    if (!fb) return;
    const hidden = fb.classList.toggle('hidden');
    _el('tb-filter-toggle')?.classList.toggle('active', !hidden);
    switchBottomTab('p');
  });


  /* ── Toolbar ⚡: Needs Work (<9) quick filter ────────────── */
  _el('tb-needs-work')?.addEventListener('click', () => {
    switchBottomTab('p');
    if (ST.filter === 'needs') {
      setFilter('all');
    } else {
      setFilter('needs');
      toast('⚡ Filter: Needs Work (<9)');
    }
  });

  /* ── Toolbar 🗜️: Compact View (hide prompts) ────────────── */
  updateCompactViewUI();
  _el('tb-compact-toggle')?.addEventListener('click', toggleCompactView);




  /* Service Worker for PWA / TWA */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(
        reg => console.log('SW registered:', reg.scope),
        err => console.warn('SW reg failed:', err)
      );
    });
  }
});

