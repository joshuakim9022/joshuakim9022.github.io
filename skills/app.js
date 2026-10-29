'use strict';

/* ---------- storage ---------- */
const KEY = 'skilltracker.v1';
const COLORS = ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.skills) && Array.isArray(s.sessions)) return s;
  } catch (e) { /* fall through */ }
  return { skills: [], sessions: [], timer: null };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Could not save: storage is full or blocked.'); }
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const skillById = id => state.skills.find(s => s.id === id);
const sessionsOf = id => state.sessions.filter(s => s.skillId === id);
const dur = s => Math.max(0, s.end - s.start);

function fmt(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + 'm';
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}
function clock(ms) {
  const t = Math.floor(ms / 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const DAY = 86400000;
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const total = list => list.reduce((a, s) => a + dur(s), 0);
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDateTime = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const toLocalInput = t => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

function streak(id) {
  const days = new Set(sessionsOf(id).map(s => dayStart(s.start)));
  let d = dayStart(Date.now());
  if (!days.has(d)) d -= DAY; // today not yet logged doesn't break the streak
  let n = 0;
  while (days.has(d)) { n++; d -= DAY; }
  return n;
}

/* ---------- modal ---------- */
function modal(title, body, actions) {
  const root = document.getElementById('dialog-root');
  const close = () => root.replaceChildren();
  const bg = h('div', { class: 'modal-bg', onclick: e => { if (e.target === bg) close(); } },
    h('div', { class: 'modal' }, h('h1', {}, title), body,
      h('div', { class: 'row' }, ...actions(close))));
  root.replaceChildren(bg);
  const first = bg.querySelector('input,textarea,select');
  if (first) first.focus();
}

/* ---------- actions ---------- */
function startTimer(skillId) {
  if (state.timer) stopTimer();
  state.timer = { skillId, start: Date.now() };
  save(); render();
}
function stopTimer() {
  const t = state.timer;
  if (!t) return;
  const end = Date.now();
  if (end - t.start >= 1000) state.sessions.push({ id: uid(), skillId: t.skillId, start: t.start, end, note: '' });
  state.timer = null;
  save(); render();
}

function skillForm(skill) {
  const isNew = !skill;
  const name = h('input', { value: skill ? skill.name : '', placeholder: 'e.g. Guitar', maxlength: 60 });
  const color = h('input', { type: 'color', value: skill ? skill.color : COLORS[state.skills.length % COLORS.length] });
  const goal = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: skill && skill.goalHours ? skill.goalHours : '', placeholder: 'optional, e.g. 100' });
  modal(isNew ? 'New skill' : 'Edit skill',
    h('div', {}, h('label', {}, 'Name'), name, h('label', {}, 'Color'), color, h('label', {}, 'Goal (hours)'), goal),
    close => [
      h('button', { class: 'ghost grow', onclick: close }, 'Cancel'),
      h('button', {
        class: 'primary grow', onclick: () => {
          const n = name.value.trim();
          if (!n) { name.focus(); return; }
          const g = Math.max(0, parseFloat(goal.value) || 0);
          if (isNew) state.skills.push({ id: uid(), name: n, color: color.value, goalHours: g, levels: [], milestones: [], created: Date.now() });
          else Object.assign(skill, { name: n, color: color.value, goalHours: g });
          save(); close(); render();
        },
      }, 'Save'),
    ]);
}

function logForm(skill) {
  const now = Date.now();
  const start = h('input', { type: 'datetime-local', value: toLocalInput(now - 3600000) });
  const mins = h('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', value: 30 });
  const note = h('input', { placeholder: 'What did you work on? (optional)', maxlength: 200 });
  modal('Log a session',
    h('div', {}, h('label', {}, 'Started'), start, h('label', {}, 'Minutes'), mins, h('label', {}, 'Note'), note),
    close => [
      h('button', { class: 'ghost grow', onclick: close }, 'Cancel'),
      h('button', {
        class: 'primary grow', onclick: () => {
          const s = new Date(start.value).getTime(), m = parseFloat(mins.value);
          if (!s || !(m > 0)) return;
          state.sessions.push({ id: uid(), skillId: skill.id, start: s, end: s + m * 60000, note: note.value.trim() });
          save(); close(); render();
        },
      }, 'Add'),
    ]);
}

function addMilestone(skill) {
  const text = h('input', { placeholder: 'e.g. Play the song start to finish', maxlength: 120 });
  modal('New milestone', h('div', {}, h('label', {}, 'Milestone'), text), close => [
    h('button', { class: 'ghost grow', onclick: close }, 'Cancel'),
    h('button', {
      class: 'primary grow', onclick: () => {
        if (!text.value.trim()) return;
        skill.milestones.push({ id: uid(), text: text.value.trim(), done: false, doneAt: null });
        save(); close(); render();
      },
    }, 'Add'),
  ]);
}

function confirmDelete(what, fn) {
  modal('Delete?', h('p', { class: 'muted' }, `This will permanently delete ${what}.`), close => [
    h('button', { class: 'ghost grow', onclick: close }, 'Cancel'),
    h('button', { class: 'stop grow', onclick: () => { fn(); save(); close(); render(); } }, 'Delete'),
  ]);
}

/* ---------- views ---------- */
let tickTimer = null;

function timerBanner() {
  if (!state.timer) return null;
  const sk = skillById(state.timer.skillId);
  const big = h('div', { class: 'big' }, clock(Date.now() - state.timer.start));
  big.dataset.tick = '1';
  return h('div', { class: 'banner' },
    h('div', { class: 'muted', style: 'color:#04121c' }, 'Tracking ' + (sk ? sk.name : '')),
    big,
    h('button', { class: 'stop full', style: 'margin-top:8px', onclick: stopTimer }, 'Stop'));
}

function viewHome() {
  const wk = weekStart();
  const cards = state.skills.map(sk => {
    const list = sessionsOf(sk.id);
    const all = total(list);
    const week = total(list.filter(s => s.start >= wk));
    const running = state.timer && state.timer.skillId === sk.id;
    return h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('a', { class: 'row grow', href: '#/skill/' + sk.id },
          h('span', { class: 'dot', style: 'background:' + sk.color }),
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, sk.name),
            h('div', { class: 'muted' }, `${fmt(all)} total · ${fmt(week)} this week`))),
        running
          ? h('button', { class: 'stop', onclick: stopTimer }, 'Stop')
          : h('button', { class: 'primary', onclick: () => startTimer(sk.id) }, 'Start')),
      sk.goalHours ? progressBar(all / (sk.goalHours * 3600000), sk.color) : null);
  });
  return h('div', {},
    timerBanner(),
    h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('h1', { class: 'grow', style: 'margin:0' }, 'Skills'),
      h('button', { class: 'primary', onclick: () => skillForm() }, '+ Add')),
    cards.length ? cards : h('div', { class: 'empty' }, 'No skills yet. Add one to start tracking time.'));
}

function progressBar(frac, color) {
  return h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, frac * 100)}%;background:${color}` }));
}

function viewSkill(id) {
  const sk = skillById(id);
  if (!sk) return h('div', { class: 'empty' }, 'Skill not found.');
  const list = sessionsOf(id).sort((a, b) => b.start - a.start);
  const all = total(list);
  const running = state.timer && state.timer.skillId === id;
  const level = sk.levels.length ? sk.levels[sk.levels.length - 1].v : 1;

  const slider = h('input', { type: 'range', min: 1, max: 10, step: 1, value: level });
  const lvlLabel = h('b', {}, String(level));
  slider.addEventListener('input', () => { lvlLabel.textContent = slider.value; });
  slider.addEventListener('change', () => {
    const v = +slider.value, last = sk.levels[sk.levels.length - 1];
    if (!last || last.v !== v) { sk.levels.push({ t: Date.now(), v }); save(); render(); }
  });

  const msDone = sk.milestones.filter(m => m.done).length;

  return h('div', {},
    h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('a', { href: '#/', class: 'muted' }, '‹ Back'),
      h('div', { class: 'grow' }),
      h('button', { class: 'sm', onclick: () => skillForm(sk) }, 'Edit')),
    h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('span', { class: 'dot', style: 'background:' + sk.color }),
      h('h1', { style: 'margin:0' }, sk.name)),
    timerBanner(),
    h('div', { class: 'row' },
      running ? h('button', { class: 'stop grow', onclick: stopTimer }, 'Stop timer')
        : h('button', { class: 'primary grow', onclick: () => startTimer(id) }, 'Start timer'),
      h('button', { onclick: () => logForm(sk) }, 'Log past')),
    h('div', { class: 'stats', style: 'margin-top:12px' },
      stat(fmt(all), 'total'),
      stat(fmt(total(list.filter(s => s.start >= weekStart()))), 'this week'),
      stat(streak(id) + 'd', 'streak')),
    sk.goalHours ? h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Goal'), h('span', { class: 'muted' }, `${fmt(all)} / ${sk.goalHours}h`)),
      progressBar(all / (sk.goalHours * 3600000), sk.color)) : null,

    h('h2', {}, 'Skill level'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Self-rating (1–10)'), lvlLabel),
      slider,
      sk.levels.length ? h('div', { class: 'hist' }, sk.levels.slice(-8).map(l => h('span', {}, `${fmtDate(l.t)}: ${l.v}`))) : null),

    h('h2', {}, `Milestones${sk.milestones.length ? ` (${msDone}/${sk.milestones.length})` : ''}`),
    h('div', { class: 'card' },
      sk.milestones.map(m => h('div', { class: 'ms' + (m.done ? ' done' : '') },
        h('input', {
          type: 'checkbox', checked: m.done, onchange: e => {
            m.done = e.target.checked; m.doneAt = m.done ? Date.now() : null; save(); render();
          },
        }),
        h('span', { class: 'grow' }, m.text),
        h('button', { class: 'danger sm', onclick: () => { sk.milestones = sk.milestones.filter(x => x !== m); save(); render(); } }, '✕'))),
      h('button', { class: 'sm', style: 'margin-top:8px', onclick: () => addMilestone(sk) }, '+ Milestone')),

    h('h2', {}, 'Sessions'),
    list.length ? list.slice(0, 30).map(s => h('div', { class: 'card row' },
      h('div', { class: 'grow' },
        h('div', {}, fmt(dur(s))),
        h('div', { class: 'muted' }, fmtDateTime(s.start) + (s.note ? ' · ' + s.note : ''))),
      h('button', { class: 'danger sm', onclick: () => confirmDelete('this session', () => { state.sessions = state.sessions.filter(x => x !== s); }) }, 'Delete')))
      : h('div', { class: 'empty' }, 'No sessions yet.'),

    h('button', { class: 'danger full', style: 'margin-top:24px', onclick: () => confirmDelete(`"${sk.name}" and all its sessions`, () => {
      if (state.timer && state.timer.skillId === id) state.timer = null;
      state.skills = state.skills.filter(s => s !== sk);
      state.sessions = state.sessions.filter(s => s.skillId !== id);
      location.hash = '#/';
    }) }, 'Delete skill'));
}
const stat = (v, l) => h('div', { class: 'stat' }, h('b', {}, v), h('span', { class: 'muted' }, l));

function viewStats() {
  if (!state.skills.length) return h('div', { class: 'empty' }, 'Add a skill to see progress.');
  const today = dayStart(Date.now());
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);

  // stacked bars: last 14 days
  const perDay = days.map(d => state.skills.map(sk => ({
    sk, ms: total(sessionsOf(sk.id).filter(s => dayStart(s.start) === d)),
  })));
  const max = Math.max(3600000, ...perDay.map(r => r.reduce((a, x) => a + x.ms, 0)));
  const W = 320, H = 150, pad = 18, bw = (W - pad) / 14;
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H + 22}`, role: 'img', 'aria-label': 'Time per day, last 14 days' });
  perDay.forEach((row, i) => {
    let y = H;
    row.forEach(({ sk, ms }) => {
      if (!ms) return;
      const hh = (ms / max) * (H - 10);
      y -= hh;
      chart.append(svg('rect', { x: pad + i * bw + 2, y, width: bw - 4, height: hh, fill: sk.color, rx: 2 }));
    });
    if (i % 2 === 0) chart.append(svg('text', { x: pad + i * bw + bw / 2, y: H + 14, 'text-anchor': 'middle' }, new Date(days[i]).getDate()));
  });
  chart.append(svg('text', { x: 0, y: 10 }, fmt(max)));

  const wk = weekStart();
  const rows = state.skills.map(sk => {
    const list = sessionsOf(sk.id);
    const all = total(list);
    const done = sk.milestones.filter(m => m.done).length;
    const lvl = sk.levels.length ? sk.levels[sk.levels.length - 1].v : null;
    const first = sk.levels.length ? sk.levels[0].v : null;
    return h('a', { class: 'card', style: 'display:block', href: '#/skill/' + sk.id },
      h('div', { class: 'row' },
        h('span', { class: 'dot', style: 'background:' + sk.color }),
        h('span', { class: 'grow name' }, sk.name),
        h('span', { class: 'muted' }, fmt(all))),
      h('div', { class: 'muted', style: 'margin-top:6px' },
        `${fmt(total(list.filter(s => s.start >= wk)))} this week`,
        sk.milestones.length ? ` · ${done}/${sk.milestones.length} milestones` : '',
        lvl != null ? ` · level ${lvl}${first !== lvl ? ` (from ${first})` : ''}` : ''),
      sk.goalHours ? progressBar(all / (sk.goalHours * 3600000), sk.color) : null);
  });

  const weekAll = total(state.sessions.filter(s => s.start >= wk));
  return h('div', {},
    timerBanner(),
    h('h1', {}, 'Progress'),
    h('div', { class: 'stats' }, stat(fmt(weekAll), 'this week'), stat(fmt(total(state.sessions)), 'all time'), stat(String(state.sessions.length), 'sessions')),
    h('h2', {}, 'Last 14 days'),
    h('div', { class: 'card' }, chart,
      h('div', { class: 'hist' }, state.skills.map(sk => h('span', { style: `border-color:${sk.color}` }, sk.name)))),
    h('h2', {}, 'By skill'), rows);
}

function viewSettings() {
  const file = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.skills) || !Array.isArray(data.sessions)) throw new Error('bad shape');
      confirmDelete('your current data and replace it with the imported file', () => {
        state = { skills: data.skills, sessions: data.sessions, timer: null };
      });
    } catch (e) { alert('That file is not a valid Skill Tracker backup.'); }
    file.value = '';
  });
  return h('div', {},
    h('h1', {}, 'Backup'),
    h('p', { class: 'muted' }, 'Your data is stored only in this browser. Export a file to back it up or move it to another device.'),
    h('button', {
      class: 'primary full', onclick: () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `skill-tracker-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove();
      },
    }, 'Export data'),
    h('button', { class: 'full', style: 'margin-top:10px', onclick: () => file.click() }, 'Import data'),
    file);
}

/* ---------- router ---------- */
function render() {
  const hash = location.hash || '#/';
  const app = document.getElementById('app');
  let tab = 'home', view;
  if (hash.startsWith('#/skill/')) view = viewSkill(hash.slice(8));
  else if (hash === '#/stats') { tab = 'stats'; view = viewStats(); }
  else if (hash === '#/settings') { tab = 'settings'; view = viewSettings(); }
  else view = viewHome();
  app.replaceChildren(view);
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  clearInterval(tickTimer);
  if (state.timer) {
    tickTimer = setInterval(() => {
      document.querySelectorAll('[data-tick]').forEach(el => { el.textContent = clock(Date.now() - state.timer.start); });
    }, 1000);
  }
}
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
