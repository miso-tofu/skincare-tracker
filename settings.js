(function () {

  // ── Sheet inject ────────────────────────────────────────────────────────────

  function injectIfNeeded() {
    if (document.getElementById('settings-sheet')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="sheet-overlay" id="settings-overlay" onclick="AppSettings.close()"></div>
      <div class="bottom-sheet" id="settings-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-content">
          <div class="sheet-title">Settings</div>

          <!-- Export -->
          <div style="margin-bottom:20px;">
            <div style="font-size:var(--md-sys-typescale-label-size);font-weight:600;
              text-transform:uppercase;letter-spacing:0.06em;
              color:var(--md-sys-color-on-surface-variant);margin-bottom:10px;">
              Backup & Restore
            </div>
            <button class="btn-tonal" onclick="AppSettings.exportData()" style="width:100%;justify-content:center;margin-bottom:10px;">
              <span class="material-symbols-rounded" style="font-size:18px;">download</span>
              Export all data
            </button>
            <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-bottom:14px;padding:0 4px;">
              Downloads a <code style="background:var(--md-sys-color-surface-container-highest);padding:1px 5px;border-radius:4px;">.json</code>
              file with all your products, logs, journal entries, schedule and routine customisations.
              Upload it to Google Drive to keep a backup or transfer to another device.
            </div>

            <button class="btn-tonal" onclick="AppSettings.triggerImport()" style="width:100%;justify-content:center;">
              <span class="material-symbols-rounded" style="font-size:18px;">upload</span>
              Import from backup
            </button>
            <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin-top:6px;padding:0 4px;">
              Merges the backup into your current data. Existing entries are not deleted.
            </div>
            <input type="file" id="import-file-input" accept=".json"
              style="display:none;" onchange="AppSettings.importData(event)">
          </div>

          <div class="divider"></div>

          <!-- About -->
          <div style="margin-top:16px;font-size:var(--md-sys-typescale-label-size);
            color:var(--md-sys-color-on-surface-variant);text-align:center;line-height:1.8;">
            Skincare Tracker · Local-first PWA<br>
            All data stays on your device
          </div>

          <button class="btn-text" onclick="AppSettings.close()"
            style="width:100%;justify-content:center;margin-top:12px;">
            Close
          </button>
        </div>
      </div>
    `);
  }

  // ── Open / close ───────────────────────────────────────────────────────────

  function open() {
    injectIfNeeded();
    document.getElementById('settings-overlay').classList.add('visible');
    document.getElementById('settings-sheet').classList.add('visible');
  }

  function close() {
    document.getElementById('settings-overlay')?.classList.remove('visible');
    document.getElementById('settings-sheet')?.classList.remove('visible');
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async function exportData() {
    try {
      const [products, logs, schedule, customizations] = await Promise.all([
        DB.Products.getAll(),
        DB.Logs.getAll(),
        DB.Schedule.getAll(),
        Promise.all(
          ['morning','retinol','exfoliant','reedle','rest'].map(async rt => {
            const data = await DB.RoutineCustomizations.get(rt);
            return data;
          })
        )
      ]);

      const backup = {
        version:    2,
        exportedAt: new Date().toISOString(),
        products,
        logs,
        schedule,
        routine_customizations: customizations.filter(c =>
          Object.keys(c.product_assignments || {}).length > 0 ||
          (c.extra_steps || []).length > 0
        )
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href     = url;
      a.download = `skincare-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);

      App.showSnackbar('Backup downloaded ✓');
    } catch (e) {
      console.error(e);
      App.showSnackbar('Export failed — try again');
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  function triggerImport() {
    document.getElementById('import-file-input')?.click();
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text   = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.exportedAt) {
        App.showSnackbar('Invalid backup file');
        return;
      }

      let imported = { products: 0, logs: 0 };

      // Import products (skip duplicates by name+brand)
      if (Array.isArray(backup.products)) {
        const existing = await DB.Products.getAll();
        const existingKeys = new Set(existing.map(p => `${p.name}||${p.brand}`));
        for (const p of backup.products) {
          const key = `${p.name}||${p.brand}`;
          if (!existingKeys.has(key)) {
            const { id: _, ...rest } = p; // strip old id so DB auto-assigns new one
            await DB.Products.save(rest);
            imported.products++;
          }
        }
      }

      // Import logs (skip duplicates by date+session)
      if (Array.isArray(backup.logs)) {
        const existing  = await DB.Logs.getAll();
        const existingKeys = new Set(existing.map(l => `${l.date}||${l.session}`));
        for (const l of backup.logs) {
          const key = `${l.date}||${l.session}`;
          if (!existingKeys.has(key)) {
            const { id: _, ...rest } = l;
            await DB.Logs.save(rest);
            imported.logs++;
          }
        }
      }

      // Import schedule (overwrite)
      if (Array.isArray(backup.schedule)) {
        for (const s of backup.schedule) {
          await DB.Schedule.setDay(s.day, s.routine_type);
        }
      }

      // Import routine customizations (overwrite)
      if (Array.isArray(backup.routine_customizations)) {
        for (const c of backup.routine_customizations) {
          await DB.RoutineCustomizations.save(c);
        }
      }

      close();
      App.showSnackbar(`Imported ${imported.products} products, ${imported.logs} log entries ✓`);

      // Refresh current screen
      const active = document.querySelector('.screen.active')?.id?.replace('screen-', '');
      if (active) App.navigate(active);

    } catch (e) {
      console.error(e);
      App.showSnackbar('Import failed — check the file and try again');
    }

    // Reset file input so same file can be re-imported if needed
    event.target.value = '';
  }

  window.AppSettings = { open, close, exportData, triggerImport, importData };
})();
