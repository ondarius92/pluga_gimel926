const ROLES = ['maplag','shaga','hafk1','hafk2','hafk3','hafkmap','hamal','truck','doctor','camp','rescue','home','other'];

const ROLE_LABEL = {
  maplag:'מפל"ג', shaga:'ש"ג', hafk1:'חפ"ק 1', hafk2:'חפ"ק 2',
  hafk3:'חפ"ק 3', hafkmap:'חפ"ק מ"פ', hamal:'חמ"ל', truck:'נהג משאית',
  doctor:'רופא פלוגתי', camp:'הגנת מחנה + חמל', rescue:'כוח חילוץ אוטובוס',
  home:'בבית', other:'אחר'
};

const ROLE_EMOJI = {
  maplag:'🎖️', shaga:'🔵', hafk1:'🟠', hafk2:'🔴', hafk3:'🟢',
  hafkmap:'🟣', hamal:'🟤', truck:'🚛', doctor:'🏥', camp:'🏕️',
  rescue:'🚌', home:'🏠', other:'❔'
};

const EXCLUDE_FROM_SCHED = ['doctor','maplag'];

const DAY_NAMES = ['יום א׳','יום ב׳','יום ג׳','יום ד׳','יום ה׳','יום ו׳','שבת'];
const DAY_SHORT = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

const SHAGA_SHIFTS = [];
for (let h = 0; h < 24; h += 2) {
  const e = h + 2;
  SHAGA_SHIFTS.push({
    h,
    label: `${String(h).padStart(2,'0')}:00–${String(e).padStart(2,'0')}:00`,
    isNight: h < 8
  });
}

const TOUR_WINDOWS = ['חפ"ק ק. מלאכי יום 10:00–22:00','חפ"ק ק. מלאכי לילה 22:00–10:00'];
const TOUR_KEYS    = ['t1','t2'];

const TOUR_OPT = [
  {v:'',      l:'— בחר חפ"ק —'},
  {v:'hafk1', l:'חפ"ק 1'},
  {v:'hafk2', l:'חפ"ק 2'},
  {v:'hafk3', l:'חפ"ק 3'}
];

const HAFK_LABEL_MAP = {
  hafk1:'חפ"ק 1', hafk2:'חפ"ק 2', hafk3:'חפ"ק 3',
  hafkmap:'חפ"ק מ"פ', hafksmp:'חפ"ק סמ"פ'
};

function hafkLabel(v) { return HAFK_LABEL_MAP[v] || v; }

const BANNED_NAMES = [];
