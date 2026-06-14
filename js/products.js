(function () {

  const CATEGORIES = ['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'SPF', 'Eye cream', 'Mask', 'Exfoliant', 'Retinol', 'Lip', 'Other'];

  const CATEGORY_ICONS = {
    'Cleanser':    'water_drop',
    'Toner':       'opacity',
    'Serum':       'colorize',
    'Moisturizer': 'spa',
    'SPF':         'wb_sunny',
    'Eye cream':   'visibility',
    'Mask':        'face',
    'Exfoliant':   'bubble_chart',
    'Retinol':     'bedtime',
    'Lip':         'favorite',
    'Other':       'science'
  };

  let editingId = null; // null = adding new

  // ── Main render ────────────────────────────────────────────────────────────

  async function renderProducts() {
    const screen = document.getElementById('screen-products');
    const all    = await DB.Products.getAll();

    // Sort: expired first, then by expiry date, then no-expiry alphabetically
    const today = DB.todayStr();
    all.sort((a, b) => {
      const aExp = a.expiry || 'z';
      const bExp = b.expiry || 'z';
      return aExp.localeCompare(bExp);
    });

    const alertItems = all.filter(p => p.expiry);
    const expiring   = alertItems.filter(p => p.expiry > today && daysDiff(today, p.expiry) <= 30);
    const expired    = alertItems.filter(p => p.expiry <= today);

    screen.innerHTML = `
      ${(expired.length || expiring.length) ? `
        <div class="card" style="border:1.5px solid var(--md-sys-color-error-container);margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span class="material-symbols-rounded filled" style="color:var(--md-sys-color-error);font-size:20px">warning</span>
            <span style="font-size:var(--md-sys-typescale-label-size);font-weight:600;color:var(--md-sys-color-error);text-transform:uppercase;letter-spacing:0.06em;">
              Attention needed
            </span>
          </div>
          ${expired.map(p => alertRow(p, 'expired')).join('')}
          ${expiring.map(p => alertRow(p, 'warn')).join('')}
        </div>
      ` : ''}

      ${all.length === 0 ? `
        <div class="empty-state">
          <span class="material-symbols-rounded">science</span>
          <p>No products yet</p>
          <p style="font-size:var(--md-sys-typescale-label-size);">Tap + to add your first product</p>
        </div>
      ` : `
        <div class="section-header" style="margin-top:4px;">
          <div class="section-title">All products</div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">${all.length} item${all.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="card" style="padding:0 16px;">
          ${all.map(p => productRow(p, today)).join('')}
        </div>
      `}
    `;

    // Re-attach FAB listener each render
    const fab = document.getElementById('products-fab');
    if (fab) fab.onclick = () => openSheet(null);
  }

  function daysDiff(from, to) {
    return Math.round((new Date(to) - new Date(from)) / 86400000);
  }

  function expiryLabel(p, today) {
    if (!p.expiry) return '';
    if (p.expiry <= today) return `<span class="badge-expired">Expired</span>`;
    const d = daysDiff(today, p.expiry);
    if (d <= 30) return `<span class="badge-warn">Exp. in ${d}d</span>`;
    return `<span style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">Exp. ${DB.formatDate(p.expiry)}</span>`;
  }

  function alertRow(p, type) {
    const icon  = type === 'expired' ? 'error' : 'schedule';
    const color = type === 'expired' ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-warning)';
    const label = type === 'expired' ? 'Expired' : `${daysDiff(DB.todayStr(), p.expiry)}d left`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--md-sys-color-outline-variant);"
           onclick="ProductsScreen.edit(${p.id})">
        <span class="material-symbols-rounded filled" style="color:${color};font-size:18px;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--md-sys-typescale-body-size);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);">${p.brand || p.category}</div>
        </div>
        <span style="font-size:var(--md-sys-typescale-label-size);color:${color};font-weight:600;">${label}</span>
      </div>
    `;
  }

  function productRow(p, today) {
    const icon = CATEGORY_ICONS[p.category] || 'science';
    return `
      <div class="product-item" onclick="ProductsScreen.edit(${p.id})">
        <div class="product-icon">
          <span class="material-symbols-rounded" style="font-size:20px;">${icon}</span>
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-brand">${[p.brand, p.category].filter(Boolean).join(' · ')}</div>
        </div>
        ${expiryLabel(p, today)}
        <span class="material-symbols-rounded" style="color:var(--md-sys-color-outline);font-size:20px;margin-left:4px;">chevron_right</span>
      </div>
    `;
  }

  // ── Bottom sheet ───────────────────────────────────────────────────────────

  function openSheet(product) {
    editingId = product ? product.id : null;

    const overlay = document.getElementById('sheet-overlay');
    const sheet   = document.getElementById('product-sheet');

    // Populate form
    document.getElementById('field-name').value     = product?.name     || '';
    document.getElementById('field-brand').value    = product?.brand    || '';
    document.getElementById('field-category').value = product?.category || CATEGORIES[0];
    document.getElementById('field-opened').value   = product?.date_opened || '';
    document.getElementById('field-pao').value      = product?.pao      || '';
    document.getElementById('field-expiry').value   = product?.expiry   || '';
    document.getElementById('sheet-title').textContent = product ? 'Edit product' : 'Add product';
    document.getElementById('btn-delete').style.display = product ? 'flex' : 'none';

    overlay.classList.add('visible');
    sheet.classList.add('visible');
    setTimeout(() => document.getElementById('field-name').focus(), 300);
  }

  function closeSheet() {
    document.getElementById('sheet-overlay').classList.remove('visible');
    document.getElementById('product-sheet').classList.remove('visible');
    editingId = null;
  }

  async function saveProduct() {
    const name = document.getElementById('field-name').value.trim();
    if (!name) {
      document.getElementById('field-name').focus();
      App.showSnackbar('Product name is required');
      return;
    }

    const pao     = document.getElementById('field-pao').value;
    const opened  = document.getElementById('field-opened').value;
    let   expiry  = document.getElementById('field-expiry').value;

    // Auto-compute expiry from opened + PAO if not manually set
    if (!expiry && opened && pao) {
      expiry = DB.Products.computeExpiry(opened, pao) || '';
    }

    const product = {
      name,
      brand:       document.getElementById('field-brand').value.trim(),
      category:    document.getElementById('field-category').value,
      date_opened: opened,
      pao:         pao ? parseInt(pao) : null,
      expiry
    };

    if (editingId) product.id = editingId;

    await DB.Products.save(product);
    closeSheet();
    App.showSnackbar(editingId ? 'Product updated' : 'Product added');
    renderProducts();
  }

  async function deleteProduct() {
    if (!editingId) return;
    if (!confirm('Delete this product?')) return;
    await DB.Products.delete(editingId);
    closeSheet();
    App.showSnackbar('Product deleted');
    renderProducts();
  }

  // Auto-fill expiry when PAO + opened are both set
  function onPaoOrOpenedChange() {
    const pao    = document.getElementById('field-pao').value;
    const opened = document.getElementById('field-opened').value;
    const manual = document.getElementById('field-expiry').value;
    if (pao && opened && !manual) {
      const computed = DB.Products.computeExpiry(opened, pao);
      if (computed) document.getElementById('field-expiry').value = computed;
    }
  }

  // ── Inject sheet HTML into page (once) ────────────────────────────────────

  function injectSheetIfNeeded() {
    if (document.getElementById('product-sheet')) return;

    const catOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

    const html = `
      <div class="sheet-overlay" id="sheet-overlay" onclick="ProductsScreen.closeSheet()"></div>
      <div class="bottom-sheet" id="product-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-content">
          <div class="sheet-title" id="sheet-title">Add product</div>

          <div class="field-group">
            <label class="field-label">Name *</label>
            <input class="text-input" id="field-name" type="text" placeholder="e.g. Barrier Cream" autocomplete="off">
          </div>
          <div class="field-group">
            <label class="field-label">Brand</label>
            <input class="text-input" id="field-brand" type="text" placeholder="e.g. La Roche-Posay" autocomplete="off">
          </div>
          <div class="field-group">
            <label class="field-label">Category</label>
            <select class="select-input" id="field-category">${catOptions}</select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="field-group" style="margin-bottom:0;">
              <label class="field-label">Date opened</label>
              <input class="text-input" id="field-opened" type="date" onchange="ProductsScreen.onPaoChange()">
            </div>
            <div class="field-group" style="margin-bottom:0;">
              <label class="field-label">PAO (months)</label>
              <input class="text-input" id="field-pao" type="number" min="1" max="60" placeholder="12" onchange="ProductsScreen.onPaoChange()">
            </div>
          </div>
          <div style="font-size:var(--md-sys-typescale-label-size);color:var(--md-sys-color-on-surface-variant);margin:6px 0 16px;padding:0 2px;">
            PAO = Period After Opening. Expiry auto-fills from these two fields.
          </div>

          <div class="field-group">
            <label class="field-label">Expiry date (override)</label>
            <input class="text-input" id="field-expiry" type="date">
          </div>

          <div style="display:flex;gap:10px;margin-top:8px;">
            <button class="btn-filled" onclick="ProductsScreen.save()" style="flex:1;">Save</button>
            <button class="btn-tonal" onclick="ProductsScreen.closeSheet()">Cancel</button>
          </div>
          <button class="btn-text" id="btn-delete"
            onclick="ProductsScreen.deleteProduct()"
            style="display:none;color:var(--md-sys-color-error);margin-top:4px;width:100%;justify-content:center;">
            <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
            Delete product
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── FAB injection ──────────────────────────────────────────────────────────

  function injectFabIfNeeded() {
    if (document.getElementById('products-fab')) return;
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.id        = 'products-fab';
    fab.setAttribute('aria-label', 'Add product');
    fab.innerHTML = `<span class="material-symbols-rounded" style="font-size:28px;">add</span>`;
    fab.onclick   = () => openSheet(null);
    document.getElementById('app').appendChild(fab);
  }

  // Show/hide FAB based on active screen
  function syncFab() {
    const fab = document.getElementById('products-fab');
    if (!fab) return;
    const active = document.querySelector('.screen.active')?.id;
    fab.style.display = active === 'screen-products' ? 'flex' : 'none';
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    injectSheetIfNeeded();
    injectFabIfNeeded();
    syncFab();
    await renderProducts();
  }

  // Patch App.navigate to sync FAB visibility
  const _origNavigate = window.App?.navigate;
  if (_origNavigate) {
    window.App.navigate = function(id) {
      _origNavigate(id);
      syncFab();
    };
  }

  window.ProductsScreen = {
    render:        init,
    edit:          async id => { const p = await DB.Products.get(id); openSheet(p); },
    closeSheet,
    save:          saveProduct,
    deleteProduct,
    onPaoChange:   onPaoOrOpenedChange
  };
})();
