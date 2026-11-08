/* ===== grade.js : film colour science (browser + node) ===== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FL = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var sat01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var smooth = function (a, b, x) { var t = sat01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var s2l = function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  var l2s = function (c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };

  /* ---- OKLab ---- */
  function lin2lab(r, g, b) {
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function lab2lin(L, a, b) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    var l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
    return [
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
    ];
  }

  /* ---- hue sectors (OKLCh degrees) ---- */
  var SECT = { r: [29, 20], o: [58, 18], y: [105, 26], g: [142, 30], c: [195, 28], b: [264, 30], m: [332, 30] };
  function angd(a, b) {
    var d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  var TONE0 = { contrast: 1, pivot: 0.5, shoulder: 0, knee: 0.72, clip: 0, gain: [1, 1, 1], gamma: [1, 1, 1], lift: [0, 0, 0] };
  var FX0 = { grain: 0.3, gsize: 1, gchroma: 0.2, glow: 0, hal: 0, halCol: [1, 0.42, 0.16], vig: 0.2 };

  /* normalise a look definition (fills defaults, precomputes sector list) */
  function prep(def) {
    var L = {
      ev: def.ev || 0,
      sat: def.sat == null ? 1 : def.sat,
      vib: def.vib || 0,
      mix: def.mix || null,
      split: def.split || null,
      mono: def.mono || null,
      tone: Object.assign({}, TONE0, def.tone || {}),
      fx: Object.assign({}, FX0, def.fx || {}),
      sect: []
    };
    var H = def.hue || {};
    for (var k in H) {
      var h = H[k];
      if (!SECT[k]) continue;
      if (h[0] === 0 && h[1] === 1 && (h[2] || 0) === 0) continue;
      L.sect.push({ c: SECT[k][0], s: SECT[k][1], dh: h[0], sm: h[1], dl: h[2] || 0 });
    }
    L.needLCh = L.sect.length > 0 || L.sat !== 1 || L.vib !== 0;
    return L;
  }

  function tone(x, T, ch) {
    x = sat01(x);
    var p = T.pivot, k = T.contrast, y;
    y = x < p ? p * Math.pow(x / p, k) : 1 - (1 - p) * Math.pow((1 - x) / (1 - p), k);
    if (T.shoulder > 0 && y > T.knee) {
      var t = y - T.knee, w = 1 - T.knee;
      y = T.knee + t - T.shoulder * t * t / w;
    }
    if (T.clip > 0) y = Math.max(0, (y - T.clip) / (1 - T.clip));
    y *= T.gain[ch];
    y = Math.pow(sat01(y), 1 / T.gamma[ch]);
    y = y + T.lift[ch] * (1 - y);
    return y;
  }

  function toRGBSafe(L, a, b) {
    var v = lab2lin(L, a, b);
    if (v[0] < 0 || v[1] < 0 || v[2] < 0 || v[0] > 1 || v[1] > 1 || v[2] > 1) {
      var lo = 0, hi = 1, t;
      for (var i = 0; i < 9; i++) {
        var mid = (lo + hi) / 2;
        t = lab2lin(L, a * mid, b * mid);
        if (t[0] < -1e-4 || t[1] < -1e-4 || t[2] < -1e-4 || t[0] > 1.0001 || t[1] > 1.0001 || t[2] > 1.0001) hi = mid; else lo = mid;
      }
      v = lab2lin(L, a * lo, b * lo);
    }
    return v;
  }

  /* grade one pixel. r,g,b = gamma-encoded sRGB 0..1  ->  out[0..2] */
  function grade(Lk, r, g, b, out) {
    var lr = s2l(r), lg = s2l(g), lb = s2l(b);
    if (Lk.ev) { var m = Math.pow(2, Lk.ev); lr *= m; lg *= m; lb *= m; }
    if (Lk.mix) {
      var M = Lk.mix;
      var R = M[0] * lr + M[1] * lg + M[2] * lb, G = M[3] * lr + M[4] * lg + M[5] * lb, B = M[6] * lr + M[7] * lg + M[8] * lb;
      lr = R; lg = G; lb = B;
    }
    var T = Lk.tone, sp = Lk.split, x0, x1, x2, Y;
    if (Lk.mono) {
      var w = Lk.mono.w;
      var yl = w[0] * lr + w[1] * lg + w[2] * lb;
      var y = tone(l2s(sat01(yl)), T, 1);
      x0 = x1 = x2 = y;
    } else {
      x0 = tone(l2s(sat01(lr)), T, 0);
      x1 = tone(l2s(sat01(lg)), T, 1);
      x2 = tone(l2s(sat01(lb)), T, 2);
    }
    if (sp) {
      Y = 0.2126 * x0 + 0.7152 * x1 + 0.0722 * x2;
      var ws = (1 - Y) * (1 - Y), wh = Y * Y;
      var sh = sp.sh || [0, 0, 0], hi = sp.hi || [0, 0, 0];
      x0 += sh[0] * ws + hi[0] * wh;
      x1 += sh[1] * ws + hi[1] * wh;
      x2 += sh[2] * ws + hi[2] * wh;
    }
    x0 = sat01(x0); x1 = sat01(x1); x2 = sat01(x2);
    if (Lk.needLCh && !Lk.mono) {
      var lab = lin2lab(s2l(x0), s2l(x1), s2l(x2));
      var Ll = lab[0], a = lab[1], bb = lab[2];
      var C = Math.sqrt(a * a + bb * bb);
      if (C > 1e-5) {
        var h = Math.atan2(bb, a) * 180 / Math.PI;
        var dh = 0, sm = 1, dl = 0, i, S;
        for (i = 0; i < Lk.sect.length; i++) {
          S = Lk.sect[i];
          var d = angd(h, S.c) / S.s;
          var wt = Math.exp(-0.5 * d * d);
          dh += wt * S.dh;
          sm *= 1 + wt * (S.sm - 1);
          dl += wt * S.dl;
        }
        var cw = smooth(0.004, 0.05, C);
        dh *= cw; dl *= cw; sm = 1 + (sm - 1) * cw;
        var gs = Lk.sat * (1 + Lk.vib * (1 - sat01(C / 0.2)));
        var C2 = C * sm * gs;
        var h2 = (h + dh) * Math.PI / 180;
        var o = toRGBSafe(Ll + dl, C2 * Math.cos(h2), C2 * Math.sin(h2));
        x0 = l2s(sat01(o[0])); x1 = l2s(sat01(o[1])); x2 = l2s(sat01(o[2]));
      }
    }
    out[0] = x0; out[1] = x1; out[2] = x2;
    return out;
  }

  /* build a N^3 LUT (Float32 RGBA, R fastest) for a prepped look */
  function buildLUT(Lk, N) {
    N = N || 33;
    var data = new Float32Array(N * N * N * 4), tmp = [0, 0, 0], inv = 1 / (N - 1), i = 0;
    for (var b = 0; b < N; b++) for (var g = 0; g < N; g++) for (var r = 0; r < N; r++) {
      grade(Lk, r * inv, g * inv, b * inv, tmp);
      data[i++] = tmp[0]; data[i++] = tmp[1]; data[i++] = tmp[2]; data[i++] = 1;
    }
    return data;
  }

  /* CPU trilinear lookup */
  function lutApply(data, N, r, g, b, out) {
    var f = N - 1;
    var x = sat01(r) * f, y = sat01(g) * f, z = sat01(b) * f;
    var x0 = Math.min(Math.floor(x), f - 1), y0 = Math.min(Math.floor(y), f - 1), z0 = Math.min(Math.floor(z), f - 1);
    var fx = x - x0, fy = y - y0, fz = z - z0;
    var s1 = 4, s2 = 4 * N, s3 = 4 * N * N, base = z0 * s3 + y0 * s2 + x0 * s1;
    for (var c = 0; c < 3; c++) {
      var c000 = data[base + c], c100 = data[base + s1 + c], c010 = data[base + s2 + c], c110 = data[base + s2 + s1 + c];
      var c001 = data[base + s3 + c], c101 = data[base + s3 + s1 + c], c011 = data[base + s3 + s2 + c], c111 = data[base + s3 + s2 + s1 + c];
      var c00 = c000 + (c100 - c000) * fx, c10 = c010 + (c110 - c010) * fx;
      var c01 = c001 + (c101 - c001) * fx, c11 = c011 + (c111 - c011) * fx;
      var c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
      out[c] = c0 + (c1 - c0) * fz;
    }
    return out;
  }

  return { prep: prep, grade: grade, buildLUT: buildLUT, lutApply: lutApply, s2l: s2l, l2s: l2s, lin2lab: lin2lab, lab2lin: lab2lin };
});
