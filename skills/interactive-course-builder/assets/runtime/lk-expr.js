/* Safe arithmetic expression evaluator for course data (no eval / Function).
   Grammar: numbers, variables, + - * / ^ %, unary -, comparisons (< <= > >= == !=),
   && || !, ternary a ? b : c, and whitelisted functions. Works in browsers and Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LKExpr = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function erf(x) { // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function lgamma(z) { // Lanczos approximation
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  const normInv = p => { // Acklam's algorithm, relative error < 1.15e-9
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  function betacf(a, b, x) { // continued fraction for the incomplete beta (Numerical Recipes)
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; }
    return h;
  }
  function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const tcdf = (t, df) => { const x = df / (df + t * t); const tail = 0.5 * ibeta(x, df / 2, 0.5); return t >= 0 ? 1 - tail : tail; };
  const tinv = (p, df) => { if (p <= 0) return -Infinity; if (p >= 1) return Infinity; let lo = -1e3, hi = 1e3; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tcdf(mid, df) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const FUNCS = {
    abs: Math.abs, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, log2: Math.log2,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    floor: Math.floor, ceil: Math.ceil, round: (x, d = 0) => { const k = Math.pow(10, d); return Math.round(x * k) / k; },
    min: Math.min, max: Math.max, pow: Math.pow, sign: Math.sign,
    clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    erf,
    normpdf: (x, mu = 0, s = 1) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)),
    normcdf: (x, mu = 0, s = 1) => 0.5 * (1 + erf((x - mu) / (s * Math.SQRT2))),
    norminv: (p, mu = 0, s = 1) => mu + s * normInv(p),
    choose: (n, k) => (k < 0 || k > n) ? 0 : Math.round(Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1))),
    binompmf: (k, n, p) => (k < 0 || k > n) ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p)),
    lgamma, tcdf, tinv,
  };
  const CONSTS = { pi: Math.PI, e: Math.E, true: 1, false: 0 };

  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) { let j = i; while (j < src.length && /[0-9.eE]/.test(src[j])) { if (/[eE]/.test(src[j]) && /[+-]/.test(src[j + 1])) j++; j++; } const v = Number(src.slice(i, j)); if (!isFinite(v)) throw new Error('Invalid number near "' + src.slice(i, j) + '"'); t.push({ k: 'n', v }); i = j; continue; }
      if (/[A-Za-z_]/.test(ch)) { let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++; t.push({ k: 'id', v: src.slice(i, j) }); i = j; continue; }
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { t.push({ k: 'op', v: two }); i += 2; continue; }
      if ('+-*/^%(),<>!?:'.includes(ch)) { t.push({ k: 'op', v: ch }); i++; continue; }
      throw new Error('Unexpected character "' + ch + '"');
    }
    return t;
  }
  function parse(src) {
    if (typeof src !== 'string' || src.length > 2000) throw new Error('Expression must be a string of at most 2000 characters');
    const t = tokenize(src); let p = 0;
    const peek = v => t[p] && t[p].k === 'op' && t[p].v === v;
    const eat = v => { if (!peek(v)) throw new Error('Expected "' + v + '"'); p++; };
    const node = (type, a) => Object.assign({ type }, a);
    function ternary() { const c = or(); if (peek('?')) { p++; const a = ternary(); eat(':'); const b = ternary(); return node('?', { c, a, b }); } return c; }
    function or() { let l = and(); while (peek('||')) { p++; l = node('bin', { op: '||', l, r: and() }); } return l; }
    function and() { let l = cmp(); while (peek('&&')) { p++; l = node('bin', { op: '&&', l, r: cmp() }); } return l; }
    function cmp() { let l = add(); while (t[p] && t[p].k === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(t[p].v)) { const op = t[p++].v; l = node('bin', { op, l, r: add() }); } return l; }
    function add() { let l = mul(); while (peek('+') || peek('-')) { const op = t[p++].v; l = node('bin', { op, l, r: mul() }); } return l; }
    function mul() { let l = unary(); while (peek('*') || peek('/') || peek('%')) { const op = t[p++].v; l = node('bin', { op, l, r: unary() }); } return l; }
    function unary() { if (peek('-')) { p++; return node('neg', { a: unary() }); } if (peek('!')) { p++; return node('not', { a: unary() }); } if (peek('+')) { p++; return unary(); } return pow(); }
    function pow() { const b = atom(); if (peek('^')) { p++; return node('bin', { op: '^', l: b, r: unary() }); } return b; }
    function atom() {
      const tok = t[p];
      if (!tok) throw new Error('Unexpected end of expression');
      if (tok.k === 'n') { p++; return node('num', { v: tok.v }); }
      if (tok.k === 'id') {
        p++;
        if (peek('(')) {
          if (!Object.prototype.hasOwnProperty.call(FUNCS, tok.v)) throw new Error('Unknown function "' + tok.v + '"');
          p++; const args = [];
          if (!peek(')')) { args.push(ternary()); while (peek(',')) { p++; args.push(ternary()); } }
          eat(')'); return node('call', { f: tok.v, args });
        }
        return node('var', { name: tok.v });
      }
      if (peek('(')) { p++; const e = ternary(); eat(')'); return e; }
      throw new Error('Unexpected token "' + tok.v + '"');
    }
    const ast = ternary();
    if (p < t.length) throw new Error('Unexpected token "' + t[p].v + '"');
    return ast;
  }
  function evalAst(n, vars) {
    switch (n.type) {
      case 'num': return n.v;
      case 'var':
        if (Object.prototype.hasOwnProperty.call(vars, n.name)) return Number(vars[n.name]);
        if (Object.prototype.hasOwnProperty.call(CONSTS, n.name)) return CONSTS[n.name];
        throw new Error('Unknown variable "' + n.name + '"');
      case 'neg': return -evalAst(n.a, vars);
      case 'not': return evalAst(n.a, vars) ? 0 : 1;
      case '?': return evalAst(n.c, vars) ? evalAst(n.a, vars) : evalAst(n.b, vars);
      case 'call': return FUNCS[n.f](...n.args.map(a => evalAst(a, vars)));
      case 'bin': {
        const l = evalAst(n.l, vars); const r = evalAst(n.r, vars);
        switch (n.op) {
          case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r; case '%': return l % r; case '^': return Math.pow(l, r);
          case '<': return +(l < r); case '<=': return +(l <= r); case '>': return +(l > r); case '>=': return +(l >= r); case '==': return +(l === r); case '!=': return +(l !== r);
          case '&&': return +(l && r); case '||': return +(l || r);
        }
      }
    }
    throw new Error('Invalid expression node');
  }
  const cache = new Map();
  function compile(src) { if (!cache.has(src)) cache.set(src, parse(src)); const ast = cache.get(src); return vars => evalAst(ast, vars || {}); }
  function evaluate(src, vars) { return compile(src)(vars); }
  function variables(src) { const out = new Set(); (function walk(n) { if (!n) return; if (n.type === 'var' && !Object.prototype.hasOwnProperty.call(CONSTS, n.name)) out.add(n.name); ['l', 'r', 'a', 'b', 'c'].forEach(k => n[k] && walk(n[k])); (n.args || []).forEach(walk); })(parse(src)); return [...out]; }
  return { evaluate, compile, parse, variables, functions: Object.keys(FUNCS) };
});
