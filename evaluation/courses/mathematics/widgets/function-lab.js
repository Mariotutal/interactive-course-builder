/* function-lab: a course-local mathematics/statistics sandbox (copy this file into your course's widgets/ folder).
   The learner predicts, changes a named parameter or computes a value, sees the consequence on a plot and a readout,
   then states a limit of the model. Expressions use the runtime's safe evaluator (api.expr); no eval.
   Author test cases (config.testCases) are checked by `lk.mjs validate` and again here at mount time.
   See references/activities.md → "function-lab" for the configuration. */
LK.registerWidget('function-lab', {
  title: 'Function lab', kind: 'w_explore',
  mount(el, cfg, api) {
    const E = api.expr; const esc = api.esc; const tr = (en, es) => (String(api.lang).startsWith('es') ? es : en);
    const vals = {}; (cfg.params || []).forEach(p => { vals[p.id] = p.value; });
    const ev = (expr, extra) => E.evaluate(expr, Object.assign({}, vals, extra || {}));
    const fmt = (v, d = 2) => (isFinite(v) ? api.fmt(v, d) : '—');
    const tasks = cfg.tasks || []; const answers = {}; let current = 0; let limitText = '';
    // Author self-check: a failing test case means the model or the expected value is wrong; show it instead of teaching it.
    const failures = (cfg.testCases || []).filter(tc => { try { const v = E.evaluate(tc.expr, Object.assign({}, vals, tc.set || {})); return !(Math.abs(v - tc.value) <= (tc.tolerance != null ? tc.tolerance : 1e-9)); } catch (e) { return true; } });
    function plot() {
      const W = 520, H = 260, pad = { l: 48, r: 12, t: 12, b: 34 }; const X = cfg.x || { from: -5, to: 5 }; const N = 160;
      const series = (cfg.curves || []).map(c => { const pts = []; for (let i = 0; i <= N; i++) { const x = X.from + (X.to - X.from) * i / N; let y; try { y = ev(c.expr, { x }); } catch (e) { y = NaN; } if (isFinite(y)) pts.push([x, y]); } return { c, pts }; });
      const ys = series.flatMap(s => s.pts.map(p => p[1])); const Y = cfg.y || {};
      let y0 = Y.from != null ? Y.from : Math.min(...ys, 0), y1 = Y.to != null ? Y.to : Math.max(...ys, 0); if (!(y1 > y0)) { y0 -= 1; y1 += 1; }
      const sx = x => pad.l + (x - X.from) / (X.to - X.from) * (W - pad.l - pad.r); const sy = y => H - pad.b - (Math.min(y1, Math.max(y0, y)) - y0) / (y1 - y0) * (H - pad.t - pad.b);
      const axes = `<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(Math.max(y0, Math.min(y1, 0)))}" y2="${sy(Math.max(y0, Math.min(y1, 0)))}"/><line class="axis" x1="${sx(Math.max(X.from, Math.min(X.to, 0)))}" x2="${sx(Math.max(X.from, Math.min(X.to, 0)))}" y1="${pad.t}" y2="${H - pad.b}"/>`;
      const ticks = [0, 0.5, 1].map(f => { const xv = X.from + f * (X.to - X.from); return `<text x="${sx(xv)}" y="${H - pad.b + 16}" text-anchor="middle">${fmt(xv, Number.isInteger(xv) ? 0 : 1)}</text>`; }).join('') + [0, 1].map(f => { const yv = y0 + f * (y1 - y0); return `<text x="${pad.l - 6}" y="${sy(yv) + 4}" text-anchor="end">${fmt(yv, 1)}</text>`; }).join('');
      const paths = series.map((s, i) => `<path class="${i ? 'line2' : 'line'}" d="${s.pts.map((p, k) => (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ')}"/>`).join('');
      const marks = (cfg.markers || []).map(m => { let xv, yv; try { xv = ev(m.x); yv = ev(m.y); } catch (e) { return ''; } return isFinite(xv) && isFinite(yv) ? `<circle class="marker" cx="${sx(xv)}" cy="${sy(yv)}" r="5"/><text x="${sx(xv) + 7}" y="${sy(yv) - 7}">${esc(m.label || '')}</text>` : ''; }).join('');
      const desc = series.map(s => { const yy = s.pts.map(p => p[1]); return yy.length ? `${s.c.label}: ${tr('from', 'de')} ${fmt(Math.min(...yy))} ${tr('to', 'a')} ${fmt(Math.max(...yy))} ${tr('for', 'para')} x ${tr('between', 'entre')} ${fmt(X.from, 1)} ${tr('and', 'y')} ${fmt(X.to, 1)}` : s.c.label; }).join('; ');
      return `<figure style="margin:8px 0"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">${axes}${paths}${marks}${ticks}<text x="${W / 2}" y="${H - 4}" text-anchor="middle">${esc((cfg.x || {}).label || 'x')}</text></svg><figcaption>${series.map((s, i) => `${i ? '- - -' : '———'} ${esc(s.c.label)}`).join(' · ')}</figcaption></figure>`;
    }
    const readouts = () => `<table><tbody>${(cfg.readouts || []).map(r => { let v; try { v = ev(r.expr); } catch (e) { v = NaN; } return `<tr><th>${esc(r.label)}</th><td><strong>${fmt(v, r.digits != null ? r.digits : 2)}</strong></td></tr>`; }).join('')}</tbody></table>`;
    function taskHtml(i) {
      const tk = tasks[i]; if (!tk) return '';
      const a = answers[tk.id] || {};
      let h = `<div class="q predict"><div class="q-label">${tr('Task', 'Tarea')} ${i + 1}/${tasks.length}</div><div class="q-text">${tk.prompt}</div>`;
      if (tk.type === 'direction') {
        const opts = [['up', tr('It increases', 'Aumenta')], ['down', tr('It decreases', 'Disminuye')], ['same', tr('It does not change', 'No cambia')]];
        h += `<div class="opts" role="group">${opts.map(([v, l]) => `<button type="button" class="opt ${a.actual ? (v === a.actual ? 'correct' : v === a.pred ? 'wrong' : '') : ''}" data-pred="${v}" aria-pressed="${a.pred === v}" ${a.pred ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
        if (a.pred && !a.actual) h += `<p class="small">${tr('Now move', 'Ahora mueve')} <strong>${esc((cfg.params.find(p => p.id === tk.param) || {}).label || tk.param)}</strong> ${tr('and watch the plot and the readout.', 'y observa la gráfica y la lectura.')}</p>`;
        if (a.actual) h += `<div class="fb" aria-live="polite">${a.pred === a.actual ? `<p class="status-ok">${esc(api.t('correct'))}</p>` : `<p class="status-bad">${esc(api.t('incorrect'))}</p>`}<p>${tr('Observed', 'Observado')}: ${fmt(a.before)} → ${fmt(a.after)}</p>${tk.explanation || ''}</div>`;
      } else if (tk.type === 'value') {
        h += `<div class="row"><label class="sr-only" for="fl-${esc(api.id)}-${i}">${esc(api.t('yourAnswer'))}</label><input type="text" inputmode="decimal" id="fl-${esc(api.id)}-${i}" data-val value="${a.input != null ? esc(a.input) : ''}" ${a.checked ? 'disabled' : ''}><button type="button" class="btn small" data-valcheck ${a.checked ? 'disabled' : ''}>${esc(api.t('check'))}</button></div>`;
        if (a.checked) h += `<div class="fb" aria-live="polite">${a.ok ? `<p class="status-ok">${esc(api.t('correct'))}</p>` : `<p class="status-bad">${esc(api.t('incorrect'))}</p>`}<p>${tr('Model value', 'Valor del modelo')}: <strong>${fmt(a.value, tk.digits != null ? tk.digits : 2)}</strong></p>${tk.explanation || ''}</div>`;
      }
      return h + '</div>';
    }
    const done = () => tasks.every(tk => answers[tk.id] && (answers[tk.id].actual || answers[tk.id].checked));
    function save() { api.record({ answers: JSON.parse(JSON.stringify(answers)), limit: limitText.slice(0, 2000) }); }
    function render(focusSel) {
      const tk = tasks[current]; const lockedParam = tk && tk.type === 'direction' && !(answers[tk.id] || {}).pred;
      el.innerHTML = `<p class="w-title" data-kicker="${esc(api.t('w_explore'))}">${esc(cfg.title || 'Function lab')}</p>${cfg.intro || ''}
        ${failures.length ? `<div class="notice"><strong>${tr('Model check failed', 'Falló la comprobación del modelo')}:</strong> ${failures.map(f => esc(f.label || f.expr)).join(', ')}. ${tr('Tell the course author; do not trust these results.', 'Avisa al autor del curso; no confíes en estos resultados.')}</div>` : ''}
        <div class="w-controls">${(cfg.params || []).map(p => { const dis = lockedParam && p.id === tk.param; return `<label>${esc(p.label)} <span><input type="range" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${vals[p.id]}" data-p="${esc(p.id)}" aria-label="${esc(p.label)}" ${dis ? 'disabled' : ''}> <input type="number" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${vals[p.id]}" data-pn="${esc(p.id)}" aria-label="${esc(p.label)}" style="width:6em" ${dis ? 'disabled' : ''}></span></label>`; }).join('')}</div>
        ${lockedParam ? `<p class="small">${tr('Make your prediction first; the slider unlocks after it.', 'Haz primero tu predicción; el control se desbloquea después.')}</p>` : ''}
        ${plot()}<div class="w-out" aria-live="polite">${readouts()}</div>
        ${taskHtml(current)}
        <div class="row" style="margin-top:6px"><button type="button" class="btn small" data-prev ${current === 0 ? 'disabled' : ''}>← ${esc(api.t('previous'))}</button><button type="button" class="btn small" data-next ${current >= tasks.length - 1 || !(answers[(tk || {}).id] && (answers[tk.id].actual || answers[tk.id].checked)) ? 'disabled' : ''}>${esc(api.t('next'))} →</button></div>
        ${done() && cfg.limitPrompt ? `<div class="q"><div class="q-text">${cfg.limitPrompt}</div><label class="sr-only" for="fl-lim-${esc(api.id)}">${esc(api.t('yourAnswer'))}</label><textarea id="fl-lim-${esc(api.id)}" data-limit>${esc(limitText)}</textarea>${cfg.limitModel ? `<details><summary>${esc(api.t('showModel'))}</summary>${cfg.limitModel}</details>` : ''}</div>` : ''}
        ${(cfg.assumptions || []).length ? `<div class="w-note"><strong>${esc(api.t('modelNote'))}:</strong><ul>${cfg.assumptions.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}`;
      el.querySelectorAll('[data-p],[data-pn]').forEach(inp => { inp.oninput = inp.onchange = () => {
        const id = inp.dataset.p || inp.dataset.pn; const def = cfg.params.find(p => p.id === id); let v = parseFloat(String(inp.value).replace(',', '.')); if (!isFinite(v)) return; v = Math.min(def.max, Math.max(def.min, v));
        const t0 = tasks[current]; const a = t0 && answers[t0.id];
        if (t0 && t0.type === 'direction' && t0.param === id && a && a.pred && !a.actual) { a.before = ev(t0.watch); vals[id] = v; a.after = ev(t0.watch); const dlt = a.after - a.before; if (Math.abs(dlt) > 1e-12) { a.actual = dlt > 0 ? 'up' : 'down'; save(); } else if (v !== def.value && t0.allowSame) { a.actual = 'same'; save(); } }
        else vals[id] = v;
        render(inp.dataset.p ? `[data-p="${id}"]` : `[data-pn="${id}"]`); }; });
      el.querySelectorAll('[data-pred]').forEach(b => b.onclick = () => { answers[tasks[current].id] = { pred: b.dataset.pred }; render(`[data-p="${tasks[current].param}"]`); });
      const vc = el.querySelector('[data-valcheck]'); if (vc) vc.onclick = () => { const t0 = tasks[current]; const inp = el.querySelector('[data-val]'); const x = parseFloat(String(inp.value).replace(',', '.')); Object.assign(vals, t0.set || {}); const value = ev(t0.expr); answers[t0.id] = { input: inp.value, checked: true, value, ok: isFinite(x) && Math.abs(x - value) <= (t0.tolerance != null ? t0.tolerance : 1e-9) }; save(); render('[data-next]'); };
      const pv = el.querySelector('[data-prev]'); pv.onclick = () => { current = Math.max(0, current - 1); render('[data-prev]'); };
      const nx = el.querySelector('[data-next]'); nx.onclick = () => { current = Math.min(tasks.length - 1, current + 1); const t0 = tasks[current]; if (t0 && t0.type === 'value' && t0.set) Object.assign(vals, t0.set); render('[data-pred], [data-val]'); };
      const lim = el.querySelector('[data-limit]'); if (lim) { lim.oninput = () => { limitText = lim.value; }; lim.onchange = save; }
      if (focusSel) { const f = el.querySelector(focusSel); if (f && !f.disabled) f.focus(); }
    }
    if (tasks[0] && tasks[0].type === 'value' && tasks[0].set) Object.assign(vals, tasks[0].set);
    render();
  },
});
