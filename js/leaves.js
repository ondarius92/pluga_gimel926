function autoFillReturn() {
  const outVal = document.getElementById('leave-out').value;
  if (!outVal) return;
  const dur = parseInt(document.getElementById('leave-dur').value) || 48;
  const d = new Date(outVal);
  d.setHours(d.getHours() + dur);
  document.getElementById('leave-back').value = d.toISOString().slice(0, 16);
}

function addLeave() {
  const sid     = document.getElementById('leave-soldier').value;
  const outVal  = document.getElementById('leave-out').value;
  const backVal = document.getElementById('leave-back').value;
  if (!sid || !outVal || !backVal) { alert('מלא את כל השדות'); return; }
  if (new Date(backVal) <= new Date(outVal)) { alert('תאריך חזרה חייב להיות אחרי יציאה'); return; }
  state.leaves.push({ id: eid(), sid, outDate: outVal, backDate: backVal });
  save(); renderAll();
}

function removeLeave(lid) {
  state.leaves = state.leaves.filter(l => l.id !== lid);
  save(); renderAll();
}

function calcDays(o, b) {
  return ((new Date(b) - new Date(o)) / 3600000 / 24).toFixed(1);
}

function isCurrentlyOut(l) {
  const now = new Date();
  return new Date(l.outDate) <= now && new Date(l.backDate) > now;
}

function formatDT(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const day  = DAY_SHORT[d.getDay()];
  const date = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  const time = String(d.getHours()).padStart(2,'0') + ':00';
  return `יום ${day} ${date} ${time}`;
}
