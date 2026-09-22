'use strict';

/* =========================================================
   まいにちの日記  —  データはこの端末のブラウザ(localStorage)に保存
   ========================================================= */

const STORE_KEY = 'mainichi-nikki-v1';
const WD = ['日', '月', '火', '水', '木', '金', '土'];

const DEFAULT_TIMETABLE = {
  1: [['1', '朝の運動・朝の会'], ['2', '数学'], ['3', '自立活動'], ['4', 'ワーク'], ['5', '外国語']],
  2: [['1', '朝の運動・朝の会'], ['2', '国語'], ['3', '体育'], ['4', 'ワーク'], ['5・6', '美術']],
  3: [['1', '朝の運動・朝の会'], ['2', '数学'], ['3', '自立活動'], ['4', 'ワーク'], ['5', '特別活動'], ['6', '道徳']],
  4: [['1', '朝の運動・朝の会'], ['2・3', 'チャレンジ'], ['4', 'ワーク'], ['5', '体育'], ['6', '国語']],
  5: [['1', '朝の運動・朝の会'], ['2・3', 'ライフ'], ['4', 'ワーク'], ['5・6', '音楽']]
};

// 2026年の祝日(カレンダー設定で上書き・追加できます)
const HOLIDAYS = {
  '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日', '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日', '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
  '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日'
};

const RATINGS = {
  great: { mark: '◎', label: 'よくできた' },
  good: { mark: '○', label: 'できた' },
  try: { mark: '△', label: 'もう少し' }
};
const MOODS = {
  happy: { mark: '😄', label: 'たのしい' },
  ok: { mark: '🙂', label: 'ふつう' },
  tired: { mark: '😪', label: 'つかれた' },
  sad: { mark: '😢', label: 'かなしい' }
};
const STAMPS = { hanamaru: 'はなまる', great: 'よく がんばり ました', seen: 'みました' };

const SUBJECT_COLORS = {
  '朝の運動・朝の会': '#8FB8DE', '数学': '#6C9BD2', '国語': '#E58F8F', '自立活動': '#7CC49A',
  'ワーク': '#C9A46A', '外国語': '#A08BD1', '体育': '#EFA255', '美術': '#E08AB8',
  '特別活動': '#6FC3C0', '道徳': '#B5B85C', 'チャレンジ': '#5FB37A', 'ライフ': '#D9B44A', '音楽': '#9C8FE0'
};

/* ---------- 小さな道具 ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const mondayOf = s => { const d = parse(s); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w)); return ymd(d); };
const jpDate = s => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`; };
const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function subjectColor(s) {
  if (SUBJECT_COLORS[s]) return SUBJECT_COLORS[s];
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 68%)`;
}

/* ---------- データ ---------- */
function defaultTimetable() {
  const t = {};
  Object.keys(DEFAULT_TIMETABLE).forEach(k => { t[k] = DEFAULT_TIMETABLE[k].map(([p, s]) => ({ p, s })); });
  return t;
}
function defaultState() {
  return { version: 1, students: [], currentId: null, pin: '1234', timetable: defaultTimetable(), calendar: {}, records: {}, reflections: {} };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* 読めない場合は新しく始める */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('保存できませんでした。ブラウザのプライベートモードを解除してください'); }
}

let state = load();
const todayStr = ymd(new Date());

function dayInfo(s) {
  const o = state.calendar[s];
  if (o) return { type: o.type, label: o.label || '' };
  if (HOLIDAYS[s]) return { type: 'off', label: HOLIDAYS[s], holiday: true };
  const w = parse(s).getDay();
  if (w === 0 || w === 6) return { type: 'off', label: '' };
  return { type: 'school', label: '' };
}
const isSchool = s => dayInfo(s).type !== 'off';
function nearestSchoolDay(s) {
  for (let i = 0; i < 40; i++) { const d = addDays(s, i); if (isSchool(d)) return d; }
  return s;
}
function stepSchoolDay(s, dir) {
  let d = s;
  for (let i = 0; i < 40; i++) { d = addDays(d, dir); if (isSchool(d)) return d; }
  return addDays(s, dir);
}

const sid = () => state.currentId;
const curStudent = () => state.students.find(s => s.id === state.currentId) || null;
function recsOf(id) { return state.records[id] || (state.records[id] = {}); }
function getRec(id, date) { return (state.records[id] || {})[date] || null; }
function ensureRec(id, date) {
  const r = recsOf(id);
  if (!r[date]) {
    const wd = parse(date).getDay();
    r[date] = {
      periods: (state.timetable[wd] || []).map(x => ({ p: x.p, s: x.s, content: '', done: false })),
      text: '', rating: '', mood: '', comment: '', stamp: '', updated: 0
    };
  }
  return r[date];
}
function hasContent(r) {
  return !!r && !!(r.text || r.rating || r.mood || r.comment || r.stamp || r.periods.some(p => p.done || p.content));
}
function touch(r) { r.updated = Date.now(); save(); }

/* ---------- 画面の状態 ---------- */
const ui = {
  view: 'calendar',
  year: parse(todayStr).getFullYear(),
  month: parse(todayStr).getMonth(),
  date: nearestSchoolDay(todayStr),
  reviewMode: 'week',
  reviewAnchor: todayStr,
  teacher: false,
  teacherWeek: mondayOf(todayStr)
};

const $main = document.getElementById('main');
const $toast = document.getElementById('toast');
let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
}
function setPrintTitle(t) { document.getElementById('printTitle').textContent = t; }

/* ---------- 描画 ---------- */
function render() {
  if (!curStudent()) state.currentId = state.students[0] ? state.students[0].id : null;
  renderStudentSelect();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === ui.view)));
  document.getElementById('teacherBadge').hidden = !ui.teacher;

  if (!state.students.length && ui.view !== 'teacher') { renderWelcome(); return; }
  ({ calendar: renderCalendar, day: renderDay, review: renderReview, teacher: renderTeacher })[ui.view]();
}

function renderStudentSelect() {
  const sel = document.getElementById('studentSelect');
  sel.innerHTML = state.students.length
    ? state.students.map(s => `<option value="${esc(s.id)}"${s.id === state.currentId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')
    : '<option>(まだいません)</option>';
  sel.disabled = !state.students.length;
}

function renderWelcome() {
  setPrintTitle('');
  $main.innerHTML = `
    <section class="panel welcome">
      <h2>はじめに なまえを 登録しよう</h2>
      <p class="hint">登録すると、カレンダーから日記を書けるようになります。</p>
      <div class="inline-form">
        <label class="sr-only" for="welcomeName">なまえ</label>
        <input type="text" id="welcomeName" placeholder="なまえ" autocomplete="off">
        <button class="btn primary" data-act="welcomeStart">はじめる</button>
      </div>
      <p class="note">先生が複数の生徒を登録する場合は「先生」タブから登録できます。</p>
    </section>`;
}

/* カレンダー */
function renderCalendar() {
  const y = ui.year, m = ui.month;
  const startW = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const st = curStudent();
  let cells = '';
  for (let i = 0; i < startW; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= days; d++) {
    const s = `${y}-${pad(m + 1)}-${pad(d)}`;
    const info = dayInfo(s);
    const w = (startW + d - 1) % 7;
    const r = getRec(sid(), s);
    const done = r ? r.periods.filter(p => p.done).length : 0;
    const cls = ['cal-cell', info.type, 'w' + w, info.holiday ? 'holiday' : '', s === todayStr ? 'today' : '', s === ui.date ? 'selected' : ''].join(' ');
    cells += `
      <button class="${cls}" data-act="openDay" data-date="${s}" aria-label="${jpDate(s)}${info.label ? ' ' + esc(info.label) : ''}">
        <span class="cal-num">${d}</span>
        ${info.label ? `<span class="cal-label">${esc(info.label)}</span>` : ''}
        <span class="cal-marks">
          ${hasContent(r) ? '<span>✎</span>' : ''}
          ${done ? `<span class="mk-star">★${done}</span>` : ''}
          ${r && r.rating ? `<span>${RATINGS[r.rating].mark}</span>` : ''}
          ${r && (r.stamp || r.comment) ? '<span>💮</span>' : ''}
        </span>
      </button>`;
  }
  setPrintTitle(`${st ? st.name + 'さんの' : ''}日記カレンダー ${y}年${m + 1}月`);
  $main.innerHTML = `
    <section class="panel">
      <div class="cal-head">
        <button class="btn ghost no-print" data-act="prevMonth" aria-label="前の月">◀</button>
        <button class="btn ghost no-print" data-act="nextMonth" aria-label="次の月">▶</button>
        <button class="btn small no-print" data-act="thisMonth">今月</button>
        <h2 class="cal-title"><span class="cal-year">${y}年</span>${m + 1}月</h2>
      </div>
      <div class="cal-grid">
        ${WD.map((w, i) => `<div class="cal-wd w${i}">${w}</div>`).join('')}
        ${cells}
      </div>
      <div class="legend">
        <span>✎ 書いた日</span><span>★ がんばった時間の数</span><span>◎○△ じぶんの評価</span><span>💮 先生から</span>
      </div>
    </section>
    <div class="actions no-print">
      <button class="btn" data-act="print">印刷する</button>
    </div>`;
}

/* 日記を書く */
function renderDay() {
  const s = ui.date;
  const info = dayInfo(s);
  const rec = ensureRec(sid(), s);
  const st = curStudent();

  const periods = rec.periods.length ? rec.periods.map((p, i) => `
    <li class="period${p.done ? ' done' : ''}" style="--sc:${subjectColor(p.s)}">
      <div class="period-head">
        <span class="period-no">${esc(p.p)}<small>校時</small></span>
        <span class="period-subj">${esc(p.s)}</span>
        <button class="effort-btn" data-act="toggleDone" data-i="${i}" aria-pressed="${p.done}">
          <span class="star">${p.done ? '★' : '☆'}</span> がんばった
        </button>
      </div>
      <label class="sr-only" for="c${i}">${esc(p.s)}で学習したこと</label>
      <input type="text" id="c${i}" data-field="content" data-i="${i}" value="${esc(p.content)}" placeholder="学習したこと(例:${esc(p.s)}のプリント)" autocomplete="off">
    </li>`).join('')
    : '<li class="hint">この日の時間割はありません。先生タブの「時間割」で設定できます。</li>';

  const picked = rec.periods.filter(p => p.done)
    .map(p => `<span class="chip" style="--sc:${subjectColor(p.s)}">${esc(p.s)}</span>`).join('');

  const choice = (group, act, cur) => Object.entries(group).map(([k, v]) => `
    <button class="choice" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">
      <span class="mark" aria-hidden="true">${v.mark}</span>${v.label}
    </button>`).join('');

  const noteView = (rec.comment || rec.stamp) ? `
    <div class="teacher-note">
      ${rec.stamp ? `<span class="stamp">${esc(STAMPS[rec.stamp])}</span>` : ''}
      <p>${esc(rec.comment)}</p>
    </div>` : '';

  let teacherHtml = '';
  if (ui.teacher) {
    teacherHtml = `
      <section class="panel teacher-panel">
        <h3 class="sec-title">先生から</h3>
        <div class="choice-row no-print" style="margin-bottom:10px">${choice(
          Object.fromEntries(Object.entries(STAMPS).map(([k, v]) => [k, { mark: '💮', label: v }])), 'setStamp', rec.stamp)}</div>
        <label class="sr-only" for="tcomment">先生のコメント</label>
        <textarea id="tcomment" class="no-print" data-field="comment" rows="3" placeholder="コメントを書く">${esc(rec.comment)}</textarea>
        <div class="print-only">${noteView}</div>
        <div class="actions no-print" style="margin-bottom:0">
          <button class="btn small" data-act="applyAll">学習内容をほかの生徒の日記にもうつす</button>
        </div>
      </section>`;
  } else if (noteView) {
    teacherHtml = `<section class="panel"><h3 class="sec-title">先生から</h3>${noteView}</section>`;
  }

  setPrintTitle(`${st ? st.name + 'さんの' : ''}日記 ${parse(s).getFullYear()}年${jpDate(s)}`);
  $main.innerHTML = `
    <section class="panel">
      <div class="day-head">
        <button class="btn ghost no-print" data-act="prevDay" aria-label="前の日">◀</button>
        <div class="day-title">
          <h2>${jpDate(s)}</h2>
          ${info.label ? `<span class="day-label">${esc(info.label)}</span>` : ''}
        </div>
        <button class="btn ghost no-print" data-act="nextDay" aria-label="次の日">▶</button>
      </div>
      <h3 class="sec-title">① 今日の学習<small>学習したことを書いて、がんばった時間の ☆ をおそう</small></h3>
      <ul class="periods">${periods}</ul>
    </section>

    <section class="panel">
      <h3 class="sec-title">② どんなことを がんばったかな</h3>
      <div class="picked">${picked || '<span class="hint">上の ☆ をおすと、がんばった時間がここに出ます</span>'}</div>
      <label class="sr-only" for="effortText">がんばったこと</label>
      <textarea id="effortText" data-field="text" rows="4" placeholder="例:体育でボールを遠くまで投げられた">${esc(rec.text)}</textarea>
      <div class="print-text">${esc(rec.text)}</div>
    </section>

    <section class="panel">
      <h3 class="sec-title">③ 今日の じぶん</h3>
      <div class="choice-group"><span class="choice-label">できたかな</span><div class="choice-row">${choice(RATINGS, 'setRating', rec.rating)}</div></div>
      <div class="choice-group"><span class="choice-label">きもち</span><div class="choice-row">${choice(MOODS, 'setMood', rec.mood)}</div></div>
    </section>

    ${teacherHtml}

    <div class="actions no-print">
      <button class="btn" data-act="backCal">カレンダーへ</button>
      <button class="btn" data-act="print">印刷する</button>
      <button class="btn primary" data-act="finishDay">記録する</button>
    </div>`;
}

/* ふりかえり */
function reviewRange() {
  if (ui.reviewMode === 'week') {
    const mon = mondayOf(ui.reviewAnchor);
    return {
      dates: [0, 1, 2, 3, 4].map(i => addDays(mon, i)),
      key: 'W' + mon,
      title: `${jpDate(mon)} 〜 ${jpDate(addDays(mon, 4))}`
    };
  }
  const d = parse(ui.reviewAnchor);
  const y = d.getFullYear(), m = d.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  const dates = [];
  for (let i = 1; i <= n; i++) { const s = `${y}-${pad(m + 1)}-${pad(i)}`; if (isSchool(s)) dates.push(s); }
  return { dates, key: `M${y}-${pad(m + 1)}`, title: `${y}年${m + 1}月` };
}

function renderReview() {
  const st = curStudent();
  const R = reviewRange();
  const rf = state.reflections[sid()] || {};

  const chips = r => r.periods.filter(p => p.done).map(p =>
    `<span class="chip" style="--sc:${subjectColor(p.s)}">${esc(p.s)}${p.content ? `<small>:${esc(p.content)}</small>` : ''}</span>`).join('') || '—';

  const rows = R.dates.map(s => {
    const info = dayInfo(s);
    const r = getRec(sid(), s);
    if (info.type === 'off') return `<tr class="off"><th scope="row">${jpDate(s)}</th><td colspan="5">お休み${info.label ? '(' + esc(info.label) + ')' : ''}</td></tr>`;
    const dateBtn = `<button class="linkish" data-act="openDay" data-date="${s}">${jpDate(s)}</button>`;
    if (!hasContent(r)) return `<tr class="blank"><th scope="row">${dateBtn}</th><td colspan="5">まだ書いていません</td></tr>`;
    return `<tr>
      <th scope="row">${dateBtn}</th>
      <td>${chips(r)}</td>
      <td class="txt">${esc(r.text) || '—'}</td>
      <td class="c">${r.rating ? RATINGS[r.rating].mark : '—'}</td>
      <td class="c">${r.mood ? MOODS[r.mood].mark : '—'}</td>
      <td>${r.stamp ? `<span class="mini-stamp">${esc(STAMPS[r.stamp])}</span>` : ''}${esc(r.comment)}</td>
    </tr>`;
  }).join('');

  const school = R.dates.filter(isSchool);
  const recs = school.map(s => getRec(sid(), s)).filter(hasContent);
  const rc = { great: 0, good: 0, try: 0 };
  const subj = {};
  let doneTotal = 0;
  recs.forEach(r => {
    if (r.rating) rc[r.rating]++;
    r.periods.forEach(p => { if (p.done) { subj[p.s] = (subj[p.s] || 0) + 1; doneTotal++; } });
  });
  const subjArr = Object.entries(subj).sort((a, b) => b[1] - a[1]);
  const max = subjArr.length ? subjArr[0][1] : 1;
  const bars = subjArr.length ? subjArr.map(([s, n]) => `
    <div class="bar-row">
      <span>${esc(s)}</span>
      <div class="bar-track"><div class="bar" style="width:${(n / max) * 100}%;--sc:${subjectColor(s)}"></div></div>
      <span>${n}回</span>
    </div>`).join('') : '<p class="hint">がんばった時間を選ぶと、ここに教科ごとの回数が出ます。</p>';

  const unit = ui.reviewMode === 'week' ? '週' : '月';
  const tKey = R.key + '_t';

  setPrintTitle(`${st ? st.name + 'さんの' : ''}ふりかえり ${R.title}`);
  $main.innerHTML = `
    <section class="panel">
      <div class="review-head no-print">
        <div class="seg" role="group" aria-label="まとめる期間">
          <button data-act="reviewMode" data-v="week" aria-pressed="${ui.reviewMode === 'week'}">1週間</button>
          <button data-act="reviewMode" data-v="month" aria-pressed="${ui.reviewMode === 'month'}">1か月</button>
        </div>
        <button class="btn ghost" data-act="reviewPrev" aria-label="前へ">◀</button>
        <button class="btn ghost" data-act="reviewNext" aria-label="次へ">▶</button>
        <button class="btn small" data-act="reviewNow">今${unit === '週' ? '週' : '月'}</button>
      </div>
      <h2 class="review-title">${R.title}</h2>
    </section>

    <section class="panel">
      <div class="stats">
        <div class="stat"><b>${recs.length} / ${school.length}日</b><span>日記を書いた日</span></div>
        <div class="stat"><b>${doneTotal}回</b><span>がんばった時間</span></div>
        <div class="stat"><b>◎${rc.great} ○${rc.good} △${rc.try}</b><span>じぶんの評価</span></div>
      </div>
      <h3 class="sec-title">教科ごとの がんばった回数</h3>
      <div class="bars">${bars}</div>
    </section>

    <section class="panel">
      <h3 class="sec-title">毎日の記録</h3>
      <div class="table-wrap">
        <table class="rtable">
          <thead><tr><th>日付</th><th>がんばった時間</th><th>がんばったこと</th><th>評価</th><th>きもち</th><th>先生から</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">この期間に授業日はありません。</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h3 class="sec-title">この${unit}の ふりかえり</h3>
      <label class="sr-only" for="refl">この${unit}のふりかえり</label>
      <textarea id="refl" data-field="reflection" data-key="${R.key}" rows="3" placeholder="この${unit}いちばんがんばったことは?">${esc(rf[R.key])}</textarea>
      <div class="print-text">${esc(rf[R.key])}</div>
      ${ui.teacher ? `
        <h3 class="sec-title" style="margin-top:16px">先生から</h3>
        <label class="sr-only" for="reflT">先生からのコメント</label>
        <textarea id="reflT" data-field="reflection" data-key="${tKey}" rows="3" placeholder="先生からのコメント">${esc(rf[tKey])}</textarea>
        <div class="print-text">${esc(rf[tKey])}</div>`
      : (rf[tKey] ? `<h3 class="sec-title" style="margin-top:16px">先生から</h3><p style="white-space:pre-wrap;margin:0">${esc(rf[tKey])}</p>` : '')}
    </section>

    <div class="actions no-print">
      <button class="btn" data-act="print">印刷する</button>
    </div>`;
}

/* 先生 */
function renderTeacher() {
  setPrintTitle('');
  if (!ui.teacher) {
    $main.innerHTML = `
      <section class="panel welcome">
        <h2>先生用の画面</h2>
        <p class="hint">パスワードを入力してください。</p>
        <div class="inline-form">
          <label class="sr-only" for="pinInput">パスワード</label>
          <input type="password" id="pinInput" inputmode="numeric" autocomplete="off">
          <button class="btn primary" data-act="login">ひらく</button>
        </div>
        <p class="note">最初のパスワードは 1234 です。ひらいたあと「パスワードの変更」で変えてください。</p>
      </section>`;
    return;
  }

  const mon = ui.teacherWeek;
  const dates = [0, 1, 2, 3, 4].map(i => addDays(mon, i));
  const gridRows = state.students.map(st => {
    const cells = dates.map(s => {
      if (!isSchool(s)) return '<td class="off">休</td>';
      const r = getRec(st.id, s);
      if (!hasContent(r)) return `<td><button class="cell-btn missing" data-act="openFor" data-sid="${esc(st.id)}" data-date="${s}">未</button></td>`;
      const done = r.periods.filter(p => p.done).length;
      return `<td><button class="cell-btn" data-act="openFor" data-sid="${esc(st.id)}" data-date="${s}">
        ${r.rating ? RATINGS[r.rating].mark : '✎'}${done ? ' ★' + done : ''}${r.comment || r.stamp ? ' 💮' : ''}</button></td>`;
    }).join('');
    return `<tr><th scope="row"><button class="linkish" data-act="reviewFor" data-sid="${esc(st.id)}">${esc(st.name)}</button></th>${cells}</tr>`;
  }).join('');

  const studentItems = state.students.map(st => `
    <li><span>${esc(st.name)}</span>
      <button class="btn small" data-act="renameStudent" data-sid="${esc(st.id)}">名前を変える</button>
      <button class="btn small danger" data-act="deleteStudent" data-sid="${esc(st.id)}">削除</button>
    </li>`).join('');

  const tt = [1, 2, 3, 4, 5].map(w => `
    <div>
      <label for="tt${w}">${WD[w]}曜日</label>
      <textarea id="tt${w}" rows="7">${esc((state.timetable[w] || []).map(x => `${x.p},${x.s}`).join('\n'))}</textarea>
    </div>`).join('');

  const typeName = { school: '授業日', event: '行事', off: '休み' };
  const calItems = Object.keys(state.calendar).sort().map(d => {
    const o = state.calendar[d];
    return `<li><span>${parse(d).getFullYear()}年${jpDate(d)} ${typeName[o.type]}${o.label ? '(' + esc(o.label) + ')' : ''}</span>
      <button class="btn small danger" data-act="delCalendar" data-date="${d}">取り消す</button></li>`;
  }).join('');

  setPrintTitle(`日記の記録状況 ${jpDate(dates[0])} 〜 ${jpDate(dates[4])}`);
  $main.innerHTML = `
    <section class="panel">
      <div class="review-head">
        <h2 class="sec-title" style="margin:0;flex:1">生徒の記録(1週間)</h2>
        <button class="btn ghost no-print" data-act="tWeekPrev" aria-label="前の週">◀</button>
        <button class="btn ghost no-print" data-act="tWeekNext" aria-label="次の週">▶</button>
        <button class="btn small no-print" data-act="tWeekNow">今週</button>
      </div>
      <p class="note">${jpDate(dates[0])} 〜 ${jpDate(dates[4])}。ボタンをおすと、その日の日記をひらいてコメントを書けます。名前をおすと、その生徒のふりかえりをひらきます。</p>
      ${state.students.length ? `
      <div class="table-wrap" style="margin-top:10px">
        <table class="rtable tgrid">
          <thead><tr><th>名前</th>${dates.map(s => `<th>${jpDate(s)}</th>`).join('')}</tr></thead>
          <tbody>${gridRows}</tbody>
        </table>
      </div>` : '<p class="hint">下の「生徒の登録」から生徒を追加してください。</p>'}
      <div class="actions no-print" style="margin-bottom:0"><button class="btn" data-act="print">この表を印刷する</button></div>
    </section>

    <section class="panel no-print">
      <h3 class="sec-title">生徒の登録</h3>
      <ul class="student-list">${studentItems}</ul>
      <div class="inline-form">
        <label class="sr-only" for="newStudent">生徒の名前</label>
        <input type="text" id="newStudent" placeholder="生徒の名前" autocomplete="off">
        <button class="btn primary" data-act="addStudent">追加する</button>
      </div>
    </section>

    <section class="panel no-print">
      <h3 class="sec-title">時間割<small>1行に「校時,教科」の形で書きます(例:5・6,美術)。変更はこれから書く日記に反映され、書いた日記はそのまま残ります。</small></h3>
      <div class="tt-grid">${tt}</div>
      <div class="actions" style="margin-bottom:0">
        <button class="btn" data-act="resetTimetable">はじめの時間割にもどす</button>
        <button class="btn primary" data-act="saveTimetable">時間割を保存する</button>
      </div>
    </section>

    <section class="panel no-print">
      <h3 class="sec-title">カレンダーの設定<small>2026年の祝日は入力ずみです。休校日・行事・振替授業日などを追加できます。</small></h3>
      <div class="form-row">
        <label>日付<input type="date" id="calDate" value="${ui.date}"></label>
        <label>種類
          <select id="calType" class="field">
            <option value="off">休み</option>
            <option value="event">行事(日記を書く)</option>
            <option value="school">授業日</option>
          </select>
        </label>
        <label>名前(任意)<input type="text" id="calLabel" placeholder="例:学園祭、開校記念日"></label>
        <button class="btn primary" data-act="addCalendar">追加する</button>
      </div>
      <ul class="cal-list">${calItems || '<li class="hint">追加した日はまだありません。</li>'}</ul>
    </section>

    <section class="panel no-print">
      <h3 class="sec-title">データの書き出し・読み込み<small>記録はこの端末のブラウザに保存されます。生徒がそれぞれのiPadで書いた日記は「書き出す」で保存し、先生の端末で「読み込む」とまとめて確認できます(同じ名前の生徒に合流します)。</small></h3>
      <label class="check"><input type="checkbox" id="importSettings"> 時間割とカレンダーの設定も読み込む</label>
      <div class="actions" style="justify-content:flex-start;margin-bottom:0">
        <button class="btn primary" data-act="exportData">書き出す(JSON)</button>
        <label class="btn file-btn">読み込む<input type="file" id="importFile" accept=".json,application/json"></label>
        <button class="btn danger" data-act="resetAll">この端末のデータをすべて消す</button>
      </div>
    </section>

    <section class="panel no-print">
      <h3 class="sec-title">パスワードの変更</h3>
      <div class="inline-form">
        <input type="password" id="pinNew" placeholder="新しいパスワード(4文字以上)" autocomplete="new-password">
        <input type="password" id="pinNew2" placeholder="もう一度" autocomplete="new-password">
        <button class="btn" data-act="changePin">変更する</button>
      </div>
    </section>

    <div class="actions no-print">
      <button class="btn" data-act="logout">先生モードを終わる</button>
    </div>`;
}

/* ---------- 取り込み ---------- */
function importData(d) {
  if (!d || !Array.isArray(d.students) || typeof d.records !== 'object') throw new Error('format');
  let added = 0, merged = 0;
  d.students.forEach(ist => {
    let local = state.students.find(s => s.name === ist.name);
    if (!local) {
      local = { id: state.students.some(s => s.id === ist.id) ? newId() : ist.id, name: ist.name };
      state.students.push(local);
      added++;
    }
    const src = d.records[ist.id] || {};
    const dst = recsOf(local.id);
    Object.entries(src).forEach(([date, r]) => {
      const cur = dst[date];
      if (!cur || (r.updated || 0) > (cur.updated || 0)) {
        const copy = JSON.parse(JSON.stringify(r));
        if (cur) {
          if (!copy.comment) copy.comment = cur.comment || '';
          if (!copy.stamp) copy.stamp = cur.stamp || '';
        }
        dst[date] = copy;
        merged++;
      }
    });
    const srf = (d.reflections || {})[ist.id] || {};
    const drf = state.reflections[local.id] || (state.reflections[local.id] = {});
    Object.entries(srf).forEach(([k, v]) => { if (v && !drf[k]) drf[k] = v; });
  });
  if (document.getElementById('importSettings')?.checked) {
    if (d.timetable) state.timetable = d.timetable;
    if (d.calendar) state.calendar = Object.assign({}, state.calendar, d.calendar);
  }
  if (!curStudent() && state.students[0]) state.currentId = state.students[0].id;
  save();
  render();
  toast(`読み込みました(生徒 ${added}人追加・記録 ${merged}件)`);
}

/* ---------- 操作 ---------- */
const shiftMonth = (s, n) => { const d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const findStudent = id => state.students.find(s => s.id === id);
function addStudentByName(name) {
  const n = name.trim();
  if (!n) { toast('名前を入力してください'); return false; }
  const st = { id: newId(), name: n };
  state.students.push(st);
  if (!curStudent()) state.currentId = st.id;
  save();
  return st;
}
function goTop() { window.scrollTo(0, 0); }

const actions = {
  welcomeStart() {
    if (addStudentByName(document.getElementById('welcomeName').value)) { ui.view = 'calendar'; render(); }
  },
  prevMonth() { if (--ui.month < 0) { ui.month = 11; ui.year--; } render(); },
  nextMonth() { if (++ui.month > 11) { ui.month = 0; ui.year++; } render(); },
  thisMonth() { const d = new Date(); ui.year = d.getFullYear(); ui.month = d.getMonth(); render(); },
  openDay(t) {
    const s = t.dataset.date;
    if (!isSchool(s) && !ui.teacher) { toast('お休みの日です'); return; }
    ui.date = s; ui.view = 'day'; render(); goTop();
  },
  toggleDone(t) { const r = ensureRec(sid(), ui.date); const p = r.periods[+t.dataset.i]; p.done = !p.done; touch(r); render(); },
  setRating(t) { const r = ensureRec(sid(), ui.date); r.rating = r.rating === t.dataset.v ? '' : t.dataset.v; touch(r); render(); },
  setMood(t) { const r = ensureRec(sid(), ui.date); r.mood = r.mood === t.dataset.v ? '' : t.dataset.v; touch(r); render(); },
  setStamp(t) { const r = ensureRec(sid(), ui.date); r.stamp = r.stamp === t.dataset.v ? '' : t.dataset.v; touch(r); render(); },
  prevDay() { ui.date = ui.teacher ? addDays(ui.date, -1) : stepSchoolDay(ui.date, -1); render(); },
  nextDay() { ui.date = ui.teacher ? addDays(ui.date, 1) : stepSchoolDay(ui.date, 1); render(); },
  finishDay() { touch(ensureRec(sid(), ui.date)); toast('記録しました'); },
  backCal() { const d = parse(ui.date); ui.year = d.getFullYear(); ui.month = d.getMonth(); ui.view = 'calendar'; render(); goTop(); },
  applyAll() {
    const src = ensureRec(sid(), ui.date);
    if (!confirm('この日の学習内容を、ほかの生徒の日記の空いている欄にうつします。よろしいですか?')) return;
    let n = 0;
    state.students.forEach(st => {
      if (st.id === sid()) return;
      const r = ensureRec(st.id, ui.date);
      r.periods.forEach(p => {
        const m = src.periods.find(q => q.p === p.p && q.s === p.s);
        if (m && m.content && !p.content) { p.content = m.content; n++; }
      });
      if (n) r.updated = Date.now();
    });
    save(); toast(`${n}か所にうつしました`);
  },
  print() { render(); setTimeout(() => window.print(), 60); },

  reviewMode(t) { ui.reviewMode = t.dataset.v; render(); },
  reviewPrev() { ui.reviewAnchor = ui.reviewMode === 'week' ? addDays(ui.reviewAnchor, -7) : shiftMonth(ui.reviewAnchor, -1); render(); },
  reviewNext() { ui.reviewAnchor = ui.reviewMode === 'week' ? addDays(ui.reviewAnchor, 7) : shiftMonth(ui.reviewAnchor, 1); render(); },
  reviewNow() { ui.reviewAnchor = todayStr; render(); },

  login() {
    if (document.getElementById('pinInput').value === state.pin) { ui.teacher = true; render(); toast('先生モードになりました'); }
    else toast('パスワードがちがいます');
  },
  logout() { ui.teacher = false; ui.view = 'calendar'; render(); goTop(); },
  tWeekPrev() { ui.teacherWeek = addDays(ui.teacherWeek, -7); render(); },
  tWeekNext() { ui.teacherWeek = addDays(ui.teacherWeek, 7); render(); },
  tWeekNow() { ui.teacherWeek = mondayOf(todayStr); render(); },
  openFor(t) { state.currentId = t.dataset.sid; save(); ui.date = t.dataset.date; ui.view = 'day'; render(); goTop(); },
  reviewFor(t) { state.currentId = t.dataset.sid; save(); ui.reviewMode = 'week'; ui.reviewAnchor = ui.teacherWeek; ui.view = 'review'; render(); goTop(); },

  addStudent() {
    const el = document.getElementById('newStudent');
    const st = addStudentByName(el.value);
    if (st) { render(); toast(`${st.name}さんを追加しました`); }
  },
  renameStudent(t) {
    const st = findStudent(t.dataset.sid);
    const n = prompt('新しい名前', st.name);
    if (n && n.trim()) { st.name = n.trim(); save(); render(); }
  },
  deleteStudent(t) {
    const st = findStudent(t.dataset.sid);
    if (!confirm(`${st.name}さんと、その記録をすべて削除します。よろしいですか?`)) return;
    state.students = state.students.filter(s => s.id !== st.id);
    delete state.records[st.id];
    delete state.reflections[st.id];
    save(); render(); toast('削除しました');
  },
  saveTimetable() {
    for (let w = 1; w <= 5; w++) {
      state.timetable[w] = document.getElementById('tt' + w).value.split('\n').map(line => {
        const parts = line.split(/[,,、\t]/);
        const p = (parts.shift() || '').trim();
        const s = parts.join(',').trim();
        return p && s ? { p, s } : null;
      }).filter(Boolean);
    }
    save(); toast('時間割を保存しました');
  },
  resetTimetable() {
    if (!confirm('時間割をはじめの内容にもどします。よろしいですか?')) return;
    state.timetable = defaultTimetable(); save(); render(); toast('はじめの時間割にもどしました');
  },
  addCalendar() {
    const d = document.getElementById('calDate').value;
    if (!d) { toast('日付を選んでください'); return; }
    state.calendar[d] = { type: document.getElementById('calType').value, label: document.getElementById('calLabel').value.trim() };
    save(); render(); toast('カレンダーに追加しました');
  },
  delCalendar(t) { delete state.calendar[t.dataset.date]; save(); render(); },
  exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const names = state.students.length === 1 ? '-' + state.students[0].name : '';
    a.href = URL.createObjectURL(blob);
    a.download = `nikki${names}-${todayStr}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('書き出しました');
  },
  resetAll() {
    if (!confirm('この端末の日記・生徒・設定をすべて消します。先に「書き出す」で保存しておくことをおすすめします。消しますか?')) return;
    if (!confirm('本当に消しますか?もとにはもどせません。')) return;
    localStorage.removeItem(STORE_KEY);
    state = defaultState(); ui.teacher = false; ui.view = 'calendar'; render(); toast('すべて消しました');
  },
  changePin() {
    const a = document.getElementById('pinNew').value, b = document.getElementById('pinNew2').value;
    if (a.length < 4) { toast('4文字以上で入力してください'); return; }
    if (a !== b) { toast('2つの入力が一致しません'); return; }
    state.pin = a; save(); render(); toast('パスワードを変更しました');
  }
};

/* ---------- イベント ---------- */
$main.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (t && actions[t.dataset.act]) actions[t.dataset.act](t);
});

$main.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const map = { welcomeName: 'welcomeStart', pinInput: 'login', newStudent: 'addStudent' };
  if (map[e.target.id]) { e.preventDefault(); actions[map[e.target.id]](); }
});

$main.addEventListener('input', e => {
  const el = e.target;
  const f = el.dataset.field;
  if (!f) return;
  if (f === 'reflection') {
    const rf = state.reflections[sid()] || (state.reflections[sid()] = {});
    rf[el.dataset.key] = el.value;
    save();
    return;
  }
  const r = ensureRec(sid(), ui.date);
  if (f === 'content') r.periods[+el.dataset.i].content = el.value;
  else r[f] = el.value;
  touch(r);
});

$main.addEventListener('change', e => {
  if (e.target.id !== 'importFile') return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { importData(JSON.parse(reader.result)); }
    catch (err) { toast('読み込めませんでした。このアプリで書き出したJSONファイルを選んでください'); }
    e.target.value = '';
  };
  reader.readAsText(file);
});

document.getElementById('studentSelect').addEventListener('change', e => {
  state.currentId = e.target.value;
  save();
  render();
});

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (!b) return;
  ui.view = b.dataset.view;
  if (ui.view === 'day' && !isSchool(ui.date) && !ui.teacher) ui.date = nearestSchoolDay(todayStr);
  render();
  goTop();
});

window.addEventListener('beforeprint', render);

render();
