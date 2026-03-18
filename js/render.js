function renderAll() {
  renderHeader();
  renderSoldierSelect();
  renderLeaveSelect();
  renderPosList();
  renderSchedInput();
  renderOutput();
}

function renderHeader() {
  const tot = state.soldiers.length;
  const asg = {};
  state.assignments.forEach(a => { if (a.role !== 'home' && a.role !== 'other') asg[a.sid] = true; });
  const home = state.soldiers.filter(s => state.assignments.some(a => a.sid === s.id && a.role === 'home')).length;
  const free = state.soldiers.filter(s => state.assignments.filter(a => a.sid === s.id).length === 0).length;
  const now  = new Date();
  const out  = state.leaves.filter(l => new Date(l.outDate) <= now && new Date(l.backDate) > now).length;
  document.getElementById('hp-total').textContent    = tot;
  document.getElementById('hp-assigned').textContent = Object.keys(asg).length;
  document.getElementById('hp-free').textContent     = free;
  document.getElementById('hp-home').textContent     = home;
  document.getElementById('hp-out').textContent      = out;
}

function renderSoldierSelect() {
  const sel  = document.getElementById('in-soldier');
  const prev = sel.value;
  const sorted = state.soldiers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
  sel.innerHTML = '<option value="">— בחר לוחם —</option>' + sorted.map(s => {
    const roles = state.assignments.filter(a => a.sid === s.id).map(a => ROLE_LABEL[a.role]);
    return `<option value="${s.id}">${s.name}${s.rank ? ` (${s.rank})` : ''}${roles.length ? ' | ' + roles.join(', ') : ''}</option>`;
  }).join('');
  if (prev) sel.value = prev;
}

function renderLeaveSelect() {
  const sel  = document.getElementById('leave-soldier');
  const prev = sel.value;
  const sorted = state.soldiers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
  sel.innerHTML = '<option value="">— בחר לוחם —</option>' +
    sorted.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (prev) sel.value = prev;
  const out = document.getElementById('leave-out');
  if (!out.value) {
    const def = new Date(); def.setHours(10, 0, 0, 0);
    out.value = def.toISOString().slice(0, 16);
    autoFillReturn();
  }
}

function renderPosList() {
  const container = document.getElementById('pos-list');
  const groups = {};
  ROLES.forEach(r => { groups[r] = []; });
  state.assignments.forEach(a => {
    const s = state.soldiers.find(x => x.id === a.sid);
    if (s) groups[a.role].push({ s, aid: a.id });
  });

  let html = '';
  ROLES.forEach(r => {
    const m = groups[r]; if (!m.length) return;
    html += `<div class="pos-item">
      <div class="pos-item-header"><span class="pos-item-name">${ROLE_EMOJI[r]} ${ROLE_LABEL[r]} (${m.length})</span></div>
      <div class="pos-item-soldiers">`;
    m.forEach(mx => {
      html += `<div class="chip">${mx.s.name}
        <span class="chip-edit" onclick="openEditSoldier('${mx.s.id}')" title="ערוך">✏️</span>
        <span class="chip-x" onclick="unassignToFree('${mx.aid}')" title="הסר לללא שיבוץ">✕</span>
      </div>`;
    });
    html += '</div></div>';
  });

  const free = state.soldiers.filter(s => state.assignments.filter(a => a.sid === s.id).length === 0);
  if (free.length) {
    html += `<div class="pos-item" style="border-style:dashed">
      <div class="pos-item-header"><span class="pos-item-name">⬜ ללא שיבוץ (${free.length})</span></div>
      <div class="pos-item-soldiers">`;
    free.forEach(s => {
      html += `<div class="chip" style="background:#e0e0e0">${s.name}
        <span class="chip-edit" onclick="openEditSoldier('${s.id}')" title="ערוך">✏️</span>
      </div>`;
    });
    html += '</div></div>';
  }
  container.innerHTML = html || '<div style="font-size:12px;color:#aaa;text-align:center;padding:10px">הוסף לוחמים ושבץ אותם</div>';
}

function renderSchedInput() {
  const days     = parseInt(document.getElementById('sched-days').value) || 2;
  const soldiers = getShagaSoldiers();
  const body     = document.getElementById('sched-input');
  if (!body) return;

  let html = '';
  for (let d = 0; d < days; d++) {
    html += `<div style="font-size:11px;font-weight:700;color:#1a3a5c;margin:${d>0?'10px':''}0 3px">${DAY_NAMES[d % 7]}</div>`;

    SHAGA_SHIFTS.forEach((shift, si) => {
      const key = `day_${d}_shift_${si}`;
      const val = state.schedule[key] || '';
      const isManual = val && !soldiers.find(s => s.id === val);

      html += `<div class="sched-input-row${shift.isNight ? ' night-row' : ''}">
        <span class="time-lbl">${shift.label}${shift.isNight ? ' 🌙' : ''}</span>
        <div style="flex:1" draggable="true"
          ondragstart="onSchedDragStart(event,'${key}')"
          ondragover="onSchedDragOver(event)"
          ondragleave="onSchedDragLeave(event)"
          ondragend="onSchedDragEnd(event)"
          ondrop="onSchedDrop(event,'${key}')">`;

      if (soldiers.length) {
        html += `<select style="margin-bottom:0;padding:2px 5px;font-size:11px;width:100%"
          onchange="onShagaChange('${key}',this,${d},${shift.isNight})">
          <option value="">—</option>`;
        soldiers.forEach(s => {
          const warn = shift.isNight && isLeavingMorning(s.id, d) ? '⚠️' : '';
          html += `<option value="${s.id}"${val === s.id ? ' selected' : ''}>${s.name}${warn ? ' ' + warn : ''}</option>`;
        });
        html += `<option value="__manual__"${isManual ? ' selected' : ''}>✏️ ידני</option></select>`;
        if (isManual)
          html += `<input type="text" id="mi_${key}"
            style="margin-top:2px;padding:2px 5px;font-size:11px;width:100%;border:1px solid #ccc;border-radius:4px"
            value="${val.replace(/"/g, '&quot;')}"
            oninput="state.schedule['${key}']=this.value;save()">`;
      } else {
        html += `<input type="text"
          style="margin-bottom:0;padding:2px 5px;font-size:11px;width:100%"
          placeholder="שם..." value="${val.replace(/"/g, '&quot;')}"
          oninput="state.schedule['${key}']=this.value;save()">`;
      }
      html += '</div></div>';
    });

    TOUR_WINDOWS.forEach((wl, wi) => {
      const key = `day_${d}_${TOUR_KEYS[wi]}`;
      const val = state.schedule[key] || '';
      html += `<div class="sched-input-row tour-row">
        <span class="time-lbl" style="color:#4527a0">${wl}</span>
        <select style="margin-bottom:0;padding:2px 5px;font-size:11px;flex:1"
          onchange="state.schedule['${key}']=this.value;save();renderOutput()">`;
      TOUR_OPT.forEach(opt => { html += `<option value="${opt.v}"${val === opt.v ? ' selected' : ''}>${opt.l}</option>`; });
      html += '</select></div>';
    });
  }
  body.innerHTML = html || '<div style="font-size:11px;color:#aaa">שבץ לוחמים לש"ג תחילה</div>';
}

function renderOutput() {
  const days   = parseInt(document.getElementById('sched-days').value) || 2;
  const grid   = document.getElementById('out-grid');
  const dateEl = document.getElementById('out-date');
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

  const groups = {};
  ROLES.forEach(r => { groups[r] = []; });
  const sidRoles = {};
  state.assignments.forEach(a => { if (!sidRoles[a.sid]) sidRoles[a.sid] = []; sidRoles[a.sid].push(a.role); });
  state.assignments.forEach(a => {
    const s = state.soldiers.find(x => x.id === a.sid);
    if (s) groups[a.role].push({ s, dual: sidRoles[s.id].length > 1 });
  });

  let html = '';

  ROLES.forEach(r => {
    let m = groups[r]; if (!m.length) return;
    if (state.order[r]?.length) {
      const om = {}; state.order[r].forEach((sid, i) => { om[sid] = i; });
      m.sort((a, b) => (om[a.s.id] ?? 999) - (om[b.s.id] ?? 999));
    }
    html += `<div class="out-card c-${r}">
      <div class="out-card-header">
        <span>${ROLE_EMOJI[r]} ${ROLE_LABEL[r]}</span>
        <span class="count">${m.length} אנשים</span>
      </div>
      <table class="out-table"><tbody>`;
    m.forEach((mx, i) => {
      html += `<tr draggable="true" data-sid="${mx.s.id}" data-role="${r}"
        ondragstart="onDragStart(event)" ondragover="onDragOver(event)"
        ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
        <td class="num">${i+1}</td>
        <td class="rnk">${mx.s.rank || ''}</td>
        <td class="nm${mx.dual ? ' dual' : ''}">${mx.s.name}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });

  const free = state.soldiers.filter(s => state.assignments.filter(a => a.sid === s.id).length === 0);
  if (free.length) {
    html += `<div class="out-card c-unassigned">
      <div class="out-card-header"><span>⬜ ללא שיבוץ</span><span class="count">${free.length}</span></div>
      <table class="out-table"><tbody>`;
    free.forEach((s, i) => {
      html += `<tr><td class="num">${i+1}</td><td class="rnk">${s.rank||''}</td><td class="nm">${s.name}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  const shagaSols = getShagaSoldiers();
  if (shagaSols.length) {
    html += `<div class="out-card-wide">
      <div class="out-card-header"><span>🕐 לוז ש"ג וסיורים</span><span class="count">${days} ימים</span></div>
      <div style="overflow-x:auto"><table class="sched-table"><thead><tr>`;
    for (let d = 0; d < days; d++) html += `<th colspan="2" style="text-align:center">${DAY_NAMES[d%7]}</th>`;
    html += '</tr><tr>';
    for (let d2 = 0; d2 < days; d2++) html += '<th>שעות</th><th>לוחם</th>';
    html += '</tr></thead><tbody>';

    SHAGA_SHIFTS.forEach((shift, si) => {
      html += `<tr${shift.isNight ? ' class="night-row"' : ''}>`;
      for (let d3 = 0; d3 < days; d3++) {
        const key = `day_${d3}_shift_${si}`;
        const val = state.schedule[key] || '';
        const sol = state.soldiers.find(x => x.id === val);
        const display = sol ? sol.name : (val || '<span style="color:#ccc">—</span>');
        html += `<td class="time-cell">${shift.label}${shift.isNight ? ' 🌙' : ''}</td><td style="font-weight:700">${display}</td>`;
      }
      html += '</tr>';
    });

    TOUR_WINDOWS.forEach((wl, wi) => {
      html += '<tr class="tour-row">';
      for (let d4 = 0; d4 < days; d4++) {
        const key = `day_${d4}_${TOUR_KEYS[wi]}`;
        const val = state.schedule[key] || '';
        html += `<td>${wl}</td><td style="font-weight:700">${val ? hafkLabel(val) : '<span style="color:#ccc">—</span>'}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  }

  if (state.leaves.length) {
    html += `<div class="leaves-wide">
      <div class="out-card-header" style="background:#006064">
        <span>🏠 יציאות הביתה</span><span class="count">${state.leaves.length}</span>
      </div>
      <div style="overflow-x:auto"><table class="leaves-tbl">
        <thead><tr><th>לוחם</th><th>יציאה</th><th>חזרה</th><th>ימים</th><th>סטטוס</th><th></th></tr></thead>
        <tbody>`;
    state.leaves
      .slice()
      .sort((a, b) => new Date(a.outDate) - new Date(b.outDate))
      .forEach(l => {
        const s   = state.soldiers.find(x => x.id === l.sid);
        const out = isCurrentlyOut(l);
        html += `<tr${out ? ' style="background:#fff0f0"' : ''}>
          <td style="font-weight:700">${s ? s.name : '?'}</td>
          <td style="font-size:11px">${formatDT(l.outDate)}</td>
          <td style="font-size:11px">${formatDT(l.backDate)}</td>
          <td style="text-align:center"><span class="days-badge">${calcDays(l.outDate, l.backDate)}</span></td>
          <td><span class="out-badge">${out ? '🚶 בחוץ' : '✅ חזר'}</span></td>
          <td><button class="btn btn-red btn-sm" onclick="removeLeave('${l.id}')">✕</button></td>
        </tr>`;
      });
    html += '</tbody></table></div></div>';
  }

  grid.innerHTML = html || '<div style="color:#aaa;padding:30px;text-align:center;grid-column:1/-1;font-size:14px">הוסף לוחמים ושבץ אותם — הטבלאות יופיעו כאן</div>';
}

// ── תצוגה מקדימה 36 שעות ──
function openPreview() {
  const now = new Date();
  const TASK_COLORS = {
    shaga:   '#1a5a8a',
    hafkmap: '#4527a0',
    hamal:   '#6a1b9a',
    hafk1:   '#c55a00',
    hafk2:   '#880e4f',
    hafk3:   '#2e7d32',
    tour:    '#00796b'
  };

  // בנה לוח 36 שעות
  let rows = '';
  for (let h = 0; h < 36; h += 2) {
    const slotTime = new Date(now);
    slotTime.setMinutes(0,0,0);
    slotTime.setHours(slotTime.getHours() + h);
    const label = `${String(slotTime.getHours()).padStart(2,'0')}:00`;
    const dayLabel = DAY_NAMES[slotTime.getDay()];

    // מצא ש"ג
    const schedStart = new Date(); schedStart.setHours(0,0,0,0);
    const diffH = (slotTime - schedStart) / 3600000;
    const dayIdx = Math.floor(diffH / 24);
    const shiftIdx = SHAGA_SHIFTS.findIndex(s => s.h === slotTime.getHours());
    let shagaName = '—';
    if (shiftIdx >= 0) {
      const key = `day_${dayIdx}_shift_${shiftIdx}`;
      const sid = state.schedule[key];
      const sol = sid ? state.soldiers.find(x => x.id === sid) : null;
      shagaName = sol ? sol.name : '—';
    }

    // מצא סיור
    let tourName = '—';
    const tourKey1 = `day_${dayIdx}_t1`;
    const tourKey2 = `day_${dayIdx}_t2`;
    const tourH = slotTime.getHours();
    const tourKey = (tourH >= 10 && tourH < 22) ? tourKey1 : tourKey2;
    const tourVal = state.schedule[tourKey];
    if (tourVal) tourName = hafkLabel(tourVal);

    // חמ"ל
    const hamalSoldiers = state.assignments
      .filter(a => a.role === 'hamal')
      .map(a => state.soldiers.find(x => x.id === a.sid))
      .filter(Boolean)
      .map(s => s.name).join(', ') || '—';

    // חפ"ק מ"פ
    const hafkmapSoldiers = state.assignments
      .filter(a => a.role === 'hafkmap')
      .map(a => state.soldiers.find(x => x.id === a.sid))
      .filter(Boolean)
      .map(s => s.name).join(', ') || '—';

    rows += `<tr>
      <td style="font-size:11px;color:#555;white-space:nowrap;padding:4px 8px">${dayLabel}<br><strong>${label}</strong></td>
      <td style="padding:4px 8px"><span style="background:${TASK_COLORS.shaga};color:#fff;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">${shagaName}</span></td>
      <td style="padding:4px 8px"><span style="background:${TASK_COLORS.tour};color:#fff;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">${tourName}</span></td>
      <td style="padding:4px 8px;font-size:11px;color:#333">${hamalSoldiers}</td>
      <td style="padding:4px 8px;font-size:11px;color:#333">${hafkmapSoldiers}</td>
    </tr>`;
  }

  const html = `
    <div id="preview-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto" onclick="if(event.target===this)closePreview()">
      <div style="background:#fff;border-radius:12px;width:100%;max-width:750px;overflow:hidden;margin:auto">
        <div style="background:#1a3a5c;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
          <h2 style="color:#fff;font-size:15px;font-weight:700">👁 תצוגה מקדימה — 36 שעות קדימה</h2>
          <button onclick="closePreview()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px">✕ סגור</button>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
            <thead>
              <tr style="background:#f0f4f8">
                <th style="padding:8px;text-align:right;font-size:12px;color:#555">שעה</th>
                <th style="padding:8px;text-align:right;font-size:12px;background:#e3f0fb;color:#1a5a8a">🔵 ש"ג</th>
                <th style="padding:8px;text-align:right;font-size:12px;background:#e8f5e9;color:#00796b">🟢 ק. מלאכי</th>
                <th style="padding:8px;text-align:right;font-size:12px;background:#f3e5f5;color:#6a1b9a">🟤 חמ"ל</th>
                <th style="padding:8px;text-align:right;font-size:12px;background:#ede7f6;color:#4527a0">🟣 חפ"ק מ"פ</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  const div = document.createElement('div');
  div.id = 'preview-wrapper';
  div.innerHTML = html;
  document.body.appendChild(div);
}

function closePreview() {
  const el = document.getElementById('preview-wrapper');
  if (el) el.remove();
}
