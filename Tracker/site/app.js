const STORAGE_KEY = "gemini-flow-tracker-data-v1";
const OLD_ENTRIES_KEY = "window-command-entries-v4";
const OLD_SETTINGS_KEY = "window-command-settings-v4";
const DEFAULT_NAMES = ["ANOY", "AVI", "MOU", "MIND", "LION", "TRI"];
const DEFAULT_TIMES = ["14:18", "14:33", "17:09", "15:50", "13:29", "16:38"];
const DEFAULT_FLOW_RESET_DAYS = [2, 21, 24, 12, 22, 1];

let state = loadState();
let daySchedule = [];
let monthSchedule = [];
let audioContext = null;

const el = {
  soundButton: document.querySelector("#soundButton"),
  settingsButton: document.querySelector("#settingsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  uploadButton: document.querySelector("#uploadButton"),
  uploadInput: document.querySelector("#uploadInput"),
  geminiTab: document.querySelector("#geminiTab"),
  flowTab: document.querySelector("#flowTab"),
  geminiView: document.querySelector("#geminiView"),
  flowView: document.querySelector("#flowView"),
  datePicker: document.querySelector("#datePicker"),
  prevDayButton: document.querySelector("#prevDayButton"),
  nextDayButton: document.querySelector("#nextDayButton"),
  todayButton: document.querySelector("#todayButton"),
  scheduleTitle: document.querySelector("#scheduleTitle"),
  selectedDayVideos: document.querySelector("#selectedDayVideos"),
  weekVideos: document.querySelector("#weekVideos"),
  monthTitle: document.querySelector("#monthTitle"),
  monthAchieved: document.querySelector("#monthAchieved"),
  calendarGrid: document.querySelector("#calendarGrid"),
  windowList: document.querySelector("#windowList"),
  flowList: document.querySelector("#flowList"),
  flowTotalLeft: document.querySelector("#flowTotalLeft"),
  flowUsed: document.querySelector("#flowUsed"),
  flowResetSoon: document.querySelector("#flowResetSoon"),
  flowMonthTitle: document.querySelector("#flowMonthTitle"),
  flowMonthUsed: document.querySelector("#flowMonthUsed"),
  flowCalendarGrid: document.querySelector("#flowCalendarGrid"),
  flowAlerts: document.querySelector("#flowAlerts"),
  requestNotificationButton: document.querySelector("#requestNotificationButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  resetDefaultsButton: document.querySelector("#resetDefaultsButton"),
  geminiCycleHours: document.querySelector("#geminiCycleHours"),
  geminiWindowMinutes: document.querySelector("#geminiWindowMinutes"),
  geminiVideoLimit: document.querySelector("#geminiVideoLimit"),
  flowMonthlyCredits: document.querySelector("#flowMonthlyCredits"),
  flowCreditsPerVideo: document.querySelector("#flowCreditsPerVideo"),
  flowReminderThreshold: document.querySelector("#flowReminderThreshold"),
  geminiSettingsAccounts: document.querySelector("#geminiSettingsAccounts"),
  flowSettingsAccounts: document.querySelector("#flowSettingsAccounts"),
  newGeminiAccountName: document.querySelector("#newGeminiAccountName"),
  newGeminiAccountTime: document.querySelector("#newGeminiAccountTime"),
  addGeminiAccountButton: document.querySelector("#addGeminiAccountButton"),
  newFlowAccountName: document.querySelector("#newFlowAccountName"),
  newFlowResetDay: document.querySelector("#newFlowResetDay"),
  addFlowAccountButton: document.querySelector("#addFlowAccountButton"),
};

init();

// ============================================================
// INIT
// ============================================================

function init() {
  state = normalizeState(state);
  applyFlowResets();
  // Always open on today's date
  state.selectedDate = dateKey(new Date());
  el.datePicker.value = state.selectedDate;
  bindEvents();
  updateSoundButton();
  registerServiceWorker();
  rebuild({ scroll: true });
  setInterval(() => rebuild({ quiet: true }), 30000);
}

function bindEvents() {
  el.soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    saveState();
    updateSoundButton();
    playTone("tap");
  });

  el.settingsButton.addEventListener("click", () => {
    renderSettings();
    el.settingsDialog.showModal();
    playTone("tap");
  });

  el.downloadButton.addEventListener("click", () => {
    downloadJson();
    playTone("success");
  });

  el.uploadButton.addEventListener("click", () => el.uploadInput.click());
  el.uploadInput.addEventListener("change", handleUpload);
  el.geminiTab.addEventListener("click", () => setMode("gemini"));
  el.flowTab.addEventListener("click", () => setMode("flow"));

  el.datePicker.addEventListener("change", () => {
    state.selectedDate = el.datePicker.value || dateKey(new Date());
    saveState();
    playTone("tap");
    rebuild({ scroll: true });
  });

  el.prevDayButton.addEventListener("click", () => changeDay(-1));
  el.nextDayButton.addEventListener("click", () => changeDay(1));
  el.todayButton.addEventListener("click", () => {
    state.selectedDate = dateKey(new Date());
    el.datePicker.value = state.selectedDate;
    saveState();
    playTone("tap");
    rebuild({ scroll: true });
  });

  el.requestNotificationButton.addEventListener("click", requestNotifications);
  el.resetDefaultsButton.addEventListener("click", () => {
    if (!window.confirm("Reset settings to defaults? Your logged Gemini windows stay saved.")) return;
    state.gemini = defaultGeminiSettings();
    state.flow = defaultFlowSettings();
    saveState();
    playTone("success");
    rebuild({ scroll: true });
  });

  bindSettingsInputs();
}

function bindSettingsInputs() {
  [
    [el.geminiCycleHours, () => {
      state.gemini.cycleMinutes = clampNumber(Number(el.geminiCycleHours.value) * 60, 60, 1440);
    }],
    [el.geminiWindowMinutes, () => {
      state.gemini.windowMinutes = clampNumber(el.geminiWindowMinutes.value, 10, 240);
    }],
    [el.geminiVideoLimit, () => {
      state.gemini.videosPerAccount = clampNumber(el.geminiVideoLimit.value, 0, 20);
    }],
    [el.flowMonthlyCredits, () => {
      const next = clampNumber(el.flowMonthlyCredits.value, 1, 100000);
      state.flow.monthlyCredits = next;
      state.flow.accounts.forEach((account) => { account.creditsLeft = clampNumber(account.creditsLeft, 0, next); });
    }],
    [el.flowCreditsPerVideo, () => {
      state.flow.creditsPerVideo = clampNumber(el.flowCreditsPerVideo.value, 1, 10000);
    }],
    [el.flowReminderThreshold, () => {
      state.flow.reminderThreshold = clampNumber(el.flowReminderThreshold.value, 0, 100000);
    }],
  ].forEach(([input, update]) => {
    input.addEventListener("change", () => {
      update();
      saveState();
      playTone("tap");
      rebuild();
    });
  });

  el.addGeminiAccountButton.addEventListener("click", () => {
    const name = cleanName(el.newGeminiAccountName.value);
    const time = el.newGeminiAccountTime.value;
    if (!name || !time) return;
    state.gemini.accounts.push({
      id: uniqueAccountId(name, state.gemini.accounts),
      name,
      time,
      anchorDate: state.selectedDate || dateKey(new Date()),
      autofill: state.gemini.videosPerAccount,
    });
    el.newGeminiAccountName.value = "";
    el.newGeminiAccountTime.value = "";
    saveState();
    playTone("success");
    rebuild();
  });

  el.addFlowAccountButton.addEventListener("click", () => {
    const name = cleanName(el.newFlowAccountName.value);
    const resetDay = clampNumber(el.newFlowResetDay.value || 1, 1, 31);
    if (!name) return;
    state.flow.accounts.push({
      id: uniqueAccountId(name, state.flow.accounts),
      name,
      creditsLeft: state.flow.monthlyCredits,
      resetDay,
      lastResetMonth: "",
      lastReminderKey: "",
    });
    el.newFlowAccountName.value = "";
    el.newFlowResetDay.value = "";
    saveState();
    playTone("success");
    rebuild();
  });
}

// ============================================================
// REBUILD / MODE
// ============================================================

function rebuild(options = {}) {
  state = normalizeState(state);
  applyFlowResets();
  daySchedule = buildDaySchedule(selectedDate());
  monthSchedule = buildMonthSchedule(selectedDate());
  renderMode();
  renderGemini();
  renderFlow();
  renderSettings();
  checkFlowReminders();
  if (!options.quiet) saveState();
  if (options.scroll && state.activeMode === "gemini") scrollToCurrentWindow();
}

function setMode(mode) {
  state.activeMode = mode;
  // Gemini tab always jumps to today
  if (mode === "gemini") {
    state.selectedDate = dateKey(new Date());
    el.datePicker.value = state.selectedDate;
  }
  saveState();
  playTone("tap");
  rebuild({ scroll: mode === "gemini" });
}

function renderMode() {
  const gemini = state.activeMode !== "flow";
  el.geminiTab.classList.toggle("active", gemini);
  el.flowTab.classList.toggle("active", !gemini);
  el.geminiView.classList.toggle("active", gemini);
  el.flowView.classList.toggle("active", !gemini);
}

// ============================================================
// GEMINI RENDERING
// ============================================================

function renderGemini() {
  renderTitles();
  renderCalendar();
  renderSchedule();
  renderGeminiStats();
}

function renderSchedule() {
  // Snapshot open/closed state before wiping the DOM
  const existingDetails = [...el.windowList.querySelectorAll("details[data-row-id]")];
  const isReRender = existingDetails.some((d) => daySchedule.some((row) => row.id === d.dataset.rowId));
  const openRowIds = new Set(existingDetails.filter((d) => d.open).map((d) => d.dataset.rowId));

  el.windowList.innerHTML = "";
  if (!daySchedule.length) {
    el.windowList.innerHTML = `<div class="empty-state">No blocks scheduled for this day. Check account reset times in Settings.</div>`;
    return;
  }

  const focusIndex = focusedWindowIndex();
  const now = new Date();

  daySchedule.forEach((row, index) => {
    const totals = rowTotals(row);
    const stateLabel = windowStateLabel(row);
    const lockedKeys = lockedAccountsForRow(row);

    const hasAvailableAccounts = row.order.some((entry) => {
      const val = getAccountCount(row, entry);
      const cycleEnd = addMinutes(entry.cycleStart, state.gemini.cycleMinutes);
      const isLive = entry.cycleStart <= now && cycleEnd > now;
      return isLive && val < state.gemini.videosPerAccount;
    });

    const open = isReRender
      ? openRowIds.has(row.id)
      : (index === focusIndex || hasAvailableAccounts);

    const details = document.createElement("details");
    details.className = "window-card";
    details.dataset.rowId = row.id;
    details.open = open;
    details.classList.toggle("is-current", row.start <= now && row.end >= now);
    details.classList.toggle("is-past", row.end < now);

    details.innerHTML = `
      <summary class="window-summary">
        <div>
          <span class="window-kicker">${stateLabel}</span>
          <strong>${row.window}</strong>
        </div>
        <div class="summary-score">
          <button class="score-count-btn" type="button" data-row="${row.id}" title="Tap to set custom total">${totals.done}</button>
          <span>${totals.missed ? `${totals.missed} missed` : "on track"}</span>
        </div>
      </summary>
      <div class="window-tools">
        <button class="fill-window-button ${totals.done >= totals.max ? "active" : ""}" type="button" data-row="${row.id}" aria-label="${totals.done >= totals.max ? "Clear window" : "Fill window"}" title="${totals.done >= totals.max ? "Clear window" : "Fill window"}">
          <span></span>
        </button>
      </div>
      <div class="account-sliders">
        ${row.order.map((entry) => accountRowHtml(row, entry, lockedKeys.includes(entry.entryKey))).join("")}
      </div>
    `;
    el.windowList.appendChild(details);
  });

  el.windowList.querySelectorAll(".gemini-toggle").forEach((btn) => {
    btn.addEventListener("click", handleGeminiToggle);
  });
  el.windowList.querySelectorAll(".account-count-btn").forEach((btn) => {
    btn.addEventListener("click", handleAccountCountClick);
  });
  el.windowList.querySelectorAll(".score-count-btn").forEach((btn) => {
    btn.addEventListener("click", handleScoreCountClick);
  });
  el.windowList.querySelectorAll(".fill-window-button").forEach((btn) => {
    btn.addEventListener("click", handleFillWindow);
  });
}

function accountRowHtml(row, entry, isLocked = false) {
  const now = new Date();
  const value = getAccountCount(row, entry);
  const cycleEnd = addMinutes(entry.cycleStart, state.gemini.cycleMinutes);
  const minutesLeft = Math.max(0, Math.round((cycleEnd - now) / 60000));

  const isLive = entry.cycleStart <= now && cycleEnd > now;
  const isPast = cycleEnd < now;
  const max = state.gemini.videosPerAccount;
  const isFull = max > 0 && value >= max;

  let stateClass = "";
  if (isLocked) stateClass = "is-locked";
  else if (isPast || isFull) stateClass = "is-grey";
  else if (isLive) stateClass = "is-live";

  const isOn = value > 0;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  // Countdown label & colour — always show time to next/current reset,
  // even for past cycles. For past cycles, look up the cycle active *right now*.
  const activeCycleEnd = isPast ? accountCycleFor(entry, now).end : cycleEnd;
  const minsLeft = Math.max(0, Math.round((activeCycleEnd - now) / 60000));

  let countdownClass = "reset-ok";
  let resetText = "";
  if (isLocked) {
    resetText = `🔒 unlocks ${formatTimeLabel(entry.cycleStart)}`;
  } else {
    if (minsLeft < 15) countdownClass = "reset-urgent";
    else if (minsLeft < 60) countdownClass = "reset-warn";
    resetText = minsLeft < 2 ? "resetting now" : `${minsLeft} min left`;
  }

  const cycleTimeStr = `${formatTimeLabel(entry.cycleStart)} – ${formatTimeLabel(cycleEnd)}`;

  return `
    <div class="account-row ${stateClass}" style="--fill:${pct}%">
      <div class="account-meta">
        <b>${escapeHtml(entry.name)}</b>
        <span class="cycle-range">${cycleTimeStr}</span>
        <small class="${countdownClass}">${resetText}</small>
      </div>
      <div class="account-controls">
        <button class="gemini-toggle ${isOn ? "is-on" : ""}" type="button"
          data-row="${row.id}" data-account="${entry.id}" data-entry-key="${entry.entryKey}"
          ${isLocked ? "disabled" : ""}
          aria-label="${escapeAttribute(entry.name)} ${isOn ? "on" : "off"}" aria-pressed="${isOn}">
          <span></span>
        </button>
        <button class="account-count-btn ${isOn ? "is-on" : ""}" type="button"
          data-row="${row.id}" data-account="${entry.id}" data-entry-key="${entry.entryKey}"
          ${isLocked ? "disabled" : ""}
          aria-label="Edit count for ${escapeAttribute(entry.name)}">
          ${value}
        </button>
      </div>
    </div>
  `;
}

// Toggle ON = autofill value, OFF = 0
function handleGeminiToggle(event) {
  const btn = event.currentTarget;
  const row = rowById(btn.dataset.row);
  if (!row || btn.disabled) return;
  const orderEntry = row.order.find((e) => e.entryKey === btn.dataset.entryKey);
  if (!orderEntry) return;
  const account = state.gemini.accounts.find((a) => a.id === btn.dataset.account);
  const currentValue = getAccountCount(row, orderEntry);
  const autofill = account?.autofill ?? state.gemini.videosPerAccount;
  const nextValue = currentValue > 0 ? 0 : Math.max(1, autofill);
  setAccountCount(row, orderEntry, nextValue);
  playTone("tap");
  renderSchedule();
  renderCalendar();
  renderGeminiStats();
}

// Click count number → prompt for custom value
function handleAccountCountClick(event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const row = rowById(btn.dataset.row);
  if (!row || btn.disabled) return;
  const orderEntry = row.order.find((e) => e.entryKey === btn.dataset.entryKey);
  if (!orderEntry) return;
  const current = getAccountCount(row, orderEntry);
  const raw = window.prompt(`Videos for ${orderEntry.name}:`, current);
  if (raw === null || raw.trim() === "") return;
  const count = Math.max(0, Math.round(Number(raw)));
  if (Number.isNaN(count)) return;
  setAccountCount(row, orderEntry, count);
  playTone("success");
  renderSchedule();
  renderCalendar();
  renderGeminiStats();
}

// Click window summary score → set total, distributed equally
function handleScoreCountClick(event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const row = rowById(btn.dataset.row);
  if (!row) return;
  const totals = rowTotals(row);
  const raw = window.prompt(`Total videos for this window:\n(Split equally across accounts)`, totals.done);
  if (raw === null || raw.trim() === "") return;
  const target = Math.max(0, Math.round(Number(raw)));
  if (Number.isNaN(target)) return;
  const lockedKeys = lockedAccountsForRow(row);
  const unlocked = row.order.filter((e) => !lockedKeys.includes(e.entryKey));
  if (!unlocked.length) return;
  const perAccount = Math.floor(target / unlocked.length);
  const remainder = target % unlocked.length;
  unlocked.forEach((entry, i) => {
    setAccountCount(row, entry, perAccount + (i < remainder ? 1 : 0));
  });
  playTone("success");
  renderSchedule();
  renderCalendar();
  renderGeminiStats();
}

function handleFillWindow(event) {
  const row = rowById(event.currentTarget.dataset.row);
  if (!row) return;
  const totals = rowTotals(row);
  const nextValue = totals.done >= totals.max ? 0 : state.gemini.videosPerAccount;
  const lockedKeys = lockedAccountsForRow(row);
  row.order
    .filter((entry) => !lockedKeys.includes(entry.entryKey))
    .forEach((entry) => setAccountCount(row, entry, nextValue));
  playTone("success");
  renderSchedule();
  renderCalendar();
  renderGeminiStats();
}

function refreshWindowSummary(rowId) {
  const row = rowById(rowId);
  const card = el.windowList.querySelector(`[data-row-id="${rowId}"]`);
  if (!row || !card) return;
  const totals = rowTotals(row);
  const score = card.querySelector(".summary-score");
  score.innerHTML = `<button class="score-count-btn" type="button" data-row="${rowId}" title="Tap to set custom total">${totals.done}</button><span>${totals.missed ? `${totals.missed} missed` : "on track"}</span>`;
  card.querySelector(".score-count-btn")?.addEventListener("click", handleScoreCountClick);
}

function renderCalendar() {
  el.calendarGrid.innerHTML = "";
  // No target — colour by raw count relative to a "full day" estimate
  const maxPerDay = Math.max(1, state.gemini.videosPerAccount * state.gemini.accounts.length);
  daysInSelectedMonth().forEach((date) => {
    const count = videosOnDate(date);
    const ratio = Math.min(count / maxPerDay, 1);
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.style.setProperty("--day-bg", dayGradient(ratio));
    button.classList.toggle("selected", dateKey(date) === state.selectedDate);
    button.classList.toggle("today", dateKey(date) === dateKey(new Date()));
    button.innerHTML = `<span>${date.getDate()}</span><strong>${count > 0 ? count : ""}</strong>`;
    button.addEventListener("click", () => {
      state.selectedDate = dateKey(date);
      el.datePicker.value = state.selectedDate;
      saveState();
      playTone("tap");
      rebuild({ scroll: true });
    });
    el.calendarGrid.appendChild(button);
  });
}

function renderGeminiStats() {
  el.selectedDayVideos.textContent = videosOnDate(new Date()).toLocaleString("en-US");
  el.weekVideos.textContent = videosThisWeek().toLocaleString("en-US");
  el.monthAchieved.textContent = videosThisMonth().toLocaleString("en-US");
}

// Sum of all logged video counts for a specific date
function videosOnDate(date) {
  const key = dateKey(date);
  return Object.values(state.gemini.cycleEntries)
    .filter((e) => e.cycleStart && dateKey(new Date(e.cycleStart)) === key)
    .reduce((sum, e) => sum + Math.max(0, Math.round(Number(e.count) || 0)), 0);
}

// Mon–today of the current calendar week
function videosThisWeek() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(today);
  mon.setDate(today.getDate() - daysFromMon);
  mon.setHours(0, 0, 0, 0);
  let total = 0;
  const cur = new Date(mon);
  while (cur <= today) {
    total += videosOnDate(cur);
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

// 1st of month through today
function videosThisMonth() {
  const today = new Date();
  let total = 0;
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cur <= today) {
    total += videosOnDate(cur);
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

function renderTitles() {
  const selected = selectedDate();
  el.scheduleTitle.textContent = selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
  el.monthTitle.textContent = selected.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ============================================================
// FLOW RENDERING
// ============================================================

function renderFlow() {
  el.flowList.innerHTML = "";
  renderFlowCalendar();

  const max = state.flow.monthlyCredits;
  const cpv = state.flow.creditsPerVideo || 15;
  const alerts = [];
  let totalLeft = 0;
  let soon = 0;

  // Sort accounts so the one with the nearest reset day is on top
  const sortedAccounts = [...state.flow.accounts].sort((a, b) => {
    return nextMonthlyReset(a.resetDay) - nextMonthlyReset(b.resetDay);
  });

  sortedAccounts.forEach((account) => {
    const reset = nextMonthlyReset(account.resetDay);
    const daysLeft = daysUntil(reset);
    const used = Math.max(0, max - account.creditsLeft);
    totalLeft += account.creditsLeft;
    const videosMade = Math.floor(used / cpv);

    if (daysLeft <= 1 && account.creditsLeft > state.flow.reminderThreshold) {
      soon += 1;
      alerts.push(`${account.name}: ${account.creditsLeft} credits left, resets ${daysLeft === 0 ? "today" : "tomorrow"}.`);
    }

    const pct = max ? Math.round((account.creditsLeft / max) * 100) : 0;
    const resetLabel = daysLeft === 0 ? "Resets today" : daysLeft === 1 ? "Resets tomorrow" : `Resets in ${daysLeft} days`;

    const card = document.createElement("article");
    card.className = "flow-card";
    card.style.setProperty("--fill", `${pct}%`);
    card.innerHTML = `
      <div class="flow-top">
        <div>
          <span class="window-kicker">${resetLabel}</span>
          <h3>${escapeHtml(account.name)}</h3>
        </div>
        <strong class="flow-left-value">${account.creditsLeft.toLocaleString("en-US")}</strong>
      </div>
      <div class="flow-credit-row">
        <input class="flow-credit-input" type="number" min="0" max="${max}" value="${account.creditsLeft}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} credits left" inputmode="numeric">
        <button class="small-button refill-button" type="button" data-id="${account.id}">Full</button>
      </div>
      <div class="flow-meta-row">
        <span class="flow-videos-made">🎬 ${videosMade}</span>
        <span class="flow-used-val">${used.toLocaleString("en-US")} used</span>
        <label class="flow-reset-label">Day <input class="reset-day-input" type="number" min="1" max="31" value="${account.resetDay}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} reset day" inputmode="numeric"></label>
      </div>
    `;
    el.flowList.appendChild(card);
  });

  el.flowTotalLeft.textContent = totalLeft.toLocaleString("en-US");
  el.flowUsed.textContent = Math.max(0, state.flow.accounts.length * max - totalLeft).toLocaleString("en-US");
  el.flowResetSoon.textContent = soon.toLocaleString("en-US");
  el.flowAlerts.innerHTML = alerts.length ? alerts.map((text) => `<p>${escapeHtml(text)}</p>`).join("") : `<p>No urgent Flow reset reminders.</p>`;

  el.flowList.querySelectorAll(".flow-credit-input").forEach((input) => {
    input.addEventListener("change", handleFlowCreditInput);
    input.addEventListener("blur", handleFlowCreditInput);
  });
  el.flowList.querySelectorAll(".reset-day-input").forEach((input) => {
    input.addEventListener("change", handleFlowResetDay);
  });
  el.flowList.querySelectorAll(".refill-button").forEach((button) => {
    button.addEventListener("click", () => {
      const account = state.flow.accounts.find((item) => item.id === button.dataset.id);
      if (!account) return;
      account.creditsLeft = state.flow.monthlyCredits;
      account.lastResetMonth = monthKey(new Date());
      saveState();
      playTone("success");
      renderFlow();
      renderSettings();
    });
  });
}

function handleFlowCreditInput(event) {
  const input = event.currentTarget;
  const account = state.flow.accounts.find((item) => item.id === input.dataset.id);
  if (!account) return;
  const previousLeft = account.creditsLeft;
  const newVal = clampNumber(input.value, 0, state.flow.monthlyCredits);
  input.value = newVal;
  if (newVal === previousLeft) return;
  account.creditsLeft = newVal;
  recordFlowUsage(previousLeft - newVal);

  const card = input.closest(".flow-card");
  const pct = state.flow.monthlyCredits ? (newVal / state.flow.monthlyCredits) * 100 : 0;
  card?.style.setProperty("--fill", `${pct}%`);

  const leftValue = card?.querySelector(".flow-left-value");
  const videosMadeEl = card?.querySelector(".flow-videos-made");
  const usedValEl = card?.querySelector(".flow-used-val");
  const used = Math.max(0, state.flow.monthlyCredits - newVal);
  const cpv = state.flow.creditsPerVideo || 15;
  const videosMade = Math.floor(used / cpv);

  if (leftValue) leftValue.textContent = newVal.toLocaleString("en-US");
  if (videosMadeEl) videosMadeEl.textContent = `🎬 ${videosMade} video${videosMade !== 1 ? "s" : ""} made`;
  if (usedValEl) usedValEl.textContent = `${used.toLocaleString("en-US")} used`;

  saveState();
}

function renderFlowCalendar() {
  el.flowCalendarGrid.innerHTML = "";
  const selected = selectedDate();
  const monthLabel = selected.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = daysInSelectedMonth();
  const monthUsed = days.reduce((sum, date) => sum + flowUsedOnDate(dateKey(date)), 0);
  el.flowMonthTitle.textContent = monthLabel;
  el.flowMonthUsed.textContent = `${monthUsed.toLocaleString("en-US")} used`;

  days.forEach((date) => {
    const used = flowUsedOnDate(dateKey(date));
    const resetNames = flowResetNamesForDate(date);
    const ratio = state.flow.monthlyCredits ? used / state.flow.monthlyCredits : 0;
    const button = document.createElement("button");
    button.className = "calendar-day flow-calendar-day";
    button.type = "button";
    button.style.setProperty("--day-bg", flowDayGradient(ratio));
    button.classList.toggle("selected", dateKey(date) === state.selectedDate);
    button.classList.toggle("today", dateKey(date) === dateKey(new Date()));
    button.innerHTML = `
      <span>${date.getDate()}</span>
      <strong>${used.toLocaleString("en-US")}</strong>
      ${resetNames.length ? `<em>${resetNames.map(escapeHtml).join(", ")}</em>` : ""}
    `;
    button.addEventListener("click", () => {
      state.selectedDate = dateKey(date);
      el.datePicker.value = state.selectedDate;
      saveState();
      playTone("tap");
      rebuild();
    });
    el.flowCalendarGrid.appendChild(button);
  });
}

function flowResetNamesForDate(date) {
  const key = dateKey(date);
  return state.flow.accounts
    .filter((account) => dateKey(resetDateForMonth(date.getFullYear(), date.getMonth(), account.resetDay)) === key)
    .map((account) => account.name);
}

function recordFlowUsage(delta) {
  const amount = Math.round(Number(delta) || 0);
  if (!amount) return;
  const key = dateKey(new Date());
  state.flow.history[key] = Math.max(0, flowUsedOnDate(key) + amount);
}

function flowUsedOnDate(key) {
  return clampNumber(state.flow.history?.[key] || 0, 0, 100000000);
}

function flowDayGradient(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped <= 0) return "linear-gradient(135deg, hsl(219 24% 18%), hsl(225 22% 12%))";
  const hueA = Math.round(202 - 34 * clamped);
  const hueB = Math.round(258 - 96 * clamped);
  const lightA = 24 + Math.round(18 * clamped);
  const lightB = 15 + Math.round(14 * clamped);
  return `linear-gradient(135deg, hsl(${hueA} 76% ${lightA}%), hsl(${hueB} 60% ${lightB}%))`;
}

function handleFlowResetDay(event) {
  const account = state.flow.accounts.find((item) => item.id === event.currentTarget.dataset.id);
  if (!account) return;
  account.resetDay = clampNumber(event.currentTarget.value, 1, 31);
  saveState();
  playTone("tap");
  renderFlow();
  renderSettings();
}

// ============================================================
// SETTINGS
// ============================================================

function renderSettings() {
  el.geminiCycleHours.value = (state.gemini.cycleMinutes / 60).toString();
  el.geminiWindowMinutes.value = state.gemini.windowMinutes;
  el.geminiVideoLimit.value = state.gemini.videosPerAccount;
  el.flowMonthlyCredits.value = state.flow.monthlyCredits;
  el.flowCreditsPerVideo.value = state.flow.creditsPerVideo || 15;
  el.flowReminderThreshold.value = state.flow.reminderThreshold;
  renderSettingsAccountList("gemini");
  renderSettingsAccountList("flow");
}

function renderSettingsAccountList(type) {
  const target = type === "gemini" ? el.geminiSettingsAccounts : el.flowSettingsAccounts;
  const accounts = type === "gemini" ? state.gemini.accounts : state.flow.accounts;

  target.innerHTML = accounts.map((account) => `
    <div class="settings-account ${type}">
      <input class="settings-name" value="${escapeAttribute(account.name)}" data-type="${type}" data-id="${account.id}" aria-label="${type} account name">
      ${type === "gemini"
        ? `<input class="settings-time" type="time" value="${account.time}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} reset time">
           <label class="autofill-wrap" title="Videos added when you tap the toggle ON">
             <span>ON fills</span>
             <input class="settings-autofill" type="number" min="0" max="999" value="${account.autofill ?? state.gemini.videosPerAccount}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} autofill count" inputmode="numeric">
           </label>
           <button class="remove-account" type="button" data-type="${type}" data-id="${account.id}" title="Remove ${escapeAttribute(account.name)}">x</button>
           <input class="settings-anchor-date" type="date" value="${account.anchorDate}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} anchor date">`
        : `<input class="settings-reset-day" type="number" min="1" max="31" value="${account.resetDay}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} reset day" inputmode="numeric">
           <button class="remove-account" type="button" data-type="${type}" data-id="${account.id}" title="Remove ${escapeAttribute(account.name)}">x</button>`}
    </div>
  `).join("");

  target.querySelectorAll(".settings-name").forEach((input) => {
    input.addEventListener("change", () => {
      const account = accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.name = cleanName(input.value) || account.name;
      saveState();
      playTone("tap");
      rebuild();
    });
  });
  target.querySelectorAll(".settings-time").forEach((input) => {
    input.addEventListener("change", () => {
      const account = state.gemini.accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.time = input.value || account.time;
      saveState();
      playTone("tap");
      rebuild();
    });
  });
  target.querySelectorAll(".settings-anchor-date").forEach((input) => {
    input.addEventListener("change", () => {
      const account = state.gemini.accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.anchorDate = isDateKey(input.value) ? input.value : account.anchorDate;
      saveState();
      playTone("tap");
      rebuild();
    });
  });
  target.querySelectorAll(".settings-autofill").forEach((input) => {
    input.addEventListener("change", () => {
      const account = state.gemini.accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.autofill = clampNumber(input.value, 0, 99);
      saveState();
      playTone("tap");
    });
  });
  target.querySelectorAll(".settings-reset-day").forEach((input) => {
    input.addEventListener("change", () => {
      const account = state.flow.accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.resetDay = clampNumber(input.value, 1, 31);
      saveState();
      playTone("tap");
      rebuild();
    });
  });
  target.querySelectorAll(".remove-account").forEach((button) => {
    button.addEventListener("click", () => {
      const collection = button.dataset.type === "gemini" ? state.gemini.accounts : state.flow.accounts;
      if (collection.length <= 1) return;
      const index = collection.findIndex((account) => account.id === button.dataset.id);
      if (index < 0) return;
      collection.splice(index, 1);
      saveState();
      playTone("warning");
      rebuild();
    });
  });
}

// ============================================================
// SCHEDULE BUILDER
// ============================================================

function buildDaySchedule(date) {
  const start = startOfDay(date);
  return buildScheduleBetween(start, addDays(start, 1));
}

function buildMonthSchedule(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return buildScheduleBetween(start, new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

// Four fixed 6-hour display windows per day.
// Each account appears once per overlapping cycle within the window.
function buildScheduleBetween(rangeStart, rangeEnd) {
  if (!state.gemini.accounts.length) return [];

  const SLOT_MS = 6 * 3600000;
  const cycleMs = state.gemini.cycleMinutes * 60000;
  const rows = [];

  let slotStart = alignToWindowSlot(rangeStart);

  while (slotStart.getTime() < rangeEnd.getTime()) {
    if (slotStart.getTime() >= rangeStart.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
      const orderEntries = [];

      state.gemini.accounts.forEach((account) => {
        const resetMs = runtimeAccount(account).reset.getTime();
        const slotStartMs = slotStart.getTime();
        const slotEndMs = slotEnd.getTime();
        const firstN = Math.ceil((slotStartMs - resetMs) / cycleMs);

        for (let n = firstN; ; n++) {
          const cycleStartMs = resetMs + n * cycleMs;
          if (cycleStartMs >= slotEndMs) break;
          const cycleStart = new Date(cycleStartMs);
          const entryKey = `${account.id}-${dateKey(cycleStart)}-${pad(cycleStart.getHours())}${pad(cycleStart.getMinutes())}`;
          orderEntries.push({
            id: account.id,
            name: account.name,
            time: account.time,
            anchorDate: account.anchorDate,
            cycleStart,
            entryKey,
          });
        }
      });

      orderEntries.sort((a, b) => a.cycleStart - b.cycleStart);

      rows.push({
        id: `${dateKey(slotStart)}-${pad(slotStart.getHours())}${pad(slotStart.getMinutes())}`,
        start: slotStart,
        end: slotEnd,
        window: `${formatTimeLabel(slotStart)} – ${formatTimeLabel(slotEnd)}`,
        order: orderEntries,
      });
    }
    slotStart = new Date(slotStart.getTime() + SLOT_MS);
  }

  return rows;
}

function alignToWindowSlot(date) {
  const slotHour = Math.floor(date.getHours() / 6) * 6;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), slotHour, 0, 0, 0);
}

function focusedWindowIndex() {
  const now = new Date();
  const currentIndex = daySchedule.findIndex((row) => row.start <= now && row.end >= now);
  if (currentIndex >= 0) return currentIndex;
  const nextIndex = daySchedule.findIndex((row) => row.end >= now);
  if (nextIndex >= 0) return nextIndex;
  return Math.max(0, daySchedule.length - 1);
}

// Locked = cycle hasn't started yet
function lockedAccountsForRow(row) {
  const now = new Date();
  if (row.end <= now) return [];
  return row.order
    .filter((entry) => entry.cycleStart > now)
    .map((entry) => entry.entryKey);
}

function accountCycleEntryKey(row, account) {
  if (account.entryKey) return account.entryKey;
  const cycle = accountCycleFor(account, accountCycleReferenceDate(row));
  return `${account.id}-${dateKey(cycle.start)}-${pad(cycle.start.getHours())}${pad(cycle.start.getMinutes())}`;
}

function accountCycleReferenceDate(row) {
  const now = new Date();
  if (row.start <= now && row.end >= now) return now;
  return row.start;
}

function accountCycleFor(account, date, cycleMinutesOverride) {
  const runtime = runtimeAccount(account);
  const cycleMinutes = cycleMinutesOverride || state.gemini.cycleMinutes;
  if (date < runtime.reset) {
    return { start: new Date(runtime.reset), end: addMinutes(runtime.reset, cycleMinutes) };
  }
  const cycles = Math.floor((date - runtime.reset) / (cycleMinutes * 60000));
  const start = addMinutes(runtime.reset, cycles * cycleMinutes);
  return { start, end: addMinutes(start, cycleMinutes) };
}

function rowById(id) {
  return daySchedule.find((row) => row.id === id) || monthSchedule.find((row) => row.id === id);
}

function rowTotals(row) {
  const lockedKeys = lockedAccountsForRow(row);
  const activeEntries = row.order.filter((entry) => !lockedKeys.includes(entry.entryKey));
  const max = row.order.length * state.gemini.videosPerAccount;
  const done = activeEntries.reduce((sum, entry) => sum + getAccountCount(row, entry), 0);
  const missed = row.end < new Date() ? Math.max(0, max - done) : 0;
  return { done, max, missed };
}

function totalsForSchedule(schedule) {
  return schedule.reduce((totals, row) => {
    const rowTotal = rowTotals(row);
    totals.achieved += rowTotal.done;
    totals.potential += rowTotal.max;
    totals.missedVideos += rowTotal.missed;
    return totals;
  }, { achieved: 0, potential: 0, missedVideos: 0 });
}

// No upper clamp — allows custom counts (e.g. 33) entered via prompt
function getAccountCount(row, account) {
  const key = accountCycleEntryKey(row, account);
  return Math.max(0, Math.round(Number(state.gemini.cycleEntries?.[key]?.count || 0)));
}

function setAccountCount(row, account, count) {
  const key = accountCycleEntryKey(row, account);
  const cycleStart = account.cycleStart instanceof Date
    ? account.cycleStart
    : accountCycleFor(account, accountCycleReferenceDate(row)).start;
  const cycleEnd = addMinutes(cycleStart, state.gemini.cycleMinutes);
  state.gemini.cycleEntries[key] = {
    accountId: account.id,
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    count: Math.max(0, Math.round(Number(count)) || 0),
    updatedAt: new Date().toISOString(),
  };
  saveState();
}

// ============================================================
// FLOW RESETS & REMINDERS
// ============================================================

function applyFlowResets() {
  const now = new Date();
  const currentMonth = monthKey(now);
  state.flow.accounts.forEach((account) => {
    const resetThisMonth = resetDateForMonth(now.getFullYear(), now.getMonth(), account.resetDay);
    if (now >= resetThisMonth && account.lastResetMonth !== currentMonth) {
      account.creditsLeft = state.flow.monthlyCredits;
      account.lastResetMonth = currentMonth;
    }
  });
}

function checkFlowReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = dateKey(new Date());
  state.flow.accounts.forEach((account) => {
    const daysLeft = daysUntil(nextMonthlyReset(account.resetDay));
    if (daysLeft !== 1 || account.creditsLeft <= state.flow.reminderThreshold) return;
    const reminderKey = `${today}-${account.id}`;
    if (account.lastReminderKey === reminderKey) return;
    new Notification("Flow credit reset tomorrow", {
      body: `${account.name} has ${account.creditsLeft} credits left. Use them before reset.`,
      tag: `flow-${account.id}-${today}`,
    });
    account.lastReminderKey = reminderKey;
    saveState();
  });
}

function requestNotifications() {
  if (!("Notification" in window)) {
    window.alert("This browser does not support notifications.");
    return;
  }
  Notification.requestPermission().then(() => {
    playTone(Notification.permission === "granted" ? "success" : "warning");
    checkFlowReminders();
  });
}

function nextMonthlyReset(resetDay) {
  const now = new Date();
  let reset = resetDateForMonth(now.getFullYear(), now.getMonth(), resetDay);
  if (reset < startOfDay(now)) reset = resetDateForMonth(now.getFullYear(), now.getMonth() + 1, resetDay);
  return reset;
}

function resetDateForMonth(year, month, resetDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(resetDay, lastDay), 0, 0, 0, 0);
}

function daysUntil(date) {
  return Math.max(0, Math.ceil((startOfDay(date) - startOfDay(new Date())) / 86400000));
}

// ============================================================
// DATE NAV
// ============================================================

function changeDay(offset) {
  const next = addDays(selectedDate(), offset);
  state.selectedDate = dateKey(next);
  el.datePicker.value = state.selectedDate;
  saveState();
  playTone("tap");
  rebuild({ scroll: true });
}

function scrollToCurrentWindow() {
  requestAnimationFrame(() => {
    const target =
      document.querySelector(".window-card.is-current") ||
      document.querySelector(".window-card[open]") ||
      document.querySelector("#geminiView");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// ============================================================
// DOWNLOAD / UPLOAD
// ============================================================

function downloadJson() {
  const payload = { app: "Gemini Flow Tracker", version: 2, exportedAt: new Date().toISOString(), state };
  downloadFile(`gemini-flow-backup-${dateKey(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      state = normalizeState(payload.state || payload);
      saveState();
      playTone("success");
      rebuild({ scroll: true });
    } catch {
      window.alert("That backup file could not be read.");
      playTone("warning");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// STATE — defaults, normalise, persist
// ============================================================

function loadState() {
  const saved = loadJson(STORAGE_KEY, null);
  if (saved) return saved;
  const oldSettings = loadJson(OLD_SETTINGS_KEY, null);
  const oldEntries = loadJson(OLD_ENTRIES_KEY, {});
  const fresh = defaultState();
  if (oldSettings?.accounts?.length) {
    fresh.gemini.accounts = oldSettings.accounts.map((account) => ({
      id: account.id || uniqueAccountId(account.name, fresh.gemini.accounts),
      name: cleanName(account.name),
      time: account.time || "12:00",
      anchorDate: dateKey(new Date()),
      autofill: fresh.gemini.videosPerAccount,
    }));
    if (!fresh.gemini.accounts.some((account) => account.id === "anoy")) {
      fresh.gemini.accounts.push({ id: "anoy", name: "ANOY", time: "14:18", anchorDate: dateKey(new Date()), autofill: 4 });
    }
  }
  Object.entries(oldEntries || {}).forEach(([rowId, entry]) => {
    if (!entry || !Number(entry.count)) return;
    fresh.gemini.entries[rowId] = { accounts: {}, updatedAt: entry.updatedAt || "" };
    const first = fresh.gemini.accounts[0];
    if (first) fresh.gemini.entries[rowId].accounts[first.id] = Math.max(0, Math.round(Number(entry.count) || 0));
  });
  return fresh;
}

function defaultState() {
  return {
    activeMode: "gemini",
    selectedDate: dateKey(new Date()),
    sound: true,
    gemini: defaultGeminiSettings(),
    flow: defaultFlowSettings(),
  };
}

function defaultGeminiSettings() {
  return {
    cycleMinutes: 300,
    windowMinutes: 60,
    videosPerAccount: 4,
    accounts: DEFAULT_NAMES.map((name, index) => ({
      id: name.toLowerCase(),
      name,
      time: DEFAULT_TIMES[index],
      anchorDate: dateKey(new Date()),
      autofill: 4,
    })),
    entries: {},
    cycleEntries: {},
  };
}

function defaultFlowSettings() {
  return {
    monthlyCredits: 1000,
    creditsPerVideo: 15,
    reminderThreshold: 20,
    history: {},
    accounts: DEFAULT_NAMES.map((name, index) => ({
      id: name.toLowerCase(),
      name,
      creditsLeft: 1000,
      resetDay: DEFAULT_FLOW_RESET_DAYS[index],
      lastResetMonth: "",
      lastReminderKey: "",
    })),
  };
}

function normalizeState(source) {
  const base = defaultState();
  const next = {
    ...base,
    ...source,
    gemini: { ...base.gemini, ...(source?.gemini || {}) },
    flow: { ...base.flow, ...(source?.flow || {}) },
  };
  next.selectedDate = next.selectedDate || dateKey(new Date());
  next.activeMode = next.activeMode === "flow" ? "flow" : "gemini";
  next.gemini.cycleMinutes = clampNumber(next.gemini.cycleMinutes, 60, 1440);
  next.gemini.windowMinutes = clampNumber(next.gemini.windowMinutes, 10, 240);
  next.gemini.videosPerAccount = clampNumber(next.gemini.videosPerAccount, 0, 20);
  next.gemini.accounts = normalizeGeminiAccounts(next.gemini.accounts);
  next.gemini.entries = next.gemini.entries || {};
  next.gemini.cycleEntries = normalizeGeminiCycleEntries(next.gemini.cycleEntries);
  migrateWindowEntriesToCycles(next.gemini);
  next.flow.monthlyCredits = clampNumber(next.flow.monthlyCredits, 1, 100000);
  next.flow.creditsPerVideo = clampNumber(next.flow.creditsPerVideo || 15, 1, 10000);
  next.flow.reminderThreshold = clampNumber(next.flow.reminderThreshold, 0, 100000);
  next.flow.history = normalizeFlowHistory(next.flow.history);
  next.flow.accounts = normalizeFlowAccounts(next.flow.accounts, next.flow.monthlyCredits);
  return next;
}

function normalizeGeminiAccounts(accounts) {
  const source = Array.isArray(accounts) && accounts.length ? accounts : defaultGeminiSettings().accounts;
  return source
    .filter((account) => account && account.name)
    .map((account) => ({
      id: account.id || uniqueAccountId(account.name, source),
      name: cleanName(account.name),
      time: /^\d{2}:\d{2}$/.test(account.time || "") ? account.time : "12:00",
      anchorDate: isDateKey(account.anchorDate) ? account.anchorDate : dateKey(new Date()),
      autofill: clampNumber(account.autofill ?? 4, 0, 99),
    }));
}

function normalizeGeminiCycleEntries(entries) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return {};
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => entry && entry.accountId)
      .map(([key, entry]) => [key, {
        accountId: entry.accountId,
        cycleStart: entry.cycleStart || "",
        cycleEnd: entry.cycleEnd || "",
        count: Math.max(0, Math.round(Number(entry.count) || 0)),
        updatedAt: entry.updatedAt || "",
      }])
  );
}

function migrateWindowEntriesToCycles(gemini) {
  if (!gemini.entries || gemini.migratedCycleEntries) return;
  Object.entries(gemini.entries).forEach(([rowId, entry]) => {
    const rowStart = dateFromRowId(rowId);
    if (!rowStart || !entry?.accounts) return;
    Object.entries(entry.accounts).forEach(([accountId, count]) => {
      const account = gemini.accounts.find((item) => item.id === accountId);
      if (!account || !Number(count)) return;
      const cycle = accountCycleFor(account, rowStart, gemini.cycleMinutes);
      const key = `${account.id}-${dateKey(cycle.start)}-${pad(cycle.start.getHours())}${pad(cycle.start.getMinutes())}`;
      if (gemini.cycleEntries[key]) return;
      gemini.cycleEntries[key] = {
        accountId: account.id,
        cycleStart: cycle.start.toISOString(),
        cycleEnd: cycle.end.toISOString(),
        count: Math.max(0, Math.round(Number(count) || 0)),
        updatedAt: entry.updatedAt || "",
      };
    });
  });
  gemini.migratedCycleEntries = true;
}

function dateFromRowId(rowId) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/.exec(String(rowId));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function normalizeFlowAccounts(accounts, max) {
  const source = Array.isArray(accounts) && accounts.length ? accounts : defaultFlowSettings().accounts;
  return source
    .filter((account) => account && account.name)
    .map((account) => ({
      id: account.id || uniqueAccountId(account.name, source),
      name: cleanName(account.name),
      creditsLeft: clampNumber(account.creditsLeft ?? max, 0, max),
      resetDay: clampNumber(account.resetDay || 1, 1, 31),
      lastResetMonth: account.lastResetMonth || "",
      lastReminderKey: account.lastReminderKey || "",
    }));
}

function normalizeFlowHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) return {};
  return Object.fromEntries(
    Object.entries(history)
      .filter(([key]) => isDateKey(key))
      .map(([key, value]) => [key, clampNumber(value, 0, 100000000)])
  );
}

// ============================================================
// ACCOUNT RUNTIME
// ============================================================

function runtimeAccount(account) {
  return { ...account, reset: referenceDateFromAccount(account) };
}

// Anchor date + time = fixed reference point; all future cycles project from here
function referenceDateFromAccount(account) {
  const [hour, minute] = account.time.split(":").map(Number);
  const anchor = parseDateKey(account.anchorDate || dateKey(new Date()));
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), hour, minute, 0, 0);
}

function nextResetAfter(account, date) {
  if (date < account.reset) return new Date(account.reset);
  const elapsed = date - account.reset;
  const cycleMs = state.gemini.cycleMinutes * 60000;
  const cycles = Math.floor(elapsed / cycleMs) + 1;
  return addMinutes(account.reset, cycles * state.gemini.cycleMinutes);
}

// ============================================================
// GRADIENT HELPERS
// ============================================================

function dayGradient(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped <= 0) return "linear-gradient(135deg, hsl(356 52% 32%), hsl(348 42% 18%))";
  if (clamped < 0.5) {
    const hue = Math.round(8 + 64 * (clamped / 0.5));
    return `linear-gradient(135deg, hsl(${hue} 70% 35%), hsl(${hue - 8} 56% 19%))`;
  }
  const progress = (clamped - 0.5) / 0.5;
  const hue = Math.round(72 + 78 * progress);
  const lightA = 34 + Math.round(8 * progress);
  const lightB = 20 + Math.round(7 * progress);
  return `linear-gradient(135deg, hsl(${hue} 62% ${lightA}%), hsl(${hue + 10} 48% ${lightB}%))`;
}

function windowStateLabel(row) {
  const now = new Date();
  if (row.start <= now && row.end >= now) return "Live now";
  if (row.start > now) return "Upcoming";
  return "Past";
}

// ============================================================
// DATE HELPERS
// ============================================================

function selectedDate() {
  return parseDateKey(state.selectedDate);
}

function daysInSelectedMonth() {
  const date = selectedDate();
  const days = [];
  const cursor = new Date(date.getFullYear(), date.getMonth(), 1);
  while (cursor.getMonth() === date.getMonth()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function minutesBetween(start, end) {
  return Math.round((end - start) / 60000);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function parseDateKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = parseDateKey(value);
  return dateKey(parsed) === value;
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function cleanName(value) {
  return String(value || "").trim().toUpperCase().slice(0, 12);
}

function uniqueAccountId(name, accounts) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";
  let id = base;
  let index = 2;
  while (accounts?.some((account) => account.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

// ============================================================
// UI HELPERS
// ============================================================

function updateSoundButton() {
  el.soundButton.classList.toggle("active", Boolean(state.sound));
}

function playTone(type) {
  if (!state.sound) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequencies = { tap: 420, success: 620, warning: 180 };
    oscillator.frequency.value = frequencies[type] || 420;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.09);
  } catch {
    // Sound is optional.
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
