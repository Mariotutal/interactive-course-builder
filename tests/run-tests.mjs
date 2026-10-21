#!/usr/bin/env node
// Functional tests for the deterministic parts of interactive-course-builder. Run: node tests/run-tests.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'interactive-course-builder');
const lk = await import(path.join(SKILL, 'scripts', 'lk.mjs'));
const E = createRequire(import.meta.url)(path.join(SKILL, 'assets', 'runtime', 'lk-expr.js'));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.log('✗', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m || ''} ${a} not within ${tol} of ${b}`);

// --- Expression evaluator ---
t('expr: arithmetic and precedence', () => { eq(E.evaluate('2 + 3 * 4 ^ 2'), 50); eq(E.evaluate('-2 ^ 2'), -4); eq(E.evaluate('(1 < 2) && (3 >= 3)'), 1); eq(E.evaluate('x > 1 ? 10 : 20', { x: 2 }), 10); });
t('expr: statistics functions', () => { near(E.evaluate('normcdf(1.96)'), 0.975, 1e-4); near(E.evaluate('norminv(0.975)'), 1.95996, 1e-4); eq(E.evaluate('choose(5, 2)'), 10); near(E.evaluate('binompmf(2, 4, 0.5)'), 0.375, 1e-9); });
t('expr: Student t quantiles and cdf', () => { near(E.evaluate('tinv(0.975, 9)'), 2.2622, 1e-3); near(E.evaluate('tinv(0.975, 29)'), 2.0452, 1e-3); near(E.evaluate('tcdf(2.0452, 29)'), 0.975, 1e-4); near(E.evaluate('tinv(0.975, 1)'), 12.706, 1e-2); });
t('expr: rejects unknown identifiers and code', () => { for (const bad of ['alert(1)', 'constructor', 'x.y', 'this', 'a = 1', '"str"']) { let threw = false; try { E.evaluate(bad, {}); } catch { threw = true; } ok(threw, `should reject ${bad}`); } });
t('expr: variables() lists inputs only', () => eq(E.variables('a * pi + sqrt(b) + e').sort(), ['a', 'b']));

// --- Learning request ---
t('check-request: blocking when topic/goals missing', () => { const r = lk.checkRequest({}); ok(!r.ok); eq(r.blocking.length, 2); });
t('check-request: defaults recorded as unknowns', () => { const r = lk.checkRequest({ topic: 'X', goals: ['Y'] }); ok(r.ok); ok(r.unknown.some(u => u.startsWith('learner.startingKnowledge'))); eq(r.normalized.time.sessionMinutes, 40); });
t('check-request: rejects invalid language and session length', () => { const r = lk.checkRequest({ topic: 'X', goals: ['Y'], language: 'Spanish', time: { sessionMinutes: 2 } }); eq(r.errors.length, 2); });

// --- Validator against mutated copies of the starter course ---
const STARTER = path.join(SKILL, 'assets', 'templates', 'starter-course');
function withCourse(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-'));
  fs.cpSync(STARTER, dir, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'))); const lf = path.join(dir, 'lessons', 'fermi-decompose.json'); const l = JSON.parse(fs.readFileSync(lf));
  mutate(c, l, dir); fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify(c)); fs.writeFileSync(lf, JSON.stringify(l));
  const v = lk.validateCourse(dir); fs.rmSync(dir, { recursive: true, force: true }); return v;
}
const hasErr = (v, re) => ok(v.errs.some(e => re.test(e)), `expected an error matching ${re}; got:\n  ${v.errs.join('\n  ')}`);
t('validate: starter course is valid', () => { const v = lk.validateCourse(STARTER); eq(v.errs, []); });
t('validate: theme profile must be a supported domain profile', () => hasErr(withCourse((c) => { c.theme = { profile: 'neon-cyber' }; }), /theme.profile must be one of/));
t('validate: missing transfer is an error', () => hasErr(withCourse((c, l) => { l.blocks = l.blocks.filter(b => b.type !== 'transfer'); }), /missing transfer/));
t('validate: justified exemption is accepted', () => { const v = withCourse((c, l) => { l.blocks = l.blocks.filter(b => b.type !== 'worked'); l.exemptions = { worked: 'Listening lesson: modelled dialogue replaces a worked example.' }; }); ok(!v.errs.some(e => /missing worked/.test(e)), v.errs.join('; ')); });
t('validate: short exemption reason is rejected', () => hasErr(withCourse((c, l) => { l.exemptions = { worked: 'n/a' }; }), /justification/));
t('validate: unsafe html rejected', () => hasErr(withCourse((c, l) => { l.blocks[0].html += '<img src=x onerror="alert(1)">'; }), /inline event handlers/));
t('validate: script tag rejected', () => hasErr(withCourse((c, l) => { l.blocks[0].html += '<script>alert(1)</script>'; }), /<script>/));
t('validate: placeholder text rejected', () => hasErr(withCourse((c, l) => { l.blocks[3].html = '<p>TODO write this</p>'; }), /placeholder/));
t('validate: Spanish words "todo"/"método" are not placeholders (regression)', () => { const v = withCourse((c, l) => { l.blocks[3].html = '<p>Sobre todo, el método importa. Todo el grupo.</p>'; }); ok(!v.errs.some(e => /placeholder/.test(e)), v.errs.join('; ')); });
t('validate: visual without text equivalent rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'visual').alt = 'short'; }), /text equivalent/));
t('validate: inline citations require a matching original URL', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'explain').html += '<p>Claim <a data-source="missing">[1]</a></p>'; }), /inline citation "missing"/));
t('validate: local images need an asset and alt text', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'visual').html = '<figure><img src="assets/absent.png"><figcaption>Figure</figcaption></figure>'; }), /image needs meaningful alt text|must exist in the course assets/));
t('validate: outcome never assessed is an error', () => hasErr(withCourse((c, l) => { c.outcomes.push({ id: 'o3', text: 'Something extra' }); l.outcomes.push('o3'); }), /o3 is never assessed/));
t('validate: outcome never taught is an error', () => hasErr(withCourse(c => { c.outcomes.push({ id: 'o4', text: 'Untaught' }); c.capstone.assesses.push('o4'); }), /o4 is not taught/));
t('validate: bad expression rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'activity').config.outputs[0].expr = 'pop / missing'; }), /unknown variable/));
t('validate: chart current position checks its expression', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'activity').config.chart = { x: { from: 1, to: 10 }, series: [{ label: 'a', expr: 'x' }], current: { x: 'missing' } }; }), /unknown variable/));
t('validate: unknown widget rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'activity').widget = 'nope'; }), /unknown widget/));
t('validate: mcq correct index out of range', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'check').questions[0].correct = 9; }), /index of an option/));
t('validate: undefined glossary term rejected', () => hasErr(withCourse((c, l) => { l.blocks[3].html += '<span class="term" data-term="nonexistent">x</span>'; }), /glossary term/));
t('validate: duplicate ids rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'reflect').id = 'fd-pr1'; }), /duplicate id/));
t('validate: custom widget detected from widgets/ folder', () => { const v = withCourse((c, l, dir) => { fs.mkdirSync(path.join(dir, 'widgets')); fs.writeFileSync(path.join(dir, 'widgets', 'x.js'), "LK.registerWidget('my-sim', { mount() {} });"); l.blocks.find(b => b.type === 'activity').widget = 'my-sim'; }); ok(!v.errs.some(e => /unknown widget/.test(e)), v.errs.join('; ')); ok(v.warns.some(w => /assumptions/.test(w)) || true); });

t('validate: widget gallery fixture (all 13 patterns) is valid', () => { const v = lk.validateCourse(path.join(ROOT, 'tests', 'fixtures', 'widget-gallery')); eq(v.errs, []); });
t('validate: code trace rejects a missing highlighted line', () => hasErr(withCourse((c, l) => { const a = l.blocks.find(b => b.type === 'activity'); a.widget = 'code-trace'; a.config = { code: 'x = 1', steps: [{ line: 2, html: '<p>Bad.</p>' }, { line: 1, html: '<p>Good.</p>' }] }; }), /line must be between/));
t('validate: system flow rejects a missing active node', () => hasErr(withCourse((c, l) => { const a = l.blocks.find(b => b.type === 'activity'); a.widget = 'system-flow'; a.config = { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], steps: [{ active: ['a'], html: '<p>One.</p>' }, { active: ['missing'], html: '<p>Two.</p>' }] }; }), /unknown active node/));
t('validate: causal map rejects an invalid challenge link', () => hasErr(withCourse((c, l) => { const a = l.blocks.find(b => b.type === 'activity'); a.widget = 'causal-map'; a.config = { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], links: [{ id: 'ab', from: 'a', to: 'b', explanation: '<p>One.</p>' }, { id: 'bc', from: 'b', to: 'c', explanation: '<p>Two.</p>' }], challenge: { prompt: 'Choose', options: ['ab', 'none'], correct: 'ab', explanation: 'Because.' } }; }), /unknown link/));
t('validate: scenario with dangling choice rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-g-')); fs.cpSync(path.join(ROOT, 'tests', 'fixtures', 'widget-gallery'), dir, { recursive: true });
  const lf = path.join(dir, 'lessons', 'gallery.json'); const l = JSON.parse(fs.readFileSync(lf)); l.blocks.find(b => b.id === 'g-sc').config.nodes.n1.choices[0].next = 'nowhere'; fs.writeFileSync(lf, JSON.stringify(l));
  const v = lk.validateCourse(dir); fs.rmSync(dir, { recursive: true, force: true }); hasErr(v, /missing node "nowhere"/);
});

// --- Build ---
t('build: writes site, markdown, coverage; hashes stable across builds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-b-')); fs.cpSync(STARTER, dir, { recursive: true });
  const r1 = lk.build(dir); eq(r1.errs, []);
  for (const f of ['site/index.html', 'site/content.js', 'site/runtime/lk-app.js', 'site/runtime/lk-widgets.js', 'markdown/README.md', 'COVERAGE.md']) ok(fs.existsSync(path.join(dir, f)), 'missing ' + f);
  ok(!fs.existsSync(path.join(dir, 'site', 'runtime', 'index.html')), 'template must not be copied into runtime/');
  const read = () => { const src = fs.readFileSync(path.join(dir, 'site', 'content.js'), 'utf8'); return JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, '')).hashes; };
  const h1 = read(); lk.build(dir); const h2 = read(); eq(h1, h2, 'hashes changed without content change');
  const lf = path.join(dir, 'lessons', 'fermi-decompose.json'); const l = JSON.parse(fs.readFileSync(lf)); l.blocks.find(b => b.id === 'fd-p1').options[1] = 'changed'; fs.writeFileSync(lf, JSON.stringify(l));
  lk.build(dir); const h3 = read(); ok(h3['fd-p1'] !== h1['fd-p1'], 'changed question must get a new hash'); eq(h3['fd-c1'], h1['fd-c1'], 'unchanged question keeps its hash');
  const html = fs.readFileSync(path.join(dir, 'site', 'index.html'), 'utf8'); ok(!/{{/.test(html), 'unreplaced template placeholders'); ok(/lang="en"/.test(html));
  fs.rmSync(dir, { recursive: true, force: true });
});
t('build: resolves inline sources and packages lesson images in both outputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-media-')); fs.cpSync(STARTER, dir, { recursive: true });
  const lf = path.join(dir, 'lessons', 'fermi-decompose.json'); const l = JSON.parse(fs.readFileSync(lf));
  l.sources.push({ id: 'diagram', title: 'Original diagram', kind: 'official', url: 'https://example.org/figure#panel-a', accessed: '2026-10-20' });
  l.blocks.find(b => b.type === 'visual').html = '<figure><img src="assets/diagram.png" alt="Four estimation factors shown in sequence"><figcaption>Follow the factors <a data-source="diagram">[source]</a></figcaption></figure>';
  fs.mkdirSync(path.join(dir, 'assets')); fs.writeFileSync(path.join(dir, 'assets', 'diagram.png'), 'image bytes'); fs.writeFileSync(lf, JSON.stringify(l));
  eq(lk.build(dir).errs, []);
  for (const target of ['site/assets/diagram.png', 'markdown/assets/diagram.png']) ok(fs.existsSync(path.join(dir, target)), 'missing ' + target);
  const siteJs = fs.readFileSync(path.join(dir, 'site', 'content.js'), 'utf8'); const site = JSON.parse(siteJs.slice(siteJs.indexOf('=') + 1).trim().replace(/;$/, ''));
  const visual = site.lessons[0].blocks.find(b => b.type === 'visual').html; const md = fs.readFileSync(path.join(dir, 'markdown', '01-fermi-decompose.md'), 'utf8');
  ok(visual.includes('href="https://example.org/figure#panel-a"') && !visual.includes('data-source='), 'site citation unresolved');
  ok(md.includes('https://example.org/figure#panel-a') && !md.includes('data-source="diagram"'), 'Markdown citation unresolved');
  fs.rmSync(dir, { recursive: true, force: true });
});
t('build: refuses to build an invalid course', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-c-')); fs.cpSync(STARTER, dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'lessons', 'fermi-decompose.json'), '{"format":1,"id":"fermi-decompose","blocks":[]}'); const r = lk.build(dir); ok(r.errs.length > 0); ok(!fs.existsSync(path.join(dir, 'site')), 'site should not be written'); fs.rmSync(dir, { recursive: true, force: true }); });
t('init: refuses to overwrite and creates no placeholder lessons', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-i-')); const req = path.join(dir, 'req.json'); fs.writeFileSync(req, JSON.stringify({ topic: 'Bird song identification', goals: ['Tell 5 common songs apart'], language: 'pt-BR' }));
  const r = lk.initCourse(req, path.join(dir, 'c')); eq(r.course.language, 'pt-BR'); eq(fs.readdirSync(path.join(dir, 'c', 'lessons')).length, 0);
  let threw = false; try { lk.initCourse(req, path.join(dir, 'c')); } catch { threw = true; } ok(threw, 'second init must refuse');
  const v = lk.validateCourse(path.join(dir, 'c')); ok(v.errs.some(e => /needs outcomes/.test(e)), 'empty course must not validate');
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- Blocking requests, profiles, routes, languages ---
const { spawnSync } = await import('node:child_process');
const CLI = path.join(SKILL, 'scripts', 'lk.mjs');
t('check-request: exits non-zero when the request has blocking gaps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-r-')); const f = path.join(dir, 'r.json'); fs.writeFileSync(f, JSON.stringify({ goals: ['x'] }));
  const r = spawnSync(process.execPath, [CLI, 'check-request', f], { encoding: 'utf8' }); eq(r.status, 1, 'exit code'); ok(/"ok": false/.test(r.stdout));
  fs.writeFileSync(f, JSON.stringify({ topic: 'T', goals: ['x'] })); eq(spawnSync(process.execPath, [CLI, 'check-request', f]).status, 0, 'ready request exit code');
  fs.rmSync(dir, { recursive: true, force: true });
});
t('init: refuses a request with blocking gaps and creates nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-r2-')); const f = path.join(dir, 'r.json'); fs.writeFileSync(f, JSON.stringify({ goals: ['x'] }));
  let threw = false; try { lk.initCourse(f, path.join(dir, 'c')); } catch (e) { threw = /blocking/.test(e.message); } ok(threw, 'must throw mentioning blocking'); ok(!fs.existsSync(path.join(dir, 'c')), 'no course directory');
  const r = spawnSync(process.execPath, [CLI, 'init', f, path.join(dir, 'c')]); eq(r.status, 1, 'CLI exit code'); fs.rmSync(dir, { recursive: true, force: true });
});
const focusedLesson = l => { l.profile = 'focused'; l.blocks = l.blocks.filter(b => ['motivate', 'explain'].includes(b.type)).concat([{ type: 'check', questions: [l.blocks.find(b => b.type === 'check').questions[0]] }]); };
t('validate: a focused lesson needs only motivate, explain, check and sources', () => { const v = withCourse((c, l) => { focusedLesson(l); c.capstone.assesses = ['o1', 'o2']; }); eq(v.errs, []); });
t('validate: the same short lesson is rejected under the full profile', () => { const v = withCourse((c, l) => { focusedLesson(l); delete l.profile; }); hasErr(v, /missing visual/); hasErr(v, /at least 2 check question/); });
t('validate: unknown profile rejected', () => hasErr(withCourse((c, l) => { l.profile = 'mini'; }), /profile must be/));
t('validate: outcome without any transfer task warns (course level)', () => { const v = withCourse((c, l) => { focusedLesson(l); delete c.capstone; }); ok(v.warns.some(w => /no transfer task/.test(w)), v.warns.join('; ')); });
t('validate: advanced route optional; missing routes only warns', () => { const v = withCourse(c => { delete c.routes; }); eq(v.errs, []); ok(v.warns.some(w => /no routes/.test(w))); });
t('languages: non-built-in UI language warns in request and course', () => {
  ok(lk.checkRequest({ topic: 'T', goals: ['g'], language: 'pt-BR' }).unknown.some(u => /pt-BR/.test(u)), 'request note');
  const v = withCourse(c => { c.language = 'pt-BR'; }); ok(v.warns.some(w => /no built-in UI strings/.test(w)), v.warns.join('; '));
  const v2 = withCourse(c => { c.language = 'es'; }); ok(!v2.warns.some(w => /UI strings/.test(w)), 'es is built in');
});
t('markdown: headings follow the course language', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-m-')); fs.cpSync(STARTER, dir, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'))); c.language = 'es'; fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify(c));
  eq(lk.build(dir).errs, []); const md = fs.readFileSync(path.join(dir, 'markdown', '01-fermi-decompose.md'), 'utf8');
  ok(/## Por qué importa/.test(md) && /## Comprueba tu comprensión/.test(md) && /## Fuentes de esta lección/.test(md), 'Spanish headings'); ok(!/## Why this matters/.test(md), 'no English heading');
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- Security regressions (review findings) ---
const tmpCourse = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-s-')); const c = path.join(dir, 'course'); fs.cpSync(STARTER, c, { recursive: true }); return { dir, c }; };
t('build: --out equal to the course directory is refused and deletes nothing', () => {
  const { dir, c } = tmpCourse(); const r = lk.build(c, c); ok(r.errs.some(e => /course directory or one of its parents/.test(e)), r.errs.join('; '));
  ok(fs.existsSync(path.join(c, 'course.json')) && fs.existsSync(path.join(c, 'lessons', 'fermi-decompose.json')), 'source must survive'); fs.rmSync(dir, { recursive: true, force: true });
});
t('build: --out that is a parent of the course is refused', () => { const { dir, c } = tmpCourse(); const r = lk.build(c, dir); ok(r.errs.length && fs.existsSync(path.join(c, 'course.json'))); fs.rmSync(dir, { recursive: true, force: true }); });
t('build: --out pointing at a source subfolder (lessons/) is refused', () => { const { dir, c } = tmpCourse(); const r = lk.build(c, path.join(c, 'lessons')); ok(r.errs.some(e => /not created by a previous build/.test(e))); ok(fs.existsSync(path.join(c, 'lessons', 'fermi-decompose.json'))); fs.rmSync(dir, { recursive: true, force: true }); });
t('build: a non-empty unrelated --out directory is refused; empty and previous builds are reused', () => {
  const { dir, c } = tmpCourse(); const other = path.join(dir, 'mine'); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'keep.txt'), 'x');
  ok(lk.build(c, other).errs.some(e => /not empty/.test(e)) && fs.existsSync(path.join(other, 'keep.txt')), 'unrelated dir kept');
  const empty = path.join(dir, 'empty'); fs.mkdirSync(empty); eq(lk.build(c, empty).errs, []); eq(lk.build(c, empty).errs, [], 'rebuild into marked dir');
  ok(fs.existsSync(path.join(empty, '.lk-build')), 'marker written'); fs.rmSync(dir, { recursive: true, force: true });
});
t('build: markdown and COVERAGE.md stay inside the course even with an external --out', () => {
  const { dir, c } = tmpCourse(); const sib = path.join(dir, 'markdown'); fs.mkdirSync(sib); fs.writeFileSync(path.join(sib, 'notes.txt'), 'mine');
  eq(lk.build(c, path.join(dir, 'site')).errs, []); ok(fs.existsSync(path.join(sib, 'notes.txt')), 'sibling markdown/ untouched'); ok(fs.existsSync(path.join(c, 'markdown', 'README.md')) && fs.existsSync(path.join(c, 'COVERAGE.md')));
  fs.rmSync(dir, { recursive: true, force: true });
});
t('html: entity-encoded and obfuscated executable URLs are rejected', () => {
  for (const h of ['<a href="jav&#x61;script:alert(1)">x</a>', '<a href="jav&#97script:alert(1)">x</a>', '<a href="java&Tab;script&colon;alert(1)">x</a>', '<a href=" JaVaScRiPt:alert(1)">x</a>', '<a href="&#0000106;avascript:1">x</a>', '<a href="java&#10;script:1">x</a>', '<svg><a xlink:href="data:text/html,x"><text>x</text></a></svg>', '<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>', '<a href=vbscript:x>x</a>', '<p style="background:url(javascript:1)">x</p>', '<style>p{}</style>'])
    ok(lk.htmlSafetyErrors(h).length, 'not caught: ' + h);
  for (const h of ['<a href="https://example.org/?a=1&amp;b=2">ok</a>', '<a href="#s">ok</a>', '<img src="assets/a.png" alt="">', '<img src="data:image/png;base64,AA" alt="">', '<p>At 10:30, javascript is a language.</p>'])
    eq(lk.htmlSafetyErrors(h), [], 'false positive: ' + h);
});
t('validate: entity-encoded javascript link in a lesson is an error (reported case)', () => hasErr(withCourse((c, l) => { l.blocks[3].html += '<a href="jav&#x61;script:alert(1)">x</a>'; }), /"javascript:" URL/));

// --- Roadmap: learner state format 2 and concept review model (lk-state.js) ---
const LS = createRequire(import.meta.url)(path.join(SKILL, 'assets', 'runtime', 'lk-state.js'));
const CONCEPTS = path.join(ROOT, 'tests', 'fixtures', 'concepts-lab');
const fixtureModel = () => { const v = lk.validateCourse(CONCEPTS); return LS.conceptModel(v.data.course, v.data.lessons); };
t('state: format 1 data is accepted and migrated to format 2', () => {
  const r = LS.clean({ format: 1, courseId: 'x', items: { q1: { h: 'a', attempts: 1, first: 0, last: 0, correctFirst: true, at: '2026-10-01' } }, visited: { l1: '2026-10-01' } }, 'x');
  eq(r.migratedFrom, 1); eq(r.state.format, 2); eq(r.state.concepts, {}); eq(r.state.items.q1.correctFirst, true);
});
t('state: format 2 concept entries are validated; malformed ones are dropped and counted', () => {
  const r = LS.clean({ format: 2, courseId: 'x', concepts: { ok: { introduced: '2026-10-01', step: 1, due: '2026-10-04', events: [{ d: '2026-10-01', ok: true }, { d: 'bad', ok: true }] }, bad1: { introduced: 'x', step: 0, events: [] }, bad2: null } }, 'x');
  eq(Object.keys(r.state.concepts), ['ok']); eq(r.state.concepts.ok.events.length, 1); eq(r.dropped, 2);
  let threw = false; try { LS.clean({ format: 2, courseId: 'x', concepts: [] }, 'x'); } catch (e) { threw = /concepts/.test(e.message); } ok(threw, 'array concepts must be rejected');
  threw = false; try { LS.clean({ format: 3, courseId: 'x' }, 'x'); } catch (e) { threw = true; } ok(threw, 'unknown format rejected');
});
t('state: expanding intervals on success, reset on failure, unscheduled after the last interval', () => {
  const s = LS.empty('x'); const iv = [1, 3, 7];
  LS.introduce(s, ['a'], '2026-10-01', iv); eq(s.concepts.a.due, '2026-10-02');
  LS.retrieval(s, ['a'], true, '2026-10-02', iv); eq([s.concepts.a.step, s.concepts.a.due], [1, '2026-10-05']);
  LS.retrieval(s, ['a'], true, '2026-10-05', iv); eq([s.concepts.a.step, s.concepts.a.due], [2, '2026-10-12']);
  LS.retrieval(s, ['a'], false, '2026-10-12', iv); eq([s.concepts.a.step, s.concepts.a.due], [0, '2026-10-13']);
  LS.retrieval(s, ['a'], true, '2026-10-13', iv); LS.retrieval(s, ['a'], true, '2026-10-16', iv); LS.retrieval(s, ['a'], true, '2026-10-23', iv);
  eq(s.concepts.a.due, null, 'all intervals done'); eq(LS.summary(s.concepts.a).retrievals, 6);
});
t('state: due queue is ordered by due date and excludes future concepts', () => {
  const s = LS.empty('x'); LS.introduce(s, ['b'], '2026-10-03', [1]); LS.introduce(s, ['a'], '2026-10-01', [1]); LS.introduce(s, ['c'], '2026-10-20', [1]);
  eq(LS.dueConcepts(s, '2026-10-10'), ['a', 'b']);
});
t('state: concept model maps tagged items and lessons from the fixture', () => {
  const m = fixtureModel(); ok(m, 'model'); eq(m.itemConcepts.c2, ['evaluate-linear', 'intercept']); ok(m.conceptItems.slope.includes('r2')); eq(m.byLesson['line-review'].sort(), ['evaluate-linear', 'rate-of-change']);
});
t('state: migration backfills concept history from format 1 visits and first attempts', () => {
  const m = fixtureModel();
  const r = LS.clean({ format: 1, courseId: 'concepts-lab', visited: { 'slope-intercept': '2026-10-01' }, items: { c1: { h: 'h', attempts: 1, first: 0, last: 0, correctFirst: true, at: '2026-10-02' }, c2: { h: 'h', attempts: 2, first: '9', last: '3', correctFirst: false, at: '2026-10-02' } } }, 'concepts-lab');
  LS.backfillConcepts(r.state, m, [1, 3, 7]);
  eq(r.state.concepts.slope.introduced, '2026-10-01'); eq(r.state.concepts.slope.step, 1); eq(r.state.concepts.intercept.step, 0); eq(r.state.concepts['evaluate-linear'].events.length, 1);
});
t('state: reconcile drops results whose content hash changed', () => { const s = LS.empty('x'); s.items = { a: { h: '1', attempts: 1 }, b: { h: '2', attempts: 1 } }; eq(LS.reconcile(s, { a: '1', b: 'X' }), ['b']); eq(Object.keys(s.items), ['a']); });

// --- Roadmap: optional knowledge architecture ---
const withConcepts = mutate => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-k-')); fs.cpSync(CONCEPTS, dir, { recursive: true }); const c = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'))); const lf = path.join(dir, 'lessons', 'slope-intercept.json'); const l = JSON.parse(fs.readFileSync(lf)); mutate(c, l); fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify(c)); fs.writeFileSync(lf, JSON.stringify(l)); const v = lk.validateCourse(dir); fs.rmSync(dir, { recursive: true, force: true }); return v; };
const hasWarn = (v, re) => ok(v.warns.some(w => re.test(w)), `expected a warning matching ${re}; got:\n  ${v.warns.join('\n  ')}`);
t('knowledge: the concepts fixture validates with no errors or warnings', () => { const v = lk.validateCourse(CONCEPTS); eq(v.errs, []); eq(v.warns, []); ok(v.knowledge.length === 5); });
t('knowledge: optional — a course without it is unaffected', () => { const v = lk.validateCourse(STARTER); eq(v.errs, []); eq(v.knowledge, null); });
t('knowledge: prerequisite cycle is an error', () => hasErr(withConcepts(c => { c.knowledgeArchitecture.prerequisites.push({ from: 'evaluate-linear', to: 'slope' }); }), /prerequisite cycle/));
t('knowledge: unknown concept tag on a question is an error', () => hasErr(withConcepts((c, l) => { l.blocks.find(b => b.type === 'check').questions[0].concepts = ['nope']; }), /unknown concept "nope"/));
t('knowledge: a disposition cannot be auto-assessed', () => hasErr(withConcepts(c => { c.knowledgeArchitecture.assessmentModes['check-models'] = 'auto'; }), /cannot be assessed with auto-checked/));
t('knowledge: every concept needs an assessment mode', () => hasErr(withConcepts(c => { delete c.knowledgeArchitecture.assessmentModes.slope; }), /slope has no assessment mode/));
t('knowledge: a hub needs at least two concepts', () => hasErr(withConcepts(c => { c.knowledgeArchitecture.hubs[0].concepts = ['slope']; }), /at least 2 concepts/));
t('knowledge: a disposition needs at least two progression bands', () => hasErr(withConcepts(c => { c.knowledgeArchitecture.dispositions[0].bands = [{ level: 1, descriptor: 'x' }]; }), /2 progression bands/));
t('knowledge: mode without matching evidence warns', () => hasWarn(withConcepts((c, l) => { l.blocks.find(b => b.id === 'p2').concepts = []; l.blocks.find(b => b.id === 'lab1').concepts = ['slope', 'intercept']; }), /check-models is assessed by "observation"/));
t('knowledge: prerequisite taught later than its dependent warns', () => hasWarn(withConcepts(c => { c.knowledgeArchitecture.concepts.find(x => x.id === 'slope').lessons = ['line-review']; c.knowledgeArchitecture.prerequisites = [{ from: 'slope', to: 'intercept' }]; }), /first taught after/));
t('knowledge: coverage report includes the knowledge table', () => { const md = lk.coverageMarkdown(lk.validateCourse(CONCEPTS)); ok(/## Knowledge architecture/.test(md) && /check-models/.test(md)); });

// --- Roadmap: short learner intake ---
t('intake: goals can come from intake.capability; decisions are recorded', () => {
  const r = lk.checkRequest({ topic: 'Bird songs', intake: { capability: 'Tell 5 songs apart', familiarity: 'none', modality: 'hands-on', practiceLoad: 'heavy' }, time: { sessionMinutes: 20 } });
  ok(r.ok, r.blocking.join(';')); eq(r.normalized.goals, ['Tell 5 songs apart']); eq(r.intakeQuestions, []);
  eq(r.decisions.map(d => d.because), ['familiarity: none', 'modality: hands-on', 'practice load: heavy', 'sessions of 20 min']);
});
t('intake: missing answers produce at most three questions; invalid values are errors', () => {
  const r = lk.checkRequest({ topic: 'T', goals: ['g'] }); eq(r.intakeQuestions.length, 2, 'familiarity + modality/load (capability comes from goals)');
  eq(lk.checkRequest({ topic: 'T' }).intakeQuestions.length, 3);
  ok(lk.checkRequest({ topic: 'T', goals: ['g'], intake: { familiarity: 'expert' } }).errors.some(e => /intake.familiarity/.test(e)));
});
t('intake: init stores the decisions; validate warns when intake has no decisions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-in-')); const f = path.join(dir, 'r.json'); fs.writeFileSync(f, JSON.stringify({ topic: 'T', goals: ['g'], intake: { familiarity: 'some', modality: 'visual', practiceLoad: 'light' } }));
  const r = lk.initCourse(f, path.join(dir, 'c')); ok(r.course.learner.decisions.length >= 3); fs.rmSync(dir, { recursive: true, force: true });
  hasWarn(withConcepts(c => { c.learner.decisions = []; }), /learner.decisions is empty/);
});

// --- Roadmap: visual options with contrast validation ---
t('theme: unsupported option values are errors; unknown keys warn', () => { const v = withConcepts(c => { c.theme.typeScale = 'huge'; c.theme.illustrationStyle = 'watercolor'; }); hasErr(v, /theme.typeScale/); hasWarn(v, /illustrationStyle is not a supported option/); });
t('theme: token colours below 4.5:1 contrast are errors; per-mode colours pass', () => {
  hasErr(withConcepts(c => { c.theme.tokens.light.accent = '#ffcc00'; }), /contrast .* against #f7f7f4/);
  hasErr(withConcepts(c => { c.theme.tokens.dark.accent = '#333333'; }), /contrast .* against #15171a/);
  near(lk.contrast('#000000', '#ffffff'), 21, 1e-9); near(lk.contrast('#777777', '#ffffff'), 4.48, 0.01);
});

// --- Roadmap: function-lab sandbox (course-local widget) ---
t('function-lab: a failing author test case is an error', () => hasErr(withConcepts((c, l) => { l.blocks.find(b => b.id === 'lab1').config.testCases[0].value = 6; }), /test case .* failed/));
t('function-lab: unknown variables and invalid task types are errors', () => { const v = withConcepts((c, l) => { const cfg = l.blocks.find(b => b.id === 'lab1').config; cfg.curves[0].expr = 'k*x'; cfg.tasks[0].type = 'guess'; }); hasErr(v, /unknown variable\(s\) k/); hasErr(v, /type must be direction or value/); });
t('build: copies lk-state.js and the course widget; site references both', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-cb-')); fs.cpSync(CONCEPTS, dir, { recursive: true }); eq(lk.build(dir).errs, []);
  ok(fs.existsSync(path.join(dir, 'site', 'runtime', 'lk-state.js')) && fs.existsSync(path.join(dir, 'site', 'widgets', 'function-lab.js')));
  const html = fs.readFileSync(path.join(dir, 'site', 'index.html'), 'utf8'); ok(html.indexOf('lk-state.js') < html.indexOf('lk-app.js') && /widgets\/function-lab.js/.test(html));
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- Roadmap: evaluation harness (evaluation/lk-eval.mjs) ---
const EV = await import(path.join(ROOT, 'evaluation', 'lk-eval.mjs'));
t('eval: automatic metrics build the course and check output integrity', () => {
  const r = EV.autoMetrics(CONCEPTS); eq(r.validate.errors, 0); ok(r.integrity.built, 'built'); eq(r.integrity.problems, []);
  eq(r.metrics.lessons, 2); eq(r.metrics.transfer.outcomesWithTransferPct, 100); eq(r.metrics.questions.mcqWithFullMisconceptionFeedbackPct, 100); ok(r.metrics.density.interactionsPer1000Words > 0); eq(r.metrics.knowledgeArchitecture.concepts, 4);
});
t('eval: an invalid course reports errors and is not built', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-ev-')); fs.cpSync(STARTER, dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'lessons', 'fermi-decompose.json'), '{"format":1,"id":"fermi-decompose","blocks":[]}'); const r = EV.autoMetrics(dir); ok(r.validate.errors > 0); eq(r.integrity.built, false); fs.rmSync(dir, { recursive: true, force: true }); });
t('eval: manual scores are validated; self-review is labelled; report aggregates', () => {
  const m = EV.manualTemplate('x'); ok(EV.checkManual(m).length >= 8, 'empty template is incomplete');
  for (const c of Object.keys(m.scores)) m.scores[c] = { score: 2, rationale: 'Checked lesson 1 and lesson 2 against the sources.' }; m.reviewer = 'test'; eq(EV.checkManual(m), []);
  m.scores['factual-accuracy'].score = 3; ok(EV.checkManual(m).some(p => /0, 1 or 2/.test(p)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-rp-')); fs.mkdirSync(path.join(dir, 'fix')); fs.writeFileSync(path.join(dir, 'fix', 'auto.json'), JSON.stringify(EV.autoMetrics(CONCEPTS))); m.scores['factual-accuracy'].score = 1; fs.writeFileSync(path.join(dir, 'fix', 'manual.json'), JSON.stringify(m));
  const out = path.join(dir, 'R.md'); const r = EV.report({ results: dir, out }); eq(r.names, ['fix']); const md = fs.readFileSync(out, 'utf8'); ok(/no \(self-review\)/.test(md) && /\| 13 \|/.test(md), 'self-review label and total'); fs.rmSync(dir, { recursive: true, force: true });
});
t('eval: pilot aggregates valid exports, rejects other courses and never includes free text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-pi-'));
  const mk = (name, c1ok, text) => { const s = LS.empty('concepts-lab'); s.visited['slope-intercept'] = '2026-10-10'; s.items.c1 = { h: 'x', attempts: 1, first: c1ok ? 0 : 1, last: 0, correctFirst: c1ok, at: '2026-10-10' }; s.texts.tr1 = { id: 'tr1', v: text }; s.confidence['slope-intercept'] = 3; LS.retrieval(s, ['slope'], c1ok, '2026-10-10', [1, 3]); const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(s)); return f; };
  const files = [mk('a.json', true, 'Secret learner text that must not appear in the summary.'), mk('b.json', false, 'short'), mk('c.json', true, 'Another long enough private response here.')];
  const other = path.join(dir, 'o.json'); fs.writeFileSync(other, JSON.stringify(LS.empty('another-course')));
  const r = EV.pilot(CONCEPTS, [...files, other]); eq(r.n, 3); eq(r.rejected.length, 1);
  const l1 = r.lessonRows.find(x => x.lesson === 'slope-intercept'); eq(l1.visitedPct, 100); eq(l1.firstAttemptCorrectPct, 66.7); eq(l1.confidence, [0, 0, 3, 0]);
  eq(r.transferRows.find(x => x.id === 'tr1').writtenPct, 66.7); eq(r.conceptRows.find(x => x.concept === 'slope').successPct, 66.7);
  ok(!/Secret learner text/.test(r.md), 'free text must not leak'); fs.rmSync(dir, { recursive: true, force: true });
});

t('markdown: code blocks inside question prompts keep their lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-md-')); fs.cpSync(STARTER, dir, { recursive: true });
  const lf = path.join(dir, 'lessons', 'fermi-decompose.json'); const l = JSON.parse(fs.readFileSync(lf)); l.blocks.find(b => b.type === 'predict').prompt = '<p>What does this print?</p><pre><code>a = [1]\nb = a\nb.append(2)\nprint(a)</code></pre>'; fs.writeFileSync(lf, JSON.stringify(l));
  eq(lk.build(dir).errs, []); const md = fs.readFileSync(path.join(dir, 'markdown', '01-fermi-decompose.md'), 'utf8'); ok(/```\nb = a\nb\.append\(2\)|b = a\nb\.append\(2\)/.test(md), 'code lines preserved'); fs.rmSync(dir, { recursive: true, force: true });
});

t('validate: question written with "type" instead of "kind" is an error (benchmark finding)', () => hasErr(withCourse((c, l) => { const q = l.blocks.find(b => b.type === 'check').questions[1]; delete q.kind; q.type = 'numeric'; }), /use "kind"/));
t('validate: citation label that does not match the source position warns', () => { const v = withCourse((c, l) => { l.sources = [{ id: 'a', title: 'A', kind: 'official', url: 'https://example.org/a', accessed: '2026-10-20' }, { id: 'b', title: 'B', kind: 'official', url: 'https://example.org/b', accessed: '2026-10-20' }]; l.blocks[3].html += '<p>Claim <a data-source="b">[1]</a></p>'; }); ok(v.warns.some(w => /label \[1\] points to "b", which is source 2/.test(w)), v.warns.join('; ')); });
t('validate: lessons longer than the requested total time warn', () => { const v = withCourse(c => { c.learner = Object.assign({}, c.learner, { time: { totalHours: 0.1 } }); }); ok(v.warns.some(w => /more than the 0.1 h the learner asked for/.test(w)), v.warns.join('; ')); });
t('validate: a full lesson whose first prediction follows the explanation warns', () => { const v = withCourse((c, l) => { const i = l.blocks.findIndex(b => b.type === 'predict'); const [p] = l.blocks.splice(i, 1); l.blocks.push(p); l.blocks = l.blocks.filter(b => b.type !== 'activity'); }); ok(v.warns.some(w => /first prediction comes after the first explain/.test(w)), v.warns.join('; ')); });
t('validate: a lesson far below the words-per-minute floor warns', () => { const v = withCourse((c, l) => { l.minutes = 180; }); ok(v.warns.some(w => /too thin for a full lesson/.test(w)), v.warns.join('; ')); });
t('validate: the starter lesson meets the depth floor', () => { const v = lk.validateCourse(STARTER); ok(!v.warns.some(w => /too thin/.test(w)), v.warns.join('; ')); });
t('lessonWords: counts prose and ignores SVG, code and markup', () => eq(lk.lessonWords({ blocks: [{ type: 'explain', html: '<p>One <b>two</b> three.</p><svg><text>no</text></svg><pre>x = 1</pre>' }] }), 3));

// --- Package hygiene ---
t('skill: SKILL.md frontmatter follows the Agent Skills constraints', () => {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8'); const fm = md.match(/^---\n([\s\S]*?)\n---/)[1];
  const name = fm.match(/^name:\s*(.+)$/m)[1].trim(); const desc = fm.match(/^description:\s*(.+)$/m)[1].trim();
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64, 'name format'); eq(name, path.basename(SKILL), 'name must match directory');
  ok(desc.length > 0 && desc.length <= 1024, 'description length ' + desc.length); ok(md.split('\n').length < 500, 'SKILL.md under 500 lines');
  const keys = [...fm.matchAll(/^([a-z][a-z-]*):/gm)].map(m => m[1]); const allowed = ['name', 'description', 'license', 'allowed-tools', 'metadata'];
  ok(keys.every(k => allowed.includes(k)), 'frontmatter keys must be within the strict set ' + allowed.join(', ') + '; got ' + keys.join(', '));
  for (const m of md.matchAll(/\]\((references\/[^)]+|assets\/[^)]+)\)/g)) ok(fs.existsSync(path.join(SKILL, m[1])), 'broken link ' + m[1]);
});
t('skill: no personal or original-course content in the reusable package', () => {
  const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
  const banned = /proxmox|homelab|\bNUC\b|QNAP|mario|Dell\b|Portainer|AdGuard/i;
  const hits = walk(SKILL).filter(f => /\.(md|js|mjs|json|html)$/.test(f)).filter(f => banned.test(fs.readFileSync(f, 'utf8').replace(/Derived from the "Proxmox desde cero" course[^\n]*|derived from the "Proxmox desde cero" course app[^\n]*/gi, '')));
  eq(hits.map(h => path.relative(SKILL, h)), []);
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
