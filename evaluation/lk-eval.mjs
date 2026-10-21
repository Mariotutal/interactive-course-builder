#!/usr/bin/env node
// Evaluation harness for interactive-course-builder (maintainer tool; not part of the skill package).
//   node evaluation/lk-eval.mjs auto <course-dir> [--name <benchmark>]   automatic checks + metrics → evaluation/results/<name>/auto.json
//                                                                          (also creates manual.json for rubric scoring if missing)
//   node evaluation/lk-eval.mjs report                                     aggregate results/*/ into evaluation/RESULTS.md
//   node evaluation/lk-eval.mjs pilot <course-dir> <export.json>... [--out <file.md>]
//                                                                          aggregate learner progress exports from a pilot (no free text)
// Automatic metrics describe the artifact. They do not measure learning; manual rubric scores and a learner pilot are needed for that.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'interactive-course-builder');
const RESULTS = path.join(ROOT, 'evaluation', 'results');
const RUBRIC = JSON.parse(fs.readFileSync(path.join(ROOT, 'evaluation', 'rubric.json'), 'utf8'));
const lk = await import(path.join(SKILL, 'scripts', 'lk.mjs'));
const LS = createRequire(import.meta.url)(path.join(SKILL, 'assets', 'runtime', 'lk-state.js'));

const words = html => String(html || '').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<pre[\s\S]*?<\/pre>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const proseOf = l => (l.blocks || []).flatMap(b => [b.html, b.limits, b.task, b.prompt, b.solution, b.model, b.result, b.instructions, b.debrief, ...(b.steps || []).flatMap(s => [s.prompt, s.html]), ...(b.questions || []).flatMap(q => [q.prompt, q.explanation, ...Object.values(q.feedback || {}), q.model])]).join(' ');
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);

/* ---------------- auto ---------------- */
export function autoMetrics(dir) {
  const v = lk.validateCourse(dir);
  const res = { course: dir, date: new Date().toISOString().slice(0, 10), validate: { errors: v.errs.length, warnings: v.warns.length, errorList: v.errs.slice(0, 50), warningList: v.warns.slice(0, 50) } };
  if (!v.data) return res;
  const { course: C, lessons } = v.data;
  // Output integrity: build into a temporary directory and inspect the bundle.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-eval-')); const work = path.join(tmp, 'course'); fs.cpSync(dir, work, { recursive: true, filter: s => !/[\\/](site|markdown)([\\/]|$)/.test(path.relative(dir, s)) });
  const integrity = { built: false, problems: [] };
  if (!v.errs.length) {
    const b = lk.build(work);
    if (b.errs.length) integrity.problems.push(...b.errs);
    else {
      integrity.built = true;
      const site = path.join(work, 'site'); const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
      if (/{{[A-Z_]+}}/.test(html)) integrity.problems.push('unreplaced template placeholder in index.html');
      for (const f of ['runtime/lk-app.js', 'runtime/lk-state.js', 'runtime/lk-widgets.js', 'runtime/lk.css', 'content.js']) if (!fs.existsSync(path.join(site, f))) integrity.problems.push('missing ' + f);
      try {
        const src = fs.readFileSync(path.join(site, 'content.js'), 'utf8'); const bundle = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
        const ids = []; bundle.lessons.forEach(l => l.blocks.forEach(bk => { if (['predict', 'activity', 'practice', 'transfer', 'reflect'].includes(bk.type)) ids.push(bk.id); (bk.questions || []).forEach(q => ids.push(q.id)); }));
        const missing = ids.filter(id => !bundle.hashes[id]); if (missing.length) integrity.problems.push(`items without content hash: ${missing.slice(0, 5).join(', ')}`);
        if (bundle.lessons.length !== lessons.length) integrity.problems.push('bundle lesson count differs from course');
      } catch (e) { integrity.problems.push('content.js does not parse: ' + e.message); }
      const mdFiles = fs.readdirSync(path.join(work, 'markdown')).filter(f => /^\d\d-/.test(f)); if (mdFiles.length !== lessons.length) integrity.problems.push('markdown lesson files missing');
      for (const m of html.matchAll(/src="(widgets\/[^"]+)"/g)) if (!fs.existsSync(path.join(site, m[1]))) integrity.problems.push('missing ' + m[1]);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  res.integrity = integrity;
  // Content metrics.
  const blocks = lessons.flatMap(l => l.blocks || []);
  const qs = blocks.flatMap(b => b.type === 'check' ? b.questions : (b.type === 'predict' ? [b] : []));
  const kind = q => q.kind || (q.options ? 'mcq' : 'open');
  const mcq = qs.filter(q => kind(q) === 'mcq'); const fullFb = mcq.filter(q => q.options.every((_, i) => i === q.correct || (q.feedback && q.feedback[i])));
  const acts = blocks.filter(b => b.type === 'activity'); const patterns = [...new Set(acts.map(a => a.widget))];
  const prose = lessons.map(l => words(proseOf(l))); const totalWords = prose.reduce((a, b) => a + b, 0);
  const sources = lessons.flatMap(l => l.sources || []).concat(C.sources || []);
  const visuals = blocks.filter(b => b.type === 'visual');
  const outcomes = (C.outcomes || []).map(o => ({ id: o.id, assessedBy: (v.assessed.get(o.id) || []).length, transfer: blocks.some(b => b.type === 'transfer' && (b.assesses || []).includes(o.id)) || !!(C.capstone && (C.capstone.assesses || []).includes(o.id)) }));
  const ka = C.knowledgeArchitecture; const model = LS.conceptModel(C, lessons);
  res.metrics = {
    language: C.language, lessons: lessons.length, minutes: lessons.reduce((a, l) => a + (l.minutes || 0), 0),
    profiles: lessons.reduce((m, l) => (m[l.profile || 'full'] = (m[l.profile || 'full'] || 0) + 1, m), {}),
    words: { total: totalWords, perLesson: prose },
    activities: { count: acts.length, patterns, custom: Object.keys(v.data.customWidgets) },
    questions: { total: qs.length, byKind: qs.reduce((m, q) => (m[kind(q)] = (m[kind(q)] || 0) + 1, m), {}), mcqWithFullMisconceptionFeedbackPct: pct(fullFb.length, mcq.length) },
    practice: { guided: blocks.filter(b => b.type === 'practice' && b.level === 'guided').length, independent: blocks.filter(b => b.type === 'practice' && b.level === 'independent').length, realWorld: blocks.filter(b => b.setting === 'real-world').length },
    transfer: { tasks: blocks.filter(b => b.type === 'transfer').length, capstone: !!C.capstone, outcomesWithTransferPct: pct(outcomes.filter(o => o.transfer).length, outcomes.length) },
    outcomes: { count: outcomes.length, minAssessingItems: Math.min(...outcomes.map(o => o.assessedBy)), detail: outcomes },
    visuals: { count: visuals.length, withPurposePct: pct(visuals.filter(b => b.purpose).length, visuals.length) },
    sources: { count: sources.length, byKind: sources.reduce((m, s) => (m[s.kind] = (m[s.kind] || 0) + 1, m), {}), unverified: sources.filter(s => s.status === 'unverified').length, webWithAccessDatePct: pct(sources.filter(s => s.url && s.accessed).length, sources.filter(s => s.url).length) },
    knowledgeArchitecture: ka ? { concepts: (ka.concepts || []).length, dispositions: (ka.dispositions || []).length, hubs: (ka.hubs || []).length, conceptsWithTaggedItemsPct: pct((ka.concepts || []).filter(c => (model.conceptItems[c.id] || []).length).length, (ka.concepts || []).length) } : null,
    intake: { present: !!(C.learner && C.learner.intake), decisions: (C.learner && Array.isArray(C.learner.decisions)) ? C.learner.decisions.length : 0 },
    theme: C.theme || null,
    // Density: a richer course has more thinking per word, not more words.
    density: { interactionsPer1000Words: totalWords ? Math.round(10000 * (acts.length + qs.length) / totalWords) / 10 : null, assessmentItemsPerOutcome: outcomes.length ? Math.round(10 * outcomes.reduce((a, o) => a + o.assessedBy, 0) / outcomes.length) / 10 : null },
  };
  return res;
}
export function manualTemplate(name) {
  return { benchmark: name, reviewer: '', date: '', independent: false, note: 'Fill in a score (0, 1 or 2) and a rationale citing lessons for every criterion. Set independent: true only if the reviewer did not author or generate the course or the tool.', scores: Object.fromEntries(RUBRIC.criteria.map(c => [c.id, { score: null, rationale: '' }])) };
}

/* ---------------- report ---------------- */
export function checkManual(m) {
  const problems = []; if (!m.reviewer) problems.push('reviewer is empty');
  for (const c of RUBRIC.criteria) { const s = (m.scores || {})[c.id]; if (!s || s.score == null) { problems.push(`${c.id}: not scored`); continue; } if (![0, 1, 2].includes(s.score)) problems.push(`${c.id}: score must be 0, 1 or 2`); if (!s.rationale || s.rationale.length < 20) problems.push(`${c.id}: rationale must cite evidence (≥ 20 characters)`); }
  return problems;
}
export function report({ results = RESULTS, out = path.join(ROOT, 'evaluation', 'RESULTS.md') } = {}) {
  const names = fs.existsSync(results) ? fs.readdirSync(results).filter(n => fs.existsSync(path.join(results, n, 'auto.json'))).sort() : [];
  let md = `# Evaluation results\n\nGenerated ${new Date().toISOString().slice(0, 10)} by \`evaluation/lk-eval.mjs report\`. Rubric: \`evaluation/rubric.json\` (0 = absent or wrong, 1 = weak, 2 = solid).\n\n**Read this first.** Automatic metrics describe the course artifact; they do not measure learning. Manual scores marked *self-review* were given by the tool's author or the model that generated the course and are not independent evidence. Only a learner pilot (\`evaluation/PILOT.md\`) can show learning outcomes.\n\n`;
  md += `## Automatic checks\n\n| Benchmark | Lang | Validate (errors / warnings) | Built and intact | Lessons (min) | Words | Activities (patterns) | Questions | MCQ with full misconception feedback | Outcomes with transfer | Sources (unverified) | Interactions / 1000 words | Knowledge architecture |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const manualRows = [];
  for (const n of names) {
    const a = JSON.parse(fs.readFileSync(path.join(results, n, 'auto.json'), 'utf8')); const m = a.metrics || {};
    md += `| ${n} | ${m.language || '—'} | ${a.validate.errors} / ${a.validate.warnings} | ${a.integrity && a.integrity.built && !a.integrity.problems.length ? 'yes' : 'no' + (a.integrity && a.integrity.problems.length ? ` (${a.integrity.problems.length} problems)` : '')} | ${m.lessons} (${m.minutes}) | ${m.words ? m.words.total : '—'} | ${m.activities ? `${m.activities.count} (${m.activities.patterns.join(', ') || '—'})` : '—'} | ${m.questions ? m.questions.total : '—'} | ${m.questions ? (m.questions.mcqWithFullMisconceptionFeedbackPct ?? '—') + ' %' : '—'} | ${m.transfer ? (m.transfer.outcomesWithTransferPct ?? '—') + ' %' : '—'} | ${m.sources ? `${m.sources.count} (${m.sources.unverified})` : '—'} | ${m.density ? m.density.interactionsPer1000Words : '—'} | ${m.knowledgeArchitecture ? `${m.knowledgeArchitecture.concepts} concepts, ${m.knowledgeArchitecture.dispositions} dispositions` : 'no'} |\n`;
    const mf = path.join(results, n, 'manual.json'); if (fs.existsSync(mf)) manualRows.push([n, JSON.parse(fs.readFileSync(mf, 'utf8'))]);
  }
  md += `\n## Manual rubric scores\n\n| Benchmark | Reviewer | Independent | ${RUBRIC.criteria.map(c => c.label).join(' | ')} | Total /${RUBRIC.criteria.length * 2} |\n|---|---|---|${RUBRIC.criteria.map(() => '---').join('|')}|---|\n`;
  for (const [n, m] of manualRows) {
    const problems = checkManual(m); const sc = RUBRIC.criteria.map(c => ((m.scores || {})[c.id] || {}).score); const complete = !problems.length;
    md += `| ${n} | ${m.reviewer || '—'} | ${m.independent ? 'yes' : 'no (self-review)'} | ${sc.map(s => (s == null ? '—' : s)).join(' | ')} | ${complete ? sc.reduce((a, b) => a + b, 0) : 'incomplete'} |\n`;
  }
  md += `\n### Rationales\n\n`;
  for (const [n, m] of manualRows) { md += `#### ${n}\n\n`; const problems = checkManual(m); if (problems.length) md += `*Incomplete: ${problems.join('; ')}.*\n\n`; for (const c of RUBRIC.criteria) { const s = (m.scores || {})[c.id] || {}; if (s.score != null) md += `- **${c.label} (${s.score})**: ${s.rationale}\n`; } md += '\n'; }
  fs.writeFileSync(out, md);
  return { names, md };
}

/* ---------------- pilot ---------------- */
export function pilot(dir, files) {
  const v = lk.validateCourse(dir); if (!v.data) throw new Error('course does not load: ' + v.errs.join('; '));
  const { course: C, lessons } = v.data; const model = LS.conceptModel(C, lessons); const accepted = []; const rejected = [];
  for (const f of files) { try { const r = LS.clean(JSON.parse(fs.readFileSync(f, 'utf8')), C.id); accepted.push(r.state); } catch (e) { rejected.push(`${path.basename(f)}: ${e.message}`); } }
  const n = accepted.length; const qOf = l => (l.blocks || []).flatMap(b => b.type === 'check' ? b.questions : (b.type === 'predict' && b.options ? [b] : [])).filter(q => (q.kind || (q.options ? 'mcq' : 'open')) !== 'open');
  const lessonRows = lessons.map(l => { const qs = qOf(l); const tried = qs.flatMap(q => accepted.map(s => s.items[q.id]).filter(Boolean)); const conf = accepted.map(s => s.confidence[l.id]).filter(Boolean);
    return { lesson: l.id, visitedPct: pct(accepted.filter(s => s.visited[l.id]).length, n), questionsAnswered: tried.length, firstAttemptCorrectPct: pct(tried.filter(r => r.correctFirst).length, tried.length), confidence: [1, 2, 3, 4].map(k => conf.filter(c => c === k).length) }; });
  const items = lessons.flatMap(l => (l.blocks || []).flatMap(b => b.type === 'check' ? b.questions : []));
  const outcomeRows = (C.outcomes || []).map(o => { const its = items.filter(q => (q.assesses || []).includes(o.id) && (q.kind || (q.options ? 'mcq' : 'open')) !== 'open'); const tried = its.flatMap(q => accepted.map(s => s.items[q.id]).filter(Boolean)); return { outcome: o.id, text: o.text, answers: tried.length, firstAttemptCorrectPct: pct(tried.filter(r => r.correctFirst).length, tried.length) }; });
  const openIds = lessons.flatMap(l => (l.blocks || []).filter(b => b.type === 'transfer').map(b => b.id)).concat(C.capstone ? [C.capstone.id] : []);
  const transferRows = openIds.map(id => ({ id, writtenPct: pct(accepted.filter(s => s.texts[id] && s.texts[id].v.trim().length >= 20).length, n) }));
  const conceptRows = model ? model.concepts.map(c => { const ev = accepted.flatMap(s => (s.concepts[c.id] || { events: [] }).events); return { concept: c.id, learnersIntroduced: accepted.filter(s => s.concepts[c.id]).length, retrievals: ev.length, successPct: pct(ev.filter(e => e.ok).length, ev.length) }; }) : [];
  let md = `# Pilot summary — ${C.title}\n\nLearner exports accepted: **${n}**${rejected.length ? `; rejected: ${rejected.length} (${rejected.join('; ')})` : ''}. Free-text answers are not included; only counts.\n\n> Small, self-selected samples cannot establish effectiveness. Report N, recruitment and dates with any result, and pair these numbers with the rubric review and learners' own feedback.\n\n`;
  md += `## Lessons\n\n| Lesson | Visited | Auto-checked answers | First-attempt correct | Confidence (lost / shaky / fairly sure / could teach) |\n|---|---|---|---|---|\n${lessonRows.map(r => `| ${r.lesson} | ${r.visitedPct ?? '—'} % | ${r.questionsAnswered} | ${r.firstAttemptCorrectPct ?? '—'} % | ${r.confidence.join(' / ')} |`).join('\n')}\n\n`;
  md += `## Outcomes (first attempts on auto-checked questions that assess them)\n\n| Outcome | Answers | First-attempt correct |\n|---|---|---|\n${outcomeRows.map(r => `| ${r.outcome}: ${r.text} | ${r.answers} | ${r.firstAttemptCorrectPct ?? '—'} % |`).join('\n')}\n\n`;
  md += `## Transfer and capstone responses written (≥ 20 characters)\n\n${transferRows.map(r => `- ${r.id}: ${r.writtenPct ?? '—'} %`).join('\n') || '- none'}\n\nScore a sample of these responses with the lesson rubrics; the counts above say nothing about quality.\n`;
  if (conceptRows.length) md += `\n## Concept retrievals\n\n| Concept | Learners introduced | Retrievals | Successful |\n|---|---|---|---|\n${conceptRows.map(r => `| ${r.concept} | ${r.learnersIntroduced} | ${r.retrievals} | ${r.successPct ?? '—'} % |`).join('\n')}\n`;
  return { n, rejected, lessonRows, outcomeRows, transferRows, conceptRows, md };
}

/* ---------------- CLI ---------------- */
function main(argv) {
  const [cmd, ...rest] = argv; const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  if (cmd === 'auto') {
    const dir = rest[0]; const name = opt('--name') || path.basename(path.resolve(dir)); const out = path.join(RESULTS, name); fs.mkdirSync(out, { recursive: true });
    const r = autoMetrics(dir); fs.writeFileSync(path.join(out, 'auto.json'), JSON.stringify(r, null, 2) + '\n');
    if (!fs.existsSync(path.join(out, 'manual.json'))) fs.writeFileSync(path.join(out, 'manual.json'), JSON.stringify(manualTemplate(name), null, 2) + '\n');
    console.log(`${name}: validate ${r.validate.errors} error(s) / ${r.validate.warnings} warning(s); built: ${r.integrity ? r.integrity.built && !r.integrity.problems.length : false}. Wrote ${path.relative(ROOT, out)}/auto.json`);
    return r.validate.errors || (r.integrity && r.integrity.problems.length) ? 1 : 0;
  }
  if (cmd === 'report') { const r = report(); console.log(`Wrote evaluation/RESULTS.md (${r.names.length} benchmark(s)).`); return 0; }
  if (cmd === 'pilot') { const dir = rest[0]; const files = rest.slice(1).filter((f, i, a) => f !== '--out' && a[i - 1] !== '--out'); const r = pilot(dir, files); const out = opt('--out'); if (out) fs.writeFileSync(out, r.md); else console.log(r.md); return 0; }
  console.log('Usage: node evaluation/lk-eval.mjs <auto <course-dir> [--name n] | report | pilot <course-dir> <export.json>... [--out file]>'); return cmd ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
