'use strict';

/* ══════════════════════════════════════════════════════════════
   B-ROLL TRACKER v5
   New: Used-Set Tracking per score · Global Prefix/Suffix
   ══════════════════════════════════════════════════════════════ */

/* ── Score Colors ──────────────────────────────────────────── */
const C = {
  null: { bg:'#16162a', border:'rgba(255,255,255,0.05)', glow:'transparent' },
  0:    { bg:'#16162a', border:'rgba(255,255,255,0.05)', glow:'transparent' },
  0.5:  { bg:'#420003', border:'#620006',                glow:'rgba(98,0,6,0.40)' },
  1:    { bg:'#5c0000', border:'#7e0000',                glow:'rgba(126,0,0,0.45)' },
  1.5:  { bg:'#680808', border:'#8a0a0a',                glow:'rgba(138,10,10,0.43)' },
  2:    { bg:'#721010', border:'#961414',                glow:'rgba(150,20,20,0.42)' },
  2.5:  { bg:'#7c1c1c', border:'#a22222',                glow:'rgba(162,34,34,0.40)' },
  3:    { bg:'#862626', border:'#ae2e2e',                glow:'rgba(174,46,46,0.38)' },
  3.5:  { bg:'#923030', border:'#ba3838',                glow:'rgba(186,56,56,0.36)' },
  4:    { bg:'#9e3c3c', border:'#c64a4a',                glow:'rgba(198,74,74,0.34)' },
  4.5:  { bg:'#a84228', border:'#cc5030',                glow:'rgba(204,80,48,0.34)' },
  5:    { bg:'#b84c1a', border:'#dc6020',                glow:'rgba(220,96,32,0.34)' },
  5.5:  { bg:'#bf5c14', border:'#de7018',                glow:'rgba(222,112,24,0.34)' },
  6:    { bg:'#b47600', border:'#d88e00',                glow:'rgba(216,142,0,0.36)' },
  6.5:  { bg:'#a68800', border:'#c8a400',                glow:'rgba(200,164,0,0.34)' },
  7:    { bg:'#888800', border:'#b4b200',                glow:'rgba(180,178,0,0.36)' },
  7.5:  { bg:'#4e8800', border:'#6aac00',                glow:'rgba(106,172,0,0.34)' },
  8:    { bg:'#2e5e14', border:'#428020',                glow:'rgba(66,128,32,0.28)' },
  8.5:  { bg:'#106810', border:'#189018',                glow:'rgba(24,144,24,0.36)' },
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

function setApplyingRemote(val) {
  _isApplyingRemote = !!val;
  if (_remoteTimer) clearTimeout(_remoteTimer);
  if (val) {
    _remoteTimer = setTimeout(() => { _isApplyingRemote = false; }, 800);
  }
}

function updateSyncUI(status, text) {
  const dot = _el('sync-dot');
  const txt = _el('sync-text');
  const pill = _el('sync-status');
  if (!dot || !txt) return;

  dot.className = 'sync-dot';
  if (status === 'syncing') {
    dot.classList.add('syncing');
    txt.textContent = text || 'Syncing…';
    if (pill) pill.title = 'Uploading changes to Firebase Cloud…';
  } else if (status === 'offline') {
    dot.classList.add('offline');
    txt.textContent = text || 'Offline';
    if (pill) pill.title = 'Offline or cloud disconnected. Local storage is active.';
  } else {
    txt.textContent = text || 'Cloud';
    if (pill) pill.title = 'Firebase Cloud Sync: Connected & synced across devices.';
  }
}

function pushToFirebase(immediate = false) {
  if (!_fbRef || _isApplyingRemote) return;

  if (_fbSyncTimer) clearTimeout(_fbSyncTimer);
  updateSyncUI('syncing', 'Syncing…');

  const doPush = () => {
    try {
      const ta = _el('script-textarea');
      const savedScript = ta && ta.value !== undefined && ta.value !== null
        ? ta.value
        : (PROJECTS[ACTIVE_PID]?.script || '');

      if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
        PROJECTS[ACTIVE_PID].script = savedScript;
      }

      const payload = {
        active: ACTIVE_PID,
        projects: JSON.parse(JSON.stringify(PROJECTS)),
        globalCset: { prefix: ST.prefix || '', suffix: ST.suffix || '', labelEnabled: ST.labelEnabled !== false },
        lastUpdatedBy: CLIENT_ID,
        updatedAt: Date.now()
      };

      _fbRef.set(payload)
        .then(() => {
          updateSyncUI('synced', 'Cloud');
        })
        .catch(err => {
          console.error('Firebase save error:', err);
          updateSyncUI('offline', 'Sync Error');
        });
    } catch (err) {
      console.error('Firebase push preparation error:', err);
      updateSyncUI('offline', 'Sync Error');
    }
  };

  if (immediate) {
    doPush();
  } else {
    _fbSyncTimer = setTimeout(doPush, 100);
  }
}

function applyRemoteData(data) {
  if (!data || !data.projects || Object.keys(data.projects).length === 0) return;
  setApplyingRemote(true);
  try {

    // 1. Sync projects dictionary
    for (const k of Object.keys(PROJECTS)) delete PROJECTS[k];
    for (const [k, v] of Object.entries(data.projects)) {
      PROJECTS[k] = {
        name: v.name || 'Script',
        script: v.script || '',
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
    if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
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
    renderLibraryView();
    updateLibBadge();
    renderRatingTabs();
    renderRatingPanel();
    updateSratingHint();
    renderMyDatabase();
    updateSyncUI('synced', 'Cloud');
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

    // Monitor connection state
    _fbDb.ref('.info/connected').on('value', snap => {
      const connected = !!snap.val();
      if (!connected) {
        updateSyncUI('offline', 'Offline');
      } else {
        updateSyncUI('synced', 'Cloud');
      }
    });

    // Listen for remote updates
    let isInitialRead = true;
    _fbRef.on('value', snap => {
      const data = snap.val();
      if (!data || !data.projects || Object.keys(data.projects).length === 0) {
        // Cloud is empty, push current local state to initialize it
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
      // If change originated from this client tab, skip
      if (data.lastUpdatedBy === CLIENT_ID) {
        return;
      }
      applyRemoteData(data);
    });

    // Click on sync status pill to manual force sync
    _el('sync-status')?.addEventListener('click', () => {
      toast('🔄 Syncing with Cloud…');
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
      ST.labelEnabled = (d.labelEnabled !== false); // default true
      return;
    }
  } catch {}
}

/* ── Multi-Project (Multi-Script) Store ─────────────────────── */
const PROJECTS   = {};
let   ACTIVE_PID = null;
const PROJ_KEY   = 'br_v6_proj';

function _projData(name) {
  return { name: name||'Script 1', script:'', scores:{}, prompts:{}, batches:[], usedSets:{}, setRatings:{}, ratingBatches:[], myRatings:{}, covered:{} };
}

function saveProjects(immediate = false) {
  if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
    // Read script from DOM; fall back to what's already saved (never lose it)
    const ta = _el('script-textarea');
    const savedScript = ta && ta.value !== undefined && ta.value !== null
      ? ta.value
      : (PROJECTS[ACTIVE_PID].script || '');
    PROJECTS[ACTIVE_PID] = {
      ...PROJECTS[ACTIVE_PID],
      script:        savedScript,
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
  try { localStorage.setItem(PROJ_KEY, JSON.stringify({ active: ACTIVE_PID, projects: PROJECTS })); } catch {}
  saveGlobalCset();
  pushToFirebase(immediate); // Sync to Firebase Cloud
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
          scores: _migrateScores(v.scores),
          prompts: _migratePrompts(v.prompts),
          usedSets: _migrateUsedSets(v.usedSets),
          setRatings: _migrateSetRatings(v.setRatings),
          myRatings: _migrateMyRatings(v.myRatings),
          covered: _migrateCovered(v.covered)
        };
      }
      ACTIVE_PID = (raw.active && PROJECTS[raw.active]) ? raw.active : Object.keys(PROJECTS)[0];
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
    PROJECTS[pid] = { name:'Script 1', script:sc, scores:s, prompts:pr, batches:ba, usedSets:us, setRatings:{}, ratingBatches:[], myRatings:{} };
    ACTIVE_PID = pid;
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
  saveProjects();
}

function activateProject(pid) {
  if (!PROJECTS[pid]) return;
  saveProjects();
  ACTIVE_PID = pid;
  const proj = PROJECTS[pid];
  ST.scores            = proj.scores        || {};
  ST.prompts           = _migratePrompts(proj.prompts);
  ST.batches           = proj.batches       || [];
  ST.usedSets          = proj.usedSets      || {};
  ST.setRatings        = _migrateSetRatings(proj.setRatings);
  ST.ratingBatches     = proj.ratingBatches || [];
  ST.myRatings         = proj.myRatings     || {};
  ST.covered           = _migrateCovered(proj.covered);
  ST.activeRatingBatch = 'new';

  ST.brolls            = parseScript(proj.script || '');
  ST.filterTarget = 'main'; ST.filter = 'all'; ST.sortBy = 'num'; ST.activeBatch = 'new';
  _el('fb-target-main')?.classList.add('active');
  _el('fb-target-real')?.classList.remove('active');
  const ta = _el('script-textarea'); if (ta) ta.value = proj.script||'';
  renderFilterChips();
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort==='num'));
  if (ST.brolls.length) collapseInput(); else expandInput();
  H.stack=[]; H.pos=-1; refreshUR();
  renderProjectTabs();
  renderHeatmap(); renderStats(); renderCards(true); updateAllPromptChips();
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge(); syncCsetUI();
  updateSratingHint(); renderRatingTabs(); renderRatingPanel();
  renderMyDatabase();
  updateLineCopyPreview();
  scrollToLastScoredBroll();
}


function createProject() {
  saveProjects();
  const pid = uid();
  const num = Object.keys(PROJECTS).length+1;
  PROJECTS[pid] = _projData(`Script ${num}`);
  saveProjects();
  activateProject(pid);
  expandInput();
  setTimeout(()=>_el('script-textarea')?.focus(),50);
  toast(`✅ Script ${num} created`);
}

function deleteProject(pid) {
  if (Object.keys(PROJECTS).length<=1) { toast('⚠️ Cannot delete the only script'); return; }
  const name = PROJECTS[pid]?.name||'Script';
  delete PROJECTS[pid];
  saveProjects();
  if (ACTIVE_PID===pid) { activateProject(Object.keys(PROJECTS)[0]); }
  else { renderProjectTabs(); }
  toast(`🗑 Deleted "${name}"`);
}

function renameProject(pid, newName) {
  if (!PROJECTS[pid]||!newName.trim()) return;
  PROJECTS[pid].name = newName.trim();
  saveProjects(); renderProjectTabs();
}

function renderProjectTabs() {
  const bar = _el('project-bar'); if (!bar) return;
  bar.innerHTML = '';
  const pids = Object.keys(PROJECTS);
  pids.forEach(pid => {
    const proj = PROJECTS[pid];
    const isActive = pid===ACTIVE_PID;
    const tab = document.createElement('div');
    tab.className = 'proj-tab'+(isActive?' active':'');
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected', isActive?'true':'false');

    const nameEl = document.createElement('span');
    nameEl.className = 'proj-tab-name';
    nameEl.textContent = proj.name;
    nameEl.title = 'Double-click to rename';
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      const old = PROJECTS[pid]?.name||'';
      nameEl.contentEditable='true'; nameEl.focus();
      const r=document.createRange(); r.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
      const done = () => { nameEl.contentEditable='false'; renameProject(pid, nameEl.textContent||old); };
      nameEl.addEventListener('blur', done, {once:true});
      nameEl.addEventListener('keydown', ev => {
        if (ev.key==='Enter'){ev.preventDefault();nameEl.blur();}
        if (ev.key==='Escape'){nameEl.textContent=old;nameEl.blur();}
      });
    });
    tab.appendChild(nameEl);

    /* clip count badge */
    const cnt = isActive ? ST.brolls.length : parseScript(proj.script||'').length;
    if (cnt>0) {
      const badge=document.createElement('span');
      badge.className='proj-tab-badge'; badge.textContent=cnt;
      tab.appendChild(badge);
    }

    /* delete button (only if >1 project) */
    if (pids.length>1) {
      const del=document.createElement('span');
      del.className='proj-tab-del'; del.textContent='×';
      del.title=`Delete "${proj.name}"`;
      del.addEventListener('click', e => {
        e.stopPropagation();
        showModal(`Delete "${proj.name}"?`, 'All scores, prompts and batches will be removed.', ()=>deleteProject(pid));
      });
      tab.appendChild(del);
    }
    if (!isActive) tab.addEventListener('click', ()=>activateProject(pid));
    bar.appendChild(tab);
  });

  const addBtn=document.createElement('button');
  addBtn.className='proj-add-btn';
  addBtn.innerHTML='<span>＋</span><span>New Script</span>';
  addBtn.title='Create new script';
  addBtn.addEventListener('click', createProject);
  bar.appendChild(addBtn);

  const clrBtn=document.createElement('button');
  clrBtn.className='proj-clr-btn'; clrBtn.id='btn-clear-copy';
  clrBtn.textContent='⟲ History'; clrBtn.title='Clear copy history for this script';
  bar.appendChild(clrBtn);
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
  if (s >= 9) textColor = '#4ade80';
  else if (s >= 7) textColor = '#facc15';
  else if (s >= 4.5) textColor = '#fb923c';
  else if (s > 0) textColor = '#f87171';

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

function saveMyRating(num, setIdx, score, comment) {
  const old = getMyRating(num, setIdx);
  const parsedScore = parseFloat(score);
  const newComment = comment || '';

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
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    renderMyDatabase();
    updateMyDbBadge();
    updateLineCopyPreview();
  };

  record(
    () => apply(old),
    () => apply({ score: parsedScore, comment: newComment }),
    `Real Rating #${num} Set ${setIdx+1}: ${parsedScore}`
  );
  apply({ score: parsedScore, comment: newComment });
}

function deleteMyRating(num, setIdx) {
  const old = getMyRating(num, setIdx);
  if (!old) return;

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
    updateHmCell(num);
    renderStats();
    renderFilterCount();
    renderMyDatabase();
    updateMyDbBadge();
    updateLineCopyPreview();
  };

  record(
    () => apply(old),
    () => apply(null),
    `Delete Real Rating #${num} Set ${setIdx+1}`
  );
  apply(null);
}



function updateMyDbBadge() {
  const el = _el('mydb-badge');
  if (!el) return;
  let total = 0;
  for (const sets of Object.values(ST.myRatings || {})) {
    if (!sets || typeof sets !== 'object') continue;
    for (const item of Object.values(sets)) {
      if (item && typeof item === 'object' && item.score !== undefined) total++;
    }
  }
  el.textContent = total;
  el.classList.toggle('active', total > 0);
}


/* ── My Rating Modal ─────────────────────────────────────────── */
let _myRatingModal = null;

function closeMyRatingModal() {
  document.querySelectorAll('.myrating-modal').forEach(m => m.remove());
  _myRatingModal = null;
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
  setTimeout(() => { input?.focus(); input?.select(); }, 50);

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


/* ── My Database render ──────────────────────────────────────── */
let _myDbFilter = { above: null, below: null, keyword: '' };

function renderMyDatabase() {
  const view = _el('mydb-view');
  if (!view) return;
  updateMyDbBadge();

  // Collect all entries
  const entries = [];
  for (const [numStr, sets] of Object.entries(ST.myRatings || {})) {
    if (!sets || typeof sets !== 'object') continue;
    const num = parseFloat(numStr);
    if (isNaN(num)) continue;
    for (const [idxStr, rating] of Object.entries(sets)) {
      if (!rating || typeof rating !== 'object' || rating.score === undefined) continue;
      const setIdx = parseInt(idxStr);
      if (isNaN(setIdx)) continue;
      const entry = (ST.prompts[num] || [])[setIdx];
      const broll = ST.brolls.find(b => b.num === num);
      entries.push({ num, setIdx, rating, entry, broll });
    }
  }


  // Apply filters
  const { above, below, keyword } = _myDbFilter;
  const filtered = entries.filter(({ rating }) => {
    const s = parseFloat(rating.score);
    if (above !== null && s < above) return false;
    if (below !== null && s > below) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      const inComment = (rating.comment||'').toLowerCase().includes(kw);
      const inPrompt = ((ST.prompts[rating.num]||[])[rating.setIdx]?.text||'').toLowerCase().includes(kw);
      if (!inComment && !inPrompt) return false;
    }
    return true;
  });

  // Sort by score desc
  filtered.sort((a, b) => parseFloat(b.rating.score) - parseFloat(a.rating.score));

  if (!filtered.length) {
    view.innerHTML = `<div class="mydb-empty">${entries.length ? '🔍 No entries match your filter.' : '📭 No personal ratings yet. Click ✏ on any prompt chip to rate it.'}</div>`;
    return;
  }

  view.innerHTML = '';
  filtered.forEach(({ num, setIdx, rating, entry, broll }) => {
    const rColor = getMyRatingColor(rating.score);
    const promptText = entry?.text || '—';
    const brollLine = broll?.line || `B-roll #${num}`;

    const row = document.createElement('div');
    row.className = 'mydb-entry';

    row.innerHTML = `
      <div class="mydb-entry-hdr">
        <span class="mydb-score-badge" style="color:${rColor.text};border-color:${rColor.border};background:${rColor.bg}">${rating.score}</span>
        <span class="mydb-label">#${num} · Set ${setIdx+1}</span>
        <span class="mydb-comment">${escHtml(rating.comment||'')}</span>
        <button class="mydb-copy-btn" title="Copy with metadata">📋</button>
        <button class="mydb-edit-btn" title="Edit rating">✏</button>
        <button class="mydb-del-btn" title="Delete rating">🗑</button>
      </div>
      <div class="mydb-broll-line">📽 ${escHtml(brollLine)}</div>
      <div class="mydb-prompt">${escHtml(promptText)}</div>
    `;

    row.querySelector('.mydb-copy-btn').addEventListener('click', () => {
      const meta = `[#${num} Set ${setIdx+1} | My Rating: ${rating.score}${rating.comment ? ' — ' + rating.comment : ''}]\nB-roll: ${brollLine}\n\n${promptText}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(meta).then(() => toast(`📋 Copied #${num} Set ${setIdx+1} with metadata`)).catch(() => fbCopy(meta, () => toast(`📋 Copied`)));
      } else { fbCopy(meta, () => toast(`📋 Copied`)); }
    });

    row.querySelector('.mydb-edit-btn').addEventListener('click', e => {
      showMyRatingModal(e.target, num, setIdx);
    });

    row.querySelector('.mydb-del-btn').addEventListener('click', () => {
      deleteMyRating(num, setIdx);
      toast(`🗑 Deleted rating for #${num} Set ${setIdx+1}`);
    });

    view.appendChild(row);
  });
}

function parseSetRatings(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) continue;
    // Match: NUM : NUM : SCORE : why text
    const m = l.match(/^(\d+)\s*:\s*(\d+)\s*:\s*([\d.]+)\s*:\s*(.*)/);
    if (!m) continue;
    const score = parseFloat(m[3]);
    if (isNaN(score) || score < 0 || score > 10) continue;
    let why = m[4].trim();
    if (why.startsWith('(') && why.endsWith(')')) why = why.slice(1, -1).trim();
    results.push({ brollNum: parseInt(m[1]), setIdx: parseInt(m[2]) - 1, score, why });
  }
  return results;
}

function applySetRatings(text) {
  const parsed = parseSetRatings(text);
  if (!parsed.length) { toast('⚠️ No valid rating lines found'); return; }
  if (!ST.setRatings) ST.setRatings = {};
  if (!ST.ratingBatches) ST.ratingBatches = [];

  const brollsInBatch = [];
  parsed.forEach(({ brollNum, setIdx, score, why }) => {
    if (!ST.setRatings[brollNum]) ST.setRatings[brollNum] = {};
    const existing = getSetRatingsList(brollNum, setIdx);
    existing.push({ score, why, date: Date.now() });
    ST.setRatings[brollNum][setIdx] = existing;
    if (!brollsInBatch.includes(brollNum)) brollsInBatch.push(brollNum);
  });
  brollsInBatch.sort((a, b) => a - b);

  const minN = Math.min(...brollsInBatch), maxN = Math.max(...brollsInBatch);
  const tabLabel = minN === maxN ? `#${minN}` : `#${minN}–${maxN}`;
  const batchId = uid();

  ST.ratingBatches.push({
    id: batchId,
    label: tabLabel,
    date: Date.now(),
    raw: text,
    brolls: brollsInBatch,
    count: parsed.length
  });

  // Stay on 'new' input tab and clear input textarea ready for next import
  ST.activeRatingBatch = 'new';
  const ta = _el('srating-textarea');
  if (ta) ta.value = '';

  save();
  updateAllPromptChips();
  updateSratingHint();
  renderRatingTabs();
  renderRatingPanel();
  toast(`⭐ Applied ${parsed.length} ratings for B-roll ${tabLabel}`);

  // --- Ratings notification popup ---
  const ratingsByBroll = {};
  parsed.forEach(({ brollNum, setIdx, score, why }) => {
    if (!ratingsByBroll[brollNum]) ratingsByBroll[brollNum] = [];
    ratingsByBroll[brollNum].push({ setIdx, score, why });
  });

  const IDEAL_BROLLS = 5, IDEAL_SETS = 6, IDEAL_TOTAL = IDEAL_BROLLS * IDEAL_SETS;
  const brollNums = brollsInBatch;

  let breakdown = brollNums.map(num => {
    const list = ratingsByBroll[num] || [];
    const setsSummary = list.map(item => `S${item.setIdx + 1}: <strong>${item.score}</strong>`).join(', ');
    return `<tr>
      <td style="padding:3px 12px 3px 0;white-space:nowrap;font-weight:700;color:var(--text-1)">B-roll #${num}</td>
      <td style="padding:3px 10px 3px 0;color:var(--accent);font-family:var(--mono);font-size:11px">${list.length} rating${list.length !== 1 ? 's' : ''}</td>
      <td style="padding:3px 0;color:var(--text-2);font-size:11px">${setsSummary}</td>
    </tr>`;
  }).join('');

  let matchNote;
  if (parsed.length === IDEAL_TOTAL && brollsInBatch.length === IDEAL_BROLLS) {
    matchNote = `<p style="color:#4ade80;margin-top:8px">✅ Perfect — ${IDEAL_BROLLS} B-rolls × ${IDEAL_SETS} sets = ${IDEAL_TOTAL} ratings</p>`;
  } else {
    const diff = parsed.length - IDEAL_TOTAL;
    const sign = diff > 0 ? '+' : '';
    matchNote = `<p style="color:#fb923c;margin-top:8px">⚠️ Expected ${IDEAL_TOTAL} ratings (${IDEAL_BROLLS}×${IDEAL_SETS}). Got <strong>${parsed.length}</strong> (${sign}${diff})</p>`;
  }

  showModal(
    `⭐ Applied Ratings Summary — ${tabLabel}`,
    `<div style="font-size:13px;line-height:1.5">
      <p style="margin-bottom:6px"><strong>${parsed.length}</strong> rating${parsed.length !== 1 ? 's' : ''} applied across <strong>${brollsInBatch.length}</strong> B-roll${brollsInBatch.length !== 1 ? 's' : ''}</p>
      <table style="border-collapse:collapse;margin-top:6px;width:100%">${breakdown}</table>
      ${matchNote}
    </div>`,
    () => {} // OK just closes
  );
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

function switchRatingTab(batchId) {
  ST.activeRatingBatch = batchId;
  renderRatingTabs();
  renderRatingPanel();
}

function renderRatingPanel() {
  const np = _el('srating-panel-new'), dp = _el('srating-panel-detail');
  if (!np || !dp) return;
  if (ST.activeRatingBatch === 'new') {
    np.classList.remove('hidden');
    dp.classList.add('hidden');
    return;
  }
  np.classList.add('hidden');
  dp.classList.remove('hidden');

  const b = (ST.ratingBatches || []).find(x => x.id === ST.activeRatingBatch);
  if (!b) {
    dp.innerHTML = '<p style="color:var(--text-3);font-size:12px;padding:12px">Rating batch not found.</p>';
    return;
  }
  const dt = new Date(b.date);

  dp.innerHTML = `
    <div class="rdetail-header">
      <div class="bdh-info">
        <span class="rdetail-title">${escHtml(b.label)} Ratings</span>
        <span class="rdetail-meta">${dt.toLocaleString('en-IN')} · ${b.brolls.length} B-rolls · ${b.count || b.brolls.length} ratings</span>
      </div>
      <div class="bdh-actions">
        <button class="hbtn danger" id="btn-del-rbatch">🗑 Delete</button>
      </div>
    </div>
    <div class="rdetail-list" id="rdetail-items"></div>
  `;

  _el('btn-del-rbatch')?.addEventListener('click', () => showDeleteRatingBatchModal(b.id));

  const listEl = _el('rdetail-items');
  if (!listEl) return;

  b.brolls.forEach(num => {
    const sets = ST.setRatings[num] || {};
    const setIndices = Object.keys(sets).map(Number).sort((a, b) => a - b);
    if (!setIndices.length) return;

    const grp = document.createElement('div');
    grp.className = 'rdetail-broll-group';

    const brollHdr = document.createElement('div');
    brollHdr.className = 'rdetail-broll-hdr';
    brollHdr.innerHTML = `<span>B-ROLL #${num}</span><span>${setIndices.length} sets rated</span>`;
    brollHdr.title = 'Click to jump to B-roll card';
    brollHdr.style.cursor = 'pointer';
    brollHdr.addEventListener('click', () => _el(`card-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    grp.appendChild(brollHdr);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'rdetail-broll-rows';

    setIndices.forEach(idx => {
      const summary = getSetRatingSummary(num, idx);
      if (!summary) return;
      const rColor = summary.color || { border: 'var(--border)', text: 'var(--text-1)', bg: 'transparent' };
      const ratings = summary.ratings;
      const whySummary = ratings.map((r, i) => ratings.length > 1 ? `[#${i+1}: ${r.score}] ${r.why}` : r.why).join('\n\n');

      const row = document.createElement('div');
      row.className = 'rdetail-row';
      row.innerHTML = `
        <span class="rdetail-set">Set ${idx + 1}${ratings.length > 1 ? ` (${ratings.length})` : ''}</span>
        <span class="rdetail-score" style="border-color:${rColor.border};color:${rColor.text};background:${rColor.bg}">${summary.avgScore}</span>
        <span class="rdetail-why" title="${escHtml(whySummary)}">${escHtml(whySummary || '—')}</span>
        <button class="rdetail-del" title="Remove rating">✕</button>
      `;
      row.querySelector('.rdetail-del').addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteSetRating(num, idx);
      });
      rowsWrap.appendChild(row);
    });

    grp.appendChild(rowsWrap);
    listEl.appendChild(grp);
  });
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
  if (delRatings && b) {
    b.brolls.forEach(num => {
      delete ST.setRatings[num];
    });
    updateAllPromptChips();
  }
  ST.ratingBatches = (ST.ratingBatches || []).filter(x => x.id !== batchId);
  if (ST.activeRatingBatch === batchId) switchRatingTab('new');
  save();
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
    const chunks = sec.slice(vpIdx).split(/ALT\s+\d+\s*:/i).slice(1);
    if (!result[num]) result[num] = [];
    for (const c of chunks) { const t = c.trim(); if (t) result[num].push(t); }
  }
  return result;
}

function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function importPrompts(text) {
  const parsed = parsePromptBatch(text);
  const keys   = Object.keys(parsed);
  if (!keys.length) { toast('⚠️ No valid BROLL blocks found'); return; }
  let total = 0;
  const batchId = uid();
  for (const [ns, alts] of Object.entries(parsed)) {
    const num = parseInt(ns);
    if (!ST.prompts[num]) ST.prompts[num] = [];
    for (const t of alts) { ST.prompts[num].push({ text: t, batchId, copied: false }); total++; }
  }
  const minN = Math.min(...keys.map(Number)), maxN = Math.max(...keys.map(Number));
  const tabLabel = minN===maxN ? `#${minN}` : `#${minN}–${maxN}`;
  ST.batches.push({ id:batchId, label:tabLabel, date:Date.now(), raw:text, brollCount:keys.length, promptCount:total });

  // Stay on 'new' input tab and clear input textarea ready for next import
  ST.activeBatch = 'new';
  const ta = _el('prompt-textarea');
  if (ta) ta.value = '';

  save();
  renderBatchTabs();
  renderBatchPanel();
  updateAllPromptChips();
  renderLibraryView();
  updateLibBadge();

  // --- Import notification popup ---
  const IDEAL_BROLLS = 5, IDEAL_SETS = 6, IDEAL_TOTAL = IDEAL_BROLLS * IDEAL_SETS;
  const brollNums = keys.map(Number).sort((a,b)=>a-b);
  let breakdown = brollNums.map(num => {
    const setCount = parsed[String(num)].length;
    return `<tr><td style="padding:2px 10px 2px 0">B-roll #${num}</td><td>${setCount} set${setCount!==1?'s':''}</td></tr>`;
  }).join('');

  let matchNote;
  if (total === IDEAL_TOTAL && keys.length === IDEAL_BROLLS) {
    matchNote = `<p style="color:#4ade80;margin-top:8px">✅ Perfect — ${IDEAL_BROLLS} B-rolls × ${IDEAL_SETS} sets = ${IDEAL_TOTAL} prompts</p>`;
  } else {
    const diff = total - IDEAL_TOTAL;
    const sign = diff > 0 ? '+' : '';
    matchNote = `<p style="color:#fb923c;margin-top:8px">⚠️ Expected ${IDEAL_TOTAL} prompts (${IDEAL_BROLLS}×${IDEAL_SETS}). Got <strong>${total}</strong> (${sign}${diff})</p>`;
  }

  showModal(
    `📥 Import Summary — ${tabLabel}`,
    `<div style="font-size:13px;line-height:1.5">
      <p style="margin-bottom:6px"><strong>${total}</strong> prompt${total!==1?'s':''} imported across <strong>${keys.length}</strong> B-roll${keys.length!==1?'s':''}</p>
      <table style="border-collapse:collapse;margin-top:4px">${breakdown}</table>
      ${matchNote}
    </div>`,
    () => {} // OK just closes
  );
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
function copyPrompt(num, idx, triggerEl, markCopied = true) {
  const entry = (ST.prompts[num]||[])[idx]; if (!entry) return;
  const text = getCopyText(entry.text, num, idx);
  const oldCopied = !!entry.copied;
  const doFlash = () => {
    if (markCopied && !oldCopied) {
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
        () => apply(true),
        `Copy Set ${idx+1} for #${num}`
      );
      apply(true);
      toast(`📋 Copied Set ${idx+1} for #${num}`);
    } else if (markCopied) {
      toast(`📋 Copied Set ${idx+1} for #${num}`);
    }
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
  newTab.className = 'batch-tab' + (ST.activeBatch === 'new' ? ' active' : '');
  newTab.innerHTML = '<span>＋ New Import</span>';
  newTab.addEventListener('click', () => switchBatchTab('new'));
  bar.appendChild(newTab);

  [...ST.batches].reverse().forEach(b => {
    const tab = document.createElement('button');
    tab.className = 'batch-tab' + (ST.activeBatch === b.id ? ' active' : '');
    const lbl = document.createElement('span'); lbl.className = 'btab-label'; lbl.textContent = b.label; tab.appendChild(lbl);
    const del = document.createElement('span'); del.className = 'btab-del'; del.textContent = '×'; del.title = 'Delete batch';
    del.addEventListener('click', e => { e.stopPropagation(); showDeleteBatchModal(b.id); });
    tab.appendChild(del);
    tab.addEventListener('click', () => switchBatchTab(b.id));
    bar.appendChild(tab);
  });
}

function switchBatchTab(batchId) {
  ST.activeBatch = batchId; renderBatchTabs(); renderBatchPanel();
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
  const view = _el('library-view'); if (!view) return;
  const nums = Object.keys(ST.prompts).map(Number).filter(n=>(ST.prompts[n]||[]).length>0).sort((a,b)=>a-b);
  if (!nums.length) {
    view.innerHTML = `<div class="lib-empty"><span style="font-size:28px">📭</span><p>No prompts yet — import a batch above.</p></div>`;
    return;
  }
  const groups = {};
  nums.forEach(n => {
    const base = Math.floor((n-1)/10)*10+1, key = `${base}–${base+9}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  view.innerHTML = '';
  for (const [range, gNums] of Object.entries(groups)) {
    const grp = document.createElement('div'); grp.className = 'lib-group';
    const hdr = document.createElement('div'); hdr.className = 'lib-group-hdr';
    const cnt = gNums.reduce((s,n) => s+(ST.prompts[n]?.length||0), 0);
    hdr.innerHTML = `<span class="lib-range">B-ROLL ${range}</span><span class="lib-range-count">${cnt} prompts</span>`;
    grp.appendChild(hdr);
    gNums.forEach(num => {
      const row = document.createElement('div'); row.className = 'lib-row'; row.id = `lr-${num}`;
      const numLbl = document.createElement('span'); numLbl.className = 'lib-num'; numLbl.textContent = `#${num}`;
      numLbl.addEventListener('click', () => _el(`card-${num}`)?.scrollIntoView({ behavior:'smooth', block:'center' }));
      row.appendChild(numLbl);
      const col = document.createElement('div'); col.className = 'lib-chips-col'; col.id = `lc-${num}`;
      (ST.prompts[num]||[]).forEach((entry, i) => col.appendChild(buildLibChip(num, i, entry)));
      row.appendChild(col); grp.appendChild(row);
    });
    view.appendChild(grp);
  }
}

function buildLibChip(num, i, entry) {
  const used = ST.usedSets[num] === i;
  const chip = document.createElement('div');
  chip.className = 'lib-chip' + (entry.copied ? ' copied' : '') + (used ? ' is-used' : '');
  chip.id = `lcp-${num}-${i}`;

  const left = document.createElement('div'); left.className = 'lib-chip-left';

  const numB = document.createElement('span'); numB.className = 'lib-chip-num'; numB.textContent = i+1;
  left.appendChild(numB);
  if (entry.copied) { const ck = document.createElement('span'); ck.className = 'lib-chip-check'; ck.textContent = '✓'; left.appendChild(ck); }
  const pin = document.createElement('span');
  pin.className = 'lib-chip-pin'; pin.textContent = '📌'; pin.title = 'Marked as used for rating';
  pin.style.display = used ? '' : 'none';
  left.appendChild(pin);
  if (entry.batchId) {
    const bIdx = ST.batches.findIndex(b => b.id === entry.batchId);
    if (bIdx !== -1) {
      const bb = document.createElement('span'); bb.className = 'lib-chip-batch';
      bb.textContent = `B${bIdx+1}`; bb.title = ST.batches[bIdx].label; left.appendChild(bb);
    }
  }
  chip.appendChild(left);

  const preview = document.createElement('span'); preview.className = 'lib-chip-preview'; preview.textContent = entry.text.slice(0,100)+(entry.text.length>100?'…':'');
  chip.appendChild(preview);

  const actions = document.createElement('div'); actions.className = 'lib-chip-actions';
  const copyBtn = document.createElement('button'); copyBtn.className = 'lca-btn copy'; copyBtn.textContent = '📋'; copyBtn.title = 'Copy (with prefix/suffix)';
  copyBtn.addEventListener('click', e => { e.stopPropagation(); copyPrompt(num, i, copyBtn); });
  const useBtn = document.createElement('button'); useBtn.className = 'lca-btn use' + (used?' is-used':''); useBtn.textContent = '📌'; useBtn.title = used ? 'Unmark as used' : 'Mark as set used for this rating';
  useBtn.addEventListener('click', e => { e.stopPropagation(); setUsedSet(num, i); renderLibraryView(); });
  const delBtn = document.createElement('button'); delBtn.className = 'lca-btn del'; delBtn.textContent = '✕'; delBtn.title = 'Delete this prompt';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deletePromptEntry(num, i); });
  actions.appendChild(copyBtn); actions.appendChild(useBtn); actions.appendChild(delBtn);
  chip.appendChild(actions);

  preview.addEventListener('click', () => copyPrompt(num, i, chip));
  return chip;
}


/* ── Build single prompt chip (Card & Library) ──────────────── */
function buildPromptChip(num, i, entry) {
  const chip = document.createElement('button');
  const isCopied = !!entry.copied;
  const isUsed = ST.usedSets[num] === i;

  const summary = getSetRatingSummary(num, i);
  const rColor = summary ? summary.color : null;

  // Base classes
  chip.className = 'p-chip' + (isCopied ? ' copied' : '') + (isUsed ? ' is-used' : '');
  chip.id = `pc-${num}-${i}`;

  // If set rating exists, apply the rating's border and background tint
  if (rColor) {
    chip.style.borderColor = rColor.border;
    chip.style.backgroundColor = rColor.bg;
  }

  // Label span
  const sp = document.createElement('span');
  sp.className = 'p-chip-label';
  if (isCopied) {
    const ck = document.createElement('span');
    ck.className = 'p-chip-ck';
    ck.textContent = '✔ ';
    sp.appendChild(ck);
  }
  sp.appendChild(document.createTextNode(`Set ${i+1}`));
  chip.appendChild(sp);


  // AI Rating badge if exists
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
    rb.style.color = rColor ? rColor.text : 'var(--text-3)';
    chip.appendChild(rb);
  }

  const titleLines = [
    `Set ${i+1} for #${num}` + (summary ? ` · Avg: ${summary.avgScore}` + (summary.count > 1 ? ` (${summary.count} ratings)` : '') : ''),
    '',
    '• Click: Copy prompt to clipboard (always keeps checkmark)',
    '• Shift+Click or Hold 1.5s: Toggle checkmark on/off',
    '• Right-click: View all AI ratings & reasons'
  ];
  chip.title = titleLines.join('\n');

  // Left-click / Tap: ALWAYS COPY and ensure ticked!
  chip.addEventListener('click', e => {
    e.stopPropagation();
    if (e.shiftKey) {
      const oldVal = !!entry.copied;
      const newVal = !oldVal;
      const apply = (val) => {
        entry.copied = val;
        save(true);
        refreshCopyState(num, i);
      };
      record(
        () => apply(oldVal),
        () => apply(newVal),
        newVal ? `Tick Set ${i+1} for #${num}` : `Untick Set ${i+1} for #${num}`
      );
      apply(newVal);
      toast(newVal ? `✔ Ticked Set ${i+1} for #${num}` : `✕ Unticked Set ${i+1} for #${num}`);
    } else {
      copyPrompt(num, i, chip, true);
    }
  });

  // Right-click: View all ratings & reasons popup
  chip.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    showWhyPopup(e, num, i);
  });

  // Mobile 1.5-second hold feature (toggle untick)
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
        const oldVal = !!entry.copied;
        const newVal = !oldVal;
        const apply = (val) => {
          entry.copied = val;
          save(true);
          refreshCopyState(num, i);
        };
        record(
          () => apply(oldVal),
          () => apply(newVal),
          newVal ? `Tick Set ${i+1} for #${num}` : `Untick Set ${i+1} for #${num}`
        );
        apply(newVal);
        toast(newVal ? `✔ Ticked Set ${i+1} for #${num}` : `✕ Unticked Set ${i+1} for #${num}`);
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
  myBtn.id = `myrb-${num}-${i}`;
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

  wrapper.appendChild(myBtn);
  return wrapper;
}






function updateCardPrompts(num) {
  const card = _el(`card-${num}`); if (!card) return;
  const existingPr = _el(`cp-${num}`);
  const mid = card.querySelector('.c-mid');
  const prompts = ST.prompts[num] || [];

  if (existingPr) existingPr.remove();
  if (!prompts.length) return;

  const prow = document.createElement('div'); prow.className = 'c-prompts'; prow.id = `cp-${num}`;
  const lbl = document.createElement('span'); lbl.className = 'p-label'; lbl.textContent = '🎬'; prow.appendChild(lbl);
  prompts.forEach((entry, i) => prow.appendChild(buildPromptChip(num, i, entry)));

  mid.appendChild(prow);

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

    col.addEventListener('click', () => {
      _el(`card-${b.num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    grid.appendChild(col);
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
  if(!ST.brolls.length){box.innerHTML='';empty.classList.remove('hidden');noRes.style.display='none';fbar.classList.add('hidden');return;}
  empty.classList.add('hidden');fbar.classList.remove('hidden');
  const list=sortedList(ST.brolls.filter(passes)); renderFilterCount();
  if(!list.length){box.innerHTML='';noRes.style.display='block';return;}
  noRes.style.display='none'; box.innerHTML='';
  list.forEach((b,i)=>{const card=buildCard(b);if(animate){card.style.animationDelay=`${Math.min(i*18,300)}ms`;card.classList.add('card-enter');}box.appendChild(card);});
}

function buildCard(b) {
  const score=ST.scores[b.num]??null, col=getC(score), prompts=ST.prompts[b.num]||[];
  const used=ST.usedSets[b.num];

  const card=document.createElement('div');
  card.className='broll-card'; card.id=`card-${b.num}`;
  card.style.borderLeftColor=col.border;

  /* Badge */
  const badge=document.createElement('div');
  badge.className='c-num'; badge.id=`cn-${b.num}`;
  badge.style.background=col.bg;
  badge.style.boxShadow=col.glow!=='transparent'?`0 3px 14px ${col.glow}`:'none';
  badge.textContent=b.num; card.appendChild(badge);

  /* Middle */
  const mid=document.createElement('div'); mid.className='c-mid';
  const line=document.createElement('div'); line.className='c-line'; line.textContent=b.line; line.title=b.line; mid.appendChild(line);

  /* Slider */
  const slRow=document.createElement('div'); slRow.className='c-slider-row';
  const l0=document.createElement('span'); l0.className='s-label'; l0.textContent='0'; slRow.appendChild(l0);
  const slWrap=document.createElement('div'); slWrap.className='slider-wrap' + (ST.mainRatingLocked ? ' is-locked' : '');
  const inp=document.createElement('input');
  inp.type='range'; inp.min='0'; inp.max='10'; inp.step='0.5'; inp.value=score!==null?score:'0';
  inp.className='score-slider'; inp.id=`sl-${b.num}`;
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

  /* Prompt chips */
  if(prompts.length){
    const prow=document.createElement('div'); prow.className='c-prompts'; prow.id=`cp-${b.num}`;
    const lbl=document.createElement('span'); lbl.className='p-label'; lbl.textContent='🎬'; prow.appendChild(lbl);
    prompts.forEach((entry,i)=>prow.appendChild(buildPromptChip(b.num,i,entry)));
    mid.appendChild(prow);
  }

  card.appendChild(mid);

  /* Right: score wrap + clear */
  const right=document.createElement('div'); right.className='c-right';

  const scoreWrap=document.createElement('div'); scoreWrap.className='c-score-wrap';
  const val=document.createElement('div'); val.className='score-val'; val.id=`sv-${b.num}`;
  val.style.background=col.bg; val.style.borderColor=col.border; val.textContent=scoreLbl(score);
  scoreWrap.appendChild(val);

  const suBadge=document.createElement('div');
  suBadge.className='su-badge'+(used!==undefined?'':' hidden'); suBadge.id=`su-${b.num}`;
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
  doneBtn.id = `done-btn-${b.num}`;
  doneBtn.innerHTML = isCov ? '✔' : '◻';
  doneBtn.title = isCov
    ? `B-roll #${b.num} is Done (9+ in Overview)\nClick to unmark`
    : `Mark B-roll #${b.num} as Done (9+ in Overview)`;
  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCoveredClip(b.num);
  });
  right.appendChild(doneBtn);

  card.appendChild(right);
  return card;
}



/* ── Slider helpers ─────────────────────────────────────────── */
function applySliderStyle(inp,score){const col=getC(score);const pct=score!==null?(parseFloat(score)/10*100).toFixed(1)+'%':'0%';inp.style.setProperty('--fp',pct);inp.style.setProperty('--fc',score!==null?col.bg:'#1c1c28');inp.style.setProperty('--tg',col.glow!=='transparent'?col.glow:'rgba(255,255,255,0.06)');}
function updateScoreVal(num,val){const sv=_el(`sv-${num}`);if(!sv)return;const col=getC(val);sv.textContent=(val!==null&&val!==undefined)?`${snap(val)}`:'—';sv.style.background=col.bg;sv.style.borderColor=col.border;}

/* ── Score actions ──────────────────────────────────────────── */
function setScore(num,val){
  const oldScore=ST.scores[num]??null, newScore=snap(val);
  if(oldScore===newScore)return;
  if(newScore!==null){
    try { localStorage.setItem('br_last_scored_' + ACTIVE_PID, num); } catch {}
  }
  const apply=s=>{if(s===null)delete ST.scores[num];else ST.scores[num]=s;save();updateCardVisuals(num,s);updateHmCell(num);renderStats();renderFilterCount();};
  record(()=>apply(oldScore),()=>apply(newScore),`Score #${num}: ${scoreLbl(oldScore)} → ${scoreLbl(newScore)}`);
  apply(newScore);
}
function clearScore(num){
  const old=ST.scores[num]??null; if(old===null)return;
  const apply=s=>{if(s===null)delete ST.scores[num];else ST.scores[num]=s;save();updateCardVisuals(num,s);updateHmCell(num);renderStats();renderFilterCount();};
  record(()=>apply(old),()=>apply(null),`Clear score #${num}`);
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

/* ── Load script ────────────────────────────────────────────── */
function loadScript(text,keepScores=true){
  const brolls=parseScript(text);
  if(!brolls.length){toast('⚠️ No valid lines found');return;}
  ST.brolls=brolls; if(!keepScores)ST.scores={};
  collapseInput(); save();
  renderProjectTabs();
  renderHeatmap(); renderStats(); renderCards(true); updateAllPromptChips();
  updateLineCopyPreview();
  toast(`✅ Loaded ${brolls.length} B-roll clips`);
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
  const target = LC_TARGET;

  const matches = [];

  for (const b of (ST.brolls || [])) {
    if (!b || !b.line) continue;
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

function updateLineCopyPreview() {
  const ta = _el('lc-preview-textarea');
  const countBadge = _el('lc-count-badge');
  const hint = _el('line-copy-hint');
  if (!ta) return;

  const matches = getFilteredLines();
  const includeNum = _el('lc-include-num') ? _el('lc-include-num').checked : true;
  const lineGap = _el('lc-line-gap') ? _el('lc-line-gap').checked : true;

  const formattedLines = matches.map(b => {
    const prefix = includeNum ? `${b.num} ` : '';
    return `${prefix}${b.line}`;
  });

  const sep = lineGap ? '\n\n' : '\n';
  const text = formattedLines.join(sep);
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
  const doConfirm = () => toast(`📋 Copied ${matches.length} filtered lines to clipboard!`);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doConfirm).catch(() => fbCopy(text, doConfirm));
  } else {
    fbCopy(text, doConfirm);
  }
}

/* ── Export / Import ────────────────────────────────────────── */

function exportData(){
  const ta = _el('script-textarea');
  const scriptVal = ta ? ta.value : (PROJECTS[ACTIVE_PID]?.script || '');
  const d = {
    v: 6, date: new Date().toISOString(), script: scriptVal,
    scores: JSON.parse(JSON.stringify(ST.scores)),
    prompts: JSON.parse(JSON.stringify(ST.prompts)),
    batches: JSON.parse(JSON.stringify(ST.batches)),
    usedSets: JSON.parse(JSON.stringify(ST.usedSets)),
    setRatings: JSON.parse(JSON.stringify(ST.setRatings || {})),
    ratingBatches: JSON.parse(JSON.stringify(ST.ratingBatches || [])),
    myRatings: JSON.parse(JSON.stringify(ST.myRatings || {})),
    covered: JSON.parse(JSON.stringify(ST.covered || {})),
    prefix: ST.prefix, suffix: ST.suffix, labelEnabled: ST.labelEnabled,
  };
  const json = JSON.stringify(d, null, 2);
  const filename = `broll-${new Date().toISOString().slice(0,10)}.json`;
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
  toast('📥 Exported');
}
function importJSON(file){
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (d.script) { const ta = _el('script-textarea'); if (ta) ta.value = d.script; }
      ST.scores        = d.scores        || {};
      ST.prompts       = _migratePrompts(d.prompts || {});
      ST.batches       = d.batches       || [];
      ST.usedSets      = d.usedSets      || {};
      ST.setRatings    = _migrateSetRatings(d.setRatings || {});
      ST.ratingBatches = d.ratingBatches || [];
      ST.myRatings     = _migrateMyRatings(d.myRatings || {});
      ST.covered       = _migrateCovered(d.covered || {});
      if (d.prefix !== undefined) ST.prefix = d.prefix;
      if (d.suffix !== undefined) ST.suffix = d.suffix;
      if (d.labelEnabled !== undefined) ST.labelEnabled = d.labelEnabled;
      if (d.script) loadScript(d.script, true);
      save();
      renderHeatmap(); renderStats();
      renderLibraryView(); renderBatchTabs(); updateLibBadge(); syncCsetUI();
      renderRatingTabs(); renderRatingPanel(); updateSratingHint(); updateAllPromptChips();
      renderMyDatabase();
      toast('📤 Imported');

    } catch(err) { console.error('Import error:', err); toast('❌ Invalid file'); }
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
function showModal(title,bodyHtml,onOk){
  _el('modal-title').textContent=title; _el('modal-body').innerHTML=bodyHtml;
  const ov=_el('modal-overlay'); ov.classList.add('show');
  _el('modal-ok').onclick=()=>{onOk();ov.classList.remove('show');};
  _el('modal-cancel').onclick=()=>ov.classList.remove('show');
  ov.onclick=ev=>{if(ev.target===ov)ov.classList.remove('show');};
}
function _el(id){return document.getElementById(id);}
function setText(id,v){const e=_el(id);if(e)e.textContent=v;}
function setStyle(id,p,v){const e=_el(id);if(e)e.style[p]=v;}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ── Main Rating Lock (Mistouch Protection) ───────────────── */
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
}

function toggleMainRatingLock() {
  ST.mainRatingLocked = !ST.mainRatingLocked;
  try { localStorage.setItem('br_main_rating_locked', ST.mainRatingLocked ? 'true' : 'false'); } catch {}
  updateRatingLockUI();
  toast(ST.mainRatingLocked ? '🔒 Main rating locked to prevent accidental changes' : '🔓 Main rating unlocked for editing');
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
    const savedScroll = localStorage.getItem('br_overview_scroll');
    ST.overviewScroll = (savedScroll === 'true');
  } catch {}

  const ta = _el('script-textarea'); if (ta) ta.value = proj.script || '';

  _el('library-section')?.classList.add('collapsed');
  _el('cset-section')?.classList.add('collapsed');
  _el('mydb-section')?.classList.add('collapsed');
  if (ST.brolls.length) collapseInput();

  renderProjectTabs();
  renderFilterChips();
  renderHeatmap(); renderStats(); renderCards(!!ST.brolls.length);
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge();

  syncCsetUI(); updateSratingHint(); renderRatingTabs(); renderRatingPanel(); refreshUR();
  renderMyDatabase();
  updateLineCopyPreview();
  updateRatingLockUI();
  updateOverviewModeUI();

  _el('hm-view-toggle')?.addEventListener('click', toggleOverviewScrollMode);
  _el('rating-lock-btn')?.addEventListener('click', toggleMainRatingLock);

  scrollToLastScoredBroll();
  initFirebaseSync();


  let rT; window.addEventListener('resize',()=>{clearTimeout(rT);rT=setTimeout(renderHeatmap,120);});

  // Keyboard: Ctrl+Z, Ctrl+Y
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&!e.altKey){
      if(e.key==='z'&&!e.shiftKey){e.preventDefault();doUndo();}
      if(e.key==='y'||(e.key==='z'&&e.shiftKey)){e.preventDefault();doRedo();}
    }
  });

  /* Script */
  _el('btn-load').addEventListener('click',()=>{const t=_el('script-textarea').value.trim();if(!t){toast('⚠️ Paste script first');return;}loadScript(t,true);});
  _el('script-textarea').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')_el('btn-load').click();});

  const autoPad = (ta) => {
    setTimeout(() => {
      if (!ta.value.endsWith('\n\n')) ta.value = ta.value.trimEnd() + '\n\n';
      ta.scrollTop = ta.scrollHeight;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 10);
  };
  _el('script-textarea')?.addEventListener('paste', () => autoPad(_el('script-textarea')));
  _el('prompt-textarea')?.addEventListener('paste', () => autoPad(_el('prompt-textarea')));
  _el('srating-textarea')?.addEventListener('paste', () => autoPad(_el('srating-textarea')));

  _el('input-toggle').addEventListener('click',()=>{if(ST.inputOpen)collapseInput();else expandInput();});

  /* Header */
  _el('btn-clear').addEventListener('click',()=>showModal('Clear this script?','Script + scores + prompts for this script will be removed.',()=>{
    _el('script-textarea').value='';
    ST.brolls=[];ST.scores={};ST.prompts={};ST.batches=[];ST.usedSets={};ST.setRatings={};ST.ratingBatches=[];ST.activeRatingBatch='new';
    save(); expandInput();
    renderProjectTabs();
    renderHeatmap();renderStats();renderCards();renderBatchTabs();renderBatchPanel();renderLibraryView();updateLibBadge();updateSratingHint();renderRatingTabs();renderRatingPanel();
    toast('🗑️ Cleared');
  }));
  _el('btn-reset').addEventListener('click', () => {
    showModal(
      'Reset all ticks for this script?',
      'All green "copied" checkmarks for all prompt sets in this script will be unticked. Prompts, scores, and ratings will remain untouched.',
      () => {
        clearCopyHistory();
      }
    );
  });

  _el('btn-undo').addEventListener('click',doUndo);
  _el('btn-redo').addEventListener('click',doRedo);
  _el('btn-export').addEventListener('click',exportData);
  _el('btn-import').addEventListener('click',()=>_el('file-input').click());
  _el('file-input').addEventListener('change',e=>{if(e.target.files[0]){importJSON(e.target.files[0]);e.target.value='';}});

  /* Copy Settings — handlers save to GLOBAL cset key */
  _el('cset-toggle').addEventListener('click',()=>{
    const sec=_el('cset-section');if(!sec)return;
    ST.csetOpen=!ST.csetOpen;sec.classList.toggle('collapsed',!ST.csetOpen);
    document.querySelector('#cset-toggle .it-chevron').textContent=ST.csetOpen?'▲':'▼';
  });
  _el('cset-prefix').addEventListener('input',e=>{ST.prefix=e.target.value;saveGlobalCset();updateCsetHint();});
  _el('cset-suffix').addEventListener('input',e=>{ST.suffix=e.target.value;saveGlobalCset();updateCsetHint();});
  _el('cset-label-toggle')?.addEventListener('change', e => {
    ST.labelEnabled = e.target.checked;
    saveGlobalCset();
    updateCsetHint();
    toast(ST.labelEnabled ? '🏷️ B-roll & Set tag enabled' : '🏷️ B-roll & Set tag disabled');
  });
  _el('cset-clear-pre').addEventListener('click',()=>{ST.prefix='';_el('cset-prefix').value='';saveGlobalCset();updateCsetHint();toast('Prefix cleared');});
  _el('cset-clear-suf').addEventListener('click',()=>{ST.suffix='';_el('cset-suffix').value='';saveGlobalCset();updateCsetHint();toast('Suffix cleared');});


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
  _el('lc-include-num')?.addEventListener('change', updateLineCopyPreview);
  _el('lc-line-gap')?.addEventListener('change', updateLineCopyPreview);
  _el('btn-copy-filtered-lines')?.addEventListener('click', copyFilteredLines);


  /* Set Ratings section */

  _el('srating-toggle').addEventListener('click',()=>{
    const sec=_el('srating-section');if(!sec)return;
    sec.classList.toggle('collapsed');
    document.querySelector('#srating-toggle .it-chevron').textContent=sec.classList.contains('collapsed')?'▼':'▲';
  });
  _el('btn-apply-ratings').addEventListener('click',()=>{
    const t=_el('srating-textarea').value.trim();if(!t){toast('⚠️ Paste rating lines first');return;}
    applySetRatings(t);
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
  _el('btn-clear-rating-input').addEventListener('click',()=>{_el('srating-textarea').value='';});
  _el('btn-clear-all-ratings').addEventListener('click',()=>showModal('Clear all set ratings?','All set ratings and why text will be removed.',()=>{
    ST.setRatings={};ST.ratingBatches=[];ST.activeRatingBatch='new';save();updateAllPromptChips();updateSratingHint();renderRatingTabs();renderRatingPanel();toast('🗑️ Set ratings cleared');
  }));


  /* Clear copy history — event delegation on project-bar */
  _el('project-bar').addEventListener('click',e=>{
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
  _el('library-toggle').addEventListener('click',()=>{const sec=_el('library-section');if(!sec)return;ST.libOpen=!ST.libOpen;sec.classList.toggle('collapsed',!ST.libOpen);document.querySelector('#library-toggle .it-chevron').textContent=ST.libOpen?'▲':'▼';});
  _el('btn-import-prompts').addEventListener('click',()=>{const t=_el('prompt-textarea').value.trim();if(!t){toast('⚠️ Paste prompt batch first');return;}importPrompts(t);_el('prompt-textarea').value='';});
  _el('btn-clear-prompt-input').addEventListener('click',()=>{_el('prompt-textarea').value='';});
  _el('btn-clear-prompts').addEventListener('click',()=>showModal('Clear ALL prompts?','Removes every prompt and all batch history.',()=>{
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
      // Same autoPad behavior: ensure 2 trailing newlines and move cursor to end
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
  // Show bottom button initially if page is scrollable
  if (document.body.scrollHeight > window.innerHeight + 300) jb?.classList.add('visible');


  /* My Rating Database */
  _el('mydb-toggle')?.addEventListener('click', () => {
    const sec = _el('mydb-section'); if (!sec) return;
    sec.classList.toggle('collapsed');
    document.querySelector('#mydb-toggle .it-chevron').textContent = sec.classList.contains('collapsed') ? '▼' : '▲';
  });
  _el('mydb-filter-above')?.addEventListener('input', e => {
    const v = e.target.value.trim();
    _myDbFilter.above = v ? parseFloat(v) : null;
    renderMyDatabase();
  });
  _el('mydb-filter-below')?.addEventListener('input', e => {
    const v = e.target.value.trim();
    _myDbFilter.below = v ? parseFloat(v) : null;
    renderMyDatabase();
  });
  _el('mydb-filter-keyword')?.addEventListener('input', e => {
    _myDbFilter.keyword = e.target.value.trim();
    renderMyDatabase();
  });
  _el('mydb-filter-clear')?.addEventListener('click', () => {
    _myDbFilter = { above: null, below: null, keyword: '' };
    const fa = _el('mydb-filter-above'); if (fa) fa.value = '';
    const fb = _el('mydb-filter-below'); if (fb) fb.value = '';
    const fk = _el('mydb-filter-keyword'); if (fk) fk.value = '';
    renderMyDatabase();
  });
  _el('btn-clear-myratings')?.addEventListener('click', () => showModal(
    'Clear ALL personal ratings?',
    'All your personal ratings and comments will be removed.',
    () => { ST.myRatings = {}; save(); updateAllPromptChips(); renderMyDatabase(); toast('🗑️ Personal ratings cleared'); }
  ));

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
