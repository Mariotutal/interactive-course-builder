/* Learner state: validation, migration and the concept review model. Pure functions, no DOM or storage access,
   so the same code runs in the browser (window.LKState) and in Node tests (require).

   State format 2 (format 1 is migrated on load/import):
   { format: 2, courseId, courseVersion,
     items:      { [questionOrActivityId]: { h, attempts, first, last, correctFirst, at, data } },
     texts:      { [id]: { id, v, h, at } },              criteria: { [id]: { h, checks: [bool] } },
     visited:    { [lessonId]: 'YYYY-MM-DD' },             confidence: { [lessonId]: 1..4 },
     reviews:    { [lessonId]: ['YYYY-MM-DD'] },           prefs: { theme },
     concepts:   { [conceptId]: { introduced: date, step: int, due: date|null,
                                  events: [ { d: date, ok: bool, src: itemId } ] } } }
   Concept events record retrieval attempts (first attempts in lessons and review answers). They are evidence of
   retrieval, never a mastery score. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LKState = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FORMAT = 2;
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const isAnswer = x => typeof x === 'number' || (typeof x === 'string' && x.length <= 200) || (Array.isArray(x) && x.length <= 50 && x.every(n => Number.isInteger(n)));
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const MAX_EVENTS = 50;

  function empty(courseId, courseVersion) {
    return { format: FORMAT, courseId, courseVersion: courseVersion || '', items: {}, texts: {}, criteria: {}, visited: {}, confidence: {}, reviews: {}, concepts: {}, diag: null, prefs: {} };
  }

  /* Validate untrusted data field by field. Throws (with a reason) when the structure is wrong;
     drops and counts malformed individual entries. Accepts format 1 (migrated) and 2. */
  function clean(data, courseId, opts = {}) {
    if (!isObj(data) || ![1, 2].includes(data.format)) throw new Error('format');
    if (data.courseId !== courseId) throw new Error(opts.wrongCourse || 'wrong course');
    const s = empty(courseId); let dropped = 0;
    for (const key of ['items', 'texts', 'criteria', 'visited', 'confidence', 'reviews', 'prefs', 'concepts']) if (key in data && !isObj(data[key])) throw new Error(`"${key}" must be an object`);
    const each = (src, fn) => { for (const [k, v] of Object.entries(src || {})) { if (k.length > 200) { dropped++; continue; } if (fn(v, k) === undefined) dropped++; } };
    each(data.items, (v, k) => {
      if (!isObj(v) || !(Number.isInteger(v.attempts) && v.attempts >= 0) || (v.h != null && typeof v.h !== 'string')) return;
      const r = { h: v.h, attempts: v.attempts };
      if (v.first != null) { if (!isAnswer(v.first)) return; r.first = v.first; }
      if (v.last != null) { if (!isAnswer(v.last)) return; r.last = v.last; }
      if (v.correctFirst != null) r.correctFirst = v.correctFirst === true;
      if (isDate(v.at)) r.at = v.at;
      if (v.data !== undefined) { try { const j = JSON.stringify(v.data); if (j.length <= 20000) r.data = JSON.parse(j); } catch (e) { return; } }
      return (s.items[k] = r);
    });
    each(data.texts, (v, k) => { if (!isObj(v) || typeof v.v !== 'string' || v.v.length > 100000) return; return (s.texts[k] = { id: k, v: v.v, h: typeof v.h === 'string' ? v.h : undefined, at: isDate(v.at) ? v.at : undefined }); });
    each(data.criteria, (v, k) => { if (!isObj(v) || !Array.isArray(v.checks) || v.checks.length > 50) return; return (s.criteria[k] = { h: typeof v.h === 'string' ? v.h : undefined, checks: v.checks.map(x => x === true) }); });
    each(data.visited, (v, k) => { if (!isDate(v)) return; return (s.visited[k] = v); });
    each(data.confidence, (v, k) => { if (![1, 2, 3, 4].includes(v)) return; return (s.confidence[k] = v); });
    each(data.reviews, (v, k) => { if (!Array.isArray(v) || !v.every(isDate)) return; return (s.reviews[k] = v.slice(0, 20)); });
    each(data.concepts, (v, k) => {
      if (!isObj(v) || !isDate(v.introduced) || !Number.isInteger(v.step) || v.step < 0 || v.step > 100 || (v.due != null && !isDate(v.due)) || !Array.isArray(v.events)) return;
      const events = v.events.filter(e => isObj(e) && isDate(e.d) && typeof e.ok === 'boolean').slice(-MAX_EVENTS).map(e => ({ d: e.d, ok: e.ok, src: typeof e.src === 'string' ? e.src.slice(0, 200) : undefined }));
      return (s.concepts[k] = { introduced: v.introduced, step: v.step, due: v.due || null, events });
    });
    if (isObj(data.prefs) && ['light', 'dark'].includes(data.prefs.theme)) s.prefs.theme = data.prefs.theme;
    s.courseVersion = typeof data.courseVersion === 'string' ? data.courseVersion : '';
    const migratedFrom = data.format === 1 ? 1 : null;
    return { state: s, dropped, migratedFrom };
  }

  /* After migration from format 1, rebuild concept history from what format 1 already recorded:
     the visit date introduces a lesson's concepts; a first attempt with a date becomes one retrieval event. */
  function backfillConcepts(state, model, intervals) {
    if (!model) return state;
    for (const c of model.concepts) {
      const firstLesson = (c.lessons || []).find(id => state.visited[id]);
      if (firstLesson && !state.concepts[c.id]) introduce(state, [c.id], state.visited[firstLesson], intervals);
    }
    const events = [];
    for (const [itemId, rec] of Object.entries(state.items)) {
      const ids = model.itemConcepts[itemId]; if (!ids || !rec.at || rec.correctFirst == null) continue;
      events.push({ ids, d: rec.at, ok: rec.correctFirst, src: itemId });
    }
    events.sort((a, b) => a.d.localeCompare(b.d)).forEach(e => retrieval(state, e.ids, e.ok, e.d, intervals, e.src));
    return state;
  }

  /* Remove results whose content changed since they were recorded (content hashes from the build). */
  function reconcile(state, hashes) {
    const H = hashes || {}; const stale = [];
    for (const [id, rec] of Object.entries(state.items)) if (!H[id] || rec.h !== H[id]) { stale.push(id); delete state.items[id]; }
    for (const [id, rec] of Object.entries(state.criteria)) if (!H[id] || rec.h !== H[id]) { stale.push(id); delete state.criteria[id]; }
    for (const rec of Object.values(state.texts)) rec.changed = !!(rec.h && H[rec.id] && rec.h !== H[rec.id]);
    return stale;
  }

  /* Concept model built from course.knowledgeArchitecture and the `concepts` tags on items. */
  function conceptModel(course, lessons) {
    const ka = course && course.knowledgeArchitecture; if (!ka || !Array.isArray(ka.concepts) || !ka.concepts.length) return null;
    const itemConcepts = {}; const conceptItems = {};
    const tag = (id, ids) => { if (!id || !Array.isArray(ids) || !ids.length) return; itemConcepts[id] = ids.slice(); ids.forEach(c => (conceptItems[c] = conceptItems[c] || []).push(id)); };
    for (const l of lessons || []) for (const b of l.blocks || []) {
      if (b.type === 'predict' || b.type === 'transfer' || b.type === 'practice' || b.type === 'activity') tag(b.id, b.concepts);
      (b.questions || []).forEach(q => tag(q.id, q.concepts));
    }
    const byLesson = {}; ka.concepts.forEach(c => (c.lessons || []).forEach(id => (byLesson[id] = byLesson[id] || []).push(c.id)));
    return { concepts: ka.concepts, itemConcepts, conceptItems, byLesson };
  }

  function introduce(state, ids, date, intervals) {
    const iv = intervals && intervals.length ? intervals : [1, 3, 7, 21, 60];
    for (const id of ids) if (!state.concepts[id]) state.concepts[id] = { introduced: date, step: 0, due: addDays(date, iv[0]), events: [] };
  }

  /* Expanding intervals: a successful retrieval moves to the next interval; a failed one returns to the first.
     After the last interval the concept is not scheduled again (due: null) unless a later retrieval fails. */
  function retrieval(state, ids, ok, date, intervals, src) {
    const iv = intervals && intervals.length ? intervals : [1, 3, 7, 21, 60];
    for (const id of ids) {
      if (!state.concepts[id]) introduce(state, [id], date, iv);
      const c = state.concepts[id];
      c.events.push({ d: date, ok: !!ok, src }); if (c.events.length > MAX_EVENTS) c.events.splice(0, c.events.length - MAX_EVENTS);
      if (ok) { c.step = Math.min(c.step + 1, iv.length); c.due = c.step >= iv.length ? null : addDays(date, iv[c.step]); }
      else { c.step = 0; c.due = addDays(date, iv[0]); }
    }
  }

  function dueConcepts(state, date) {
    return Object.entries(state.concepts).filter(([, c]) => c.due && c.due <= date).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id);
  }

  function summary(c) {
    const n = c.events.length, ok = c.events.filter(e => e.ok).length;
    return { introduced: c.introduced, retrievals: n, successful: ok, last: n ? c.events[n - 1] : null, due: c.due };
  }

  return { FORMAT, empty, clean, backfillConcepts, reconcile, conceptModel, introduce, retrieval, dueConcepts, summary, addDays };
});
