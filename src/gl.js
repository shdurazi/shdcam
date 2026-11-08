/* ===== gl.js : WebGL2 film engine (grade -> glow chain -> grain/vignette) ===== */
(function (root) {
  'use strict';

  function gauss(n, sigma) {
    var w = [], s = 0, i, v;
    for (i = 0; i <= n; i++) { v = Math.exp(-i * i / (2 * sigma * sigma)); w.push(v); s += i ? 2 * v : v; }
    return w.map(function (x) { return x / s; });
  }
  var GW = gauss(6, 2.4).map(function (v) { return v.toFixed(6); }).join(',');

  var VS = '#version 300 es\n' +
    'in vec2 aPos; out vec2 vUv;\n' +
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FS_GRADE = '#version 300 es\n' +
    'precision highp float; precision highp sampler3D;\n' +
    'in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uSrc; uniform sampler3D uLut;\n' +
    'uniform vec2 uCrop; uniform vec2 uCenter; uniform float uZoom; uniform float uMirror;\n' +
    'uniform float uEV; uniform vec3 uWB; uniform float uInt; uniform float uCon; uniform float uSat; uniform float uLutN;\n' +
    'vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }\n' +
    'vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }\n' +
    'void main(){\n' +
    '  vec2 p = vec2(vUv.x, 1.0 - vUv.y) - 0.5;\n' +
    '  if (uMirror > 0.5) p.x = -p.x;\n' +
    '  vec2 suv = uCenter + p * uCrop / uZoom;\n' +
    '  vec3 c = texture(uSrc, suv).rgb;\n' +
    '  vec3 l = toLin(c) * exp2(uEV) * uWB;\n' +
    '  vec3 pre = clamp(toSrgb(max(l, 0.0)), 0.0, 1.0);\n' +
    '  vec3 g = texture(uLut, pre * ((uLutN - 1.0) / uLutN) + 0.5 / uLutN).rgb;\n' +
    '  vec3 col = mix(pre, g, uInt);\n' +
    '  float y = dot(col, vec3(0.2126, 0.7152, 0.0722));\n' +
    '  col = mix(vec3(y), col, uSat);\n' +
    '  col = (col - 0.5) * uCon + 0.5;\n' +
    '  o = vec4(clamp(col, 0.0, 1.0), 1.0);\n' +
    '}';

  var FS_BRIGHT = '#version 300 es\n' +
    'precision highp float; in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uTex; uniform vec2 uCell; uniform vec2 uThr;\n' +
    'void main(){\n' +
    '  vec3 acc = vec3(0.0);\n' +
    '  for (int j = 0; j < 6; j++) for (int i = 0; i < 6; i++) {\n' +
    '    vec2 off = (vec2(float(i), float(j)) + 0.5) / 6.0 - 0.5;\n' +
    '    vec3 c = texture(uTex, vUv + off * uCell).rgb;\n' +
    '    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\n' +
    '    acc += c * smoothstep(uThr.x, uThr.y, l);\n' +
    '  }\n' +
    '  o = vec4(acc / 36.0, 1.0);\n' +
    '}';

  var FS_DOWN = '#version 300 es\n' +
    'precision highp float; in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uTex; uniform vec2 uCell;\n' +
    'void main(){\n' +
    '  vec3 acc = vec3(0.0);\n' +
    '  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {\n' +
    '    vec2 off = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;\n' +
    '    acc += texture(uTex, vUv + off * uCell).rgb;\n' +
    '  }\n' +
    '  o = vec4(acc / 16.0, 1.0);\n' +
    '}';

  var FS_BLUR = '#version 300 es\n' +
    'precision highp float; in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uTex; uniform vec2 uDir;\n' +
    'const float W[7] = float[7](' + GW + ');\n' +
    'void main(){\n' +
    '  vec3 acc = texture(uTex, vUv).rgb * W[0];\n' +
    '  for (int i = 1; i < 7; i++) { vec2 d = uDir * float(i); acc += (texture(uTex, vUv + d).rgb + texture(uTex, vUv - d).rgb) * W[i]; }\n' +
    '  o = vec4(acc, 1.0);\n' +
    '}';

  var FS_FINAL = '#version 300 es\n' +
    'precision highp float; precision highp int;\n' +
    'in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uMain; uniform sampler2D uB1; uniform sampler2D uB2;\n' +
    'uniform float uGrain; uniform float uGrainSize; uniform float uGrainChroma; uniform float uSeed;\n' +
    'uniform float uGlow; uniform float uHal; uniform vec3 uHalCol; uniform float uVig;\n' +
    'uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }\n' +
    'float h21(vec2 p, float seed){ uvec2 q = uvec2(ivec2(floor(p))); uint s = pcg(q.x + pcg(q.y + pcg(uint(seed)))); return float(s) * (1.0 / 4294967295.0); }\n' +
    'float vnoise(vec2 p, float seed){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
    '  float a = h21(i, seed), b = h21(i + vec2(1.0, 0.0), seed), c = h21(i + vec2(0.0, 1.0), seed), d = h21(i + vec2(1.0, 1.0), seed);\n' +
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }\n' +
    'float grainN(vec2 px, float gs, float seed){\n' +
    '  vec2 p = px / gs;\n' +
    '  return 0.5 * vnoise(p, seed) + 0.3 * vnoise(p * 2.0 + 17.3, seed + 1.0) + 0.2 * h21(floor(px), seed + 2.0);\n' +
    '}\n' +
    'void main(){\n' +
    '  vec3 col = texture(uMain, vUv).rgb;\n' +
    '  vec3 g = texture(uB1, vUv).rgb * 0.62 + texture(uB2, vUv).rgb * 0.38;\n' +
    '  col = 1.0 - (1.0 - col) * (1.0 - clamp(g * uGlow, 0.0, 1.0));\n' +
    '  col += uHalCol * g * uHal;\n' +
    '  vec2 q = (vUv - 0.5) * 2.0;\n' +
    '  float v = smoothstep(0.3, 2.0, dot(q, q));\n' +
    '  col *= 1.0 - uVig * 0.6 * v;\n' +
    '  if (uGrain > 0.001) {\n' +
    '    vec2 px = gl_FragCoord.xy;\n' +
    '    float nl = grainN(px, uGrainSize, uSeed);\n' +
    '    vec3 n3 = vec3(nl);\n' +
    '    if (uGrainChroma > 0.001) {\n' +
    '      vec3 nc = vec3(grainN(px + 31.0, uGrainSize, uSeed + 5.0), grainN(px + 67.0, uGrainSize, uSeed + 9.0), grainN(px + 113.0, uGrainSize, uSeed + 13.0));\n' +
    '      n3 = mix(n3, nc, uGrainChroma);\n' +
    '    }\n' +
    '    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));\n' +
    '    float w = 0.25 + 0.75 * smoothstep(0.02, 0.35, lum) * (1.0 - 0.55 * smoothstep(0.65, 1.0, lum));\n' +
    '    col += (n3 - 0.5) * uGrain * 0.34 * w;\n' +
    '  }\n' +
    '  col += (h21(gl_FragCoord.xy, uSeed + 40.0) - 0.5) / 255.0;\n' +
    '  o = vec4(clamp(col, 0.0, 1.0), 1.0);\n' +
    '}';

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function makeProg(gl, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return { prog: p, u: {} };
  }
  function loc(gl, P, n) {
    var l = P.u[n];
    if (l === undefined) { l = gl.getUniformLocation(P.prog, n); P.u[n] = l; }
    return l;
  }
  function makeRT(gl, w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex: tex, fbo: fbo, w: w, h: h };
  }
  function freeRT(gl, rt) { if (rt) { gl.deleteTexture(rt.tex); gl.deleteFramebuffer(rt.fbo); } }

  function Engine(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('webgl2-unavailable');
    this.canvas = canvas; this.gl = gl;
    this.pGrade = makeProg(gl, FS_GRADE);
    this.pBright = makeProg(gl, FS_BRIGHT);
    this.pDown = makeProg(gl, FS_DOWN);
    this.pBlur = makeProg(gl, FS_BLUR);
    this.pFinal = makeProg(gl, FS_FINAL);
    var vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.texSrc = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texSrc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    this.srcW = 0; this.srcH = 0;
    this.texLut = gl.createTexture();
    this.lutN = 33; this.hasLut = false;
    this.rt = {};
    this.W = 0; this.H = 0;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var self = this;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.lost = true; });
    canvas.addEventListener('webglcontextrestored', function () { self.lost = false; if (self.onrestore) self.onrestore(); });
  }

  Engine.prototype.setSize = function (W, H) {
    var gl = this.gl;
    W = Math.max(16, Math.min(W | 0, this.maxTex)); H = Math.max(16, Math.min(H | 0, this.maxTex));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.canvas.width = W; this.canvas.height = H;
    var k, rt = this.rt;
    for (k in rt) freeRT(gl, rt[k]);
    var q1w = 320, q1h = Math.max(8, Math.round(320 * H / W)), q2w = 96, q2h = Math.max(8, Math.round(96 * H / W));
    if (W < 320) { q1w = Math.max(16, W >> 1); q1h = Math.max(8, Math.round(q1w * H / W)); }
    rt.main = makeRT(gl, W, H);
    rt.q1a = makeRT(gl, q1w, q1h); rt.q1b = makeRT(gl, q1w, q1h);
    rt.q2a = makeRT(gl, q2w, q2h); rt.q2b = makeRT(gl, q2w, q2h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  Engine.prototype.setLUT = function (data, N) {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.texLut);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, N, N, N, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    this.lutN = N; this.hasLut = true;
  };

  Engine.prototype.upload = function (el, w, h) {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texSrc);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (w !== this.srcW || h !== this.srcH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      this.srcW = w; this.srcH = h;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el);
    }
  };

  function bindRT(gl, rt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
    gl.viewport(0, 0, rt ? rt.w : gl.drawingBufferWidth, rt ? rt.h : gl.drawingBufferHeight);
  }
  function tex2D(gl, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  /* P: {zoom,cx,cy,mirror,ev,wb,intensity,con,sat,grain,gsize,gchroma,glow,hal,halCol,vig,seed} */
  Engine.prototype.render = function (P) {
    var gl = this.gl, rt = this.rt, W = this.W, H = this.H;
    if (this.lost || !this.hasLut || !rt.main) return;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    var sw = this.srcW || 1, sh = this.srcH || 1, sa = sw / sh, ca = W / H;
    var cropX = sa > ca ? ca / sa : 1, cropY = sa > ca ? 1 : sa / ca;
    var zoom = Math.max(1, P.zoom || 1);
    var hx = 0.5 * cropX / zoom, hy = 0.5 * cropY / zoom;
    var cx = Math.min(1 - hx, Math.max(hx, P.cx == null ? 0.5 : P.cx));
    var cy = Math.min(1 - hy, Math.max(hy, P.cy == null ? 0.5 : P.cy));

    /* A: grade */
    var p = this.pGrade;
    gl.useProgram(p.prog);
    bindRT(gl, rt.main);
    tex2D(gl, 0, this.texSrc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.texLut);
    gl.uniform1i(loc(gl, p, 'uSrc'), 0);
    gl.uniform1i(loc(gl, p, 'uLut'), 1);
    gl.uniform2f(loc(gl, p, 'uCrop'), cropX, cropY);
    gl.uniform2f(loc(gl, p, 'uCenter'), cx, cy);
    gl.uniform1f(loc(gl, p, 'uZoom'), zoom);
    gl.uniform1f(loc(gl, p, 'uMirror'), P.mirror ? 1 : 0);
    gl.uniform1f(loc(gl, p, 'uEV'), P.ev || 0);
    var wb = P.wb || [1, 1, 1];
    gl.uniform3f(loc(gl, p, 'uWB'), wb[0], wb[1], wb[2]);
    gl.uniform1f(loc(gl, p, 'uInt'), P.intensity == null ? 1 : P.intensity);
    gl.uniform1f(loc(gl, p, 'uCon'), P.con == null ? 1 : P.con);
    gl.uniform1f(loc(gl, p, 'uSat'), P.sat == null ? 1 : P.sat);
    gl.uniform1f(loc(gl, p, 'uLutN'), this.lutN);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* B: glow chain */
    var chain = (P.glow || 0) > 0.001 || (P.hal || 0) > 0.001;
    if (chain) {
      p = this.pBright;
      gl.useProgram(p.prog);
      bindRT(gl, rt.q1a);
      tex2D(gl, 0, rt.main.tex);
      gl.uniform1i(loc(gl, p, 'uTex'), 0);
      gl.uniform2f(loc(gl, p, 'uCell'), 1 / rt.q1a.w, 1 / rt.q1a.h);
      gl.uniform2f(loc(gl, p, 'uThr'), 0.5, 0.98);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._blur(rt.q1a, rt.q1b, 1.35);
      p = this.pDown;
      gl.useProgram(p.prog);
      bindRT(gl, rt.q2a);
      tex2D(gl, 0, rt.q1a.tex);
      gl.uniform1i(loc(gl, p, 'uTex'), 0);
      gl.uniform2f(loc(gl, p, 'uCell'), 1 / rt.q2a.w, 1 / rt.q2a.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._blur(rt.q2a, rt.q2b, 1.35);
    }

    /* C: final */
    p = this.pFinal;
    gl.useProgram(p.prog);
    bindRT(gl, null);
    tex2D(gl, 0, rt.main.tex);
    tex2D(gl, 1, rt.q1a.tex);
    tex2D(gl, 2, rt.q2a.tex);
    gl.uniform1i(loc(gl, p, 'uMain'), 0);
    gl.uniform1i(loc(gl, p, 'uB1'), 1);
    gl.uniform1i(loc(gl, p, 'uB2'), 2);
    gl.uniform1f(loc(gl, p, 'uGrain'), P.grain || 0);
    gl.uniform1f(loc(gl, p, 'uGrainSize'), Math.max(0.85, (P.gsize || 1) * (W / 1080)));
    gl.uniform1f(loc(gl, p, 'uGrainChroma'), P.gchroma || 0);
    gl.uniform1f(loc(gl, p, 'uSeed'), P.seed || 0);
    gl.uniform1f(loc(gl, p, 'uGlow'), chain ? (P.glow || 0) : 0);
    gl.uniform1f(loc(gl, p, 'uHal'), chain ? (P.hal || 0) : 0);
    var hc = P.halCol || [1, 0.42, 0.16];
    gl.uniform3f(loc(gl, p, 'uHalCol'), hc[0], hc[1], hc[2]);
    gl.uniform1f(loc(gl, p, 'uVig'), P.vig || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Engine.prototype._blur = function (a, b, stride) {
    var gl = this.gl, p = this.pBlur;
    gl.useProgram(p.prog);
    gl.uniform1i(loc(gl, p, 'uTex'), 0);
    bindRT(gl, b); tex2D(gl, 0, a.tex);
    gl.uniform2f(loc(gl, p, 'uDir'), stride / a.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    bindRT(gl, a); tex2D(gl, 0, b.tex);
    gl.uniform2f(loc(gl, p, 'uDir'), 0, stride / a.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Engine.prototype.dispose = function () {
    var gl = this.gl, k;
    for (k in this.rt) freeRT(gl, this.rt[k]);
    var ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  };

  root.FilmEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
