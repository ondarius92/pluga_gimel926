let state = {
  soldiers: [],
  assignments: [],
  schedule: {},
  leaves: [],
  history: {},
  order: {}
};

let _ec = 1;
function eid() { return 'e' + (++_ec) + Date.now(); }

function loadState() {
  try {
    const h = window.location.hash.slice(1);
    if (h) {
      const d = JSON.parse(decodeURIComponent(atob(h)));
      if (d && d.soldiers && d.soldiers.length) {
        state = d; fixState(); mergeDefaults(); return;
      }
    }
  } catch(e) {}

  try {
    const raw = localStorage.getItem('shabatzak12');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.soldiers && d.soldiers.length) {
        state = d; fixState(); mergeDefaults(); save(); return;
      }
    }
  } catch(e) {}

  mergeDefaults();
  applyDefaultAssignments();
  save();
}

function fixState() {
  if (!state.schedule)    state.schedule    = {};
  if (!state.assignments) state.assignments = [];
  if (!state.history)     state.history     = {};
  if (!state.order)       state.order       = {};
  if (!state.leaves)      state.leaves      = [];
  _ec = (state.assignments || []).length + 2;

  // Migration: דניאל (חופלת) → דניאל לוי
  state.soldiers.forEach(s => {
    if (s.name === 'דניאל' && s.rank === 'חופלת') {
      if (state.history[s.name]) {
        state.history['דניאל לוי'] = state.history[s.name];
        delete state.history[s.name];
      }
      s.name = 'דניאל לוי';
    }
  });
}

function mergeDefaults() {
  state.soldiers = state.soldiers.filter(s => !BANNED_NAMES.includes(s.name));
  state.assignments = state.assignments.filter(a => {
    const s = state.soldiers.find(x => x.id === a.sid);
    return s && !BANNED_NAMES.includes(s.name);
  });

  DEFAULT_SOLDIERS.forEach(ds => {
    if (BANNED_NAMES.includes(ds.name)) return;
    if (!state.soldiers.find(s => s.id === ds.id || s.name === ds.name)) {
      state.soldiers.push({ id: ds.id, name: ds.name, rank: ds.rank });
      ensureHist(ds.name);
    }
  });

  if (!state.assignments || state.assignments.length === 0) {
    applyDefaultAssignments();
  }
}

function applyDefaultAssignments() {
  DEFAULT_ASSIGNMENTS.forEach(def => {
    if (BANNED_NAMES.includes(def.name)) return;
    const s = state.soldiers.find(x => x.name === def.name);
    if (s && !state.assignments.find(a => a.sid === s.id && a.role === def.role)) {
      state.assignments.push({ id: eid(), sid: s.id, role: def.role });
    }
  });
}

function ensureHist(name) {
  if (!state.history[name]) state.history[name] = { total: 0, shagaShifts: 0 };
}

function save() {
  try { localStorage.setItem('shabatzak12', JSON.stringify(state)); } catch(e) {}
  try {
    const clean = state.soldiers.filter(s => !BANNED_NAMES.includes(s.name));
    localStorage.setItem('shabatzak_soldiers', JSON.stringify(clean));
  } catch(e) {}
}
