/* ===== C: live camera, controls, gestures, init ===== */
function detectLive() {
  const md = navigator.mediaDevices;
  let allowed = true;
  try { const pp = document.permissionsPolicy || document.featurePolicy; if (pp && pp.allowsFeature) allowed = pp.allowsFeature('camera'); } catch (e) { allowed = true; }
  S.canLive = !!(md && md.getUserMedia) && window.isSecureContext !== false && allowed;
}
async function openCamera(facing, deviceId) {
  const md = navigator.mediaDevices, portrait = innerHeight >= innerWidth;
  const dev = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } };
  const tries = [
    { ...dev, width: { ideal: portrait ? 1440 : 1920 }, height: { ideal: portrait ? 1920 : 1440 }, frameRate: { ideal: 30 } },
    { ...dev },
    { facingMode: { ideal: facing } },
    true
  ];
  let err = null;
  for (const v of tries) {
    try { return await md.getUserMedia({ video: v, audio: false }); }
    catch (e) {
      err = e;
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError')) break;
      /* the camera can still be releasing after a stop (switching lens, flipping): give it a moment before the next try */
      if (e && (e.name === 'NotReadableError' || e.name === 'AbortError')) await sleep(450);
    }
  }
  throw err;
}
/* The sensor is 4:3. If the browser handed over a 16:9 stream (a crop of it: a narrower field of view that looks zoomed in),
   ask the same track for 4:3 in place. The stream is never closed, and the old format is asked back if nothing helps. */
async function widenView(tr) {
  const fmt = r => (r && r.width && r.height ? r.width + 'x' + r.height : '');
  const ratio = r => (r && r.width && r.height ? Math.max(r.width, r.height) / Math.min(r.width, r.height) : 4 / 3);
  try {
    if (!tr.applyConstraints || !tr.getSettings) return null;
    const s0 = tr.getSettings();
    if (ratio(s0) <= 1.6) return null;
    const variants = [
      { width: { ideal: 1920 }, height: { ideal: 1440 } },
      { aspectRatio: { ideal: 4 / 3 } },
      { width: { ideal: 1600 }, height: { ideal: 1200 }, aspectRatio: { ideal: 4 / 3 } }
    ];
    for (const v of variants) {
      try { await tr.applyConstraints(v); } catch (e) { continue; }
      await sleep(150);
      const s1 = tr.getSettings();
      if (ratio(s1) <= 1.6) return { from: fmt(s0), to: fmt(s1) };
    }
    await tr.applyConstraints({ width: { ideal: s0.width }, height: { ideal: s0.height } }).catch(() => { /* keep as is */ });
    return { from: fmt(s0), to: fmt(tr.getSettings()), failed: true };
  } catch (e) { return null; }
}
let wl = null;
async function wake(on) {
  try {
    if (on) { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } }
    else if (wl) { await wl.release(); wl = null; }
  } catch (e) { wl = null; }
}
function restoreParked() {
  const p = S.parked; S.parked = null;
  if (p) setSource(p, true); else loadSample().catch(() => { /* ignore */ });
}
async function startLive(facing, deviceId) {
  if (S.live || S.starting || !S.canLive) return false;
  S.starting = true;
  facing = facing || S.facing;
  if (deviceId === undefined) deviceId = store.get('dev_' + facing, '') || undefined;
  try {
    const stream = await openCamera(facing, deviceId);
    const tr = stream.getVideoTracks()[0];
    const fov = await widenView(tr);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.srcObject = stream;
    await v.play().catch(() => { /* autoplay muted should pass */ });
    for (let i = 0; i < 80 && !v.videoWidth; i++) await sleep(50);
    if (!v.videoWidth) { stream.getTracks().forEach(t => t.stop()); throw new Error('no video'); }
    const caps = tr.getCapabilities ? tr.getCapabilities() : {};
    const got = tr.getSettings ? tr.getSettings().deviceId : '';
    if (deviceId && got && got !== deviceId) store.set('dev_' + facing, '');   /* the saved lens is gone: forget it */
    let ic = null;
    if (window.ImageCapture) { try { ic = new ImageCapture(tr); } catch (e) { ic = null; } }
    S.live = { stream, track: tr, video: v, caps, ic, hw: 1, sw: 1, z: 1, facing, audio: null, fov };
    S.facing = facing; S.zoom = 1; S.flash = false;
    if (S.src && S.src.kind !== 'live') S.parked = S.src;
    setSource({ kind: 'live', el: v, w: v.videoWidth, h: v.videoHeight, name: 'live' }, true);
    tr.addEventListener('ended', () => { if (S.live && S.live.track === tr) { toast('انقطعت الكاميرا'); stopLive(); } });
    buildLens(); setZoom(1, true); wake(true); updateUI();
    return true;
  } catch (e) {
    const n = e && e.name;
    toast(n === 'NotAllowedError' || n === 'SecurityError' ? 'إذن الكاميرا مرفوض. فعّله من إعدادات الموقع ثم اضغط LIVE' : n === 'NotFoundError' ? 'لا توجد كاميرا متاحة' : 'تعذّر تشغيل الكاميرا' + (n ? ' (\u2066' + n + '\u2069)' : ''), 3200);
    if (S.src && S.src.kind === 'live') restoreParked();
    updateUI();
    return false;
  } finally { S.starting = false; }
}
function stopLive(replacing) {
  const L = S.live;
  if (!L) return;
  if (S.rec) stopRec();
  stopLoop();
  try { L.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
  try { if (L.audio) L.audio.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
  try { L.video.srcObject = null; } catch (e) { /* ignore */ }
  S.live = null; S.flash = false; S.zoom = 1;
  wake(false);
  if (replacing) { const p = S.parked; S.parked = null; releaseSource(p); }
  else restoreParked();
  updateUI();
}
function toggleLive() { if (S.live) stopLive(); else startLive(); }
async function restartLive(f, deviceId) {
  const L = S.live;
  if (!L || S.rec || S.starting) return false;
  stopLoop();
  try { L.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
  try { if (L.audio) L.audio.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
  S.live = null;
  const ok = await startLive(f, deviceId);
  if (!ok && !S.live) updateUI();
  tick(12);
  return ok;
}
function flipCamera() { return restartLive(S.facing === 'user' ? 'environment' : 'user'); }
async function switchCamera(id) {
  if (!S.live || !id) return;
  const f = S.facing;
  store.set('dev_' + f, id);
  const ok = await restartLive(f, id);
  if (!ok) store.set('dev_' + f, '');
  if (proTab === 'cam' && $('#shPro').classList.contains('open')) buildPro('cam');
}

/* ---------- zoom / lens / focus ---------- */
function zoomRange(L) {
  const zc = L.caps && L.caps.zoom;
  return zc ? [zc.min, Math.min(zc.max * 2, 30)] : [1, 6];
}
let zBusy = false, zNext = null;
async function pushHwZoom(L, v) {
  zNext = v;
  if (zBusy) return;
  zBusy = true;
  try {
    while (zNext != null) {
      const x = zNext; zNext = null;
      try { await L.track.applyConstraints({ advanced: [{ zoom: x }] }); } catch (e) { /* unsupported */ }
    }
  } finally { zBusy = false; }
}
function setZoom(z, force) {
  const L = S.live;
  if (!L) return;
  const r = zoomRange(L), zc = L.caps && L.caps.zoom;
  z = clamp(z, r[0], r[1]);
  const hw = zc ? clamp(z, zc.min, zc.max) : 1;
  L.z = z; L.sw = Math.max(1, z / hw); S.zoom = z;
  if (zc && (force || Math.abs(hw - L.hw) > 0.005)) { L.hw = hw; pushHwZoom(L, hw); }
  updateLensUI(); redraw();
}
function buildLens() {
  const L = S.live, el = $('#lens');
  el.textContent = '';
  if (!L) return;
  const r = zoomRange(L);
  let cand = [0.5, 1, 2, 3, 5, 10].filter(p => p >= r[0] - 1e-6 && p <= r[1] + 1e-6);
  /* a camera that can zoom out below 1x (ultra-wide) gets its own widest button, e.g. 0.6x */
  if (r[0] < 0.95 && !cand.some(p => p < 1)) cand.unshift(Math.ceil(r[0] * 10 - 1e-6) / 10);
  while (cand.length > 5) cand.splice(cand.includes(10) ? cand.indexOf(10) : cand.indexOf(3), 1);
  L.presets = cand;
  if (cand.length < 2) { el.dataset.off = '1'; return; }
  delete el.dataset.off;
  cand.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.z = p; b.textContent = p + 'x';
    el.appendChild(b);
  });
  updateLensUI();
}
function updateLensUI() {
  const L = S.live, el = $('#lens');
  if (!L || el.dataset.off) { el.hidden = true; return; }
  el.hidden = false;
  let hit = false;
  $$('button[data-z]', el).forEach(b => {
    const p = +b.dataset.z, on = Math.abs(L.z - p) < Math.max(0.06, p * 0.06);
    b.classList.toggle('on', on); if (on) hit = true;
  });
  let cur = $('button[data-cur]', el);
  if (!hit) {
    if (!cur) { cur = document.createElement('button'); cur.type = 'button'; cur.dataset.cur = '1'; cur.className = 'on'; el.appendChild(cur); }
    cur.textContent = L.z.toFixed(1) + 'x';
  } else if (cur) cur.remove();
}
function showRing(x, y) {
  const r = $('#ring');
  r.style.left = x + 'px'; r.style.top = y + 'px';
  r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
}
function tapToSrc(nx, ny) {
  const e = view, L = S.live;
  const sa = e.srcW / e.srcH, ca = e.W / e.H, z = L ? L.sw : 1;
  const cropX = sa > ca ? ca / sa : 1, cropY = sa > ca ? 1 : sa / ca;
  let px = nx - 0.5; const py = ny - 0.5;
  if (S.facing === 'user' && S.set.mirror) px = -px;
  return [clamp(0.5 + px * cropX / z, 0, 1), clamp(0.5 + py * cropY / z, 0, 1)];
}
async function focusAt(nx, ny) {
  const L = S.live;
  if (!L || !view) return;
  const c = L.caps || {}, adv = {}, p = tapToSrc(nx, ny);
  if (c.pointsOfInterest || (L.track.getSettings && 'pointsOfInterest' in L.track.getSettings())) adv.pointsOfInterest = [{ x: p[0], y: p[1] }];
  if (c.focusMode && c.focusMode.indexOf('single-shot') >= 0) adv.focusMode = 'single-shot';
  if (!Object.keys(adv).length) return;
  try { await L.track.applyConstraints({ advanced: [adv] }); } catch (e) { /* unsupported */ }
}

/* ---------- flash / timer ---------- */
async function toggleFlash() {
  const L = S.live;
  if (!L) return;
  const c = L.caps || {};
  if (!c.torch) { toast(S.facing === 'user' ? 'الفلاش غير متاح للكاميرا الأمامية' : 'الفلاش غير متاح في هذا المتصفح'); return; }
  try { await L.track.applyConstraints({ advanced: [{ torch: !S.flash }] }); S.flash = !S.flash; }
  catch (e) { toast('تعذّر تشغيل الفلاش'); }
  updateUI();
}
function cycleTimer() {
  S.timer = S.timer === 0 ? 3 : S.timer === 3 ? 10 : 0;
  toast(S.timer ? 'المؤقت ' + S.timer + ' ث' : 'المؤقت متوقف', 1100);
  updateUI(); tick();
}
let cdCancel = false;
async function countdown(n) {
  cdCancel = false; S.counting = true;
  const el = $('#count');
  try {
    for (let i = n; i > 0 && !cdCancel; i--) { el.textContent = i; tick(10); await sleep(1000); }
  } finally { el.textContent = ''; S.counting = false; }
  return !cdCancel;
}
function flashAnim() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

/* ---------- manual camera panel ---------- */
function camInfo(body) {
  const L = S.live, tr = L.track, c = L.caps || {}, st = tr.getSettings ? tr.getSettings() : {}, v = L.video;
  const box = document.createElement('div'); box.className = 'info';
  const ltr = t => '\u2066' + t + '\u2069';   /* keep numbers and device names left-to-right inside the Arabic lines */
  const z = c.zoom ? ltr((+c.zoom.min).toFixed(2) + ' - ' + (+c.zoom.max).toFixed(1)) : 'غير مدعوم';
  const pc = L.pcaps && L.pcaps.imageWidth ? L.pcaps.imageWidth.max + 'x' + L.pcaps.imageHeight.max : '—';
  const lines = [
    'البث: ' + ltr(v.videoWidth + 'x' + v.videoHeight),
    'الزوم الحالي: ' + ltr(st.zoom != null ? (+st.zoom).toFixed(2) : '—') + ' (المدى ' + z + ')',
    'أقصى صورة: ' + ltr(pc),
    'الكاميرا: ' + ltr(tr.label || '—'),
    ...(L.fov ? ['تعديل المجال: ' + ltr(L.fov.from + ' > ' + L.fov.to) + (L.fov.failed ? ' (ما نفع)' : '')] : []),
    'النسخة: ' + ltr('v' + BUILD)
  ];
  box.textContent = lines.join('\n');
  body.appendChild(box);
  if (L.ic && L.pcaps === undefined) {
    L.ic.getPhotoCapabilities()
      .then(p => { L.pcaps = p; if (S.live === L && proTab === 'cam') buildPro('cam'); })
      .catch(() => { L.pcaps = null; });
  }
  const md = navigator.mediaDevices;
  if (!md || !md.enumerateDevices) return;
  const wrap = document.createElement('div'); body.appendChild(wrap);
  md.enumerateDevices().then(list => {
    if (S.live !== L || !wrap.isConnected) return;
    const cams = list.filter(d => d.kind === 'videoinput');
    const side = S.facing === 'user' ? /front|user|أمام/i : /back|rear|environment|خلف/i;
    let pick = cams.filter(d => side.test(d.label));
    if (!pick.length) pick = cams;
    box.textContent = lines.concat('كاميرات المتصفح: ' + ltr(pick.map(d => d.label || '?').join(' | ') || '—')).join('\n');
    if (pick.length < 2) return;
    const h = document.createElement('div'); h.className = 'sub'; h.style.marginTop = '4px'; h.textContent = 'الكاميرا (العدسة)'; wrap.appendChild(h);
    const seg = document.createElement('div'); seg.className = 'segs';
    pick.forEach((d, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = String(i + 1); b.title = d.label || '';
      b.className = d.deviceId === st.deviceId ? 'on' : '';
      b.onclick = () => switchCamera(d.deviceId);
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
  }).catch(() => { /* labels unavailable */ });
}
function buildCamRows(body) {
  const L = S.live;
  if (!L) return;
  const c = L.caps || {}, tr = L.track;
  let any = 0;
  camInfo(body);
  const apply = adv => { tr.applyConstraints({ advanced: [adv] }).catch(() => { /* unsupported */ }); };
  const st = tr.getSettings ? tr.getSettings() : {};
  const row = (key, label, fmt, onSet) => {
    const cap = c[key];
    if (!cap || cap.min == null || cap.max == null || cap.max === cap.min) return;
    const cur = st[key] != null ? st[key] : (cap.min + cap.max) / 2;
    const step = cap.step || (cap.max - cap.min) / 100;
    body.appendChild(sliderRow({ k: 'cam_' + key, label, min: cap.min, max: cap.max, step, def: cur, fmt }, () => cur, onSet));
    any++;
  };
  row('exposureCompensation', 'تعريض الكاميرا', v => (v > 0 ? '+' : '') + (+v).toFixed(1), v => apply({ exposureCompensation: v }));
  row('iso', 'ISO', v => String(Math.round(v)), v => apply({ exposureMode: 'manual', iso: v }));
  row('exposureTime', 'السرعة', v => { const s = v * 1e-4; return s >= 0.25 ? s.toFixed(1) + 's' : '1/' + Math.round(1 / s); }, v => apply({ exposureMode: 'manual', exposureTime: v }));
  row('colorTemperature', 'توازن الأبيض', v => Math.round(v) + 'K', v => apply({ whiteBalanceMode: 'manual', colorTemperature: v }));
  row('focusDistance', 'التركيز', v => (+v).toFixed(2) + 'm', v => apply({ focusMode: 'manual', focusDistance: v }));
  if (c.torch) {
    const t = document.createElement('button'); t.type = 'button'; t.className = 'tg' + (S.flash ? ' on' : '');
    t.innerHTML = '<span>الفلاش المستمر</span><i></i>';
    t.onclick = async () => { await toggleFlash(); t.classList.toggle('on', S.flash); };
    body.appendChild(t); any++;
  }
  if (!any) {
    const n = document.createElement('div'); n.className = 'note';
    n.textContent = 'هذا الجهاز أو المتصفح لا يكشف التحكم اليدوي للكاميرا. تبقى كل ضبطات الصورة والفلاتر متاحة.';
    body.appendChild(n);
    return;
  }
  const a = document.createElement('button'); a.type = 'button'; a.className = 'btnw'; a.textContent = 'رجوع للضبط التلقائي';
  a.onclick = () => { apply({ exposureMode: 'continuous', whiteBalanceMode: 'continuous', focusMode: 'continuous' }); buildPro('cam'); toast('عاد الضبط التلقائي', 1200); };
  body.appendChild(a);
}

/* ---------- capture ---------- */
async function grabLivePhoto(L) {
  const mirror = S.facing === 'user' && S.set.mirror;
  const o = { zoom: L.sw, cx: 0.5, cy: 0.5, mirror };
  const vw = L.video.videoWidth, vh = L.video.videoHeight;
  if (L.ic) {
    try {
      const opts = {};
      if (L.pcaps === undefined) L.pcaps = await L.ic.getPhotoCapabilities().catch(() => null);
      const pc = L.pcaps;
      if (pc && pc.imageWidth && pc.imageHeight && pc.imageWidth.max) {
        const w = clamp(S.set.photoCap || 4096, pc.imageWidth.min || 1, pc.imageWidth.max);
        opts.imageWidth = w; opts.imageHeight = Math.round(w * pc.imageHeight.max / pc.imageWidth.max);
      }
      if (S.flash && pc && pc.fillLightMode && pc.fillLightMode.indexOf('flash') >= 0) opts.fillLightMode = 'flash';
      const blob = await L.ic.takePhoto(opts);
      const bmp = await createImageBitmap(blob);
      try {
        const pw = dimW(bmp), ph = dimH(bmp);
        if ((pw >= ph) === (vw >= vh)) return await renderPhoto(bmp, pw, ph, o);
      } finally { if (bmp.close) bmp.close(); }
    } catch (e) { /* fall back to a video frame */ }
  }
  return renderPhoto(L.video, vw, vh, o);
}
async function capturePhoto() {
  const L = S.live;
  if (!L || S.shooting || S.baking) return;
  S.shooting = true;
  try {
    if (S.timer && !(await countdown(S.timer))) return;
    if (!S.live) return;
    shutterSound(); tick(14); flashAnim();
    const r = await grabLivePhoto(S.live);
    const it = await addItem('photo', r.blob, r.w, r.h, r.thumb);
    if (S.set.autosave) { deliver(it, true).then(res => { if (res !== 'saved') toast('حُفظت في المكتبة', 1400); }); toast('تم الحفظ ✓', 1200); }
    else toast('حُفظت في المكتبة', 1400);
  } catch (e) { toast('تعذّر التقاط الصورة'); }
  finally { S.shooting = false; }
}
function recTick() {
  const R = S.rec;
  if (!R) return;
  const s = Math.floor((performance.now() - R.t0) / 1000);
  $('#badge').textContent = '● REC ' + pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}
async function startRec() {
  const L = S.live;
  if (!L || S.rec || S.shooting) return;
  const mime = pickMime();
  if (!mime || !view || !view.canvas.captureStream) { toast('هذا المتصفح لا يدعم تسجيل الفيديو'); return; }
  S.shooting = true;
  try {
    if (S.timer && !(await countdown(S.timer))) return;
    if (!S.live) return;
    if (!L.audio) {
      try { L.audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
      catch (e) { toast('سيُسجَّل بدون صوت (لم يُمنح إذن المايك)', 2600); }
    }
    const stream = view.canvas.captureStream(30);
    if (L.audio) L.audio.getAudioTracks().forEach(t => stream.addTrack(t));
    const hi = S.set.vq !== 720, chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: hi ? 10e6 : 6e6, audioBitsPerSecond: 128e3 });
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const R = { rec, chunks, mime, t0: performance.now(), W: view.W, H: view.H, thumb: '', iv: 0 };
    rec.onstop = () => finishRec(R);
    S.rec = R;
    S.snap = cv => { R.thumb = makeThumb(cv, cv.width, cv.height); };
    rec.start(1000);
    R.iv = setInterval(recTick, 250);
    shutterSound(); tick(18);
    updateUI(); recTick();
  } catch (e) { S.rec = null; toast('تعذّر بدء التسجيل'); updateUI(); }
  finally { S.shooting = false; }
}
function stopRec() {
  const R = S.rec;
  if (!R) return;
  try { if (R.rec.state !== 'inactive') R.rec.stop(); } catch (e) { finishRec(R); }
  tick(18);
}
async function finishRec(R) {
  if (R.done) return;
  R.done = true;
  clearInterval(R.iv);
  const dur = (performance.now() - R.t0) / 1000;
  S.rec = null; S.snap = null; updateUI();
  try {
    const blob = new Blob(R.chunks, { type: R.mime.split(';')[0] });
    if (!blob.size) throw new Error('empty');
    const it = await addItem('video', blob, R.W, R.H, R.thumb, dur);
    if (S.set.autosave) { deliver(it, true).then(res => { if (res !== 'saved') toast('حُفظ في المكتبة', 1400); }); toast('تم حفظ الفيديو ✓', 1400); }
    else toast('حُفظ الفيديو في المكتبة', 1600);
  } catch (e) { toast('تعذّر حفظ الفيديو'); }
}

/* ---------- main buttons ---------- */
function setMode(m) {
  if (m === S.mode || S.rec || S.shooting) return;
  const A = store.get('aspects', { photo: 'orig', video: '16:9' });
  A[S.mode] = S.aspect;
  S.mode = m; S.aspect = A[m] || (m === 'video' ? '16:9' : 'orig');
  store.set('aspects', A);
  updateUI(); layout(); tick();
}
function saveAspect() {
  const A = store.get('aspects', { photo: 'orig', video: '16:9' });
  A[S.mode] = S.aspect; store.set('aspects', A);
}
function onShutter() {
  if (S.baking) return;
  if (S.counting) { cdCancel = true; return; }
  if (S.live) {
    if (S.mode === 'photo') capturePhoto();
    else if (S.rec) stopRec(); else startRec();
    return;
  }
  (S.mode === 'photo' ? $('#inCamPhoto') : $('#inCamVideo')).click();
}
function saveCurrent() {
  const s = S.src;
  if (!s || S.baking) return;
  if (s.kind === 'image' || s.kind === 'sample') saveImageSource(s);
  else if (s.kind === 'video') saveVideoSource(s);
}
function onSide() {
  if (S.live) flipCamera(); else saveCurrent();
}
function togglePlay() {
  const s = S.src;
  if (!s || s.kind !== 'video') return;
  if (s.el.paused) s.el.play().catch(() => { /* ignore */ }); else s.el.pause();
  $('#btnPlay').hidden = !s.el.paused;
}

/* ---------- wiring ---------- */
function wire() {
  IC.add = svg('<rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3"/><path d="M12 8.6v6.8M8.6 12h6.8"/>');
  $('#btnSet').innerHTML = IC.sliders; $('#btnImport').innerHTML = IC.add; $('#btnCmp').innerHTML = IC.compare;
  $('#btnGrid').innerHTML = IC.grid; $('#btnPlay').innerHTML = IC.play;
  $('#vClose').innerHTML = IC.close; $('#vDel').innerHTML = IC.trash; $('#vPrev').innerHTML = IC.prev; $('#vNext').innerHTML = IC.next;
  const on = (sel, ev, fn, o) => $(sel).addEventListener(ev, fn, o);

  on('#btnFmt', 'click', () => {
    if (S.mode === 'photo') { const l = [8192, 4096, 2560, 1600]; S.set.photoCap = l[(l.indexOf(S.set.photoCap) + 1) % l.length] || 4096; }
    else S.set.vq = S.set.vq === 720 ? 1080 : 720;
    store.set('set', S.set); updateUI(); layout(); tick();
  });
  on('#btnAspect', 'click', () => { S.aspect = ASPECTS[(ASPECTS.indexOf(S.aspect) + 1) % ASPECTS.length]; saveAspect(); layout(); tick(); });
  on('#btnLive', 'click', toggleLive);
  on('#btnFlash', 'click', toggleFlash);
  on('#btnTimer', 'click', cycleTimer);
  on('#btnImport', 'click', () => $('#inGallery').click());
  on('#btnSet', 'click', () => { buildSettings(); openSheet('#shSet'); });
  on('#btnM', 'click', () => { buildPro(); openSheet('#shPro'); });
  on('#proTabs', 'click', e => { const b = e.target.closest('button[data-p]'); if (b) buildPro(b.dataset.p); });
  on('#btnGrid', 'click', () => { S.set.grid = !S.set.grid; store.set('set', S.set); applySettings(); });
  on('#btnPlay', 'click', togglePlay);
  on('#lens', 'click', e => {
    const b = e.target.closest('button[data-z]');
    if (b && S.live) { setZoom(+b.dataset.z, true); tick(8); }
  });
  const hold = v => { S.bypass = v; redraw(); };
  on('#btnCmp', 'pointerdown', e => { e.stopPropagation(); hold(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => on('#btnCmp', ev, () => { if (S.bypass) hold(false); }));
  on('#tabs', 'click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'none') { if (S.lookId === 'none') selectLook(S.prevLook || FILMS.DEFAULT); else selectLook('none'); return; }
    S.cat = k; updateTabs(); buildShelf(); tick(6);
  });
  on('#shelf', 'click', e => {
    const f = e.target.closest('.fv');
    if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); return; }
    const b = e.target.closest('.it'); if (b) selectLook(b.dataset.id);
  });
  on('#modes', 'click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
  on('#btnShutter', 'click', onShutter);
  on('#btnLib', 'click', () => openViewer(0));
  on('#btnSide', 'click', onSide);
  on('#scrim', 'click', closeSheets);
  on('#vClose', 'click', closeViewer);
  on('#vDel', 'click', viewerDelete);
  on('#vPrev', 'click', () => { if (vIdx > 0) { vIdx--; $('#vMsg').textContent = ''; showItem(); } });
  on('#vNext', 'click', () => { if (vIdx < S.lib.length - 1) { vIdx++; $('#vMsg').textContent = ''; showItem(); } });
  on('#vSave', 'click', viewerSave);
  on('#vShare', 'click', viewerShare);
  on('#bakeCancel', 'click', () => { if (bakeCancel) bakeCancel(); });
  const inp = (sel, cam) => on(sel, 'change', e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) importFiles(f, cam); });
  inp('#inCamPhoto', true); inp('#inCamVideo', true); inp('#inGallery', false);
  on('#inFont', 'change', e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) importFonts(f); });

  /* viewer swipe */
  let vx = null;
  on('#vBody', 'pointerdown', e => { if (e.target.closest('button') || e.target.tagName === 'VIDEO') return; vx = e.clientX; });
  on('#vBody', 'pointerup', e => {
    if (vx == null) return;
    const dx = e.clientX - vx; vx = null;
    if (dx < -60 && vIdx < S.lib.length - 1) { vIdx++; showItem(); }
    else if (dx > 60 && vIdx > 0) { vIdx--; showItem(); }
  });

  /* viewfinder gestures: swipe = next/prev film, tap = focus / play, pinch = zoom, double tap = flip */
  const fr = $('#frame'), ptrs = new Map();
  let g = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 };
  const dist = () => { const a = Array.from(ptrs.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  fr.addEventListener('pointerdown', e => {
    if (e.target.closest('button, #lens')) return;
    try { fr.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && S.live) { pinch = { d0: dist(), z0: S.live.z }; g = null; }
    else if (ptrs.size === 1) g = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  });
  fr.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) { setZoom(pinch.z0 * dist() / pinch.d0); return; }
    if (g && (Math.abs(e.clientX - g.x) > 14 || Math.abs(e.clientY - g.y) > 14)) g.moved = true;
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    const was = ptrs.size;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; return; }
    if (!g || was !== 1) { g = null; return; }
    const dx = e.clientX - g.x, dy = e.clientY - g.y, dt = performance.now() - g.t, gg = g;
    g = null;
    if (e.type === 'pointercancel') return;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) { stepLook(dx < 0 ? 1 : -1); return; }
    if (gg.moved || dt > 450) return;
    const r = fr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40 && S.live) { lastTap.t = 0; flipCamera(); return; }
    lastTap = { t: now, x, y };
    if (S.live) { showRing(x, y); focusAt(x / r.width, y / r.height); }
    else if (S.src && S.src.kind === 'video') togglePlay();
  };
  fr.addEventListener('pointerup', up);
  fr.addEventListener('pointercancel', up);

  document.addEventListener('contextmenu', e => { if (!e.target.closest('#viewer')) e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheets(); closeViewer(); }
    else if (e.key === 'ArrowRight' && !$('#viewer').classList.contains('open')) stepLook(1);
    else if (e.key === 'ArrowLeft' && !$('#viewer').classList.contains('open')) stepLook(-1);
  });
  document.addEventListener('visibilitychange', () => {
    const L = S.live;
    if (document.hidden) { wake(false); return; }
    if (L && L.track.readyState === 'ended') { const f = S.facing; stopLive(true); startLive(f); }
    else if (L) wake(true);
  });
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe($('#stage'));
  window.addEventListener('resize', layout);
}

/* ---------- start ---------- */
(async function init() {
  const A = store.get('aspects', { photo: 'orig', video: '16:9' });
  S.aspect = A[S.mode] || 'orig';
  detectLive();
  fontsLoad().then(n => { if (n) buildSettings(); });
  wire(); buildTabs(); buildShelf(); buildSettings(); buildPro('adj'); applySettings();
  if (!getView()) return;
  try { await loadSample(); } catch (e) { $('#hint').textContent = 'تعذّر تحميل الصورة التجريبية'; }
  libLoad();
  updateUI();
  window.__FC = { S, FILMS, FL, selectLook, importFiles, importFonts, fontFaces, saveCurrent, startLive, stopLive, capturePhoto, startRec, stopRec, setZoom, setMode, deliver, lutFor, paramsFor, layout, redraw, openViewer, closeViewer, addItem, bakeBlob, pickMime, getView, getExp, saveBlob, buildPro, stepLook, canArt };
  if (S.canLive && !EMBEDDED && !new URLSearchParams(location.search).has('nolive')) startLive();
})();
