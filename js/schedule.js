(function () {

  const ROUTINE_OPTIONS = [
    { value: 'retinol',   label: 'Retinol Night',    icon: 'bedtime',      desc: 'Cleanser → Toner → Retinol → Moisturizer → Barrier Mask → Lip' },
    { value: 'exfoliant', label: 'Exfoliant Night',   icon: 'bubble_chart', desc: 'Cleanser → AHA/BHA → Moisturizer → Barrier Mask → Lip' },
    { value: 'reedle',    label: 'Reedle Shot Night', icon: 'colorize',     desc: 'Cleanser → Reedle Shot (3 min) → Toner → Moisturizer → Overnight Mask → Lip' },
    { value: 'rest',      label: 'Rest Night',        icon: 'nights_stay',  desc: 'Cleanser → Toner → Moisturizer → Overnight Mask → Lip' }
  ];

  const DAY_COLORS = {
    retinol:   { bg: 'var(--md-sys-color-primary-container)',   fg: 'var(--md-sys-color-on-primary-container)' },
    exfoliant: { bg: 'var(--md-sys-color-secondary-container)', fg: 'var(--md-sys-color-on-secondary-container)' },
    reedle:    { bg: '#2D3A2E', fg: '#8FCB8F' },
    rest:      { bg: 'var(--md-sys-color-surface-container-high)', fg: 'var(--md-sys-color-on-surface-variant)' }
  };

  const ROUTINE_ICONS = {
    retinol: 'bedtime', exfoliant: 'bubble_chart', reedle: 'colorize', rest: 'nights_stay'
  };

  let scheduleData  = [];
  let editingDay    = null;   // for night-type picker
  let editingRoutine = null;  // for step editor (routine_type string)
  let allProducts   = [];
  let editSteps     = [];     // merged steps for current editing routine

  // ── Main render ────────────────────────────────────────────────────────────

  async function renderSchedule() {
    const screen = document.getElementById('screen-schedule');
    scheduleData = await DB.Schedule.getAll();
    allProducts  = await DB.Products.getAll();
    const todayDow = DB.dayOfWeek();

    screen.innerHTML = `
      <div class="section-header" style="margin-top:4px;">
        <div class="section-title">Weekly schedule</div>
        <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">
          Tap a night to change
        </div>
      </div>

      <!-- 7-day pill grid -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:20px;">
        ${scheduleData.map(s => dayPill(s, todayDow)).join('')}
      </div>

      <!-- Routine list -->
      <div class="section-header">
        <div class="section-title">Night routines</div>
      </div>
      <div class="card" style="padding:0 16px;">
        ${scheduleData.map((s, i) => routineRow(s, todayDow, i === scheduleData.length - 1)).join('')}
      </div>

      <!-- Morning routine -->
      <div style="margin-top:16px;padding:12px 16px;border-radius:var(--md-sys-shape-corner-large);
        background:var(--md-sys-color-surface-container);
        display:flex;align-items:center;gap:12px;">
        <span class="material-symbols-rounded filled" style="color:var(--md-sys-color-warning);font-size:22px;">wb_sunny</span>
        <div style="flex:1;">
          <div style="font-size:var(--md-sys-typescale-body-size);font-weight:500;">Morning routine</div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-top:1px;">
            Every day — Cleanser → Toner → Vitamin C → Moisturizer → SPF
          </div>
        </div>
        <button class="btn-text" style="padding:8px;min-height:auto;"
          onclick="ScheduleScreen.openStepEditor('morning')">
          <span class="material-symbols-rounded" style="font-size:20px;">edit</span>
        </button>
      </div>
    `;
  }

  // ── Day pill ───────────────────────────────────────────────────────────────

  function dayPill(entry, todayDow) {
    const { day, routine_type } = entry;
    const isToday = day === todayDow;
    const colors  = DAY_COLORS[routine_type];
    const icon    = ROUTINE_ICONS[routine_type];
    return `
      <div onclick="ScheduleScreen.openPicker(${day})"
        style="display:flex;flex-direction:column;align-items:center;gap:5px;
          padding:10px 4px;border-radius:var(--md-sys-shape-corner-large);
          background:${colors.bg};cursor:pointer;
          border:2px solid ${isToday ? 'var(--md-sys-color-primary)' : 'transparent'};
          -webkit-tap-highlight-color:transparent;">
        <div style="font-size:0.6rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${colors.fg};">
          ${DB.DAY_NAMES[day]}
        </div>
        <span class="material-symbols-rounded" style="font-size:18px;color:${colors.fg};">${icon}</span>
      </div>
    `;
  }

  // ── Routine row ────────────────────────────────────────────────────────────

  function routineRow(entry, todayDow, isLast) {
    const { day, routine_type } = entry;
    const isToday = day === todayDow;
    const opt     = ROUTINE_OPTIONS.find(o => o.value === routine_type);
    const colors  = DAY_COLORS[routine_type];
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 0;
        border-bottom:${isLast ? 'none' : '1px solid var(--md-sys-color-outline-variant)'};">
        <!-- Day badge — tap to change night type -->
        <div onclick="ScheduleScreen.openPicker(${day})"
          style="width:40px;height:40px;border-radius:var(--md-sys-shape-corner-medium);
            background:${colors.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;
            cursor:pointer;border:${isToday ? '2px solid var(--md-sys-color-primary)' : 'none'};
            -webkit-tap-highlight-color:transparent;">
          <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:${colors.fg};">
            ${DB.DAY_NAMES[day]}
          </span>
        </div>
        <!-- Routine info -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--md-sys-typescale-body-size);font-weight:${isToday ? '600' : '400'};color:var(--md-sys-color-on-surface);">
            ${opt.label}
            ${isToday ? `<span style="font-size:0.65rem;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);padding:1px 6px;border-radius:999px;margin-left:6px;vertical-align:middle;">Tonight</span>` : ''}
          </div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-top:2px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${opt.desc}
          </div>
        </div>
        <!-- Edit steps button -->
        <button onclick="ScheduleScreen.openStepEditor('${routine_type}')"
          style="background:var(--md-sys-color-surface-container-highest);border:none;
            border-radius:var(--md-sys-shape-corner-full);padding:6px 10px;
            display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;
            color:var(--md-sys-color-on-surface-variant);font-size:var(--md-sys-typescale-label-size);
            -webkit-tap-highlight-color:transparent;min-height:36px;">
          <span class="material-symbols-rounded" style="font-size:16px;">tune</span>
          Steps
        </button>
      </div>
    `;
  }

  // ── Night-type picker sheet ────────────────────────────────────────────────

  function openPicker(dayIndex) {
    editingDay = dayIndex;
    document.getElementById('schedule-sheet-title').textContent = `${DB.DAY_NAMES_FULL[dayIndex]} night`;
    const current = scheduleData.find(s => s.day === dayIndex)?.routine_type || 'rest';

    document.getElementById('schedule-options').innerHTML = ROUTINE_OPTIONS.map(opt => {
      const isSelected = opt.value === current;
      return `
        <div onclick="ScheduleScreen.selectRoutine('${opt.value}')"
          style="display:flex;align-items:center;gap:14px;padding:14px 4px;
            border-radius:var(--md-sys-shape-corner-medium);cursor:pointer;
            background:${isSelected ? 'var(--md-sys-color-secondary-container)' : 'transparent'};
            margin-bottom:4px;-webkit-tap-highlight-color:transparent;">
          <div style="width:44px;height:44px;border-radius:var(--md-sys-shape-corner-medium);
            background:${DAY_COLORS[opt.value].bg};
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span class="material-symbols-rounded" style="font-size:22px;color:${DAY_COLORS[opt.value].fg};">${opt.icon}</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:var(--md-sys-typescale-body-size);font-weight:${isSelected ? '600' : '400'};
              color:${isSelected ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)'};">
              ${opt.label}
            </div>
            <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-top:2px;">
              ${opt.desc.split('→')[0].trim()}…
            </div>
          </div>
          ${isSelected ? `<span class="material-symbols-rounded filled" style="color:var(--md-sys-color-primary);font-size:22px;">check_circle</span>` : ''}
        </div>
      `;
    }).join('');

    document.getElementById('schedule-overlay').classList.add('visible');
    document.getElementById('schedule-sheet').classList.add('visible');
  }

  function closePicker() {
    document.getElementById('schedule-overlay').classList.remove('visible');
    document.getElementById('schedule-sheet').classList.remove('visible');
    editingDay = null;
  }

  async function selectRoutine(routineType) {
    if (editingDay === null) return;
    await DB.Schedule.setDay(editingDay, routineType);
    closePicker();
    App.showSnackbar(`${DB.DAY_NAMES_FULL[editingDay]} set to ${DB.ROUTINE_LABELS[routineType]}`);
    await renderSchedule();
  }

  // ── Step editor sheet ──────────────────────────────────────────────────────

  async function openStepEditor(routineType) {
    editingRoutine = routineType;
    const label    = DB.ROUTINE_LABELS[routineType];
    document.getElementById('step-editor-title').textContent = label;

    allProducts = await DB.Products.getAll();
    editSteps   = await DB.RoutineCustomizations.getMergedSteps(routineType, allProducts);

    renderStepList();

    document.getElementById('step-editor-overlay').classList.add('visible');
    document.getElementById('step-editor-sheet').classList.add('visible');
  }

  function closeStepEditor() {
    document.getElementById('step-editor-overlay').classList.remove('visible');
    document.getElementById('step-editor-sheet').classList.remove('visible');
    editingRoutine = null;
    editSteps = [];
  }

  function renderStepList() {
    const el = document.getElementById('step-list');
    if (!el) return;

    el.innerHTML = editSteps.map((step, i) => {
      const productName = step.product
        ? `${step.product.name}${step.product.brand ? ' · ' + step.product.brand : ''}`
        : null;

      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;
          border-bottom:${i < editSteps.length - 1 ? '1px solid var(--md-sys-color-outline-variant)' : 'none'};">
          <!-- Step number -->
          <div style="width:26px;height:26px;border-radius:50%;
            background:var(--md-sys-color-surface-container-highest);
            display:flex;align-items:center;justify-content:center;
            font-size:0.7rem;font-weight:600;color:var(--md-sys-color-on-surface-variant);flex-shrink:0;">
            ${i + 1}
          </div>
          <!-- Step info -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:var(--md-sys-typescale-body-size);font-weight:500;color:var(--md-sys-color-on-surface);">
              ${step.name}
              ${step.isCustom ? `<span style="font-size:0.6rem;background:var(--md-sys-color-secondary-container);
                color:var(--md-sys-color-on-secondary-container);padding:1px 6px;border-radius:999px;margin-left:4px;">custom</span>` : ''}
            </div>
            ${productName
              ? `<div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-primary);margin-top:2px;">
                  <span class="material-symbols-rounded" style="font-size:11px;vertical-align:middle;">science</span>
                  ${productName}
                 </div>`
              : `<div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-outline);margin-top:2px;">No product assigned</div>`
            }
          </div>
          <!-- Assign product button -->
          <button onclick="ScheduleScreen.openProductPicker('${step.id}')"
            style="background:var(--md-sys-color-surface-container-highest);border:none;
              border-radius:var(--md-sys-shape-corner-full);padding:6px 10px;
              cursor:pointer;color:var(--md-sys-color-on-surface-variant);
              font-size:var(--md-sys-typescale-label-size);display:flex;align-items:center;gap:4px;
              -webkit-tap-highlight-color:transparent;flex-shrink:0;min-height:36px;">
            <span class="material-symbols-rounded" style="font-size:15px;">science</span>
            ${step.product ? 'Change' : 'Assign'}
          </button>
          <!-- Remove custom step -->
          ${step.isCustom ? `
            <button onclick="ScheduleScreen.removeCustomStep('${step.id}')"
              style="background:none;border:none;cursor:pointer;padding:6px;
                color:var(--md-sys-color-error);-webkit-tap-highlight-color:transparent;min-height:36px;">
              <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // ── Product picker (within step editor) ───────────────────────────────────

  let pickingForStepId = null;

  async function openProductPicker(stepId) {
    pickingForStepId = stepId;
    // Always refresh product list in case new ones were added
    allProducts = await DB.Products.getAll();
    const step = editSteps.find(s => s.id === stepId);

    document.getElementById('product-picker-title').textContent =
      `Assign product to "${step?.name}"`;

    const el = document.getElementById('product-picker-list');
    const opts = [
      { id: null, name: 'None', brand: 'Remove assignment', icon: 'block' },
      ...allProducts.map(p => ({ ...p, icon: 'science' }))
    ];

    el.innerHTML = opts.map(p => {
      const isCurrent = step?.product?.id === p.id || (p.id === null && !step?.product);
      return `
        <div onclick="ScheduleScreen.assignProduct(${p.id === null ? 'null' : p.id})"
          style="display:flex;align-items:center;gap:12px;padding:12px 4px;
            border-radius:var(--md-sys-shape-corner-medium);cursor:pointer;
            background:${isCurrent ? 'var(--md-sys-color-secondary-container)' : 'transparent'};
            -webkit-tap-highlight-color:transparent;">
          <div style="width:38px;height:38px;border-radius:var(--md-sys-shape-corner-medium);
            background:var(--md-sys-color-surface-container-highest);
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span class="material-symbols-rounded" style="font-size:18px;color:var(--md-sys-color-on-surface-variant);">${p.icon}</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:var(--md-sys-typescale-body-size);
              font-weight:${isCurrent ? '600' : '400'};
              color:${isCurrent ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)'};">
              ${p.name}
            </div>
            ${p.brand ? `<div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">${p.brand}</div>` : ''}
          </div>
          ${isCurrent ? `<span class="material-symbols-rounded filled" style="color:var(--md-sys-color-primary);font-size:20px;">check_circle</span>` : ''}
        </div>
      `;
    }).join('');

    document.getElementById('product-picker-overlay').classList.add('visible');
    document.getElementById('product-picker-sheet').classList.add('visible');
  }

  function closeProductPicker() {
    document.getElementById('product-picker-overlay').classList.remove('visible');
    document.getElementById('product-picker-sheet').classList.remove('visible');
    pickingForStepId = null;
  }

  async function assignProduct(productId) {
    if (!editingRoutine || !pickingForStepId) return;
    await DB.RoutineCustomizations.setProductForStep(editingRoutine, pickingForStepId, productId);
    closeProductPicker();

    // Refresh merged steps
    editSteps = await DB.RoutineCustomizations.getMergedSteps(editingRoutine, allProducts);
    renderStepList();
    App.showSnackbar(productId ? 'Product assigned' : 'Assignment removed');
  }

  // ── Add custom step ────────────────────────────────────────────────────────

  async function addCustomStep() {
    const input = document.getElementById('new-step-input');
    const name  = input?.value?.trim();
    if (!name) { input?.focus(); return; }
    await DB.RoutineCustomizations.addExtraStep(editingRoutine, name);
    input.value = '';
    editSteps = await DB.RoutineCustomizations.getMergedSteps(editingRoutine, allProducts);
    renderStepList();
    App.showSnackbar('Step added');
  }

  async function removeCustomStep(stepId) {
    if (!editingRoutine) return;
    await DB.RoutineCustomizations.removeExtraStep(editingRoutine, stepId);
    editSteps = await DB.RoutineCustomizations.getMergedSteps(editingRoutine, allProducts);
    renderStepList();
    App.showSnackbar('Step removed');
  }

  // ── Inject sheets (once) ───────────────────────────────────────────────────

  function injectSheetsIfNeeded() {
    if (document.getElementById('schedule-sheet')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <!-- Night-type picker -->
      <div class="sheet-overlay" id="schedule-overlay" onclick="ScheduleScreen.closePicker()"></div>
      <div class="bottom-sheet" id="schedule-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-content">
          <div class="sheet-title" id="schedule-sheet-title">Change night</div>
          <div id="schedule-options"></div>
        </div>
      </div>

      <!-- Step editor -->
      <div class="sheet-overlay" id="step-editor-overlay" onclick="ScheduleScreen.closeStepEditor()"></div>
      <div class="bottom-sheet" id="step-editor-sheet" style="max-height:92dvh;">
        <div class="sheet-handle"></div>
        <div class="sheet-content">
          <div class="sheet-title" id="step-editor-title">Edit steps</div>
          <div id="step-list"></div>
          <!-- Add custom step -->
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--md-sys-color-outline-variant);">
            <div class="field-label">Add a custom step</div>
            <div style="display:flex;gap:8px;margin-top:6px;">
              <input class="text-input" id="new-step-input" type="text"
                placeholder="e.g. Eye Cream"
                style="flex:1;"
                onkeydown="if(event.key==='Enter')ScheduleScreen.addCustomStep()">
              <button class="btn-tonal" onclick="ScheduleScreen.addCustomStep()"
                style="padding:12px 16px;min-height:52px;border-radius:var(--md-sys-shape-corner-medium);">
                Add
              </button>
            </div>
          </div>
          <button class="btn-text" onclick="ScheduleScreen.closeStepEditor()"
            style="margin-top:12px;width:100%;justify-content:center;">Done</button>
        </div>
      </div>

      <!-- Product picker -->
      <div class="sheet-overlay" id="product-picker-overlay" onclick="ScheduleScreen.closeProductPicker()"></div>
      <div class="bottom-sheet" id="product-picker-sheet" style="max-height:85dvh;z-index:102;">
        <div class="sheet-handle"></div>
        <div class="sheet-content">
          <div class="sheet-title" id="product-picker-title">Assign product</div>
          <div id="product-picker-list"></div>
          <button class="btn-text" onclick="ScheduleScreen.closeProductPicker()"
            style="margin-top:8px;width:100%;justify-content:center;">Cancel</button>
        </div>
      </div>
    `);

    // Product picker sheet needs higher z-index
    document.getElementById('product-picker-sheet').style.zIndex = '102';
    document.getElementById('product-picker-overlay').style.zIndex = '101';
  }

  async function init() {
    injectSheetsIfNeeded();
    await renderSchedule();
  }

  window.ScheduleScreen = {
    render: init,
    ensureSheets: injectSheetsIfNeeded,
    openPicker, closePicker, selectRoutine,
    openStepEditor, closeStepEditor,
    openProductPicker, closeProductPicker, assignProduct,
    addCustomStep, removeCustomStep
  };
})();
