#!/usr/bin/env node
// interactive-course-builder CLI. Node >= 18, no dependencies.
//   node lk.mjs check-request <request.json>          normalize a learning request; list unknowns and blocking gaps
//   node lk.mjs init <request.json> <course-dir>        create course.json from a request (no placeholder lessons)
//   node lk.mjs validate <course-dir>                   check course and lesson contracts
//   node lk.mjs build <course-dir> [--out <dir>]        validate, then write an offline site + markdown + coverage
//   node lk.mjs coverage <course-dir>                   print outcome and lesson-contract coverage
//   node lk.mjs serve <site-dir> [port]                 serve a built site on http://127.0.0.1:<port> (for preview tools that cannot run file://)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const KIT_VERSION = '1.0.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const RUNTIME = path.join(SKILL, 'assets', 'runtime');
const require = createRequire(import.meta.url);
const LKExpr = require(path.join(RUNTIME, 'lk-expr.js'));
// UI strings shared with the runtime (used for Markdown headings and language checks).
const I18N = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(RUNTIME, 'lk-i18n.js'), 'utf8'), ctx); return ctx.window.LK_I18N; })();
export const UI_LANGUAGES = Object.keys(I18N);
const uiStrings = C => Object.assign({}, I18N.en, I18N[String(C.language || 'en').split('-')[0]] || {}, C.ui || {});

export const BUILTIN_WIDGETS = ['parameter-explorer', 'evidence-case', 'scenario', 'classify', 'timeline', 'source-compare', 'dialogue', 'cloze', 'hotspot-diagram', 'stepper'];
const SOURCE_KINDS = ['primary', 'secondary', 'official', 'research', 'reference', 'textbook', 'data', 'pedagogical'];
const REQUIRED_FUNCTIONS = ['motivate', 'explain', 'visual', 'worked', 'predict', 'practice-guided', 'practice-independent', 'check', 'transfer', 'own-words', 'sources'];
// "full" lessons carry the whole learning cycle; "focused" lessons (short review, drill, listening, reading) carry only what every lesson needs.
// Transfer is still required per outcome at course level (a transfer block in some lesson, or the capstone).
export const PROFILES = { full: REQUIRED_FUNCTIONS, focused: ['motivate', 'explain', 'check', 'sources'] };

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${f}: ${e.message}`); } };
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'course';
const hash = obj => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 12);

/* ---------------- Learning request ---------------- */
export function checkRequest(req) {
  const errors = [], unknown = [], blocking = [];
  const out = JSON.parse(JSON.stringify(req || {}));
  if (!out.topic || !String(out.topic).trim()) blocking.push('topic: what should the learner learn?');
  if (!Array.isArray(out.goals) || !out.goals.length) blocking.push('goals: at least one concrete thing the learner wants to be able to do');
  const def = (obj, key, val, label) => { if (obj[key] == null || obj[key] === '') { obj[key] = val; unknown.push(`${label || key} → default ${JSON.stringify(val)}`); } };
  def(out, 'scope', 'unknown', 'scope');
  if (!Array.isArray(out.exclusions)) out.exclusions = [];
  out.learner = out.learner || {}; def(out.learner, 'startingKnowledge', 'unknown — offer the diagnostic and a start-from-zero path', 'learner.startingKnowledge');
  def(out.learner, 'background', 'unknown', 'learner.background'); if (!Array.isArray(out.learner.knownGaps)) out.learner.knownGaps = [];
  def(out.learner, 'depth', 'solid', 'learner.depth'); if (!['intro', 'solid', 'deep'].includes(out.learner.depth)) errors.push('learner.depth must be intro | solid | deep');
  def(out, 'language', 'en', 'language'); def(out, 'locale', out.language === 'es' ? 'es-ES' : 'en-US', 'locale');
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(out.language)) errors.push('language must be a BCP 47 tag such as en, es, pt-BR');
  else if (!UI_LANGUAGES.includes(out.language.split('-')[0])) unknown.push(`language "${out.language}": built-in UI strings exist only for ${UI_LANGUAGES.join(', ')}; translate them in course.json "ui" or the interface and Markdown headings stay in English`);
  out.time = out.time || {}; def(out.time, 'totalHours', 'unknown', 'time.totalHours'); def(out.time, 'sessionMinutes', 40, 'time.sessionMinutes');
  if (typeof out.time.sessionMinutes !== 'number' || out.time.sessionMinutes < 10 || out.time.sessionMinutes > 180) errors.push('time.sessionMinutes must be a number between 10 and 180');
  if (!Array.isArray(out.constraints)) out.constraints = [];
  out.presentation = Object.assign({ visual: 'high', interaction: 'high', reducedMotion: false, readingLevel: 'unknown' }, out.presentation || {});
  out.accessibility = Object.assign({ screenReader: false, notes: '' }, out.accessibility || {});
  out.practice = Object.assign({ tools: [], equipment: [], software: [], datasets: [], realWorld: 'unknown' }, out.practice || {});
  out.output = Object.assign({ format: 'web+markdown', host: 'unknown' }, out.output || {});
  if (!['web', 'markdown', 'web+markdown'].includes(out.output.format)) errors.push('output.format must be web | markdown | web+markdown');
  out.sources = Object.assign({ provided: [], freshness: 'unknown', evidenceStandard: 'authoritative sources appropriate to the field' }, out.sources || {});
  if (out.diagnostic == null) out.diagnostic = true;
  return { ok: !errors.length && !blocking.length, errors, blocking, unknown, normalized: out };
}

/* ---------------- Course loading & validation ---------------- */
export function loadCourse(dir) {
  const course = readJson(path.join(dir, 'course.json'));
  const lessons = []; const loadErrors = [];
  for (const m of course.modules || []) for (const id of m.lessons || []) {
    const f = path.join(dir, 'lessons', id + '.json');
    if (!fs.existsSync(f)) { loadErrors.push(`lesson file missing: lessons/${id}.json`); continue; }
    try { lessons.push(readJson(f)); } catch (e) { loadErrors.push(e.message); }
  }
  const widgetDir = path.join(dir, 'widgets'); const customWidgets = {};
  if (fs.existsSync(widgetDir)) for (const f of fs.readdirSync(widgetDir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(widgetDir, f), 'utf8');
    for (const m of src.matchAll(/registerWidget\(\s*['"]([a-z0-9-]+)['"]/g)) customWidgets[m[1]] = f;
  }
  return { course, lessons, loadErrors, customWidgets };
}

const UNSAFE = [[/<script\b/i, '<script> is not allowed in content'], [/\son[a-z]+\s*=/i, 'inline event handlers (on…=) are not allowed'], [/javascript:/i, 'javascript: URLs are not allowed'], [/<(iframe|object|embed|link|meta|base|form|style|frame|frameset|applet|portal)\b/i, 'embedding/active elements are not allowed']];
// URL safety: browsers decode character references in attribute values and ignore tab/newline/control characters
// inside the scheme, so "jav&#x61;script:" or "java&Tab;script:" execute. Decode first, then allow-list the scheme.
const NAMED = { colon: ':', tab: '\t', newline: '\n', lpar: '(', rpar: ')', sol: '/', bsol: '\\', period: '.', comma: ',', semi: ';', equals: '=', quot: '"', apos: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ', num: '#', excl: '!', percnt: '%', plus: '+', lowbar: '_', hyphen: '-', dash: '-' };
export function decodeEntities(v) {
  let prev; let out = String(v);
  do { prev = out; out = out.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff))).replace(/&#([0-9]+);?/g, (_, d) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff))).replace(/&([a-z]+);?/gi, (m, n) => NAMED[n.toLowerCase()] != null ? NAMED[n.toLowerCase()] : m); } while (out !== prev);
  return out;
}
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'cite', 'data', 'srcset', 'ping', 'lowsrc', 'dynsrc', 'longdesc', 'manifest', 'codebase', 'icon']);
export function unsafeUrl(tag, attr, value) {
  const v = decodeEntities(value).replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g, '').toLowerCase();
  const urls = attr === 'srcset' ? v.split(',').map(x => x.replace(/\s+\S+$/, '')) : [v];
  for (const u of urls) {
    const m = u.match(/^([a-z][a-z0-9+.-]*):/); if (!m) continue; // relative URL or fragment
    const scheme = m[1];
    if (['http', 'https', 'mailto', 'tel'].includes(scheme)) continue;
    if (scheme === 'data' && tag === 'img' && attr === 'src' && /^data:image\/(png|jpe?g|gif|webp|avif);/.test(u)) continue;
    return `"${scheme}:" URL in <${tag} ${attr}> is not allowed (allowed: http, https, mailto, tel, relative paths, and data:image for <img src>)`;
  }
  return null;
}
function attributeIssues(where, html, errs) {
  for (const t of html.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g)) {
    const tag = t[1].toLowerCase();
    for (const a of t[2].matchAll(/([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      const name = a[1].toLowerCase(); const value = a[3] != null ? a[3] : a[4] != null ? a[4] : (a[5] || '');
      if (/^on/.test(name)) { errs.push(`${where}: event handler attribute "${name}" is not allowed`); continue; }
      if (URL_ATTRS.has(name)) { const why = unsafeUrl(tag, name, value); if (why) errs.push(`${where}: ${why}`); continue; }
      const dec = decodeEntities(value).replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
      if (/(java|vb|live)script:|data:text\/html/.test(dec)) errs.push(`${where}: executable URL inside attribute "${name}" of <${tag}> is not allowed`);
      if (name === 'style' && /expression\(|url\(|@import|behavior:/.test(dec)) errs.push(`${where}: style attribute with url()/expression()/@import is not allowed; use classes or local assets`);
      if ((tag === 'animate' || tag === 'set' || tag === 'animatetransform' || tag === 'animatemotion') && name === 'attributename' && /href/.test(dec)) errs.push(`${where}: SVG animation of href is not allowed`);
    }
  }
}
// Case-sensitive markers with Unicode-aware boundaries, so Spanish 'todo'/'método' or Portuguese words never match.
const PLACEHOLDER = /(?<![\p{L}\p{N}])(TODO|TBD|FIXME|XXX)(?![\p{L}\p{N}])/u;
const PLACEHOLDER_CI = /lorem ipsum|\[insert|\[placeholder/i;
const BALANCE = ['div', 'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'figure', 'svg', 'g', 'text', 'pre', 'code', 'details', 'section', 'blockquote', 'dl', 'span', 'strong', 'em'];
export function htmlSafetyErrors(html) { const e = [], w = []; htmlIssues('html', html, e, w, null); return e; }
function htmlIssues(where, html, errs, warns, terms) {
  if (html == null || typeof html !== 'string') return;
  for (const [re, msg] of UNSAFE) if (re.test(html)) errs.push(`${where}: ${msg}`);
  attributeIssues(where, html, errs);
  if (PLACEHOLDER.test(html) || PLACEHOLDER_CI.test(html)) errs.push(`${where}: contains placeholder text`);
  for (const tag of BALANCE) {
    const open = (html.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')) || []).length; const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) errs.push(`${where}: <${tag}> unbalanced (${open} open, ${close} close)`);
  }
  if (/<svg\b/i.test(html) && !/<title[\s>]|aria-label=/i.test(html)) warns.push(`${where}: SVG without <title> or aria-label`);
  if (/<img[^>]+src=["']https?:/i.test(html)) warns.push(`${where}: remote image (needs network; prefer a local asset)`);
  for (const m of html.matchAll(/data-term="([^"]+)"/g)) if (terms && !terms.has(m[1].toLowerCase())) errs.push(`${where}: glossary term "${m[1]}" is not defined`);
}
const allStrings = v => v == null ? [] : typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(allStrings) : typeof v === 'object' ? Object.values(v).flatMap(allStrings) : [];

function checkQuestion(where, q, outcomes, errs, warns, terms, requireAssess) {
  if (!q.id) errs.push(`${where}: question without id`);
  if (!q.prompt) errs.push(`${where}: question without prompt`);
  const kind = q.kind || (q.options ? 'mcq' : 'open');
  if (kind === 'mcq' || kind === 'multi') {
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push(`${where}: needs at least 2 options`);
    if (kind === 'mcq' && !(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < (q.options || []).length)) errs.push(`${where}: "correct" must be the index of an option`);
    if (kind === 'multi' && !(Array.isArray(q.correct) && q.correct.length && q.correct.every(i => i >= 0 && i < q.options.length))) errs.push(`${where}: multi "correct" must be an array of option indexes`);
    if (!q.explanation) errs.push(`${where}: needs an explanation of the reasoning`);
    if (kind === 'mcq') { const wrong = (q.options || []).map((_, i) => i).filter(i => i !== q.correct); const missing = wrong.filter(i => !(q.feedback && q.feedback[i])); if (missing.length) warns.push(`${where}: no misconception feedback for option(s) ${missing.join(', ')}`); }
  } else if (kind === 'numeric') {
    if (typeof q.answer !== 'number') errs.push(`${where}: numeric question needs a numeric "answer"`);
    if (!q.feedbackWrong) warns.push(`${where}: numeric question without "feedbackWrong" (what a wrong value usually means)`);
    if (!q.explanation) errs.push(`${where}: needs an explanation`);
  } else if (kind === 'open') {
    if (!q.model && !(q.rubric && q.rubric.length)) errs.push(`${where}: open question needs a model answer or rubric`);
  } else errs.push(`${where}: unknown question kind "${kind}"`);
  for (const o of q.assesses || []) if (!outcomes.has(o)) errs.push(`${where}: assesses unknown outcome "${o}"`);
  if (requireAssess && !(q.assesses || []).length) warns.push(`${where}: does not declare which outcome it assesses`);
  allStrings([q.prompt, q.options, q.explanation, q.feedback, q.model, q.rubric]).forEach(s => htmlIssues(where, s, errs, warns, terms));
  return kind;
}

function checkWidget(where, b, errs, warns, custom) {
  const w = b.widget; const c = b.config || {};
  if (!BUILTIN_WIDGETS.includes(w) && !custom[w]) { errs.push(`${where}: unknown widget "${w}" (built-in: ${BUILTIN_WIDGETS.join(', ')}; or add widgets/*.js)`); return; }
  if (!b.instructions) warns.push(`${where}: activity without instructions telling the learner what to think about`);
  if (!b.debrief) warns.push(`${where}: activity without a debrief explaining what the learner should have noticed`);
  if (custom[w]) { if (!(c.assumptions || []).length) warns.push(`${where}: custom widget config should list assumptions`); return; }
  const need = (cond, msg) => { if (!cond) errs.push(`${where} (${w}): ${msg}`); };
  switch (w) {
    case 'parameter-explorer': {
      need(Array.isArray(c.inputs) && c.inputs.length, 'needs inputs'); need(Array.isArray(c.outputs) && c.outputs.length, 'needs outputs');
      need((c.assumptions || []).length, 'needs assumptions (state what the model simplifies)');
      const vars = new Set((c.inputs || []).map(i => i.id)); (c.inputs || []).forEach(i => need(['id', 'label', 'min', 'max', 'value'].every(k => i[k] != null) && i.min < i.max && i.value >= i.min && i.value <= i.max, `input ${i.id}: needs id,label,min<max,value within range`));
      const exprCheck = (e, extra = []) => { try { LKExpr.parse(e); const unknown = LKExpr.variables(e).filter(v => !vars.has(v) && !extra.includes(v)); if (unknown.length) errs.push(`${where}: expression "${e}" uses unknown variable(s) ${unknown.join(', ')}`); } catch (x) { errs.push(`${where}: invalid expression "${e}": ${x.message}`); } };
      (c.outputs || []).forEach(o => exprCheck(o.expr)); (c.interpret || []).forEach(r => exprCheck(r.when));
      if (c.chart) { const xv = (c.chart.x && c.chart.x.var) || 'x'; need(c.chart.x && c.chart.x.from < c.chart.x.to, 'chart.x needs from < to'); (c.chart.series || []).forEach(s => exprCheck(s.expr, [xv])); (c.chart.markers || []).forEach(m => exprCheck(m.x)); }
      if (c.chart && (c.inputs || []).length) {
        const vals = Object.fromEntries(c.inputs.map(i => [i.id, i.value]));
        try { (c.outputs || []).forEach(o => { const v = LKExpr.evaluate(o.expr, vals); if (!isFinite(v)) warns.push(`${where}: output "${o.label}" is not finite at default inputs`); }); } catch (x) { /* reported above */ }
      }
      break;
    }
    case 'evidence-case': need((c.evidence || []).length >= 2, 'needs at least 2 evidence items'); need((c.conclusions || []).length >= 2, 'needs at least 2 conclusions'); need((c.conclusions || []).some(x => x.verdict === 'best' || x.verdict === 'defensible'), 'needs at least one best or defensible conclusion'); (c.conclusions || []).forEach(x => need(x.explanation, `conclusion ${x.id} needs an explanation`)); break;
    case 'scenario': {
      need(c.nodes && c.nodes[c.start], 'needs nodes and a valid start');
      const seen = new Set(); const walk = id => { if (seen.has(id) || !c.nodes || !c.nodes[id]) return; seen.add(id); const n = c.nodes[id]; if (!n.end) { need((n.choices || []).length >= 2, `node ${id} needs ≥2 choices or end:true`); (n.choices || []).forEach(ch => { need(c.nodes[ch.next], `node ${id}: choice "${ch.label}" points to missing node "${ch.next}"`); need(ch.feedback, `node ${id}: choice "${ch.label}" needs feedback`); walk(ch.next); }); } else need(n.debrief, `end node ${id} needs a debrief`); };
      walk(c.start); Object.keys(c.nodes || {}).filter(k => !seen.has(k)).forEach(k => warns.push(`${where}: node "${k}" is unreachable`)); break;
    }
    case 'classify': { const cats = new Set((c.categories || []).map(x => x.id)); need(cats.size >= 2, 'needs ≥2 categories'); need((c.items || []).length >= 3, 'needs ≥3 items'); (c.items || []).forEach(it => { need(cats.has(it.category), `item ${it.id}: unknown category`); need(it.feedback, `item ${it.id}: needs feedback`); }); break; }
    case 'timeline': need((c.events || []).length >= 3, 'needs ≥3 events'); (c.events || []).forEach(e => need(e.id && e.date && typeof e.sortKey === 'number' && e.title, `event ${e.id}: needs id, date, numeric sortKey, title`)); if (c.orderingChallenge) (c.orderingChallenge.eventIds || []).forEach(id => need((c.events || []).some(e => e.id === id), `ordering challenge references missing event ${id}`)); break;
    case 'source-compare': need((c.sources || []).length >= 2, 'needs ≥2 sources'); (c.sources || []).forEach(s => need(s.title && s.excerpt, `source ${s.id}: needs title and excerpt`)); (c.questions || []).forEach(q => need(q.model || q.rubric, `question ${q.id}: needs model or rubric`)); break;
    case 'dialogue': need((c.lines || []).length >= 2, 'needs ≥2 lines'); need(c.targetLang, 'needs targetLang (BCP 47) for pronunciation and lang attributes'); (c.comprehension || []).forEach((q, i) => need(Array.isArray(q.options) && Number.isInteger(q.correct), `comprehension ${i}: needs options and correct`)); (c.production || []).forEach((p, i) => need((p.accept || []).length, `production ${i}: needs accepted answers`)); break;
    case 'cloze': need(/\[\[[^\]]+\]\]/.test(c.text || ''), 'text needs at least one [[answer]] blank'); break;
    case 'hotspot-diagram': need(/<svg\b/.test(c.svg || ''), 'needs an svg'); need(c.alt, 'needs alt text'); (c.hotspots || []).forEach(h => { need(h.html, `hotspot ${h.id}: needs an explanation`); if (h.target) need(new RegExp(`id=["']${h.target}["']`).test(c.svg || ''), `hotspot ${h.id}: target #${h.target} not found in svg`); }); (c.quiz || []).forEach(q => need((c.hotspots || []).some(h => h.id === q.answer), `quiz "${q.ask}": answer is not a hotspot id`)); break;
    case 'stepper': need((c.steps || []).length >= 2, 'needs ≥2 steps'); (c.steps || []).forEach((s, i) => { need(s.html, `step ${i}: needs html`); if (s.predict) need(Number.isInteger(s.predict.correct) && s.predict.explanation, `step ${i}: predict needs correct and explanation`); }); break;
  }
}

export function validateCourse(dir) {
  const errs = [], warns = [];
  let data; try { data = loadCourse(dir); } catch (e) { return { errs: [e.message], warns, data: null }; }
  const { course: C, lessons, loadErrors, customWidgets } = data; errs.push(...loadErrors);
  const req = (cond, msg) => { if (!cond) errs.push(msg); };
  req(C.format === 1, 'course.json: "format" must be 1');
  req(/^[a-z0-9][a-z0-9-]{1,63}$/.test(C.id || ''), 'course.json: "id" must be a lowercase slug');
  req(C.title, 'course.json: needs a title'); req(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(C.language || ''), 'course.json: "language" must be a BCP 47 tag');
  const outcomes = new Map((C.outcomes || []).map(o => [o.id, o])); req(outcomes.size, 'course.json: needs outcomes');
  req(outcomes.size === (C.outcomes || []).length, 'course.json: duplicate outcome ids');
  (C.outcomes || []).forEach(o => { req(o.id && o.text, 'outcome needs id and text'); if (o.text && !/^\s*\S+/.test(o.text)) errs.push(`outcome ${o.id}: empty`); });
  req((C.modules || []).length, 'course.json: needs at least one module');
  const terms = new Set(); (C.glossary || []).forEach(g => { req(g.term && g.definition, 'glossary entry needs term and definition'); [g.term, ...(g.aka || [])].filter(Boolean).forEach(k => { const key = k.toLowerCase(); if (terms.has(key)) warns.push(`glossary: duplicate term or alias "${k}"`); terms.add(key); }); });
  const byId = new Map(); lessons.forEach(l => { if (byId.has(l.id)) errs.push(`duplicate lesson id ${l.id}`); byId.set(l.id, l); });
  const orderIds = (C.modules || []).flatMap(m => m.lessons || []);
  const seenInModules = new Set(); orderIds.forEach(id => { if (seenInModules.has(id)) errs.push(`lesson ${id} appears in more than one module`); seenInModules.add(id); });
  (C.modules || []).forEach(m => { req(m.id && m.title, 'module needs id and title'); (m.prerequisites || []).forEach(p => req((C.modules || []).some(x => x.id === p), `module ${m.id}: unknown prerequisite module ${p}`)); });
  (C.routes || []).forEach(r => (r.lessons || []).forEach(id => req(byId.has(id), `route ${r.id}: unknown lesson ${id}`)));
  if (!(C.routes || []).length) warns.push('course.json: no routes; add at least a core route (an advanced route is optional)');
  const base = String(C.language || 'en').split('-')[0];
  if (!UI_LANGUAGES.includes(base)) { const need = Object.keys(I18N.en).filter(k => typeof I18N.en[k] === 'string'); const have = need.filter(k => C.ui && typeof C.ui[k] === 'string'); if (have.length < need.length) warns.push(`course.json: language "${C.language}" has no built-in UI strings; ${need.length - have.length} of ${need.length} keys in "ui" are missing, so they fall back to English (see assets/runtime/lk-i18n.js)`); }
  if (C.sources) C.sources.forEach((s, i) => checkSource(`course.sources[${i}]`, s, errs, warns));
  allStrings([C.intro]).forEach(s => htmlIssues('course.intro', s, errs, warns, terms));
  const transferred = new Set(); const blockIds = new Set(); const assessed = new Map([...outcomes.keys()].map(k => [k, []])); const taught = new Map([...outcomes.keys()].map(k => [k, []]));
  const contract = {};
  for (const l of lessons) {
    const w = `lesson ${l.id}`;
    req(l.format === 1, `${w}: "format" must be 1`); req(l.title, `${w}: needs a title`); req(l.minutes > 0, `${w}: needs minutes > 0`);
    req(['core', 'advanced'].includes(l.level || 'core'), `${w}: level must be core or advanced`);
    req((l.outcomes || []).length, `${w}: must list the outcomes it teaches`);
    (l.outcomes || []).forEach(o => { if (!outcomes.has(o)) errs.push(`${w}: unknown outcome ${o}`); else taught.get(o).push(l.id); });
    (l.prerequisites || []).forEach(p => { if (!byId.has(p)) errs.push(`${w}: unknown prerequisite lesson ${p}`); else if (orderIds.indexOf(p) > orderIds.indexOf(l.id)) errs.push(`${w}: prerequisite ${p} comes later in the course order`); });
    const has = new Set(); const ex = l.exemptions || {}; const profile = l.profile || 'full'; let nQuestions = 0;
    if (!PROFILES[profile]) errs.push(`${w}: profile must be ${Object.keys(PROFILES).join(' or ')}`);
    for (const [k, why] of Object.entries(ex)) { if (!REQUIRED_FUNCTIONS.includes(k)) errs.push(`${w}: unknown exemption "${k}"`); if (!why || String(why).length < 20) errs.push(`${w}: exemption "${k}" needs a real justification (≥ 20 characters)`); }
    (l.blocks || []).forEach((b, i) => {
      const bw = `${w} block ${i} (${b.type})`;
      const needsId = ['predict', 'activity', 'practice', 'transfer', 'reflect'].includes(b.type);
      if (needsId) { if (!b.id) errs.push(`${bw}: needs an id`); else if (blockIds.has(b.id)) errs.push(`${bw}: duplicate id ${b.id}`); else blockIds.add(b.id); }
      switch (b.type) {
        case 'motivate': req(b.html, `${bw}: needs html`); has.add('motivate'); break;
        case 'intuition': req(b.html, `${bw}: needs html`); if (!b.limits) warns.push(`${bw}: no "limits" — where does this model break down?`); break;
        case 'visual': req(b.html, `${bw}: needs html`); req(b.alt && b.alt.length >= 40, `${bw}: needs "alt", a text equivalent of at least 40 characters`); if (!b.purpose) warns.push(`${bw}: state the "purpose" of the visual`); has.add('visual'); break;
        case 'explain': req(b.html, `${bw}: needs html`); has.add('explain'); break;
        case 'worked': req((b.steps || []).length >= 2, `${bw}: a worked example needs at least 2 steps`); has.add('worked'); break;
        case 'predict': checkQuestion(bw, Object.assign({}, b, { prompt: b.prompt }), outcomes, errs, warns, terms, false); has.add('predict'); break;
        case 'activity': checkWidget(bw, b, errs, warns, customWidgets); has.add('predict-activity'); (b.assesses || []).forEach(o => outcomes.has(o) && assessed.get(o).push(`${l.id}:${b.id}`)); break;
        case 'practice': req(b.task, `${bw}: needs a task`); req(b.solution || b.model || (b.rubric || []).length, `${bw}: needs a solution, model or rubric`); req(['guided', 'independent'].includes(b.level), `${bw}: level must be guided or independent`); has.add('practice-' + b.level); if (b.setting && !['in-app', 'offline', 'real-world'].includes(b.setting)) errs.push(`${bw}: setting must be in-app | offline | real-world`); if (b.setting === 'real-world' && !b.externalFeedback) warns.push(`${bw}: real-world practice should say how to get external feedback`); break;
        case 'check': {
          req((b.questions || []).length >= 1, `${bw}: needs at least 1 question`); nQuestions += (b.questions || []).length;
          (b.questions || []).forEach((q, k) => {
            if (q.id) { if (blockIds.has(q.id)) errs.push(`${bw}: duplicate question id ${q.id}`); blockIds.add(q.id); }
            const kind = checkQuestion(`${bw} q${k}`, q, outcomes, errs, warns, terms, true);
            if (kind === 'open') has.add('own-words-candidate');
            (q.assesses || []).forEach(o => outcomes.has(o) && assessed.get(o).push(`${l.id}:${q.id}`));
          });
          has.add('check'); break;
        }
        case 'transfer': req(b.task, `${bw}: needs a task`); req(b.model || (b.rubric || []).length, `${bw}: needs a model answer or rubric`); req((b.assesses || []).length, `${bw}: must declare the outcomes it assesses`); (b.assesses || []).forEach(o => { if (!outcomes.has(o)) errs.push(`${bw}: unknown outcome ${o}`); else { assessed.get(o).push(`${l.id}:${b.id}`); transferred.add(o); } }); has.add('transfer'); break;
        case 'reflect': req(b.prompt, `${bw}: needs a prompt`); has.add('own-words'); break;
        case 'prose': case 'callout': req(b.html, `${bw}: needs html`); break;
        default: errs.push(`${bw}: unknown block type "${b.type}"`);
      }
      allStrings(b).forEach(s => htmlIssues(bw, s, errs, warns, terms));
    });
    if (has.has('predict-activity')) has.add('predict');
    if (has.has('own-words-candidate')) has.add('own-words');
    if ((l.sources || []).length) has.add('sources');
    (l.sources || []).forEach((s, i) => checkSource(`${w} sources[${i}]`, s, errs, warns));
    req(l.next, `${w}: needs "next", connecting to what comes after`);
    const sm = C.learner && C.learner.time && typeof C.learner.time.sessionMinutes === 'number' ? C.learner.time.sessionMinutes : null;
    if (sm && l.minutes > sm * 1.5) warns.push(`${w}: ${l.minutes} min is much longer than the learner's ${sm}-minute sessions; split the lesson or mark natural break points`);
    if (has.has('check')) { const min = profile === 'full' ? 2 : 1; if (nQuestions < min) errs.push(`${w}: a ${profile} lesson needs at least ${min} check question(s) in total`); }
    contract[l.id] = { _profile: profile };
    const required = PROFILES[profile] || REQUIRED_FUNCTIONS;
    for (const f of REQUIRED_FUNCTIONS) {
      if (has.has(f)) contract[l.id][f] = 'yes'; else if (ex[f]) contract[l.id][f] = 'exempt'; else if (!required.includes(f)) contract[l.id][f] = 'optional';
      else { contract[l.id][f] = 'missing'; errs.push(`${w}: missing ${f}${f === 'own-words' ? ' (a reflect block or an open check question)' : ''}${profile === 'full' ? ' (or use "profile": "focused" if this is a short review, drill or reading lesson, or an exemption with a reason)' : ''}`); }
    }
  }
  for (const [o, ls] of taught) if (!ls.length) errs.push(`outcome ${o} is not taught by any lesson`);
  if (C.capstone) {
    const cp = C.capstone; req(cp.id && cp.title && cp.task, 'capstone needs id, title and task'); req((cp.rubric || []).length, 'capstone needs a rubric');
    (cp.rubric || []).forEach(r => req(r.criterion && (r.descriptors || []).length === (cp.levels || []).length, `capstone rubric "${r.criterion}": one descriptor per level`));
    (cp.assesses || []).forEach(o => { if (!outcomes.has(o)) errs.push(`capstone: unknown outcome ${o}`); else { assessed.get(o).push('capstone'); transferred.add(o); } });
    if (cp.id) blockIds.add(cp.id);
    allStrings(cp).forEach(s => htmlIssues('capstone', s, errs, warns, terms));
  }
  for (const o of outcomes.keys()) if (!transferred.has(o) && taught.get(o).length) warns.push(`outcome ${o} has no transfer task (a transfer block or the capstone); recall and practice alone do not show transfer to a new situation`);
  for (const [o, a] of assessed) if (!a.length) errs.push(`outcome ${o} is never assessed (add assesses:["${o}"] to a check question, transfer task or the capstone)`);
  if (C.diagnostic) (C.diagnostic.questions || []).forEach((q, i) => { checkQuestion(`diagnostic q${i}`, q, outcomes, errs, warns, terms, false); (q.lessons || []).forEach(id => req(byId.has(id), `diagnostic q${i}: unknown lesson ${id}`)); });
  return { errs, warns, data, contract, assessed, taught };
}
function checkSource(where, s, errs, warns) {
  if (!s.title) errs.push(`${where}: source needs a title`);
  if (!SOURCE_KINDS.includes(s.kind)) errs.push(`${where}: kind must be one of ${SOURCE_KINDS.join(', ')}`);
  if (s.url && !/^https?:\/\//.test(s.url)) errs.push(`${where}: url must be http(s)`);
  if (s.url && !s.accessed && s.kind !== 'pedagogical') warns.push(`${where}: web source without "accessed" date`);
  if (s.status && !['verified', 'unverified'].includes(s.status)) errs.push(`${where}: status must be verified or unverified`);
  if (s.status === 'unverified') warns.push(`${where}: unverified source "${s.title}" — claims relying on it must be labelled in the text`);
}

/* ---------------- Build ---------------- */
function itemHashes(C, lessons) {
  const H = {};
  const qh = q => hash({ p: q.prompt, o: q.options, c: q.correct, a: q.answer, t: q.tolerance, k: q.kind });
  lessons.forEach(l => (l.blocks || []).forEach(b => {
    if (b.type === 'predict') H[b.id] = qh(b);
    if (b.type === 'check') b.questions.forEach(q => { H[q.id] = qh(q); });
    if (b.type === 'activity') H[b.id] = hash({ w: b.widget, c: b.config });
    if (['practice', 'transfer', 'reflect'].includes(b.type)) H[b.id] = hash({ t: b.task || b.prompt, r: b.rubric });
  }));
  (C.diagnostic && C.diagnostic.questions || []).forEach(q => { H[q.id] = qh(q); });
  if (C.capstone) H[C.capstone.id] = hash({ t: C.capstone.task, r: C.capstone.rubric });
  return H;
}
function copyDir(src, dst) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f); if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d); } }

// A directory the builder may delete and rewrite: absent, empty, or marked as a previous build.
const BUILD_MARK = '.lk-build';
const real = p => { let cur = path.resolve(p); const rest = []; while (!fs.existsSync(cur)) { rest.unshift(path.basename(cur)); const up = path.dirname(cur); if (up === cur) break; cur = up; } return path.join(fs.realpathSync(cur), ...rest); };
const inside = (child, parent) => child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
export function checkOutputDir(courseDir, outDir, kind) {
  const src = real(courseDir); const out = real(outDir); const home = real(os.homedir());
  if (out === path.parse(out).root || out === home) return `refusing to use ${out} as ${kind} output: it is the filesystem root or your home directory`;
  if (inside(src, out)) return `refusing to use ${out} as ${kind} output: it is the course directory or one of its parents, and would be deleted`;
  if (!fs.existsSync(out)) return null;
  if (!fs.statSync(out).isDirectory()) return `refusing to use ${out} as ${kind} output: it is a file`;
  const entries = fs.readdirSync(out); if (!entries.length || entries.includes(BUILD_MARK)) return null;
  // Builds made before the marker existed: accept only if they look exactly like generated output.
  if (kind === 'site' && entries.includes('content.js') && fs.readFileSync(path.join(out, 'content.js'), 'utf8').startsWith('/* Generated by interactive-course-builder')) return null;
  if (kind === 'markdown' && entries.every(f => f.endsWith('.md')) && entries.includes('README.md') && /interactive-course-builder/.test(fs.readFileSync(path.join(out, 'README.md'), 'utf8'))) return null;
  return `refusing to delete ${out}: it is not empty and was not created by a previous build (no ${BUILD_MARK} marker). Choose an empty or new directory.`;
}
function resetDir(d) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, BUILD_MARK), 'Generated by interactive-course-builder; this directory is deleted and rewritten on every build.\n'); }

export function build(dir, outDir) {
  const v = validateCourse(dir);
  if (v.errs.length) return v;
  const { course: C, lessons, customWidgets } = v.data;
  const out = path.resolve(outDir || path.join(dir, 'site'));
  const md = path.join(path.resolve(dir), 'markdown');
  for (const [d, kind] of [[out, 'site'], [md, 'markdown']]) { const why = checkOutputDir(dir, d, kind); if (why) { v.errs.push(why); return v; } }
  if (inside(real(md), real(out)) || inside(real(out), real(md))) { v.errs.push('refusing to build: the site and markdown outputs overlap'); return v; }
  resetDir(out);
  copyDir(RUNTIME, path.join(out, 'runtime')); fs.rmSync(path.join(out, 'runtime', 'index.html'));
  const byId = new Map(lessons.map(l => [l.id, l]));
  const ordered = C.modules.flatMap(m => m.lessons).map(id => byId.get(id));
  const bundle = { format: 1, kit: KIT_VERSION, builtAt: new Date().toISOString(), course: C, lessons: ordered, hashes: itemHashes(C, lessons) };
  fs.writeFileSync(path.join(out, 'content.js'), '/* Generated by interactive-course-builder. Edit the course source, not this file. */\nwindow.LK_DATA = ' + JSON.stringify(bundle).replace(/<\/script/gi, '<\\/script') + ';\n');
  let custom = '';
  if (Object.keys(customWidgets).length) { copyDir(path.join(dir, 'widgets'), path.join(out, 'widgets')); custom = [...new Set(Object.values(customWidgets))].map(f => `<script src="widgets/${f}"></script>`).join('\n'); }
  if (fs.existsSync(path.join(dir, 'assets'))) copyDir(path.join(dir, 'assets'), path.join(out, 'assets'));
  const tpl = fs.readFileSync(path.join(RUNTIME, 'index.html'), 'utf8');
  const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  fs.writeFileSync(path.join(out, 'index.html'), tpl.replace(/{{TITLE}}/g, escH(C.title)).replace(/{{LANG}}/g, escH(C.language)).replace('{{KIT_VERSION}}', KIT_VERSION).replace('{{CUSTOM_WIDGETS}}', custom));
  exportMarkdown(C, ordered, md);
  fs.writeFileSync(path.join(dir, 'COVERAGE.md'), coverageMarkdown(v));
  return Object.assign(v, { out, md });
}

/* ---------------- Markdown export ---------------- */
function toMd(html) {
  if (!html) return '';
  const keep = []; const stash = x => { keep.push(x); return `\n\n@@K${keep.length - 1}@@\n\n`; };
  let s = String(html).replace(/<figure[\s\S]*?<\/figure>/g, stash).replace(/<table[\s\S]*?<\/table>/g, stash).replace(/<svg[\s\S]*?<\/svg>/g, stash);
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_, c) => stash('```\n' + c.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '\n```'));
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n\n### $1\n\n').replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, '\n\n#### $1\n\n').replace(/<li>/g, '\n- ').replace(/<\/li>/g, '').replace(/<\/?(ul|ol|dl)[^>]*>/g, '\n')
    .replace(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g, '\n- **$1**: $2').replace(/<p[^>]*>/g, '\n\n').replace(/<\/p>/g, '\n\n').replace(/<br\s*\/?>/g, '  \n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**').replace(/<(em|i)>([\s\S]*?)<\/\1>/g, '*$2*').replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)').replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_, b) => '\n\n> ' + b.replace(/<[^>]+>/g, '').trim() + '\n\n').replace(/<\/?[a-z][^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return s.replace(/@@K(\d+)@@/g, (_, i) => keep[+i]).replace(/\n{3,}/g, '\n\n').trim();
}
let MT = I18N.en; // UI strings for the course being exported (set in exportMarkdown)
function qMd(q) {
  let t = `**${toMd(q.prompt).replace(/\n+/g, ' ')}**\n\n`;
  if (q.options) { t += q.options.map((o, j) => `- ${String.fromCharCode(97 + j)}) ${toMd(o)}`).join('\n'); const c = Array.isArray(q.correct) ? q.correct.map(i => String.fromCharCode(97 + i)).join(', ') : String.fromCharCode(97 + q.correct); t += `\n\n<details><summary>${MT.md_answer}</summary>\n\n**${c}** — ${toMd(q.explanation)}${q.feedback ? '\n\n' + Object.entries(q.feedback).map(([k, v]) => `- ${String.fromCharCode(97 + +k)}): ${toMd(v)}`).join('\n') : ''}\n\n</details>`; }
  else if (q.kind === 'numeric') t += `<details><summary>${MT.md_answer}</summary>\n\n${q.answer}${q.unit ? ' ' + q.unit : ''} (± ${q.tolerance || 0}) — ${toMd(q.explanation)}\n\n</details>`;
  else t += `${(q.rubric || []).map(r => '- [ ] ' + toMd(r)).join('\n')}\n\n<details><summary>${MT.showModel}</summary>\n\n${toMd(q.model)}\n\n</details>`;
  return t;
}
function exportMarkdown(C, lessons, dir) {
  resetDir(dir);
  const T = MT = uiStrings(C);
  const index = [`# ${C.title}\n\n${C.subtitle || ''}\n\n${T.md_generated} (interactive-course-builder ${KIT_VERSION}, ${C.language}). ${T.interactiveOnly} (\`site/index.html\`)\n\n## ${T.outcomes}\n\n${C.outcomes.map(o => `- (${o.id}) ${o.text}`).join('\n')}\n\n## ${T.md_lessons}\n`];
  lessons.forEach((l, i) => {
    const f = `${String(i + 1).padStart(2, '0')}-${l.id}.md`; index.push(`- [${l.title}](${f})`);
    let o = `# ${l.title}\n\n${l.summary || ''}\n\n- ${T.outcomes}: ${(l.outcomes || []).join(', ')} · ≈ ${l.minutes} ${T.minutes} · ${T[l.level === 'advanced' ? 'advanced' : 'core']}\n- ${T.prerequisites}: ${(l.prerequisites || []).join(', ') || '—'}\n\n`;
    for (const b of l.blocks) {
      switch (b.type) {
        case 'motivate': o += `## ${T.b_motivate}\n\n${toMd(b.html)}\n\n`; break;
        case 'intuition': o += `## ${T.b_intuition}\n\n${toMd(b.html)}\n\n${b.limits ? `> **${T.b_limits}:** ` + toMd(b.limits).replace(/\n/g, '\n> ') + '\n\n' : ''}`; break;
        case 'visual': o += `## ${T.b_visual}\n\n${b.html}\n\n**${T.textEquivalent}:** ${b.alt}\n\n`; break;
        case 'explain': o += `## ${b.title || T.b_explain}\n\n${toMd(b.html)}\n\n`; break;
        case 'prose': o += toMd(b.html) + '\n\n'; break;
        case 'callout': o += '> ' + toMd(b.html).replace(/\n/g, '\n> ') + '\n\n'; break;
        case 'worked': o += `## ${T.b_worked}${b.title ? ': ' + b.title : ''}\n\n${toMd(b.html || '')}\n\n${b.steps.map((s, k) => `${k + 1}. ${s.prompt ? toMd(s.prompt) + ' ' : ''}${toMd(s.html)}`).join('\n')}\n\n${toMd(b.result || '')}\n\n`; break;
        case 'predict': o += `## ${T.b_predict}\n\n${qMd(b)}\n\n`; break;
        case 'activity': o += `## ${T.b_activity} (${b.widget})\n\n${toMd(b.instructions || '')}\n\n> ${T.interactiveOnly}\n\n${b.debrief ? `<details><summary>${T.debrief}</summary>\n\n${toMd(b.debrief)}\n\n</details>\n\n` : ''}`; break;
        case 'practice': o += `## ${b.level === 'independent' ? T.b_practice_independent : T.b_practice_guided}\n\n${toMd(b.task)}\n\n${(b.hints || []).map((h, k) => `<details><summary>${T.hint} ${k + 1}</summary>\n\n${toMd(h)}\n\n</details>`).join('\n\n')}\n\n${(b.rubric || []).map(r => '- [ ] ' + toMd(r)).join('\n')}\n\n<details><summary>${T.showSolution}</summary>\n\n${toMd(b.solution || b.model || '')}\n\n</details>\n\n`; break;
        case 'check': o += `## ${T.b_check}\n\n${b.questions.map(qMd).join('\n\n')}\n\n`; break;
        case 'transfer': o += `## ${T.b_transfer}\n\n${toMd(b.task)}\n\n${(b.rubric || []).map(r => '- [ ] ' + toMd(r)).join('\n')}\n\n<details><summary>${T.showModel}</summary>\n\n${toMd(b.model || '')}\n\n</details>\n\n`; break;
        case 'reflect': o += `## ${T.b_reflect}\n\n${toMd(b.prompt)}\n\n`; break;
      }
    }
    o += `## ${T.b_sources}\n\n${(l.sources || []).map(s => `- [${(T.sourceKinds || {})[s.kind] || s.kind}] ${s.url ? `[${s.title}](${s.url})` : s.title}${s.author ? ' — ' + s.author : ''}${s.date ? ' (' + s.date + ')' : ''}${s.accessed ? ' · ' + s.accessed : ''}${s.status === 'unverified' ? ' · ' + T.unverified : ''}${s.note ? ' — ' + s.note : ''}`).join('\n')}\n\n## ${T.whatNext}\n\n${toMd(l.next)}\n`;
    fs.writeFileSync(path.join(dir, f), o.replace(/\n{3,}/g, '\n\n'));
  });
  if (C.capstone) { const cp = C.capstone; fs.writeFileSync(path.join(dir, 'capstone.md'), `# ${cp.title}\n\n${toMd(cp.task)}\n\n| ${T.md_criterion} | ${(cp.levels || []).join(' | ')} |\n|---|${(cp.levels || []).map(() => '---').join('|')}|\n${cp.rubric.map(r => `| ${r.criterion} | ${r.descriptors.join(' | ')} |`).join('\n')}\n\n${cp.evaluation ? toMd(cp.evaluation) : ''}\n`); index.push(`- [${T.capstone}](capstone.md)`); }
  if ((C.glossary || []).length) { fs.writeFileSync(path.join(dir, 'glossary.md'), `# ${T.glossary}\n\n` + [...C.glossary].sort((a, b) => a.term.localeCompare(b.term, C.language)).map(g => `- **${g.term}**: ${g.definition}`).join('\n') + '\n'); index.push(`- [${T.glossary}](glossary.md)`); }
  fs.writeFileSync(path.join(dir, 'README.md'), index.join('\n') + '\n');
}

/* ---------------- Coverage ---------------- */
export function coverageMarkdown(v) {
  const { course: C, lessons } = v.data; const byId = new Map(lessons.map(l => [l.id, l]));
  let md = `# Coverage — ${C.title}\n\nGenerated ${new Date().toISOString().slice(0, 10)} by interactive-course-builder ${KIT_VERSION}. Mechanical checks only: they show that each function and outcome is present, not that the teaching is effective.\n\n## Outcomes → teaching → assessment\n\n| Outcome | Taught in | Assessed by |\n|---|---|---|\n`;
  for (const o of C.outcomes) md += `| ${o.id}: ${o.text} | ${(v.taught.get(o.id) || []).join(', ') || '**none**'} | ${(v.assessed.get(o.id) || []).join(', ') || '**none**'} |\n`;
  md += `\n## Lesson contract\n\n✓ present · ✗ missing (required) · exempt = justified exemption · — not required for this profile\n\n| Lesson | profile | ${REQUIRED_FUNCTIONS.join(' | ')} | activities |\n|---|---|${REQUIRED_FUNCTIONS.map(() => '---').join('|')}|---|\n`;
  for (const id of C.modules.flatMap(m => m.lessons)) { const l = byId.get(id); if (!l) continue; const c = v.contract[id] || {}; md += `| ${l.title} | ${c._profile || 'full'} | ${REQUIRED_FUNCTIONS.map(f => ({ yes: '✓', exempt: 'exempt', missing: '✗', optional: '—' }[c[f]] || '?')).join(' | ')} | ${(l.blocks || []).filter(b => b.type === 'activity').map(b => b.widget).join(', ') || '—'} |\n`; }
  const ex = lessons.flatMap(l => Object.entries(l.exemptions || {}).map(([k, w]) => `- ${l.id} / ${k}: ${w}`));
  if (ex.length) md += `\n## Justified exemptions\n\n${ex.join('\n')}\n`;
  const unv = [...(C.sources || []).map(s => ['course', s]), ...lessons.flatMap(l => (l.sources || []).map(s => [l.id, s]))].filter(([, s]) => s.status === 'unverified');
  if (unv.length) md += `\n## Unverified sources (${unv.length})\n\n${unv.map(([w, s]) => `- ${w}: ${s.title}${s.note ? ' — ' + s.note : ''}`).join('\n')}\n`;
  if (v.warns.length) md += `\n## Warnings (${v.warns.length})\n\n${v.warns.map(w => '- ' + w).join('\n')}\n`;
  return md;
}

/* ---------------- Init ---------------- */
export function initCourse(reqFile, dir) {
  const r = checkRequest(readJson(reqFile));
  if (r.errors.length || r.blocking.length) throw new Error('Request not ready; nothing was created:\n- ' + [...r.blocking.map(b => 'blocking: ' + b), ...r.errors].join('\n- '));
  if (fs.existsSync(path.join(dir, 'course.json'))) throw new Error(`${dir}/course.json already exists; refusing to overwrite`);
  const n = r.normalized; fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  const course = {
    format: 1, id: slug(n.id || n.topic), version: '0.1.0', title: n.title || n.topic, subtitle: n.scope !== 'unknown' ? n.scope : '', language: n.language, locale: n.locale,
    learner: n, assumptions: r.unknown.map(u => 'Unknown: ' + u), outcomes: [], modules: [], glossary: [], routes: [], review: { intervals: [1, 3, 7, 21, 60] },
  };
  fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify(course, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'request.normalized.json'), JSON.stringify(n, null, 2) + '\n');
  return { course, request: r };
}

/* ---------------- CLI ---------------- */
function main(argv) {
  const [cmd, a, b, ...rest] = argv;
  const print = (r, label) => { r.errs.forEach(e => console.log('ERROR  ' + e)); r.warns.forEach(w => console.log('warn   ' + w)); console.log(`\n${label}: ${r.errs.length} error(s), ${r.warns.length} warning(s).`); };
  try {
    switch (cmd) {
      case 'check-request': { const r = checkRequest(readJson(a)); console.log(JSON.stringify({ ok: r.ok, blocking: r.blocking, errors: r.errors, unknown: r.unknown }, null, 2)); if (!r.ok) console.error(`\nNot ready: ${r.blocking.length} blocking gap(s), ${r.errors.length} error(s). Ask the requester or fix the request before init.`); return r.ok ? 0 : 1; }
      case 'init': { const r = initCourse(a, b); console.log(`Created ${b}/course.json (id "${r.course.id}"; rename it now if you want a different stable id).\nNext: define outcomes and modules in course.json, then write lessons/<id>.json files (see references/lesson-contract.md).`); return 0; }
      case 'validate': { const r = validateCourse(a); print(r, 'validate'); return r.errs.length ? 1 : 0; }
      case 'build': { const out = rest[0] === '--out' ? rest[1] : (b === '--out' ? rest[0] : undefined); const r = build(a, out); print(r, 'build'); if (!r.errs.length) console.log(`Site: ${r.out}/index.html\nMarkdown: ${r.md}/\nCoverage: ${path.join(a, 'COVERAGE.md')}`); return r.errs.length ? 1 : 0; }
      case 'serve': {
        const root = path.resolve(a || '.'); const port = +(b || 8000);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8' };
        import('node:http').then(({ createServer }) => createServer((rq, rs) => {
          let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
          const f = path.resolve(root, '.' + p); if (!f.startsWith(root + path.sep) && f !== root) { rs.writeHead(403); return rs.end(); }
          fs.readFile(f, (e, data) => { if (e) { rs.writeHead(404); return rs.end('Not found'); } rs.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rs.end(data); });
        }).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/ (Ctrl+C to stop)`)));
        return null;
      }
      case 'coverage': { const r = validateCourse(a); if (!r.data) { print(r, 'coverage'); return 1; } console.log(coverageMarkdown(r)); return r.errs.length ? 1 : 0; }
      default: console.log('Usage: node lk.mjs <check-request|init|validate|build|coverage> …'); return cmd ? 1 : 0;
    }
  } catch (e) { console.error('ERROR  ' + e.message); return 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const code = main(process.argv.slice(2)); if (code !== null) process.exit(code); }
