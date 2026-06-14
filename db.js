// ── IndexedDB schema + helpers ─────────────────────────────────────────────
const DB_NAME = 'SkincareDB';
const DB_VERSION = 2;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        const p = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        p.createIndex('category', 'category');
        p.createIndex('expiry', 'expiry');
      }
      if (!db.objectStoreNames.contains('logs')) {
        const l = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        l.createIndex('date', 'date');
        l.createIndex('date_session', ['date', 'session'], { unique: true });
      }
      if (!db.objectStoreNames.contains('schedule')) {
        db.createObjectStore('schedule', { keyPath: 'day' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v2: per-routine customisations (product assignments + custom steps)
      if (!db.objectStoreNames.contains('routine_customizations')) {
        db.createObjectStore('routine_customizations', { keyPath: 'routine_type' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}
function wrap(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}
function dbGetAll(store)       { return openDB().then(() => wrap(tx(store).getAll())); }
function dbGet(store, key)     { return openDB().then(() => wrap(tx(store).get(key))); }
function dbPut(store, value)   { return openDB().then(() => wrap(tx(store, 'readwrite').put(value))); }
function dbDel(store, key)     { return openDB().then(() => wrap(tx(store, 'readwrite').delete(key))); }
function dbIndex(store, idx, val) {
  return openDB().then(() => wrap(tx(store).index(idx).getAll(val)));
}

// ── Routine types & definitions ────────────────────────────────────────────
const RoutineType = {
  MORNING:   'morning',
  RETINOL:   'retinol',
  EXFOLIANT: 'exfoliant',
  REEDLE:    'reedle',
  REST:      'rest'
};

const ROUTINE_LABELS = {
  morning:   'Morning',
  retinol:   'Retinol Night',
  exfoliant: 'Exfoliant Night',
  reedle:    'Reedle Shot Night',
  rest:      'Rest Night'
};

const ROUTINES = {
  morning: [
    { id: 'cleanser',    name: 'Cleanser',     note: null },
    { id: 'tone',        name: 'Toner',        note: null },
    { id: 'vitc',        name: 'Vitamin C',    note: null },
    { id: 'moisturizer', name: 'Moisturizer',  note: null },
    { id: 'spf',         name: 'SPF',          note: 'Tracked separately', isSpf: true }
  ],
  retinol: [
    { id: 'cleanser',    name: 'Cleanser',     note: null },
    { id: 'tone',        name: 'Toner',        note: null },
    { id: 'retinol',     name: 'Retinol',      note: null },
    { id: 'moisturizer', name: 'Moisturizer',  note: null },
    { id: 'mask',        name: 'Barrier Mask', note: null },
    { id: 'lip',         name: 'Lip Mask',     note: null }
  ],
  exfoliant: [
    { id: 'cleanser',    name: 'Cleanser',     note: null },
    { id: 'aha',         name: 'AHA / BHA',    note: null },
    { id: 'moisturizer', name: 'Moisturizer',  note: null },
    { id: 'mask',        name: 'Barrier Mask', note: null },
    { id: 'lip',         name: 'Lip Mask',     note: null }
  ],
  reedle: [
    { id: 'cleanser',    name: 'Cleanser',     note: null },
    { id: 'reedle',      name: 'Reedle Shot',  note: 'Wait 3 min before next step', hasTimer: true },
    { id: 'tone',        name: 'Toner',        note: null },
    { id: 'moisturizer', name: 'Moisturizer',  note: null },
    { id: 'mask',        name: 'Overnight Mask', note: null },
    { id: 'lip',         name: 'Lip Mask',     note: null }
  ],
  rest: [
    { id: 'cleanser',    name: 'Cleanser',     note: null },
    { id: 'tone',        name: 'Toner',        note: null },
    { id: 'moisturizer', name: 'Moisturizer',  note: null },
    { id: 'mask',        name: 'Overnight Mask', note: null },
    { id: 'lip',         name: 'Lip Mask',     note: null }
  ]
};

// ── Default schedule (0=Sun … 6=Sat) ──────────────────────────────────────
const DEFAULT_SCHEDULE = [
  { day: 0, routine_type: 'rest' },
  { day: 1, routine_type: 'retinol' },
  { day: 2, routine_type: 'rest' },
  { day: 3, routine_type: 'exfoliant' },
  { day: 4, routine_type: 'rest' },
  { day: 5, routine_type: 'retinol' },
  { day: 6, routine_type: 'reedle' }
];

// ── Products API ───────────────────────────────────────────────────────────
const Products = {
  getAll: () => dbGetAll('products'),
  get:    id  => dbGet('products', id),
  save:   p   => dbPut('products', p),
  delete: id  => dbDel('products', id),
  getExpiring(days = 30) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const todayStr  = DB.todayStr();
    return dbGetAll('products').then(all =>
      all.filter(p => p.expiry && p.expiry <= cutoffStr)
         .map(p => ({ ...p, isExpired: p.expiry < todayStr }))
         .sort((a, b) => a.expiry.localeCompare(b.expiry))
    );
  },
  computeExpiry(dateOpened, paoMonths) {
    if (!dateOpened || !paoMonths) return null;
    const d = new Date(dateOpened);
    d.setMonth(d.getMonth() + parseInt(paoMonths));
    return d.toISOString().split('T')[0];
  }
};

// ── Logs API ───────────────────────────────────────────────────────────────
const Logs = {
  getAll:     () => dbGetAll('logs'),
  getByDate:  dt => dbIndex('logs', 'date', dt),
  async getSession(date, session) {
    const rows = await dbIndex('logs', 'date_session', [date, session]);
    return rows[0] || null;
  },
  save:   l  => dbPut('logs', l),
  delete: id => dbDel('logs', id),
  async getRecent(days = 30) {
    const all = await dbGetAll('logs');
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return all.filter(l => l.date >= cutoffStr).sort((a, b) => b.date.localeCompare(a.date));
  }
};

// ── Schedule API ───────────────────────────────────────────────────────────
const Schedule = {
  async getAll() {
    const rows = await dbGetAll('schedule');
    return rows.length ? rows : DEFAULT_SCHEDULE;
  },
  async getDay(day) {
    const row = await dbGet('schedule', day);
    return row || DEFAULT_SCHEDULE[day];
  },
  setDay: (day, type) => dbPut('schedule', { day, routine_type: type }),
  async seedDefaults() {
    const existing = await dbGetAll('schedule');
    if (existing.length === 0) {
      for (const e of DEFAULT_SCHEDULE) await dbPut('schedule', e);
    }
  }
};

// ── Settings API ───────────────────────────────────────────────────────────
const Settings = {
  get:  key         => dbGet('settings', key).then(r => r?.value ?? null),
  set:  (key, val)  => dbPut('settings', { key, value: val }),
  async getReminders() {
    return {
      am:  (await Settings.get('reminder_am'))  ?? '07:00',
      pm:  (await Settings.get('reminder_pm'))  ?? '21:00',
      spf: (await Settings.get('reminder_spf')) ?? '12:00'
    };
  }
};

// ── Streaks API ────────────────────────────────────────────────────────────
const Streaks = {
  async getRoutineStreak() {
    const logs = await Logs.getAll();
    const byDate = {};
    for (const l of logs) {
      if (!byDate[l.date]) byDate[l.date] = new Set();
      byDate[l.date].add(l.session);
    }
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      if (byDate[k]?.has('AM') && byDate[k]?.has('PM')) streak++;
      else break;
    }
    return streak;
  },
  async getSpfStreak() {
    const logs = await Logs.getRecent(90);
    const byDate = {};
    for (const l of logs.filter(l => l.session === 'AM')) byDate[l.date] = l.steps_completed || [];
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      if (byDate[k]?.includes('spf')) streak++;
      else break;
    }
    return streak;
  },
  async getWeeklyRetinolCount() {
    const logs = await Logs.getRecent(7);
    return logs.filter(l => l.session === 'PM' && l.routine_type === 'retinol').length;
  }
};

// ── Date helpers ───────────────────────────────────────────────────────────
const DAY_NAMES      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Routine customizations ─────────────────────────────────────────────────
// Stored as: { routine_type, product_assignments: { stepId: productId }, extra_steps: [{id, name, order}] }

const RoutineCustomizations = {
  async get(routineType) {
    const row = await dbGet('routine_customizations', routineType);
    return row || { routine_type: routineType, product_assignments: {}, extra_steps: [] };
  },

  save(data) {
    return dbPut('routine_customizations', data);
  },

  async setProductForStep(routineType, stepId, productId) {
    const data = await RoutineCustomizations.get(routineType);
    if (productId === null) {
      delete data.product_assignments[stepId];
    } else {
      data.product_assignments[stepId] = productId;
    }
    return RoutineCustomizations.save(data);
  },

  async addExtraStep(routineType, stepName) {
    const data = await RoutineCustomizations.get(routineType);
    const id   = 'custom_' + Date.now();
    const order = (data.extra_steps.length > 0
      ? Math.max(...data.extra_steps.map(s => s.order))
      : 100) + 1;
    data.extra_steps.push({ id, name: stepName, order });
    await RoutineCustomizations.save(data);
    return id;
  },

  async removeExtraStep(routineType, stepId) {
    const data = await RoutineCustomizations.get(routineType);
    data.extra_steps = data.extra_steps.filter(s => s.id !== stepId);
    return RoutineCustomizations.save(data);
  },

  /** Returns merged step list: default steps + custom steps, with product info injected */
  async getMergedSteps(routineType, allProducts) {
    const base   = ROUTINES[routineType] || [];
    const custom = await RoutineCustomizations.get(routineType);
    const prodMap = Object.fromEntries((allProducts || []).map(p => [p.id, p]));

    const defaultSteps = base.map(s => ({
      ...s,
      product: prodMap[custom.product_assignments[s.id]] || null
    }));

    const extraSteps = (custom.extra_steps || [])
      .sort((a, b) => a.order - b.order)
      .map(s => ({
        id:       s.id,
        name:     s.name,
        note:     null,
        isCustom: true,
        product:  prodMap[custom.product_assignments[s.id]] || null
      }));

    return [...defaultSteps, ...extraSteps];
  }
};

// ── Global namespace ───────────────────────────────────────────────────────
window.DB = {
  openDB, RoutineType, ROUTINE_LABELS, ROUTINES, DEFAULT_SCHEDULE,
  Products, Logs, Schedule, Settings, Streaks, RoutineCustomizations,
  DAY_NAMES, DAY_NAMES_FULL,
  todayStr:      () => new Date().toISOString().split('T')[0],
  dayOfWeek:     () => new Date().getDay(),
  formatDate:    s  => new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }),
  formatDateLong: s => new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })
};
