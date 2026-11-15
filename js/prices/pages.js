/* Страницы блокнота с ценами: бумага в клетку, записи от руки ручкой,
   карандашные рисунки на полях, кое-что зачёркнуто.
   Устройство как в library/js/book/pages.js A.C.EON: сначала раскладка
   по страницам с замером строк на canvas, потом каждая сторона рисуется в свою текстуру. */

import * as THREE from 'three';
import { seeded } from './tex.js';

export const PAGE_W = 3.72;
export const PAGE_H = 5.12;

const HAND = '"Caveat", "Comic Sans MS", cursive';
const INK = '#1f2b4d';          // синяя ручка
const PENCIL = 'rgba(58,58,66,.62)';
const PAPER = '#f2ead8';

/* ---------- раскладка ---------- */
function styles(W) {
  return {
    head: { font: `700 ${Math.round(W * .088)}px ${HAND}`, h: W * .115, color: INK },
    item: { font: `500 ${Math.round(W * .06)}px ${HAND}`, h: W * .074, color: INK },
    note: { font: `400 ${Math.round(W * .047)}px ${HAND}`, h: W * .056, color: 'rgba(31,43,77,.7)' },
    text: { font: `500 ${Math.round(W * .053)}px ${HAND}`, h: W * .066, color: 'rgba(31,43,77,.85)' }
  };
}

function frame(W, H, side) {
  const inner = W * .14, outer = W * .11;
  const left = side === 'right' ? inner : outer;
  return { left, width: W - inner - outer, top: H * .085, bottom: H * .9 };
}

function wrap(ctx, text, max) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (line && ctx.measureText(next).width > max) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* Разрезает разделы на блоки строк, блоки на страницы. Раздел не отрывается от первой строки. */
export function buildLayout(data, textureHeight) {
  const H = textureHeight, W = Math.round(H * (PAGE_W / PAGE_H));
  const ctx = document.createElement('canvas').getContext('2d');
  const S = styles(W);
  const fr = frame(W, H, 'right');
  const priceW = W * .2;

  const blocks = [];
  data.sections.forEach((sec, si) => {
    blocks.push({ type: 'head', text: sec.title, h: S.head.h + (si ? W * .045 : 0), gap: si ? W * .045 : 0, keep: true });
    sec.items.forEach(it => {
      if (it.strike) {
        ctx.font = S.item.font;
        const lines = wrap(ctx, it.strike, fr.width - priceW);
        blocks.push({ type: 'strike', lines, h: lines.length * S.item.h });
      } else if (it.text) {
        ctx.font = S.text.font;
        const lines = wrap(ctx, it.text, fr.width);
        blocks.push({ type: 'text', lines, h: lines.length * S.text.h + W * .01 });
      } else {
        ctx.font = S.item.font;
        const lines = wrap(ctx, it.name, fr.width - priceW);
        let h = lines.length * S.item.h;
        let noteLines = [];
        if (it.note) { ctx.font = S.note.font; noteLines = wrap(ctx, it.note, fr.width - priceW); h += noteLines.length * S.note.h; }
        blocks.push({ type: 'item', lines, price: it.price || '', note: noteLines, h });
      }
    });
  });

  const pages = [];
  let page = { kind: 'list', blocks: [] }, y = fr.top;
  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    const need = b.h + (b.keep && next ? next.h : 0);
    if (y + need > fr.bottom && page.blocks.length) {
      pages.push(page);
      page = { kind: 'list', blocks: [] };
      y = fr.top;
    }
    const gap = page.blocks.length ? (b.gap || 0) : 0;
    page.blocks.push(Object.assign({}, b, { y: y + gap }));
    y += b.h - (b.gap || 0) + gap;
    page.bottom = y;
  });
  if (page.blocks.length) pages.push(page);

  /* развороты: слева титул, дальше по две страницы, в конце страница "пишите" */
  const spreads = [];
  const all = [{ kind: 'title' }, ...pages];
  all.push({ kind: 'end' });
  for (let i = 0; i < all.length; i += 2) spreads.push({ left: all[i], right: all[i + 1] || { kind: 'blank' } });
  pages.forEach((p, i) => { p.number = i + 1; });
  return { spreads, W, H, data, pages: pages.length };
}

/* ---------- бумага ---------- */
const paperCache = new Map();
function paper(W, H, gutter) {
  const key = W + 'x' + H + gutter;
  if (paperCache.has(key)) return paperCache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const r = seeded(W + (gutter === 'left' ? 1 : 2));
  for (let i = 0; i < W * 1.2; i++) {
    ctx.fillStyle = `rgba(${r() > .5 ? '120,100,70' : '255,252,240'},${.03 + r() * .04})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1);
  }
  /* клетка */
  const cell = W / 24;
  ctx.strokeStyle = 'rgba(70,110,150,.16)';
  ctx.lineWidth = Math.max(1, W * .0012);
  ctx.beginPath();
  for (let x = cell * .5; x < W; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = cell * .7; y < H; y += cell) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  /* поле: красная линия у внешнего края */
  const mx = gutter === 'left' ? W * .93 : W * .07;
  ctx.strokeStyle = 'rgba(190,60,70,.35)';
  ctx.lineWidth = Math.max(1, W * .002);
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
  /* тень у корешка */
  const g0 = gutter === 'left' ? 0 : W, g1 = gutter === 'left' ? W * .16 : W * .84;
  const gg = ctx.createLinearGradient(g0, 0, g1, 0);
  gg.addColorStop(0, 'rgba(60,45,25,.32)');
  gg.addColorStop(.3, 'rgba(80,60,35,.1)');
  gg.addColorStop(1, 'rgba(80,60,35,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, W, H);
  paperCache.set(key, c);
  return c;
}

/* ---------- карандаш ---------- */
/* линия от руки: два прохода с лёгкой дрожью */
function sketch(ctx, r, W, draw, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = PENCIL;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = (pass ? .55 : .9) * alpha;
    ctx.lineWidth = W * (pass ? .0028 : .0036);
    const j = () => (r() - .5) * W * .006;
    ctx.beginPath();
    draw(j);
    ctx.stroke();
  }
  ctx.restore();
}

const DOODLES = {
  bag(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      ctx.moveTo(x - s * .42 + j(), y + s * .45 + j());
      ctx.lineTo(x + s * .42 + j(), y + s * .45 + j());
      ctx.lineTo(x + s * .34 + j(), y - s * .1 + j());
      ctx.lineTo(x - s * .34 + j(), y - s * .1 + j());
      ctx.closePath();
      ctx.moveTo(x - s * .2, y - s * .1);
      ctx.bezierCurveTo(x - s * .2 + j(), y - s * .5, x + s * .2 + j(), y - s * .5, x + s * .2, y - s * .1);
      ctx.moveTo(x - s * .3 + j(), y + s * .08); ctx.lineTo(x + s * .3 + j(), y + s * .08);
    });
    /* штриховка тени */
    sketch(ctx, r, W, j => {
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        ctx.moveTo(x + s * (.18 + t * .2), y + s * .44);
        ctx.lineTo(x + s * (.28 + t * .1) + j(), y + s * .2);
      }
    }, .45);
  },
  scissors(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      ctx.moveTo(x - s * .22 + s * .12, y - s * .14);
      ctx.arc(x - s * .22, y - s * .14, s * .12, 0, 6.283);
      ctx.moveTo(x - s * .22 + s * .12, y + s * .14);
      ctx.arc(x - s * .22, y + s * .14, s * .12, 0, 6.283);
      ctx.moveTo(x - s * .12, y - s * .08); ctx.lineTo(x + s * .45 + j(), y + s * .06);
      ctx.moveTo(x - s * .12, y + s * .08); ctx.lineTo(x + s * .45 + j(), y - s * .04);
    });
  },
  needle(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      ctx.moveTo(x - s * .4, y + s * .25); ctx.lineTo(x + s * .35, y - s * .3);
      ctx.moveTo(x + s * .3 + s * .03, y - s * .26);
      ctx.ellipse(x + s * .3, y - s * .26, s * .03, s * .015, -.6, 0, 6.283);
      ctx.moveTo(x + s * .3, y - s * .26);
      ctx.bezierCurveTo(x + s * .55 + j(), y - s * .1, x + s * .1, y + s * .3 + j(), x + s * .45, y + s * .4);
    });
  },
  spool(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      ctx.moveTo(x + s * .22, y - s * .35);
      ctx.ellipse(x, y - s * .35, s * .22, s * .07, 0, 0, 6.283);
      ctx.moveTo(x + s * .22, y + s * .35);
      ctx.ellipse(x, y + s * .35, s * .22, s * .07, 0, 0, 3.1416);
      ctx.moveTo(x - s * .16, y - s * .3); ctx.lineTo(x - s * .16 + j(), y + s * .32);
      ctx.moveTo(x + s * .16, y - s * .3); ctx.lineTo(x + s * .16 + j(), y + s * .32);
      for (let k = 0; k < 5; k++) { const yy = y - s * .2 + k * s * .1; ctx.moveTo(x - s * .16, yy); ctx.lineTo(x + s * .16, yy + s * .04 + j()); }
    });
  },
  zipper(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      ctx.moveTo(x - s * .45, y); ctx.lineTo(x + s * .45, y + j());
      for (let k = 0; k < 9; k++) { const xx = x - s * .4 + k * s * .1; ctx.moveTo(xx, y - s * .05); ctx.lineTo(xx, y + s * .05); }
      ctx.moveTo(x + s * .2, y - s * .09); ctx.lineTo(x + s * .32, y - s * .09); ctx.lineTo(x + s * .3, y + s * .12); ctx.lineTo(x + s * .22, y + s * .12); ctx.closePath();
    });
  },
  star(ctx, r, W, x, y, s) {
    sketch(ctx, r, W, j => {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * Math.PI * 4 / 5;
        const px = x + Math.cos(a) * s * .3 + j(), py = y + Math.sin(a) * s * .3 + j();
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    });
  }
};
const DOODLE_KEYS = ['bag', 'scissors', 'needle', 'spool', 'zipper'];

/* ---------- текст от руки ---------- */
function hand(ctx, text, x, y, font, color, align = 'left', tilt = 0) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function wavy(ctx, r, W, x0, x1, y) {
  sketch(ctx, r, W, j => {
    ctx.moveTo(x0, y);
    const n = Math.max(4, Math.round((x1 - x0) / (W * .04)));
    for (let k = 1; k <= n; k++) ctx.lineTo(x0 + (x1 - x0) * k / n, y + (k % 2 ? -1 : 1) * W * .006 + j());
  });
}

function drawList(ctx, W, H, page, side, data) {
  const S = styles(W), fr = frame(W, H, side);
  const r = seeded(page.number * 97 + 13);
  const tilt = () => (r() - .5) * .012;
  page.blocks.forEach(b => {
    if (b.type === 'head') {
      const y = b.y + S.head.h * .78;
      hand(ctx, b.text, fr.left, y, S.head.font, INK, 'left', tilt());
      ctx.font = S.head.font;
      const tw = ctx.measureText(b.text).width;
      wavy(ctx, r, W, fr.left, fr.left + tw * 1.05, y + W * .02);
      return;
    }
    if (b.type === 'text') {
      b.lines.forEach((l, i) => hand(ctx, l, fr.left + W * .02, b.y + S.text.h * (i + .8), S.text.font, S.text.color, 'left', tilt()));
      return;
    }
    if (b.type === 'strike') {
      b.lines.forEach((l, i) => {
        const y = b.y + S.item.h * (i + .78);
        hand(ctx, l, fr.left, y, S.item.font, 'rgba(31,43,77,.75)');
        ctx.font = S.item.font;
        const tw = ctx.measureText(l).width;
        /* зачёркнуто: пара неровных линий */
        sketch(ctx, r, W, j => {
          ctx.moveTo(fr.left - W * .01, y - W * .018 + j()); ctx.lineTo(fr.left + tw + W * .01, y - W * .022 + j());
          ctx.moveTo(fr.left, y - W * .012 + j()); ctx.lineTo(fr.left + tw, y - W * .026 + j());
        });
      });
      return;
    }
    /* строка цены: название, точки, цена справа */
    b.lines.forEach((l, i) => {
      const y = b.y + S.item.h * (i + .78);
      hand(ctx, l, fr.left, y, S.item.font, INK, 'left', tilt());
      if (i === b.lines.length - 1) {
        ctx.font = S.item.font;
        const tw = ctx.measureText(l).width;
        const pw = ctx.measureText(b.price).width;
        const x0 = fr.left + tw + W * .02, x1 = fr.left + fr.width - pw - W * .02;
        if (x1 > x0) {
          ctx.save();
          ctx.fillStyle = 'rgba(31,43,77,.45)';
          for (let x = x0; x < x1; x += W * .018) { ctx.beginPath(); ctx.arc(x, y - W * .004, W * .0035, 0, 6.283); ctx.fill(); }
          ctx.restore();
        }
        hand(ctx, b.price, fr.left + fr.width, y, S.item.font, INK, 'right', tilt());
      }
    });
    b.note.forEach((l, i) => hand(ctx, l, fr.left + W * .03, b.y + S.item.h * b.lines.length + S.note.h * (i + .75), S.note.font, S.note.color));
  });

  /* рисунок на свободном месте внизу или на поле */
  const free = fr.bottom - (page.bottom || fr.top);
  const key = DOODLE_KEYS[(page.number + 2) % DOODLE_KEYS.length];
  if (free > H * .16) {
    const s = Math.min(free * .7, W * .38);
    DOODLES[key](ctx, r, W, fr.left + fr.width * (.35 + r() * .3), fr.bottom - free / 2 + W * .02, s);
  } else {
    const x = side === 'right' ? W * .95 : W * .05;
    DOODLES.star(ctx, r, W, x, H * (.2 + r() * .5), W * .06);
  }
  /* номер страницы */
  hand(ctx, String(page.number + 1), fr.left + fr.width / 2, H * .955, `500 ${Math.round(W * .045)}px ${HAND}`, 'rgba(31,43,77,.55)', 'center');
}

function drawTitle(ctx, W, H, data, side) {
  const fr = frame(W, H, side), r = seeded(5);
  const cx = fr.left + fr.width / 2;
  hand(ctx, data.title, cx, H * .25, `700 ${Math.round(W * .2)}px ${HAND}`, INK, 'center', -.03);
  wavy(ctx, r, W, cx - W * .26, cx + W * .26, H * .285);
  const f = `500 ${Math.round(W * .058)}px ${HAND}`;
  ctx.font = f;
  const lines = data.intro.flatMap(l => wrap(ctx, l, fr.width));
  lines.forEach((l, i) => hand(ctx, l, cx, H * (.37 + i * .052), f, 'rgba(31,43,77,.85)', 'center', (r() - .5) * .02));
  DOODLES.bag(ctx, r, W, cx, H * .68, W * .42);
  DOODLES.needle(ctx, r, W, cx + W * .27, H * .76, W * .2);
}

function drawEnd(ctx, W, H, data, side) {
  const fr = frame(W, H, side), r = seeded(8);
  const cx = fr.left + fr.width / 2;
  const f = `600 ${Math.round(W * .064)}px ${HAND}`;
  ctx.font = f;
  const lines = data.outro.flatMap(l => wrap(ctx, l, fr.width));
  lines.forEach((l, i) => hand(ctx, l, cx, H * (.3 + i * .06), f, INK, 'center', (r() - .5) * .02));
  if (data.phone) hand(ctx, data.phone, cx, H * .46, `700 ${Math.round(W * .082)}px ${HAND}`, INK, 'center', -.015);
  if (data.hours) hand(ctx, data.hours, cx, H * .52, `500 ${Math.round(W * .05)}px ${HAND}`, 'rgba(31,43,77,.7)', 'center');
  DOODLES.spool(ctx, r, W, cx - W * .18, H * .72, W * .26);
  DOODLES.scissors(ctx, r, W, cx + W * .16, H * .74, W * .3);
}

/* Холст одной стороны листа. mirrored нужен обороту переворачиваемого листа. */
export function paintSurface(surface, side, layout, mirrored = false) {
  const { W, H, data } = layout;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (mirrored) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(paper(W, H, side === 'right' ? 'left' : 'right'), 0, 0);
  if (surface.kind === 'title') drawTitle(ctx, W, H, data, side);
  else if (surface.kind === 'list') drawList(ctx, W, H, surface, side, data);
  else if (surface.kind === 'end') drawEnd(ctx, W, H, data, side);
  return c;
}

export function canvasTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
