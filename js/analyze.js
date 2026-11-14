/* Разбор картинок сумок прямо в браузере, чтобы анимация подстраивалась
   под любые рисунки Codex без ручной разметки:
   - контур сумки (по нему красная нить рисует первую сумку);
   - рамка непрозрачной части (под неё тень);
   - где целая и порванная сумка отличаются (там проступает разрыв и идёт шов).
   Все координаты на выходе в долях картинки: 0..1, y вниз. */

function grid(img, n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, n, n);
  return x.getImageData(0, 0, n, n).data;
}

export function shapeOf(img, n = 256) {
  const d = grid(img, n);
  const A = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : d[(y * n + x) * 4 + 3]);
  let sx = 0, sy = 0, cnt = 0, x0 = n, y0 = n, x1 = 0, y1 = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (A(x, y) > 128) {
      sx += x; sy += y; cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!cnt) return { contour: [], bbox: { x0: .3, y0: .3, x1: .7, y1: .83 } };
  const cx = sx / cnt, cy = sy / cnt;

  /* внешний силуэт лучами из центра: от края холста внутрь до первого непрозрачного */
  const K = 300, R = n * 0.75, raw = [];
  for (let k = 0; k < K; k++) {
    const a = Math.PI / 2 + (k / K) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let hit = 0;
    for (let r = R; r > 0; r -= 0.5) {
      if (A(Math.round(cx + dx * r), Math.round(cy + dy * r)) > 128) { hit = r; break; }
    }
    raw.push(hit);
  }
  /* сглаживание по кругу, чтобы между ручками не было рваных провалов */
  const sm = raw.map((_, i) => {
    let s = 0, w = 0;
    for (let j = -3; j <= 3; j++) {
      const v = raw[(i + j + K) % K], k = 4 - Math.abs(j);
      s += v * k; w += k;
    }
    return Math.max(raw[i], s / w * 0.98);
  });
  const contour = sm.map((r, k) => {
    const a = Math.PI / 2 + (k / K) * Math.PI * 2;
    return [(cx + Math.cos(a) * r + .5) / n, (cy + Math.sin(a) * r + .5) / n];
  });
  contour.push(contour[0]);
  return { contour, bbox: { x0: x0 / n, y0: y0 / n, x1: (x1 + 1) / n, y1: (y1 + 1) / n } };
}

export function tearOf(imgA, imgB, n = 192) {
  const a = grid(imgA, n), b = grid(imgB, n);
  const N = n * n;
  const on = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    const dc = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]), Math.abs(a[j + 3] - b[j + 3]));
    if (dc > 40 && Math.max(a[j + 3], b[j + 3]) > 80) on[i] = 1;
  }
  /* немного расширяем, чтобы соседние пятна одного разрыва слиплись */
  let cur = on;
  for (let it = 0; it < 2; it++) {
    const nx = cur.slice();
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      if (!cur[i] && (cur[i - 1] || cur[i + 1] || cur[i - n] || cur[i + n])) nx[i] = 1;
    }
    cur = nx;
  }

  /* связные области */
  const lab = new Int32Array(N).fill(-1), blobs = [];
  for (let i = 0; i < N; i++) {
    if (!cur[i] || lab[i] >= 0) continue;
    const id = blobs.length, px = [], q = [i];
    lab[i] = id;
    while (q.length) {
      const k = q.pop(); px.push(k);
      const x = k % n, y = (k / n) | 0;
      const nb = [x > 0 ? k - 1 : -1, x < n - 1 ? k + 1 : -1, y > 0 ? k - n : -1, y < n - 1 ? k + n : -1];
      for (const m of nb) if (m >= 0 && cur[m] && lab[m] < 0) { lab[m] = id; q.push(m); }
    }
    blobs.push(px);
  }
  const minSize = Math.max(12, N * 0.0004);
  let keep = blobs.map((px, id) => ({ px, id })).filter(o => o.px.length >= minSize);
  keep.sort((p, q) => q.px.length - p.px.length);
  keep = keep.slice(0, 3);

  const segs = keep.map(o => {
    let mx = 0, my = 0;
    for (const k of o.px) { mx += k % n; my += (k / n) | 0; }
    mx /= o.px.length; my /= o.px.length;
    let cxx = 0, cyy = 0, cxy = 0;
    for (const k of o.px) {
      const dx = k % n - mx, dy = ((k / n) | 0) - my;
      cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
    }
    const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    let ax = Math.cos(ang), ay = Math.sin(ang);
    if (ax < 0) { ax = -ax; ay = -ay; }   // шьём слева направо
    let smin = 1e9, smax = -1e9, wmax = 0;
    for (const k of o.px) {
      const dx = k % n - mx, dy = ((k / n) | 0) - my;
      const s = dx * ax + dy * ay, w = Math.abs(-dx * ay + dy * ax);
      if (s < smin) smin = s; if (s > smax) smax = s; if (w > wmax) wmax = w;
    }
    return { o, mx, my, ax, ay, smin, smax, wmax, cy: my, cx: mx };
  });
  segs.sort((p, q) => (p.cy - q.cy) || (p.cx - q.cx));

  /* текстура маски: R сила, G позиция вдоль шва 0..1, B номер шва */
  const data = new Uint8Array(N * 4);
  const idOf = new Int32Array(N).fill(-1), sOf = new Float32Array(N);
  segs.forEach((g, idx) => {
    const span = Math.max(1, g.smax - g.smin);
    for (const k of g.o.px) {
      const s = ((k % n - g.mx) * g.ax + (((k / n) | 0) - g.my) * g.ay - g.smin) / span;
      idOf[k] = idx; sOf[k] = s;
      data[k * 4] = 255; data[k * 4 + 1] = Math.round(s * 255); data[k * 4 + 2] = idx; data[k * 4 + 3] = 255;
    }
  });
  /* мягкий край в три кольца, номер и позицию берём у соседа */
  const ring = [170, 95, 35];
  for (const val of ring) {
    const add = [];
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      if (idOf[i] >= 0) continue;
      for (const m of [i - 1, i + 1, i - n, i + n]) if (idOf[m] >= 0) { add.push([i, m]); break; }
    }
    for (const [i, m] of add) {
      idOf[i] = idOf[m]; sOf[i] = sOf[m];
      data[i * 4] = val; data[i * 4 + 1] = Math.round(sOf[m] * 255); data[i * 4 + 2] = idOf[m]; data[i * 4 + 3] = 255;
    }
  }

  const out = segs.map(g => ({
    a: [(g.mx + g.ax * g.smin + .5) / n, (g.my + g.ay * g.smin + .5) / n],
    b: [(g.mx + g.ax * g.smax + .5) / n, (g.my + g.ay * g.smax + .5) / n],
    dir: [g.ax, g.ay],
    w: Math.max(3, g.wmax + 2) / n
  }));
  return { data, n, segs: out };
}
