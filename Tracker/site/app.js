const STORAGE_KEY = "window-command-entries-v4";
const SETTINGS_KEY = "window-command-settings-v4";
const REFERENCE_YEAR = 2026;
const REFERENCE_MONTH = 6;
const REFERENCE_DAY = 12;
const CYCLE_MINUTES = 300;
const WINDOW_MINUTES = 60;
const VIDEOS_PER_ACCOUNT = 4;
const DEFAULT_ACCOUNTS = [
  { id: "tri", name: "TRI", time: "12:38" },
  { id: "mou", name: "MOU", time: "13:09" },
  { id: "lion", name: "LION", time: "14:29" },
  { id: "avi", name: "AVI", time: "15:33" },
  { id: "mind", name: "MIND", time: "17:35" },
];

const entries = loadJson(STORAGE_KEY, {});
let settings = loadJson(SETTINGS_KEY, {
  selectedDate: dateKey(new Date()),
  sound: true,
  accounts: DEFAULT_ACCOUNTS,
});
let windowPlan = null;
let daySchedule = [];
let monthSchedule = [];
let audioContext = null;

const el = {
  soundButton: document.querySelector("#soundButton"),
  downloadButton: document.querySelector("#downloadButton"),
  uploadButton: document.querySelector("#uploadButton"),
  uploadInput: document.querySelector("#uploadInput"),
  datePicker: document.querySelector("#datePicker"),
  prevDayButton: document.querySelector("#prevDayButton"),
  nextDayButton: document.querySelector("#nextDayButton"),
  todayButton: document.querySelector("#todayButton"),
  selectedDayVideos: document.querySelector("#selectedDayVideos"),
  selectedDayMissed: document.querySelector("#selectedDayMissed"),
  selectedDayCompletion: document.querySelector("#selectedDayCompletion"),
  resetGrid: document.querySelector("#resetGrid"),
  resetDefaultsButton: document.querySelector("#resetDefaultsButton"),
  addAccountForm: document.querySelector("#addAccountForm"),
  newAccountName: document.querySelector("#newAccountName"),
  newAccountTime: document.querySelector("#newAccountTime"),
  scheduleTitle: document.querySelector("#scheduleTitle"),
  monthTitle: document.querySelector("#monthTitle"),
  monthAchieved: document.querySelector("#monthAchieved"),
  calendarGrid: document.querySelector("#calendarGrid"),
  windowList: document.querySelector("#windowList"),
  analyticsTitle: document.querySelector("#analyticsTitle"),
  monthMissedVideos: document.querySelector("#monthMissedVideos"),
  completionRate: document.querySelector("#completionRate"),
  streakText: document.querySelector("#streakText"),
  bestDayText: document.querySelector("#bestDayText"),
  dailyChart: document.querySelector("#dailyChart"),
  coachText: document.querySelector("#coachText"),
};

init();

function init() {
  settings.accounts = normalizeAccounts(settings.accounts);
  settings.selectedDate = dateKey(new Date());
  el.datePicker.value = settings.selectedDate;
  updateSoundButton();
  bindEvents();
  registerServiceWorker();
  rebuild({ scroll: true });
  setInterval(() => rebuild({ quiet: true }), 30000);
}

function bindEvents() {
  el.soundButton.addEventListener("click", () => {
    settings.sound = !settings.sound;
    saveSettings();
    updateSoundButton();
    playTone("tap");
  });

  el.downloadButton.addEventListener("click", () => {
    downloadJson();
    playTone("success");
  });

  el.uploadButton.addEventListener("click", () => el.uploadInput.click());
  el.uploadInput.addEventListener("change", handleUpload);

  el.datePicker.addEventListener("change", () => {
    settings.selectedDate = el.datePicker.value || dateKey(new Date());
    saveSettings();
    playTone("tap");
    rebuild({ scroll: true });
  });

  el.prevDayButton.addEventListener("click", () => changeDay(-1));
  el.nextDayButton.addEventListener("click", () => changeDay(1));

  el.todayButton.addEventListener("click", () => {
    settings.selectedDate = dateKey(new Date());
    el.datePicker.value = settings.selectedDate;
    saveSettings();
    playTone("tap");
    rebuild({ scroll: true });
  });

  el.resetDefaultsButton.addEventListener("click", () => {
    settings.accounts = DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
    saveSettings();
    playTone("success");
    rebuild();
  });

  el.addAccountForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = el.newAccountName.value.trim().toUpperCase();
    const time = el.newAccountTime.value;
    if (!name || !time) return;
    settings.accounts.push({ id: uniqueAccountId(name), name, time });
    el.newAccountName.value = "";
    el.newAccountTime.value = "";
    saveSettings();
    playTone("success");
    rebuild();
  });
}

function rebuild(options = {}) {
  settings.accounts = normalizeAccounts(settings.accounts);
  if (settings.accounts.length === 0) settings.accounts = DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
  windowPlan = calculateWindowPlan();
  daySchedule = buildDaySchedule(selectedDate());
  monthSchedule = buildMonthSchedule(selectedDate());
  renderSchedule();
  renderCalendar();
  renderAccounts();
  renderAnalytics();
  updateTitles();
  if (options.scroll) scrollToCurrentWindow();
  if (!options.quiet) saveSettings();
}

function renderSchedule() {
  el.windowList.innerHTML = "";
  if (!daySchedule.length) {
    el.windowList.innerHTML = `<div class="empty-state">No valid 1-hour shared window for this day. Adjust reset times or accounts.</div>`;
    return;
  }

  const focusId = currentWindow()?.id || nextWindow()?.id || "";
  daySchedule.forEach((row) => {
    const state = getRowState(row);
    const card = document.createElement("article");
    card.className = "window-card";
    card.dataset.rowId = row.id;
    if (row.id === focusId) card.classList.add("is-current");
    if (row.end < new Date()) card.classList.add("is-past");
    if (state.status === "MISSED" && !state.manual) card.classList.add("is-auto-missed");

    card.innerHTML = `
      <div class="window-main">
        <div class="window-title">
          <span class="window-kicker">${windowStateLabel(row, state)}</span>
          <h3>${row.window}</h3>
        </div>
        <label class="count-box">
          <span>Videos</span>
          <input class="count-input" type="number" min="0" max="${maxPerWindow()}" step="1" value="${state.count}" data-id="${row.id}" aria-label="Videos completed for ${row.window}">
        </label>
      </div>
      <div class="order-chips" aria-label="${row.order.join(" then ")}">
        ${row.order.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join("")}
      </div>
      <div class="window-resets" aria-label="Next reset time for each account">
        ${accountResetList(row.start).map((account) => `
          <div>
            <span>${escapeHtml(account.name)}</span>
            <strong>${formatTimeLabel(account.nextReset)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="status-buttons" role="group" aria-label="Status">
        ${statusPresets().map((preset) => `
          <button class="status-button ${state.status === preset.key ? "active" : ""}" type="button" data-id="${row.id}" data-status="${preset.key}" data-count="${preset.count}">
            ${preset.label}
          </button>
        `).join("")}
      </div>
      <input class="description-input" data-id="${row.id}" value="${escapeAttribute(state.description)}" placeholder="Description or note" aria-label="Description for ${row.window}">
    `;
    el.windowList.appendChild(card);
  });

  el.windowList.querySelectorAll(".status-button").forEach((button) => {
    button.addEventListener("click", handleStatusClick);
  });
  el.windowList.querySelectorAll(".count-input").forEach((input) => {
    input.addEventListener("input", handleCountInput);
    input.addEventListener("change", handleCountInput);
  });
  el.windowList.querySelectorAll(".description-input").forEach((input) => {
    input.addEventListener("input", handleDescriptionInput);
  });
}

function renderCalendar() {
  el.calendarGrid.innerHTML = "";
  const days = daysInSelectedMonth();
  days.forEach((date) => {
    const schedule = buildDaySchedule(date);
    const totals = totalsForSchedule(schedule);
    const ratio = totals.potential ? totals.achieved / totals.potential : 0;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.style.setProperty("--day-bg", dayGradient(ratio));
    button.classList.toggle("selected", dateKey(date) === settings.selectedDate);
    button.classList.toggle("today", dateKey(date) === dateKey(new Date()));
    button.innerHTML = `
      <span>${date.getDate()}</span>
      <strong>${totals.achieved}</strong>
    `;
    button.addEventListener("click", () => {
      settings.selectedDate = dateKey(date);
      el.datePicker.value = settings.selectedDate;
      saveSettings();
      playTone("tap");
      rebuild({ scroll: true });
    });
    el.calendarGrid.appendChild(button);
  });
}

function renderAccounts() {
  const context = dayContextDate();
  const accounts = accountRuntime(context);
  el.resetGrid.innerHTML = "";

  accounts.forEach((account, index) => {
    const card = document.createElement("article");
    card.className = "reset-card";
    card.innerHTML = `
      <div class="reset-topline">
        <span class="rank">${index + 1}</span>
        <strong>${escapeHtml(account.name)}</strong>
        <button class="remove-account" type="button" data-id="${account.id}" title="Remove ${escapeAttribute(account.name)}">x</button>
      </div>
      <div class="next-reset">
        <span>Next reset</span>
        <b>${formatTimeLabel(account.nextReset)}</b>
      </div>
      <label>
        <span>Base reset</span>
        <input type="time" value="${account.time}" data-id="${account.id}" aria-label="${account.name} base reset time">
      </label>
    `;
    el.resetGrid.appendChild(card);
  });

  el.resetGrid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      const account = settings.accounts.find((item) => item.id === input.dataset.id);
      if (!account) return;
      account.time = input.value || account.time;
      saveSettings();
      playTone("tap");
      rebuild();
    });
  });

  el.resetGrid.querySelectorAll(".remove-account").forEach((button) => {
    button.addEventListener("click", () => {
      if (settings.accounts.length <= 1) return;
      settings.accounts = settings.accounts.filter((account) => account.id !== button.dataset.id);
      saveSettings();
      playTone("warning");
      rebuild();
    });
  });
}

function accountResetList(windowStart) {
  return runtimeAccounts()
    .map((account) => ({ ...account, nextReset: nextResetAfter(account, windowStart) }))
    .sort((a, b) => a.nextReset - b.nextReset);
}

function dayGradient(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const hue = Math.round(3 + 117 * clamped);
  const lightA = clamped >= 0.75 ? 36 : 30 + Math.round(8 * clamped);
  const lightB = clamped >= 0.75 ? 22 : 18 + Math.round(5 * clamped);
  return `linear-gradient(135deg, hsl(${hue} 54% ${lightA}%), hsl(${hue} 44% ${lightB}%))`;
}

function renderAnalytics() {
  const dayTotals = totalsForSchedule(daySchedule);
  const monthTotals = totalsForSchedule(monthSchedule);
  const completion = monthTotals.potential ? Math.round((monthTotals.achieved / monthTotals.potential) * 100) : 0;
  const dayCompletion = dayTotals.potential ? Math.round((dayTotals.achieved / dayTotals.potential) * 100) : 0;

  el.selectedDayVideos.textContent = dayTotals.achieved.toLocaleString("en-US");
  el.selectedDayMissed.textContent = dayTotals.missedVideos.toLocaleString("en-US");
  el.selectedDayCompletion.textContent = `${dayCompletion}%`;
  el.monthAchieved.textContent = monthTotals.achieved.toLocaleString("en-US");
  el.monthMissedVideos.textContent = monthTotals.missedVideos.toLocaleString("en-US");
  el.completionRate.textContent = `${completion}%`;
  el.streakText.textContent = `${calculateStreak()} days`;
  drawDailyChart();
  updateCoachText(dayTotals, monthTotals, completion);
}

function updateTitles() {
  const selected = selectedDate();
  const dateLabel = selected.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "2-digit", year: "numeric" });
  const monthLabel = selected.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  el.scheduleTitle.textContent = dateLabel;
  el.monthTitle.textContent = monthLabel;
  el.analyticsTitle.textContent = `${monthLabel} analytics`;
}

function handleStatusClick(event) {
  const button = event.currentTarget;
  const row = rowById(button.dataset.id);
  if (!row) return;
  const state = getRowState(row);
  const nextStatus = state.manual && state.status === button.dataset.status ? "" : button.dataset.status;
  saveRowState(row.id, {
    status: nextStatus,
    count: nextStatus ? Number(button.dataset.count) : 0,
    description: state.description,
    manual: true,
    updatedAt: new Date().toISOString(),
  });
  playTone(nextStatus === "MISSED" || nextStatus === "CANCELED" ? "warning" : "success");
  rebuild();
}

function handleCountInput(event) {
  const input = event.currentTarget;
  const row = rowById(input.dataset.id);
  if (!row) return;
  const state = getRowState(row);
  const count = clampNumber(input.value, 0, maxPerWindow());
  input.value = count;
  saveRowState(row.id, {
    status: statusFromCount(count),
    count,
    description: state.description,
    manual: true,
    updatedAt: new Date().toISOString(),
  });
  syncRowButtons(row.id, statusFromCount(count));
  renderCalendar();
  renderAnalytics();
}

function handleDescriptionInput(event) {
  const input = event.currentTarget;
  const row = rowById(input.dataset.id);
  if (!row) return;
  const state = getRowState(row);
  saveRowState(row.id, {
    ...state,
    description: input.value,
    manual: true,
    updatedAt: new Date().toISOString(),
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
  if (!windowPlan || windowPlan.overlapMinutes < WINDOW_MINUTES || settings.accounts.length === 0) return [];
  const rows = [];
  let start = new Date(windowPlan.firstWindowStart);

  while (start < rangeStart) start = addMinutes(start, CYCLE_MINUTES);
  while (addMinutes(start, -CYCLE_MINUTES) >= rangeStart) start = addMinutes(start, -CYCLE_MINUTES);

  while (start < rangeEnd) {
    const end = addMinutes(start, WINDOW_MINUTES);
    rows.push({
      id: `${dateKey(start)}-${pad(start.getHours())}${pad(start.getMinutes())}`,
      date: new Date(start),
      start: new Date(start),
      end,
      window: `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      order: orderForWindow(start),
    });
    start = addMinutes(start, CYCLE_MINUTES);
  }

  return rows;
}

function calculateWindowPlan() {
  const accounts = runtimeAccounts();
  if (accounts.length === 1) {
    return {
      firstWindowStart: accounts[0].reset,
      overlapMinutes: CYCLE_MINUTES,
      overlapStartAccount: accounts[0].name,
      overlapEndAccount: accounts[0].name,
    };
  }

  const phases = accounts
    .map((account) => ({
      ...account,
      phase: positiveModulo(minutesBetween(referenceMonthStart(), account.reset), CYCLE_MINUTES),
    }))
    .sort((a, b) => a.phase - b.phase);

  let bestGap = -1;
  let gapStart = phases[0];
  let gapEnd = phases[0];
  phases.forEach((account, index) => {
    const next = phases[(index + 1) % phases.length];
    const gap = positiveModulo(next.phase - account.phase, CYCLE_MINUTES);
    if (gap > bestGap) {
      bestGap = gap;
      gapStart = account;
      gapEnd = next;
    }
  });

  const centerSlack = Math.max(0, Math.floor((bestGap - WINDOW_MINUTES) / 2));
  return {
    firstWindowStart: addMinutes(gapStart.reset, centerSlack),
    overlapMinutes: bestGap,
    overlapStartAccount: gapStart.name,
    overlapEndAccount: gapEnd.name,
  };
}

function orderForWindow(windowStart) {
  return [...runtimeAccounts()]
    .sort((a, b) => nextResetAfter(a, windowStart) - nextResetAfter(b, windowStart))
    .map((account) => account.name);
}

function accountRuntime(context) {
  return runtimeAccounts()
    .map((account) => ({ ...account, nextReset: nextResetAfter(account, context) }))
    .sort((a, b) => a.nextReset - b.nextReset);
}

function runtimeAccounts() {
  return settings.accounts.map((account) => ({
    ...account,
    reset: referenceDateFromTime(account.time),
  }));
}

function currentWindow() {
  const now = new Date();
  return daySchedule.find((row) => row.start <= now && row.end >= now) || null;
}

function nextWindow() {
  const now = new Date();
  return daySchedule.find((row) => row.end >= now) || null;
}

function rowById(id) {
  return daySchedule.find((row) => row.id === id) || monthSchedule.find((row) => row.id === id);
}

function getRowState(row) {
  const saved = entries[row.id];
  if (saved) {
    return {
      status: saved.status || "",
      count: clampNumber(saved.count || 0, 0, maxPerWindow()),
      description: saved.description || "",
      manual: true,
    };
  }
  if (row.end < new Date()) return { status: "MISSED", count: 0, description: "", manual: false };
  return { status: "", count: 0, description: "", manual: false };
}

function saveRowState(id, state) {
  entries[id] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function totalsForSchedule(schedule) {
  return schedule.reduce((totals, row) => {
    const state = getRowState(row);
    const achieved = Number(state.count) || 0;
    totals.achieved += achieved;
    totals.potential += maxPerWindow();
    totals.missedVideos += missedVideos(row, state);
    if (isMissedWindow(row, state)) totals.missedWindows += 1;
    return totals;
  }, { achieved: 0, potential: 0, missedVideos: 0, missedWindows: 0 });
}

function missedVideos(row, state) {
  if (state.status === "CANCELED") return 0;
  if (state.status === "MISSED" || state.status === "HALF DONE" || state.status === "FULL DONE" || (!state.manual && row.end < new Date())) {
    return Math.max(0, maxPerWindow() - (Number(state.count) || 0));
  }
  return 0;
}

function isMissedWindow(row, state) {
  if (state.status === "CANCELED") return false;
  if (state.status === "MISSED") return true;
  return !state.manual && row.end < new Date() && (Number(state.count) || 0) === 0;
}

function drawDailyChart() {
  const canvas = el.dailyChart;
  const context = canvas.getContext("2d");
  const days = daysInSelectedMonth().map((date) => ({ date, totals: totalsForSchedule(buildDaySchedule(date)) }));
  const best = days.reduce((max, day) => Math.max(max, day.totals.achieved), 0);
  const width = canvas.width;
  const height = canvas.height;
  const padX = 22;
  const padY = 24;
  const barGap = 4;
  const barWidth = Math.max(5, (width - padX * 2) / days.length - barGap);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fillRect(padX, height - padY, width - padX * 2, 1);

  days.forEach((day, index) => {
    const ratio = best ? day.totals.achieved / best : 0;
    const barHeight = Math.max(2, (height - padY * 2) * ratio);
    const x = padX + index * (barWidth + barGap);
    const y = height - padY - barHeight;
    context.fillStyle = dateKey(day.date) === settings.selectedDate ? "#f5f5f7" : "#6f737c";
    roundRect(context, x, y, barWidth, barHeight, 5);
    context.fill();
  });

  const bestDay = days.reduce((bestItem, day) => (day.totals.achieved > bestItem.totals.achieved ? day : bestItem), days[0]);
  el.bestDayText.textContent = bestDay ? `${formatShortDate(bestDay.date)}: ${bestDay.totals.achieved}` : "--";
}

function updateCoachText(dayTotals, monthTotals, completion) {
  if (dayTotals.achieved === 0 && dayTotals.missedVideos === 0) {
    el.coachText.textContent = "No videos logged for the selected day yet.";
  } else if (dayTotals.missedVideos > 0) {
    el.coachText.textContent = `${dayTotals.missedVideos} videos missed on this day. Use the next open window to recover.`;
  } else if (completion >= 75) {
    el.coachText.textContent = "Strong month. The calendar is trending in the right direction.";
  } else {
    el.coachText.textContent = `${monthTotals.achieved} videos logged this month. Full windows move the score fastest.`;
  }
}

function calculateStreak() {
  let streak = 0;
  const selected = selectedDate();
  let cursor = startOfDay(selected);
  while (cursor.getMonth() === selected.getMonth()) {
    const totals = totalsForSchedule(buildDaySchedule(cursor));
    if (totals.achieved <= 0) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function downloadJson() {
  const payload = { app: "Window Command", version: 4, exportedAt: new Date().toISOString(), settings, entries };
  downloadFile(`window-command-backup-${dateKey(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (payload.settings?.accounts) settings = payload.settings;
      if (payload.entries) {
        Object.keys(entries).forEach((key) => delete entries[key]);
        Object.assign(entries, payload.entries);
      }
      settings.selectedDate = settings.selectedDate || dateKey(new Date());
      settings.sound = settings.sound !== false;
      settings.accounts = normalizeAccounts(settings.accounts);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      saveSettings();
      el.datePicker.value = settings.selectedDate;
      updateSoundButton();
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

function scrollToCurrentWindow() {
  requestAnimationFrame(() => {
    const target = document.querySelector(".window-card.is-current") || document.querySelector(".window-card:not(.is-past)") || document.querySelector("#currentWindowSection");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function changeDay(offset) {
  const next = addDays(selectedDate(), offset);
  settings.selectedDate = dateKey(next);
  el.datePicker.value = settings.selectedDate;
  saveSettings();
  playTone("tap");
  rebuild({ scroll: true });
}

function dayContextDate() {
  const selected = selectedDate();
  if (dateKey(selected) === dateKey(new Date())) return new Date();
  return startOfDay(selected);
}

function selectedDate() {
  return parseDateKey(settings.selectedDate);
}

function statusPresets() {
  const max = maxPerWindow();
  return [
    { key: "FULL DONE", label: "Full", count: max },
    { key: "HALF DONE", label: "Half", count: Math.ceil(max / 2) },
    { key: "MISSED", label: "Missed", count: 0 },
    { key: "CANCELED", label: "Cancel", count: 0 },
  ];
}

function statusFromCount(count) {
  if (count >= maxPerWindow()) return "FULL DONE";
  if (count > 0) return "HALF DONE";
  return "";
}

function maxPerWindow() {
  return settings.accounts.length * VIDEOS_PER_ACCOUNT;
}

function windowStateLabel(row, state) {
  const now = new Date();
  if (state.status === "CANCELED") return "Canceled";
  if (state.status === "FULL DONE") return "Complete";
  if (state.status === "HALF DONE") return "Partial";
  if (state.status === "MISSED") return state.manual ? "Missed" : "Auto missed";
  if (row.start <= now && row.end >= now) return "Live now";
  if (row.start > now) return "Upcoming";
  return "Past";
}

function syncRowButtons(id, status) {
  document.querySelectorAll(`.status-button[data-id="${id}"]`).forEach((button) => {
    button.classList.toggle("active", button.dataset.status === status);
  });
}

function updateSoundButton() {
  el.soundButton.classList.toggle("active", Boolean(settings.sound));
}

function playTone(type) {
  if (!settings.sound) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequencies = { tap: 420, success: 620, warning: 180 };
    oscillator.frequency.value = frequencies[type] || 420;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.11);
  } catch {
    // Sound is optional.
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function normalizeAccounts(accounts) {
  const source = Array.isArray(accounts) ? accounts : DEFAULT_ACCOUNTS;
  return source
    .filter((account) => account && account.name && account.time)
    .map((account) => ({
      id: account.id || uniqueAccountId(account.name),
      name: String(account.name).trim().toUpperCase().slice(0, 12),
      time: account.time,
    }));
}

function uniqueAccountId(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";
  let id = base;
  let index = 2;
  while (settings.accounts?.some((account) => account.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function referenceDateFromTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(REFERENCE_YEAR, REFERENCE_MONTH, REFERENCE_DAY, hour, minute, 0, 0);
}

function referenceMonthStart() {
  return new Date(REFERENCE_YEAR, REFERENCE_MONTH, 1, 0, 0, 0, 0);
}

function nextResetAfter(account, date) {
  const elapsed = date - account.reset;
  const cycleMs = CYCLE_MINUTES * 60000;
  const cycles = Math.floor(elapsed / cycleMs) + 1;
  return addMinutes(account.reset, cycles * CYCLE_MINUTES);
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

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
