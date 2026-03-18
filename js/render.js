const BOLD_RANKS = ['קצין','מפקד','מ"מ','סמל','סמלת','מ"פ','סמ"פ'];

function isBoldRank(rank) {
  if (!rank) return false;
  return BOLD_RANKS.some(r => rank.includes(r));
}

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
    const now  = new Date();
    const soon = new Date(now.getTime() + 48 * 3600000);
    const isOut  = state.leaves.some(l => l.sid === s.id && new Date(l.outDate) <= now && new Date(l.backDate) > now);
    const isSoon = !isOut && state.leaves.some(l => l.sid === s.id && new Date(l.outDate) > now && new Date(l.outDate) <= soon);
    const flag = isOut ? ' 🚶' : isSoon ? ' ⏳' : '';
    return `<option value="${s.id}">${s.name}${flag}${s.rank ? ` (${s.rank})` : ''}${roles.length ? ' | ' + roles.join(', ') : ''}</option>`;
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
        <span class="chip-x" onclick="unassignToFree('${mx.aid}')" title="הסר">✕</span>
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
          onchange="onShagaChangeSafe('${key}',this,${d},${shift.isNight})">
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

// ── עזר: סטטוס יציאות ──
function getHomeStatus() {
  const now  = new Date();
  const soon = new Date(now.getTime() + 48 * 3600000);
  const currentlyOut  = new Set();
  const goingHomeSoon = new Set();
  state.leaves.forEach(l => {
    const outDate  = new Date(l.outDate);
    const backDate = new Date(l.backDate);
    if (outDate <= now && backDate > now) {
      currentlyOut.add(l.sid);
    } else if (outDate > now && outDate <= soon) {
      goingHomeSoon.add(l.sid);
    }
  });
  return { currentlyOut, goingHomeSoon };
}

// ── התראה: שיבוץ לוחם שבחוץ ──
function warnIfOut(sid, roleName) {
  const now = new Date();
  const leave = state.leaves.find(l =>
    l.sid === sid && new Date(l.outDate) <= now && new Date(l.backDate) > now
  );
  if (leave) {
    const s = state.soldiers.find(x => x.id === sid);
    const back = formatDT(leave.backDate);
    return confirm(`⚠️ ${s?s.name:'?'} נמצא בבית!\nחזרה: ${back}\nלשבץ ל${roleName} בכל זאת?`);
  }
  const soon = new Date(now.getTime() + 48 * 3600000);
  const soonLeave = state.leaves.find(l =>
    l.sid === sid && new Date(l.outDate) > now && new Date(l.outDate) <= soon
  );
  if (soonLeave) {
    const s = state.soldiers.find(x => x.id === sid);
    const outTime = formatDT(soonLeave.outDate);
    if (!confirm(`⏳ ${s?s.name:'?'} עתיד לצאת ב-${outTime}\nלשבץ ל${roleName} בכל זאת?`)) return false;
  }
  return true;
}

function renderOutput() {
  const days   = parseInt(document.getElementById('sched-days').value) || 2;
  const grid   = document.getElementById('out-grid');
  const dateEl = document.getElementById('out-date');
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

  const { currentlyOut, goingHomeSoon } = getHomeStatus();

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

    // סידור א-ב (אלא אם נקבע סדר ידני)
    if (state.order[r]?.length) {
      const om = {}; state.order[r].forEach((sid, i) => { om[sid] = i; });
      m.sort((a, b) => (om[a.s.id] ?? 999) - (om[b.s.id] ?? 999));
    } else {
      m.sort((a, b) => a.s.name.localeCompare(b.s.name, 'he'));
    }

    // כרטיס בבית
    if (r === 'home') {
      const manualHome = m.map(mx => ({ s: mx.s }));
      const manualSids = new Set(manualHome.map(x => x.s.id));
      const autoOut = [];
      currentlyOut.forEach(sid => {
        if (!manualSids.has(sid)) {
          const s = state.soldiers.find(x => x.id === sid);
          if (s) autoOut.push(s);
        }
      });
      const autoSoon = [];
      goingHomeSoon.forEach(sid => {
        if (!manualSids.has(sid) && !currentlyOut.has(sid)) {
          const s = state.soldiers.find(x => x.id === sid);
          if (s) autoSoon.push(s);
        }
      });
      const total = manualHome.length + autoOut.length + autoSoon.length;
      if (!total) return;

      html += `<div class="out-card c-home">
        <div class="out-card-header"><span>🏠 בבית</span><span class="count">${total} אנשים</span></div>
        <table class="out-table"><tbody>`;
      let idx = 1;
      manualHome.forEach(({ s }) => {
        const bold = isBoldRank(s.rank);
        html += `<tr><td class="num">${idx++}</td>
          <td class="rnk" style="${bold?'font-weight:700;color:#1a3a5c':''}">${s.rank||''}</td>
          <td class="nm">${s.name}</td></tr>`;
      });
      autoOut.forEach(s => {
        const leave = state.leaves.find(l => l.sid === s.id && new Date(l.outDate) <= new Date() && new Date(l.backDate) > new Date());
        const backStr = leave ? 'חזרה: ' + formatDT(leave.backDate) : '';
        html += `<tr><td class="num">${idx++}</td><td class="rnk">${s.rank||''}</td>
          <td class="nm" style="color:#e65100">🚶 ${s.name}
            <span style="font-size:9px;font-weight:400;color:#888;margin-right:4px">${backStr}</span>
          </td></tr>`;
      });
      autoSoon.forEach(s => {
        const leave = state.leaves.find(l => l.sid === s.id && new Date(l.outDate) > new Date() && new Date(l.outDate) <= new Date(new Date().getTime()+48*3600000));
        const outStr = leave ? 'יוצא: ' + formatDT(leave.outDate) : '';
        html += `<tr><td class="num">${idx++}</td><td class="rnk">${s.rank||''}</td>
          <td class="nm" style="color:#0288d1">⏳ ${s.name}
            <span style="font-size:9px;font-weight:400;color:#0288d1;margin-right:4px">${outStr}</span>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
      return;
    }

    // שאר הכרטיסים
    html += `<div class="out-card c-${r}">
      <div class="out-card-header">
        <span>${ROLE_EMOJI[r]} ${ROLE_LABEL[r]}</span>
        <span class="count">${m.length} אנשים</span>
      </div>
      <table class="out-table"><tbody>`;
    m.forEach((mx, i) => {
      const isOut  = currentlyOut.has(mx.s.id);
      const isSoon = goingHomeSoon.has(mx.s.id);
      const color  = isOut ? 'color:#e65100' : isSoon ? 'color:#0288d1' : '';
      const suffix = isOut ? ' 🚶' : isSoon ? ' ⏳' : '';
      const bold   = isBoldRank(mx.s.rank);
      html += `<tr draggable="true" data-sid="${mx.s.id}" data-role="${r}"
        ondragstart="onDragStart(event)" ondragover="onDragOver(event)"
        ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
        <td class="num">${i+1}</td>
        <td class="rnk" style="${bold?'font-weight:700;color:#1a3a5c':''}">${mx.s.rank || ''}</td>
        <td class="nm${mx.dual ? ' dual' : ''}" style="${color}">${mx.s.name}${suffix}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });

  // ללא שיבוץ
  const free = state.soldiers.filter(s => state.assignments.filter(a => a.sid === s.id).length === 0);
  if (free.length) {
    const freeSorted = free.slice().sort((a,b) => a.name.localeCompare(b.name,'he'));
    html += `<div class="out-card c-unassigned">
      <div class="out-card-header"><span>⬜ ללא שיבוץ</span><span class="count">${freeSorted.length}</span></div>
      <table class="out-table"><tbody>`;
    freeSorted.forEach((s, i) => {
      html += `<tr><td class="num">${i+1}</td><td class="rnk">${s.rank||''}</td><td class="nm">${s.name}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  // לוז ש"ג
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

  // יציאות
  if (state.leaves.length) {
    html += `<div class="leaves-wide">
      <div class="out-card-header" style="background:#006064">
        <span>🏠 יציאות הביתה</span><span class="count">${state.leaves.length}</span>
      </div>
      <div style="overflow-x:auto"><table class="leaves-tbl">
        <thead><tr><th>לוחם</th><th>יציאה</th><th>חזרה</th><th>ימים</th><th>סטטוס</th><th></th></tr></thead><tbody>`;
    state.leaves.slice().sort((a,b) => new Date(a.outDate)-new Date(b.outDate)).forEach(l => {
      const s   = state.soldiers.find(x => x.id === l.sid);
      const out = isCurrentlyOut(l);
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 3600000);
      const outDate = new Date(l.outDate);
      const isSoon = !out && outDate > now && outDate <= soon;
      const rowStyle = out ? 'background:#fff0f0' : isSoon ? 'background:#e3f2fd' : '';
      const statusBadge = out
        ? '<span class="out-badge">🚶 בחוץ</span>'
        : isSoon
          ? '<span class="out-badge" style="background:#e3f2fd;color:#0288d1;border-color:#0288d1">⏳ עתיד לצאת</span>'
          : '<span class="out-badge">✅ חזר</span>';
      html += `<tr${rowStyle ? ` style="${rowStyle}"` : ''}>
        <td style="font-weight:700;color:${out?'#e65100':isSoon?'#0288d1':'#000'}">${s?s.name:'?'}</td>
        <td style="font-size:11px">${formatDT(l.outDate)}</td>
        <td style="font-size:11px">${formatDT(l.backDate)}</td>
        <td style="text-align:center"><span class="days-badge">${calcDays(l.outDate,l.backDate)}</span></td>
        <td>${statusBadge}</td>
        <td><button class="btn btn-red btn-sm" onclick="removeLeave('${l.id}')">✕</button></td>
      </tr>`;
    });
    html += '</tbody></table></div></div>';
  }

  grid.innerHTML = html || '<div style="color:#aaa;padding:30px;text-align:center;grid-column:1/-1;font-size:14px">הוסף לוחמים ושבץ אותם — הטבלאות יופיעו כאן</div>';
}

// ── תצוגה מקדימה ──
function openPreview() {
  const days = parseInt(document.getElementById('sched-days').value) || 2;
  const PREVIEW_ROLES = ['hafk1','hafk2','hafk3','hafkmap','hamal','truck','camp','rescue','konanut','other'];
  const ROLE_COLORS = {
    hafk1:'#c55a00', hafk2:'#880e4f', hafk3:'#2e7d32',
    hafkmap:'#4527a0', hamal:'#6a1b9a', truck:'#5d4037',
    camp:'#1a6e32', rescue:'#d4890a', konanut:'#e65100', other:'#777'
  };

  const { currentlyOut, goingHomeSoon } = getHomeStatus();
  const groups = {};
  ROLES.forEach(r => { groups[r] = []; });
  state.assignments.forEach(a => {
    const s = state.soldiers.find(x => x.id === a.sid);
    if (s) groups[a.role].push(s);
  });

  let cardsHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px;margin-bottom:14px">';
  PREVIEW_ROLES.forEach(r => {
    let m = groups[r]; if (!m.length) return;
    m = m.slice().sort((a,b) => a.name.localeCompare(b.name,'he'));
    const bg = ROLE_COLORS[r] || '#333';
    cardsHtml += `<div style="border-radius:8px;overflow:hidden;border:2px solid ${bg}">
      <div style="background:${bg};padding:5px 10px;font-size:11px;font-weight:700;color:#fff;display:flex;justify-content:space-between">
        <span>${ROLE_EMOJI[r]} ${ROLE_LABEL[r]}</span><span style="opacity:.8">${m.length}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff">`;
    m.forEach((s, i) => {
      const isOut  = currentlyOut.has(s.id);
      const isSoon = goingHomeSoon.has(s.id);
      const color  = isOut ? '#e65100' : isSoon ? '#0288d1' : '#000';
      const suffix = isOut ? ' 🚶' : isSoon ? ' ⏳' : '';
      const bold   = isBoldRank(s.rank);
      cardsHtml += `<tr style="border-bottom:1px solid #eee">
        <td style="padding:4px 8px;font-size:10px;color:#aaa;width:18px">${i+1}</td>
        <td style="padding:4px 8px;font-size:10px;width:45px;${bold?'font-weight:700;color:#1a3a5c':''}">${s.rank||''}</td>
        <td style="padding:4px 8px;font-size:11px;font-weight:700;color:${color}">${s.name}${suffix}</td>
      </tr>`;
    });
    cardsHtml += '</table></div>';
  });
  cardsHtml += '</div>';

  const now = new Date();
  const schedStart = new Date(); schedStart.setHours(0,0,0,0);
  let shagaHtml = `<div style="border-radius:8px;overflow:hidden;border:2px solid #1a5a8a;margin-bottom:14px">
    <div style="background:#1a5a8a;padding:6px 12px;font-size:12px;font-weight:700;color:#fff">🔵 לוז ש"ג — 36 שעות קדימה</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;background:#fff">
      <thead><tr style="background:#d8eaf5">
        <th style="padding:5px 8px;font-size:10px;color:#1a3a5c;text-align:right">יום</th>
        <th style="padding:5px 8px;font-size:10px;color:#1a3a5c;text-align:right">שעות</th>
        <th style="padding:5px 8px;font-size:10px;color:#1a3a5c;text-align:right">שומר</th>
      </tr></thead><tbody>`;

  let slotsShown = 0;
  for (let d = 0; d < 7 && slotsShown < 18; d++) {
    for (let si = 0; si < SHAGA_SHIFTS.length && slotsShown < 18; si++) {
      const shift = SHAGA_SHIFTS[si];
      const slotTime = new Date(schedStart);
      slotTime.setDate(slotTime.getDate() + d);
      slotTime.setHours(shift.h, 0, 0, 0);
      if (slotTime < now) continue;
      const key = `day_${d}_shift_${si}`;
      const val = state.schedule[key] || '';
      const sol = state.soldiers.find(x => x.id === val);
      const display = sol ? sol.name : (val || '—');
      const isNight = shift.isNight;
      shagaHtml += `<tr style="background:${isNight?'#f0f0ff':'#fff'};border-bottom:1px solid #d8eaf5">
        <td style="padding:4px 8px;font-size:10px;color:#555">${DAY_NAMES[slotTime.getDay()]}</td>
        <td style="padding:4px 8px;font-size:10px;color:#1a5a8a;white-space:nowrap">${shift.label}${isNight?' 🌙':''}</td>
        <td style="padding:4px 8px;font-size:11px;font-weight:700;color:${isNight?'#4527a0':'#000'}">${display}</td>
      </tr>`;
      slotsShown++;
    }
  }
  shagaHtml += '</tbody></table></div>';

  let tourHtml = `<div style="border-radius:8px;overflow:hidden;border:2px solid #4527a0;margin-bottom:14px">
    <div style="background:#4527a0;padding:6px 12px;font-size:12px;font-weight:700;color:#fff">🟣 לוז חפ"ק ק. מלאכי — ${days} ימים</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;background:#fff">
      <thead><tr style="background:#ede7f6">
        <th style="padding:5px 8px;font-size:10px;color:#4527a0;text-align:right">סיור</th>`;
  for (let d = 0; d < days; d++) tourHtml += `<th style="padding:5px 8px;font-size:10px;color:#4527a0;text-align:center">${DAY_NAMES[d%7]}</th>`;
  tourHtml += '</tr></thead><tbody>';
  TOUR_WINDOWS.forEach((wl, wi) => {
    tourHtml += `<tr style="background:${wi===0?'#fff':'#f5f0ff'}">
      <td style="padding:5px 8px;font-size:10px;font-weight:700;color:#4527a0;white-space:nowrap;border-bottom:1px solid #e0d8f5">${wl}</td>`;
    for (let d = 0; d < days; d++) {
      const key = `day_${d}_${TOUR_KEYS[wi]}`;
      const tourVal = state.schedule[key] || '';
      const tourLabel = tourVal ? hafkLabel(tourVal) : '—';
      let memberNames = '';
      if (tourVal) {
        memberNames = state.assignments
          .filter(a => a.role === tourVal)
          .map(a => state.soldiers.find(x => x.id === a.sid))
          .filter(Boolean).map(s => s.name).join(', ');
      }
      tourHtml += `<td style="padding:5px 8px;border-bottom:1px solid #e0d8f5;text-align:center">
        ${tourVal
          ? `<div style="font-weight:700;font-size:11px;color:#4527a0">${tourLabel}</div>
             <div style="font-size:9px;color:#666;margin-top:2px">${memberNames}</div>`
          : '<span style="color:#ccc">—</span>'}
      </td>`;
    }
    tourHtml += '</tr>';
  });
  tourHtml += '</tbody></table></div></div>';

  const wrapper = document.createElement('div');
  wrapper.id = 'preview-wrapper';
  wrapper.innerHTML = `
    <div id="preview-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:500;overflow-y:auto;padding:16px" onclick="if(event.target.id==='preview-overlay')closePreview()">
      <div style="background:#f0f2f5;border-radius:12px;max-width:900px;margin:0 auto;overflow:hidden">
        <div style="background:#1a3a5c;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10">
          <h2 style="color:#fff;font-size:15px;font-weight:700">👁 תצוגה מקדימה — שבצק פלוגה</h2>
          <button onclick="closePreview()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;font-weight:700">✕ סגור</button>
        </div>
        <div style="padding:14px">${cardsHtml}${shagaHtml}${tourHtml}</div>
      </div>
    </div>`;
  document.body.appendChild(wrapper);
}

function closePreview() {
  const el = document.getElementById('preview-wrapper');
  if (el) el.remove();
}
