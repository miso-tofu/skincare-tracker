(function () {

  const TAGS = ['Glowing', 'Calm', 'Dry', 'Oily', 'Sensitive', 'Breakout', 'Irritated', 'Tight', 'Hydrated', 'Dull'];

  let todayEntry = null;
  let selectedRating = 0;
  let selectedTags   = new Set();

  // ── Main render ────────────────────────────────────────────────────────────

  async function renderJournal() {
    const screen  = document.getElementById('screen-journal');
    const today   = DB.todayStr();
    const entries = await DB.Logs.getRecent(90);
    const pastEntries = entries.filter(l => l.session === 'JOURNAL' || (l.session === 'AM' && l.rating));

    // Load or init today's journal entry (separate session type)
    todayEntry = await DB.Logs.getSession(today, 'JOURNAL');
    selectedRating = todayEntry?.rating || 0;
    selectedTags   = new Set(todayEntry?.tags || []);

    const isPhotoWeek = shouldShowPhotoPrompt();

    screen.innerHTML = `
      ${isPhotoWeek ? photoPromptBanner() : ''}

      <!-- Today's entry card -->
      <div class="section-header" style="margin-top:4px;">
        <div class="section-title">Today</div>
        <div class="section-subtitle">${DB.formatDateLong(today)}</div>
      </div>

      <div class="card-elevated">
        <!-- Star rating -->
        <div class="field-label" style="margin-bottom:10px;">How's your skin today?</div>
        <div class="star-row" id="star-row">
          ${[1,2,3,4,5].map(n => `
            <button class="star-btn ${n <= selectedRating ? 'active' : ''}"
              onclick="JournalScreen.setRating(${n})"
              aria-label="${n} star">
              <span class="material-symbols-rounded ${n <= selectedRating ? 'filled' : ''}"
                style="font-size:36px;">star</span>
            </button>
          `).join('')}
        </div>
        ${selectedRating ? `<div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-top:4px;">${ratingLabel(selectedRating)}</div>` : ''}

        <div class="divider" style="margin:16px 0;"></div>

        <!-- Tags -->
        <div class="field-label" style="margin-bottom:10px;">Skin feels…</div>
        <div class="tag-row" id="tag-row">
          ${TAGS.map(tag => `
            <button class="tag-chip ${selectedTags.has(tag) ? 'selected' : ''}"
              onclick="JournalScreen.toggleTag('${tag}')">
              ${tag}
            </button>
          `).join('')}
        </div>

        <div class="divider" style="margin:16px 0;"></div>

        <!-- Notes -->
        <div class="field-label" style="margin-bottom:8px;">Notes</div>
        <textarea class="textarea-input" id="journal-notes"
          placeholder="How did your skin feel today? Any reactions, new products tried…"
          oninput="JournalScreen.onNotesInput()"
        >${todayEntry?.notes || ''}</textarea>

        <button class="btn-filled" onclick="JournalScreen.save()" style="margin-top:14px;">
          <span class="material-symbols-rounded" style="font-size:18px;">save</span>
          Save entry
        </button>
      </div>

      <!-- Past entries -->
      ${await pastEntriesHTML()}
    `;
  }

  // ── Past entries ───────────────────────────────────────────────────────────

  async function pastEntriesHTML() {
    const today   = DB.todayStr();
    const allLogs = await DB.Logs.getRecent(90);
    const journal = allLogs
      .filter(l => l.session === 'JOURNAL' && l.date !== today)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (journal.length === 0) return `
      <div class="section-header" style="margin-top:16px;">
        <div class="section-title">Past entries</div>
      </div>
      <div class="empty-state" style="padding:32px 0;">
        <span class="material-symbols-rounded">auto_stories</span>
        <p>Your entries will appear here</p>
      </div>
    `;

    return `
      <div class="section-header" style="margin-top:16px;">
        <div class="section-title">Past entries</div>
        <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">${journal.length} saved</div>
      </div>
      <div>
        ${journal.map(e => entryCard(e)).join('')}
      </div>
    `;
  }

  function entryCard(entry) {
    const tags  = entry.tags || [];
    const stars = [1,2,3,4,5].map(n =>
      `<span class="material-symbols-rounded ${n <= entry.rating ? 'filled' : ''}"
        style="font-size:16px;color:${n <= entry.rating ? 'var(--md-sys-color-warning)' : 'var(--md-sys-color-outline)'};">star</span>`
    ).join('');

    return `
      <div class="card" style="margin-bottom:10px;cursor:pointer;" onclick="JournalScreen.expandEntry(${entry.id})">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:var(--md-sys-typescale-label-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);">
            ${DB.formatDate(entry.date)}
          </div>
          <div style="display:flex;gap:1px;">${stars}</div>
        </div>
        ${tags.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:${entry.notes ? '8px' : '0'};">
            ${tags.map(t => `
              <span style="font-size:0.65rem;padding:2px 8px;border-radius:999px;
                background:var(--md-sys-color-secondary-container);
                color:var(--md-sys-color-on-secondary-container);">${t}</span>
            `).join('')}
          </div>
        ` : ''}
        ${entry.notes ? `
          <div style="font-size:var(--md-sys-typescale-body-size);color:var(--md-sys-color-on-surface-variant);
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${entry.notes}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Rating helpers ─────────────────────────────────────────────────────────

  function ratingLabel(n) {
    return ['', 'Rough day 😔', 'A bit meh 😐', 'Pretty good 🙂', 'Really good 😊', 'Glowing ✨'][n] || '';
  }

  function setRating(n) {
    // Tap same star again to deselect
    selectedRating = selectedRating === n ? 0 : n;
    const row = document.getElementById('star-row');
    if (!row) return;
    row.innerHTML = [1,2,3,4,5].map(i => `
      <button class="star-btn ${i <= selectedRating ? 'active' : ''}"
        onclick="JournalScreen.setRating(${i})"
        aria-label="${i} star">
        <span class="material-symbols-rounded ${i <= selectedRating ? 'filled' : ''}"
          style="font-size:36px;">star</span>
      </button>
    `).join('');
    // Update label below stars
    const labelEl = row.nextElementSibling;
    if (labelEl && labelEl.tagName === 'DIV') {
      labelEl.textContent = selectedRating ? ratingLabel(selectedRating) : '';
    }
  }

  // ── Tag toggle ─────────────────────────────────────────────────────────────

  function toggleTag(tag) {
    if (selectedTags.has(tag)) selectedTags.delete(tag);
    else selectedTags.add(tag);
    const row = document.getElementById('tag-row');
    if (!row) return;
    row.querySelectorAll('.tag-chip').forEach(btn => {
      btn.classList.toggle('selected', selectedTags.has(btn.textContent.trim()));
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    const notes = document.getElementById('journal-notes')?.value?.trim() || '';
    if (!selectedRating && !notes && selectedTags.size === 0) {
      App.showSnackbar('Add a rating, tag, or note first');
      return;
    }

    const entry = {
      date:            DB.todayStr(),
      session:         'JOURNAL',
      routine_type:    null,
      steps_completed: [],
      rating:          selectedRating || null,
      tags:            [...selectedTags],
      notes
    };
    if (todayEntry?.id) entry.id = todayEntry.id;

    const saved = await DB.Logs.save(entry);
    if (!todayEntry) todayEntry = entry;
    if (saved && !todayEntry.id) todayEntry.id = saved;

    App.showSnackbar('Entry saved ✓');
    // Refresh past entries section only
    const pastHTML = await pastEntriesHTML();
    const screen = document.getElementById('screen-journal');
    const existing = screen.querySelector('[data-past-entries]');
    if (existing) existing.outerHTML = `<div data-past-entries>${pastHTML}</div>`;
  }

  // Debounced auto-save on notes input
  let notesTimer = null;
  function onNotesInput() {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(save, 2000);
  }

  // ── Photo prompt ───────────────────────────────────────────────────────────

  function shouldShowPhotoPrompt() {
    return new Date().getDay() === 0; // Sunday
  }

  function photoPromptBanner() {
    return `
      <div style="background:linear-gradient(135deg,var(--md-sys-color-primary-container),var(--md-sys-color-secondary-container));
        border-radius:var(--md-sys-shape-corner-large);padding:16px;margin-bottom:16px;
        display:flex;align-items:center;gap:14px;">
        <span class="material-symbols-rounded filled" style="font-size:32px;color:var(--md-sys-color-on-primary-container);">photo_camera</span>
        <div>
          <div style="font-size:var(--md-sys-typescale-body-size);font-weight:600;color:var(--md-sys-color-on-primary-container);">
            Weekly progress photo
          </div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-primary-container);opacity:0.8;margin-top:2px;">
            Same lighting, same angle — great for tracking changes over time
          </div>
        </div>
      </div>
    `;
  }

  // ── Expand/edit past entry ─────────────────────────────────────────────────

  async function expandEntry(id) {
    const entry = await DB.Logs.getAll().then(all => all.find(l => l.id === id));
    if (!entry) return;

    // Inject a simple view sheet
    let sheet = document.getElementById('journal-entry-sheet');
    if (!sheet) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="sheet-overlay" id="journal-entry-overlay" onclick="JournalScreen.closeEntry()"></div>
        <div class="bottom-sheet" id="journal-entry-sheet" style="max-height:85dvh;">
          <div class="sheet-handle"></div>
          <div class="sheet-content" id="journal-entry-content"></div>
        </div>
      `);
      sheet = document.getElementById('journal-entry-sheet');
    }

    const stars = [1,2,3,4,5].map(n =>
      `<span class="material-symbols-rounded ${n <= (entry.rating||0) ? 'filled' : ''}"
        style="font-size:22px;color:${n <= (entry.rating||0) ? 'var(--md-sys-color-warning)' : 'var(--md-sys-color-outline)'};">star</span>`
    ).join('');

    document.getElementById('journal-entry-content').innerHTML = `
      <div style="font-size:var(--md-sys-typescale-label-size);font-weight:600;
        color:var(--md-sys-color-on-surface-variant);margin-bottom:12px;">
        ${DB.formatDateLong(entry.date)}
      </div>
      <div style="display:flex;gap:2px;margin-bottom:${entry.rating ? '6px' : '0'}">${stars}</div>
      ${entry.rating ? `<div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-bottom:14px;">${ratingLabel(entry.rating)}</div>` : ''}
      ${(entry.tags||[]).length ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          ${(entry.tags||[]).map(t => `
            <span style="font-size:var(--md-sys-typescale-label-size);padding:4px 12px;
              border-radius:999px;background:var(--md-sys-color-secondary-container);
              color:var(--md-sys-color-on-secondary-container);">${t}</span>
          `).join('')}
        </div>
      ` : ''}
      ${entry.notes ? `
        <div style="font-size:var(--md-sys-typescale-body-size);color:var(--md-sys-color-on-surface);
          line-height:1.6;margin-bottom:16px;">${entry.notes}</div>
      ` : ''}
      <div style="display:flex;gap:10px;">
        <button class="btn-text" onclick="JournalScreen.deleteEntry(${entry.id})"
          style="color:var(--md-sys-color-error);">
          <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
          Delete
        </button>
        <div style="flex:1;"></div>
        <button class="btn-tonal" onclick="JournalScreen.closeEntry()">Close</button>
      </div>
    `;

    document.getElementById('journal-entry-overlay').classList.add('visible');
    sheet.classList.add('visible');
  }

  function closeEntry() {
    document.getElementById('journal-entry-overlay')?.classList.remove('visible');
    document.getElementById('journal-entry-sheet')?.classList.remove('visible');
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    await DB.Logs.delete(id);
    closeEntry();
    App.showSnackbar('Entry deleted');
    renderJournal();
  }

  window.JournalScreen = {
    render: renderJournal,
    setRating, toggleTag, save, onNotesInput,
    expandEntry, closeEntry, deleteEntry
  };
})();
