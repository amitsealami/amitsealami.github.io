/* Browser-side data store. Implements the same operations as the Flask API over one localStorage
   key, so the app runs with no server (GitHub Pages install, or "This browser" mode). Export and
   import use the same JSON format as the server, so snapshots move between the two. */
(function (root) {
  'use strict';

  const KEY = 'productivity.data';
  const empty = () => ({ version: 1, projects: [], tasks: [], records: [], seq: { projects: 0, tasks: 0, records: 0 } });
  const now = () => Math.floor(Date.now() / 1000);
  const asInt = (v, d = null) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  const maxId = list => list.reduce((m, x) => Math.max(m, x.id), 0);
  const byProject = (a, b) => (a.archived - b.archived) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const byTask = (a, b) => (a.completed - b.completed) || (b.created - a.created);

  function createStore(storage) {
    let data = null;

    function load() {
      if (data) return data;
      try { data = JSON.parse(storage.getItem(KEY)) || empty(); } catch { data = empty(); }
      data.seq = { projects: maxId(data.projects), tasks: maxId(data.tasks), records: maxId(data.records) };
      return data;
    }
    const save = () => storage.setItem(KEY, JSON.stringify(data));
    const nextId = table => ++data.seq[table];
    const find = (table, id) => data[table].find(x => x.id === id) || fail(404, 'not found');
    const running = () => data.records.filter(r => r.end == null).sort((a, b) => b.start - a.start)[0] || null;
    const endRunning = t => { for (const r of data.records) if (r.end == null) r.end = t; };
    function checkProjectTask(pid, tid) {
      if (!data.projects.some(p => p.id === pid)) fail(404, 'project not found');
      if (tid != null && !data.tasks.some(t => t.id === tid && t.project_id === pid)) fail(400, 'task does not belong to project');
    }
    function normalizeImport(b) {
      if (!b || b.version !== 1) fail(400, 'import failed: expected a version 1 backup');
      for (const k of ['projects', 'tasks', 'records']) if (!Array.isArray(b[k])) fail(400, `import failed: '${k}' list missing`);
      const need = (row, keys) => { for (const k of keys) if (!(k in row)) fail(400, `import failed: missing ${k}`); };
      const t = now();
      const projects = b.projects.map(p => { need(p, ['id', 'name']); return { id: p.id, name: p.name, color: p.color || '#4f8cff', archived: p.archived ? 1 : 0, created: p.created ?? t }; });
      const tasks = b.tasks.map(x => { need(x, ['id', 'project_id', 'name']); return { id: x.id, project_id: x.project_id, name: x.name, completed: x.completed ? 1 : 0, created: x.created ?? t }; });
      const records = b.records.map(r => { need(r, ['id', 'project_id', 'start']); return { id: r.id, project_id: r.project_id, task_id: r.task_id ?? null, start: r.start, end: r.end ?? null }; });
      return { version: 1, projects, tasks, records, seq: { projects: maxId(projects), tasks: maxId(tasks), records: maxId(records) } };
    }

    // Same paths and status codes as app.py. `b` is the JSON body, `id` the trailing path id, `q` the query.
    const routes = {
      'GET api/state': () => ({ projects: [...data.projects].sort(byProject), tasks: [...data.tasks].sort(byTask), running: running(), now: now() }),

      'POST api/projects': b => {
        const name = (b.name || '').trim();
        if (!name) fail(400, 'name required');
        const p = { id: nextId('projects'), name, color: b.color || '#4f8cff', archived: 0, created: now() };
        data.projects.push(p); return p;
      },
      'PUT api/projects/:id': (b, id) => {
        const p = find('projects', id);
        p.name = (b.name || p.name).trim() || p.name;
        p.color = b.color || p.color;
        p.archived = ('archived' in b ? b.archived : p.archived) ? 1 : 0;
        return p;
      },
      'DELETE api/projects/:id': (_b, id) => {
        data.projects = data.projects.filter(p => p.id !== id);
        data.tasks = data.tasks.filter(t => t.project_id !== id);
        data.records = data.records.filter(r => r.project_id !== id);
        return { ok: true };
      },

      'POST api/tasks': b => {
        const name = (b.name || '').trim(), pid = asInt(b.project_id);
        if (!name || pid == null) fail(400, 'name and project_id required');
        checkProjectTask(pid);
        const t = { id: nextId('tasks'), project_id: pid, name, completed: 0, created: now() };
        data.tasks.push(t); return t;
      },
      'PUT api/tasks/:id': (b, id) => {
        const t = find('tasks', id);
        t.name = (b.name || t.name).trim() || t.name;
        t.completed = ('completed' in b ? b.completed : t.completed) ? 1 : 0;
        return t;
      },
      'DELETE api/tasks/:id': (_b, id) => {
        data.tasks = data.tasks.filter(t => t.id !== id);
        for (const r of data.records) if (r.task_id === id) r.task_id = null;
        return { ok: true };
      },

      'POST api/timer/start': b => {
        const pid = asInt(b.project_id), tid = asInt(b.task_id);
        if (pid == null) fail(400, 'project_id required');
        checkProjectTask(pid, tid);
        const t = now(); endRunning(t);
        const r = { id: nextId('records'), project_id: pid, task_id: tid, start: t, end: null };
        data.records.push(r); return r;
      },
      'POST api/timer/stop': () => {
        const t = now(); endRunning(t);
        data.records = data.records.filter(r => !(r.end != null && r.end <= r.start));
        return { ok: true, now: t };
      },

      'GET api/records': (_b, _id, q) => {
        const f = asInt(q.from, 0), t = asInt(q.to, now() + 86400);
        return data.records.filter(r => r.start < t && (r.end == null || r.end > f)).sort((a, b) => b.start - a.start);
      },
      'POST api/records': b => {
        const pid = asInt(b.project_id), tid = asInt(b.task_id), start = asInt(b.start), end = asInt(b.end);
        if (pid == null || start == null || end == null || end <= start) fail(400, 'project_id, start, end required and end > start');
        checkProjectTask(pid, tid);
        const r = { id: nextId('records'), project_id: pid, task_id: tid, start, end };
        data.records.push(r); return r;
      },
      'PUT api/records/:id': (b, id) => {
        const r = find('records', id);
        const pid = asInt(b.project_id, r.project_id);
        const tid = 'task_id' in b ? asInt(b.task_id) : r.task_id;
        const start = asInt(b.start, r.start);
        const end = 'end' in b ? asInt(b.end) : r.end;
        if (end != null && end <= start) fail(400, 'end must be after start');
        checkProjectTask(pid, tid);
        Object.assign(r, { project_id: pid, task_id: tid, start, end });
        return r;
      },
      'DELETE api/records/:id': (_b, id) => { data.records = data.records.filter(r => r.id !== id); return { ok: true }; },

      'GET api/export': () => ({ version: 1, exported: now(), projects: data.projects, tasks: data.tasks, records: data.records }),
      'POST api/import': b => { data = normalizeImport(b); return { ok: true }; },
    };

    // request('PUT', 'api/records/12?x=1', {...}) -> routes['PUT api/records/:id']({...}, 12, {x:'1'})
    function request(method, url, body) {
      load();
      const [pathPart, queryPart = ''] = url.replace(/^\.?\//, '').split('?');
      const q = Object.fromEntries(new URLSearchParams(queryPart));
      let key = `${method} ${pathPart}`, id = null;
      if (!routes[key]) {
        const m = pathPart.match(/^(.*)\/(\d+)$/);
        if (m) { key = `${method} ${m[1]}/:id`; id = parseInt(m[2], 10); }
      }
      const route = routes[key] || fail(404, `no route ${method} ${pathPart}`);
      const result = route(body || {}, id, q);
      save();
      return clone(result);
    }

    return { request, reset: () => { data = empty(); save(); } };
  }

  const api = { createStore, KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProductivityStore = api;
})(typeof self !== 'undefined' ? self : this);
