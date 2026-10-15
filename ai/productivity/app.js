/* Productivity Tracker frontend. Vanilla JS, no build step. */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Icons come from the SVG sprite in index.html.
const icon = name => `<svg class="ico"><use href="#i-${name}"/></svg>`;
const playIcon = running => icon(running ? 'stop' : 'play');

// ---------- data source ----------
// 'server': the Flask API at this origin. 'browser': store.js over this browser's localStorage.
// An explicit choice is saved. With none saved, the server is probed once per page load, so the
// GitHub Pages copy lands in browser mode by itself.
const LOCAL = ProductivityStore.createStore(localStorage);
const MODE_LABEL = { server: 'Server', browser: 'This browser' };
let MODE = (() => { try { const m = localStorage.getItem('mode'); return m in MODE_LABEL ? m : null; } catch { return null; } })();
async function serverReachable() {
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    return r.ok && (r.headers.get('content-type') || '').includes('json');
  } catch { return false; }
}
async function detectMode() { if (!MODE) MODE = (await serverReachable()) ? 'server' : 'browser'; }
async function setMode(m) {
  if (m === MODE) return true;
  if (m === 'server' && !(await serverReachable())) { alert('No server found at this address. Staying with browser data.'); return false; }
  MODE = m;
  try { localStorage.setItem('mode', m); } catch { /* keep for this page load only */ }
  S.projectId = null;
  updateModeBadge();
  await refresh();
  return true;
}
function updateModeBadge() { $('#modeBadge').textContent = MODE_LABEL[MODE] || ''; }

// All data access goes through here. Same paths in both modes.
async function api(method, url, body) {
  if (MODE === 'browser') {
    try { return LOCAL.request(method, url, body); } catch (e) { alert(e.message); throw e; }
  }
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text(); alert(t.replace(/<[^>]+>/g, '').trim() || r.statusText); throw new Error(t); }
  return r.json();
}
function exportBackup() {
  if (MODE === 'server') { window.location = 'api/export'; return; }
  const blob = new Blob([JSON.stringify(LOCAL.request('GET', 'api/export'), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'productivity-backup.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const PALETTE = ['#5b8cff', '#ff5b7f', '#ffb545', '#2ecc8f', '#a66bff', '#ff7a45', '#22c3e6', '#e6c822', '#f06ab8', '#7bd45c', '#ff4d4d', '#8fa3c7'];

// ---------- appearance ----------
// Per-browser preference, kept in localStorage (not in the database). style.css reads the
// data-theme and data-accent attributes this sets on <html>.
const THEMES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
const ACCENTS = [['teal', 'Teal', '#14b8a6'], ['blue', 'Blue', '#5b8cff'], ['purple', 'Purple', '#8b5cf6']];
const DEFAULT_PREFS = { theme: 'system', accent: 'blue' };
function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('prefs') || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
}
const PREFS = loadPrefs();
const systemLight = matchMedia('(prefers-color-scheme: light)');
function applyPrefs() {
  document.documentElement.dataset.theme = PREFS.theme === 'system' ? (systemLight.matches ? 'light' : 'dark') : PREFS.theme;
  document.documentElement.dataset.accent = ACCENTS.some(([v]) => v === PREFS.accent) ? PREFS.accent : 'blue';
}
function setPref(key, value) {
  PREFS[key] = value;
  try { localStorage.setItem('prefs', JSON.stringify(PREFS)); } catch { /* private mode: keep for this page load only */ }
  applyPrefs();
}
systemLight.addEventListener('change', applyPrefs);
applyPrefs();

const S = {
  projects: [], tasks: [], running: null,
  view: 'projects', timelineDays: 14,
  projectId: null,                 // project detail open
  reportPeriod: 'week',
  calMonth: startOfMonth(new Date()), calSelected: dayKey(new Date()),
};

// ---------- time helpers ----------
const now = () => Math.floor(Date.now() / 1000);
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d) { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; } // Monday
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const epoch = d => Math.floor(d.getTime() / 1000);
function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtTime(e) { return new Date(e * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDur(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
function fmtClock(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtDay(d) {
  const t = startOfDay(new Date()), x = startOfDay(d);
  if (x.getTime() === t.getTime()) return 'Today';
  if (x.getTime() === addDays(t, -1).getTime()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function toLocalInput(e) { const d = new Date(e * 1000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function fromLocalInput(s) { return Math.floor(new Date(s).getTime() / 1000); }

// Split a record into per-day segments [{key, start, end, last}] so day totals are correct across midnight.
// `last` marks the final segment; for a running record that is the one still growing.
function segments(r) {
  const out = [];
  let s = r.start; const e = r.end ?? now();
  while (s < e) {
    const dayEnd = epoch(addDays(startOfDay(new Date(s * 1000)), 1));
    const segEnd = Math.min(e, dayEnd);
    out.push({ key: dayKey(new Date(s * 1000)), start: s, end: segEnd, last: false });
    s = segEnd;
  }
  if (out.length) out[out.length - 1].last = true;
  return out;
}

const proj = id => S.projects.find(p => p.id === id);
const task = id => S.tasks.find(t => t.id === id);
const dur = r => (r.end ?? now()) - r.start;

// ---------- data ----------
async function loadState() {
  const st = await api('GET', 'api/state');
  S.projects = st.projects; S.tasks = st.tasks; S.running = st.running;
}
async function fetchRecords(fromEpoch, toEpoch) {
  return api('GET', `api/records?from=${fromEpoch}&to=${toEpoch}`);
}
async function startTimer(project_id, task_id = null) {
  await api('POST', 'api/timer/start', { project_id, task_id });
  await refresh();
}
async function stopTimer() { await api('POST', 'api/timer/stop'); await refresh(); }

async function refresh() { await loadState(); render(); }

// ---------- rendering ----------
const view = $('#view'), title = $('#title');

function setView(v) { S.view = v; S.projectId = null; render(); }

function render() {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
  $('#backBtn').hidden = !(S.view === 'projects' && S.projectId);
  renderRunbar();
  const fns = { timeline: renderTimeline, projects: renderProjects, reports: renderReports, calendar: renderCalendar };
  fns[S.view]();
}

function renderRunbar() {
  const bar = $('#runbar'), r = S.running;
  bar.hidden = !r;
  if (!r) return;
  const p = proj(r.project_id), t = r.task_id ? task(r.task_id) : null;
  $('#runDot').style.background = p?.color || '#888';
  $('#runProject').textContent = p?.name || '?';
  $('#runTask').textContent = t?.name || 'No task';
  tickRunbar();
}
function tickRunbar() {
  if (S.running) $('#runTime').textContent = fmtClock(now() - S.running.start);
  $$('.rec.live .dur').forEach(el => { el.textContent = fmtDur(now() - Number(el.dataset.start)); });
}
setInterval(tickRunbar, 1000);

// --- Timeline ---
async function renderTimeline() {
  title.textContent = 'Timeline';
  const from = epoch(addDays(startOfDay(new Date()), -(S.timelineDays - 1)));
  const recs = await fetchRecords(from, now() + 86400);
  if (!S.projects.length) {
    view.innerHTML = `<div class="empty">Create a project first.<br><button class="add-card" id="addProj">+ New project</button></div>`;
    $('#addProj').onclick = () => openProjectDialog(null);
    return;
  }
  if (!recs.length) {
    view.innerHTML = `<div class="empty">Nothing tracked in the last ${S.timelineDays} days.<br>Start a timer from Projects, or<br><button class="add-card" id="addRec">+ Add record</button></div>`;
    $('#addRec').onclick = () => openRecordDialog(null);
    return;
  }
  // One row per day segment, so a record crossing midnight is listed under both days
  // and day totals match Calendar and Reports.
  const byDay = new Map();
  for (const r of recs) for (const s of segments(r)) {
    if (s.end <= from) continue;
    if (!byDay.has(s.key)) byDay.set(s.key, []);
    byDay.get(s.key).push({ r, s });
  }
  let html = `<div class="row" style="justify-content:flex-end"><button class="linkbtn" id="addRec">+ Add record</button></div>`;
  for (const k of [...byDay.keys()].sort().reverse()) {
    const list = byDay.get(k).sort((a, b) => b.s.start - a.s.start);
    const total = list.reduce((a, x) => a + (x.s.end - x.s.start), 0);
    html += `<div class="section-title">${esc(fmtDay(new Date(k + 'T00:00')))}<span class="right">${fmtDur(total)}</span></div>`;
    html += list.map(x => recHtml(x.r, x.s)).join('');
  }
  html += `<button class="load-more" id="moreBtn">Show earlier</button>`;
  view.innerHTML = html;
  $('#addRec').onclick = () => openRecordDialog(null);
  $('#moreBtn').onclick = () => { S.timelineDays += 14; renderTimeline(); };
  $$('.rec', view).forEach(el => el.onclick = () => openRecordDialog(recs.find(r => r.id === +el.dataset.id)));
}
// Row for a record. With `seg` (from segments()) the row shows only that day's part of the record;
// clicking still opens the whole record.
function recHtml(r, seg) {
  const p = proj(r.project_id), t = r.task_id ? task(r.task_id) : null;
  const live = r.end == null && (seg ? seg.last : true);
  const start = seg ? seg.start : r.start;
  const end = seg ? seg.end : (r.end ?? now());
  return `<div class="rec ${live ? 'live' : ''}" data-id="${r.id}">
    <div class="bar" style="background:${p?.color || '#888'}"></div>
    <div class="body"><div class="name">${esc(p?.name || '?')}</div>
      <div class="sub">${t ? esc(t.name) + ' · ' : ''}${fmtTime(start)} – ${live ? 'now' : fmtTime(end)}</div></div>
    <div class="dur" data-start="${start}">${fmtDur(end - start)}</div></div>`;
}

// --- Projects ---
async function renderProjects() {
  if (S.projectId) return renderProjectDetail();
  title.textContent = 'Projects';
  const todayFrom = epoch(startOfDay(new Date()));
  const recs = await fetchRecords(todayFrom, now() + 1);
  const today = {};
  for (const r of recs) for (const s of segments(r)) if (s.key === dayKey(new Date())) today[r.project_id] = (today[r.project_id] || 0) + (s.end - s.start);
  const active = S.projects.filter(p => !p.archived), archived = S.projects.filter(p => p.archived);
  if (!S.projects.length) {
    view.innerHTML = `<div class="empty">No projects yet.<br><button class="add-card" id="addProj">+ New project</button></div>`;
    $('#addProj').onclick = () => openProjectDialog(null);
    return;
  }
  const card = p => {
    const on = S.running && S.running.project_id === p.id;
    const open = S.tasks.filter(t => t.project_id === p.id && !t.completed).length;
    return `<div class="proj" data-id="${p.id}" style="border-left-color:${p.color}">
      <div class="body"><div class="name">${esc(p.name)}</div>
        <div class="sub">${fmtDur(today[p.id] || 0)} today${open ? ` · ${open} open task${open > 1 ? 's' : ''}` : ''}</div></div>
      <button class="play ${on ? 'on' : ''}" data-play="${p.id}" title="${on ? 'Stop' : 'Start'}">${playIcon(on)}</button></div>`;
  };
  view.innerHTML = `<button class="add-card" id="addProj">+ New project</button>` +
    active.map(card).join('') +
    (archived.length ? `<div class="section-title">Archived</div>` + archived.map(card).join('') : '');
  $('#addProj').onclick = () => openProjectDialog(null);
  $$('.proj', view).forEach(el => el.onclick = () => { S.projectId = +el.dataset.id; render(); });
  $$('[data-play]', view).forEach(b => b.onclick = e => { e.stopPropagation(); togglePlay(+b.dataset.play, null); });
}
function togglePlay(pid, tid) {
  const r = S.running;
  if (r && r.project_id === pid && (r.task_id ?? null) === (tid ?? null)) return stopTimer();
  return startTimer(pid, tid);
}
async function renderProjectDetail() {
  const p = proj(S.projectId);
  if (!p) { S.projectId = null; return render(); }
  title.textContent = p.name;
  const weekFrom = epoch(startOfWeek(new Date()));
  const recs = (await fetchRecords(0, now() + 1)).filter(r => r.project_id === p.id);
  const total = recs.reduce((a, r) => a + dur(r), 0);
  const week = recs.reduce((a, r) => a + segments(r).filter(s => s.start >= weekFrom).reduce((x, s) => x + (s.end - s.start), 0), 0);
  const tasks = S.tasks.filter(t => t.project_id === p.id);
  const on = S.running && S.running.project_id === p.id && S.running.task_id == null;
  const taskHtml = t => {
    const tOn = S.running && S.running.task_id === t.id;
    return `<div class="task ${t.completed ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.completed ? 'checked' : ''} data-done="${t.id}">
      <span class="tname" data-edit="${t.id}">${esc(t.name)}</span>
      <button class="play sm ${tOn ? 'on' : ''}" data-play="${t.id}" style="${tOn ? '' : 'background:' + p.color}" title="${tOn ? 'Stop' : 'Start'}">${playIcon(tOn)}</button></div>`;
  };
  view.innerHTML = `
    <div class="proj-head" style="background:${p.color}">
      <div style="flex:1"><div class="big">${fmtDur(total)}</div><div class="sub">total · ${fmtDur(week)} this week</div></div>
      <button class="play ${on ? 'on' : ''}" id="projPlay" style="background:rgba(0,0,0,.3)" title="${on ? 'Stop' : 'Start'}">${playIcon(on)}</button>
    </div>
    <div class="row" style="gap:16px;margin-bottom:6px">
      <button class="linkbtn" id="editProj">Edit</button>
      <button class="linkbtn" id="archProj">${p.archived ? 'Unarchive' : 'Archive'}</button>
      <button class="linkbtn danger" id="delProj">Delete</button>
    </div>
    <div class="section-title">Tasks <button class="linkbtn right" id="addTask">+ Add task</button></div>
    ${tasks.length ? tasks.map(taskHtml).join('') : '<div class="muted" style="padding:8px 4px">No tasks. Tasks are optional.</div>'}
    <div class="section-title">Recent</div>
    ${recs.slice(0, 20).map(recHtml).join('') || '<div class="muted" style="padding:8px 4px">No records yet.</div>'}`;
  $('#projPlay').onclick = () => togglePlay(p.id, null);
  $('#editProj').onclick = () => openProjectDialog(p);
  $('#archProj').onclick = async () => { await api('PUT', `api/projects/${p.id}`, { archived: !p.archived }); refresh(); };
  $('#delProj').onclick = async () => { if (confirm(`Delete "${p.name}" and all its records?`)) { await api('DELETE', `api/projects/${p.id}`); S.projectId = null; refresh(); } };
  $('#addTask').onclick = () => openTaskDialog(null, p.id);
  $$('[data-done]', view).forEach(c => c.onchange = async () => { await api('PUT', `api/tasks/${c.dataset.done}`, { completed: c.checked }); refresh(); });
  $$('[data-edit]', view).forEach(el => el.onclick = () => openTaskDialog(task(+el.dataset.edit), p.id));
  $$('[data-play]', view).forEach(b => b.onclick = () => togglePlay(p.id, +b.dataset.play));
  $$('.rec', view).forEach(el => el.onclick = () => openRecordDialog(recs.find(r => r.id === +el.dataset.id)));
}

// --- Reports ---
function periodRange(kind) {
  const t = startOfDay(new Date());
  if (kind === 'week') return [startOfWeek(t), addDays(startOfWeek(t), 7)];
  if (kind === '7d') return [addDays(t, -6), addDays(t, 1)];
  if (kind === 'month') return [startOfMonth(t), startOfMonth(addDays(startOfMonth(t), 32))];
  if (kind === '30d') return [addDays(t, -29), addDays(t, 1)];
  return [new Date(0), addDays(t, 1)];
}
async function renderReports() {
  title.textContent = 'Reports';
  const [from, to] = periodRange(S.reportPeriod);
  const recs = await fetchRecords(epoch(from), epoch(to));
  const periods = [['week', 'This week'], ['7d', 'Last 7 days'], ['month', 'This month'], ['30d', 'Last 30 days'], ['all', 'All time']];
  const chips = periods.map(([k, l]) => `<button class="chip ${S.reportPeriod === k ? 'active' : ''}" data-p="${k}">${l}</button>`).join('');

  // clip segments to the period
  const segs = [];
  for (const r of recs) for (const s of segments(r)) {
    const a = Math.max(s.start, epoch(from)), b = Math.min(s.end, epoch(to));
    if (b > a) segs.push({ key: s.key, start: a, end: b, project_id: r.project_id });
  }
  const total = segs.reduce((a, s) => a + s.end - s.start, 0);
  const dayKeys = new Set(segs.map(s => s.key));
  const byProj = {};
  for (const s of segs) byProj[s.project_id] = (byProj[s.project_id] || 0) + s.end - s.start;
  const projIds = Object.keys(byProj).map(Number).sort((a, b) => byProj[b] - byProj[a]);

  // daily stacked chart (period days, max 31; for 'all' use last 14 days)
  let days = [];
  const dFrom = S.reportPeriod === 'all' ? addDays(startOfDay(new Date()), -13) : from;
  const dTo = S.reportPeriod === 'all' ? addDays(startOfDay(new Date()), 1) : to;
  for (let d = new Date(dFrom); d < dTo; d = addDays(d, 1)) days.push(dayKey(d));
  const dailySeries = projIds.map(pid => ({ color: proj(pid)?.color || '#888', values: days.map(k => segs.filter(s => s.key === k && s.project_id === pid).reduce((a, s) => a + s.end - s.start, 0) / 3600) }));
  const dayLabels = days.map(k => { const d = new Date(k + 'T00:00'); return days.length > 10 ? String(d.getDate()) : d.toLocaleDateString([], { weekday: 'short' }); });

  // weekly chart: last 8 weeks regardless of period
  const wRecs = await fetchRecords(epoch(addDays(startOfWeek(new Date()), -49)), now() + 1);
  const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(addDays(startOfWeek(new Date()), -7 * i));
  const weekVals = weeks.map(w => { const a = epoch(w), b = epoch(addDays(w, 7)); let t = 0; for (const r of wRecs) { const s = Math.max(r.start, a), e = Math.min(r.end ?? now(), b); if (e > s) t += e - s; } return t / 3600; });
  const weekLabels = weeks.map(w => `${w.getMonth() + 1}/${w.getDate()}`);

  // hour-of-day productivity (period)
  const hours = new Array(24).fill(0);
  for (const s of segs) { let a = s.start; while (a < s.end) { const d = new Date(a * 1000); const hEnd = epoch(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1)); const b = Math.min(hEnd, s.end); hours[d.getHours()] += (b - a) / 3600; a = b; } }
  const bestHour = hours.indexOf(Math.max(...hours));

  view.innerHTML = `
    <div class="chip-row">${chips}</div>
    <div class="card"><div class="stat">
      <div><b>${fmtDur(total)}</b><small>tracked</small></div>
      <div><b>${dayKeys.size}</b><small>active days</small></div>
      <div><b>${dayKeys.size ? fmtDur(total / dayKeys.size) : '0m'}</b><small>per active day</small></div>
    </div></div>
    <div class="section-title">Daily</div>
    <div class="card">${barChart(dayLabels, dailySeries, 'h')}
      <div class="legend">${projIds.map(pid => `<span><i class="dot" style="background:${proj(pid)?.color}"></i>${esc(proj(pid)?.name)}</span>`).join('')}</div></div>
    <div class="section-title">Weekly (last 8 weeks)</div>
    <div class="card">${barChart(weekLabels, [{ color: 'var(--accent)', values: weekVals }], 'h')}</div>
    <div class="section-title">Most productive hours${total ? `<span class="right">peak ${String(bestHour).padStart(2, '0')}:00–${String(bestHour + 1).padStart(2, '0')}:00</span>` : ''}</div>
    <div class="card">${barChart(hours.map((_, i) => i % 3 === 0 ? String(i) : ''), [{ color: 'var(--accent2)', values: hours }], 'h')}</div>
    <div class="section-title">By project</div>
    <div class="card">${projIds.length ? projIds.map(pid => `<div class="hbar"><div class="lab"><span>${esc(proj(pid)?.name)}</span><span>${fmtDur(byProj[pid])} · ${Math.round(byProj[pid] / total * 100)}%</span></div><div class="track"><div class="fill" style="width:${byProj[pid] / total * 100}%;background:${proj(pid)?.color}"></div></div></div>`).join('') : '<div class="muted">No data in this period.</div>'}</div>`;
  $$('[data-p]', view).forEach(b => b.onclick = () => { S.reportPeriod = b.dataset.p; renderReports(); });
}

// Stacked bar chart as inline SVG. series: [{color, values[]}], values in hours.
function barChart(labels, series, unit) {
  const W = 480, H = 180, padL = 34, padB = 22, padT = 8;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
  const max = Math.max(1, ...totals) * 1.1;
  const cw = (W - padL - 6) / n, bw = Math.max(2, cw * 0.62);
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = max / ticks * i, yy = y(v);
    svg += `<line x1="${padL}" x2="${W - 4}" y1="${yy}" y2="${yy}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${yy + 4}" fill="var(--muted)" font-size="10" text-anchor="end">${v >= 10 ? Math.round(v) : v.toFixed(1)}${unit}</text>`;
  }
  labels.forEach((lab, i) => {
    const x = padL + cw * i + (cw - bw) / 2;
    let acc = 0;
    for (const s of series) {
      const v = s.values[i] || 0; if (!v) continue;
      const y1 = y(acc + v), y0 = y(acc);
      svg += `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1)}" rx="2" fill="${s.color}"><title>${v.toFixed(2)}${unit}</title></rect>`;
      acc += v;
    }
    if (lab) svg += `<text x="${x + bw / 2}" y="${H - 6}" fill="var(--muted)" font-size="10" text-anchor="middle">${esc(lab)}</text>`;
  });
  return svg + '</svg>';
}

// --- Calendar ---
async function renderCalendar() {
  title.textContent = 'Calendar';
  const m = S.calMonth;
  const gridStart = startOfWeek(m), gridEnd = addDays(gridStart, 42);
  const recs = await fetchRecords(epoch(gridStart), epoch(gridEnd));
  const dayTotal = {}, dayProjects = {};
  for (const r of recs) for (const s of segments(r)) {
    dayTotal[s.key] = (dayTotal[s.key] || 0) + s.end - s.start;
    (dayProjects[s.key] ||= new Set()).add(r.project_id);
  }
  const todayKey = dayKey(new Date());
  let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let d = new Date(gridStart); d < gridEnd; d = addDays(d, 1)) {
    const k = dayKey(d);
    const cls = ['cal-day', d.getMonth() !== m.getMonth() ? 'other' : '', k === todayKey ? 'today' : '', k === S.calSelected ? 'sel' : ''].join(' ');
    const dots = [...(dayProjects[k] || [])].slice(0, 4).map(pid => `<i style="background:${proj(pid)?.color}"></i>`).join('');
    cells += `<div class="${cls}" data-day="${k}"><span>${d.getDate()}</span>${dayTotal[k] ? `<small>${fmtDur(dayTotal[k])}</small>` : ''}<div class="dots">${dots}</div></div>`;
  }
  // Rows for the selected day show that day's segment only, matching the day total above them.
  const selRows = recs.flatMap(r => segments(r).filter(s => s.key === S.calSelected).map(s => ({ r, s }))).sort((a, b) => b.s.start - a.s.start);
  const monthTotal = Object.entries(dayTotal).filter(([k]) => k.startsWith(dayKey(m).slice(0, 7))).reduce((a, [, v]) => a + v, 0);
  view.innerHTML = `
    <div class="cal-head"><button class="icon-btn" id="prevM" title="Previous month">${icon('prev')}</button>
      <div style="text-align:center"><b>${m.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b><div class="muted" style="font-size:12px">${fmtDur(monthTotal)} this month</div></div>
      <button class="icon-btn" id="nextM" title="Next month">${icon('next')}</button></div>
    <div class="cal-grid">${cells}</div>
    <div class="section-title">${esc(fmtDay(new Date(S.calSelected + 'T00:00')))} · ${fmtDur(dayTotal[S.calSelected] || 0)}<button class="linkbtn right" id="addRec">+ Add record</button></div>
    ${selRows.map(x => recHtml(x.r, x.s)).join('') || '<div class="muted" style="padding:8px 4px">Nothing tracked.</div>'}`;
  $('#addRec').onclick = () => {
    // pre-fill the selected day: 09:00 to 10:00, or the last hour if the day is today
    const sel = new Date(S.calSelected + 'T00:00');
    const defaults = S.calSelected === todayKey ? null : { start: epoch(sel) + 9 * 3600, end: epoch(sel) + 10 * 3600 };
    openRecordDialog(null, defaults);
  };
  $('#prevM').onclick = () => { S.calMonth = startOfMonth(addDays(m, -1)); renderCalendar(); };
  $('#nextM').onclick = () => { S.calMonth = startOfMonth(addDays(m, 32)); renderCalendar(); };
  $$('[data-day]', view).forEach(el => el.onclick = () => { S.calSelected = el.dataset.day; renderCalendar(); });
  $$('.rec', view).forEach(el => el.onclick = () => openRecordDialog(recs.find(r => r.id === +el.dataset.id)));
}

// ---------- dialogs ----------
const dlg = $('#dlg');
function openDialog(html, onSubmit) {
  dlg.innerHTML = `<form method="dialog">${html}</form>`;
  const form = $('form', dlg);
  // Cancel and Delete are submit buttons too; without this the browser blocks them on an empty required field.
  $$('button[value="cancel"], button[value="delete"]', form).forEach(b => b.setAttribute('formnovalidate', ''));
  form.onsubmit = async e => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    if (await onSubmit(new FormData(form), e.submitter?.value) !== false) dlg.close();
  };
  dlg.showModal();
}
const colorPicker = sel => `<div class="field"><label>Color</label><div class="colors">${PALETTE.map(c => `<label style="background:${c}"><input type="radio" name="color" value="${c}" ${c === sel ? 'checked' : ''}><span></span></label>`).join('')}</div></div>`;

function openProjectDialog(p) {
  const color = p?.color || PALETTE[S.projects.length % PALETTE.length];
  openDialog(`<h2>${p ? 'Edit project' : 'New project'}</h2>
    <div class="field"><label>Name</label><input name="name" required autofocus value="${esc(p?.name || '')}"></div>
    ${colorPicker(color)}
    <div class="actions"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Save</button></div>`,
    async fd => {
      const data = { name: fd.get('name'), color: fd.get('color') };
      if (p) await api('PUT', `api/projects/${p.id}`, data); else { const np = await api('POST', 'api/projects', data); if (S.view === 'projects') S.projectId = np.id; }
      refresh();
    });
}
function openTaskDialog(t, pid) {
  openDialog(`<h2>${t ? 'Edit task' : 'New task'}</h2>
    <div class="field"><label>Name</label><input name="name" required autofocus value="${esc(t?.name || '')}"></div>
    <div class="actions">${t ? '<button class="btn danger" value="delete">Delete</button>' : ''}<button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Save</button></div>`,
    async (fd, action) => {
      if (action === 'delete') { await api('DELETE', `api/tasks/${t.id}`); return refresh(); }
      if (t) await api('PUT', `api/tasks/${t.id}`, { name: fd.get('name') }); else await api('POST', 'api/tasks', { name: fd.get('name'), project_id: pid });
      refresh();
    });
}
// r: record to edit, or null to add. defaults: optional {start, end} for a new record.
function openRecordDialog(r, defaults) {
  const isNew = !r;
  const pid = r?.project_id ?? S.projectId ?? S.projects.find(p => !p.archived)?.id;
  if (!pid) return openProjectDialog(null);
  const start = r?.start ?? defaults?.start ?? (now() - 3600), end = r?.end ?? defaults?.end ?? now();
  const projOpts = S.projects.filter(p => !p.archived || p.id === pid).map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  openDialog(`<h2>${isNew ? 'Add record' : 'Edit record'}</h2>
    <div class="field"><label>Project</label><select name="project_id" id="recProj">${projOpts}</select></div>
    <div class="field"><label>Task</label><select name="task_id" id="recTask"></select></div>
    <div class="field"><label>Start</label><input type="datetime-local" name="start" required value="${toLocalInput(start)}"></div>
    <div class="field"><label>End</label><input type="datetime-local" name="end" ${r && r.end == null ? '' : 'required'} value="${toLocalInput(end)}">${r && r.end == null ? '<div class="muted" style="font-size:12px;margin-top:4px">Running — leave end as is or stop the timer.</div>' : ''}</div>
    <div class="actions">${isNew ? '' : '<button class="btn danger" value="delete">Delete</button>'}<button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Save</button></div>`,
    async (fd, action) => {
      if (action === 'delete') { await api('DELETE', `api/records/${r.id}`); return refresh(); }
      const data = { project_id: +fd.get('project_id'), task_id: fd.get('task_id') ? +fd.get('task_id') : null, start: fromLocalInput(fd.get('start')) };
      if (isNew || r.end != null) data.end = fromLocalInput(fd.get('end'));
      if (data.end != null && data.end <= data.start) { alert('End must be after start.'); return false; }
      if (isNew) await api('POST', 'api/records', data); else await api('PUT', `api/records/${r.id}`, data);
      refresh();
    });
  const fillTasks = () => {
    const p = +$('#recProj').value;
    $('#recTask').innerHTML = `<option value="">No task</option>` + S.tasks.filter(t => t.project_id === p).map(t => `<option value="${t.id}" ${t.id === r?.task_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  };
  $('#recProj').onchange = fillTasks; fillTasks();
}
function openMenu() {
  // type="button" so the chips do not submit the dialog form
  const chip = (key, val, label, on) => `<button type="button" class="chip ${on ? 'active' : ''}" data-pref="${key}" data-val="${val}">${label}</button>`;
  const modeChip = m => `<button type="button" class="chip ${MODE === m ? 'active' : ''}" data-mode="${m}">${MODE_LABEL[m]}</button>`;
  openDialog(`<h2>Menu</h2>
    <div class="field"><label>Data source</label><div class="chip-row">${modeChip('server')}${modeChip('browser')}</div>
      <div class="muted" style="font-size:12px">Server and browser hold separate data. Move a snapshot with Export then Import.</div></div>
    <div class="field"><label>Theme</label><div class="chip-row">${THEMES.map(([v, l]) => chip('theme', v, l, PREFS.theme === v)).join('')}</div></div>
    <div class="field"><label>Accent</label><div class="chip-row">${ACCENTS.map(([v, l, c]) => chip('accent', v, `<i class="dot" style="background:${c}"></i>${l}`, PREFS.accent === v)).join('')}</div></div>
    <div class="field"><label>Data</label><div class="menu">
      <button value="export">Export backup (JSON)</button>
      <button value="import">Import backup (replaces everything)</button>
      <button value="newproj">New project</button>
      <button value="newrec">Add record manually</button></div></div>
    <div class="actions"><button class="btn" value="cancel">Close</button></div>`,
    async (_fd, action) => {
      if (action === 'export') exportBackup();
      if (action === 'import') $('#importFile').click();
      if (action === 'newproj') setTimeout(() => openProjectDialog(null), 50);
      if (action === 'newrec') setTimeout(() => openRecordDialog(null), 50);
    });
  $$('[data-mode]', dlg).forEach(b => b.onclick = async () => {
    if (await setMode(b.dataset.mode)) $$('[data-mode]', dlg).forEach(x => x.classList.toggle('active', x === b));
  });
  $$('[data-pref]', dlg).forEach(b => b.onclick = () => {
    setPref(b.dataset.pref, b.dataset.val);
    $$(`[data-pref="${b.dataset.pref}"]`, dlg).forEach(x => x.classList.toggle('active', x === b));
  });
}
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if (!confirm('This replaces all current data with the backup. Continue?')) { e.target.value = ''; return; }
  try { await api('POST', 'api/import', JSON.parse(await f.text())); S.projectId = null; await refresh(); } catch (err) { alert('Import failed: ' + err.message); }
  e.target.value = '';
};

// ---------- ticking sound ----------
// Loops a kitchen-timer recording (static/sounds/kitchen-timer.mp3, Pixabay). Media playback is not
// throttled in hidden tabs, so it keeps going when the user switches away.
const ticker = new Audio('sounds/kitchen-timer.mp3');
ticker.loop = true;
ticker.preload = 'auto';
function setTickButton(on) {
  $('#tickBtn').classList.toggle('active', on);
  $('#tickBtn').setAttribute('aria-pressed', String(on));
}
function toggleTick() {
  if (!ticker.paused) { ticker.pause(); ticker.currentTime = 0; setTickButton(false); return; }
  ticker.play().then(() => setTickButton(true)).catch(err => alert('Could not play sound: ' + err.message));
}

// ---------- wiring ----------
$('#tickBtn').onclick = toggleTick;
$$('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#backBtn').onclick = () => { S.projectId = null; render(); };
$('#stopBtn').onclick = stopTimer;
$('#menuBtn').onclick = openMenu;
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

(async function start() {
  await detectMode();
  updateModeBadge();
  await refresh();
  // Caches the shell for offline use and makes the page installable.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
