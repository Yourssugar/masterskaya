/* "Отремонтировать": фото дрожит, из него летят пыль, обрывки ткани и нитки,
   облако пыли закрывает снимок целиком, под ним "было" меняется на "стало",
   потом всё оседает и по готовой работе проходит блик.

   Холст больше фото (фото занимает середину), чтобы обрывки вылетали за рамку.
   Всё рисуется в 2D canvas: частиц мало, WebGL тут не нужен. */

const DUR = 3.1;          // вся анимация, секунды
const SWAP = 1.2;         // когда под пылью меняется фото
const DUST = [178, 166, 148];
const THREADS = ['#8f2645', '#a8344f', '#cdbb9a', '#8b7a62'];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* мягкое облачко пыли, рисуется один раз */
function puffSprite(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, `rgba(${DUST.join(',')},1)`);
  grad.addColorStop(.55, `rgba(${DUST.join(',')},.55)`);
  grad.addColorStop(1, `rgba(${DUST.join(',')},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  /* неровность: светлые и тёмные крапинки */
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 52;
    g.fillStyle = Math.random() < .5 ? 'rgba(255,248,235,.08)' : 'rgba(90,78,64,.07)';
    g.beginPath();
    g.arc(64 + Math.cos(a + seed) * r, 64 + Math.sin(a) * r, rnd(2, 7), 0, 6.283);
    g.fill();
  }
  return c;
}

export function createRepairFx(canvas, { textures = [], inset = .1875 } = {}) {
  const ctx = canvas.getContext('2d');
  const puffs = [puffSprite(0), puffSprite(1.7), puffSprite(3.1)];
  const tex = textures.map(u => { const im = new Image(); im.src = u; return im; });
  let W = 1, H = 1, dpr = 1, raf = 0, parts = null, start = 0, cb = null;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  /* рамка фото внутри холста */
  const photo = () => {
    const x = W * inset, y = H * inset;
    return { x, y, w: W - 2 * x, h: H - 2 * y };
  };

  function spawn() {
    const P = photo(), cx = P.x + P.w / 2, cy = P.y + P.h / 2, s = P.w;
    const inPhoto = () => [P.x + P.w * rnd(.08, .92), P.y + P.h * rnd(.12, .95)];
    const out = { puffs: [], scraps: [], threads: [], specks: [] };

    for (let i = 0; i < 48; i++) {
      const [x, y] = inPhoto();
      const d = Math.hypot(x - cx, y - cy) / s;
      out.puffs.push({
        x, y, sp: puffs[i % 3], rot: rnd(0, 6.283),
        delay: d * .5 + rnd(0, .25), r0: s * rnd(.03, .06), r1: s * rnd(.2, .38),
        vx: (x - cx) * rnd(.08, .2), vy: (y - cy) * rnd(.05, .15) - s * .02,
        fade: rnd(1.6, 2.6), a: rnd(.55, .9)
      });
    }
    for (let i = 0; i < 18; i++) {
      const [x, y] = inPhoto();
      const ang = Math.atan2(y - cy, x - cx) + rnd(-.5, .5), sp = s * rnd(.7, 1.6);
      const n = 5 + (Math.random() * 3 | 0), sz = s * rnd(.035, .085);
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + rnd(-.3, .3);
        pts.push([Math.cos(a) * sz * rnd(.55, 1.1), Math.sin(a) * sz * rnd(.4, .9)]);
      }
      out.scraps.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - s * rnd(.4, .9),
        rot: rnd(0, 6.283), vr: rnd(-7, 7), flip: rnd(0, 6.283), vf: rnd(4, 11),
        t0: rnd(.12, .5), pts, tex: tex.length ? tex[i % tex.length] : null,
        col: ['#3b3a38', '#6b4a33', '#cbbd9f', '#8f2645'][i % 4], life: rnd(2.2, 2.9)
      });
    }
    for (let i = 0; i < 14; i++) {
      const [x, y] = inPhoto();
      const ang = Math.atan2(y - cy, x - cx) + rnd(-.7, .7), sp = s * rnd(.5, 1.2);
      out.threads.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - s * rnd(.3, .7),
        rot: rnd(0, 6.283), vr: rnd(-5, 5), len: s * rnd(.08, .18), curl: rnd(.5, 1.2),
        ph: rnd(0, 6.283), t0: rnd(.1, .55), col: THREADS[i % THREADS.length],
        wdt: rnd(1.2, 2.4), life: rnd(2, 2.8)
      });
    }
    for (let i = 0; i < 140; i++) {
      const [x, y] = inPhoto();
      const ang = rnd(0, 6.283), sp = s * rnd(.2, 1.1);
      out.specks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - s * .2, t0: rnd(.05, .7), r: rnd(.6, 2.2), life: rnd(.8, 1.8) });
    }
    return out;
  }

  /* обрывок ткани: многоугольник с текстурой, крутится и переворачивается */
  function drawScrap(p, t) {
    const lt = t - p.t0;
    if (lt < 0 || lt > p.life) return;
    const g = 1.9 * photo().w, drag = Math.exp(-lt * 1.2);
    const x = p.x + p.vx * (1 - drag) / 1.2, y = p.y + p.vy * (1 - drag) / 1.2 + g * lt * lt * .5;
    const a = Math.min(1, lt * 8) * (1 - smooth(p.life - .6, p.life, lt));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.vr * lt);
    ctx.scale(1, Math.max(.15, Math.abs(Math.cos(p.flip + p.vf * lt))));
    ctx.beginPath();
    p.pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    if (p.tex && p.tex.complete && p.tex.naturalWidth) {
      ctx.fillStyle = p.col; ctx.fill();
      ctx.globalAlpha = a * .85;
      if (!p.pat) p.pat = ctx.createPattern(p.tex, 'repeat');
      ctx.fillStyle = p.pat;
    } else ctx.fillStyle = p.col;
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(30,22,18,.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* нитка: волнистая линия, свивается в полёте */
  function drawThread(p, t) {
    const lt = t - p.t0;
    if (lt < 0 || lt > p.life) return;
    const g = 1.2 * photo().w, drag = Math.exp(-lt * 1.6);
    const x = p.x + p.vx * (1 - drag) / 1.6, y = p.y + p.vy * (1 - drag) / 1.6 + g * lt * lt * .5;
    ctx.save();
    ctx.globalAlpha = Math.min(1, lt * 8) * (1 - smooth(p.life - .5, p.life, lt));
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.vr * lt);
    ctx.strokeStyle = p.col;
    ctx.lineWidth = p.wdt;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const N = 14;
    for (let k = 0; k <= N; k++) {
      const u = k / N - .5;
      const px = u * p.len, py = Math.sin(u * p.curl * 6.283 + p.ph + lt * 3) * p.len * .16 * (1 + lt * .6);
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    const t = (now - start) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const P = photo();

    /* сплошная пелена ровно по фото: гарантирует, что смену снимка не видно */
    const veil = smooth(.55, 1.05, t) * (1 - smooth(1.35, 2.35, t));
    if (veil > 0) {
      ctx.globalAlpha = veil * .96;
      ctx.fillStyle = `rgb(${DUST.join(',')})`;
      ctx.fillRect(P.x, P.y, P.w, P.h);
    }

    /* облака пыли */
    for (const p of parts.puffs) {
      const lt = t - p.delay;
      if (lt <= 0) continue;
      const grow = 1 - Math.pow(1 - clamp(lt / .9, 0, 1), 3);
      const r = p.r0 + (p.r1 - p.r0) * grow + Math.max(0, t - SWAP) * p.r1 * .15;
      const a = p.a * smooth(0, .35, lt) * (1 - smooth(SWAP + .15, SWAP + p.fade, t));
      if (a <= .003) continue;
      const x = p.x + p.vx * lt * .6, y = p.y + p.vy * lt * .6 - Math.max(0, t - SWAP) * P.h * .04;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(p.rot + lt * .3);
      ctx.drawImage(p.sp, -r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* мелкая пыль искрами */
    ctx.fillStyle = 'rgb(232,222,204)';
    for (const p of parts.specks) {
      const lt = t - p.t0;
      if (lt < 0 || lt > p.life) continue;
      ctx.globalAlpha = (1 - lt / p.life) * .8;
      ctx.beginPath();
      ctx.arc(p.x + p.vx * lt, p.y + p.vy * lt + lt * lt * P.w * .3, p.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    parts.threads.forEach(p => drawThread(p, t));
    parts.scraps.forEach(p => drawScrap(p, t));

    /* блик по готовой работе */
    const sh = smooth(2.15, 2.95, t);
    if (sh > 0 && sh < 1) {
      const bx = P.x - P.w * .4 + sh * P.w * 1.8;
      const gr = ctx.createLinearGradient(bx - P.w * .2, P.y, bx + P.w * .2, P.y + P.h * .3);
      gr.addColorStop(0, 'rgba(255,248,232,0)');
      gr.addColorStop(.5, 'rgba(255,248,232,.22)');
      gr.addColorStop(1, 'rgba(255,248,232,0)');
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      ctx.fillStyle = gr;
      ctx.fillRect(P.x, P.y, P.w, P.h);
      ctx.restore();
    }

    if (cb.shake) cb.shake(t < .5 ? (1 - t / .5) : 0, t);
    if (!cb.swapped && t >= SWAP) { cb.swapped = true; cb.swap && cb.swap(); }
    if (t >= DUR) {
      ctx.clearRect(0, 0, W, H);
      raf = 0;
      cb.done && cb.done();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    get running() { return !!raf; },
    run(callbacks) {
      if (raf) cancelAnimationFrame(raf);
      size();
      parts = spawn();
      cb = Object.assign({ swapped: false }, callbacks);
      start = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
}
