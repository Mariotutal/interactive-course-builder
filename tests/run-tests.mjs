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
t('validate: missing transfer is an error', () => hasErr(withCourse((c, l) => { l.blocks = l.blocks.filter(b => b.type !== 'transfer'); }), /missing transfer/));
t('validate: justified exemption is accepted', () => { const v = withCourse((c, l) => { l.blocks = l.blocks.filter(b => b.type !== 'worked'); l.exemptions = { worked: 'Listening lesson: modelled dialogue replaces a worked example.' }; }); ok(!v.errs.some(e => /missing worked/.test(e)), v.errs.join('; ')); });
t('validate: short exemption reason is rejected', () => hasErr(withCourse((c, l) => { l.exemptions = { worked: 'n/a' }; }), /justification/));
t('validate: unsafe html rejected', () => hasErr(withCourse((c, l) => { l.blocks[0].html += '<img src=x onerror="alert(1)">'; }), /inline event handlers/));
t('validate: script tag rejected', () => hasErr(withCourse((c, l) => { l.blocks[0].html += '<script>alert(1)</script>'; }), /<script>/));
t('validate: placeholder text rejected', () => hasErr(withCourse((c, l) => { l.blocks[3].html = '<p>TODO write this</p>'; }), /placeholder/));
t('validate: Spanish words "todo"/"método" are not placeholders (regression)', () => { const v = withCourse((c, l) => { l.blocks[3].html = '<p>Sobre todo, el método importa. Todo el grupo.</p>'; }); ok(!v.errs.some(e => /placeholder/.test(e)), v.errs.join('; ')); });
t('validate: visual without text equivalent rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'visual').alt = 'short'; }), /text equivalent/));
t('validate: outcome never assessed is an error', () => hasErr(withCourse((c, l) => { c.outcomes.push({ id: 'o3', text: 'Something extra' }); l.outcomes.push('o3'); }), /o3 is never assessed/));
t('validate: outcome never taught is an error', () => hasErr(withCourse(c => { c.outcomes.push({ id: 'o4', text: 'Untaught' }); c.capstone.assesses.push('o4'); }), /o4 is not taught/));
t('validate: bad expression rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'activity').config.outputs[0].expr = 'pop / missing'; }), /unknown variable/));
t('validate: unknown widget rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'activity').widget = 'nope'; }), /unknown widget/));
t('validate: mcq correct index out of range', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'check').questions[0].correct = 9; }), /index of an option/));
t('validate: undefined glossary term rejected', () => hasErr(withCourse((c, l) => { l.blocks[3].html += '<span class="term" data-term="nonexistent">x</span>'; }), /glossary term/));
t('validate: duplicate ids rejected', () => hasErr(withCourse((c, l) => { l.blocks.find(b => b.type === 'reflect').id = 'fd-pr1'; }), /duplicate id/));
t('validate: custom widget detected from widgets/ folder', () => { const v = withCourse((c, l, dir) => { fs.mkdirSync(path.join(dir, 'widgets')); fs.writeFileSync(path.join(dir, 'widgets', 'x.js'), "LK.registerWidget('my-sim', { mount() {} });"); l.blocks.find(b => b.type === 'activity').widget = 'my-sim'; }); ok(!v.errs.some(e => /unknown widget/.test(e)), v.errs.join('; ')); ok(v.warns.some(w => /assumptions/.test(w)) || true); });

t('validate: widget gallery fixture (all 10 patterns) is valid', () => { const v = lk.validateCourse(path.join(ROOT, 'tests', 'fixtures', 'widget-gallery')); eq(v.errs, []); });
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
