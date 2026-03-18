// ── SOLDIERS ──

function addSoldier() {
  const name = document.getElementById('in-name').value.trim(); if (!name) return;
  const rank = document.getElementById('in-rank').value.trim();
  if (state.soldiers.find(s => s.name === name)) { alert('לוחם בשם זה כבר קיים.'); return; }
  pushUndo();
  const newId = String(Date.now());
  state.soldiers.push({ id: newId, name, rank });
  ensureHist(name);
  // הסר מרשימת המוסרים אם היה שם
  if (state.removedIds) state.removedIds = state.removedIds.filter(id => id !== newId);
  document.getElementById('in-name').value = '';
  document.getElementById('in-rank').value = '';
  document.getElementById('in-name').focus();
  save(); renderAll();
}

function removeSoldier(sid) {
  const s = state.soldiers.find(x => x.id === sid); if (!s) return;
  document.getElementById('modal-h').textContent = '🗑 הסרת לוחם';
  document.getElementById('modal-txt').textContent = `להסיר את ${s.name} מהשבצ"כ? אם יחזור — ניתן להוסיפו מחדש.`;
  document.getElementById('modal-confirm').onclick = () => {
    pushUndo();
    // שמור את ה-ID ברשימת המוסרים כדי שלא יחזור מ-DEFAULT_SOLDIERS
    if (!state.removedIds) state.removedIds = [];
    if (!state.removedIds.includes(sid)) state.removedIds.push(sid);
    state.soldiers    = state.soldiers.filter(x => x.id !== sid);
    state.assignments = state.assignments.filter(a => a.sid !== sid);
    state.leaves      = state.leaves.filter(l => l.sid !== sid);
    save(); closeModal(); renderAll();
  };
  document.getElementById('overlay').classList.add('open');
}

function openEditSoldier(sid) {
  const s = state.soldiers.find(x => x.id === sid); if (!s) return;
  document.getElementById('edit-sid').value  = sid;
  document.getElementById('edit-name').value = s.name;
  document.getElementById('edit-rank').value = s.rank || '';
  document.getElementById('edit-overlay').classList.add('open');
}

function closeEditModal() { document.getElementById('edit-overlay').classList.remove('open'); }

function saveEditSoldier() {
  const sid  = document.getElementById('edit-sid').value;
  const name = document.getElementById('edit-name').value.trim();
  const rank = document.getElementById('edit-rank').value.trim();
  if (!name) { alert('שם לא יכול להיות ריק'); return; }
  const s = state.soldiers.find(x => x.id === sid); if (!s) return;
  pushUndo();
  if (s.name !== name && state.history[s.name]) {
    state.history[name] = state.history[s.name];
    delete state.history[s.name];
  }
  s.name = name; s.rank = rank;
  save(); closeEditModal(); renderAll();
}

// ── ASSIGN ──

function assignSoldier() {
  const sid  = document.getElementById('in-soldier').value;
  const role = document.getElementById('in-pos').value;
  if (!sid) { alert('בחר לוחם'); return; }
  if (!warnIfOut(sid, ROLE_LABEL[role])) return;
  pushUndo();
  state.assignments.push({ id: eid(), sid, role });
  const s = state.soldiers.find(x => x.id === sid);
  if (s) {
    ensureHist(s.name);
    state.history[s.name][role] = (state.history[s.name][role] || 0) + 1;
    state.history[s.name].total = (state.history[s.name].total || 0) + 1;
  }
  save(); renderAll();
}

function unassignToFree(aid) {
  pushUndo();
  state.assignments = state.assignments.filter(a => a.id !== aid);
  save(); renderAll();
}

function autoFillShaga() {
  const air = state.soldiers.filter(s => state.assignments.filter(a => a.sid === s.id).length === 0);
  if (!air.length) { alert('אין לוחמים ללא שיבוץ'); return; }
  pushUndo();
  air.forEach(s => { state.assignments.push({ id: eid(), sid: s.id, role: 'shaga' }); ensureHist(s.name); });
  save(); renderAll();
  alert(`שובצו ${air.length} לוחמים לש"ג.`);
}

function clearAll() {
  if (!confirm('לנקות שיבוצים, לוז ויציאות?\nהלוחמים יישארו.')) return;
  pushUndo();
  state.assignments = []; state.schedule = {}; state.order = {}; state.leaves = [];
  applyDefaultAssignments();
  save(); renderAll();
}

// ── SCHEDULE ──

function onShagaChangeSafe(key, sel, dayIdx, isNight) {
  const prevVal = state.schedule[key] || '';
  const newVal  = sel.value;

  if (newVal === '__manual__') {
    state.schedule[key] = ''; save(); renderSchedInput();
    const inp = document.getElementById('mi_' + key);
    if (inp) inp.focus();
    return;
  }
  if (newVal === prevVal) return;

  if (newVal === '') {
    pushUndo();
    state.schedule[key] = '';
    save(); renderSchedInput();
    return;
  }

  if (prevVal !== '') {
    const s     = state.soldiers.find(x => x.id === newVal);
    const prevS = state.soldiers.find(x => x.id === prevVal);
    const name     = s     ? s.name     : '?';
    const prevName = prevS ? prevS.name : '—';
    const shiftLabel = key.replace('day_','יום ').replace('_shift_',' משמרת ');
    if (!confirm(`להחליף משמרת ${shiftLabel}?\nמ: ${prevName}\nל: ${name}`)) {
      sel.value = prevVal; return;
    }
  }

  const s = newVal ? state.soldiers.find(x => x.id === newVal) : null;
  if (s && isNight && dayIdx !== undefined) {
    if (isLeavingMorning(s.id, dayIdx)) {
      if (!confirm('⚠️ לוחם זה יוצא הבוקר. לשבץ בכל זאת?')) {
        sel.value = prevVal; return;
      }
    }
    const pts = key.split('_');
    const sh  = SHAGA_SHIFTS[parseInt(pts[3])];
    if (sh && isOnLeave(s.id, dayIdx, sh.h)) {
      if (!confirm('⛔ לוחם זה בחוץ. לשבץ בכל זאת?')) {
        sel.value = prevVal; return;
      }
    }
  }

  pushUndo();
  state.schedule[key] = newVal;
  save(); renderSchedInput();
}

// ── LEAVES ──

function addLeaveConfirmed() {
  const sid     = document.getElementById('leave-soldier').value;
  const outVal  = document.getElementById('leave-out').value;
  const backVal = document.getElementById('leave-back').value;
  if (!sid || !outVal || !backVal) { alert('מלא את כל השדות'); return; }
  if (new Date(backVal) <= new Date(outVal)) { alert('תאריך חזרה חייב להיות אחרי יציאה'); return; }
  const s = state.soldiers.find(x => x.id === sid);
  const name = s ? s.name : '?';
  if (!confirm(`להוסיף יציאה עבור ${name}?`)) return;
  pushUndo();
  state.leaves.push({ id: eid(), sid, outDate: outVal, backDate: backVal });
  save(); renderAll();
}

// ── MODALS ──

function closeModal() { document.getElementById('overlay').classList.remove('open'); }

// ── DRAG & DROP (output tables) ──

let _dragSrc = null;

function onDragStart(e) {
  _dragSrc = e.currentTarget;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  const r = e.currentTarget;
  if (r !== _dragSrc && r.dataset.role === _dragSrc?.dataset.role) r.classList.add('drag-over');
}
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function onDrop(e) {
  e.preventDefault();
  const target = e.currentTarget; target.classList.remove('drag-over');
  if (!_dragSrc || _dragSrc === target || _dragSrc.dataset.role !== target.dataset.role) return;
  pushUndo();
  const tbody = target.closest('tbody');
  const rows  = Array.from(tbody.querySelectorAll('tr'));
  const si = rows.indexOf(_dragSrc), ti = rows.indexOf(target);
  if (si < ti) target.after(_dragSrc); else target.before(_dragSrc);
  if (!state.order) state.order = {};
  state.order[target.dataset.role] = Array.from(tbody.querySelectorAll('tr')).map(r => r.dataset.sid);
  save();
}

// ── DRAG & DROP (schedule) ──

let _schedDragKey = null;

function onSchedDragStart(e, key) {
  _schedDragKey = key;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.4';
}
function onSchedDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onSchedDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onSchedDragEnd(e)   { e.currentTarget.style.opacity = '1'; }
function onSchedDrop(e, key) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  if (!_schedDragKey || _schedDragKey === key) return;

  const s1 = state.soldiers.find(x => x.id === state.schedule[_schedDragKey]);
  const s2 = state.soldiers.find(x => x.id === state.schedule[key]);
  const n1 = s1 ? s1.name : '—';
  const n2 = s2 ? s2.name : '—';

  if (!confirm(`להחליף משמרות?\n${n1} ↔ ${n2}`)) return;

  pushUndo();
  const tmp = state.schedule[_schedDragKey];
  state.schedule[_schedDragKey] = state.schedule[key] || '';
  state.schedule[key] = tmp || '';
  _schedDragKey = null; save(); renderSchedInput();
}

// ── INIT ──

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('out-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('edit-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEditModal();
  });
  loadState();
  initFirebase();
  renderAll();
  updateUndoBtn();
});
