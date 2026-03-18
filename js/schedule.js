// ── SCHEDULE ──

// דרגות בכירות — לא לש"ג
function getShagaSoldiers() {
  const sids = {};
  state.assignments.forEach(a => {
    if (a.role === 'shaga') {
      const s = state.soldiers.find(x => x.id === a.sid);
      // לא לשבץ דרגות בכירות לש"ג
      if (s && !isSeniorRank(s.rank)) sids[a.sid] = true;
    }
  });
  state.assignments.forEach(a => {
    if (EXCLUDE_FROM_SCHED.includes(a.role)) delete sids[a.sid];
  });
  return state.soldiers.filter(s => sids[s.id]);
}

// כל חיילי חפ"ק (1,2,3) — למחזור סיורים
function getHafkSoldiers(role) {
  return state.assignments
    .filter(a => a.role === role)
    .map(a => state.soldiers.find(x => x.id === a.sid))
    .filter(Boolean)
    .filter(s => !isSeniorRank(s.rank)); // לא דרגות בכירות
}

function getAllHafkSoldiers() {
  return ['hafk1','hafk2','hafk3'].map(r => ({
    role: r,
    soldiers: getHafkSoldiers(r)
  })).filter(g => g.soldiers.length > 0);
}

function isOnLeave(sid, dayIndex, shiftHour) {
  const schedStart = new Date(); schedStart.setHours(0,0,0,0);
  return state.leaves.some(l => {
    if (l.sid !== sid) return false;
    const absHour = dayIndex * 24 + shiftHour;
    const outH  = (new Date(l.outDate)  - schedStart) / 3600000;
    const backH = (new Date(l.backDate) - schedStart) / 3600000;
    return absHour >= outH && absHour < backH;
  });
}

function isLeavingMorning(sid, d) {
  const schedStart = new Date(); schedStart.setHours(0,0,0,0);
  return state.leaves.some(l => {
    if (l.sid !== sid) return false;
    const outH = (new Date(l.outDate) - schedStart) / 3600000;
    return outH >= d * 24 + 6 && outH < d * 24 + 12;
  });
}

function leavingTomorrow(sid, d) {
  const schedStart = new Date(); schedStart.setHours(0,0,0,0);
  return state.leaves.some(l => {
    if (l.sid !== sid) return false;
    const outH = (new Date(l.outDate) - schedStart) / 3600000;
    return outH >= (d+1) * 24 + 6 && outH < (d+1) * 24 + 14;
  });
}

// ── שיבוץ אוטומטי ש"ג ──
function genSched() {
  const days = parseInt(document.getElementById('sched-days').value) || 2;
  const soldiers = getShagaSoldiers();
  if (!soldiers.length) { alert('אין לוחמי ש"ג זמינים. שבץ תחילה.'); return; }

  const shiftCount = {};
  soldiers.forEach(s => { shiftCount[s.id] = 0; });
  Object.keys(state.schedule).forEach(k => {
    if (k.includes('_shift_') && shiftCount[state.schedule[k]] !== undefined)
      shiftCount[state.schedule[k]]++;
  });

  const lastShiftSlot = {};
  soldiers.forEach(s => { lastShiftSlot[s.id] = -99; });

  const nightDays = {};
  soldiers.forEach(s => { nightDays[s.id] = []; });
  Object.keys(state.schedule).forEach(k => {
    if (!k.includes('_shift_')) return;
    const pts = k.split('_');
    const d2  = parseInt(pts[1]);
    const si2 = parseInt(pts[3]);
    const sid = state.schedule[k];
    if (nightDays[sid] && SHAGA_SHIFTS[si2]?.isNight && !nightDays[sid].includes(d2))
      nightDays[sid].push(d2);
  });

  for (let d = 0; d < days; d++) {
    for (let si = 0; si < SHAGA_SHIFTS.length; si++) {
      const key = `day_${d}_shift_${si}`;
      if (state.schedule[key]) continue; // כבר מולא — אל תשנה

      const shift   = SHAGA_SHIFTS[si];
      const absSlot = d * SHAGA_SHIFTS.length + si;
      const isNight = shift.isNight;

      function score(s) {
        if (isOnLeave(s.id, d, shift.h))          return 10000;
        if (isNight && isLeavingMorning(s.id, d))  return 9000;
        if (isNight) {
          const nd = nightDays[s.id] || [];
          if (nd.includes(d - 1)) return 8500;
          if (nd.includes(d + 1)) return 7500;
        }
        let sc = shiftCount[s.id] * 100;
        sc -= Math.min(absSlot - lastShiftSlot[s.id], 12) * 5;
        const prevKey = (si === 0 && d > 0)
          ? `day_${d-1}_shift_${SHAGA_SHIFTS.length-1}`
          : `day_${d}_shift_${si-1}`;
        if (state.schedule[prevKey] === s.id) sc += 200;
        if (leavingTomorrow(s.id, d) && isNight)  sc += 500;
        if (leavingTomorrow(s.id, d) && !isNight) sc -= 30;
        return sc;
      }

      const ranked = soldiers.slice().sort((a, b) => score(a) - score(b));
      const chosen = ranked[0];
      state.schedule[key] = chosen.id;
      shiftCount[chosen.id]++;
      lastShiftSlot[chosen.id] = absSlot;
      if (isNight) {
        if (!nightDays[chosen.id]) nightDays[chosen.id] = [];
        if (!nightDays[chosen.id].includes(d)) nightDays[chosen.id].push(d);
      }
    }
  }

  // שיבוץ סיורים אוטומטי
  genTourSched();

  save(); renderAll();
}

// ── שיבוץ אוטומטי סיורים ──
// מחזור: כל סיור (יום/לילה × מלאכי/גת) — חפ"ק אחר
// במקביל: מלאכי + גת באותו slot
// מחזור חפ"קים: 1→2→3→1→2→3...
function genTourSched() {
  const days = parseInt(document.getElementById('sched-days').value) || 2;
  const hafkGroups = getAllHafkSoldiers();
  if (hafkGroups.length < 2) {
    alert('צריך לפחות 2 חפ"קים משובצים לסיורים.');
    return;
  }

  const hafkRoles = hafkGroups.map(g => g.role); // ['hafk1','hafk2','hafk3']
  const n = hafkRoles.length;

  // מצא את הסיור האחרון שכבר בוצע — כדי להמשיך מאותו מחזור
  let lastMalachiIdx = -1;
  let lastGatIdx     = -1;

  // סרוק סיורים קיימים למציאת המיקום במחזור
  for (let d = days - 1; d >= 0; d--) {
    const t1 = state.schedule[`day_${d}_t1`]; // מלאכי יום
    const t2 = state.schedule[`day_${d}_t2`]; // מלאכי לילה
    const t3 = state.schedule[`day_${d}_t3`]; // גת יום
    const t4 = state.schedule[`day_${d}_t4`]; // גת לילה
    if (t2 && lastMalachiIdx === -1) lastMalachiIdx = hafkRoles.indexOf(t2);
    if (t4 && lastGatIdx     === -1) lastGatIdx     = hafkRoles.indexOf(t4);
    if (lastMalachiIdx > -1 && lastGatIdx > -1) break;
  }

  // אם אין היסטוריה — התחל מברירת מחדל
  // מלאכי מתחיל מ-hafk1, גת מתחיל מ-hafk2
  let malachiCursor = lastMalachiIdx > -1 ? (lastMalachiIdx + 1) % n : 0;
  let gatCursor     = lastGatIdx     > -1 ? (lastGatIdx     + 1) % n : 1 % n;

  for (let d = 0; d < days; d++) {
    // כל יום יש 2 slots: יום (10-22) ולילה (22-10)
    const slots = [
      { malachi: 't1', gat: 't3' }, // יום
      { malachi: 't2', gat: 't4' }  // לילה
    ];

    slots.forEach(slot => {
      // מלאכי
      if (!state.schedule[`day_${d}_${slot.malachi}`]) {
        // וודא שמלאכי וגת לא אותו חפ"ק
        while (malachiCursor === gatCursor) {
          malachiCursor = (malachiCursor + 1) % n;
        }
        state.schedule[`day_${d}_${slot.malachi}`] = hafkRoles[malachiCursor];
        malachiCursor = (malachiCursor + 1) % n;
      }

      // גת
      if (!state.schedule[`day_${d}_${slot.gat}`]) {
        while (gatCursor === malachiCursor % n) {
          gatCursor = (gatCursor + 1) % n;
        }
        state.schedule[`day_${d}_${slot.gat}`] = hafkRoles[gatCursor];
        gatCursor = (gatCursor + 1) % n;
      }
    });
  }
}

function clearSched() {
  Object.keys(state.schedule).forEach(k => {
    if (k.includes('_shift_') || k.match(/day_\d+_t\d/)) delete state.schedule[k];
  });
  save(); renderAll();
}

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
