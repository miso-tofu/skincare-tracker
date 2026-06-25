// Home screen — today's AM/PM checklist with day picker + skip steps
(function() {
  let currentDate    = DB.todayStr();
  let currentSession = 'AM';
  let todayLog       = null;
  let pmRoutineType  = 'rest';
  let timerInterval  = null;
  let mergedSteps    = [];

  // ── Render shell ────────────────────────────────────────────────────────────

  async function renderHome() {
    const screen = document.getElementById('screen-home');
    screen.innerHTML = `
      <!-- Day picker -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;margin-top:4px;">
        <button onclick="Home.prevDay()"
          style="background:var(--md-sys-color-surface-container-high);border:none;
            border-radius:var(--md-sys-shape-corner-full);width:40px;height:40px;
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            color:var(--md-sys-color-on-surface-variant);-webkit-tap-highlight-color:transparent;">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>

        <div style="text-align:center;flex:1;">
          <div id="day-picker-label" style="font-size:var(--md-sys-typescale-title-size);font-weight:500;
            color:var(--md-sys-color-on-surface);"></div>
          <div id="day-picker-sub" style="font-size:var(--md-sys-typescale-label-size);
            color:var(--md-sys-color-on-surface-variant);margin-top:1px;"></div>
        </div>

        <button onclick="Home.nextDay()"
          style="background:var(--md-sys-color-surface-container-high);border:none;
            border-radius:var(--md-sys-shape-corner-full);width:40px;height:40px;
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            color:var(--md-sys-color-on-surface-variant);-webkit-tap-highlight-color:transparent;">
          <span class="material-symbols-rounded">chevron_right</span>
        </button>
      </div>

      <!-- Session + routine badge row -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <div class="session-toggle" style="flex:1;margin-bottom:0;">
          <button class="session-btn active" id="btn-am" onclick="Home.setSession('AM')">☀️ Morning</button>
          <button class="session-btn" id="btn-pm" onclick="Home.setSession('PM')">🌙 Evening</button>
        </div>
        <div class="routine-badge" id="pm-badge" style="flex-shrink:0;">
          <span class="material-symbols-rounded" style="font-size:16px">nights_stay</span>
          <span id="pm-badge-label">…</span>
        </div>
        <button id="edit-routine-btn" onclick="Home.editRoutine()"
          style="background:var(--md-sys-color-surface-container-high);border:none;
            border-radius:var(--md-sys-shape-corner-full);width:36px;height:36px;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            color:var(--md-sys-color-on-surface-variant);-webkit-tap-highlight-color:transparent;">
          <span class="material-symbols-rounded" style="font-size:18px;">tune</span>
        </button>
      </div>

      <!-- Checklist card -->
      <div class="card">
        <div class="progress-row">
          <div class="progress-track">
            <div class="progress-fill" id="home-progress" style="width:0%"></div>
          </div>
          <div class="progress-label" id="home-progress-label">0 / 0</div>
        </div>
        <div class="checklist" id="home-checklist"></div>
      </div>

      <div id="timer-container"></div>
    `;

    await refreshDateDisplay();
    await loadSession(currentSession);
  }

  // ── Date helpers ───────────────────────────────────────────────────────────

  function refreshDateDisplay() {
    const today = DB.todayStr();
    const diff  = dateDiffDays(today, currentDate); // positive = future, negative = past

    let label, sub;
    if (currentDate === today) {
      label = DB.formatDateLong(today);
      sub   = 'Today';
    } else if (diff === -1) {
      label = DB.formatDateLong(currentDate);
      sub   = 'Yesterday';
    } else if (diff === 1) {
      label = DB.formatDateLong(currentDate);
      sub   = 'Tomorrow';
    } else if (diff < 0) {
      label = DB.formatDateLong(currentDate);
      sub   = `${Math.abs(diff)} days ago`;
    } else {
      label = DB.formatDateLong(currentDate);
      sub   = `In ${diff} days`;
    }

    const labelEl = document.getElementById('day-picker-label');
    const subEl   = document.getElementById('day-picker-sub');
    if (labelEl) labelEl.textContent = label;
    if (subEl)   subEl.textContent   = sub;
  }

  function dateDiffDays(from, to) {
    const a = new Date(from + 'T12:00:00');
    const b = new Date(to   + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }

  function shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00'); // noon avoids UTC rollover in any timezone
    d.setDate(d.getDate() + days);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }

  function prevDay() {
    currentDate = shiftDate(currentDate, -1);
    refreshDateDisplay();
    loadSession(currentSession);
  }

  function nextDay() {
    currentDate = shiftDate(currentDate, 1);
    refreshDateDisplay();
    loadSession(currentSession);
  }

  // ── Session load ───────────────────────────────────────────────────────────

  async function loadSession(session) {
    const { Logs, Schedule, Products, RoutineCustomizations, ROUTINE_LABELS } = DB;
    currentSession = session;

    document.getElementById('btn-am')?.classList.toggle('active', session === 'AM');
    document.getElementById('btn-pm')?.classList.toggle('active', session === 'PM');

    // Get PM routine type for the day-of-week of currentDate
    const dow = new Date(currentDate + 'T00:00:00').getDay();
    const entry = await Schedule.getDay(dow);
    pmRoutineType = entry.routine_type;
    const badgeEl = document.getElementById('pm-badge-label');
    if (badgeEl) badgeEl.textContent = ROUTINE_LABELS[pmRoutineType];

    todayLog = await Logs.getSession(currentDate, session);
    if (!todayLog) {
      todayLog = {
        date:            currentDate,
        session,
        routine_type:    session === 'AM' ? 'morning' : pmRoutineType,
        steps_completed: [],
        steps_skipped:   [],
        rating:          null,
        tags:            [],
        notes:           ''
      };
    }
    if (!todayLog.steps_skipped) todayLog.steps_skipped = [];

    const routineType = session === 'AM' ? 'morning' : pmRoutineType;
    const allProducts = await Products.getAll();
    mergedSteps = await RoutineCustomizations.getMergedSteps(routineType, allProducts);

    renderChecklist();
  }

  // ── Checklist render ───────────────────────────────────────────────────────

  function renderChecklist() {
    const completed = new Set(todayLog.steps_completed || []);
    const skipped   = new Set(todayLog.steps_skipped   || []);
    const list = document.getElementById('home-checklist');
    if (!list) return;

    list.innerHTML = mergedSteps.map(step => {
      const isDone    = completed.has(step.id);
      const isSkipped = skipped.has(step.id);

      let itemClass = 'check-item';
      if (isDone)    itemClass += ' checked';
      if (isSkipped) itemClass += ' skipped';

      return `
        <div class="${itemClass}"
             onclick="Home.toggle('${step.id}')"
             id="check-${step.id}"
             style="${isSkipped ? 'opacity:0.5;' : ''}">

          <!-- Checkbox / skip indicator -->
          <div class="check-box" style="${isSkipped
            ? 'background:var(--md-sys-color-surface-container-highest);border-color:var(--md-sys-color-outline-variant);color:var(--md-sys-color-on-surface-variant);'
            : ''}">
            <span class="material-symbols-rounded" style="font-size:16px;">
              ${isSkipped ? 'remove' : 'check'}
            </span>
          </div>

          <!-- Step info -->
          <div class="step-info">
            <div class="step-name" style="${isSkipped ? 'text-decoration:line-through;' : ''}">
              ${step.name}
            </div>
            ${step.product
              ? `<div class="step-note" style="color:var(--md-sys-color-primary);opacity:0.85;">
                  <span class="material-symbols-rounded" style="font-size:11px;vertical-align:middle;">science</span>
                  ${step.product.name}${step.product.brand ? ' · ' + step.product.brand : ''}
                 </div>`
              : step.note
                ? `<div class="step-note">${step.note}</div>`
                : ''
            }
          </div>

          <!-- Timer chip (Reedle) -->
          ${step.hasTimer && !isSkipped ? `
            <button class="timer-chip" onclick="event.stopPropagation();Home.startTimer()">
              <span class="material-symbols-rounded">timer</span>
              <span id="timer-chip-label">3 min</span>
            </button>
          ` : ''}

          <!-- SPF sun icon when checked -->
          ${step.isSpf && isDone ? `
            <span class="material-symbols-rounded filled"
              style="color:var(--md-sys-color-warning);font-size:20px">wb_sunny</span>
          ` : ''}

          <!-- Skip button (only on unchecked, non-skipped steps) -->
          ${!isDone ? `
            <button onclick="event.stopPropagation();Home.skipStep('${step.id}')"
              style="background:none;border:none;cursor:pointer;padding:6px;
                min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center;
                color:${isSkipped ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'};
                border-radius:var(--md-sys-shape-corner-full);-webkit-tap-highlight-color:transparent;"
              aria-label="${isSkipped ? 'Unskip' : 'Skip'}">
              <span class="material-symbols-rounded" style="font-size:18px;">
                ${isSkipped ? 'undo' : 'close'}
              </span>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    updateProgress(completed, skipped);
  }

  function updateProgress(completed, skipped) {
    const total     = mergedSteps.length;
    const doneCount = mergedSteps.filter(s => completed.has(s.id)).length;
    const skipCount = mergedSteps.filter(s => skipped.has(s.id)).length;
    const addressed = doneCount + skipCount;
    const pct       = total > 0 ? Math.round((addressed / total) * 100) : 0;

    const fill  = document.getElementById('home-progress');
    const label = document.getElementById('home-progress-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = skipCount > 0
      ? `${doneCount} done · ${skipCount} skipped`
      : `${doneCount} / ${total}`;

    if (addressed === total && total > 0 && doneCount > 0) {
      App.showSnackbar(currentSession === 'AM' ? '☀️ Morning routine done!' : '🌙 Evening routine done!');
    }
  }

  // ── Toggle (check/uncheck) ─────────────────────────────────────────────────

  async function toggleStep(stepId) {
    const completed = new Set(todayLog.steps_completed || []);
    const skipped   = new Set(todayLog.steps_skipped   || []);

    // If skipped, tapping un-skips (back to unchecked)
    if (skipped.has(stepId)) {
      skipped.delete(stepId);
    } else if (completed.has(stepId)) {
      completed.delete(stepId);
    } else {
      completed.add(stepId);
    }

    todayLog.steps_completed = [...completed];
    todayLog.steps_skipped   = [...skipped];
    todayLog.routine_type    = currentSession === 'AM' ? 'morning' : pmRoutineType;

    renderChecklist();
    const saved = await DB.Logs.save(todayLog);
    if (!todayLog.id && saved) todayLog.id = saved;
  }

  // ── Skip step ──────────────────────────────────────────────────────────────

  async function skipStep(stepId) {
    const completed = new Set(todayLog.steps_completed || []);
    const skipped   = new Set(todayLog.steps_skipped   || []);

    // Toggle skip: skipped → unskipped, unskipped → skipped
    if (skipped.has(stepId)) {
      skipped.delete(stepId);
    } else {
      completed.delete(stepId); // can't be both
      skipped.add(stepId);
    }

    todayLog.steps_completed = [...completed];
    todayLog.steps_skipped   = [...skipped];
    todayLog.routine_type    = currentSession === 'AM' ? 'morning' : pmRoutineType;

    renderChecklist();
    const saved = await DB.Logs.save(todayLog);
    if (!todayLog.id && saved) todayLog.id = saved;
  }

  // ── Edit routine shortcut ──────────────────────────────────────────────────

  async function editRoutine() {
    const routineType = currentSession === 'AM' ? 'morning' : pmRoutineType;
    if (typeof ScheduleScreen !== 'undefined') {
      ScheduleScreen.ensureSheets();
      await ScheduleScreen.openStepEditor(routineType);
    }
  }

  // ── 3-minute Reedle timer ──────────────────────────────────────────────────

  function startTimer() {
    const container = document.getElementById('timer-container');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      container.innerHTML = '';
      const chip = document.getElementById('timer-chip-label');
      if (chip) chip.textContent = '3 min';
      return;
    }

    let seconds = 180;

    function render(s) {
      const m   = Math.floor(s / 60);
      const sec = String(s % 60).padStart(2, '0');
      const pct = ((180 - s) / 180) * 100;
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:20px 16px;">
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);
            margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">
            Wait before next step
          </div>
          <div style="font-size:2.5rem;font-weight:300;color:var(--md-sys-color-primary);font-variant-numeric:tabular-nums;">
            ${m}:${sec}
          </div>
          <div class="progress-track" style="margin:12px 0 16px;">
            <div class="progress-fill" style="width:${pct}%;"></div>
          </div>
          <button class="btn-text" onclick="Home.startTimer()" style="margin:0 auto;">Cancel</button>
        </div>
      `;
      const chip = document.getElementById('timer-chip-label');
      if (chip) chip.textContent = `${m}:${sec}`;
    }

    render(seconds);
    timerInterval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        container.innerHTML = `
          <div class="card" style="text-align:center;padding:16px;">
            <span class="material-symbols-rounded filled" style="font-size:32px;color:var(--md-sys-color-primary);">check_circle</span>
            <div style="margin-top:8px;">Ready for next step!</div>
          </div>
        `;
        App.showSnackbar('Timer done — continue your routine!');
        setTimeout(() => { container.innerHTML = ''; }, 3000);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      } else {
        render(seconds);
      }
    }, 1000);
  }

  window.Home = {
    render: renderHome,
    setSession: loadSession,
    toggle: toggleStep,
    skipStep,
    startTimer,
    editRoutine,
    prevDay,
    nextDay
  };
})();
