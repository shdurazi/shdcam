/* ===== B: sources, import, bake, library, viewer, saving ===== */
const PREVIEW_LONG = 1920;
const isImg = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp)$/i.test(f.name || '');
const isVid = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(f.name || '');
const dimW = el => el.naturalWidth || el.videoWidth || el.width || 0;
const dimH = el => el.naturalHeight || el.videoHeight || el.height || 0;
const onceEv = (el, ev, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout:' + ev)), ms || 15000);
  el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
  el.addEventListener('error', () => { clearTimeout(t); rej(new Error('media error')); }, { once: true });
});

async function decodeImage(blob) {
  try { return await createImageBitmap(blob); } catch (e) { /* fall back to <img> */ }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async'; img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
async function previewOf(full) {
  const w = dimW(full), h = dimH(full), L = Math.max(w, h);
  if (L <= PREVIEW_LONG) return full;
  const k = PREVIEW_LONG / L, rw = Math.round(w * k), rh = Math.round(h * k);
  try { return await createImageBitmap(full, { resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' }); }
  catch (e) {
    const c = document.createElement('canvas'); c.width = rw; c.height = rh;
    c.getContext('2d').drawImage(full, 0, 0, rw, rh);
    return c;
  }
}

/* ---------- sources ---------- */
async function loadImageBlob(blob, name, kind) {
  const full = await decodeImage(blob);
  const fw = dimW(full), fh = dimH(full);
  if (!fw || !fh) throw new Error('empty image');
  const pv = await previewOf(full);
  if (pv !== full && full.close) full.close();
  if (S.live) stopLive(true);
  const src = { kind: kind || 'image', el: pv, w: dimW(pv), h: dimH(pv), fw, fh, name: name || 'image', blob };
  setSource(src);
  return src;
}
async function loadVideoBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  v.src = url;
  try { await onceEv(v, 'loadeddata', 20000); }
  catch (e) { URL.revokeObjectURL(url); throw e; }
  if (S.live) stopLive(true);
  const src = { kind: 'video', el: v, w: v.videoWidth, h: v.videoHeight, name: name || 'video', url, blob, dur: v.duration };
  setSource(src);
  try { await v.play(); } catch (e) { $('#btnPlay').hidden = false; }
  return src;
}
async function loadSample() {
  const bin = atob(SAMPLE_B64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return loadImageBlob(new Blob([u], { type: 'image/jpeg' }), 'sample.jpg', 'sample');
}

/* ---------- export geometry ---------- */
function exportDims(w, h, zoom, cap) {
  const sa = w / h, A = outAspect(sa);
  let rw, rh;
  if (sa > A) { rh = h; rw = h * A; } else { rw = w; rh = w / A; }
  rw /= zoom; rh /= zoom;
  const k = Math.min(1, cap / Math.max(rw, rh));
  return [even(rw * k), even(rh * k)];
}
function stampCanvas(src, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const d = new Date(), txt = "'" + String(d.getFullYear()).slice(2) + '  ' + (d.getMonth() + 1) + '  ' + d.getDate();
  const fs = Math.round(Math.min(W, H) * 0.036);
  x.font = '500 ' + fs + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  const px = W - fs * 1.5, py = H - fs * 1.3;
  x.shadowColor = 'rgba(255,80,0,.7)'; x.shadowBlur = fs * 0.4; x.fillStyle = '#ff9a2e';
  x.fillText(txt, px, py);
  x.shadowBlur = 0; x.fillText(txt, px, py);
  return c;
}
const toBlobP = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));

/* render one frame/photo at export size through the film pipeline -> JPEG blob */
async function renderPhoto(el, w, h, o) {
  o = o || {};
  const e = getExp(), zoom = o.zoom || 1;
  if (Math.max(w, h) > e.maxTex) {
    const k = e.maxTex / Math.max(w, h), rw = Math.floor(w * k), rh = Math.floor(h * k);
    const small = await createImageBitmap(el, { resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' });
    try { return await renderPhoto(small, rw, rh, o); } finally { if (small.close) small.close(); }
  }
  let cap = Math.min(S.set.photoCap || 4096, e.maxTex, 8192), last = null;
  for (let tries = 0; tries < 3; tries++) {
    try {
      const d = exportDims(w, h, zoom, cap);
      e.setSize(d[0], d[1]);
      bindLut(e);
      e.upload(el, w, h);
      e.render(paramsFor({ zoom, cx: o.cx, cy: o.cy, mirror: o.mirror, seed: (Math.random() * 90000) | 0 }));
      let cv = e.canvas;
      if (S.set.stamp && !S.bypass) cv = stampCanvas(cv, d[0], d[1]);
      const blob = await toBlobP(cv, 'image/jpeg', 0.93);
      if (!blob) throw new Error('encode failed');
      const thumb = makeThumb(cv, d[0], d[1]);
      return { blob, w: d[0], h: d[1], thumb };
    } catch (err) { last = err; cap = Math.round(cap / 2); e.srcW = 0; e.srcH = 0; }
  }
  throw last || new Error('render failed');
}
function makeThumb(cv, w, h) {
  try {
    const k = 132 / Math.max(w, h), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch (err) { return ''; }
}
async function bakeBlob(blob) {
  const bmp = await decodeImage(blob);
  try { return await renderPhoto(bmp, dimW(bmp), dimH(bmp), {}); }
  finally { if (bmp.close) bmp.close(); }
}

/* ---------- naming ---------- */
function stampName(ts) {
  const d = new Date(ts);
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function fileNameFor(ext, ts, lookId) {
  const n = look(lookId || S.lookId).name || 'Look';
  const tag = n.replace(/[^A-Za-z0-9]+/g, '') || 'Look';
  return 'shdcam_' + tag + '_' + stampName(ts) + '.' + ext;
}

/* ---------- saving to the device ---------- */
function anchorDownload(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 5000);
}
/* resolves: saved | declined | busy | failed | manual */
async function saveBlob(blob, filename) {
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: blob }); return 'saved'; }
      catch (e) {
        const c = e && e.code;
        if (c === 'declined') return 'declined';
        if (c === 'rate_limited') return 'busy';
        if (c === 'too_large' || c === 'bad_request' || c === 'rejected_extension' || c === 'extension_not_enabled') return 'failed';
      }
    }
  }
  if (!EMBEDDED) { try { anchorDownload(blob, filename); return 'saved'; } catch (e) { return 'failed'; } }
  return 'manual';
}
async function deliver(it, quiet) {
  const blob = await libBlob(it);
  if (!blob) { toast('تعذّر قراءة الملف'); return 'failed'; }
  const r = await saveBlob(blob, it.name);
  if (quiet) return r;
  if (r === 'saved') toast('تم الحفظ في جهازك ✓');
  else if (r === 'declined') toast('محفوظة في المكتبة. اضغط على المعرض لحفظها لاحقًا');
  else if (r === 'busy') toast('انتظر لحظة ثم أعد المحاولة');
  else if (r === 'manual') { openViewer(0, 'اضغط مطولًا على الصورة واختر «تنزيل الصورة» لحفظها في الجهاز'); }
  else toast('تعذّر الحفظ، افتح المكتبة وحاول من هناك');
  return r;
}

/* ---------- library (IndexedDB, falls back to memory) ---------- */
let dbP = null;
function idb() {
  if (dbP) return dbP;
  dbP = new Promise(res => {
    try {
      const r = indexedDB.open('shdcam', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blob')) d.createObjectStore('blob');
        if (!d.objectStoreNames.contains('fonts')) d.createObjectStore('fonts', { keyPath: 'w' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbP;
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function libLoad() {
  const d = await idb();
  if (!d) return;
  try {
    const all = await reqP(d.transaction('meta').objectStore('meta').getAll());
    const keep = S.lib.filter(x => x.mem);
    S.lib = keep.concat(all).sort((a, b) => b.ts - a.ts);
    updateUI();
  } catch (e) { /* ignore */ }
}
async function libAdd(it, blob) {
  S.lib.unshift(it);
  const d = await idb();
  if (d) {
    try {
      await new Promise((res, rej) => {
        const t = d.transaction(['meta', 'blob'], 'readwrite');
        t.objectStore('meta').put(it); t.objectStore('blob').put(blob, it.id);
        t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    } catch (e) { it.mem = blob; }
  } else it.mem = blob;
  updateUI();
}
async function libBlob(it) {
  if (it.mem) return it.mem;
  const d = await idb();
  if (!d) return null;
  try { return await reqP(d.transaction('blob').objectStore('blob').get(it.id)); } catch (e) { return null; }
}
async function libDel(it) {
  S.lib = S.lib.filter(x => x !== it);
  const d = await idb();
  if (d && !it.mem) {
    try {
      await new Promise(res => {
        const t = d.transaction(['meta', 'blob'], 'readwrite');
        t.objectStore('meta').delete(it.id); t.objectStore('blob').delete(it.id);
        t.oncomplete = res; t.onerror = res; t.onabort = res;
      });
    } catch (e) { /* ignore */ }
  }
  updateUI();
}
async function addItem(kind, blob, w, h, thumb, dur) {
  const ts = Date.now();
  const ext = kind === 'video' ? (/mp4/.test(blob.type) ? 'mp4' : 'webm') : 'jpg';
  const it = { id: ts.toString(36) + Math.random().toString(36).slice(2, 6), kind, ts, w, h, look: S.lookId, name: fileNameFor(ext, ts), size: blob.size, thumb: thumb || '', dur: dur || 0, type: blob.type };
  await libAdd(it, blob);
  return it;
}

/* ---------- baking an imported photo ---------- */
async function saveImageSource(s) {
  if (S.baking) return;
  S.baking = true;
  toast('جارٍ التحميض…', 6000);
  try {
    const r = await bakeBlob(s.blob);
    const it = await addItem('photo', r.blob, r.w, r.h, r.thumb);
    $('#toast').classList.remove('show');
    await deliver(it);
  } catch (e) {
    toast('تعذّر معالجة الصورة. جرّب حجمًا أصغر من الإعدادات');
  } finally { S.baking = false; }
}

/* ---------- baking an imported video (real-time) ---------- */
function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* next */ } }
  return '';
}
let bakeCancel = null;
async function saveVideoSource(s) {
  if (S.baking) return;
  const mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) { toast('هذا المتصفح لا يدعم حفظ الفيديو بالفلتر'); return; }
  S.baking = true;
  const e = getExp(), ov = $('#bake');
  const v = document.createElement('video');
  v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = s.url;
  let ac = null, cancelled = false, rec = null, rafId = 0;
  const cleanup = () => {
    cancelled = true;
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (x) { /* ignore */ }
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch (x) { /* ignore */ }
    try { if (ac) ac.close(); } catch (x) { /* ignore */ }
    try { e.canvas.remove(); } catch (x) { /* ignore */ }
    ov.classList.remove('open');
    bakeCancel = null; S.baking = false;
  };
  try {
    await onceEv(v, 'loadeddata', 20000);
    const vw = v.videoWidth, vh = v.videoHeight, A = outAspect(vw / vh);
    const L = Math.min(S.set.vq === 720 ? 1280 : 1920, Math.max(vw, vh));
    const W = even(A >= 1 ? L : L * A), H = even(A >= 1 ? L / A : L);
    e.setSize(W, H); bindLut(e); e.srcW = 0; e.srcH = 0;
    $('#bakeCv').textContent = ''; $('#bakeCv').appendChild(e.canvas);
    $('#bakeTxt').textContent = 'جارٍ التحميض…'; $('#bakeBar').firstElementChild.style.width = '0';
    $('#bakeSub').textContent = 'لا تقفل الصفحة حتى ينتهي (بنفس مدة الفيديو)';
    ov.classList.add('open');
    ac = new (window.AudioContext || window.webkitAudioContext)();
    try { await ac.resume(); } catch (x) { /* ignore */ }
    let dest = null;
    try { const sn = ac.createMediaElementSource(v); dest = ac.createMediaStreamDestination(); sn.connect(dest); } catch (x) { dest = null; }
    const stream = e.canvas.captureStream(30);
    if (dest) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const chunks = [];
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: S.set.vq === 720 ? 6e6 : 10e6, audioBitsPerSecond: 128e3 });
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    bakeCancel = () => { cleanup(); };
    let frame = 0, thumb = '';
    const step = () => {
      if (cancelled) return;
      e.upload(v, v.videoWidth, v.videoHeight);
      e.render(paramsFor({ seed: ++frame }));
      if (!thumb && v.currentTime > 0.4) thumb = makeThumb(e.canvas, W, H);
      const d = v.duration || 1;
      $('#bakeBar').firstElementChild.style.width = Math.min(100, 100 * v.currentTime / d).toFixed(1) + '%';
      $('#bakeTxt').textContent = 'جارٍ التحميض… ' + Math.min(99, Math.round(100 * v.currentTime / d)) + '%';
      if (v.ended) return;
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else rafId = requestAnimationFrame(step);
    };
    const ended = new Promise(res => { v.onended = res; });
    const paint = () => { e.upload(v, v.videoWidth, v.videoHeight); e.render(paramsFor({ seed: ++frame })); };
    paint();
    rec.start(500);
    await sleep(80);
    paint();
    await v.play();
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else rafId = requestAnimationFrame(step);
    await ended;
    if (cancelled) return;
    await sleep(120);
    e.render(paramsFor({ seed: ++frame }));
    rec.stop();
    await stopped;
    if (cancelled) return;
    const type = mime.split(';')[0];
    const blob = new Blob(chunks, { type });
    const dur = v.duration;
    cancelAnimationFrame(rafId);
    const it = await addItem('video', blob, W, H, thumb || makeThumb(e.canvas, W, H), dur);
    cleanup();
    await deliver(it);
  } catch (err) {
    cleanup();
    toast('تعذّر حفظ الفيديو بالفلتر');
  }
}

/* ---------- importing files ---------- */
async function importFiles(files, fromCam) {
  files = Array.from(files || []);
  const imgs = files.filter(isImg), vids = files.filter(f => !isImg(f) && isVid(f));
  if (!imgs.length && !vids.length) { if (files.length) toast('هذا النوع من الملفات غير مدعوم'); return; }
  try {
    if (imgs.length > 1) { await batchBake(imgs); return; }
    if (imgs.length === 1) {
      const f = imgs[0];
      await loadImageBlob(f, f.name);
      if (fromCam) { S.mode = 'photo'; updateUI(); if (S.set.autosave) saveImageSource(S.src); }
      return;
    }
    await loadVideoBlob(vids[0], vids[0].name);
    if (fromCam) { S.mode = 'video'; updateUI(); }
  } catch (e) {
    toast('تعذّر فتح الملف. تأكد أنه صورة أو فيديو مدعوم');
  }
}
async function batchBake(files) {
  if (S.baking) return;
  S.baking = true;
  const ov = $('#bake');
  let cancelled = false, done = 0;
  bakeCancel = () => { cancelled = true; };
  $('#bakeCv').textContent = '';
  $('#bakeSub').textContent = 'تُحفظ كل الصور في المكتبة';
  ov.classList.add('open');
  try {
    for (let i = 0; i < files.length && !cancelled; i++) {
      $('#bakeTxt').textContent = 'جارٍ التحميض… ' + (i + 1) + '/' + files.length;
      $('#bakeBar').firstElementChild.style.width = (100 * i / files.length).toFixed(1) + '%';
      await sleep(30);
      try {
        const r = await bakeBlob(files[i]);
        const it = await addItem('photo', r.blob, r.w, r.h, r.thumb);
        done++;
        if (S.set.autosave && !EMBEDDED) await deliver(it, true);
      } catch (e) { /* skip unreadable file */ }
    }
  } finally {
    ov.classList.remove('open'); bakeCancel = null; S.baking = false;
  }
  if (done) toast('تم تحميض ' + done + ' صورة. افتحها من المكتبة لحفظها', 3200);
  else toast('تعذّر معالجة الصور');
}

/* ---------- viewer ---------- */
let vIdx = 0, vUrl = '', vToken = 0;
function clearViewerMedia() {
  const m = $('#vBody').querySelector('img,video');
  if (m) { if (m.pause) m.pause(); m.remove(); }
  if (vUrl) { URL.revokeObjectURL(vUrl); vUrl = ''; }
}
async function showItem() {
  const it = S.lib[vIdx], tk = ++vToken;
  if (!it) { closeViewer(); return; }
  clearViewerMedia();
  $('#vTitle').textContent = look(it.look).name.toUpperCase() + ' · ' + new Date(it.ts).toLocaleDateString('en-GB') + (it.kind === 'video' ? ' · VIDEO' : '');
  $('#vPrev').style.visibility = vIdx <= 0 ? 'hidden' : 'visible'; $('#vNext').style.visibility = vIdx >= S.lib.length - 1 ? 'hidden' : 'visible';
  const blob = await libBlob(it);
  if (tk !== vToken) return;
  if (!blob) { $('#vMsg').textContent = 'تعذّر فتح الملف'; return; }
  vUrl = URL.createObjectURL(blob);
  let el;
  if (it.kind === 'video') { el = document.createElement('video'); el.controls = true; el.playsInline = true; el.loop = true; el.autoplay = true; el.muted = false; }
  else { el = document.createElement('img'); el.alt = it.name; el.draggable = false; }
  el.src = vUrl;
  $('#vBody').insertBefore(el, $('#vNav'));
  $('#vShare').hidden = EMBEDDED || !navigator.share;
}
async function openViewer(i, msg) {
  if (!S.lib.length) { toast('المكتبة فارغة. التقط أو احفظ صورة أولًا'); return; }
  vIdx = clamp(i == null ? 0 : i, 0, S.lib.length - 1);
  $('#vMsg').textContent = msg || '';
  $('#viewer').classList.add('open');
  closeSheets();
  await showItem();
}
function closeViewer() {
  $('#viewer').classList.remove('open');
  vToken++; clearViewerMedia();
}
async function viewerSave() {
  const it = S.lib[vIdx];
  if (!it) return;
  const r = await deliver(it, true);
  if (r === 'saved') toast('تم الحفظ في جهازك ✓');
  else if (r === 'declined') toast('لم يُحفظ');
  else if (r === 'manual') $('#vMsg').textContent = 'اضغط مطولًا على الصورة واختر «تنزيل الصورة»';
  else if (r === 'busy') toast('انتظر لحظة ثم أعد المحاولة');
  else toast('تعذّر الحفظ');
}
async function viewerShare() {
  const it = S.lib[vIdx];
  if (!it || !navigator.share) return;
  const blob = await libBlob(it);
  if (!blob) return;
  try {
    const f = new File([blob], it.name, { type: it.type || (it.kind === 'video' ? 'video/mp4' : 'image/jpeg') });
    if (navigator.canShare && !navigator.canShare({ files: [f] })) { toast('المشاركة غير متاحة لهذا الملف'); return; }
    await navigator.share({ files: [f] });
  } catch (e) { if (e && e.name !== 'AbortError') toast('تعذّرت المشاركة'); }
}
async function viewerDelete() {
  const it = S.lib[vIdx];
  if (!it) return;
  await libDel(it);
  if (!S.lib.length) { closeViewer(); return; }
  vIdx = Math.min(vIdx, S.lib.length - 1);
  await showItem();
}

/* ---------- user font: imported on this device only, never bundled or uploaded (the font licence forbids hosting it) ---------- */
const FONT_NAME = 'Thmanyah Sans';
const fontFaces = new Map();
function sfntWeight(buf, fname) {
  try {
    const dv = new DataView(buf), magic = dv.getUint32(0);
    if (magic !== 0x4f54544f && magic !== 0x00010000 && magic !== 0x74727565) throw new Error('not sfnt');
    const n = dv.getUint16(4);
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      if (dv.getUint32(o) === 0x4f532f32) {
        const w = dv.getUint16(dv.getUint32(o + 8) + 4);
        if (w >= 100 && w <= 900) return w;
      }
    }
  } catch (e) { /* fall back to the file name */ }
  return /bold|black|heavy/i.test(fname) ? 700 : /medium/i.test(fname) ? 500 : /light|thin/i.test(fname) ? 300 : 400;
}
async function applyFont(buf, fname) {
  if (typeof FontFace === 'undefined') throw new Error('FontFace unsupported');
  const w = sfntWeight(buf, fname || '');
  const ff = new FontFace(FONT_NAME, buf, { weight: String(w), style: 'normal', display: 'swap' });
  await ff.load();
  const old = fontFaces.get(w);
  if (old) { try { document.fonts.delete(old); } catch (e) { /* ignore */ } }
  document.fonts.add(ff); fontFaces.set(w, ff);
  return w;
}
async function fontsSave(w, name, buf) {
  const d = await idb();
  if (!d) return;
  try {
    await new Promise((res, rej) => {
      const t = d.transaction('fonts', 'readwrite');
      t.objectStore('fonts').put({ w, name, buf });
      t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  } catch (e) { /* storage unavailable: the font stays active for this session only */ }
}
async function fontsLoad() {
  const d = await idb();
  if (!d) return 0;
  try {
    const all = await reqP(d.transaction('fonts').objectStore('fonts').getAll());
    for (const f of all) { try { await applyFont(f.buf, f.name); } catch (e) { /* skip a broken entry */ } }
  } catch (e) { /* ignore */ }
  return fontFaces.size;
}
async function fontsClear() {
  fontFaces.forEach(ff => { try { document.fonts.delete(ff); } catch (e) { /* ignore */ } });
  fontFaces.clear();
  const d = await idb();
  if (!d) return;
  try {
    await new Promise(res => {
      const t = d.transaction('fonts', 'readwrite');
      t.objectStore('fonts').clear(); t.oncomplete = res; t.onerror = res; t.onabort = res;
    });
  } catch (e) { /* ignore */ }
}
async function importFonts(files) {
  let ok = 0, unsupported = typeof FontFace === 'undefined';
  for (const f of Array.from(files || [])) {
    try {
      const buf = await f.arrayBuffer(), keep = buf.slice(0);
      const w = await applyFont(buf, f.name);
      await fontsSave(w, f.name, keep);
      ok++;
    } catch (e) { /* not a usable font file */ }
  }
  if (ok) toast('تم تفعيل الخط (' + (ok === 1 ? 'ملف واحد' : ok === 2 ? 'ملفان' : ok + ' ملفات') + ')', 2400);
  else toast(unsupported ? 'هذا المتصفح لا يدعم الخطوط المخصصة' : 'الملف ليس خطًا صالحًا أو لم يُسمح به هنا', 3000);
  buildSettings();
  return ok;
}
