/* Simulador de muestreo: extrae muestras repetidas de una población artificial con media conocida
   y muestra cuántos intervalos de confianza contienen la media verdadera.
   Generador pseudoaleatorio con semilla (mulberry32): misma semilla + mismos ajustes = mismos resultados. */
(function () {
  'use strict';

  /* ---------- núcleo numérico (sin DOM, comprobable en Node) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const POPS = {
    normal:  { mu: 50, sigma: 10, draw: r => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return 50 + 10 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); } },
    skewed:  { mu: 50, sigma: 50, draw: r => -50 * Math.log(1 - r()) },
    yesno:   { mu: 0.4, sigma: Math.sqrt(0.4 * 0.6), draw: r => (r() < 0.4 ? 1 : 0) },
  };
  /* función beta incompleta regularizada (fracción continua, Numerical Recipes) → cuantil t por bisección */
  function lgam(z) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300; const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgam(a + b) - lgam(a) - lgam(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tcdf(t, df) { const x = df / (df + t * t); const p = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? 1 - p : p; }
  function tinv(p, df) { // cuantil de la t de Student (p entre 0,5 y 1)
    let lo = 0, hi = 1000; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (tcdf(m, df) < p) lo = m; else hi = m; } return (lo + hi) / 2;
  }
  const Z = { 0.90: 1.6448536269514722, 0.95: 1.959963984540054, 0.99: 2.5758293035489004 };
  function interval(sample, level, method) {
    const n = sample.length; let m = 0; for (const x of sample) m += x; m /= n;
    let ss = 0; for (const x of sample) ss += (x - m) * (x - m); const s = Math.sqrt(ss / (n - 1));
    const crit = method === 't' ? tinv(1 - (1 - level) / 2, n - 1) : Z[level];
    const moe = crit * s / Math.sqrt(n);
    return { mean: m, s, moe, lo: m - moe, hi: m + moe };
  }
  const core = { mulberry32, tinv, tcdf, interval, POPS, Z };
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof window === 'undefined' || !window.LK) return;

  /* ---------- interfaz ---------- */
  const LK = window.LK;
  LK.registerWidget('sampling-sim', {
    title: 'Simulador de muestreo', kind: 'w_explore',
    mount(el, cfg, api) {
      const esc = api.esc; const uid = 'ss' + Math.random().toString(36).slice(2, 7);
      const st = {
        pop: cfg.population || 'normal', n: cfg.n || 25, level: cfg.level || 0.95, method: cfg.method || 't',
        seed: cfg.seed != null ? cfg.seed : 2026, results: [], rng: null, recorded: false,
      };
      const lock = cfg.lock || [];            // controles bloqueados para una tarea concreta
      const maxShow = 40;
      function reset() { st.rng = mulberry32(st.seed >>> 0); st.results = []; }
      reset();
      function draw(k) {
        const P = POPS[st.pop];
        for (let j = 0; j < k; j++) {
          const sample = []; for (let i = 0; i < st.n; i++) sample.push(P.draw(st.rng));
          const iv = interval(sample, st.level, st.method); iv.covers = iv.lo <= P.mu && P.mu <= iv.hi; st.results.push(iv);
        }
        if (!st.recorded) { st.recorded = true; api.record({ touched: true, pop: st.pop, n: st.n }); }
      }
      function chart() {
        const P = POPS[st.pop]; const shown = st.results.slice(-maxShow); if (!shown.length) return '<p class="small">Pulsa «Extraer» para dibujar muestras.</p>';
        const W = 560, rowH = 9, H = 40 + shown.length * rowH, padL = 14, padR = 14;
        const half = Math.max(P.sigma * 3 / Math.sqrt(Math.max(st.n, 1)) * 1.5, 1e-9);
        const lo = P.mu - half, hi = P.mu + half; const X = v => padL + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (W - padL - padR);
        let g = `<line x1="${X(P.mu)}" x2="${X(P.mu)}" y1="14" y2="${H - 22}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${X(P.mu)}" y="10" text-anchor="middle">media verdadera μ = ${P.mu}</text>`;
        shown.forEach((r, i) => {
          const y = 22 + i * rowH; const x1 = X(r.lo), x2 = X(r.hi), xm = X(r.mean);
          if (r.covers) g += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="var(--accent-2)" stroke-width="2"/><circle cx="${xm}" cy="${y}" r="2.2" fill="var(--accent-2)"/>`;
          else g += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="var(--danger)" stroke-width="3" stroke-dasharray="6 3"/><text x="${x2 + 6}" y="${y + 3.5}" style="fill:var(--danger);font-weight:700">× no contiene μ</text>`;
        });
        const alt = `Gráfico con los últimos ${shown.length} intervalos. ${shown.filter(r => r.covers).length} contienen la media verdadera (línea azul continua) y ${shown.filter(r => !r.covers).length} no la contienen (línea roja discontinua con una cruz).`;
        return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}"><g style="color:var(--muted)">${g}</g><text x="${W / 2}" y="${H - 6}" text-anchor="middle">eje horizontal: valor de la variable (el intervalo de cada muestra es una barra)</text></svg>`;
      }
      function summary() {
        const P = POPS[st.pop]; const N = st.results.length; if (!N) return `<p>Aún no hay muestras. Con ${Math.round(st.level * 100)} % de confianza se esperaría que contuvieran μ aproximadamente el ${Math.round(st.level * 100)} % de los intervalos <em>a la larga</em>, si se cumplen los supuestos.</p>`;
        const cov = st.results.filter(r => r.covers).length; const means = st.results.map(r => r.mean);
        const mm = means.reduce((a, b) => a + b, 0) / N; const sd = N > 1 ? Math.sqrt(means.reduce((a, b) => a + (b - mm) * (b - mm), 0) / (N - 1)) : NaN;
        const avgW = st.results.reduce((a, r) => a + 2 * r.moe, 0) / N; const fmt = (v, d = 2) => isFinite(v) ? v.toLocaleString(api.lang === 'es' ? 'es-ES' : api.lang, { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
        const lastR = st.results[N - 1];
        return `<table><tbody>
          <tr><th>Muestras extraídas</th><td><strong>${N}</strong></td></tr>
          <tr><th>Intervalos que contienen μ</th><td><strong>${cov} de ${N} (${fmt(100 * cov / N, 1)} %)</strong> — nivel nominal ${Math.round(st.level * 100)} %</td></tr>
          <tr><th>Intervalos que no contienen μ</th><td>${N - cov}</td></tr>
          <tr><th>Última muestra</th><td>media ${fmt(lastR.mean, 3)}; intervalo [${fmt(lastR.lo, 3)}; ${fmt(lastR.hi, 3)}] — ${lastR.covers ? 'contiene μ' : 'NO contiene μ'}</td></tr>
          <tr><th>Desviación típica de las ${N} medias muestrales</th><td>${fmt(sd, 3)} (teórico σ/√n = ${fmt(P.sigma / Math.sqrt(st.n), 3)})</td></tr>
          <tr><th>Anchura media de los intervalos</th><td>${fmt(avgW, 3)}</td></tr></tbody></table>`;
      }
      function opt(v, label, cur) { return `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`; }
      function render(focusSel) {
        const dis = k => lock.includes(k) ? ' disabled' : '';
        el.innerHTML = `<p class="w-title" data-kicker="${esc(api.t('w_explore'))}">${esc(cfg.title || 'Simulador de muestreo')}</p>
          <div class="w-controls">
            <label>Población (artificial)<select data-c="pop"${dis('pop')}>${opt('normal', 'Normal (μ = 50, σ = 10)', st.pop)}${opt('skewed', 'Sesgada a la derecha (μ = 50, σ = 50)', st.pop)}${opt('yesno', 'Sí/No (proporción verdadera 0,40)', st.pop)}</select></label>
            <label>Tamaño de muestra n<input type="number" min="2" max="500" step="1" value="${st.n}" data-c="n"${dis('n')}></label>
            <label>Nivel de confianza<select data-c="level"${dis('level')}>${opt('0.9', '90 %', st.level)}${opt('0.95', '95 %', st.level)}${opt('0.99', '99 %', st.level)}</select></label>
            <label>Tipo de intervalo<select data-c="method"${dis('method')}>${opt('t', 't de Student (usa s)', st.method)}${opt('z', 'z (normal, usa s)', st.method)}</select></label>
            <label>Semilla aleatoria<input type="number" min="0" max="999999" step="1" value="${st.seed}" data-c="seed"></label>
          </div>
          <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
            <button type="button" class="btn small primary" data-do="1">Extraer 1 muestra</button>
            <button type="button" class="btn small" data-do="20">Extraer 20</button>
            <button type="button" class="btn small" data-do="100">Extraer 100</button>
            <button type="button" class="btn small" data-do="0">Reiniciar</button>
          </div>
          <figure style="margin:8px 0">${chart()}</figure>
          <div class="w-out" id="${uid}-out" aria-live="polite" role="status">${summary()}</div>
          <div class="w-note"><strong>${esc(api.t('modelNote'))}:</strong><ul>${(cfg.assumptions || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
        el.querySelectorAll('[data-c]').forEach(c => c.onchange = () => {
          const k = c.dataset.c; let v = c.value;
          if (k === 'n') v = Math.min(500, Math.max(2, Math.round(+v) || 2)); else if (k === 'seed') v = Math.max(0, Math.round(+v) || 0); else if (k === 'level') v = +v;
          st[k] = v; reset(); render(`[data-c="${k}"]`);
        });
        el.querySelectorAll('[data-do]').forEach(b => b.onclick = () => { const k = +b.dataset.do; if (k === 0) reset(); else draw(k); render(`[data-do="${b.dataset.do}"]`); });
        if (focusSel) { const f = el.querySelector(focusSel); if (f) f.focus(); }
      }
      render();
    },
  });
})();
