/* Текстуры на canvas для блокнота с ценами. Взято из библиотеки A.C.EON (library/js/textures.js):
   генератор случайных чисел с зерном, периодический шум и дерево столешницы. */

import * as THREE from 'three';

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/* Периодический value noise: текстуры с repeat не дают шва. */
function periodicNoise(seed, px, py) {
  const r = seeded(seed);
  const grid = new Float32Array(px * py);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (i, j) => grid[(((j % py) + py) % py) * px + (((i % px) + px) % px)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function paintWood({ size = 512, dark = '#1d0f08', light = '#5a341d', rings = 9, seed = 3, planks = 0 }) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const warp = periodicNoise(seed, 6, 6);
  const fine = periodicNoise(seed + 1, 64, 256);
  const knot = periodicNoise(seed + 2, 3, 12);
  const a = hexToRgb(dark), b = hexToRgb(light);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const w = warp(u * 6, v * 6) * 2.2 + knot(u * 3, v * 12) * 0.9;
      let ring = Math.sin((v * rings + w) * Math.PI * 2);
      ring = 0.5 + 0.5 * ring;
      ring = Math.pow(ring, 2.2);
      const f = fine(u * 64, v * 256);
      let t = 0.3 + ring * 0.45 + (f - 0.5) * 0.35;
      if (planks) {
        const p = (v * planks) % 1;
        if (p < 0.012) t *= 0.25;
      }
      t = Math.max(0, Math.min(1, t));
      const i = (y * size + x) * 4;
      d[i] = a[0] + (b[0] - a[0]) * t;
      d[i + 1] = a[1] + (b[1] - a[1]) * t;
      d[i + 2] = a[2] + (b[2] - a[2]) * t;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

