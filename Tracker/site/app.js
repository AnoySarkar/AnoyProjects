const STORAGE_KEY = "gemini-flow-tracker-data-v1";
const OLD_ENTRIES_KEY = "window-command-entries-v4";
const OLD_SETTINGS_KEY = "window-command-settings-v4";
const REFERENCE_YEAR = 2026;
const REFERENCE_MONTH = 6;
const REFERENCE_DAY = 12;
const DEFAULT_NAMES = ["TRI", "MOU", "LION", "AVI", "MIND", "ANOY"];
const DEFAULT_TIMES = ["12:38", "13:09", "14:29", "15:33", "17:35", "18:35"];

let state = loadState();
let windowPlan = null;
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
  selectedDayMissed: document.querySelector("#selectedDayMissed"),
  selectedDayCompletion: document.querySelector("#selectedDayCompletion"),
  monthTitle: document.querySelector("#monthTitle"),
  monthAchieved: document.querySelector("#monthAchieved"),
  monthMissedVideos: document.querySelector("#monthMissedVideos"),
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

function init() {
  state = normalizeState(state);
  applyFlowResets();
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
      state.flow.accounts.forEach((account) => account.creditsLeft = clampNumber(account.creditsLeft, 0, next));
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
    state.gemini.accounts.push({ id: uniqueAccountId(name, state.gemini.accounts), name, time, anchorDate: state.selectedDate || dateKey(new Date()) });
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
    });
    el.newFlowAccountName.value = "";
    el.newFlowResetDay.value = "";
    saveState();
    playTone("success");
    rebuild();
  });
}

function rebuild(options = {}) {
  state = normalizeState(state);
  applyFlowResets();
  windowPlan = calculateWindowPlan();
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
  saveState();
  playTone("tap");
  renderMode();
  if (mode === "gemini") scrollToCurrentWindow();
}

function renderMode() {
  const gemini = state.activeMode !== "flow";
  el.geminiTab.classList.toggle("active", gemini);
  el.flowTab.classList.toggle("active", !gemini);
  el.geminiView.classList.toggle("active", gemini);
  el.flowView.classList.toggle("active", !gemini);
}

function renderGemini() {
  renderTitles();
  renderCalendar();
  renderSchedule();
  renderGeminiStats();
}

function renderSchedule() {
  el.windowList.innerHTML = "";
  if (!daySchedule.length) {
    el.windowList.innerHTML = `<div class="empty-state">No valid Gemini window. Adjust reset times or window length in Settings.</div>`;
    return;
  }

  const focusIndex = focusedWindowIndex();
  daySchedule.forEach((row, index) => {
    const totals = rowTotals(row);
    const stateLabel = windowStateLabel(row);
    const carryAccounts = carryOverAccounts(row);
    const lockedAccounts = lockedAccountsForRow(row);
    const open = index === focusIndex || (Math.abs(index - focusIndex) === 1 && carryAccounts.length > 0);
    const details = document.createElement("details");
    details.className = "window-card";
    details.dataset.rowId = row.id;
    details.open = open;
    details.classList.toggle("is-current", row.start <= new Date() && row.end >= new Date());
    details.classList.toggle("is-past", row.end < new Date());

    details.innerHTML = `
      <summary class="window-summary">
        <div>
          <span class="window-kicker">${stateLabel}</span>
          <strong>${row.window}</strong>
        </div>
        <div class="summary-score">
          <b>${totals.done}/${totals.max}</b>
          <span>${totals.missed ? `${totals.missed} missed` : "on track"}</span>
        </div>
      </summary>
      <div class="window-tools">
        <button class="fill-window-button ${totals.done >= totals.max ? "active" : ""}" type="button" data-row="${row.id}" aria-label="${totals.done >= totals.max ? "Clear window" : "Fill window"}" title="${totals.done >= totals.max ? "Clear window" : "Fill window"}">
          <span></span>
        </button>
      </div>
      <div class="account-sliders">
        ${row.order.map((account) => accountSliderHtml(row, account, carryAccounts.includes(account.id), lockedAccounts.includes(account.id))).join("")}
      </div>
    `;
    el.windowList.appendChild(details);
  });

  el.windowList.querySelectorAll(".gemini-range").forEach((input) => {
    input.addEventListener("input", handleGeminiSlider);
    input.addEventListener("change", handleGeminiSlider);
  });
  el.windowList.querySelectorAll(".fill-window-button").forEach((button) => {
    button.addEventListener("click", handleFillWindow);
  });
}

function accountSliderHtml(row, account, isCarryOver = false, isLocked = false) {
  const value = getAccountCount(row, account);
  const reset = nextResetAfter(runtimeAccount(account), row.start);
  const minutesLeft = Math.max(0, Math.round((reset - new Date()) / 60000));
  const resetText = isLocked ? `wait ${minutesLeft} min` : row.end < new Date() ? formatTimeLabel(reset) : `${minutesLeft} min (${formatTimeLabel(reset)})`;
  const max = state.gemini.videosPerAccount;
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `
    <label class="account-row ${isCarryOver ? "carry-over" : ""} ${isLocked ? "is-locked" : ""}" style="--fill:${pct}%">
      <span class="account-meta">
        <b>${escapeHtml(account.name)}</b>
        <small>${resetText}</small>
      </span>
      <input class="gemini-range" type="range" min="0" max="${max}" step="1" value="${value}" data-row="${row.id}" data-account="${account.id}" ${isLocked ? "disabled" : ""} aria-label="${escapeAttribute(account.name)} videos in ${row.window}">
      <output>${value}/${max}</output>
    </label>
  `;
}

function handleGeminiSlider(event) {
  const input = event.currentTarget;
  const row = rowById(input.dataset.row);
  const account = state.gemini.accounts.find((item) => item.id === input.dataset.account);
  if (!row || !account || input.disabled) return;
  const count = clampNumber(input.value, 0, state.gemini.videosPerAccount);
  if (event.type === "change") input.value = count;
  setAccountCount(row, account, count);
  input.closest(".account-row")?.style.setProperty("--fill", `${state.gemini.videosPerAccount ? (Number(input.value) / state.gemini.videosPerAccount) * 100 : 0}%`);
  input.nextElementSibling.textContent = `${count}/${state.gemini.videosPerAccount}`;
  playTone("tap");
  refreshWindowSummary(row.id);
  if (event.type === "change") {
    renderCalendar();
    renderGeminiStats();
  }
}

function handleFillWindow(event) {
  const row = rowById(event.currentTarget.dataset.row);
  if (!row) return;
  const totals = rowTotals(row);
  const nextValue = totals.done >= totals.max ? 0 : state.gemini.videosPerAccount;
  const lockedAccounts = lockedAccountsForRow(row);
  row.order
    .filter((account) => !lockedAccounts.includes(account.id))
    .forEach((account) => setAccountCount(row, account, nextValue));
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
  score.innerHTML = `<b>${totals.done}/${totals.max}</b><span>${totals.missed ? `${totals.missed} missed` : "on track"}</span>`;
}

function renderCalendar() {
  el.calendarGrid.innerHTML = "";
  daysInSelectedMonth().forEach((date) => {
    const schedule = buildDaySchedule(date);
    const totals = totalsForSchedule(schedule);
    const ratio = totals.potential ? totals.achieved / totals.potential : 0;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.style.setProperty("--day-bg", dayGradient(ratio));
    button.classList.toggle("selected", dateKey(date) === state.selectedDate);
    button.classList.toggle("today", dateKey(date) === dateKey(new Date()));
    button.innerHTML = `<span>${date.getDate()}</span><strong>${totals.achieved}</strong>`;
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
  const dayTotals = totalsForSchedule(daySchedule);
  const monthTotals = totalsForSchedule(monthSchedule);
  const completion = dayTotals.potential ? Math.round((dayTotals.achieved / dayTotals.potential) * 100) : 0;
  el.selectedDayVideos.textContent = dayTotals.achieved.toLocaleString("en-US");
  el.selectedDayMissed.textContent = dayTotals.missedVideos.toLocaleString("en-US");
  el.selectedDayCompletion.textContent = `${completion}%`;
  el.monthAchieved.textContent = monthTotals.achieved.toLocaleString("en-US");
  el.monthMissedVideos.textContent = `${monthTotals.missedVideos.toLocaleString("en-US")} missed`;
}

function renderTitles() {
  const selected = selectedDate();
  el.scheduleTitle.textContent = selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
  el.monthTitle.textContent = selected.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function renderFlow() {
  el.flowList.innerHTML = "";
  renderFlowCalendar();
  const max = state.flow.monthlyCredits;
  const alerts = [];
  let totalLeft = 0;
  let soon = 0;

  state.flow.accounts.forEach((account) => {
    const reset = nextMonthlyReset(account.resetDay);
    const daysLeft = daysUntil(reset);
    const used = Math.max(0, max - account.creditsLeft);
    totalLeft += account.creditsLeft;
    if (daysLeft <= 1 && account.creditsLeft > state.flow.reminderThreshold) {
      soon += 1;
      alerts.push(`${account.name}: ${account.creditsLeft} credits left, resets ${daysLeft === 0 ? "today" : "tomorrow"}.`);
    }
    const pct = max ? Math.round((account.creditsLeft / max) * 100) : 0;
    const card = document.createElement("article");
    card.className = "flow-card";
    card.style.setProperty("--fill", `${pct}%`);
    card.innerHTML = `
      <div class="flow-top">
        <div>
          <span class="window-kicker">${daysLeft} days left</span>
          <h3>${escapeHtml(account.name)}</h3>
        </div>
        <strong class="flow-left-value">${account.creditsLeft.toLocaleString("en-US")}</strong>
      </div>
      <label class="credit-slider">
        <span>Credit left</span>
        <input class="flow-range" type="range" min="0" max="${max}" step="1" value="${account.creditsLeft}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} credits left">
      </label>
      <div class="flow-bottom">
        <span class="flow-used-value">Used ${used.toLocaleString("en-US")}</span>
        <label>Reset day <input class="reset-day-input" type="number" min="1" max="31" value="${account.resetDay}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} monthly reset day"></label>
        <button class="small-button refill-button" type="button" data-id="${account.id}">Full</button>
      </div>
    `;
    el.flowList.appendChild(card);
  });

  el.flowTotalLeft.textContent = totalLeft.toLocaleString("en-US");
  el.flowUsed.textContent = Math.max(0, state.flow.accounts.length * max - totalLeft).toLocaleString("en-US");
  el.flowResetSoon.textContent = soon.toLocaleString("en-US");
  el.flowAlerts.innerHTML = alerts.length ? alerts.map((text) => `<p>${escapeHtml(text)}</p>`).join("") : `<p>No urgent Flow reset reminders.</p>`;

  el.flowList.querySelectorAll(".flow-range").forEach((input) => {
    input.addEventListener("input", handleFlowSlider);
    input.addEventListener("change", handleFlowSlider);
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

function handleFlowSlider(event) {
  const input = event.currentTarget;
  const account = state.flow.accounts.find((item) => item.id === input.dataset.id);
  if (!account) return;
  const previousLeft = account.creditsLeft;
  account.creditsLeft = clampNumber(input.value, 0, state.flow.monthlyCredits);
  recordFlowUsage(previousLeft - account.creditsLeft);
  if (event.type === "change") input.value = account.creditsLeft;
  const card = input.closest(".flow-card");
  card?.style.setProperty("--fill", `${state.flow.monthlyCredits ? (Number(input.value) / state.flow.monthlyCredits) * 100 : 0}%`);
  const leftValue = card?.querySelector(".flow-left-value");
  const usedValue = card?.querySelector(".flow-used-value");
  if (leftValue) leftValue.textContent = account.creditsLeft.toLocaleString("en-US");
  if (usedValue) usedValue.textContent = `Used ${Math.max(0, state.flow.monthlyCredits - account.creditsLeft).toLocaleString("en-US")}`;
  saveState();
  if (event.type === "change") renderFlow();
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

function renderSettings() {
  el.geminiCycleHours.value = (state.gemini.cycleMinutes / 60).toString();
  el.geminiWindowMinutes.value = state.gemini.windowMinutes;
  el.geminiVideoLimit.value = state.gemini.videosPerAccount;
  el.flowMonthlyCredits.value = state.flow.monthlyCredits;
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
        ? `<input class="settings-time" type="time" value="${account.time}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} start reset time">
          <input class="settings-anchor-date" type="date" value="${account.anchorDate}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} start reset date">`
        : `<input class="settings-reset-day" type="number" min="1" max="31" value="${account.resetDay}" data-type="${type}" data-id="${account.id}" aria-label="${escapeAttribute(account.name)} reset day">`}
      <button class="remove-account" type="button" data-type="${type}" data-id="${account.id}" title="Remove ${escapeAttribute(account.name)}">x</button>
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

function buildDaySchedule(date) {
  const start = startOfDay(date);
  return buildScheduleBetween(start, addDays(start, 1));
}

function buildMonthSchedule(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return buildScheduleBetween(start, new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

function buildScheduleBetween(rangeStart, rangeEnd) {
  if (!windowPlan || windowPlan.overlapMinutes < state.gemini.windowMinutes || !state.gemini.accounts.length) return [];
  const rows = [];
  let start = new Date(windowPlan.firstWindowStart);
  while (start < rangeStart) start = addMinutes(start, state.gemini.cycleMinutes);
  while (addMinutes(start, -state.gemini.cycleMinutes) >= rangeStart) start = addMinutes(start, -state.gemini.cycleMinutes);
  while (start < rangeEnd) {
    const end = addMinutes(start, state.gemini.windowMinutes);
    rows.push({
      id: `${dateKey(start)}-${pad(start.getHours())}${pad(start.getMinutes())}`,
      start: new Date(start),
      end,
      window: `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      order: orderForWindow(start),
    });
    start = addMinutes(start, state.gemini.cycleMinutes);
  }
  return rows;
}

function calculateWindowPlan() {
  const accounts = state.gemini.accounts.map(runtimeAccount);
  if (accounts.length === 1) return { firstWindowStart: accounts[0].reset, overlapMinutes: state.gemini.cycleMinutes };
  const phases = accounts
    .map((account) => ({ ...account, phase: positiveModulo(minutesBetween(referenceMonthStart(), account.reset), state.gemini.cycleMinutes) }))
    .sort((a, b) => a.phase - b.phase);
  let bestGap = -1;
  let gapStart = phases[0];
  phases.forEach((account, index) => {
    const next = phases[(index + 1) % phases.length];
    const gap = positiveModulo(next.phase - account.phase, state.gemini.cycleMinutes);
    if (gap > bestGap) {
      bestGap = gap;
      gapStart = account;
    }
  });
  const centerSlack = Math.max(0, Math.floor((bestGap - state.gemini.windowMinutes) / 2));
  return { firstWindowStart: addMinutes(gapStart.reset, centerSlack), overlapMinutes: bestGap };
}

function orderForWindow(windowStart) {
  return [...state.gemini.accounts]
    .sort((a, b) => nextResetAfter(runtimeAccount(a), windowStart) - nextResetAfter(runtimeAccount(b), windowStart))
    .map((account) => ({ id: account.id, name: account.name, time: account.time, anchorDate: account.anchorDate }));
}

function focusedWindowIndex() {
  const now = new Date();
  const currentIndex = daySchedule.findIndex((row) => row.start <= now && row.end >= now);
  if (currentIndex >= 0) return currentIndex;
  const nextIndex = daySchedule.findIndex((row) => row.end >= now);
  if (nextIndex >= 0) return nextIndex;
  return Math.max(0, daySchedule.length - 1);
}

function carryOverAccounts(row) {
  const now = new Date();
  if (row.start <= now && row.end >= now) return [];
  return row.order
    .filter((account) => {
      const reset = nextResetAfter(runtimeAccount(account), row.start);
      return row.start < now && reset > now;
    })
    .map((account) => account.id);
}

function lockedAccountsForRow(row) {
  const now = new Date();
  if (row.end <= now) return [];
  return row.order
    .filter((account) => {
      const previousOpenRow = [...daySchedule]
        .reverse()
        .find((candidate) => candidate.start < row.start && candidate.start < now && nextResetAfter(runtimeAccount(account), candidate.start) > now);
      return Boolean(previousOpenRow);
    })
    .map((account) => account.id);
}

function accountCycleEntryKey(row, account) {
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
  const lockedAccounts = lockedAccountsForRow(row);
  const activeAccounts = row.order.filter((account) => !lockedAccounts.includes(account.id));
  const max = activeAccounts.length * state.gemini.videosPerAccount;
  const done = activeAccounts.reduce((sum, account) => sum + getAccountCount(row, account), 0);
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

function getAccountCount(row, account) {
  const key = accountCycleEntryKey(row, account);
  return clampNumber(state.gemini.cycleEntries?.[key]?.count || 0, 0, state.gemini.videosPerAccount);
}

function setAccountCount(row, account, count) {
  const cycle = accountCycleFor(account, accountCycleReferenceDate(row));
  const key = accountCycleEntryKey(row, account);
  state.gemini.cycleEntries[key] = {
    accountId: account.id,
    cycleStart: cycle.start.toISOString(),
    cycleEnd: cycle.end.toISOString(),
    count: clampNumber(count, 0, state.gemini.videosPerAccount),
    updatedAt: new Date().toISOString(),
  };
  saveState();
}

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
    const target = document.querySelector(".window-card.is-current") || document.querySelector(".window-card[open]") || document.querySelector("#geminiView");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function downloadJson() {
  const payload = { app: "Gemini Flow Tracker", version: 1, exportedAt: new Date().toISOString(), state };
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
    }));
    if (!fresh.gemini.accounts.some((account) => account.id === "anoy")) {
      fresh.gemini.accounts.push({ id: "anoy", name: "ANOY", time: "18:35", anchorDate: dateKey(new Date()) });
    }
  }
  Object.entries(oldEntries || {}).forEach(([rowId, entry]) => {
    if (!entry || !Number(entry.count)) return;
    fresh.gemini.entries[rowId] = { accounts: {}, updatedAt: entry.updatedAt || "" };
    const first = fresh.gemini.accounts[0];
    if (first) fresh.gemini.entries[rowId].accounts[first.id] = clampNumber(entry.count, 0, fresh.gemini.videosPerAccount);
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
    accounts: DEFAULT_NAMES.map((name, index) => ({ id: name.toLowerCase(), name, time: DEFAULT_TIMES[index], anchorDate: dateKey(new Date()) })),
    entries: {},
    cycleEntries: {},
  };
}

function defaultFlowSettings() {
  return {
    monthlyCredits: 1000,
    reminderThreshold: 20,
    history: {},
    accounts: DEFAULT_NAMES.map((name, index) => ({
      id: name.toLowerCase(),
      name,
      creditsLeft: 1000,
      resetDay: Math.min(28, index + 1),
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
  next.gemini.cycleEntries = normalizeGeminiCycleEntries(next.gemini.cycleEntries, next.gemini.videosPerAccount);
  migrateWindowEntriesToCycles(next.gemini);
  next.flow.monthlyCredits = clampNumber(next.flow.monthlyCredits, 1, 100000);
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
    }));
}

function normalizeGeminiCycleEntries(entries, max) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return {};
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => entry && entry.accountId)
      .map(([key, entry]) => [key, {
        accountId: entry.accountId,
        cycleStart: entry.cycleStart || "",
        cycleEnd: entry.cycleEnd || "",
        count: clampNumber(entry.count, 0, max),
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
        count: clampNumber(count, 0, gemini.videosPerAccount),
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

function runtimeAccount(account) {
  return { ...account, reset: referenceDateFromAccount(account) };
}

function referenceDateFromAccount(account) {
  const [hour, minute] = account.time.split(":").map(Number);
  const anchor = parseDateKey(account.anchorDate || dateKey(new Date()));
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), hour, minute, 0, 0);
}

function referenceMonthStart() {
  return new Date(REFERENCE_YEAR, REFERENCE_MONTH, 1, 0, 0, 0, 0);
}

function nextResetAfter(account, date) {
  if (date < account.reset) return new Date(account.reset);
  const elapsed = date - account.reset;
  const cycleMs = state.gemini.cycleMinutes * 60000;
  const cycles = Math.floor(elapsed / cycleMs) + 1;
  return addMinutes(account.reset, cycles * state.gemini.cycleMinutes);
}

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
