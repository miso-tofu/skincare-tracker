// Home screen — today's AM/PM checklist
(function() {
  let currentSession = 'AM';
  let todayLog = null;
  let pmRoutineType = 'rest';
  let timerInterval = null;
  let mergedSteps = [];

  async function renderHome() {
    const { Schedule, ROUTINE_LABELS, todayStr, dayOfWeek, formatDateLong } = DB;
    const screen = document.getElementById('screen-home');

    screen.innerHTML = `
      <div class="section-header">
        <div>
          <div class="section-title">Today</div>
          <div class="section-subtitle">${formatDateLong(todayStr())}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="routine-badge" id="pm-badge">
            <span class="material-symbols-rounded" style="font-size:16px">nights_stay</span>
            <span id="pm-badge-label">…</span>
          </div>
          <button id="edit-routine-btn" onclick="Home.editRoutine()"
            style="background:var(--md-sys-color-surface-container-high);border:none;
              border-radius:var(--md-sys-shape-corner-full);width:36px;height:36px;
              display:flex;align-items:center;justify-content:center;cursor:pointer;
              color:var(--md-sys-color-on-surface-variant);
              -webkit-tap-highlight-color:transparent;">
            <span class="material-symbols-rounded" style="font-size:18px;">tune</span>
          </button>
        </div>
      </div>

      <div class="session-toggle">
        <button class="session-btn active" id="btn-am" onclick="Home.setSession('AM')">
          ☀️ Morning
        </button>
        <button class="session-btn" id="btn-pm" onclick="Home.setSession('PM')">
          🌙 Evening
        </button>
      </div>

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

    const entry = await Schedule.getDay(dayOfWeek());
    pmRoutineType = entry.routine_type;
    document.getElementById('pm-badge-label').textContent = ROUTINE_LABELS[pmRoutineType];

    await loadSession(currentSession);
  }

  async function loadSession(session) {
    const { Logs, todayStr, Products, RoutineCustomizations } = DB;
    currentSession = session;

    document.getElementById('btn-am')?.classList.toggle('active', session === 'AM');
    document.getElementById('btn-pm')?.classList.toggle('active', session === 'PM');

    todayLog = await Logs.getSession(todayStr(), session);
    if (!todayLog) {
      todayLog = {
        date: todayStr(),
        session,
        routine_type: session === 'AM' ? 'morning' : pmRoutineType,
        steps_completed: [],
        rating: null,
        tags: [],
        notes: ''
      };
    }

    // Load merged steps (default + custom, with product assignments)
    const routineType = session === 'AM' ? 'morning' : pmRoutineType;
    const allProducts = await Products.getAll();
    mergedSteps = await RoutineCustomizations.getMergedSteps(routineType, allProducts);

    renderChecklist();
  }

  function renderChecklist() {
    const completed = new Set(todayLog.steps_completed || []);
    const list = document.getElementById('home-checklist');
    if (!list) return;

    list.innerHTML = mergedSteps.map(step => `
      <div class="check-item ${completed.has(step.id) ? 'checked' : ''}"
           onclick="Home.toggle('${step.id}')"
           id="check-${step.id}">
        <div class="check-box">
          <span class="material-symbols-rounded" style="font-size:16px">check</span>
        </div>
        <div class="step-info">
          <div class="step-name">${step.name}</div>
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
        ${step.hasTimer ? `
          <button class="timer-chip" onclick="event.stopPropagation();Home.startTimer()">
            <span class="material-symbols-rounded">timer</span>
            <span id="timer-chip-label">3 min</span>
          </button>
        ` : ''}
        ${step.isSpf && completed.has(step.id) ? `
          <span class="material-symbols-rounded filled" style="color:var(--md-sys-color-warning);font-size:20px">wb_sunny</span>
        ` : ''}
      </div>
    `).join('');

    updateProgress(completed);
  }

  function updateProgress(completed) {
    const total = mergedSteps.length;
    const done  = mergedSteps.filter(s => completed.has(s.id)).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    const fill  = document.getElementById('home-progress');
    const label = document.getElementById('home-progress-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = `${done} / ${total}`;
    if (done === total && total > 0) {
      App.showSnackbar(currentSession === 'AM' ? '☀️ Morning routine done!' : '🌙 Evening routine done!');
    }
  }

  async function toggleStep(stepId) {
    const { Logs, todayStr } = DB;
    const completed = new Set(todayLog.steps_completed || []);
    if (completed.has(stepId)) completed.delete(stepId);
    else completed.add(stepId);

    todayLog.steps_completed = [...completed];
    todayLog.routine_type = currentSession === 'AM' ? 'morning' : pmRoutineType;

    renderChecklist();
    const saved = await Logs.save(todayLog);
    if (!todayLog.id && saved) todayLog.id = saved;
  }

  // ── 3-minute Reedle Shot timer ─────────────────────────────────────────────

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
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">
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

  async function editRoutine() {
    const routineType = currentSession === 'AM' ? 'morning' : pmRoutineType;
    if (typeof ScheduleScreen !== 'undefined') {
      ScheduleScreen.ensureSheets();
      await ScheduleScreen.openStepEditor(routineType);
    }
  }

  window.Home = { render: renderHome, setSession: loadSession, toggle: toggleStep, startTimer, editRoutine };
})();
