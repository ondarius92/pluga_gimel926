// ── FIREBASE CONFIG ──
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDMVqOwb8luxng-hSR4JKQ4EVM1cQ32aQ",
  authDomain: "plugagimel926-2b79a.firebaseapp.com",
  databaseURL: "https://plugagimel926-2b79a-default-rtdb.firebaseio.com",
  projectId: "plugagimel926-2b79a",
  storageBucket: "plugagimel926-2b79a.firebasestorage.app",
  messagingSenderId: "431224113453",
  appId: "1:431224113453:web:e9c6df756e45739877eba4"
};

let db = null;
let firebaseReady = false;
let syncTimeout = null;

function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    firebaseReady = true;

    db.ref('shabatzak/state').on('value', (snapshot) => {
      const remote = snapshot.val();
      if (!remote) return;
      if (remote._ts && remote._ts > (state._ts || 0)) {
        state = remote;
        fixState();
        renderAll();
        showSync('✅ מסונכרן');
      }
    });

    showSync('🔥 מחובר');
  } catch(e) {
    console.warn('Firebase error:', e);
    showSync('💾 מקומי');
  }
}

function showSync(msg) {
  const el = document.getElementById('sync-status');
  if (el) { el.textContent = msg; setTimeout(() => { if(el) el.textContent = ''; }, 3000); }
}

// ── STATE ──

let state = {
  soldiers: [],
  assignments: [],
  schedule: {},
  leaves: [],
  history: {},
  order: {},
  _ts: 0
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
  if (!state._ts)         state._ts         = 0;
  _ec = (state.assignments || []).length + 2;

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
  state._ts = Date.now();
  try { localStorage.setItem('shabatzak12', JSON.stringify(state)); } catch(e) {}
  try {
    const clean = state.soldiers.filter(s => !BANNED_NAMES.includes(s.name));
    localStorage.setItem('shabatzak_soldiers', JSON.stringify(clean));
  } catch(e) {}

  if (firebaseReady && db) {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      db.ref('shabatzak/state').set(state)
        .then(() => showSync('☁️ נשמר'))
        .catch(() => showSync('⚠️ שגיאה'));
    }, 1000);
  }
}
