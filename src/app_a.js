/* ===== A: core, state, looks, layout, shelf, sheets ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, '0');
const even = n => Math.max(2, Math.round(n / 2) * 2);
const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const store = {
  get(k, d) { try { const v = localStorage.getItem('fc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fc.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const IC = {
  flashOff: svg('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/><path d="M3.5 3.5l17 17"/>'),
  flashOn: svg('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>'),
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.8M9.5 2.5h5"/>'),
  gallery: svg('<rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="m4 18 5-5 4 4 2.6-2.6L20 18.4"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  grid: svg('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
  flip: svg('<path d="M20 10.5A8 8 0 0 0 6 6.6L4.5 8.5"/><path d="M4.5 4v4.5H9"/><path d="M4 13.5A8 8 0 0 0 18 17.4l1.5-1.9"/><path d="M19.5 20v-4.5H15"/>'),
  compare: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>'),
  download: svg('<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"/>'),
  none: svg('<circle cx="12" cy="12" r="7.5"/><path d="m6.6 17.4 10.8-10.8"/>'),
  star: svg('<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: svg('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  prev: svg('<path d="m15 5-7 7 7 7"/>'),
  next: svg('<path d="m9 5 7 7-7 7"/>'),
  videoDot: svg('<rect x="3" y="6.5" width="12" height="11" rx="2.5"/><path d="m15 11 6-3.5v9L15 13z"/>')
};

const DEF_ADJ = { ev: 0, temp: 0, tint: 0, con: 1, sat: 1, int: 1, grain: 1, glow: 1, vig: 1 };
const DEF_SET = { grid: false, stamp: false, sound: true, haptic: true, mirror: true, autosave: !EMBEDDED, photoCap: 4096, vq: 1080 };
const savedLook = store.get('look', FILMS.DEFAULT);
const S = {
  mode: 'photo', cat: 'film',
  lookId: FILMS.byId[savedLook] ? savedLook : FILMS.DEFAULT, prevLook: FILMS.DEFAULT,
  favs: (store.get('favs', []) || []).filter(id => FILMS.byId[id]),
  aspect: store.get('aspect', 'orig'),
  adj: Object.assign({}, DEF_ADJ, store.get('adj', {})),
  set: Object.assign({}, DEF_SET, store.get('set', {})),
  src: null, live: null, lib: [], bypass: false, seed: 1,
  timer: 0, flash: false, facing: 'environment', zoom: 1, cx: 0.5, cy: 0.5,
  rec: null, baking: false, canLive: false, shooting: false
};
if (S.lookId !== 'none') S.prevLook = S.lookId;
if (S.cat === 'film' && FILMS.byId[S.lookId] && FILMS.byId[S.lookId].cat !== 'none') S.cat = FILMS.byId[S.lookId].cat;

/* ---------- looks ---------- */
const lutCache = new Map();
const thumbLut = {};
function look(id) {
  const it = FILMS.byId[id] || FILMS.byId[FILMS.DEFAULT];
  if (!it._p) it._p = FL.prep(it.look || {});
  return it;
}
function lutFor(id) {
  let d = lutCache.get(id);
  if (!d) {
    d = FL.buildLUT(look(id)._p, 33);
    lutCache.set(id, d);
    if (lutCache.size > 10) lutCache.delete(lutCache.keys().next().value);
  }
  return d;
}
function paramsFor(o) {
  o = o || {};
  const base = { zoom: o.zoom || 1, cx: o.cx == null ? S.cx : o.cx, cy: o.cy == null ? S.cy : o.cy, mirror: !!o.mirror };
  if (S.bypass) return Object.assign(base, { ev: 0, wb: [1, 1, 1], intensity: 0, con: 1, sat: 1, grain: 0, glow: 0, hal: 0, vig: 0, seed: 1 });
  const it = look(S.lookId), fx = it._p.fx, a = S.adj, none = S.lookId === 'none', k = none ? 0 : 1;
  let wb = [1 + 0.30 * a.temp, 1, 1 - 0.30 * a.temp];
  wb[1] *= 1 - 0.20 * a.tint; wb[0] *= 1 + 0.07 * a.tint; wb[2] *= 1 + 0.07 * a.tint;
  const yl = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2];
  wb = wb.map(v => v / yl);
  return Object.assign(base, {
    ev: a.ev, wb, intensity: none ? 0 : a.int, con: a.con, sat: a.sat,
    grain: k * fx.grain * a.grain, gsize: fx.gsize, gchroma: fx.gchroma,
    glow: k * fx.glow * a.glow, hal: k * fx.hal * a.glow, halCol: fx.halCol, vig: k * fx.vig * a.vig,
    seed: o.seed == null ? S.seed : o.seed
  });
}

/* ---------- engines ---------- */
let view = null, exp = null, glFail = false;
function getView() {
  if (view) return view;
  try {
    view = new FilmEngine($('#view'));
    view.onrestore = () => { try { view = null; getView(); layout(); if (S.src) uploadNow(); } catch (e) { /* ignore */ } };
  } catch (e) {
    glFail = true;
    $('#hint').textContent = 'المتصفح لا يدعم WebGL2 المطلوب لتشغيل الفلاتر.';
  }
  return view;
}
function getExp() {
  if (!exp) exp = new FilmEngine(document.createElement('canvas'), { preserve: true });
  return exp;
}
function bindLut(e) {
  if (e._lut !== S.lookId) { e.setLUT(lutFor(S.lookId), 33); e._lut = S.lookId; }
}

/* ---------- aspect & layout ---------- */
const ASPECTS = ['orig', '4:3', '16:9', '1:1'];
function srcAspect() { const s = S.src; return s && s.w && s.h ? s.w / s.h : 3 / 4; }
function outAspect(sa) {
  const o = S.aspect;
  if (o === 'orig' || !o) return sa;
  if (o === '1:1') return 1;
  const r = o === '16:9' ? 16 / 9 : 4 / 3;
  return sa < 1 ? 1 / r : r;
}
function aspectLabel() {
  if (S.aspect !== 'orig') return S.aspect;
  const a = srcAspect(), r = a < 1 ? 1 / a : a;
  const t = [[4 / 3, '4:3'], [16 / 9, '16:9'], [3 / 2, '3:2'], [1, '1:1']];
  for (const x of t) if (Math.abs(r - x[0]) < 0.04) return x[1];
  return 'ORIG';
}
function canvasLong() {
  if (S.live && S.mode === 'video') return S.set.vq === 720 ? 1280 : 1920;
  return 1280;
}
function layout() {
  const e = getView();
  if (!e) return;
  const st = $('#stage').getBoundingClientRect();
  if (!st.width || !st.height) return;
  const A = outAspect(srcAspect());
  let w = st.width, h = w / A;
  if (h > st.height) { h = st.height; w = h * A; }
  const fr = $('#frame');
  fr.style.width = Math.round(w) + 'px'; fr.style.height = Math.round(h) + 'px';
  const L = canvasLong();
  const W = A >= 1 ? L : Math.round(L * A), H = A >= 1 ? Math.round(L / A) : L;
  e.setSize(even(W), even(H));
  if (S.src) { uploadNow(); redraw(); }
  const lbl = aspectLabel();
  if ($('#btnAspect').textContent !== lbl) $('#btnAspect').textContent = lbl;
}

/* ---------- render ---------- */
let rafP = 0, loopId = 0;
function uploadNow() {
  const s = S.src, e = view;
  if (!s || !e) return;
  const el = s.el;
  const w = el.videoWidth || s.w, h = el.videoHeight || s.h;
  if (el.readyState === 0 && el.tagName === 'VIDEO') return;
  e.upload(el, w, h);
}
function redraw() {
  if (rafP) return;
  rafP = requestAnimationFrame(() => { rafP = 0; drawNow(); });
}
function drawNow() {
  const e = view;
  if (!e || !S.src) return;
  bindLut(e);
  const L = S.live;
  e.render(paramsFor({ zoom: L ? L.sw : 1, mirror: !!L && S.facing === 'user' && S.set.mirror }));
  if (S.snap) { const f = S.snap; S.snap = null; try { f(e.canvas); } catch (x) { /* ignore */ } }
}
function startLoop(v) {
  const id = ++loopId;
  const step = () => {
    if (id !== loopId) return;
    if (v.readyState >= 2 && v.videoWidth && view) {
      if (S.src && S.src.el === v && (S.src.w !== v.videoWidth || S.src.h !== v.videoHeight)) { S.src.w = v.videoWidth; S.src.h = v.videoHeight; layout(); }
      view.upload(v, v.videoWidth, v.videoHeight);
      S.seed = (S.seed + 1) % 99991;
      drawNow();
      if (S.src && S.src.kind === 'video') updateProg(v);
    }
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
  };
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
}
function stopLoop() { loopId++; }
function updateProg(v) {
  const p = $('#vprog');
  if (!p.hidden && v.duration) p.firstElementChild.style.width = (100 * v.currentTime / v.duration).toFixed(1) + '%';
  $('#btnPlay').hidden = !v.paused;
}

function releaseSource(s) {
  if (!s) return;
  try {
    if (s.kind === 'image' || s.kind === 'sample') { if (s.el && s.el.close) s.el.close(); if (s.full && s.full !== s.el && s.full.close) s.full.close(); }
    else if (s.kind === 'video') { s.el.pause(); s.el.removeAttribute('src'); s.el.load(); if (s.url) URL.revokeObjectURL(s.url); }
  } catch (e) { /* ignore */ }
}
function setSource(src, keepOld) {
  stopLoop();
  const prev = S.src;
  S.src = src;
  if (prev && prev !== src && !keepOld) releaseSource(prev);
  const isV = src.kind === 'video', isL = src.kind === 'live';
  $('#vprog').hidden = !isV;
  $('#vprog').firstElementChild.style.width = '0';
  $('#btnPlay').hidden = !isV || !src.el.paused;
  layout();
  if (isV || isL) startLoop(src.el);
  refreshThumb();
  updateUI();
}

/* ---------- ui helpers ---------- */
let toastT = 0;
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms || 2200);
}
let nameT = 0;
function flashName(n) {
  const e = $('#nm');
  e.textContent = n; e.classList.add('show');
  clearTimeout(nameT);
  nameT = setTimeout(() => e.classList.remove('show'), 900);
}
function tick(ms) { if (S.set.haptic && navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignore */ } } }
let actx = null;
function shutterSound() {
  if (!S.set.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const click = (delay, gain) => {
      const n = Math.floor(actx.sampleRate * 0.06), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = actx.createBufferSource(); s.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9;
      const g = actx.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(actx.destination); s.start(actx.currentTime + delay);
    };
    click(0, 0.55); click(0.075, 0.35);
  } catch (e) { /* audio unavailable */ }
}

/* ---------- film art: original cartridge illustrations (no brand marks, only the ISO number) ---------- */
let artN = 0;
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}
function lgrad(id, stops, x2, y2) {
  return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 1 : x2) + '" y2="' + (y2 || 0) + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
}
function canArt(a) {
  const id = 'c' + (++artN), tx = String(a.text), tc = a.tc;
  const big = tx.length <= 2 ? 11.2 : tx.length === 3 ? 10.4 : 8.4;
  const shadow = '<radialGradient id="' + id + 'h"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>';
  if (a.k === 'pack') {
    return '<svg class="can" viewBox="0 0 48 64" aria-hidden="true"><defs>' + shadow +
      lgrad(id + 'l', [[0, shade(a.body, -.34)], [.2, shade(a.body, .22)], [.55, a.body], [1, shade(a.body, -.4)]]) +
      lgrad(id + 'w', [[0, '#6f8791'], [.5, '#34454c'], [1, '#1f2a30']], 1, 1) +
      lgrad(id + 's', [[0, '#000', .2], [.2, '#fff', .3], [.34, '#fff', 0], [.8, '#000', .05], [1, '#000', .4]]) +
      '<clipPath id="' + id + 'c"><rect x="7" y="7" width="34" height="49" rx="4.6"/></clipPath></defs>' +
      '<ellipse cx="24" cy="59" rx="18" ry="2.5" fill="url(#' + id + 'h)"/>' +
      '<rect x="19" y="3.6" width="10" height="5.4" rx="1.7" fill="' + a.band + '"/>' +
      '<rect x="7" y="7" width="34" height="49" rx="4.6" fill="url(#' + id + 'l)"/>' +
      '<rect x="11" y="12.5" width="26" height="26" rx="2.2" fill="url(#' + id + 'w)"/>' +
      '<path d="M11 28 26 12.5h6L11 34Z" fill="#fff" fill-opacity=".1"/>' +
      '<rect x="11" y="42" width="26" height="10.5" rx="2" fill="' + a.band + '"/>' +
      '<text x="24" y="46.4" text-anchor="middle" font-size="2.9" letter-spacing=".8" fill="' + tc + '" fill-opacity=".85">ISO</text>' +
      '<text x="24" y="51.2" text-anchor="middle" font-size="5.6" fill="' + tc + '">' + tx + '</text>' +
      '<g clip-path="url(#' + id + 'c)"><rect x="7" y="7" width="34" height="49" fill="url(#' + id + 's)"/></g>' +
      '<rect x="7.35" y="7.35" width="33.3" height="48.3" rx="4.3" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".6"/></svg>';
  }
  const cap = a.cap || '#c6c7cd';
  return '<svg class="can" viewBox="0 0 48 64" aria-hidden="true"><defs>' + shadow +
    lgrad(id + 'm', [[0, shade(cap, -.45)], [.2, shade(cap, .38)], [.46, cap], [.8, shade(cap, -.36)], [1, shade(cap, -.62)]]) +
    lgrad(id + 'l', [[0, shade(a.body, -.42)], [.22, shade(a.body, .16)], [.55, a.body], [1, shade(a.body, -.5)]]) +
    lgrad(id + 's', [[0, '#000', .26], [.18, '#fff', .36], [.32, '#fff', 0], [.78, '#000', .06], [1, '#000', .5]]) +
    lgrad(id + 'f', [[0, '#c18a45'], [.5, '#8c5b2b'], [1, '#6a4120']], 0, 1) +
    '<radialGradient id="' + id + 't" cx=".4" cy=".35" r=".85"><stop offset="0" stop-color="' + shade(cap, .6) + '"/><stop offset=".6" stop-color="' + cap + '"/><stop offset="1" stop-color="' + shade(cap, -.42) + '"/></radialGradient>' +
    '<clipPath id="' + id + 'c"><path d="M7 11V52A15 3.5 0 0 0 37 52V11Z"/></clipPath></defs>' +
    '<ellipse cx="22" cy="58.2" rx="18" ry="2.7" fill="url(#' + id + 'h)"/>' +
    /* film leader */
    '<g transform="rotate(-5 36 33)"><path d="M35 28.5H44.4Q46 28.5 46 30.1V37.4Q46 39 44.4 39H35Z" fill="url(#' + id + 'f)"/>' +
    '<g fill="#2b1a0b" fill-opacity=".72"><rect x="37.9" y="29.5" width="1.9" height="1.4" rx=".3"/><rect x="40.7" y="29.5" width="1.9" height="1.4" rx=".3"/><rect x="43.5" y="29.5" width="1.9" height="1.4" rx=".3"/>' +
    '<rect x="37.9" y="36.6" width="1.9" height="1.4" rx=".3"/><rect x="40.7" y="36.6" width="1.9" height="1.4" rx=".3"/><rect x="43.5" y="36.6" width="1.9" height="1.4" rx=".3"/></g>' +
    '<path d="M35 29H45.4" stroke="#f1c996" stroke-opacity=".45" stroke-width=".5"/></g>' +
    /* caps + label */
    '<path d="M7 47A15 3.5 0 0 0 37 47V52A15 3.5 0 0 1 7 52Z" fill="url(#' + id + 'm)"/>' +
    '<path d="M7 15.5A15 3.5 0 0 0 37 15.5V47A15 3.5 0 0 1 7 47Z" fill="url(#' + id + 'l)"/>' +
    '<path d="M7 11A15 3.5 0 0 0 37 11V15.5A15 3.5 0 0 1 7 15.5Z" fill="url(#' + id + 'm)"/>' +
    '<ellipse cx="22" cy="11" rx="15" ry="3.5" fill="url(#' + id + 't)"/>' +
    '<ellipse cx="22" cy="10.7" rx="11.6" ry="2.6" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>' +
    '<path d="M16 5V10.4A6 1.7 0 0 0 28 10.4V5Z" fill="url(#' + id + 'm)"/>' +
    '<ellipse cx="22" cy="5" rx="6" ry="1.7" fill="url(#' + id + 't)"/>' +
    '<path d="M19.3 5H24.7" stroke="#5a5b61" stroke-width=".85" stroke-linecap="round"/>' +
    /* label artwork: two stripes, hairline, ISO number */
    '<path d="M7 18.6A15 3.5 0 0 0 37 18.6V21.4A15 3.5 0 0 1 7 21.4Z" fill="' + a.band + '"/>' +
    '<path d="M7 41.6A15 3.5 0 0 0 37 41.6V44.4A15 3.5 0 0 1 7 44.4Z" fill="' + a.band + '"/>' +
    '<path d="M7 23.4A15 3.5 0 0 0 37 23.4" fill="none" stroke="' + tc + '" stroke-opacity=".38" stroke-width=".5"/>' +
    '<text x="22" y="30.3" text-anchor="middle" font-size="3.3" letter-spacing=".9" fill="' + tc + '" fill-opacity=".85">ISO</text>' +
    '<text x="22" y="' + (tx.length > 3 ? 40.8 : 40.6) + '" text-anchor="middle" font-size="' + big + '" fill="' + tc + '">' + tx + '</text>' +
    '<g clip-path="url(#' + id + 'c)"><rect x="7" y="8" width="30" height="50" fill="url(#' + id + 's)"/></g>' +
    '<path d="M7.7 11.9A15 3.5 0 0 0 36.3 11.9" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".5"/></svg>';
}

/* ---------- tabs & shelf ---------- */
function listFor(cat) {
  if (cat === 'fav') return S.favs.map(id => FILMS.byId[id]).filter(Boolean);
  const c = FILMS.CATS.find(x => x.id === cat);
  return c ? c.items : [];
}
function buildTabs() {
  const t = $('#tabs');
  t.textContent = '';
  const mk = (cls, html, key) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab ' + cls; b.innerHTML = html; b.dataset.k = key; b.setAttribute('role', 'tab');
    t.appendChild(b);
  };
  mk('icon none', IC.none, 'none');
  mk('icon star', IC.star, 'fav');
  FILMS.CATS.forEach(c => mk('', c.name, c.id));
  updateTabs();
}
function updateTabs() {
  $$('#tabs .tab').forEach(b => {
    const k = b.dataset.k;
    b.classList.toggle('on', k === 'none' ? S.lookId === 'none' : k === S.cat);
    b.setAttribute('aria-selected', b.classList.contains('on') ? 'true' : 'false');
  });
}
function buildShelf() {
  const sh = $('#shelf');
  sh.textContent = '';
  const items = listFor(S.cat);
  if (!items.length) {
    const d = document.createElement('div'); d.id = 'empty'; d.textContent = 'اختر فلترًا واضغط ★ لإضافته هنا';
    sh.appendChild(d);
    return;
  }
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'it' + (it.id === S.lookId ? ' on' : ''); b.dataset.id = it.id;
    const art = document.createElement('div'); art.className = 'art';
    if (it.art) art.innerHTML = canArt(it.art);
    else {
      const sw = document.createElement('span'); sw.className = 'sw';
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56;
      sw.appendChild(cv); art.appendChild(sw);
    }
    b.appendChild(art);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name; b.appendChild(nm);
    const fv = document.createElement('span');
    fv.className = 'fv' + (S.favs.includes(it.id) ? ' is' : ''); fv.dataset.fav = it.id; fv.innerHTML = IC.star;
    b.appendChild(fv);
    sh.appendChild(b);
  });
  paintSwatches();
  scrollToActive(false);
}
function scrollToActive(smooth) {
  const sh = $('#shelf'), a = $('.it.on', sh);
  if (!a) { sh.scrollLeft = 0; return; }
  sh.scrollTo({ left: a.offsetLeft - (sh.clientWidth - a.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
}
function syncShelf() {
  const items = listFor(S.cat);
  if (!$$('#shelf .it').length || items.length !== $$('#shelf .it').length) { buildShelf(); return; }
  $$('#shelf .it').forEach(b => b.classList.toggle('on', b.dataset.id === S.lookId));
  scrollToActive(true);
}
let thumb = null;
function refreshThumb() {
  const s = S.src;
  if (!s || !s.el) return;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 56;
    const x = c.getContext('2d', { willReadFrequently: true });
    const w = s.el.videoWidth || s.w, h = s.el.videoHeight || s.h, m = Math.min(w, h);
    x.drawImage(s.el, (w - m) / 2, (h - m) / 2, m, m, 0, 0, 56, 56);
    thumb = x.getImageData(0, 0, 56, 56);
    paintSwatches();
  } catch (e) { /* source not ready */ }
}
function paintSwatches() {
  if (!thumb) return;
  $$('#shelf .sw canvas').forEach(cv => {
    const id = cv.closest('.it').dataset.id, x = cv.getContext('2d'), out = x.createImageData(56, 56);
    let lut = thumbLut[id];
    if (!lut) lut = thumbLut[id] = FL.buildLUT(look(id)._p, 17);
    const d = thumb.data, o = out.data, t = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      FL.lutApply(lut, 17, d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, t);
      o[i] = t[0] * 255; o[i + 1] = t[1] * 255; o[i + 2] = t[2] * 255; o[i + 3] = 255;
    }
    x.putImageData(out, 0, 0);
  });
}
function selectLook(id, opts) {
  opts = opts || {};
  if (!FILMS.byId[id]) return;
  if (id !== 'none') S.prevLook = id;
  S.lookId = id; store.set('look', id);
  if (id !== 'none' && S.cat !== 'fav') S.cat = FILMS.byId[id].cat;
  updateTabs(); syncShelf(); redraw();
  if (!opts.silent) { flashName(look(id).name); tick(); }
}
function stepLook(dir) {
  let items = listFor(S.cat);
  if (!items.length) items = listFor('film');
  const i = items.findIndex(x => x.id === S.lookId);
  const n = items[(i < 0 ? (dir > 0 ? 0 : items.length - 1) : (i + dir + items.length) % items.length)];
  if (n) selectLook(n.id);
}
function toggleFav(id) {
  const i = S.favs.indexOf(id);
  if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
  store.set('favs', S.favs);
  if (S.cat === 'fav') buildShelf();
  else $$('#shelf .fv').forEach(f => f.classList.toggle('is', S.favs.includes(f.dataset.fav)));
  toast(i >= 0 ? 'أُزيل من المفضلة' : 'أُضيف للمفضلة ★', 1400);
}

/* ---------- sheets ---------- */
function openSheet(id) {
  closeSheets();
  $(id).classList.add('open'); $('#scrim').classList.add('open');
}
function closeSheets() {
  $$('.sheet.open').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('open');
}
function sliderRow(cfg, get, set) {
  const r = document.createElement('div'); r.className = 'row';
  const id = 'sl_' + cfg.k;
  r.innerHTML = '<label for="' + id + '">' + cfg.label + '</label><input id="' + id + '" type="range" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.step + '"><output></output>';
  const inp = r.querySelector('input'), out = r.querySelector('output');
  const paint = () => { const v = +inp.value; inp.style.setProperty('--p', ((v - cfg.min) / (cfg.max - cfg.min) * 100) + '%'); out.textContent = cfg.fmt(v); };
  inp.value = get(); paint();
  inp.addEventListener('input', () => { set(+inp.value); paint(); });
  r.querySelector('label').addEventListener('dblclick', () => { inp.value = cfg.def; set(cfg.def); paint(); });
  return r;
}
const pct = v => Math.round(v * 100) + '%';
const sgn = v => (v > 0 ? '+' : '') + Math.round(v);
const ADJ_ROWS = [
  { k: 'ev', label: 'التعريض', min: -2, max: 2, step: 0.05, def: 0, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) },
  { k: 'temp', label: 'الحرارة', min: -1, max: 1, step: 0.02, def: 0, fmt: v => sgn(v * 100) },
  { k: 'tint', label: 'الصبغة', min: -1, max: 1, step: 0.02, def: 0, fmt: v => sgn(v * 100) },
  { k: 'con', label: 'التباين', min: 0.7, max: 1.4, step: 0.01, def: 1, fmt: v => sgn((v - 1) * 100) },
  { k: 'sat', label: 'التشبّع', min: 0, max: 1.6, step: 0.01, def: 1, fmt: v => sgn((v - 1) * 100) }
];
const FX_ROWS = [
  { k: 'int', label: 'قوة الفلتر', min: 0, max: 1, step: 0.01, def: 1, fmt: pct },
  { k: 'grain', label: 'الحبيبات', min: 0, max: 2, step: 0.02, def: 1, fmt: pct },
  { k: 'glow', label: 'التوهّج', min: 0, max: 2, step: 0.02, def: 1, fmt: pct },
  { k: 'vig', label: 'التظليل', min: 0, max: 2, step: 0.02, def: 1, fmt: pct }
];
let proTab = 'adj';
function buildPro(tab) {
  proTab = tab || proTab;
  if (proTab === 'cam' && !S.live) proTab = 'adj';
  $('#proTabs [data-p="cam"]').hidden = !S.live;
  $$('#proTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === proTab));
  const body = $('#proBody'); body.textContent = '';
  if (proTab === 'cam') { buildCamRows(body); return; }
  const rows = proTab === 'adj' ? ADJ_ROWS : FX_ROWS;
  rows.forEach(c => body.appendChild(sliderRow(c, () => S.adj[c.k], v => { S.adj[c.k] = v; store.set('adj', S.adj); redraw(); })));
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btnw'; b.textContent = 'إعادة الضبط';
  b.onclick = () => { rows.forEach(c => { S.adj[c.k] = c.def; }); store.set('adj', S.adj); redraw(); buildPro(); };
  body.appendChild(b);
}
function buildSettings() {
  const b = $('#setBody'); b.textContent = '';
  const tg = (label, key) => {
    const e = document.createElement('button'); e.type = 'button'; e.className = 'tg' + (S.set[key] ? ' on' : '');
    e.innerHTML = '<span>' + label + '</span><i></i>';
    e.onclick = () => { S.set[key] = !S.set[key]; e.classList.toggle('on', S.set[key]); store.set('set', S.set); applySettings(); };
    b.appendChild(e);
  };
  const seg = (label, key, opts) => {
    const h = document.createElement('div'); h.className = 'sub'; h.style.marginTop = '14px'; h.textContent = label; b.appendChild(h);
    const w = document.createElement('div'); w.className = 'segs';
    opts.forEach(o => {
      const x = document.createElement('button'); x.type = 'button'; x.textContent = o[1]; x.className = S.set[key] === o[0] ? 'on' : '';
      x.onclick = () => { S.set[key] = o[0]; store.set('set', S.set); $$('button', w).forEach(y => y.classList.toggle('on', y === x)); applySettings(); };
      w.appendChild(x);
    });
    b.appendChild(w);
  };
  tg('الشبكة (ثلاثية)', 'grid');
  tg('ختم التاريخ على الصور', 'stamp');
  tg('صوت الغالق', 'sound');
  tg('اهتزاز خفيف', 'haptic');
  tg('عكس الكاميرا الأمامية (مثل المرآة)', 'mirror');
  if (!EMBEDDED) tg('حفظ كل صورة تلقائيًا في الجهاز', 'autosave');
  seg('حجم الصورة', 'photoCap', [[8192, 'أقصى'], [4096, '4K'], [2560, '2.5K'], [1600, '1.6K']]);
  seg('جودة الفيديو', 'vq', [[720, '720p'], [1080, '1080p']]);
  const fh = document.createElement('div'); fh.className = 'sub'; fh.style.marginTop = '16px'; fh.textContent = 'الخط'; b.appendChild(fh);
  const fst = document.createElement('div'); fst.id = 'fontStat'; fst.style.cssText = 'color:var(--ink2);font-size:13px;line-height:1.55;margin:0 0 4px';
  fst.textContent = fontFaces.size ? 'خط ثمانية مفعّل (' + fontFaces.size + ' أوزان)' : 'الخط الحالي افتراضي. اختر ملفات خط ثمانية (Regular و Medium و Bold) لتفعيله.';
  b.appendChild(fst);
  const fbt = document.createElement('button'); fbt.type = 'button'; fbt.className = 'btnw'; fbt.style.marginTop = '6px';
  fbt.textContent = fontFaces.size ? 'تغيير ملفات الخط' : 'استيراد الخط'; fbt.onclick = () => $('#inFont').click(); b.appendChild(fbt);
  if (fontFaces.size) { const frm = document.createElement('button'); frm.type = 'button'; frm.className = 'btnw'; frm.textContent = 'إزالة الخط'; frm.onclick = async () => { await fontsClear(); buildSettings(); toast('أُزيل الخط'); }; b.appendChild(frm); }
  const fnote = document.createElement('div'); fnote.style.cssText = 'color:var(--ink3);font-size:12px;line-height:1.5;margin:8px 0 0'; fnote.textContent = 'ملفات الخط تبقى على جهازك فقط ولا تُرفع لأي مكان.'; b.appendChild(fnote);
  const note = document.createElement('div'); note.className = 'note'; note.id = 'liveNote'; note.hidden = true; b.appendChild(note);
  const live = document.createElement('button'); live.type = 'button'; live.className = 'btnw pri'; live.id = 'setLive'; live.textContent = 'تشغيل المعاينة الحية'; b.appendChild(live);
  live.onclick = () => { closeSheets(); toggleLive(); };
  const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'btnw'; rs.textContent = 'إعادة ضبط كل التعديلات';
  rs.onclick = () => { S.adj = Object.assign({}, DEF_ADJ); store.set('adj', S.adj); redraw(); toast('تمت إعادة الضبط'); };
  b.appendChild(rs);
  const ab = document.createElement('div');
  ab.style.cssText = 'text-align:center;margin-top:16px;color:var(--ink3);font:500 12px/1.4 var(--mono);letter-spacing:.04em;direction:ltr';
  ab.textContent = 'shdcam · film looks · FP100 default';
  b.appendChild(ab);
  refreshLiveNote();
}
function refreshLiveNote() {
  const n = $('#liveNote'), b = $('#setLive');
  if (!n || !b) return;
  if (S.live) { b.textContent = 'إيقاف المعاينة الحية'; b.classList.remove('pri'); n.hidden = true; return; }
  b.textContent = 'تشغيل المعاينة الحية'; b.classList.add('pri');
  if (!S.canLive) {
    n.hidden = false;
    n.textContent = EMBEDDED
      ? 'المعاينة الحية للكاميرا غير متاحة داخل Claude. استخدم زر التصوير (يفتح كاميرا الجوال) أو افتح التطبيق من رابطه المستقل.'
      : 'هذا المتصفح لا يسمح بالكاميرا هنا. افتح التطبيق من رابط https في كروم.';
    b.hidden = true;
  } else { n.hidden = true; b.hidden = false; }
}
function applySettings() {
  document.body.classList.toggle('grid', !!S.set.grid);
  $('#btnGrid').classList.toggle('on', !!S.set.grid);
  updateUI(); layout();
}

/* ---------- chrome state ---------- */
const CAPL = { 8192: 'MAX', 4096: '4K', 2560: '2.5K', 1600: '1.6K' };
function updateUI() {
  const live = !!S.live, k = S.src && S.src.kind, editable = k === 'image' || k === 'video';
  document.body.dataset.mode = S.mode;
  document.body.classList.toggle('live', live);
  document.body.classList.toggle('rec', !!S.rec);
  $('#btnFlash').hidden = !live; $('#btnTimer').hidden = !live;
  if (!live) $('#lens').hidden = true;
  const bl = $('#btnLive'); bl.hidden = !S.canLive; bl.style.opacity = live ? '1' : '.55'; bl.textContent = live ? '● LIVE' : 'LIVE';
  $('#btnFmt').textContent = S.mode === 'photo' ? 'JPG·' + (CAPL[S.set.photoCap] || 'MAX') : S.set.vq + 'p';
  $('#btnAspect').textContent = aspectLabel();
  const side = $('#btnSide');
  if (live) { side.innerHTML = IC.flip; side.setAttribute('aria-label', 'قلب الكاميرا'); side.classList.remove('pri'); side.disabled = !!S.rec; }
  else { side.innerHTML = IC.download; side.setAttribute('aria-label', 'حفظ'); side.classList.toggle('pri', editable); side.disabled = !editable; }
  $('#btnFlash').innerHTML = S.flash ? IC.flashOn : IC.flashOff; $('#btnFlash').classList.toggle('on', S.flash);
  $('#btnTimer').innerHTML = IC.timer; $('#btnTimer').classList.toggle('on', S.timer > 0);
  $('#btnTimer').setAttribute('aria-label', 'المؤقت ' + (S.timer || 'مغلق'));
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
  const badge = $('#badge');
  if (S.rec) { /* handled by recorder */ }
  else if (k === 'sample') badge.textContent = 'SAMPLE';
  else if (k === 'image' || k === 'video') badge.textContent = (S.src.name || '').slice(0, 28);
  else badge.textContent = '';
  badge.classList.toggle('rec', !!S.rec);
  const hint = $('#hint');
  if (glFail) { /* message already set */ }
  else if (k === 'sample') hint.textContent = EMBEDDED || !S.canLive ? 'صورة تجريبية. اضغط زر التصوير لفتح كاميرا الجوال، أو اختر صورة من المعرض.' : 'صورة تجريبية. جارٍ تشغيل الكاميرا…';
  else hint.textContent = '';
  const nl = $('#btnLib'), top = S.lib[0];
  nl.innerHTML = '';
  nl.style.backgroundImage = top && top.thumb ? 'url(' + top.thumb + ')' : '';
  if (!top || !top.thumb) nl.innerHTML = IC.gallery;
  if (S.lib.length) { const b = document.createElement('b'); b.textContent = S.lib.length; nl.appendChild(b); }
  refreshLiveNote();
}
