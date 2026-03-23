function autoFillReturn() {
  const out = document.getElementById('leave-out').value;
  const dur = parseInt(document.getElementById('leave-dur').value) || 48;
  if (!out) return;
  const d = new Date(out);
  d.setHours(d.getHours() + dur);
  document.getElementById('leave-back').value = d.toISOString().slice(0, 16);
}

function isCurrentlyOut(l) {
  const now = new Date();
  return new Date(l.outDate) <= now && new Date(l.backDate) > now;
}

function removeLeave(lid) {
  if (!confirm('למחוק יציאה זו?')) return;
  pushUndo();
  state.leaves = state.leaves.filter(l => l.id !== lid);
  save(); renderAll();
}

function formatDT(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function calcDays(out, back) {
  const ms = new Date(back) - new Date(out);
  return Math.round(ms / 3600000 / 24 * 10) / 10;
}

// ── מחיקה אוטומטית מרשימת "בבית" אחרי חזרה ──
function autoCleanReturnedHome() {
  const now = new Date();
  // מצא לוחמים שיצאו ושחזרו (backDate <= now)
  const returnedSids = new Set();
  state.leaves.forEach(l => {
    if (new Date(l.backDate) <= now) {
      returnedSids.add(l.sid);
    }
  });

  // הסר מרשימת "בבית" לוחמים שחזרו
  // (רק אם אין להם יציאה פעילה אחרת)
  returnedSids.forEach(sid => {
    const hasActiveLeave = state.leaves.some(l =>
      l.sid === sid && new Date(l.outDate) <= now && new Date(l.backDate) > now
    );
    if (!hasActiveLeave) {
      // הסר מ-home אם שובץ שם ידנית
      state.assignments = state.assignments.filter(a =>
        !(a.sid === sid && a.role === 'home')
      );
    }
  });
}

// ── ארכיון יציאות ──
function renderArchive() {
  // בנה סיכום לכל לוחם
  const summary = {};
  state.leaves.forEach(l => {
    const s = state.soldiers.find(x => x.id === l.sid);
    const name = s ? s.name : '?';
    if (!summary[l.sid]) {
      summary[l.sid] = { name, totalDays: 0, trips: 0, lastOut: null };
    }
    const days = calcDays(l.outDate, l.backDate);
    summary[l.sid].totalDays += days;
    summary[l.sid].trips++;
    const outDate = new Date(l.outDate);
    if (!summary[l.sid].lastOut || outDate > new Date(summary[l.sid].lastOut)) {
      summary[l.sid].lastOut = l.outDate;
    }
  });

  const entries = Object.values(summary).sort((a, b) => b.totalDays - a.totalDays);
  if (!entries.length) return '<div style="color:#aaa;text-align:center;padding:20px;font-size:13px">אין נתוני יציאות עדיין</div>';

  let html = `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff">
      <thead>
        <tr style="background:#1a3a5c;color:#fff">
          <th style="padding:8px 10px;text-align:right">לוחם</th>
          <th style="padding:8px 10px;text-align:center">מספר יציאות</th>
          <th style="padding:8px 10px;text-align:center">סה"כ ימים בחוץ</th>
          <th style="padding:8px 10px;text-align:center">יציאה אחרונה</th>
        </tr>
      </thead>
      <tbody>`;

  entries.forEach((e, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f5f7fa';
    html += `<tr style="background:${bg};border-bottom:1px solid #eee">
      <td style="padding:7px 10px;font-weight:700">${e.name}</td>
      <td style="padding:7px 10px;text-align:center">
        <span style="background:#1a3a5c;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px">${e.trips}</span>
      </td>
      <td style="padding:7px 10px;text-align:center">
        <span style="background:#8a1a1a;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px">${e.totalDays} ימים</span>
      </td>
      <td style="padding:7px 10px;text-align:center;font-size:11px;color:#555">${e.lastOut ? formatDT(e.lastOut) : '—'}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  return html;
}

function openArchive() {
  const wrapper = document.createElement('div');
  wrapper.id = 'archive-wrapper';
  wrapper.innerHTML = `
    <div id="archive-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:500;overflow-y:auto;padding:16px" onclick="if(event.target.id==='archive-overlay')closeArchive()">
      <div style="background:#f0f2f5;border-radius:12px;max-width:700px;margin:0 auto;overflow:hidden">
        <div style="background:#1a3a5c;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10">
          <h2 style="color:#fff;font-size:15px;font-weight:700">📋 ארכיון יציאות</h2>
          <button onclick="closeArchive()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;font-weight:700">✕ סגור</button>
        </div>
        <div style="padding:14px">${renderArchive()}</div>
      </div>
    </div>`;
  document.body.appendChild(wrapper);
}

function closeArchive() {
  const el = document.getElementById('archive-wrapper');
  if (el) el.remove();
}
