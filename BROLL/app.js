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
  prefix:            '',
  suffix:            '',
  filter:            'all',
  sortBy:            'num',
  activeBatch:       'new',
  inputOpen:         true,
  libOpen:           false,
  csetOpen:          false,
};

/* ── Global Prefix / Suffix (shared across all scripts) ─────── */
const GLOBAL_CSET_KEY = 'br_global_cset';
function saveGlobalCset() {
  try { localStorage.setItem(GLOBAL_CSET_KEY, JSON.stringify({ prefix: ST.prefix, suffix: ST.suffix })); } catch {}
}
function loadGlobalCset() {
  try {
    const d = JSON.parse(localStorage.getItem(GLOBAL_CSET_KEY) || 'null');
    if (d) { ST.prefix = d.prefix || ''; ST.suffix = d.suffix || ''; return; }
  } catch {}
  ST.prefix = ''; ST.suffix = '';
}

/* ── Projects / Multi-Script ────────────────────────────────── */
const PROJECTS = {};
let   ACTIVE_PID = null;
const PROJ_KEY   = 'br_v6_proj';

function _projData(name) {
  return { name: name||'Script 1', script:'', scores:{}, prompts:{}, batches:[], usedSets:{}, setRatings:{}, ratingBatches:[] };
}

function saveProjects() {
  if (ACTIVE_PID && PROJECTS[ACTIVE_PID]) {
    const ta = _el('script-textarea');
    PROJECTS[ACTIVE_PID] = {
      ...PROJECTS[ACTIVE_PID],
      script:        ta ? ta.value : (PROJECTS[ACTIVE_PID].script||''),
      scores:        JSON.parse(JSON.stringify(ST.scores)),
      prompts:       JSON.parse(JSON.stringify(ST.prompts)),
      batches:       [...ST.batches],
      usedSets:      JSON.parse(JSON.stringify(ST.usedSets)),
      setRatings:    JSON.parse(JSON.stringify(ST.setRatings||{})),
      ratingBatches: [...(ST.ratingBatches||[])],
      // prefix/suffix are global — NOT saved per-project
    };
  }
  try { localStorage.setItem(PROJ_KEY, JSON.stringify({ active: ACTIVE_PID, projects: PROJECTS })); } catch {}
  saveGlobalCset();
}

function _migratePrompts(rawPr) {
  const p = {};
  for (const [k,v] of Object.entries(rawPr||{})) {
    p[k] = (v||[]).map(x => typeof x === 'string' ? { text:x, batchId:null, copied:false } : x);
  }
  return p;
}

function loadProjects() {
  /* Try new multi-project store */
  try {
    const raw = JSON.parse(localStorage.getItem(PROJ_KEY)||'null');
    if (raw && raw.projects && Object.keys(raw.projects).length) {
      for (const [k,v] of Object.entries(raw.projects)) PROJECTS[k] = v;
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
    PROJECTS[pid] = { name:'Script 1', script:sc, scores:s, prompts:pr, batches:ba, usedSets:us, setRatings:{}, ratingBatches:[] };
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
  ST.setRatings        = proj.setRatings    || {};
  ST.ratingBatches     = proj.ratingBatches || [];
  ST.activeRatingBatch = 'new';
  // prefix/suffix stay global — do NOT overwrite from project
  ST.brolls            = parseScript(proj.script || '');
  ST.filter = 'all'; ST.sortBy = 'num'; ST.activeBatch = 'new';
  const ta = _el('script-textarea'); if (ta) ta.value = proj.script||'';
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter==='all'));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort==='num'));
  if (ST.brolls.length) collapseInput(); else expandInput();
  H.stack=[]; H.pos=-1; refreshUR();
  renderProjectTabs();
  renderHeatmap(); renderStats(); renderCards(true); updateAllPromptChips();
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge(); syncCsetUI();
  updateSratingHint(); renderRatingTabs(); renderRatingPanel();
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

/* ── Rating Colors for Prompt Sets ─────────────────────────── */
function getRatingColor(score) {
  if (score === null || score === undefined) return null;
  const s = parseFloat(score);
  if (isNaN(s)) return null;
  if (s >= 10)  return { border:'#9333ea', bg:'rgba(147,51,234,0.15)', text:'#c084fc' }; // 10 is purple
  if (s >= 9.5) return { border:'#2563eb', bg:'rgba(37,99,235,0.15)',  text:'#60a5fa' }; // 9.5 is blue
  if (s >= 9)   return { border:'#16a34a', bg:'rgba(22,163,74,0.15)',  text:'#4ade80' }; // 9 is green
  if (s >= 8.5) return { border:'#ca8a04', bg:'rgba(202,138,4,0.15)',  text:'#facc15' }; // 8.5 is yellow
  if (s >= 8)   return { border:'#ea580c', bg:'rgba(234,88,12,0.15)',  text:'#fb923c' }; // 8 is orange
  if (s >= 7.5) return { border:'#f43f5e', bg:'rgba(244,63,94,0.15)',  text:'#fda4af' }; // 7.5 is light red
  if (s >= 7)   return { border:'#dc2626', bg:'rgba(220,38,38,0.15)',  text:'#f87171' }; // 7 is red
  return { border:'#7f1d1d', bg:'rgba(127,29,29,0.25)', text:'#ef4444' };                // below 7 is deep red
}

/* ── Set Ratings: parse, apply, delete, tabs & panels ────────── */
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
    ST.setRatings[brollNum][setIdx] = { score, why };
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
}

function deleteSetRating(num, setIdx) {
  if (!ST.setRatings?.[num] || ST.setRatings[num][setIdx] === undefined) return;
  const oldVal = ST.setRatings[num][setIdx];
  record(
    () => {
      if (!ST.setRatings[num]) ST.setRatings[num] = {};
      ST.setRatings[num][setIdx] = oldVal;
      save(); updateAllPromptChips(); updateSratingHint(); renderRatingPanel();
    },
    () => {
      delete ST.setRatings[num][setIdx];
      if (!Object.keys(ST.setRatings[num]).length) delete ST.setRatings[num];
      save(); updateAllPromptChips(); updateSratingHint(); renderRatingPanel();
    },
    `Delete rating for #${num} Set ${setIdx+1}`
  );
  delete ST.setRatings[num][setIdx];
  if (!Object.keys(ST.setRatings[num]).length) delete ST.setRatings[num];
  save();
  updateAllPromptChips();
  updateSratingHint();
  renderRatingPanel();
  toast(`🗑 Removed rating for #${num} Set ${setIdx+1}`);
}

function updateSratingHint() {
  const total = Object.values(ST.setRatings||{}).reduce((s,obj) => s + Object.keys(obj).length, 0);
  const hint = _el('srating-hint');
  if (hint) {
    hint.textContent = total ? `${total} rating${total !== 1 ? 's' : ''}` : '0 ratings';
    hint.className = 'srating-hint' + (total ? ' active' : '');
  }
  const summary = _el('srating-summary');
  if (summary && total) {
    const brolls = Object.keys(ST.setRatings).length;
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
      const r = sets[idx];
      const rColor = getRatingColor(r.score) || { border: 'var(--border)', text: 'var(--text-1)', bg: 'transparent' };
      const row = document.createElement('div');
      row.className = 'rdetail-row';
      row.innerHTML = `
        <span class="rdetail-set">Set ${idx + 1}</span>
        <span class="rdetail-score" style="border-color:${rColor.border};color:${rColor.text};background:${rColor.bg}">${r.score}</span>
        <span class="rdetail-why" title="${escHtml(r.why || '')}">${escHtml(r.why || '—')}</span>
        <button class="rdetail-del" title="Remove this rating">✕</button>
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

/* ── Why Popup (Hover Tooltip with Remove Option) ────────────── */
let _whyTimer = null;
function showWhyPopup(e, num, setIdx) {
  if (_whyTimer) { clearTimeout(_whyTimer); _whyTimer = null; }
  document.getElementById('why-popup')?.remove();
  const rating = ST.setRatings?.[num]?.[setIdx];
  const rColor = rating ? getRatingColor(rating.score) : null;

  const popup = document.createElement('div');
  popup.id = 'why-popup'; popup.className = 'why-popup';

  const hdr = document.createElement('div'); hdr.className = 'why-popup-hdr';
  const sb = document.createElement('span'); sb.className = 'why-score-badge';
  if (rColor) {
    sb.textContent = rating.score; sb.style.color = rColor.text;
  } else {
    sb.textContent = '—'; sb.style.color = 'var(--text-3)';
  }
  hdr.appendChild(sb);

  const lbl = document.createElement('span'); lbl.className = 'why-popup-label';
  lbl.textContent = `Set ${setIdx+1} for #${num}`; hdr.appendChild(lbl);

  if (rating) {
    const delBtn = document.createElement('button');
    delBtn.className = 'why-del-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Remove this rating';
    delBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      deleteSetRating(num, setIdx);
      popup.remove();
    });
    hdr.appendChild(delBtn);
  }

  const cls = document.createElement('button'); cls.className = 'why-close'; cls.textContent = '×';
  cls.addEventListener('click', () => popup.remove()); hdr.appendChild(cls);
  popup.appendChild(hdr);

  const body = document.createElement('div'); body.className = 'why-body';
  body.textContent = rating?.why || (rating ? 'No reason recorded.' : 'No rating yet.');
  popup.appendChild(body);

  const rect = e.currentTarget?.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : null;
  let posX = e.clientX;
  let posY = e.clientY + 12;
  if (rect) {
    posX = rect.left;
    posY = rect.bottom + 6;
  }

  popup.style.left = Math.min(posX, window.innerWidth - 290) + 'px';
  popup.style.top  = Math.min(posY, window.innerHeight - 170) + 'px';

  popup.addEventListener('mouseenter', () => {
    if (_whyTimer) { clearTimeout(_whyTimer); _whyTimer = null; }
  });
  popup.addEventListener('mouseleave', () => {
    hideWhyPopup(150);
  });

  document.body.appendChild(popup);
}

function hideWhyPopup(delay = 200) {
  if (_whyTimer) clearTimeout(_whyTimer);
  _whyTimer = setTimeout(() => {
    document.getElementById('why-popup')?.remove();
    _whyTimer = null;
  }, delay);
}


/* ── Clear Copy History ──────────────────────────────────────── */
function clearCopyHistory() {
  Object.values(ST.prompts).forEach(arr => arr.forEach(e => { e.copied = false; }));
  save(); updateAllPromptChips(); renderLibraryView();
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

/* ── Storage: delegate to saveProjects ─────────────────────── */
function save() { saveProjects(); }

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
function getCopyText(rawText) {
  const pre = ST.prefix.trim();
  const suf = ST.suffix.trim();
  let result = rawText;
  if (pre) result = pre + '\n\n' + result;
  if (suf) result = result + '\n\n' + suf;
  return result;
}

function updateCsetHint() {
  const pre = ST.prefix.trim(), suf = ST.suffix.trim();
  const hint = _el('cset-hint');
  if (!hint) return;
  if (pre && suf)   { hint.textContent = 'prefix + suffix'; hint.className = 'cset-hint active'; }
  else if (pre)     { hint.textContent = 'prefix on';       hint.className = 'cset-hint active'; }
  else if (suf)     { hint.textContent = 'suffix on';       hint.className = 'cset-hint active'; }
  else              { hint.textContent = 'off';             hint.className = 'cset-hint'; }
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
  toast(`✅ Imported ${total} prompts (${tabLabel})`);
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
function copyPrompt(num, idx, triggerEl) {
  const entry = (ST.prompts[num]||[])[idx]; if (!entry) return;
  const text = getCopyText(entry.text);
  const doFlash = () => {
    entry.copied = true; save();
    refreshCopyState(num, idx);
    toast(`📋 Copied set ${idx+1} for #${num}`);
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
  const lc = _el(`lcp-${num}-${idx}`); if (lc) lc.classList.add('copied');
}

/* ── Used Set ───────────────────────────────────────────────── */
function setUsedSet(num, idx) {
  // idx = null → clear; same idx clicked again → clear (toggle)
  const current = ST.usedSets[num];
  const newVal  = (current === idx || idx === null) ? undefined : idx;

  if (newVal === undefined) delete ST.usedSets[num];
  else ST.usedSets[num] = newVal;

  save();
  updateCardPrompts(num);
  updateSuBadge(num);
  updateLibraryUsedSet(num);
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

/* ── Update prompt chips on card ────────────────────────────── */
function buildPromptChip(num, i, entry) {
  const rating = ST.setRatings?.[num]?.[i];
  const rColor = rating ? getRatingColor(rating.score) : null;

  const chip = document.createElement('button');
  chip.className = 'p-chip' + (entry.copied ? ' copied' : '');
  chip.id = `pc-${num}-${i}`;

  if (rColor) {
    chip.style.borderColor = rColor.border;
    chip.style.background = rColor.bg;
  }

  const top = document.createElement('span'); top.className = 'p-chip-top';
  const n = document.createElement('span'); n.className = 'p-chip-num'; n.textContent = i+1; top.appendChild(n);
  if (entry.copied) { const ck = document.createElement('span'); ck.className = 'p-chip-ck'; ck.textContent = '✓'; top.appendChild(ck); }
  chip.appendChild(top);

  if (rating) {
    const rb = document.createElement('span'); rb.className = 'p-chip-rating';
    rb.textContent = rating.score; rb.style.color = rColor.text; chip.appendChild(rb);
  }

  chip.title = `Set ${i+1} for #${num}${rating ? ' · ' + rating.score : ''}\n\n• Left-click: Copy prompt\n• Right-click: ${entry.copied ? 'Untick copied' : 'Mark as copied'}\n• Hover: Show why reason`;
  
  // Left-click: Copy prompt
  chip.addEventListener('click', e => { e.stopPropagation(); copyPrompt(num, i, chip); });
  
  // Right-click: Untick / toggle copied checkmark
  chip.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    entry.copied = !entry.copied;
    save();
    refreshCopyState(num, i);
    toast(entry.copied ? `✓ Marked Set ${i+1} as copied` : `✕ Unticked Set ${i+1} for #${num}`);
  });

  // Hover: Show why popup
  chip.addEventListener('mouseenter', e => { showWhyPopup(e, num, i); });
  chip.addEventListener('mouseleave', () => { hideWhyPopup(150); });

  return chip;
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
}

function updateAllPromptChips() { ST.brolls.forEach(b => updateCardPrompts(b.num)); }

/* ── Filter & Sort ──────────────────────────────────────────── */
function passes(b) {
  const s = ST.scores[b.num] ?? null, f = ST.filter;
  if (f==='all')       return true;
  if (f==='unscored')  return s===null;
  if (f==='needs')     return s===null||s<9;
  if (f.startsWith('above:')) return s!==null&&s>=parseFloat(f.slice(6));
  if (f.startsWith('below:')) return s===null||s<parseFloat(f.slice(6));
  if (f==='perfect')   return s!==null&&snap(s)===10;
  return true;
}
function sortedList(arr) {
  if (ST.sortBy==='num')  return [...arr].sort((a,b)=>a.num-b.num);
  if (ST.sortBy==='asc')  return [...arr].sort((a,b)=>(ST.scores[a.num]??-1)-(ST.scores[b.num]??-1));
  if (ST.sortBy==='desc') return [...arr].sort((a,b)=>(ST.scores[b.num]??-1)-(ST.scores[a.num]??-1));
  return arr;
}

/* ── Heatmap ────────────────────────────────────────────────── */
function renderHeatmap() {
  const grid = _el('heatmap-grid'); if (!grid) return;
  grid.innerHTML = '';
  if (!ST.brolls.length) { grid.innerHTML = '<span style="color:#44445a;font-size:11px;align-self:center;padding:0 4px">No script loaded</span>'; return; }
  const N=ST.brolls.length, W=grid.clientWidth||(window.innerWidth-32);
  const cw=Math.max(4,Math.min(44,Math.floor((W-(N-1)*2)/N)));
  const showNum=cw>=16, fs=cw>=22?9:cw>=16?7:0;
  ST.brolls.forEach(b => {
    const col=getC(ST.scores[b.num]??null), el=document.createElement('div');
    el.className='hm-cell'; el.id=`hm-${b.num}`;
    el.style.cssText=`width:${cw}px;background:${col.bg}`;
    el.title=`#${b.num}${ST.scores[b.num]!==undefined?` · ${ST.scores[b.num]}/10`:' · unscored'}\n${b.line.slice(0,55)}`;
    if(showNum&&fs>0){const sp=document.createElement('span');sp.className='hm-cell-num';sp.style.fontSize=fs+'px';sp.textContent=b.num;el.appendChild(sp);}
    el.addEventListener('click',()=>_el(`card-${b.num}`)?.scrollIntoView({behavior:'smooth',block:'center'}));
    grid.appendChild(el);
  });
}
function updateHmCell(num) { const el=_el(`hm-${num}`);if(el)el.style.background=getC(ST.scores[num]??null).bg; }

/* ── Stats ──────────────────────────────────────────────────── */
function renderStats() {
  const total=ST.brolls.length, scored=ST.brolls.filter(b=>ST.scores[b.num]!==undefined&&ST.scores[b.num]!==null).length;
  const greens=ST.brolls.filter(b=>(ST.scores[b.num]??-1)>=9).length;
  const vals=ST.brolls.map(b=>ST.scores[b.num]).filter(s=>s!==null&&s!==undefined);
  const avg=vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):null;
  setText('st-total',total); setText('st-scored',`${scored}/${total}`); setText('st-green',greens); setText('st-avg',avg||'—');
  const ps=total?Math.round(scored/total*100):0, pg=total?Math.round(greens/total*100):0;
  setStyle('prog-s','width',ps+'%'); setStyle('prog-g','width',pg+'%');
  setText('prog-s-pct',ps+'%'); setText('prog-g-pct',pg+'%');
  const badge=_el('it-badge'); if(badge)badge.textContent=total?`${total} clips`:'empty';
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
  const slWrap=document.createElement('div'); slWrap.className='slider-wrap';
  const inp=document.createElement('input');
  inp.type='range'; inp.min='0'; inp.max='10'; inp.step='0.5'; inp.value=score!==null?score:'0';
  inp.className='score-slider'; inp.id=`sl-${b.num}`;
  inp.setAttribute('list','score-steps'); inp.setAttribute('aria-label',`B-roll ${b.num} score`);
  applySliderStyle(inp, score);
  let lastSnap=snap(score);
  inp.addEventListener('input',()=>{const v=parseFloat(inp.value),s=snap(v);applySliderStyle(inp,v);updateScoreVal(b.num,v);if(s!==lastSnap){lastSnap=s;inp.classList.remove('snap-pop');void inp.offsetWidth;inp.classList.add('snap-pop');setTimeout(()=>inp&&inp.classList.remove('snap-pop'),160);}});
  inp.addEventListener('change',()=>setScore(b.num,parseFloat(inp.value)));
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setScore(b.num,parseFloat(inp.value));const idx=ST.brolls.findIndex(x=>x.num===b.num);if(idx<ST.brolls.length-1){const ns=_el(`sl-${ST.brolls[idx+1].num}`);if(ns){ns.focus();ns.scrollIntoView({behavior:'smooth',block:'center'});}}}});
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

  const clr=document.createElement('button'); clr.className='c-clear'; clr.textContent='✕'; clr.title='Clear score';
  clr.setAttribute('aria-label',`Clear score for B-roll ${b.num}`);
  clr.addEventListener('click',()=>clearScore(b.num));
  right.appendChild(clr);

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
  toast(`✅ Loaded ${brolls.length} B-roll clips`);
}
function collapseInput(){_el('input-section')?.classList.add('collapsed');ST.inputOpen=false;const ch=document.querySelector('#input-section .it-chevron');if(ch)ch.textContent='▼';}
function expandInput(){_el('input-section')?.classList.remove('collapsed');ST.inputOpen=true;const ch=document.querySelector('#input-section .it-chevron');if(ch)ch.textContent='▲';}

/* ── Filter ─────────────────────────────────────────────────── */
function setFilter(f){
  ST.filter=f;
  document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('active',c.dataset.filter===f);c.setAttribute('aria-pressed',c.dataset.filter===f);});
  if(!f.startsWith('below:')){const e=_el('fb-below');if(e)e.value='';}
  if(!f.startsWith('above:')){const e=_el('fb-above');if(e)e.value='';}
  renderCards(); renderFilterCount();
}

/* ── Export / Import ────────────────────────────────────────── */
function exportData(){
  const ta=_el('script-textarea');
  const d={v:5,date:new Date().toISOString(),script:ta?.value||'',scores:ST.scores,prompts:ST.prompts,batches:ST.batches,usedSets:ST.usedSets,prefix:ST.prefix,suffix:ST.suffix};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));
  a.download=`broll-${new Date().toISOString().slice(0,10)}.json`; a.click(); toast('📥 Exported');
}
function importJSON(file){
  const r=new FileReader();
  r.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.script)_el('script-textarea').value=d.script;ST.scores=d.scores||{};ST.prompts=d.prompts||{};ST.batches=d.batches||[];ST.usedSets=d.usedSets||{};if(d.prefix!==undefined)ST.prefix=d.prefix;if(d.suffix!==undefined)ST.suffix=d.suffix;if(d.script)loadScript(d.script,true);save();renderLibraryView();renderBatchTabs();updateLibBadge();syncCsetUI();toast('📤 Imported');}catch{toast('❌ Invalid file');}};
  r.readAsText(file);
}

function syncCsetUI(){
  const pre=_el('cset-prefix'), suf=_el('cset-suffix');
  if(pre)pre.value=ST.prefix; if(suf)suf.value=ST.suffix; updateCsetHint();
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

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  loadProjects();
  const proj = PROJECTS[ACTIVE_PID] || {};
  ST.scores      = proj.scores      || {};
  ST.prompts     = _migratePrompts(proj.prompts);
  ST.batches     = proj.batches     || [];
  ST.usedSets    = proj.usedSets    || {};
  ST.setRatings  = proj.setRatings  || {};
  ST.brolls      = parseScript(proj.script || '');
  loadGlobalCset();   // Load prefix/suffix from global key

  const ta = _el('script-textarea'); if (ta) ta.value = proj.script || '';

  _el('library-section')?.classList.add('collapsed');
  _el('cset-section')?.classList.add('collapsed');
  if (ST.brolls.length) collapseInput();

  renderProjectTabs();
  renderHeatmap(); renderStats(); renderCards(!!ST.brolls.length);
  renderBatchTabs(); renderBatchPanel(); renderLibraryView(); updateLibBadge();
  syncCsetUI(); updateSratingHint(); renderRatingTabs(); renderRatingPanel(); refreshUR();
  scrollToLastScoredBroll();

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
  _el('script-textarea').addEventListener('paste', () => autoPad(_el('script-textarea')));
  _el('prompt-textarea').addEventListener('paste', () => autoPad(_el('prompt-textarea')));

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
  _el('btn-reset').addEventListener('click',()=>showModal('Reset all scores?','Scores cleared, script and prompts kept.',()=>{ST.scores={};save();renderHeatmap();renderStats();renderCards();toast('↺ Scores reset');}));
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
  _el('cset-clear-pre').addEventListener('click',()=>{ST.prefix='';_el('cset-prefix').value='';saveGlobalCset();updateCsetHint();toast('Prefix cleared');});
  _el('cset-clear-suf').addEventListener('click',()=>{ST.suffix='';_el('cset-suffix').value='';saveGlobalCset();updateCsetHint();toast('Suffix cleared');});

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

  /* Filter */
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>setFilter(c.dataset.filter)));
  _el('fb-below').addEventListener('input',e=>{const v=e.target.value.trim();if(!v){setFilter('all');return;}const n=parseFloat(v);if(!isNaN(n)){ST.filter=`below:${n}`;document.querySelectorAll('.chip').forEach(c=>{c.classList.remove('active');c.setAttribute('aria-pressed','false');});renderCards();renderFilterCount();}});
  _el('fb-above').addEventListener('input',e=>{const v=e.target.value.trim();if(!v){setFilter('all');return;}const n=parseFloat(v);if(!isNaN(n)){ST.filter=`above:${n}`;document.querySelectorAll('.chip').forEach(c=>{c.classList.remove('active');c.setAttribute('aria-pressed','false');});renderCards();renderFilterCount();}});

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

  /* Jump to top */
  const jt=_el('jump-top');
  window.addEventListener('scroll',()=>jt?.classList.toggle('visible',scrollY>300),{passive:true});
  jt?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

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
