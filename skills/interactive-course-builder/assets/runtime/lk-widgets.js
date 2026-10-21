/* Learning kit interaction patterns. Each is configured entirely by course data (see references/activities.md).
   Courses may add their own with LK.registerWidget(name, { title, kind, mount(el, config, api) }). */
(function () {
  'use strict';
  const LK = (window.LK = window.LK || {});
  LK.widgets = LK.widgets || {};
  LK.registerWidget = (name, def) => { LK.widgets[name] = def; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s, accents) => { let x = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[¿?¡!.,;:"]/g, ''); if (!accents) x = x.normalize('NFD').replace(/[̀-ͯ]/g, ''); return x; };
  const header = (cfg, api, kind) => `<p class="w-title" data-kicker="${esc(api.t(kind))}">${esc(cfg.title || '')}</p>${cfg.intro ? `<div>${cfg.intro}</div>` : ''}`;
  const note = (cfg, api) => (cfg.assumptions && cfg.assumptions.length) ? `<div class="w-note"><strong>${esc(api.t('modelNote'))}:</strong><ul>${cfg.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '';
  const once = api => { let done = false; return data => { if (!done) { done = true; api.record(data || { touched: true }); } }; };
  const keepFocus = (el, sel, fn) => { fn(); const f = el.querySelector(sel); if (f) f.focus(); };

  /* 1. Parameter explorer: inputs → computed outputs, optional chart and interpretation rules. */
  LK.registerWidget('parameter-explorer', {
    title: 'Parameter explorer', kind: 'w_explore',
    mount(el, cfg, api) {
      const E = api.expr; const vals = {}; (cfg.inputs || []).forEach(i => { vals[i.id] = i.value; });
      const touch = once(api); const fmt = (v, f = {}) => !isFinite(v) ? '—' : f.percent ? api.fmt(v * 100, f.digits != null ? f.digits : 1) + ' %' : api.fmt(v, f.digits != null ? f.digits : 2);
      function chart() {
        const c = cfg.chart; if (!c) return '';
        const W = 720, H = 310, pad = { l: 52, r: 18, t: 18, b: 40 };
        const steps = c.x.steps || 120; const xs = []; for (let k = 0; k <= steps; k++) xs.push(c.x.from + (c.x.to - c.x.from) * k / steps);
        const ser = (c.series || []).map(s => ({ s, pts: xs.map(x => { const v = E.evaluate(s.expr, Object.assign({}, vals, { [c.x.var || 'x']: x })); return [x, v]; }).filter(p => isFinite(p[1])) }));
        const ys = ser.flatMap(r => r.pts.map(p => p[1])); let y0 = c.y && c.y.from != null ? c.y.from : Math.min(0, ...ys), y1 = c.y && c.y.to != null ? c.y.to : Math.max(...ys); if (y1 === y0) y1 = y0 + 1;
        const X = x => pad.l + (x - c.x.from) / (c.x.to - c.x.from) * (W - pad.l - pad.r); const Y = y => H - pad.b - (y - y0) / (y1 - y0) * (H - pad.t - pad.b);
        const paths = ser.map((r, i) => `<path class="${i ? 'line2' : 'line'}" d="${r.pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ')}"/>`).join('');
        const marks = (c.markers || []).map(m => { const xv = E.evaluate(m.x, vals); if (!isFinite(xv)) return ''; return `<line x1="${X(xv)}" x2="${X(xv)}" y1="${pad.t}" y2="${H - pad.b}" class="axis" stroke-dasharray="3 3"/><text x="${X(xv) + 3}" y="${pad.t + 10}">${esc(m.label)} ${fmt(xv, m.format)}</text>`; }).join('');
        const currentX = c.current && E.evaluate(c.current.x, vals);
        const current = c.current && isFinite(currentX) && currentX >= c.x.from && currentX <= c.x.to
          ? `<line x1="${X(currentX)}" x2="${X(currentX)}" y1="${pad.t}" y2="${H - pad.b}" class="axis" stroke-dasharray="4 4"/>${ser.map((r, i) => { const y = E.evaluate(r.s.expr, Object.assign({}, vals, { [c.x.var || 'x']: currentX })); return isFinite(y) ? `<circle class="chart-point ${i ? 'second' : ''}" cx="${X(currentX)}" cy="${Y(y)}" r="6"/>` : ''; }).join('')}` : '';
        const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => { const xv = c.x.from + f * (c.x.to - c.x.from); return `<text x="${X(xv)}" y="${H - pad.b + 16}" text-anchor="middle">${api.fmt(+xv.toFixed(2), Number.isInteger(+xv.toFixed(2)) ? 0 : 2)}</text>`; }).join('') + [0, 0.5, 1].map(f => { const yv = y0 + f * (y1 - y0); return `<text x="${pad.l - 6}" y="${Y(yv) + 4}" text-anchor="end">${(+yv.toPrecision(3)).toLocaleString(api.lang)}</text>`; }).join('');
        const legend = ser.map((r, i) => `${i ? '- - -' : '———'} ${esc(r.s.label)}`).join(' · ');
        const reading = current ? `${esc(c.current.label || c.xLabel || '')}: ${fmt(currentX)} · ${ser.map(r => { const y = E.evaluate(r.s.expr, Object.assign({}, vals, { [c.x.var || 'x']: currentX })); return `${esc(r.s.label)}: ${fmt(y)}`; }).join(' · ')}` : '';
        return `<figure style="margin:8px 0"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.ariaLabel || cfg.title || '')}"><line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}"/><line class="axis" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${H - pad.b}"/>${paths}${marks}${current}${ticks}<text x="${W / 2}" y="${H - 4}" text-anchor="middle">${esc(c.xLabel || '')}</text></svg><figcaption>${legend}${c.yLabel ? ' · ' + esc(c.yLabel) : ''}${reading ? `<br><strong>${reading}</strong>` : ''}</figcaption></figure>`;
      }
      function render() {
        let outs = '', interp = '';
        try {
          outs = (cfg.outputs || []).map(o => `<tr><th>${esc(o.label)}</th><td><strong>${fmt(E.evaluate(o.expr, vals), o.format)}</strong>${o.unit ? ' ' + esc(o.unit) : ''}</td></tr>`).join('');
          interp = (cfg.interpret || []).filter(r => E.evaluate(r.when, vals)).map(r => `<p class="status-${r.tone || 'ok'}">${r.html}</p>`).join('');
        } catch (e) { outs = `<tr><td class="status-bad">${esc(e.message)}</td></tr>`; }
        el.innerHTML = header(cfg, api, 'w_explore') + `<div class="w-controls">${(cfg.inputs || []).map(i => `<label>${esc(i.label)} <span><input type="range" min="${i.min}" max="${i.max}" step="${i.step || 1}" value="${vals[i.id]}" data-in="${esc(i.id)}" aria-label="${esc(i.label)}"> <input type="number" min="${i.min}" max="${i.max}" step="${i.step || 1}" value="${vals[i.id]}" data-num="${esc(i.id)}" aria-label="${esc(i.label)}" style="width:6em"> ${esc(i.unit || '')}</span></label>`).join('')}</div>
          ${chart()}<div class="w-out" aria-live="polite"><table><tbody>${outs}</tbody></table>${interp}</div>${note(cfg, api)}`;
        el.querySelectorAll('[data-in],[data-num]').forEach(inp => inp.oninput = inp.onchange = () => { const id = inp.dataset.in || inp.dataset.num; const def = cfg.inputs.find(i => i.id === id); let v = parseFloat(inp.value); if (!isFinite(v)) return; v = Math.min(def.max, Math.max(def.min, v)); vals[id] = v; touch(); keepFocus(el, inp.dataset.in ? `[data-in="${id}"]` : `[data-num="${id}"]`, render); });
      }
      render();
    },
  });

  /* 2. Evidence case: choose evidence to reveal, then choose the best-supported conclusion. */
  LK.registerWidget('evidence-case', {
    title: 'Evidence case', kind: 'w_investigate',
    mount(el, cfg, api) {
      let seen = [], pick = null; const touch = once(api);
      function render() {
        const key = (cfg.evidence || []).filter(x => x.key).map(x => x.id);
        const c = pick && cfg.conclusions.find(x => x.id === pick);
        const verdictClass = { best: 'status-ok', defensible: 'status-warn', weak: 'status-bad', wrong: 'status-bad' };
        el.innerHTML = header(cfg, api, 'w_investigate') + `<div class="callout warn">${cfg.situation || ''}</div>
          <div class="row" role="group">${cfg.evidence.map(x => `<button type="button" class="btn small" data-ev="${esc(x.id)}" aria-pressed="${seen.includes(x.id)}">${seen.includes(x.id) ? '✓ ' : ''}${esc(x.label)}</button>`).join('')}</div>
          <div aria-live="polite">${seen.map(id => { const x = cfg.evidence.find(e => e.id === id); return `<div class="evidence"><p class="small"><strong>${esc(x.label)}</strong>${x.source ? ' · ' + esc(x.source) : ''}</p>${x.terminal ? `<div class="term" data-label="${esc(cfg.terminalLabel || api.t('illustrative'))}">${esc(x.content)}</div>` : x.content}${x.reading ? `<p><strong>→</strong> ${x.reading}</p>` : ''}</div>`; }).join('')}</div>
          <h4>${esc(cfg.question || '')}</h4><div style="display:grid;gap:6px">${cfg.conclusions.map(x => `<button type="button" class="btn" style="justify-content:flex-start" data-co="${esc(x.id)}" aria-pressed="${pick === x.id}">${esc(x.label)}</button>`).join('')}</div>
          <div class="w-out" aria-live="polite">${c ? `<p class="${verdictClass[c.verdict] || ''}">${esc((cfg.verdictLabels || {})[c.verdict] || api.t('w_v_' + c.verdict))}</p><p>${c.explanation}</p>${key.filter(k => !seen.includes(k)).length ? `<p class="small">${esc(cfg.missingLabel || api.t('w_missing'))} ${key.filter(k => !seen.includes(k)).map(k => esc(cfg.evidence.find(e => e.id === k).label)).join(', ')}</p>` : ''}${c.verdict === 'best' || c.verdict === 'defensible' ? cfg.debrief || '' : ''}` : ''}</div>${note(cfg, api)}`;
        el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { if (!seen.includes(b.dataset.ev)) seen.push(b.dataset.ev); touch(); keepFocus(el, `[data-ev="${b.dataset.ev}"]`, render); });
        el.querySelectorAll('[data-co]').forEach(b => b.onclick = () => { pick = b.dataset.co; api.record({ evidence: seen.slice(), conclusion: pick }); keepFocus(el, `[data-co="${pick}"]`, render); });
      }
      render();
    },
  });

  /* 3. Branching scenario. */
  LK.registerWidget('scenario', {
    title: 'Scenario', kind: 'w_decide',
    mount(el, cfg, api) {
      let path = [{ node: cfg.start }];
      function render() {
        const cur = cfg.nodes[path[path.length - 1].node];
        const q = { good: 'status-ok', ok: 'status-warn', poor: 'status-bad' };
        el.innerHTML = header(cfg, api, 'w_decide') + `<ol>${path.slice(0, -1).map(p => { const n = cfg.nodes[p.node]; const ch = n.choices[p.choice]; return `<li><span class="small">${n.title ? esc(n.title) + ': ' : ''}</span>${esc(ch.label)} <div class="${q[ch.quality] || ''} small">${ch.feedback || ''}</div></li>`; }).join('')}</ol>
          <div class="card">${cur.html}${cur.end ? `<div class="w-out">${cur.debrief || ''}</div><button type="button" class="btn small" data-restart>${esc(api.t('reset1'))}</button>` : `<div style="display:grid;gap:6px">${cur.choices.map((c, i) => `<button type="button" class="btn" style="justify-content:flex-start" data-ch="${i}">${esc(c.label)}</button>`).join('')}</div>`}</div>${note(cfg, api)}`;
        el.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { const i = +b.dataset.ch; path[path.length - 1].choice = i; path.push({ node: cur.choices[i].next }); api.record({ path: path.map(p => [p.node, p.choice]) }); keepFocus(el, '[data-ch], [data-restart]', render); });
        const r = el.querySelector('[data-restart]'); if (r) r.onclick = () => { path = [{ node: cfg.start }]; keepFocus(el, '[data-ch]', render); };
      }
      render();
    },
  });

  /* 4. Classify items into categories (keyboard-friendly selects instead of drag-and-drop). */
  LK.registerWidget('classify', {
    title: 'Classify', kind: 'w_classify',
    mount(el, cfg, api) {
      const ans = {}; let checked = false;
      function render() {
        const right = cfg.items.filter(it => ans[it.id] === it.category).length;
        el.innerHTML = header(cfg, api, 'w_classify') + cfg.items.map(it => { const ok = ans[it.id] === it.category; return `<div class="classify-row"><div>${it.html}${checked ? `<div class="small ${ok ? 'status-ok' : 'status-bad'}">${ok ? '' : esc(cfg.categories.find(c => c.id === it.category).label) + '. '}${it.feedback || ''}</div>` : ''}</div><select data-it="${esc(it.id)}" aria-label="${esc(api.t('yourAnswer'))}"><option value="">—</option>${cfg.categories.map(c => `<option value="${esc(c.id)}" ${ans[it.id] === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>`; }).join('')
          + `<div class="row" style="margin-top:8px"><button type="button" class="btn small" data-check>${esc(api.t('check'))}</button></div><div class="w-out" aria-live="polite">${checked ? `<p>${right}/${cfg.items.length}</p>${cfg.debrief || ''}` : ''}</div>${note(cfg, api)}`;
        el.querySelectorAll('[data-it]').forEach(s => s.onchange = () => { ans[s.dataset.it] = s.value; checked = false; keepFocus(el, `[data-it="${s.dataset.it}"]`, render); });
        el.querySelector('[data-check]').onclick = () => { checked = true; api.record({ answers: Object.assign({}, ans) }); keepFocus(el, '[data-check]', render); };
      }
      render();
    },
  });

  /* 5. Timeline with tags, certainty status and an optional ordering challenge. */
  LK.registerWidget('timeline', {
    title: 'Timeline', kind: 'w_explore',
    mount(el, cfg, api) {
      let tag = '', sel = null, orderAns = {}, orderChecked = false; const touch = once(api);
      const statusLabel = cfg.statusLabels || { established: api.t('w_established'), contested: api.t('w_contested'), uncertain: api.t('w_uncertain') };
      function render() {
        const tags = [...new Set(cfg.events.flatMap(e => e.tags || []))];
        const evs = cfg.events.filter(e => !tag || (e.tags || []).includes(tag)).sort((a, b) => a.sortKey - b.sortKey);
        const oc = cfg.orderingChallenge; let ocHtml = '';
        if (oc) {
          const items = oc.eventIds.map(id => cfg.events.find(e => e.id === id)); const correct = items.slice().sort((a, b) => a.sortKey - b.sortKey).map(e => e.id);
          ocHtml = `<h4>${esc(oc.prompt)}</h4>${oc.shuffled.map(id => { const e = cfg.events.find(x => x.id === id); const ok = orderChecked && +orderAns[id] === correct.indexOf(id) + 1; return `<div class="classify-row"><div>${esc(e.title)}${orderChecked ? ` <span class="small ${ok ? 'status-ok' : 'status-bad'}">${ok ? '' : '→ ' + (correct.indexOf(id) + 1)}</span>` : ''}</div><select data-ord="${esc(id)}" aria-label="${esc(e.title)}"><option value="">—</option>${items.map((_, k) => `<option ${+orderAns[id] === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></div>`; }).join('')}<button type="button" class="btn small" data-ordcheck style="margin-top:6px">${esc(api.t('check'))}</button>${orderChecked && oc.debrief ? `<div class="w-out">${oc.debrief}</div>` : ''}`;
        }
        const e = sel && cfg.events.find(x => x.id === sel);
        el.innerHTML = header(cfg, api, 'w_explore') + (tags.length ? `<div class="row" role="group"><button type="button" class="btn small" data-tag="" aria-pressed="${!tag}">*</button>${tags.map(x => `<button type="button" class="btn small" data-tag="${esc(x)}" aria-pressed="${tag === x}">${esc(x)}</button>`).join('')}</div>` : '')
          + `<ol class="timeline-list">${evs.map(x => `<li class="${esc(x.status || '')}"><button type="button" class="btn small" data-ev="${esc(x.id)}" aria-pressed="${sel === x.id}"><strong>${esc(x.date)}</strong>&nbsp;${esc(x.title)}</button>${x.status && x.status !== 'established' ? `<span class="pill">${esc(statusLabel[x.status] || x.status)}</span>` : ''}</li>`).join('')}</ol>
          <div class="w-out" aria-live="polite">${e ? `<h4 style="margin-top:0">${esc(e.date)} · ${esc(e.title)}</h4>${e.html}${(e.sources || []).length ? `<p class="small">${e.sources.map(esc).join(' · ')}</p>` : ''}` : ''}</div>${ocHtml}${note(cfg, api)}`;
        el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { tag = b.dataset.tag; keepFocus(el, `[data-tag="${tag}"]`, render); });
        el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { sel = b.dataset.ev; touch(); keepFocus(el, `[data-ev="${sel}"]`, render); });
        el.querySelectorAll('[data-ord]').forEach(s => s.onchange = () => { orderAns[s.dataset.ord] = s.value; orderChecked = false; keepFocus(el, `[data-ord="${s.dataset.ord}"]`, render); });
        const oc2 = el.querySelector('[data-ordcheck]'); if (oc2) oc2.onclick = () => { orderChecked = true; api.record({ order: Object.assign({}, orderAns) }); keepFocus(el, '[data-ordcheck]', render); };
      }
      if (cfg.orderingChallenge && !cfg.orderingChallenge.shuffled) { const ids = cfg.orderingChallenge.eventIds.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; } cfg.orderingChallenge.shuffled = ids; }
      render();
    },
  });

  /* 6. Source comparison with guided open questions (rubric + model answer). */
  LK.registerWidget('source-compare', {
    title: 'Source comparison', kind: 'w_analyze',
    mount(el, cfg, api) {
      const touch = once(api);
      el.innerHTML = header(cfg, api, 'w_analyze') + `<div class="src-grid">${cfg.sources.map(s => `<div class="src-card"><h4 style="margin-top:0">${esc(s.title)}</h4><p class="small">${[s.author, s.date, s.type].filter(Boolean).map(esc).join(' · ')}</p>${s.provenance ? `<p class="small"><strong>${esc(cfg.provenanceLabel || api.t('w_provenance'))}:</strong> ${esc(s.provenance)}</p>` : ''}<blockquote>${s.excerpt}</blockquote>${s.translation ? `<details><summary>${esc(api.t('showTranslation'))}</summary>${s.translation}</details>` : ''}${s.note ? `<p class="small">${s.note}</p>` : ''}${s.citation ? `<p class="small">${esc(s.citation)}</p>` : ''}</div>`).join('')}</div>`
        + (cfg.questions || []).map((q, i) => `<div class="q"><div class="q-text">${q.prompt}</div><label class="sr-only" for="sc-${esc(api.id)}-${i}">${esc(api.t('yourAnswer'))}</label><textarea id="sc-${esc(api.id)}-${i}" data-text="${esc(api.id)}:${esc(q.id || i)}" placeholder="${esc(api.t('writeFirst'))}"></textarea>${q.rubric ? `<ul class="rubric small">${q.rubric.map(r => `<li>□ ${r}</li>`).join('')}</ul>` : ''}<details><summary>${esc(api.t('showModel'))}</summary>${q.model || ''}</details></div>`).join('') + note(cfg, api);
      el.querySelectorAll('textarea').forEach(ta => { ta.addEventListener('input', () => touch({ wrote: true })); });
      // Restore saved texts (stored by the app's global input handler).
      try { const st = window.LK.app && window.LK.app.state(); if (st) el.querySelectorAll('textarea[data-text]').forEach(ta => { const r = st.texts[ta.dataset.text]; if (r) ta.value = r.v; }); } catch (e) { /* state not ready */ }
    },
  });

  /* 7. Dialogue with optional speech synthesis, comprehension checks and production prompts. */
  LK.registerWidget('dialogue', {
    title: 'Dialogue', kind: 'w_listen',
    mount(el, cfg, api) {
      const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      let showTr = false; const comp = {}; const prod = {}; const touch = once(api);
      const say = text => { if (!canSpeak) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = cfg.voiceLang || cfg.targetLang || 'es-ES'; u.rate = cfg.rate || 0.9; speechSynthesis.speak(u); };
      function render() {
        el.innerHTML = header(cfg, api, 'w_listen') + `<div class="row"><button type="button" class="btn small" data-tr aria-pressed="${showTr}">${esc(api.t(showTr ? 'hideTranslation' : 'showTranslation'))}</button>${canSpeak ? `<button type="button" class="btn small" data-all>▶ ${esc(api.t('play'))}</button>` : `<span class="small">${esc(api.t('noAudio'))}</span>`}</div>
          <div class="dialogue">${cfg.lines.map((l, i) => `<div class="line"><div class="who">${esc(l.speaker)}</div><div><div lang="${esc(cfg.targetLang || '')}">${esc(l.text)}</div>${showTr && l.translation ? `<div class="tr">${esc(l.translation)}</div>` : ''}${l.note ? `<div class="small">${l.note}</div>` : ''}</div>${canSpeak ? `<button type="button" class="btn small" data-say="${i}" aria-label="${esc(api.t('play'))}: ${esc(l.text)}">▶</button>` : '<span></span>'}</div>`).join('')}</div>
          ${(cfg.comprehension || []).map((q, qi) => `<div class="q"><div class="q-text">${q.prompt}</div><div class="opts">${q.options.map((o, oi) => { const cls = comp[qi] == null ? '' : oi === q.correct ? 'correct' : oi === comp[qi] ? 'wrong' : ''; return `<button type="button" class="opt ${cls}" data-cq="${qi}" data-i="${oi}" aria-pressed="${comp[qi] === oi}">${o}</button>`; }).join('')}</div>${comp[qi] != null ? `<div class="fb">${comp[qi] === q.correct ? `<p class="status-ok">${esc(api.t('correct'))}</p>` : `<p class="status-bad">${esc(api.t('incorrect'))}</p>${(q.feedback || {})[comp[qi]] || ''}`}<div>${q.explanation || ''}</div></div>` : ''}</div>`).join('')}
          ${(cfg.production || []).map((p, pi) => { const r = prod[pi]; const ok = r != null && (p.accept || []).some(a => norm(a, p.accentSensitive) === norm(r, p.accentSensitive)); const accentOnly = r != null && !ok && (p.accept || []).some(a => norm(a, false) === norm(r, false)); return `<div class="q"><div class="q-text">${p.prompt}</div><div class="row"><input type="text" lang="${esc(cfg.targetLang || '')}" data-pr="${pi}" value="${esc(r || '')}" aria-label="${esc(api.t('yourAnswer'))}" style="min-width:16em" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="btn small" data-prc="${pi}">${esc(api.t('check'))}</button></div>${r != null ? `<div class="fb">${ok ? `<p class="status-ok">${esc(api.t('correct'))}</p>` : accentOnly ? `<p class="status-warn">${esc(p.accentHint || api.t('w_accents'))}</p>` : `<p class="status-bad">${esc(api.t('incorrect'))}</p>`}${ok || accentOnly ? '' : (p.tips || '')}<details><summary>${esc(api.t('showModel'))}</summary><p lang="${esc(cfg.targetLang || '')}">${esc((p.accept || [])[0] || '')}</p>${p.model || ''}</details></div>` : ''}</div>`; }).join('')}${note(cfg, api)}`;
        el.querySelector('[data-tr]').onclick = () => { showTr = !showTr; keepFocus(el, '[data-tr]', render); };
        const all = el.querySelector('[data-all]'); if (all) all.onclick = () => { touch(); say(cfg.lines.map(l => l.text).join(' … ')); };
        el.querySelectorAll('[data-say]').forEach(b => b.onclick = () => { touch(); say(cfg.lines[+b.dataset.say].text); });
        el.querySelectorAll('[data-cq]').forEach(b => b.onclick = () => { comp[+b.dataset.cq] = +b.dataset.i; api.record({ comp: Object.assign({}, comp) }); keepFocus(el, `[data-cq="${b.dataset.cq}"][data-i="${b.dataset.i}"]`, render); });
        el.querySelectorAll('[data-prc]').forEach(b => b.onclick = () => { const i = +b.dataset.prc; prod[i] = el.querySelector(`[data-pr="${i}"]`).value; api.record({ prod: Object.assign({}, prod) }); keepFocus(el, `[data-pr="${i}"]`, render); });
        el.querySelectorAll('[data-pr]').forEach(inp => inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector(`[data-prc="${inp.dataset.pr}"]`).click(); } });
      }
      render();
    },
  });

  /* 8. Cloze: text with [[answer|alternative::hint]] blanks. */
  LK.registerWidget('cloze', {
    title: 'Fill the gaps', kind: 'w_produce',
    mount(el, cfg, api) {
      const blanks = []; let k = 0;
      const html = String(cfg.text).replace(/\[\[([^\]]+)\]\]/g, (_, inner) => { const [ans, hint] = inner.split('::'); blanks.push({ accept: ans.split('|'), hint }); const i = k++; return `<input type="text" data-bl="${i}" aria-label="${esc(api.t('yourAnswer'))} ${i + 1}${hint ? ' (' + esc(hint) + ')' : ''}" placeholder="${esc(hint || '')}" autocomplete="off" autocapitalize="off" spellcheck="false">`; });
      el.innerHTML = header(cfg, api, 'w_produce') + `<div class="cloze">${html}</div><div class="row" style="margin-top:8px"><button type="button" class="btn small" data-check>${esc(api.t('check'))}</button><button type="button" class="btn small" data-show>${esc(api.t('showSolution'))}</button></div><div class="w-out" aria-live="polite"></div>${note(cfg, api)}`;
      const out = el.querySelector('.w-out');
      el.querySelector('[data-check]').onclick = () => {
        let ok = 0; const res = [];
        el.querySelectorAll('[data-bl]').forEach(inp => { const b = blanks[+inp.dataset.bl]; const good = b.accept.some(a => norm(a, cfg.accentSensitive) === norm(inp.value, cfg.accentSensitive)); inp.classList.toggle('ok', good); inp.classList.toggle('bad', !good); if (good) ok++; res.push(inp.value); });
        out.innerHTML = `<p>${ok}/${blanks.length}</p>${ok === blanks.length ? (cfg.debrief || '') : (cfg.hint || '')}`; api.record({ answers: res, right: ok });
      };
      el.querySelector('[data-show]').onclick = () => { out.innerHTML = `<ol>${blanks.map(b => `<li>${esc(b.accept.join(' / '))}</li>`).join('')}</ol>${cfg.debrief || ''}`; };
    },
  });

  /* 9. Hotspot diagram: explore labelled parts of an SVG, then find them. */
  LK.registerWidget('hotspot-diagram', {
    title: 'Annotated diagram', kind: 'w_explore',
    mount(el, cfg, api) {
      let sel = null, quizI = 0, quizMsg = ''; const mode = { v: 'explore' }; const touch = once(api);
      function render() {
        el.innerHTML = header(cfg, api, 'w_explore') + `<figure style="margin:8px 0">${cfg.svg}${cfg.alt ? `<figcaption>${esc(cfg.alt)}</figcaption>` : ''}</figure>
          ${cfg.quiz ? `<div class="row" role="group"><button type="button" class="btn small" data-mode="explore" aria-pressed="${mode.v === 'explore'}">${esc(cfg.exploreLabel || api.t('w_explore'))}</button><button type="button" class="btn small" data-mode="quiz" aria-pressed="${mode.v === 'quiz'}">${esc(cfg.quizLabel || api.t('w_findit'))}</button></div>` : ''}
          ${mode.v === 'quiz' ? `<p><strong>${esc(cfg.quiz[quizI % cfg.quiz.length].ask)}</strong></p>` : ''}
          <div class="hotspot-list" role="group">${cfg.hotspots.map(h => `<button type="button" class="btn small" data-hs="${esc(h.id)}" aria-pressed="${sel === h.id}">${esc(h.label)}</button>`).join('')}</div>
          <div class="w-out" aria-live="polite">${mode.v === 'quiz' ? quizMsg : (sel ? cfg.hotspots.find(h => h.id === sel).html : '')}</div>${note(cfg, api)}`;
        el.querySelectorAll('svg [id]').forEach(n => n.classList.remove('hl'));
        const target = sel && cfg.hotspots.find(h => h.id === sel); if (target && target.target && mode.v === 'explore') { const n = el.querySelector('#' + CSS.escape(target.target)); if (n) n.classList.add('hl'); }
        el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode.v = b.dataset.mode; quizMsg = ''; keepFocus(el, `[data-mode="${mode.v}"]`, render); });
        el.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => {
          touch();
          if (mode.v === 'quiz') { const q = cfg.quiz[quizI % cfg.quiz.length]; const ok = b.dataset.hs === q.answer; quizMsg = ok ? `<p class="status-ok">${esc(api.t('correct'))}</p>${q.feedback || ''}` : `<p class="status-bad">${esc(api.t('incorrect'))}</p>${(q.wrong || {})[b.dataset.hs] || ''}`; if (ok) quizI++; api.record({ quiz: quizI }); }
          else sel = b.dataset.hs;
          keepFocus(el, `[data-hs="${b.dataset.hs}"]`, render);
        });
      }
      render();
    },
  });

  /* 10. Stepper: process walkthrough with optional prediction before each step is revealed. */
  LK.registerWidget('stepper', {
    title: 'Step through', kind: 'w_walkthrough',
    mount(el, cfg, api) {
      let i = 0; const answered = {}; const touch = once(api);
      function render() {
        const s = cfg.steps[i]; const p = s.predict; const locked = p && answered[i] == null;
        el.innerHTML = header(cfg, api, 'w_walkthrough') + `<p class="small">${i + 1} / ${cfg.steps.length}</p><h4 style="margin-top:0">${esc(s.title || '')}</h4>
          ${p ? `<div class="q predict"><div class="q-text">${p.prompt}</div><div class="opts">${p.options.map((o, k) => { const cls = answered[i] == null ? '' : k === p.correct ? 'correct' : k === answered[i] ? 'wrong' : ''; return `<button type="button" class="opt ${cls}" data-p="${k}" aria-pressed="${answered[i] === k}">${o}</button>`; }).join('')}</div>${answered[i] != null ? `<div class="fb">${p.explanation || ''}</div>` : ''}</div>` : ''}
          <div aria-live="polite">${locked ? '' : s.html}</div>
          <div class="row" style="margin-top:8px"><button type="button" class="btn small" data-prev ${i === 0 ? 'disabled' : ''}>← ${esc(api.t('previous'))}</button><button type="button" class="btn small primary" data-next ${i === cfg.steps.length - 1 || locked ? 'disabled' : ''}>${esc(api.t('next'))} →</button></div>${note(cfg, api)}`;
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { answered[i] = +b.dataset.p; api.record({ answered: Object.assign({}, answered) }); keepFocus(el, '[data-next]', render); });
        el.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); keepFocus(el, '[data-prev]', render); };
        el.querySelector('[data-next]').onclick = () => { i = Math.min(cfg.steps.length - 1, i + 1); touch(); keepFocus(el, i === cfg.steps.length - 1 ? '[data-prev]' : '[data-next]', render); };
      }
      render();
    },
  });

  /* 11. Code trace: reveal a program or manifest's execution state one line at a time. */
  LK.registerWidget('code-trace', {
    title: 'Code trace', kind: 'w_walkthrough',
    mount(el, cfg, api) {
      const lines = String(cfg.code || '').split('\n'); let i = 0; const answered = {}; const touch = once(api);
      function render() {
        const s = cfg.steps[i]; const p = s.predict; const locked = p && answered[i] == null;
        const state = s.state && Object.keys(s.state).length ? JSON.stringify(s.state, null, 2) : (s.stateText || '—');
        el.innerHTML = header(cfg, api, 'w_walkthrough') + `<p class="small">${i + 1} / ${cfg.steps.length}${s.title ? ' · ' + esc(s.title) : ''}</p>
          ${p ? `<div class="q predict"><div class="q-text">${p.prompt}</div><div class="opts">${p.options.map((o, k) => { const cls = answered[i] == null ? '' : k === p.correct ? 'correct' : k === answered[i] ? 'wrong' : ''; return `<button type="button" class="opt ${cls}" data-p="${k}" aria-pressed="${answered[i] === k}">${o}</button>`; }).join('')}</div>${answered[i] != null ? `<div class="fb">${p.explanation || ''}</div>` : ''}</div>` : ''}
          <div class="trace"><pre class="trace-code" aria-label="${esc(cfg.codeLabel || 'Code')}"><code>${lines.map((line, k) => `<span class="trace-line ${k + 1 === s.line ? 'active' : ''}">${esc(line || ' ')}</span>`).join('')}</code></pre><pre class="trace-state" aria-live="polite"><code>${esc(state)}</code></pre></div>
          <div class="w-out" aria-live="polite">${locked ? '' : (s.html || '')}</div>
          <div class="row" style="margin-top:8px"><button type="button" class="btn small" data-prev ${i === 0 ? 'disabled' : ''}>← ${esc(api.t('previous'))}</button><button type="button" class="btn small primary" data-next ${i === cfg.steps.length - 1 || locked ? 'disabled' : ''}>${esc(api.t('next'))} →</button></div>${note(cfg, api)}`;
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { answered[i] = +b.dataset.p; api.record({ answered: Object.assign({}, answered) }); keepFocus(el, '[data-next]', render); });
        el.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); keepFocus(el, '[data-prev]', render); };
        el.querySelector('[data-next]').onclick = () => { i = Math.min(cfg.steps.length - 1, i + 1); touch({ step: i }); keepFocus(el, i === cfg.steps.length - 1 ? '[data-prev]' : '[data-next]', render); };
      }
      render();
    },
  });

  /* 12. System flow: show changing states in an architecture, protocol or deployment. */
  LK.registerWidget('system-flow', {
    title: 'System flow', kind: 'w_explore',
    mount(el, cfg, api) {
      let i = 0, selected = null; const answered = {}; const touch = once(api);
      const node = id => cfg.nodes.find(n => n.id === id);
      function render() {
        const s = cfg.steps[i]; const p = s.predict; const locked = p && answered[i] == null; const detail = selected && node(selected);
        el.innerHTML = header(cfg, api, 'w_explore') + `<p class="small">${i + 1} / ${cfg.steps.length}${s.event ? ' · ' + esc(s.event) : ''}</p>
          ${p ? `<div class="q predict"><div class="q-text">${p.prompt}</div><div class="opts">${p.options.map((o, k) => { const cls = answered[i] == null ? '' : k === p.correct ? 'correct' : k === answered[i] ? 'wrong' : ''; return `<button type="button" class="opt ${cls}" data-p="${k}" aria-pressed="${answered[i] === k}">${o}</button>`; }).join('')}</div>${answered[i] != null ? `<div class="fb">${p.explanation || ''}</div>` : ''}</div>` : ''}
          <div class="flow-map" role="group" aria-label="${esc(cfg.mapLabel || 'System components')}">${cfg.nodes.map(n => `<button type="button" class="flow-node ${s.active.includes(n.id) ? 'active' : ''}" data-node="${esc(n.id)}" aria-pressed="${selected === n.id}"><strong>${esc(n.label)}</strong>${n.kind ? `<small>${esc(n.kind)}</small>` : ''}</button>`).join('')}</div>
          <div class="w-out" aria-live="polite">${locked ? '' : (s.html || '')}${detail ? `<hr><h4>${esc(detail.label)}</h4>${detail.html || ''}` : ''}</div>
          <div class="row" style="margin-top:8px"><button type="button" class="btn small" data-prev ${i === 0 ? 'disabled' : ''}>← ${esc(api.t('previous'))}</button><button type="button" class="btn small primary" data-next ${i === cfg.steps.length - 1 || locked ? 'disabled' : ''}>${esc(api.t('next'))} →</button></div>${note(cfg, api)}`;
        el.querySelectorAll('[data-node]').forEach(b => b.onclick = () => { selected = b.dataset.node; touch({ selected }); keepFocus(el, `[data-node="${selected}"]`, render); });
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { answered[i] = +b.dataset.p; api.record({ answered: Object.assign({}, answered) }); keepFocus(el, '[data-next]', render); });
        el.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); keepFocus(el, '[data-prev]', render); };
        el.querySelector('[data-next]').onclick = () => { i = Math.min(cfg.steps.length - 1, i + 1); touch({ step: i }); keepFocus(el, i === cfg.steps.length - 1 ? '[data-prev]' : '[data-next]', render); };
      }
      render();
    },
  });

  /* 13. Causal map: inspect claims, mechanisms and evidence, then test a relationship. */
  LK.registerWidget('causal-map', {
    title: 'Causal map', kind: 'w_analyze',
    mount(el, cfg, api) {
      let selected = null, chosen = null; const touch = once(api);
      const node = id => cfg.nodes.find(n => n.id === id); const link = id => cfg.links.find(l => l.id === id);
      function render() {
        const q = cfg.challenge; const picked = chosen && link(chosen); const current = selected && node(selected);
        el.innerHTML = header(cfg, api, 'w_analyze') + `<div class="causal-map" role="group" aria-label="${esc(cfg.mapLabel || 'Causal map')}">${cfg.nodes.map(n => `<button type="button" class="causal-node" data-node="${esc(n.id)}" aria-pressed="${selected === n.id}"><strong>${esc(n.label)}</strong>${n.kind ? `<small>${esc(n.kind)}</small>` : ''}</button>`).join('')}</div>
          <ul class="map-links">${cfg.links.map(l => `<li><button type="button" class="btn small" data-link="${esc(l.id)}" aria-pressed="${chosen === l.id}">${esc(node(l.from).label)} → ${esc(node(l.to).label)}${l.label ? ' · ' + esc(l.label) : ''}</button></li>`).join('')}</ul>
          ${q ? `<div class="q predict"><div class="q-text">${q.prompt}</div><div class="opts">${q.options.map(id => { const l = link(id); const cls = chosen == null ? '' : id === q.correct ? 'correct' : id === chosen ? 'wrong' : ''; return `<button type="button" class="opt ${cls}" data-answer="${esc(id)}" aria-pressed="${chosen === id}">${esc(node(l.from).label)} → ${esc(node(l.to).label)}</button>`; }).join('')}</div>${chosen ? `<div class="fb">${q.explanation || ''}</div>` : ''}</div>` : ''}
          <div class="w-out" aria-live="polite">${current ? `<h4>${esc(current.label)}</h4>${current.html || ''}` : ''}${picked ? `<p><strong>${esc(node(picked.from).label)} → ${esc(node(picked.to).label)}</strong>${picked.explanation ? `<br>${picked.explanation}` : ''}</p>` : ''}</div>${note(cfg, api)}`;
        el.querySelectorAll('[data-node]').forEach(b => b.onclick = () => { selected = b.dataset.node; touch({ selected }); keepFocus(el, `[data-node="${selected}"]`, render); });
        el.querySelectorAll('[data-link]').forEach(b => b.onclick = () => { chosen = b.dataset.link; touch({ chosen }); keepFocus(el, `[data-link="${chosen}"]`, render); });
        el.querySelectorAll('[data-answer]').forEach(b => b.onclick = () => { chosen = b.dataset.answer; api.record({ chosen }); keepFocus(el, `[data-answer="${chosen}"]`, render); });
      }
      render();
    },
  });
})();
