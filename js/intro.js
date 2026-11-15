/* Превью: около 18 секунд. Всё считается из одного времени t, как в KOTAE,
   только t идёт от часов, а не от скролла. Поэтому превью можно
   перематывать (?seek=8) и останавливать (?pause) для проверки кадров. */

import { shapeOf, tearOf } from './analyze.js';

export const DUR = 18;

const BAGS = ['01-1900s-satchel', '02-1950s-frame-bag', '03-1970s-messenger', '04-modern-crossbody', '05-modern-crossbody-torn'];

/* [начало, конец, из какой сумки, в какую]; -1 = пусто, сумка проявляется из нити */
const MORPH = [[1.8, 3.0, -1, 0], [5.5, 6.6, 0, 1], [8.4, 9.4, 1, 2], [10.9, 11.9, 2, 3]];

const ERAS = [
  { t0: 2.8, t1: 5.7, props: ['1900-pocket-watch', '1900-tailor-scissors', '1900-wooden-spool', '1900-brass-key'] },
  { t0: 6.2, t1: 8.6, props: ['1950-pearls', '1950-gloves', '1950-lipstick', '1950-compact'] },
  { t0: 9.1, t1: 11.1, props: ['1970-sunglasses', '1970-cassette', '1970-silk-scarf', '1970-film-camera'] },
  { t0: 11.5, t1: 12.6, props: ['now-earbuds-case', 'now-keys', 'now-notebook', 'now-sunglasses'] }
];

const PHRASES = [
  { t0: 3.0, t1: 5.4, side: 'l', text: 'Сумки шьют руками больше ста лет' },
  { t0: 6.6, t1: 8.3, side: 'r', text: 'У каждой эпохи своя форма' },
  { t0: 9.3, t1: 10.9, side: 'l', text: 'Хорошая сумка служит годами' },
  { t0: 12.3, t1: 13.8, side: 'r', text: 'Порвалась? Не выбрасывайте' },
  { t0: 13.9, t1: 15.6, side: 'l', text: 'Починим' }
];

const T = {
  dark: [0.6, 2.6],      // фон проявляется из темноты
  draw: [0.15, 2.3],     // нить рисует контур
  drawOut: [2.5, 3.3],
  zoomIn: [11.9, 12.9], zoomOut: [15.6, 16.7],
  tear: [12.15, 13.35],
  repair: [13.55, 15.25],
  snip: [15.2, 15.7],
  final: [15.7, 17.6],   // сумка уходит в сторону
  home: [16.0, 17.3],    // главная проступает
  bgHome: [15.9, 17.8],  // стол меняет свет на время суток
  bagOut: [17.0, 17.9],
  skipTo: 15.6
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const seg = (t, r) => clamp((t - r[0]) / (r[1] - r[0]), 0, 1);
const ease = x => x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const NS = 'http://www.w3.org/2000/svg';

export function createIntro({ stage, url, homeBg, layout, els, onEnd }) {
  const S = stage.S;
  let t = 0, running = false, prepared = null;
  let bags = [], shapes = [], contour = [], tear = null, stitches = [], maskTex = null;
  let pathLen = 1, lastW = 0, lastH = 0;
  const propEls = [], phraseEls = [];

  /* ---------- DOM ---------- */
  const svg = els.svg;
  const contourPath = document.createElementNS(NS, 'path');
  contourPath.setAttribute('class', 'thread');
  const contourHi = document.createElementNS(NS, 'path');
  contourHi.setAttribute('class', 'thread-hi');
  const stitchG = document.createElementNS(NS, 'g');
  stitchG.setAttribute('class', 'stitches');
  svg.append(contourPath, contourHi, stitchG);

  ERAS.forEach((era, e) => {
    era.props.forEach((name, i) => {
      const im = document.createElement('img');
      im.alt = ''; im.decoding = 'async'; im.className = 'prop';
      im.dataset.src = url('preview/props/' + name, 'prop');
      els.props.appendChild(im);
      propEls.push({ el: im, e, i });
    });
  });
  PHRASES.forEach(p => {
    const el = document.createElement('p');
    el.className = 'phrase ' + p.side;
    el.textContent = p.text;
    els.phrases.appendChild(el);
    phraseEls.push(el);
  });
  els.needle.src = url('preview/tools/needle', 'tool');
  els.bladeTop.src = url('preview/tools/scissors-blade-top', 'tool');
  els.bladeBot.src = url('preview/tools/scissors-blade-bottom', 'tool');

  /* ---------- загрузка ---------- */
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  }

  function prepare() {
    if (prepared) return prepared;
    const bg = stage.tex(url('preview/bg/stage', 'bg'));
    bags = BAGS.map(b => stage.tex(url('preview/bags/' + b, 'bag')));
    const first = Promise.all([bg.promise, bags[0].promise, bags[1].promise]);
    prepared = withTimeout(first, 4000).then(res => {
      if (!res || res.some(r => !r || r.failed)) return false;
      shapes[0] = shapeOf(bags[0].img);
      contour = shapes[0].contour;
      /* остальное догружается во время показа */
      bags.forEach((b, i) => b.promise.then(r => { if (r.ready && !shapes[i]) shapes[i] = shapeOf(r.img); }));
      Promise.all([bags[3].promise, bags[4].promise]).then(([a, b]) => {
        if (!a.ready || !b.ready) return;
        tear = tearOf(a.img, b.img);
        maskTex = stage.dataTex(tear.data, tear.n);
        buildStitches();
      });
      propEls.forEach(p => { p.el.src = p.el.dataset.src; });
      return true;
    });
    return prepared;
  }

  /* ---------- шов ---------- */
  function buildStitches() {
    stitchG.textContent = '';
    stitches = tear.segs.map((g, idx) => {
      const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
      const count = clamp(Math.round(len / 0.014), 4, 18);
      const nx = -g.dir[1], ny = g.dir[0];
      const w = clamp(g.w * 1.25, 0.012, 0.026);
      const list = [];
      for (let i = 0; i < count; i++) {
        const k = (i + .5) / count;
        const cx = lerp(g.a[0], g.b[0], k), cy = lerp(g.a[1], g.b[1], k);
        const sx = g.dir[0] * 0.004, sy = g.dir[1] * 0.004;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('class', 'stitch');
        stitchG.appendChild(line);
        list.push({ p1: [cx + nx * w - sx, cy + ny * w - sy], p2: [cx - nx * w + sx, cy - ny * w + sy], el: line });
      }
      return { idx, list, end: g.b, dir: g.dir };
    });
  }

  /* ---------- раскладка ---------- */
  function rectAt(k) { return layout(innerWidth, innerHeight, k); }
  const toPx = (r, p) => [r.x + p[0] * r.w, r.y + p[1] * r.h];

  function rebuildContour(r) {
    if (!contour.length) return;
    const d = contour.map((p, i) => {
      const q = toPx(r, p);
      return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    }).join(' ');
    contourPath.setAttribute('d', d);
    contourHi.setAttribute('d', d);
    pathLen = contourPath.getTotalLength() || 1;
    contourPath.style.strokeDasharray = contourHi.style.strokeDasharray = pathLen + ' ' + pathLen;
  }

  /* ---------- кадр ---------- */
  function placeNeedle(x, y, dx, dy, op, size) {
    const n = els.needle;
    const w = size, h = size / 4;
    const a = Math.atan2(dy, dx) * 180 / Math.PI;
    n.style.width = w + 'px';
    n.style.height = h + 'px';
    n.style.opacity = op.toFixed(3);
    n.style.transform = `translate(${(x - w).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px) rotate(${a.toFixed(1)}deg)`;
  }

  function frame(mouse) {
    const W = innerWidth, H = innerHeight, mob = W / H < 0.8;
    const fk = ease(seg(t, T.final));
    let r0 = rectAt(fk);
    /* наезд камеры на разрыв: сумка растёт вокруг места поломки */
    const zk = ease(seg(t, T.zoomIn)) * (1 - ease(seg(t, T.zoomOut)));
    if (zk > 0 && tear) {
      const Z = 1 + ((mob ? 1.5 : 2.3) - 1) * zk;
      const f = tear.focus, F = toPx(r0, f);
      const P = mob ? [W * .5, H * .7] : [W * .44, H * .56];
      const w = r0.w * Z;
      r0 = { w, h: w, x: lerp(F[0], P[0], zk) - f[0] * w, y: lerp(F[1], P[1], zk) - f[1] * w };
    }
    const breathe = 1 + 0.006 * Math.sin(t * 1.3);
    const r = {
      w: r0.w * breathe, h: r0.h * breathe,
      x: r0.x - r0.w * (breathe - 1) / 2 - mouse.x * 8,
      y: r0.y - r0.h * (breathe - 1) * (1700 / 2048) - mouse.y * 5
    };
    if (W !== lastW || H !== lastH) { lastW = W; lastH = H; rebuildContour(rectAt(0)); }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const size = r.w;

    /* фон */
    S.bgA = stage.tex(url('preview/bg/stage', 'bg'));
    S.bgB = homeBg();
    S.bgMix = ease(seg(t, T.bgHome));
    S.dark = 1 - ease(seg(t, T.dark));
    S.zoom = lerp(1.1, 1.03, easeOut(clamp(t / DUR, 0, 1))) + .06 * zk;
    S.off = [mouse.x * -0.006, mouse.y * -0.005];
    S.vig = .6;
    S.dust.amt = .45;
    S.dust.col = [1, .8, .6];

    /* сумка */
    const B = S.bag;
    B.on = true; B.rect = r; B.useMask = 0; B.tear = 0; B.repair = 0; B.mix = 0; B.seed = 0;
    let ia = -1, ib = 0, mk = 0;
    for (const m of MORPH) {
      if (t >= m[0]) { ia = m[2]; ib = m[3]; mk = seg(t, [m[0], m[1]]); }
    }
    const ready = i => i >= 0 && bags[i] && bags[i].ready;
    if (mk >= 1 || !ready(ib)) { ia = ready(ib) ? ib : ia; mk = 0; }
    B.a = ia >= 0 && ready(ia) ? bags[ia] : stage.blank;
    B.b = ready(ib) ? bags[ib] : B.a;
    B.mix = ease(mk);
    B.seed = ib * 1.7;
    B.edgeW = ia < 0 ? .08 : .05;

    let repairDone = false;
    if (t >= MORPH[3][1] && ready(3)) {
      B.a = bags[3];
      B.b = ready(4) ? bags[4] : bags[3];
      B.mix = 0;
      if (maskTex) {
        B.mask = maskTex; B.useMask = 1;
        B.tear = ease(seg(t, T.tear));
        const nSeg = stitches.length || 1;
        const rp = seg(t, T.repair) * nSeg;
        repairDone = rp >= nSeg;
        B.repair = repairDone ? 20 : rp;
      }
    }
    B.alpha = 1 - ease(seg(t, T.bagOut));

    /* тень по рамке сумки */
    const sa = shapes[Math.max(0, ia)] || shapes[0], sb = shapes[ib] || sa;
    if (sa) {
      const bx0 = lerp(sa.bbox.x0, sb.bbox.x0, B.mix), bx1 = lerp(sa.bbox.x1, sb.bbox.x1, B.mix);
      const by1 = lerp(sa.bbox.y1, sb.bbox.y1, B.mix);
      const sw = (bx1 - bx0) * r.w * 1.15, sh = sw * .13;
      S.shadow.rect = { x: r.x + (bx0 + bx1) / 2 * r.w - sw / 2, y: r.y + by1 * r.h - sh * .55, w: sw, h: sh };
      S.shadow.alpha = ia < 0 ? .55 * B.mix : .55;
    }

    /* нить по контуру */
    const dk = seg(t, T.draw), dOut = seg(t, T.drawOut);
    const dash = pathLen * (1 - easeOut(dk));
    contourPath.style.strokeDashoffset = dash;
    contourHi.style.strokeDashoffset = dash;
    contourPath.style.opacity = contourHi.style.opacity = (1 - dOut).toFixed(3);
    contourPath.style.strokeWidth = Math.max(1.5, size * 0.006) + 'px';
    contourHi.style.strokeWidth = Math.max(.8, size * 0.0025) + 'px';

    let needleOn = 0;
    if (dk > 0 && dk < 1 && contour.length) {
      const L = pathLen * easeOut(dk);
      const p = contourPath.getPointAtLength(L), q = contourPath.getPointAtLength(Math.max(0, L - 6));
      placeNeedle(p.x, p.y, p.x - q.x, p.y - q.y, 1, size * .26);
      needleOn = 1;
    }

    /* шов */
    if (stitches.length) {
      const nSeg = stitches.length;
      const rp = seg(t, T.repair) * nSeg;
      const fadeSeam = 1 - ease(seg(t, T.bagOut));
      stitches.forEach((g, gi) => {
        const local = clamp(rp - gi, 0, 1), n = g.list.length;
        g.list.forEach((s, i) => {
          const f = clamp(local * n - i, 0, 1);
          const a = toPx(r, s.p1), b = toPx(r, s.p2);
          const e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
          s.el.setAttribute('x1', a[0].toFixed(1)); s.el.setAttribute('y1', a[1].toFixed(1));
          s.el.setAttribute('x2', e[0].toFixed(1)); s.el.setAttribute('y2', e[1].toFixed(1));
          s.el.style.opacity = f > 0 ? fadeSeam : 0;
          s.el.style.strokeWidth = Math.max(1.2, size * 0.0035) + 'px';
        });
      });
      const rk = seg(t, T.repair);
      if (rk > 0 && rk < 1) {
        const gi = Math.min(nSeg - 1, Math.floor(rp));
        const g = stitches[gi], local = clamp(rp - gi, 0, 1), n = g.list.length;
        const si = Math.min(n - 1, Math.floor(local * n)), f = local * n - si;
        const s = g.list[si];
        const a = toPx(r, s.p1), b = toPx(r, s.p2);
        placeNeedle(lerp(a[0], b[0], f), lerp(a[1], b[1], f), b[0] - a[0], b[1] - a[1], 1, size * .15);
        needleOn = 1;
      }
    }
    if (!needleOn) els.needle.style.opacity = 0;

    /* ножницы обрезают нитку в конце шва */
    const sk = seg(t, T.snip);
    if (stitches.length && sk > 0 && sk < 1) {
      const g = stitches[stitches.length - 1];
      const p = toPx(r, [g.end[0] + g.dir[0] * .05, g.end[1] + g.dir[1] * .05 + .02]);
      const sz = size * .2, open = 26 * (1 - ease(clamp((sk - .25) / .45, 0, 1)));
      const op = Math.min(1, sk * 6) * (1 - clamp((sk - .8) / .2, 0, 1));
      els.scissors.style.opacity = op.toFixed(3);
      els.scissors.style.width = els.scissors.style.height = sz + 'px';
      els.scissors.style.transform = `translate(${(p[0] - sz / 2).toFixed(1)}px, ${(p[1] - sz / 2).toFixed(1)}px) rotate(-25deg)`;
      els.bladeTop.style.transform = `rotate(${-open}deg)`;
      els.bladeBot.style.transform = `rotate(${open}deg)`;
    } else els.scissors.style.opacity = 0;

    /* предметы эпох */
    const slots = mob
      ? [[.2, .13], [.8, .15]]
      : [[.12, .24], [.88, .22], [.1, .76], [.9, .78]];
    const psz = mob ? Math.min(W, H) * .24 : Math.min(W, H) * .17;
    propEls.forEach(p => {
      const era = ERAS[p.e];
      if (p.i >= slots.length) { p.el.style.opacity = 0; return; }
      const st = era.t0 + p.i * .18, en = era.t1;
      const kin = easeOut(clamp((t - st) / .9, 0, 1)), kout = ease(clamp((t - en + .5) / .5, 0, 1));
      const vis = kin * (1 - kout);
      if (vis <= 0) { p.el.style.opacity = 0; return; }
      const [sx, sy] = slots[p.i];
      const side = sx < .5 ? -1 : 1;
      const depth = .6 + (p.i % 2) * .5;
      const x = sx * W - psz / 2 + side * (1 - kin) * 70 - mouse.x * 14 * depth;
      const y = sy * H - psz / 2 + (1 - kin) * 20 - kout * 30 - mouse.y * 10 * depth + Math.sin(t * .9 + p.i) * 4;
      const rot = side * (1 - kin) * 8 + Math.sin(t * .7 + p.i * 2) * 1.5;
      p.el.style.width = p.el.style.height = psz + 'px';
      p.el.style.opacity = vis.toFixed(3);
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    });

    /* фразы */
    PHRASES.forEach((ph, i) => {
      const el = phraseEls[i];
      const kin = easeOut(clamp((t - ph.t0) / .6, 0, 1)), kout = ease(clamp((t - ph.t1 + .4) / .4, 0, 1));
      const vis = kin * (1 - kout);
      el.style.opacity = vis.toFixed(3);
      const dx = (ph.side === 'l' ? -1 : 1) * (1 - kin) * 30;
      el.style.transform = mob ? `translateY(${((1 - kin) * 16).toFixed(1)}px)` : `translate(${dx.toFixed(1)}px, -50%)`;
    });

    /* главная проступает */
    const hk = ease(seg(t, T.home));
    els.home.style.opacity = hk.toFixed(3);
    els.top.style.opacity = hk.toFixed(3);
    els.bar.style.transform = `scaleX(${(t / DUR).toFixed(4)})`;
    els.skip.style.opacity = (1 - seg(t, [15.4, 16])).toFixed(3);
  }

  return {
    prepare,
    get running() { return running; },
    get time() { return t; },
    start(at = 0) {
      t = at; running = true; lastW = 0;
      els.root.hidden = false;
      document.body.classList.add('in-intro');
    },
    skip() { if (running && t < T.skipTo) t = T.skipTo; },
    update(dt, mouse) {
      if (!running) return;
      t += dt;
      if (t >= DUR) {
        running = false;
        els.root.hidden = true;
        S.bag.on = false;
        document.body.classList.remove('in-intro');
        els.home.style.opacity = els.top.style.opacity = '';
        onEnd();
        return;
      }
      frame(mouse);
    }
  };
}
