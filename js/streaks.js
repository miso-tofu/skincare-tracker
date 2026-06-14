(function () {

  async function renderStreaks() {
    const screen = document.getElementById('screen-streaks');
    screen.innerHTML = `<div style="color:var(--md-sys-color-on-surface-variant);padding:32px;text-align:center;">Loading…</div>`;

    const [routineStreak, spfStreak, retinolCount, recentLogs, weekSessions] =
      await Promise.all([
        DB.Streaks.getRoutineStreak(),
        DB.Streaks.getSpfStreak(),
        DB.Streaks.getWeeklyRetinolCount(),
        DB.Logs.getRecent(28),
        getThisWeekSessions()
      ]);

    screen.innerHTML = `
      <!-- Streak cards -->
      <div class="section-header" style="margin-top:4px;">
        <div class="section-title">Streaks</div>
      </div>

      <div class="streak-grid">
        ${streakCard(routineStreak, 'Routine days', 'local_fire_department', routineStreak > 0)}
        ${streakCard(spfStreak, 'SPF days', 'wb_sunny', spfStreak > 0)}
      </div>

      <!-- Retinol weekly count -->
      <div class="card" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="
          width:56px;height:56px;border-radius:var(--md-sys-shape-corner-large);
          background:var(--md-sys-color-primary-container);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span class="material-symbols-rounded filled" style="font-size:28px;color:var(--md-sys-color-on-primary-container);">bedtime</span>
        </div>
        <div style="flex:1;">
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">This week</div>
          <div style="font-size:var(--md-sys-typescale-title-size);font-weight:500;">
            Retinol ${retinolCount} / 2
          </div>
          <div style="margin-top:6px;">${retinolPips(retinolCount)}</div>
        </div>
      </div>

      <!-- This week sessions -->
      <div class="section-header">
        <div class="section-title">This week</div>
      </div>
      <div class="card" style="padding:12px 16px;">
        ${weekGrid(weekSessions)}
      </div>

      <!-- Last 4 weeks heatmap -->
      <div class="section-header" style="margin-top:8px;">
        <div class="section-title">Last 28 days</div>
      </div>
      <div class="card">
        ${heatmap(recentLogs)}
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
          ${heatmapLegend()}
        </div>
      </div>
    `;
  }

  // ── Streak card ────────────────────────────────────────────────────────────

  function streakCard(count, label, icon, active) {
    const color = active
      ? 'var(--md-sys-color-primary)'
      : 'var(--md-sys-color-on-surface-variant)';
    return `
      <div class="streak-card">
        <span class="material-symbols-rounded ${active ? 'filled' : ''}"
          style="font-size:28px;color:${color};margin-bottom:4px;">${icon}</span>
        <div class="streak-number" style="color:${color};">${count}</div>
        <div class="streak-label">${label}</div>
        ${count > 0 ? `<div style="font-size:0.65rem;color:var(--md-sys-color-on-surface-variant);margin-top:2px;">
          ${count === 1 ? 'day' : 'days'} in a row
        </div>` : `<div style="font-size:0.65rem;color:var(--md-sys-color-outline);margin-top:2px;">Start today!</div>`}
      </div>
    `;
  }

  // ── Retinol pips (2 targets per week) ────────────────────────────────────

  function retinolPips(count) {
    return [0, 1].map(i => `
      <span style="display:inline-block;width:28px;height:6px;border-radius:3px;margin-right:4px;
        background:${i < count
          ? 'var(--md-sys-color-primary)'
          : 'var(--md-sys-color-surface-container-highest)'};"></span>
    `).join('');
  }

  // ── This-week session grid ─────────────────────────────────────────────────

  async function getThisWeekSessions() {
    // Returns map of dateStr → { am, pm }
    const today = new Date();
    const dow   = today.getDay(); // 0=Sun
    const days  = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - dow + i); // Sun … Sat
      days.push(d.toISOString().split('T')[0]);
    }
    const logs = await DB.Logs.getRecent(8);
    const byDate = {};
    for (const l of logs) {
      if (!byDate[l.date]) byDate[l.date] = { am: false, pm: false };
      if (l.session === 'AM') byDate[l.date].am = true;
      if (l.session === 'PM') byDate[l.date].pm = true;
    }
    return days.map(d => ({ date: d, ...( byDate[d] || { am: false, pm: false }) }));
  }

  function weekGrid(sessions) {
    const todayStr = DB.todayStr();
    return `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">
        ${sessions.map(s => {
          const isToday  = s.date === todayStr;
          const isFuture = s.date > todayStr;
          const both = s.am && s.pm;
          const partial = (s.am || s.pm) && !both;
          const dow = new Date(s.date + 'T00:00:00').getDay();
          const dayName = DB.DAY_NAMES[dow];
          const bg = isToday
            ? 'var(--md-sys-color-primary-container)'
            : both    ? 'var(--md-sys-color-surface-container-highest)'
            : 'var(--md-sys-color-surface-container)';
          return `
            <div style="
              border-radius:var(--md-sys-shape-corner-medium);
              background:${bg};
              padding:8px 2px;
              opacity:${isFuture ? '0.35' : '1'};
            ">
              <div style="font-size:0.6rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;
                color:${isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'};">
                ${dayName}
              </div>
              <div style="margin-top:6px;display:flex;flex-direction:column;align-items:center;gap:3px;">
                <span style="font-size:11px;">${s.am ? '☀️' : isFuture ? '·' : '○'}</span>
                <span style="font-size:11px;">${s.pm ? '🌙' : isFuture ? '·' : '○'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── 28-day heatmap ─────────────────────────────────────────────────────────

  function heatmap(logs) {
    const today = new Date();
    const byDate = {};
    for (const l of logs) {
      if (!byDate[l.date]) byDate[l.date] = { am: false, pm: false };
      if (l.session === 'AM') byDate[l.date].am = true;
      if (l.session === 'PM') byDate[l.date].pm = true;
    }

    // Build 28 days newest → oldest, then display oldest → newest
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const s   = byDate[key] || { am: false, pm: false };
      days.push({ key, am: s.am, pm: s.pm, isFuture: key > DB.todayStr() });
    }

    // Render as 4 rows of 7
    const weeks = [days.slice(0,7), days.slice(7,14), days.slice(14,21), days.slice(21,28)];
    return `
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${weeks.map(week => `
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
            ${week.map(d => {
              const both    = d.am && d.pm;
              const partial = (d.am || d.pm) && !both;
              const bg = both    ? 'var(--md-sys-color-primary)'
                       : partial ? 'var(--md-sys-color-primary-container)'
                       : 'var(--md-sys-color-surface-container-highest)';
              return `<div style="
                height:28px;
                border-radius:6px;
                background:${bg};
                opacity:${d.isFuture ? 0.2 : 1};
              " title="${d.key}"></div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function heatmapLegend() {
    const items = [
      { bg: 'var(--md-sys-color-surface-container-highest)', label: 'None' },
      { bg: 'var(--md-sys-color-primary-container)',         label: 'Partial' },
      { bg: 'var(--md-sys-color-primary)',                   label: 'Full day' }
    ];
    return items.map(i => `
      <div style="display:flex;align-items:center;gap:4px;">
        <div style="width:14px;height:14px;border-radius:3px;background:${i.bg};flex-shrink:0;"></div>
        <span style="font-size:0.65rem;color:var(--md-sys-color-on-surface-variant);">${i.label}</span>
      </div>
    `).join('<div style="width:8px;"></div>');
  }

  window.StreaksScreen = { render: renderStreaks };
})();
