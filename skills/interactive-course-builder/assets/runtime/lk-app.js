/* Learning kit runtime: renders a built course bundle (window.LK_DATA) offline.
   Patterns derived from the "Proxmox desde cero" course app, generalized and data-driven. */
(function () {
  'use strict';
  const D = window.LK_DATA;
  if (!D || !D.course) { document.body.innerHTML = '<p style="padding:2em">Missing course bundle (content.js).</p>'; return; }
  const C = D.course; const LESSONS = D.lessons || [];
  const langKey = String(C.language || 'en').split('-')[0];
  const T = Object.assign({}, window.LK_I18N.en, window.LK_I18N[langKey] || {}, C.ui || {});
  const t = k => (T[k] != null ? T[k] : k);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const lessonById = id => LESSONS.find(l => l.id === id);
  const moduleOf = l => C.modules.find(m => m.lessons.includes(l.id));
  const order = C.modules.flatMap(m => m.lessons).map(lessonById).filter(Boolean);
  document.documentElement.lang = C.language || 'en';
  if (C.dir) document.documentElement.dir = C.dir;
  document.documentElement.dataset.profile = (C.theme && C.theme.profile) || 'general';

  /* ---------- Learner state ---------- */
  const KEY = 'lk:' + C.id + ':v1';
  const EMPTY = () => ({ format: 1, courseId: C.id, courseVersion: C.version || '', items: {}, texts: {}, criteria: {}, visited: {}, confidence: {}, reviews: {}, diag: null, prefs: {} });
  let storageOk = true; let staleReport = [];
  function reconcile(s) {
    // Discard results for activities whose content hash changed (or that no longer exist).
    const H = D.hashes || {}; const stale = [];
    for (const [id, rec] of Object.entries(s.items || {})) { if (!H[id] || rec.h !== H[id]) { stale.push(id); delete s.items[id]; } }
    for (const [id, rec] of Object.entries(s.criteria || {})) { if (!H[id] || rec.h !== H[id]) { stale.push(id); delete s.criteria[id]; } }
    for (const rec of Object.values(s.texts || {})) rec.changed = !!(rec.h && H[rec.id] && rec.h !== H[rec.id]);
    return stale;
  }
  // Validate learner state field by field before it is used or saved (imported files and stored data are untrusted).
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const isAnswer = x => typeof x === 'number' || (typeof x === 'string' && x.length <= 200) || (Array.isArray(x) && x.length <= 50 && x.every(n => Number.isInteger(n)));
  function cleanState(data) {
    if (!isObj(data) || data.format !== 1) throw new Error('format');
    if (data.courseId !== C.id) throw new Error(t('wrongCourse'));
    const s = EMPTY(); let dropped = 0;
    for (const key of ['items', 'texts', 'criteria', 'visited', 'confidence', 'reviews', 'prefs']) if (key in data && !isObj(data[key])) throw new Error(`"${key}" must be an object`);
    const each = (src, fn) => { for (const [k, v] of Object.entries(src || {})) { if (k.length > 200) { dropped++; continue; } const r = fn(v, k); if (r === undefined) dropped++; } };
    each(data.items, (v, k) => { if (!isObj(v) || !(Number.isInteger(v.attempts) && v.attempts >= 0) || (v.h != null && typeof v.h !== 'string')) return; const r = { h: v.h, attempts: v.attempts }; if (v.first != null) { if (!isAnswer(v.first)) return; r.first = v.first; } if (v.last != null) { if (!isAnswer(v.last)) return; r.last = v.last; } if (v.correctFirst != null) r.correctFirst = v.correctFirst === true; if (isDate(v.at)) r.at = v.at; if (v.data !== undefined) { try { const j = JSON.stringify(v.data); if (j.length <= 20000) r.data = JSON.parse(j); } catch (e) { return; } } s.items[k] = r; return r; });
    each(data.texts, (v, k) => { if (!isObj(v) || typeof v.v !== 'string' || v.v.length > 100000) return; return (s.texts[k] = { id: k, v: v.v, h: typeof v.h === 'string' ? v.h : undefined, at: isDate(v.at) ? v.at : undefined }); });
    each(data.criteria, (v, k) => { if (!isObj(v) || !Array.isArray(v.checks) || v.checks.length > 50) return; return (s.criteria[k] = { h: typeof v.h === 'string' ? v.h : undefined, checks: v.checks.map(x => x === true) }); });
    each(data.visited, (v, k) => { if (!isDate(v)) return; return (s.visited[k] = v); });
    each(data.confidence, (v, k) => { if (![1, 2, 3, 4].includes(v)) return; return (s.confidence[k] = v); });
    each(data.reviews, (v, k) => { if (!Array.isArray(v) || !v.every(isDate)) return; return (s.reviews[k] = v.slice(0, 20)); });
    if (isObj(data.prefs) && ['light', 'dark'].includes(data.prefs.theme)) s.prefs.theme = data.prefs.theme;
    s.courseVersion = typeof data.courseVersion === 'string' ? data.courseVersion : '';
    return { state: s, dropped };
  }
  let corruptNotice = false;
  function load() {
    let raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; return EMPTY(); }
    if (!raw) return EMPTY();
    try { const { state } = cleanState(JSON.parse(raw)); staleReport = reconcile(state); return state; }
    catch (e) {
      // Keep the damaged data aside instead of crashing on every visit; the course starts clean.
      try { localStorage.setItem(KEY + ':damaged', raw); localStorage.removeItem(KEY); } catch (x) { /* storage unavailable */ }
      corruptNotice = true; return EMPTY();
    }
  }
  let S = load(); let saveTimer = null;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; } }, 120); }
  if (staleReport.length) save();

  /* ---------- Glossary & search index ---------- */
  const GLOSS = new Map();
  (C.glossary || []).forEach(g => [g.term, ...(g.aka || [])].forEach(k => { const key = norm(k); if (!GLOSS.has(key)) GLOSS.set(key, g); }));
  let INDEX = [];
  function buildIndex() {
    INDEX = [];
    for (const l of order) {
      const text = strip((l.blocks || []).map(b => [b.html, b.limits, b.alt, b.prompt, b.task, b.solution, b.model, b.title, (b.steps || []).map(s => s.html).join(' '), (b.questions || []).map(q => q.prompt).join(' ')].join(' ')).join(' '));
      INDEX.push({ title: l.title, sub: (moduleOf(l) || {}).title, href: '#/l/' + l.id, text, w: 2 });
    }
    (C.glossary || []).forEach(g => INDEX.push({ title: t('glossary') + ': ' + g.term, href: '#/glossary', text: g.definition + ' ' + (g.aka || []).join(' '), w: 4 }));
    INDEX.forEach(e => { e.n = norm(e.title + ' ' + e.text); e.nt = norm(e.title); });
  }
  function search(q) {
    const terms = norm(q).split(/\s+/).filter(x => x.length > 1); if (!terms.length) return [];
    return INDEX.filter(e => terms.every(x => e.n.includes(x))).map(e => ({ e, s: e.w + terms.reduce((a, x) => a + (e.nt.includes(x) ? 10 : 0) + Math.min(5, e.n.split(x).length - 1), 0) })).sort((a, b) => b.s - a.s).slice(0, 50).map(x => x.e);
  }
  function snippet(text, q) {
    const terms = norm(q).split(/\s+/).filter(x => x.length > 1); const i = Math.max(0, norm(text).indexOf(terms[0]) - 80);
    let out = esc(text.slice(i, i + 240)); terms.forEach(x => { out = out.replace(new RegExp('(' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); });
    return (i ? '… ' : '') + out + ' …';
  }

  /* ---------- Rendering helpers ---------- */
  const label = (key, n) => `<div class="phase-label">${n != null ? `<span class="n">${n}</span>` : ''}${esc(t(key))}</div>`;
  function textBox(id, lbl, ph) {
    const rec = S.texts[id];
    return `<label for="tx-${esc(id)}">${esc(lbl)}</label>${rec && rec.changed ? `<p class="status-warn small">${esc(t('staleNotice'))}</p>` : ''}<textarea id="tx-${esc(id)}" data-text="${esc(id)}" placeholder="${esc(ph || '')}">${esc(rec ? rec.v : '')}</textarea><span class="saved small" data-saved="${esc(id)}"></span>`;
  }
  function criteriaHtml(id, list) {
    if (!list || !list.length) return '';
    const rec = S.criteria[id] || { checks: [] };
    return `<fieldset class="card"><legend class="small">${esc(t('criteria'))}</legend><ul class="rubric">${list.map((c, i) => `<li><label><input type="checkbox" data-crit="${esc(id)}" data-i="${i}" ${rec.checks[i] ? 'checked' : ''}> ${c}</label></li>`).join('')}</ul></fieldset>`;
  }
  function feedbackHtml(q, chosen) {
    const ok = isCorrect(q, chosen);
    let h = ok ? `<p class="status-ok">${esc(t('correct'))}</p>` : `<p class="status-bad">${esc(t('incorrect'))}</p>`;
    if (!ok && q.kind !== 'multi' && q.feedback && q.feedback[chosen] != null) h += `<p>${q.feedback[chosen]}</p>`;
    if (!ok && q.kind === 'numeric' && q.feedbackWrong) h += `<p>${q.feedbackWrong}</p>`;
    h += `<div>${q.explanation || ''}</div>`;
    if (!ok) h += `<p class="small">${esc(t('tryAgain'))}</p>`;
    return h;
  }
  function isCorrect(q, v) {
    if (q.kind === 'multi') { const a = [...(v || [])].sort().join(','); return a === [...q.correct].sort().join(','); }
    if (q.kind === 'numeric') { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && Math.abs(x - q.answer) <= (q.tolerance || 0); }
    return v === q.correct;
  }
  function questionHtml(q, opts = {}) {
    const id = q.id; const rec = S.items[id]; const reveal = !!opts.print;
    const head = `${opts.kicker ? `<div class="q-label">${esc(opts.kicker)}</div>` : ''}<div class="q-text">${q.prompt}</div>`;
    const fb = rec ? feedbackHtml(q, rec.last) : (reveal ? `<div>${q.explanation || ''}</div>${q.feedback ? `<ul>${Object.entries(q.feedback).map(([k, v]) => `<li>${q.options ? q.options[k] : k}: ${v}</li>`).join('')}</ul>` : ''}` : '');
    if (q.kind === 'open' || !q.kind && !q.options) {
      return `<div class="q ${opts.cls || ''}" data-q="${esc(id)}">${head}${textBox(id, t('yourAnswer'), t('writeFirst'))}${criteriaHtml(id, q.rubric)}<details ${reveal ? 'open' : ''}><summary>${esc(t('showModel'))}</summary>${q.model || ''}</details></div>`;
    }
    if (q.kind === 'numeric') {
      return `<div class="q ${opts.cls || ''}" data-q="${esc(id)}">${head}<div class="row"><label class="sr-only" for="num-${esc(id)}">${esc(t('yourAnswer'))}</label><input type="text" inputmode="decimal" id="num-${esc(id)}" data-num="${esc(id)}" value="${rec ? esc(rec.last) : ''}"> ${q.unit ? esc(q.unit) : ''} <button type="button" class="btn small" data-numcheck="${esc(id)}">${esc(t('check'))}</button></div><div class="fb" aria-live="polite" ${fb ? '' : 'hidden'}>${fb}</div></div>`;
    }
    const multi = q.kind === 'multi';
    const chosen = rec ? rec.last : null;
    const optHtml = q.options.map((o, i) => {
      let cls = '';
      if (rec || reveal) { const corr = multi ? q.correct.includes(i) : q.correct === i; const picked = multi ? (chosen || []).includes(i) : chosen === i; if (corr) cls = 'correct'; else if (picked) cls = 'wrong'; }
      const sr = cls === 'correct' ? `<span class="sr-only">${esc(t('correct'))} </span>` : cls === 'wrong' ? `<span class="sr-only">${esc(t('incorrect'))} </span>` : '';
      return multi
        ? `<label class="opt ${cls}"><input type="checkbox" data-multi="${esc(id)}" data-i="${i}" ${(chosen || []).includes(i) ? 'checked' : ''}> ${sr}${o}</label>`
        : `<button type="button" class="opt ${cls}" data-mcq="${esc(id)}" data-i="${i}" aria-pressed="${chosen === i}">${sr}${o}</button>`;
    }).join('');
    return `<div class="q ${opts.cls || ''}" data-q="${esc(id)}">${head}<div class="opts" role="group">${optHtml}</div>${multi ? `<button type="button" class="btn small" data-multicheck="${esc(id)}" style="margin-top:8px">${esc(t('check'))}</button>` : ''}<div class="fb" aria-live="polite" ${fb ? '' : 'hidden'}>${fb}</div></div>`;
  }
  const QUESTIONS = new Map();
  function registerQuestions() {
    for (const l of LESSONS) for (const b of l.blocks || []) {
      if (b.type === 'predict') QUESTIONS.set(b.id, Object.assign({ kind: b.options ? 'mcq' : 'open' }, b, { lesson: l.id }));
      (b.questions || []).forEach(q => QUESTIONS.set(q.id, Object.assign({ kind: q.options ? 'mcq' : 'open' }, q, { lesson: l.id })));
    }
    (C.diagnostic && C.diagnostic.questions || []).forEach(q => QUESTIONS.set(q.id, Object.assign({ kind: 'mcq', diag: true }, q)));
  }
  function record(id, value) {
    const q = QUESTIONS.get(id); const H = D.hashes || {};
    const rec = S.items[id] || { h: H[id], attempts: 0 };
    rec.attempts++; rec.last = value; rec.at = today();
    if (q && rec.attempts === 1) { rec.first = value; rec.correctFirst = isCorrect(q, value); }
    S.items[id] = rec; save(); return rec;
  }

  function blockHtml(l, b, i, print) {
    const n = i + 1;
    switch (b.type) {
      case 'motivate': return `<section class="block motivate" id="b-${esc(b.id || i)}">${label('b_motivate', n)}${b.html}</section>`;
      case 'intuition': return `<section class="block">${label('b_intuition', n)}${b.html}${b.limits ? `<div class="analogy-limit" data-label="${esc(t('b_limits'))}">${b.limits}</div>` : ''}</section>`;
      case 'visual': return `<section class="block">${label('b_visual', n)}${b.html}<p class="alt-text"><strong>${esc(t('textEquivalent'))}:</strong> ${esc(b.alt)}</p></section>`;
      case 'explain': return `<section class="block">${label('b_explain', n)}${b.title ? `<h3>${esc(b.title)}</h3>` : ''}${b.html}</section>`;
      case 'prose': return `<section class="block">${b.html}</section>`;
      case 'callout': return `<div class="callout ${esc(b.tone || 'info')}">${b.html}</div>`;
      case 'worked': return `<section class="block worked">${label('b_worked', n)}${b.title ? `<h3>${esc(b.title)}</h3>` : ''}${b.html || ''}<ol class="worked-steps">${(b.steps || []).map((s, k) => s.selfExplain && !print ? `<li><p>${s.prompt || ''}</p><details><summary>${esc(t('showSolution'))}</summary>${s.html}</details></li>` : `<li>${s.prompt ? `<p>${s.prompt}</p>` : ''}${s.html}</li>`).join('')}</ol>${b.result || ''}</section>`;
      case 'predict': return `<section class="block">${label('b_predict', n)}${questionHtml(QUESTIONS.get(b.id), { cls: 'predict', print })}</section>`;
      case 'activity': return `<section class="block" id="act-${esc(b.id)}">${label('b_activity', n)}${b.instructions || ''}<div class="widget" data-widget="${esc(b.widget)}" data-act="${esc(b.id)}"></div>${b.debrief ? `<details ${print ? 'open' : ''}><summary>${esc(t('debrief'))}</summary>${b.debrief}</details>` : ''}</section>`;
      case 'practice': return `<section class="block practice">${label(b.level === 'independent' ? 'b_practice_independent' : 'b_practice_guided', n)}${b.setting && b.setting !== 'in-app' ? `<span class="badge">${esc(b.setting)}</span>` : ''}${b.task}${(b.hints || []).map((h, k) => `<details ${print ? 'open' : ''}><summary>${esc(t('hint'))} ${k + 1}</summary>${h}</details>`).join('')}${b.externalFeedback ? `<div class="callout info">${b.externalFeedback}</div>` : ''}${textBox(b.id, t('yourAnswer'), t('writeFirst'))}${criteriaHtml(b.id, b.rubric)}<details ${print ? 'open' : ''}><summary>${esc(t('showSolution'))}</summary>${b.solution || b.model || ''}</details></section>`;
      case 'check': return `<section class="block">${label('b_check', n)}${b.html || ''}${(b.questions || []).map(q => questionHtml(QUESTIONS.get(q.id), { print })).join('')}</section>`;
      case 'transfer': return `<section class="block transfer">${label('b_transfer', n)}${b.task}${textBox(b.id, t('yourAnswer'), t('writeFirst'))}${criteriaHtml(b.id, b.rubric)}<details ${print ? 'open' : ''}><summary>${esc(t('showModel'))}</summary>${b.model || ''}</details></section>`;
      case 'reflect': return `<section class="block card">${label('b_reflect', n)}<p>${b.prompt}</p>${textBox(b.id, t('yourAnswer'), '')}</section>`;
      default: return `<section class="block">${b.html || ''}</section>`;
    }
  }
  function lessonStatus(l) {
    const acts = (l.blocks || []).filter(b => b.type === 'activity');
    const qs = (l.blocks || []).flatMap(b => b.type === 'predict' ? [b] : (b.questions || [])).filter(q => (QUESTIONS.get(q.id) || {}).kind !== 'open');
    const opens = (l.blocks || []).flatMap(b => ['practice', 'transfer', 'reflect'].includes(b.type) ? [b] : (b.type === 'check' ? b.questions.filter(q => QUESTIONS.get(q.id).kind === 'open') : (b.type === 'predict' && !b.options ? [b] : []))) ;
    return {
      visited: !!S.visited[l.id], acts: acts.length, actsDone: acts.filter(a => S.items[a.id]).length,
      qs: qs.length, qsRight: qs.filter(q => S.items[q.id] && S.items[q.id].correctFirst).length, qsTried: qs.filter(q => S.items[q.id]).length,
      opens: opens.length, opensDone: opens.filter(o => S.texts[o.id] && S.texts[o.id].v.trim()).length, conf: S.confidence[l.id] || 0,
    };
  }
  function statusHtml(l) {
    const s = lessonStatus(l);
    return `<div class="card no-print"><strong>${esc(t('lessonStatus'))}</strong><div class="status-box"><span>${s.visited ? '✓' : '—'} ${esc(t('visited'))}</span><span>${s.actsDone}/${s.acts} ${esc(t('attempted'))}</span><span>${s.qsRight}/${s.qs} ${esc(t('demonstrated'))}</span><span>${s.opensDone}/${s.opens} ${esc(t('written'))}</span><span>${esc(t('selfRated'))}: ${s.conf ? esc(t('conf' + s.conf)) : '—'}</span></div><p class="small">${esc(t('distinguish'))}</p></div>`;
  }
  const outcomeText = id => { const o = (C.outcomes || []).find(x => x.id === id); return o ? o.text : id; };
  function lessonHtml(l, print) {
    const m = moduleOf(l) || {}; const idx = order.indexOf(l); const prev = order[idx - 1]; const next = order[idx + 1];
    const pre = (l.prerequisites || []).map(id => lessonById(id)).filter(Boolean);
    let h = `<article class="${print ? 'print-module' : ''}"><header class="module-head"><div class="eyebrow">${esc(t('module'))} ${esc(m.title || '')}</div><h1>${esc(l.title)}</h1>${l.summary ? `<p class="meta">${esc(l.summary)}</p>` : ''}
      <div class="row"><span class="badge ${l.level === 'advanced' ? 'avanzada' : 'esencial'}">${esc(t(l.level === 'advanced' ? 'advanced' : 'core'))}</span><span class="badge">≈ ${l.minutes} ${esc(t('minutes'))}</span>${(l.tags || []).map(x => `<span class="badge">${esc(x)}</span>`).join('')}</div></header>
      <div class="grid" style="margin-top:14px"><div class="card"><h3 style="margin-top:0">${esc(t('outcomes'))}</h3><ul>${(l.outcomes || []).map(o => `<li>${esc(outcomeText(o))}</li>`).join('')}</ul></div>
      <div class="card"><h3 style="margin-top:0">${esc(t('prerequisites'))}</h3>${pre.length ? `<ul>${pre.map(p => `<li><a href="#/l/${esc(p.id)}">${esc(p.title)}</a></li>`).join('')}</ul>` : `<p>${esc(t('noPrereq'))}</p>`}${l.prereqText ? `<p>${l.prereqText}</p>` : ''}</div></div>`;
    if (!print) h += statusHtml(l);
    (l.blocks || []).forEach((b, i) => { h += blockHtml(l, b, i, print); });
    h += `<section><h2>${esc(t('b_sources'))}</h2><ul>${(l.sources || []).map(sourceItem).join('')}</ul><h2>${esc(t('whatNext'))}</h2>${l.next || ''}</section>`;
    if (!print) {
      h += `<section class="card no-print"><p><strong>${esc(t('confidence'))}</strong></p><div class="conf" role="group">${[1, 2, 3, 4].map(k => `<button type="button" class="btn small" data-conf="${esc(l.id)}" data-v="${k}" aria-pressed="${S.confidence[l.id] === k}">${esc(t('conf' + k))}</button>`).join('')}</div>
        <h3>${esc(t('notes'))}</h3>${textBox('note:' + l.id, t('lessonNotes'), '')}</section>
        <nav class="pager no-print">${prev ? `<a class="btn" href="#/l/${esc(prev.id)}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn primary" href="#/l/${esc(next.id)}">${esc(next.title)} →</a>` : (C.capstone ? `<a class="btn primary" href="#/capstone">${esc(t('capstone'))} →</a>` : '')}</nav>`;
    }
    return h + '</article>';
  }
  const sourceItem = s => `<li><span class="badge">${esc((T.sourceKinds || {})[s.kind] || s.kind || '')}</span> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${s.author ? ` — ${esc(s.author)}` : ''}${s.date ? ` (${esc(s.date)})` : ''}${s.accessed ? ` <span class="small">· ${esc(s.accessed)}</span>` : ''}${s.status === 'unverified' ? ` <span class="pill">${esc(t('unverified'))}</span>` : ''}${s.note ? `<br><span class="small">${esc(s.note)}</span>` : ''}</li>`;

  /* ---------- Defensive sanitizing of rendered content ----------
     The validator rejects unsafe HTML at build time; this second layer removes anything active that slips through,
     including content later rendered by widgets (watched with a MutationObserver). */
  const ACTIVE = 'script,iframe,object,embed,base,meta,link,form,style,frame,frameset,applet,portal';
  const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'cite', 'data', 'srcset', 'ping'];
  function safeUrl(tag, attr, value) {
    const u = String(value).replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g, '').toLowerCase();
    const parts = attr === 'srcset' ? u.split(',').map(x => x.replace(/\s+\S+$/, '')) : [u];
    return parts.every(p => { const m = p.match(/^([a-z][a-z0-9+.-]*):/); if (!m) return true; if (['http', 'https', 'mailto', 'tel'].includes(m[1])) return true; return tag === 'img' && attr === 'src' && /^data:image\/(png|jpe?g|gif|webp|avif);/.test(p); });
  }
  function sanitize(root) {
    if (!root || !root.querySelectorAll) return;
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach(el => { if (el.matches && el.matches(ACTIVE)) { el.remove(); return; }
      if ((el.localName === 'animate' || el.localName === 'set') && /href/i.test(el.getAttribute('attributeName') || '')) { el.remove(); return; }
      for (const a of [...(el.attributes || [])]) { const n = a.name.toLowerCase(); if (n.startsWith('on') || (URL_ATTRS.includes(n) && !safeUrl(el.localName, n, a.value)) || /(java|vb)script:/i.test(a.value.replace(/[\u0000-\u0020]/g, ''))) el.removeAttribute(a.name); } });
  }
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) sanitize(n); }))).observe(document.getElementById('main'), { childList: true, subtree: true });

  /* ---------- Enhancement after render ---------- */
  function enhance(root, print) {
    $$('.term, .gt', root).forEach(el => { el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); });
    $$('a[href^="http"]', root).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    $$('table', root).forEach(tb => { if (tb.closest('.table-wrap') || tb.closest('.widget')) return; const w = document.createElement('div'); w.className = 'table-wrap'; tb.parentNode.insertBefore(w, tb); w.appendChild(tb); });
    $$('figure.mockup', root).forEach(f => f.dataset.label = f.dataset.label || t('illustrative'));
    $$('.cmd', root).forEach(c => { if (!c.querySelector('.cmd-head') && (c.dataset.scope || c.dataset.kind)) { const hd = document.createElement('div'); hd.className = 'cmd-head'; hd.innerHTML = `<span>${c.dataset.scope ? '⌂ <strong>' + esc(c.dataset.scope) + '</strong>' : ''}${c.dataset.kind ? ' · ' + ({ read: '◉', reversible: '↺', risky: '⚠', simulation: '◇' }[c.dataset.kind] || '') + ' <strong>' + esc(c.dataset.kind) + '</strong>' : ''}</span>`; c.prepend(hd); } });
    $$('.output', root).forEach(o => { if (!o.querySelector('.out-head')) { const hd = document.createElement('div'); hd.className = 'out-head'; hd.textContent = o.dataset.label || t('illustrative'); o.prepend(hd); } });
    if (print) $$('details', root).forEach(d => { d.open = true; });
    $$('.widget', root).forEach(el => {
      const act = el.dataset.act; const l = act && LESSONS.find(x => (x.blocks || []).some(b => b.id === act)); const b = l && l.blocks.find(x => x.id === act);
      const name = el.dataset.widget; const W = window.LK.widgets[name]; const cfg = b ? (b.config || {}) : {};
      if (print) { el.innerHTML = `<p class="w-title" data-kicker="${esc(W ? t(W.kind || '') : '')}">${esc((cfg && cfg.title) || (W && W.title) || name)}</p><p>${esc(t('interactiveOnly'))}</p>`; return; }
      if (!W) { el.innerHTML = `<p class="status-bad">Unknown widget "${esc(name)}".</p>`; return; }
      const api = { t, esc, lang: C.language || 'en', id: act, fmt: (v, d = 2) => Number(v).toLocaleString(C.language || 'en', { minimumFractionDigits: d, maximumFractionDigits: d }), record: data => { const H = D.hashes || {}; const rec = S.items[act] || { h: H[act], attempts: 0 }; rec.attempts++; rec.data = data; rec.at = today(); S.items[act] = rec; save(); }, expr: window.LKExpr };
      try { W.mount(el, cfg, api); } catch (e) { el.innerHTML = `<p class="status-bad">Error in activity “${esc(name)}”: ${esc(e.message)}</p>`; console.error(e); }
      const title = el.querySelector('.w-title'); if (title && !title.dataset.kicker) title.dataset.kicker = t(W.kind || 'activities');
    });
    setTimeout(() => fitSvgText(root), 0);
  }
  function fitSvgText(root) {
    $$('figure svg', root).forEach(svg => {
      if (svg.closest('.widget')) return; const vb = svg.viewBox && svg.viewBox.baseVal; if (!vb || !vb.width) return;
      let rects; try { rects = $$('rect', svg).map(r => r.getBBox()).filter(r => r.height <= 80); } catch (e) { return; }
      $$('text', svg).forEach(tx => {
        let b; try { b = tx.getBBox(); } catch (e) { return; } if (!b.width) return;
        const mid = b.y + b.height / 2; const box = rects.filter(r => b.x >= r.x - 1 && b.x <= r.x + r.width && mid >= r.y && mid <= r.y + r.height).sort((p, q) => p.width * p.height - q.width * q.height)[0];
        let limit = vb.x + vb.width - 4; if (box) limit = Math.min(limit, box.x + box.width - 4);
        if (b.x + b.width - limit > 1) { const size = parseFloat(getComputedStyle(tx).fontSize) || 12; tx.style.fontSize = Math.max(8.5, size * (limit - b.x) / b.width) + 'px'; }
      });
    });
  }

  /* ---------- Events ---------- */
  function refreshQuestion(id) {
    const box = $(`.q[data-q="${CSS.escape(id)}"]`); if (!box) return;
    const q = QUESTIONS.get(id); const opts = { cls: box.classList.contains('predict') ? 'predict' : '' };
    const tmp = document.createElement('div'); tmp.innerHTML = questionHtml(q, opts); box.replaceWith(tmp.firstElementChild);
  }
  document.addEventListener('click', e => {
    const mcq = e.target.closest('[data-mcq]');
    if (mcq) { const id = mcq.dataset.mcq; record(id, +mcq.dataset.i); refreshQuestion(id); const b = $(`[data-mcq="${CSS.escape(id)}"][data-i="${mcq.dataset.i}"]`); if (b) b.focus(); return; }
    const mc = e.target.closest('[data-multicheck]');
    if (mc) { const id = mc.dataset.multicheck; const v = $$(`[data-multi="${CSS.escape(id)}"]`).filter(x => x.checked).map(x => +x.dataset.i); record(id, v); refreshQuestion(id); return; }
    const nc = e.target.closest('[data-numcheck]');
    if (nc) { const id = nc.dataset.numcheck; const v = $(`[data-num="${CSS.escape(id)}"]`).value; record(id, v); refreshQuestion(id); return; }
    const cf = e.target.closest('[data-conf]');
    if (cf) { S.confidence[cf.dataset.conf] = +cf.dataset.v; save(); $$(`[data-conf="${CSS.escape(cf.dataset.conf)}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === cf))); return; }
    const term = e.target.closest('.term, .gt'); if (term) { showGloss(term); return; }
    if (e.target.closest('.popover .close') || !e.target.closest('.popover')) hidePop();
    if (e.target.closest('.sidebar a') && window.innerWidth <= 900) toggleMenu(false);
  });
  document.addEventListener('change', e => {
    const c = e.target.closest('[data-crit]');
    if (c) { const id = c.dataset.crit; const rec = S.criteria[id] || { h: (D.hashes || {})[id], checks: [] }; rec.checks[+c.dataset.i] = c.checked; S.criteria[id] = rec; save(); }
  });
  document.addEventListener('input', e => {
    const tx = e.target.closest('[data-text]'); if (!tx) return;
    const id = tx.dataset.text; S.texts[id] = { id, v: tx.value, h: (D.hashes || {})[id], at: today() }; save();
    const s = $(`[data-saved="${CSS.escape(id)}"]`); if (s) s.textContent = storageOk ? t('saved') : t('notSaved');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hidePop(); toggleMenu(false); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.term, .gt')) { e.preventDefault(); showGloss(e.target); }
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
  });
  let pop = null, popFrom = null;
  function showGloss(el) {
    hidePop(); const g = GLOSS.get(norm(el.dataset.term || el.dataset.t || el.textContent));
    pop = document.createElement('div'); pop.className = 'popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', t('definition'));
    pop.innerHTML = g ? `<button class="copy close" type="button" aria-label="${esc(t('close'))}">✕</button><h4>${esc(g.term)}</h4><p>${esc(g.definition)}</p>${g.aka && g.aka.length ? `<p class="small">${esc(t('aka'))}: ${g.aka.map(esc).join(', ')}</p>` : ''}<p class="small"><a href="#/glossary">${esc(t('glossary'))}</a></p>` : `<p>—</p>`;
    document.body.appendChild(pop); const r = el.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 12)) + 'px'; pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    popFrom = el; const b = pop.querySelector('.close'); if (b) b.focus();
  }
  function hidePop() { if (pop) { pop.remove(); pop = null; if (popFrom && document.body.contains(popFrom)) popFrom.focus({ preventScroll: true }); popFrom = null; } }

  /* ---------- Pages ---------- */
  function sidebar(active) {
    let h = `<h2>${esc(C.title)}</h2><ul>${[['#/', t('home')], ['#/map', t('map')], ...(C.diagnostic ? [['#/diagnostic', t('diagnostic')]] : []), ['#/routes', t('routes')]].map(([hr, tx]) => `<li><a href="${hr}" ${active === hr ? 'aria-current="page"' : ''}>${esc(tx)}</a></li>`).join('')}</ul>`;
    C.modules.forEach((m, mi) => {
      h += `<h2>${mi + 1}. ${esc(m.title)}</h2><ul>`;
      m.lessons.map(lessonById).filter(Boolean).forEach(l => { const s = lessonStatus(l); const href = '#/l/' + l.id; h += `<li><a href="${href}" ${active === href ? 'aria-current="page"' : ''}><span>${esc(l.title)}${l.level === 'advanced' ? ` <span class="small">(${esc(t('advanced'))})</span>` : ''}</span>${s.visited ? '<span class="mark done">✓</span>' : ''}</a></li>`; });
      h += '</ul>';
    });
    const tools = [...(C.capstone ? [['#/capstone', t('capstone')]] : []), ['#/review', t('review')], ['#/glossary', t('glossary')], ['#/sources', t('sources')], ['#/progress', t('progress')], ['#/print', t('print')]];
    h += `<h2>${esc(t('tools'))}</h2><ul>${tools.map(([hr, tx]) => `<li><a href="${hr}" ${active === hr ? 'aria-current="page"' : ''}>${esc(tx)}</a></li>`).join('')}</ul>`;
    $('#sidebar').innerHTML = h;
  }
  function pageHome() {
    const first = order.find(l => !S.visited[l.id]) || order[0];
    const total = order.reduce((a, l) => a + (l.minutes || 0), 0);
    let h = `<section class="hero"><h1>${esc(C.title)}</h1>${C.subtitle ? `<p class="lead">${esc(C.subtitle)}</p>` : ''}
      <div class="row">${first ? `<a class="btn primary" href="#/l/${esc(first.id)}">${esc(Object.keys(S.visited).length ? t('continue') : t('start'))}: ${esc(first.title)}</a>` : ''}${C.diagnostic ? `<a class="btn" href="#/diagnostic">${esc(t('diagnostic'))}</a>` : ''}<a class="btn" href="#/map">${esc(t('map'))}</a></div></section>`;
    if (corruptNotice) h += `<div class="notice">${esc(t('stateDamaged'))}</div>`;
    if (staleReport.length) h += `<div class="notice">${esc(t('staleNotice'))} ${staleReport.map(esc).join(', ')}</div>`;
    if (!storageOk) h += `<div class="notice">${esc(t('storageBlocked'))}</div>`;
    h += C.intro || '';
    h += `<h2>${esc(t('outcomes'))}</h2><ul>${(C.outcomes || []).map(o => `<li>${esc(o.text)}${o.level === 'advanced' ? ` <span class="pill">${esc(t('advanced'))}</span>` : ''}</li>`).join('')}</ul>`;
    if (C.assumptions && C.assumptions.length) h += `<h2>${esc(t('modelNote'))}</h2><ul>${C.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
    h += `<p class="meta">${order.length} · ≈ ${Math.round(total / 6) / 10} h</p>`;
    h += `<h2>${esc(t('map'))}</h2>${mapSvg()}`;
    return h;
  }
  function mapSvg() {
    const colW = 230, rowH = 52, x0 = 10, y0 = 34, bw = 210;
    const pos = {}; C.modules.forEach((m, mi) => m.lessons.map(lessonById).filter(Boolean).forEach((l, li) => { pos[l.id] = { x: x0 + mi * colW, y: y0 + li * rowH }; }));
    const rows = Math.max(1, ...C.modules.map(m => m.lessons.length)); const W = x0 + C.modules.length * colW; const H = y0 + rows * rowH + 10;
    let lines = '', boxes = '';
    order.forEach(l => (l.prerequisites || []).forEach(p => { const a = pos[p], b = pos[l.id]; if (!a || !b) return; lines += a.x === b.x ? `<path class="edge dashed" opacity="0.5" d="M${a.x + 6} ${a.y + 20} C ${a.x - 8} ${(a.y + b.y) / 2 + 20}, ${b.x - 8} ${(a.y + b.y) / 2 + 20}, ${b.x + 6} ${b.y + 20}"/>` : `<path class="edge" opacity="0.45" marker-end="url(#arrow)" d="M${a.x + bw} ${a.y + 20} C ${a.x + bw + 12} ${a.y + 20}, ${b.x - 12} ${b.y + 20}, ${b.x} ${b.y + 20}"/>`; }));
    order.forEach(l => { const p = pos[l.id]; const v = S.visited[l.id]; const lab = l.title.length > 30 ? l.title.slice(0, 29) + '…' : l.title; boxes += `<a href="#/l/${esc(l.id)}" aria-label="${esc(l.title)}"><rect x="${p.x}" y="${p.y}" width="${bw}" height="40" rx="7" class="n${(C.modules.indexOf(moduleOf(l)) % 4) + 1}" ${l.level === 'advanced' ? 'stroke-dasharray="5 3"' : ''}/><text class="ts" x="${p.x + 8}" y="${p.y + 17}">${esc(lab)}</text><text class="tm" x="${p.x + 8}" y="${p.y + 32}">${v ? '✓ · ' : ''}${l.minutes} ${esc(t('minutes'))}</text></a>`; });
    const heads = C.modules.map((m, i) => `<text class="t" x="${x0 + i * colW}" y="20">${i + 1}. ${esc(m.title.length > 26 ? m.title.slice(0, 25) + '…' : m.title)}</text>`).join('');
    return `<figure class="mapwrap"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 900)}px" role="group" aria-label="${esc(t('map'))}">${heads}${lines}${boxes}</svg><figcaption>${esc(t('map'))}: ${C.modules.map((m, i) => `${i + 1}. ${m.title} (${m.lessons.length})`).map(esc).join(' · ')}</figcaption></figure>`;
  }
  function pageMap() {
    let h = `<h1>${esc(t('map'))}</h1>${mapSvg()}`;
    h += `<h2>${esc(t('outcomes'))}</h2><div class="table-wrap"><table><thead><tr><th>${esc(t('outcomes'))}</th><th>${esc(t('lesson'))}</th><th>${esc(t('b_check'))}</th></tr></thead><tbody>`;
    (C.outcomes || []).forEach(o => {
      const ls = order.filter(l => (l.outcomes || []).includes(o.id));
      const asses = []; order.forEach(l => (l.blocks || []).forEach(b => { if ((b.assesses || []).includes(o.id)) asses.push(`${l.title}: ${b.type}`); (b.questions || []).forEach(q => { if ((q.assesses || []).includes(o.id)) asses.push(`${l.title}: ${q.id}`); }); }));
      if (C.capstone && (C.capstone.assesses || []).includes(o.id)) asses.push(t('capstone'));
      h += `<tr><td>${esc(o.text)}</td><td>${ls.map(l => `<a href="#/l/${esc(l.id)}">${esc(l.title)}</a>`).join('<br>')}</td><td class="small">${asses.map(esc).join('<br>')}</td></tr>`;
    });
    return h + '</tbody></table></div>';
  }
  function pageRoutes() {
    const sm = (C.learner && C.learner.time && C.learner.time.sessionMinutes) || 40;
    let h = `<h1>${esc(t('routes'))}</h1>`;
    (C.routes || []).forEach(r => {
      h += `<div class="card"><h2 style="margin-top:0">${esc(r.title)}</h2><p>${esc(r.description || '')}</p><ol>${(r.lessons || []).map(lessonById).filter(Boolean).map(l => `<li><a href="#/l/${esc(l.id)}">${esc(l.title)}</a> · ${l.minutes} ${esc(t('minutes'))}</li>`).join('')}</ol></div>`;
    });
    // Pack lessons into sessions of the configured length (a lesson longer than a session spans several).
    const sessions = []; let cur = { items: [], min: 0 };
    order.forEach(l => { let left = l.minutes || sm; while (left > 0) { const room = sm - cur.min; if (room <= 5) { sessions.push(cur); cur = { items: [], min: 0 }; continue; } const take = Math.min(room, left); cur.items.push(`${l.title}${take < (l.minutes || sm) ? ` (${take} ${t('minutes')})` : ''}`); cur.min += take; left -= take; } });
    if (cur.items.length) sessions.push(cur);
    h += `<h2>${sessions.length} × ${sm} ${esc(t('minutes'))}</h2><ol>${sessions.map(s => `<li>${s.items.map(esc).join(' + ')}</li>`).join('')}</ol>`;
    return h;
  }
  function pageGlossary() {
    const list = [...(C.glossary || [])].sort((a, b) => norm(a.term).localeCompare(norm(b.term)));
    return `<h1>${esc(t('glossary'))}</h1><label for="gf">${esc(t('filter'))}</label> <input id="gf" type="text"><dl>${list.map(g => `<div class="gentry" data-n="${esc(norm(g.term + ' ' + (g.aka || []).join(' ')))}"><dt><strong>${esc(g.term)}</strong>${g.aka && g.aka.length ? ` <span class="small">(${g.aka.map(esc).join(', ')})</span>` : ''}</dt><dd>${esc(g.definition)}</dd></div>`).join('')}</dl>`;
  }
  function pageSources() {
    let h = `<h1>${esc(t('sources'))}</h1>`;
    if (C.sources && C.sources.length) h += `<ul>${C.sources.map(sourceItem).join('')}</ul>`;
    order.forEach(l => { if ((l.sources || []).length) h += `<h2>${esc(l.title)}</h2><ul>${l.sources.map(sourceItem).join('')}</ul>`; });
    return h;
  }
  function pageCapstone() {
    const cp = C.capstone; if (!cp) return `<h1>${esc(t('notFound'))}</h1>`;
    return `<h1>${esc(cp.title)}</h1>${cp.task}${cp.rubric ? `<h2>${esc(t('rubric'))}</h2><div class="table-wrap"><table class="rubric-table"><thead><tr><th></th>${(cp.levels || []).map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${cp.rubric.map(r => `<tr><th>${esc(r.criterion)}</th>${(r.descriptors || []).map(d => `<td>${esc(d)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${cp.evaluation ? `<div class="callout info">${cp.evaluation}</div>` : ''}${textBox(cp.id, t('yourAnswer'), '')}${criteriaHtml(cp.id, (cp.rubric || []).map(r => r.criterion + (r.descriptors && r.descriptors.length ? ' — ' + r.descriptors[r.descriptors.length - 1] : '')))}${cp.model ? `<details><summary>${esc(t('showModel'))}</summary>${cp.model}</details>` : ''}`;
  }
  function pageProgress() {
    const rows = order.map(l => { const s = lessonStatus(l); return `<tr><td><a href="#/l/${esc(l.id)}">${esc(l.title)}</a></td><td>${s.visited ? '✓ ' + esc(S.visited[l.id]) : '—'}</td><td>${s.actsDone}/${s.acts}</td><td>${s.qsRight}/${s.qs}</td><td>${s.opensDone}/${s.opens}</td><td>${s.conf ? esc(t('conf' + s.conf)) : '—'}</td></tr>`; }).join('');
    return `<h1>${esc(t('progress'))}</h1><div class="notice">${esc(t('progressNote'))}</div><p class="small">${esc(t('distinguish'))}</p>
      <div class="row no-print"><button class="btn primary" id="exp" type="button">${esc(t('export'))}</button><label class="btn" for="impf">${esc(t('import'))}</label><input id="impf" type="file" accept=".json,application/json" class="sr-only"><button class="btn" id="expn" type="button">${esc(t('exportNotes'))}</button><button class="btn" id="rst" type="button">${esc(t('reset'))}</button></div><p id="iomsg" class="meta" aria-live="polite"></p>
      <div class="table-wrap"><table><thead><tr><th>${esc(t('lesson'))}</th><th>${esc(t('visited'))}</th><th>${esc(t('attempted'))}</th><th>${esc(t('demonstrated'))}</th><th>${esc(t('written'))}</th><th>${esc(t('selfRated'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function bindProgress() {
    $('#exp').onclick = () => { download(`${C.id}-progress-${today()}.json`, JSON.stringify(S, null, 2), 'application/json'); };
    $('#expn').onclick = () => {
      let md = `# ${C.title}\n\n`;
      order.forEach(l => { const parts = Object.values(S.texts).filter(x => x.v && (x.id === 'note:' + l.id || (l.blocks || []).some(b => b.id === x.id || (b.questions || []).some(q => q.id === x.id)))); if (parts.length) md += `## ${l.title}\n\n` + parts.map(p => `**${p.id}**\n\n${p.v}\n`).join('\n') + '\n'; });
      download(`${C.id}-notes-${today()}.md`, md, 'text/markdown');
    };
    $('#impf').onchange = ev => {
      const f = ev.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => {
        try {
          const { state: s, dropped } = cleanState(JSON.parse(r.result)); // throws before anything is assigned or saved
          if (!confirm(t('importConfirm'))) return;
          staleReport = reconcile(s); S = s; save(); route();
          setTimeout(() => { const m = $('#iomsg'); if (m) m.textContent = t('importOk') + (dropped ? ' ' + t('importDropped').replace('{n}', dropped) : '') + (staleReport.length ? ' ' + t('staleNotice') + ' ' + staleReport.join(', ') : ''); }, 30);
        } catch (e) { $('#iomsg').textContent = t('importBad') + e.message; }
      };
      r.readAsText(f);
    };
    $('#rst').onclick = () => { if (confirm(t('resetConfirm'))) { S = EMPTY(); save(); route(); } };
  }
  let REVIEW = [];
  const INTERVALS = (C.review && C.review.intervals) || [1, 3, 7, 21, 60];
  function nextDue(id) { const v = S.visited[id]; if (!v) return null; const n = (S.reviews[id] || []).length; return n >= INTERVALS.length ? null : addDays(v, INTERVALS[n]); }
  function pageReview(mode) {
    const visited = order.filter(l => S.visited[l.id]); const due = visited.filter(l => { const d = nextDue(l.id); return d && d <= today(); });
    let h = `<h1>${esc(t('review'))}</h1><p class="meta">${esc(t('reviewIntro'))}</p><div class="row no-print"><a class="btn primary" href="#/review/due">${esc(t('reviewDue'))} (${due.length})</a><a class="btn" href="#/review/mixed">${esc(t('reviewMixed'))}</a></div>`;
    if (!mode) return h;
    const pool = (mode === 'due' ? due : (visited.length ? visited : order));
    if (!pool.length) return h + `<p class="status-ok">${esc(t('noDue'))}</p>`;
    const qs = []; pool.forEach(l => (l.blocks || []).forEach(b => (b.questions || []).forEach(q => qs.push({ q: QUESTIONS.get(q.id), l }))));
    for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
    REVIEW = qs.slice(0, 8);
    // Review attempts are practice: they use separate ids so first-attempt performance in the lesson is not overwritten.
    h += REVIEW.map((x, i) => { const rq = Object.assign({}, x.q, { id: 'review:' + i + ':' + x.q.id }); QUESTIONS.set(rq.id, rq); delete S.items[rq.id]; return `<p class="small">${esc(x.l.title)}</p>` + questionHtml(rq); }).join('');
    if (mode === 'due') h += `<button class="btn primary" id="revdone" type="button">${esc(t('reviewDone'))}</button>`;
    return h;
  }
  function pageDiagnostic() {
    const dg = C.diagnostic; if (!dg) return `<h1>${esc(t('notFound'))}</h1>`;
    return `<h1>${esc(t('diagnostic'))}</h1><p>${esc(t('diagIntro'))}</p>${dg.intro || ''}<p><a class="btn" href="#/l/${esc(order[0].id)}">${esc(t('skip0'))}</a></p>${dg.questions.map(q => questionHtml(QUESTIONS.get(q.id))).join('')}<button class="btn primary" type="button" id="diagbtn">${esc(t('diagResult'))}</button><div id="diagout" aria-live="polite"></div>`;
  }
  function diagResult() {
    const dg = C.diagnostic; const known = new Set();
    dg.questions.forEach(q => { const r = S.items[q.id]; if (r && r.correctFirst) (q.lessons || []).forEach(id => known.add(id)); });
    return `<div class="card"><h2 style="margin-top:0">${esc(t('diagResult'))}</h2><ul>${order.map(l => `<li><a href="#/l/${esc(l.id)}">${esc(l.title)}</a> — ${known.has(l.id) ? esc(dg.fastLabel || 'quick pass: predictions + checks') : esc(dg.fullLabel || 'study fully')}</li>`).join('')}</ul></div>`;
  }
  function pagePrint(id) {
    const list = id ? [lessonById(id)].filter(Boolean) : order;
    return `<div class="card no-print"><h1 style="margin-top:0">${esc(t('print'))}</h1><p>${esc(t('printIntro'))}</p><button class="btn primary" type="button" id="printbtn">${esc(t('printBtn'))}</button></div>` + list.map(l => lessonHtml(l, true)).join('') + (C.capstone && !id ? `<article class="print-module">${pageCapstone()}</article>` : '');
  }

  /* ---------- Router ---------- */
  let keepScroll = null;
  function route() {
    hidePop();
    const [path, query] = (location.hash || '#/').slice(1).split('?'); const seg = path.split('/').filter(Boolean);
    let html = '', active = '#/' + (seg[0] || ''), after = null, print = false;
    switch (seg[0]) {
      case undefined: html = pageHome(); active = '#/'; break;
      case 'l': { const l = lessonById(seg[1]); if (!l) { html = `<h1>${esc(t('notFound'))}</h1>`; break; } S.visited[l.id] = S.visited[l.id] || today(); save(); active = '#/l/' + l.id; html = lessonHtml(l); if (seg[2]) after = () => { const el = document.getElementById('act-' + seg[2]) || document.getElementById('b-' + seg[2]); if (el) el.scrollIntoView(); }; break; }
      case 'map': html = pageMap(); break;
      case 'routes': html = pageRoutes(); break;
      case 'glossary': html = pageGlossary(); after = () => { const inp = $('#gf'); inp.oninput = () => { const v = norm(inp.value); $$('.gentry').forEach(e => { e.hidden = v && !e.dataset.n.includes(v); }); }; }; break;
      case 'sources': html = pageSources(); break;
      case 'capstone': html = pageCapstone(); break;
      case 'progress': html = pageProgress(); after = bindProgress; break;
      case 'review': html = pageReview(seg[1]); active = '#/review'; after = () => { const b = $('#revdone'); if (b) b.onclick = () => { order.filter(l => { const d = nextDue(l.id); return d && d <= today(); }).forEach(l => (S.reviews[l.id] = S.reviews[l.id] || []).push(today())); save(); location.hash = '#/review'; }; }; break;
      case 'diagnostic': html = pageDiagnostic(); after = () => { $('#diagbtn').onclick = () => { $('#diagout').innerHTML = diagResult(); }; }; break;
      case 'print': html = pagePrint(seg[1]); active = '#/print'; print = true; after = () => { $('#printbtn').onclick = () => window.print(); }; break;
      case 'search': { const q = decodeURIComponent((query || '').replace(/^q=/, '')); const res = search(q); html = `<h1>${res.length} ${esc(t('results'))} “${esc(q)}”</h1><ol class="search-results">${res.map(e => `<li><a href="${e.href}">${esc(e.title)}</a>${e.sub ? ` <span class="small">· ${esc(e.sub)}</span>` : ''}<br><span class="small">${snippet(e.text, q)}</span></li>`).join('')}</ol>`; $('#q').value = q; active = ''; break; }
      default: html = `<h1>${esc(t('notFound'))}</h1>`;
    }
    const main = $('#main'); main.innerHTML = html; sanitize(main); sidebar(active); enhance(main, print);
    const h1 = $('h1', main); document.title = (h1 && h1.textContent !== C.title ? h1.textContent + ' · ' : '') + C.title;
    if (after) after(); else window.scrollTo(0, keepScroll || 0); keepScroll = null;
    main.focus({ preventScroll: true });
  }
  function toggleMenu(open) { const sb = $('#sidebar'); const want = open == null ? !sb.classList.contains('open') : open; sb.classList.toggle('open', want); $('#menuBtn').setAttribute('aria-expanded', String(want)); }

  /* ---------- Boot ---------- */
  function applyTheme() { if (S.prefs.theme) document.documentElement.dataset.theme = S.prefs.theme; else delete document.documentElement.dataset.theme; }
  $('#skip').textContent = t('skip'); $('#menuBtn').textContent = '☰ ' + t('menu'); $('#themeBtn').textContent = '◐ ' + t('theme');
  $('#q').placeholder = t('searchPlaceholder'); $('#qlabel').textContent = t('searchLabel'); $('#brand').textContent = C.title;
  if (C.theme && C.theme.accent) document.documentElement.style.setProperty('--accent', C.theme.accent);
  $('#themeBtn').onclick = () => { const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); S.prefs.theme = dark ? 'light' : 'dark'; save(); applyTheme(); };
  $('#menuBtn').onclick = () => toggleMenu();
  $('#searchForm').onsubmit = e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) location.hash = '#/search?q=' + encodeURIComponent(v); };
  window.addEventListener('hashchange', route);
  registerQuestions(); buildIndex(); applyTheme(); route();
  window.LK.app = { state: () => S, search, questions: QUESTIONS };
})();
