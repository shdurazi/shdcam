/* ===== films.js : look library ===== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FILMS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = [
    {
      id: 'film', name: 'Film', items: [
        {
          id: 'ektar100', name: 'Kodak Ektar 100', art: { k: 'can', body: '#ee5a3c', band: '#a8321f', text: '100', tc: '#fff3e6' },
          look: {
            tone: { contrast: 1.22, shoulder: 0.2, knee: 0.76, clip: 0.008, gain: [1.03, 1, 0.97], gamma: [1.01, 1, 0.99] },
            sat: 1.22,
            hue: { r: [-2, 1.18, 0], o: [-1, 1.1, 0], y: [0, 1.12, 0], g: [2, 1.15, -0.01], c: [0, 1.1, 0], b: [-2, 1.16, -0.01], m: [0, 1.08, 0] },
            fx: { grain: 0.16, gsize: 0.85, gchroma: 0.12, glow: 0.03, hal: 0.04, vig: 0.14 }
          }
        },
        {
          id: 'ek80', name: 'Kodak EK80', art: { k: 'can', body: '#1f6f78', band: '#134a52', text: '80', tc: '#e8fbf8' },
          look: {
            tone: { contrast: 1.15, shoulder: 0.18, knee: 0.78, clip: 0.015, gain: [0.99, 1, 1.03], gamma: [0.99, 1, 1.02], lift: [0, 0, 0.004] },
            split: { sh: [-0.006, 0, 0.012], hi: [-0.004, 0, 0.008] },
            sat: 1.12, vib: 0.1,
            hue: { r: [1, 1.1, 0], o: [-2, 1.04, 0], y: [0, 1.05, 0], g: [4, 1.08, -0.01], c: [0, 1.12, 0], b: [-3, 1.16, -0.01], m: [0, 1.05, 0] },
            fx: { grain: 0.2, gsize: 0.9, gchroma: 0.15, glow: 0.04, hal: 0, vig: 0.18 }
          }
        },
        {
          id: 'chrome64', name: 'Kodak Chrome 64', art: { k: 'can', body: '#7a1f33', band: '#4e1220', text: '64', tc: '#f6d27a' },
          look: {
            tone: { contrast: 1.2, pivot: 0.52, shoulder: 0.2, knee: 0.76, clip: 0.02, gain: [1.05, 1, 0.9], gamma: [1.03, 1, 0.96], lift: [0.004, 0, 0.01] },
            split: { sh: [-0.004, 0, 0.01], hi: [0.016, 0.01, -0.018] },
            sat: 1.1, vib: 0.05,
            hue: { r: [-3, 1.2, -0.01], o: [0, 1.08, 0], y: [-7, 1.1, 0], g: [-10, 0.85, -0.02], c: [6, 1.05, -0.01], b: [5, 1.1, -0.03], m: [-6, 1, 0] },
            fx: { grain: 0.28, gsize: 1, gchroma: 0.18, glow: 0.05, hal: 0.05, vig: 0.22 }
          }
        },
        {
          id: 'fp100', name: 'Fuji FP100', art: { k: 'can', body: '#cfe9d8', band: '#7fb996', text: '100', tc: '#14573a' },
          look: {
            tone: { contrast: 0.96, shoulder: 0.3, knee: 0.72, gain: [1.03, 1, 0.95], gamma: [0.99, 1.03, 1.02], lift: [0.02, 0.03, 0.034] },
            split: { sh: [-0.012, 0.006, 0.016], hi: [0.014, 0.01, -0.01] },
            sat: 0.94, vib: 0.15,
            hue: { r: [-2, 1.04, 0], o: [-4, 1, 0.01], y: [2, 0.95, 0.01], g: [9, 0.98, -0.01], c: [-3, 1.05, 0], b: [-6, 1.02, 0], m: [0, 0.9, 0] },
            fx: { grain: 0.32, gsize: 1, gchroma: 0.2, glow: 0.14, hal: 0.1, vig: 0.26 }
          }
        },
        {
          id: 'natura1600', name: 'Fuji Natura 1600', art: { k: 'can', body: '#2a2d33', band: '#16181c', text: '1600', tc: '#cfd5dc', cap: '#6a6d76' },
          look: {
            tone: { contrast: 0.94, shoulder: 0.35, knee: 0.68, gain: [1, 0.99, 0.97], gamma: [0.98, 1.02, 1.03], lift: [0.02, 0.03, 0.036] },
            split: { sh: [-0.01, 0.012, 0.012], hi: [0.014, 0.002, 0.006] },
            sat: 0.9, vib: 0.1,
            hue: { r: [0, 0.95, 0], o: [0, 0.95, 0.01], y: [3, 0.9, 0], g: [10, 0.88, -0.01], c: [-2, 1, 0], b: [-4, 0.95, 0.01], m: [2, 0.95, 0] },
            fx: { grain: 0.8, gsize: 1.35, gchroma: 0.45, glow: 0.2, hal: 0.14, vig: 0.3 }
          }
        },
        {
          id: 'superia200', name: 'Fuji Superia 200', art: { k: 'can', body: '#6c4bb3', band: '#47307f', text: '200', tc: '#efe6ff' },
          look: {
            tone: { contrast: 1.1, shoulder: 0.2, knee: 0.74, gain: [1, 1, 0.98], gamma: [0.99, 1.04, 1], lift: [0.004, 0.014, 0.014] },
            split: { sh: [-0.008, 0.01, 0.006], hi: [0.008, 0, -0.006] },
            sat: 1.1, vib: 0.05,
            hue: { r: [-3, 1.08, 0], o: [-2, 1.05, 0], y: [3, 1, 0], g: [7, 1.16, -0.01], c: [0, 1.1, 0], b: [-3, 1.14, -0.01], m: [-3, 1.05, 0] },
            fx: { grain: 0.44, gsize: 1.1, gchroma: 0.28, glow: 0.07, hal: 0.1, vig: 0.22 }
          }
        },
        {
          id: 'superia400', name: 'Fuji Superia 400', art: { k: 'can', body: '#b0398f', band: '#7c2466', text: '400', tc: '#ffe6f6' },
          look: {
            tone: { contrast: 1.07, shoulder: 0.26, knee: 0.72, gain: [1.01, 1, 0.97], gamma: [1, 1.03, 0.99], lift: [0.006, 0.016, 0.018] },
            split: { sh: [-0.006, 0.01, 0.008], hi: [0.012, 0.004, -0.01] },
            sat: 1.06, vib: 0.1,
            hue: { r: [-3, 1.06, 0], o: [-3, 1.04, 0], y: [2, 1, 0], g: [5, 1.1, 0], c: [0, 1.08, 0], b: [-3, 1.1, 0], m: [-2, 1.02, 0] },
            fx: { grain: 0.62, gsize: 1.2, gchroma: 0.32, glow: 0.1, hal: 0.14, vig: 0.26 }
          }
        },
        {
          id: 'polaroid669', name: 'Polaroid 669', art: { k: 'pack', body: '#f1ede4', band: '#d9b88a', text: '80', tc: '#6b5336' },
          look: {
            tone: { contrast: 0.92, shoulder: 0.32, knee: 0.68, gain: [1.04, 1.02, 0.9], gamma: [1.02, 1, 0.96], lift: [0.045, 0.05, 0.04] },
            split: { sh: [0.004, 0.012, 0.006], hi: [0.02, 0.014, -0.02] },
            sat: 0.95,
            hue: { r: [-2, 1.05, 0], o: [2, 1.1, 0], y: [-4, 1.1, 0], g: [-8, 0.8, -0.01], c: [-8, 0.8, 0], b: [-10, 0.82, 0.01], m: [-4, 0.9, 0] },
            fx: { grain: 0.3, gsize: 1.7, gchroma: 0.22, glow: 0.32, hal: 0.22, vig: 0.42 }
          }
        },
        {
          id: 'gold200', name: 'Gold 200', art: { k: 'can', body: '#e9a72b', band: '#b0701a', text: '200', tc: '#3b2204' },
          look: {
            tone: { contrast: 1.08, shoulder: 0.2, gain: [1.05, 1, 0.88], gamma: [1.02, 1, 0.95], lift: [0.012, 0.008, 0] },
            split: { sh: [0.006, 0.003, -0.006], hi: [0.018, 0.012, -0.02] },
            sat: 1.08,
            hue: { y: [-4, 1.12, 0.01], o: [0, 1.1, 0.01], g: [-6, 0.95, 0], b: [-4, 0.95, 0] },
            fx: { grain: 0.42, gsize: 1.1, gchroma: 0.25, glow: 0.08, hal: 0.12, vig: 0.24 }
          }
        },
        {
          id: 'portra400', name: 'Portra 400', art: { k: 'can', body: '#f0b9a0', band: '#cf7a62', text: '400', tc: '#5b2417' },
          look: {
            tone: { contrast: 0.98, shoulder: 0.28, knee: 0.7, gain: [1.02, 1, 0.97], gamma: [1.01, 1, 1], lift: [0.012, 0.012, 0.014] },
            split: { sh: [-0.002, 0.004, 0.008], hi: [0.01, 0.006, -0.004] },
            sat: 0.92, vib: 0.1,
            hue: { r: [0, 0.95, 0], o: [0, 1.02, 0.01], y: [0, 0.9, 0.01], g: [4, 0.85, 0.01], c: [0, 0.9, 0], b: [-2, 0.92, 0] },
            fx: { grain: 0.3, gsize: 1, gchroma: 0.2, glow: 0.12, hal: 0.1, vig: 0.2 }
          }
        }
      ]
    },
    {
      id: 'fresh', name: 'Fresh', items: [
        { id: 'airy', name: 'Airy', look: { ev: 0.25, tone: { contrast: 0.92, shoulder: 0.1, gamma: [1, 1.02, 1.03], lift: [0.02, 0.025, 0.03] }, sat: 0.92, hue: { b: [-4, 0.9, 0.02], g: [5, 0.85, 0.02] }, fx: { grain: 0.12, glow: 0.28, hal: 0.06, vig: 0.06 } } },
        { id: 'peach', name: 'Peach', look: { tone: { contrast: 0.96, gain: [1.04, 1, 0.94], gamma: [1.03, 1, 0.98], lift: [0.03, 0.02, 0.02] }, sat: 1, hue: { o: [-3, 1.1, 0.02], r: [-3, 1.05, 0] }, fx: { grain: 0.15, glow: 0.3, hal: 0.08, vig: 0.1 } } },
        { id: 'mint', name: 'Mint', look: { ev: 0.1, tone: { contrast: 0.97, gain: [0.98, 1.02, 1], gamma: [0.98, 1.04, 1.03], lift: [0, 0.03, 0.025] }, sat: 1, hue: { g: [8, 1.1, 0.02], c: [0, 1.1, 0.01] }, fx: { grain: 0.14, glow: 0.2, vig: 0.1 } } },
        { id: 'milk', name: 'Milk', look: { ev: 0.35, tone: { contrast: 0.9, gain: [1.03, 1.02, 0.97], lift: [0.03, 0.03, 0.03] }, sat: 0.75, fx: { grain: 0.1, glow: 0.3, vig: 0.04 } } },
        { id: 'sunny', name: 'Sunny', look: { ev: 0.15, tone: { contrast: 1.05, gain: [1.05, 1.02, 0.92] }, sat: 1.2, hue: { y: [-3, 1.1, 0.01] }, fx: { grain: 0.15, glow: 0.12, hal: 0.1, vig: 0.1 } } },
        { id: 'bloom', name: 'Bloom', look: { tone: { contrast: 0.95, gain: [1.03, 0.99, 1.02], gamma: [1.02, 0.99, 1.01], lift: [0.03, 0.02, 0.03] }, sat: 1.02, hue: { m: [0, 1.15, 0.01], r: [-2, 1.05, 0] }, fx: { grain: 0.16, glow: 0.45, hal: 0.15, vig: 0.12 } } }
      ]
    },
    {
      id: 'cine', name: 'Cine', items: [
        { id: 'tealorange', name: 'Teal & Orange', look: { tone: { contrast: 1.15, shoulder: 0.2, gain: [1.04, 1, 0.94], gamma: [1, 0.99, 1.03], lift: [0, 0.008, 0.014] }, split: { sh: [-0.03, 0.012, 0.028], hi: [0.03, 0.012, -0.03] }, sat: 1.05, hue: { o: [-4, 1.15, 0], y: [-6, 1, 0], g: [10, 0.7, -0.02], c: [0, 1.1, -0.02], b: [6, 0.9, -0.03] }, fx: { grain: 0.35, hal: 0.2, glow: 0.12, vig: 0.35 } } },
        { id: 'neonoir', name: 'Neo Noir', look: { tone: { contrast: 1.3, pivot: 0.55, clip: 0.03, shoulder: 0.2, gain: [0.97, 1, 1.05] }, split: { sh: [-0.02, 0, 0.03], hi: [0, 0.005, 0.01] }, sat: 0.7, fx: { grain: 0.5, hal: 0.18, glow: 0.1, vig: 0.5 } } },
        { id: 'warmepic', name: 'Warm Epic', look: { tone: { contrast: 1.12, shoulder: 0.22, gain: [1.06, 1.01, 0.9], gamma: [1.02, 1, 0.96] }, split: { sh: [-0.006, 0.004, 0.012], hi: [0.02, 0.012, -0.024] }, sat: 1.05, hue: { y: [-4, 1.1, 0], g: [-6, 0.85, 0] }, fx: { grain: 0.3, hal: 0.25, glow: 0.14, vig: 0.3 } } },
        { id: 'moodyteal', name: 'Moody Teal', look: { ev: -0.2, tone: { contrast: 1.12, gamma: [0.96, 1.02, 1.02], gain: [1, 1, 1.02] }, split: { sh: [-0.03, 0.025, 0.025] }, sat: 0.85, hue: { g: [10, 0.9, -0.02], c: [0, 1.15, -0.02], o: [-2, 1.1, 0] }, fx: { grain: 0.4, hal: 0.1, glow: 0.1, vig: 0.4 } } },
        { id: 'vintage70', name: 'Vintage 70', look: { tone: { contrast: 1.0, shoulder: 0.3, gain: [1.04, 1, 0.88], gamma: [1.02, 1.01, 0.96], lift: [0.04, 0.045, 0.03] }, split: { sh: [0.006, 0.014, 0.004], hi: [0.02, 0.012, -0.02] }, sat: 0.9, hue: { g: [-6, 0.8, 0], b: [-6, 0.8, 0] }, fx: { grain: 0.7, gsize: 1.3, hal: 0.15, glow: 0.14, vig: 0.4 } } },
        { id: 'bleach', name: 'Bleach Bypass', look: { tone: { contrast: 1.35, clip: 0.02, shoulder: 0.2 }, sat: 0.55, fx: { grain: 0.5, hal: 0.1, glow: 0.06, vig: 0.3 } } },
        { id: 'nightneon', name: 'Night Neon', look: { tone: { contrast: 1.2, clip: 0.01, gain: [1.02, 0.98, 1.04] }, split: { sh: [0.02, -0.01, 0.035], hi: [0.015, -0.006, 0.012] }, sat: 1.15, hue: { m: [0, 1.3, 0], c: [0, 1.2, 0], b: [4, 1.1, 0] }, fx: { grain: 0.4, hal: 0.3, glow: 0.2, vig: 0.4 } } }
      ]
    },
    {
      id: 'city', name: 'City', items: [
        { id: 'manama', name: 'Manama', look: { ev: 0.05, tone: { contrast: 1.05, shoulder: 0.2, gain: [1.05, 1, 0.88], gamma: [1.02, 1, 0.97], lift: [0.03, 0.025, 0.02] }, split: { sh: [-0.01, 0.006, 0.012], hi: [0.02, 0.012, -0.02] }, sat: 0.95, hue: { y: [-3, 1.05, 0], b: [-3, 1.0, -0.01] }, fx: { grain: 0.3, glow: 0.3, hal: 0.2, vig: 0.3 } } },
        { id: 'tokyo', name: 'Tokyo', look: { tone: { contrast: 1.15, gain: [0.98, 1, 1.04] }, split: { sh: [-0.01, 0, 0.03] }, sat: 1.1, hue: { m: [0, 1.3, 0], c: [0, 1.2, 0] }, fx: { grain: 0.35, glow: 0.18, hal: 0.2, vig: 0.3 } } },
        { id: 'berlin', name: 'Berlin', look: { tone: { contrast: 1.12, gain: [0.98, 1, 1.03], lift: [0.008, 0.008, 0.012] }, sat: 0.55, fx: { grain: 0.4, glow: 0.05, vig: 0.28 } } },
        { id: 'nyc', name: 'NYC', look: { tone: { contrast: 1.2, clip: 0.02, shoulder: 0.15, gain: [0.99, 1, 1.03] }, split: { sh: [-0.008, 0, 0.02] }, sat: 0.8, hue: { b: [-4, 1.1, -0.02] }, fx: { grain: 0.4, glow: 0.06, hal: 0.08, vig: 0.3 } } },
        { id: 'dubai', name: 'Dubai', look: { ev: 0.15, tone: { contrast: 1.05, gain: [1.06, 1.02, 0.9] }, split: { hi: [0.02, 0.012, -0.02] }, sat: 1.1, hue: { y: [-3, 1.1, 0.01], b: [-2, 1.05, 0] }, fx: { grain: 0.22, glow: 0.2, hal: 0.14, vig: 0.18 } } },
        { id: 'miami', name: 'Miami', look: { tone: { contrast: 1.04, gain: [1.02, 1, 1.02], lift: [0.025, 0.02, 0.03] }, split: { sh: [0.01, -0.004, 0.018] }, sat: 1.05, hue: { m: [0, 1.25, 0.02], c: [0, 1.15, 0.02], o: [-3, 1.05, 0] }, fx: { grain: 0.2, glow: 0.3, hal: 0.1, vig: 0.15 } } }
      ]
    },
    {
      id: 'bw', name: 'BW', items: [
        { id: 'noir', name: 'Noir', look: { mono: { w: [0.45, 0.45, 0.1] }, tone: { contrast: 1.35, pivot: 0.5, clip: 0.03, shoulder: 0.15 }, fx: { grain: 0.4, glow: 0.05, vig: 0.4 } } },
        { id: 'silver400', name: 'Silver 400', look: { mono: { w: [0.3, 0.59, 0.11] }, tone: { contrast: 1.15, shoulder: 0.2, lift: [0.012, 0.012, 0.012] }, fx: { grain: 0.6, gsize: 1.2, glow: 0.08, vig: 0.28 } } },
        { id: 'softmono', name: 'Soft Mono', look: { mono: { w: [0.33, 0.55, 0.12] }, tone: { contrast: 0.9, shoulder: 0.3, lift: [0.03, 0.03, 0.03] }, fx: { grain: 0.25, glow: 0.25, vig: 0.2 } } },
        { id: 'highkey', name: 'High Key', look: { ev: 0.4, mono: { w: [0.3, 0.59, 0.11] }, tone: { contrast: 1.05, lift: [0.02, 0.02, 0.02] }, fx: { grain: 0.2, glow: 0.2, vig: 0.05 } } },
        { id: 'grain1600', name: 'Grain 1600', look: { mono: { w: [0.35, 0.5, 0.15] }, tone: { contrast: 1.2, shoulder: 0.2, lift: [0.01, 0.01, 0.01] }, fx: { grain: 1.0, gsize: 1.5, gchroma: 0, glow: 0.08, vig: 0.32 } } },
        { id: 'selenium', name: 'Selenium', look: { mono: { w: [0.3, 0.59, 0.11] }, tone: { contrast: 1.12, shoulder: 0.2, lift: [0.01, 0.01, 0.014] }, split: { sh: [-0.015, -0.005, 0.022], hi: [0.006, 0.004, 0] }, fx: { grain: 0.45, glow: 0.08, vig: 0.28 } } },
        { id: 'sepia', name: 'Sepia', look: { mono: { w: [0.3, 0.59, 0.11] }, tone: { contrast: 1.0, shoulder: 0.25, lift: [0.025, 0.02, 0.014] }, split: { sh: [0.05, 0.02, -0.04], hi: [0.05, 0.03, -0.045] }, fx: { grain: 0.4, glow: 0.12, vig: 0.4 } } }
      ]
    }
  ];

  var byId = {};
  CATS.forEach(function (c) { c.items.forEach(function (it) { it.cat = c.id; byId[it.id] = it; }); });
  byId.none = { id: 'none', name: 'Original', cat: 'none', look: {} };

  return { CATS: CATS, byId: byId, DEFAULT: 'fp100' };
});
