/* Главная: стол мастерской в свете текущего времени в Минске.
   Утро: кофе с паром, луч из окна ползёт по столу.
   Рабочее время: машинка иногда шьёт (крутится маховик), качается сантиметр,
   щёлкают ножницы. Закрыто: свеча, на часах минское время, на календаре дата
   и часы работы. Всё, что на столе, рисуется в WebGL поверх фона той же
   подгонкой cover, поэтому предметы стоят на столе при любом размере окна. */

import { shopStatus, shopNow } from './clock.js';
import { SCENES, META, PTS } from './scenes.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const RAD = Math.PI / 180;

/* матрицы 2x2 в виде [a, b, c, d] по столбцам: x' = a*x + c*y, y' = b*x + d*y */
const mul = (p, q) => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3]];
const rot = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c]; };
const scl = (x, y) => [x, 0, 0, y];
const apply = (m, d) => [m[0] * d[0] + m[2] * d[1], m[1] * d[0] + m[3] * d[1]];

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/* "пн-пт 10-18", "сб 10-15", "вс выходной" из графика в config.js */
function hoursLines(hours) {
  const order = [1, 2, 3, 4, 5, 6, 0], out = [];
  const key = d => (hours[d] ? hours[d].join('-') : 'off');
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && key(order[j + 1]) === key(order[i])) j++;
    const a = SHORT[order[i]], b = SHORT[order[j]];
    const days = i === j ? a : a + '-' + b;
    const h = hours[order[i]];
    out.push(days + ' ' + (h ? h[0] + '-' + h[1] : 'выходной'));
    i = j + 1;
  }
  return out;
}

/* семисегментные цифры для часов */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function segDigit(x) {
  const w = 34, h = 64, t = 7, g = 1.5;
  const P = {
    a: [[x + t / 2 + g, t / 2], [x + w - t / 2 - g, t / 2]],
    g: [[x + t / 2 + g, h / 2], [x + w - t / 2 - g, h / 2]],
    d: [[x + t / 2 + g, h - t / 2], [x + w - t / 2 - g, h - t / 2]],
    f: [[x + t / 2, t / 2 + g], [x + t / 2, h / 2 - g]],
    b: [[x + w - t / 2, t / 2 + g], [x + w - t / 2, h / 2 - g]],
    e: [[x + t / 2, h / 2 + g], [x + t / 2, h - t / 2 - g]],
    c: [[x + w - t / 2, h / 2 + g], [x + w - t / 2, h - t / 2 - g]]
  };
  return Object.keys(P).map(k => {
    const [[x1, y1], [x2, y2]] = P[k];
    return `<line data-s="${k}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
}

export function createHome({ stage, site, url, forced, els, calm }) {
  const S = stage ? stage.S : null;
  let status = shopStatus(site), mode = forced || status.mode;
  let check = 0, active = false, peeking = false, nowAge = 0, nowCache = shopNow(site.timeZone);
  let scene = null, leaving = null;
  const view = { zoom: 1.03, off: [0, 0], snap: true };
  const mouseV = { x: 0, y: 0 }, lastMouse = { x: 0, y: 0 };

  const bgOf = m => stage.tex(url('home/' + m + '/bg', 'bg'));
  const img = id => stage.tex(url('home/' + id), true);

  /* ---------- текст ---------- */
  function texts() {
    els.status.textContent = status.text;
    els.status.dataset.open = status.open ? '1' : '0';
    document.body.dataset.mode = mode;
  }
  texts();

  if (!stage) {
    els.cssbg.style.backgroundImage = `url("${url('home/' + mode + '/bg', 'bg')}")`;
  }

  /* ---------- часы и календарь (DOM поверх картинок) ---------- */
  const fx = els.fx;
  let clockEl = null, calEl = null, digits = [], colon = null, lastMin = -1, lastDay = -1;
  if (fx) {
    clockEl = document.createElement('div');
    clockEl.className = 'clockface';
    clockEl.innerHTML = `<svg viewBox="0 0 170 64" preserveAspectRatio="xMidYMid meet">
      <g class="d">${segDigit(0)}</g><g class="d">${segDigit(40)}</g>
      <g class="colon"><circle cx="85" cy="20" r="3.6"/><circle cx="85" cy="44" r="3.6"/></g>
      <g class="d">${segDigit(96)}</g><g class="d">${segDigit(136)}</g></svg>`;
    digits = [...clockEl.querySelectorAll('.d')];
    colon = clockEl.querySelector('.colon');
    calEl = document.createElement('div');
    calEl.className = 'calpage';
    calEl.innerHTML = '<b></b><span class="m"></span><span class="w"></span><span class="h"></span>';
    fx.append(clockEl, calEl);
  }
  function tickTexts(now) {
    if (!clockEl) return;
    if (now.m !== lastMin) {
      lastMin = now.m;
      const s = String(now.h).padStart(2, '0') + String(now.m).padStart(2, '0');
      digits.forEach((g, i) => {
        const on = SEG[s[i]];
        g.querySelectorAll('line').forEach(l => l.classList.toggle('on', on.includes(l.dataset.s)));
      });
    }
    colon.style.opacity = now.s % 2 ? .25 : 1;
    if (now.day !== lastDay) {
      lastDay = now.day;
      calEl.querySelector('b').textContent = now.day;
      calEl.querySelector('.m').textContent = MONTHS[now.month - 1];
      calEl.querySelector('.w').textContent = DAYS[now.dow];
      calEl.querySelector('.h').innerHTML = hoursLines(site.hours).join('<br>');
    }
  }

  /* ---------- сцена ---------- */
  function buildScene(m, mob) {
    const def = SCENES[m];
    const list = (mob ? def.mob : def.desk).map((d, i) => {
      const it = Object.assign({}, d, { order: i });
      if (d.id === 'work/scissors') {
        it.texTop = img('work/scissors-blade-top');
        it.texBot = img('work/scissors-blade-bottom');
        it.meta = META['work/scissors-blade-top'];
      } else {
        it.tex = img(d.id);
        it.meta = META[d.id];
      }
      if (d.machine) it.wheelTex = img('work/sewing-machine-wheel');
      if (d.lamp) it.tapeTex = img('work/tape-hanging');
      if (d.candle) it.flameTex = img('closed/candle-flame');
      return it;
    });
    /* дальние раньше ближних */
    list.sort((a, b) => a.at[1] - b.at[1]);
    const lightTex = m === 'morning' ? stage.tex(url('home/morning/light-window', 'bg'))
      : m === 'work' ? stage.tex(url('home/work/light-lamp', 'bg')) : null;
    return {
      mode: m, mob, def, list, lightTex, t: 0, fade: 0,
      wheel: { a: 0, v: 0 }, tape: { a: .05, v: 0 }, flame: { lean: 0, f: 1 }
    };
  }

  /* перевод координат фона в пиксели экрана, та же формула, что cover() в шейдере */
  function mapper(W, H) {
    const A = S.bgB && S.bgB.ready ? S.bgB : { w: 16, h: 9 };
    const sa = W / H, ia = A.w / A.h;
    const k = sa > ia ? [1, ia / sa] : [sa / ia, 1];
    const z = S.zoom, o = S.off;
    return {
      x: u => ((u - .5 - o[0]) * z / k[0] + .5) * W,
      y: v => ((v - .5 - o[1]) * z / k[1] + .5) * H,
      P: z / k[1] * H,
      k
    };
  }

  /* рамка картинки так, чтобы видимая часть стояла в точке at нужного размера */
  function place(it, mp, meta) {
    const b = meta.box, asp = meta.w / meta.h;
    let rh;
    if (it.h) rh = it.h * mp.P / (b[3] - b[1]);
    else rh = it.w * mp.P / (b[2] - b[0]) / asp;
    const rw = rh * asp;
    const ax = mp.x(it.at[0]), ay = mp.y(it.at[1]);
    const cx = (b[0] + b[2]) / 2, cy = it.flat ? (b[1] + b[3]) / 2 : b[3];
    return { rect: { x: ax - rw * cx, y: ay - rh * cy, w: rw, h: rh }, piv: [ax, ay] };
  }
  /* точка на картинке (доли) в пиксели экрана с учётом поворота */
  function ptOn(rect, piv, m, p) {
    const d = [rect.x + p[0] * rect.w - piv[0], rect.y + p[1] * rect.h - piv[1]];
    const q = apply(m, d);
    return [piv[0] + q[0], piv[1] + q[1]];
  }

  /* ---------- кадр сцены: из описаний в список для stage ---------- */
  function frameScene(sc, dt, time, W, H, items, lights, appear) {
    const mp = mapper(W, H);
    const def = sc.def;
    const tint = def.tint;
    sc.t += dt;
    const dropIn = i => {
      const k = smooth((sc.t - .15 - i * .07) / .9);
      return { a: k * appear, dy: (1 - k) * -10 };
    };

    /* свет для этого режима: точка и цвет */
    let lp = [0, 0, 1, 0], lc = [0, 0, 0];
    const flame = sc.flame;
    if (sc.mode === 'closed') {
      const n = Math.sin(time * 7.3) * .05 + Math.sin(time * 13.7 + 1) * .035 + Math.sin(time * 23.1 + 2) * .025 + Math.sin(time * 2.1) * .03;
      const gust = clamp(Math.abs(mouseV.x) * .08, 0, .25);
      flame.f = .92 + n - gust * .5;
      flame.lean += ((clamp(-mouseV.x * .05, -.35, .35) + Math.sin(time * 1.7) * .03) - flame.lean) * clamp(dt * 3, 0, 1);
    }

    const shadows = [], objs = [], glows = [];
    let bulb = null;

    sc.list.forEach(it => {
      const ap = dropIn(it.order);
      if (ap.a <= .002) return;
      const meta = it.meta;
      const pl = place(it, mp, meta);
      pl.rect.y += ap.dy; pl.piv[1] += ap.dy;
      const fy = it.flat || 1;
      let m = mul(scl(1, fy), rot((it.rot || 0) * RAD));

      /* машинка подрагивает, пока шьёт */
      if (it.machine && sc.wheel.v > .5) {
        const j = sc.wheel.v / 12;
        pl.rect.x += Math.sin(time * 61) * .35 * j; pl.rect.y += Math.sin(time * 47) * .25 * j;
      }

      /* тень: у стоящих пятно у основания, у лежащих мягкий отпечаток со сдвигом */
      const vw = (meta.box[2] - meta.box[0]) * pl.rect.w;
      const sdir = sc.mode === 'morning' ? 1 : sc.mode === 'work' ? -.6 : (pl.piv[0] < (sc.candlePx || 0) ? -1 : 1);
      if (it.flat) {
        const vh = (meta.box[3] - meta.box[1]) * pl.rect.h * fy;
        shadows.push({ k: 'shadow', rect: { x: pl.piv[0] - vw * .56 + sdir * vw * .03, y: pl.piv[1] - vh * .5 + vh * .12, w: vw * 1.12, h: vh * 1.1 }, alpha: .32 * ap.a });
      } else {
        const sw = vw * 1.05, sh = Math.max(6, sw * .16);
        shadows.push({ k: 'shadow', rect: { x: pl.piv[0] - sw / 2 + sdir * sw * .06, y: pl.piv[1] - sh * .62, w: sw, h: sh }, alpha: .55 * ap.a });
      }

      const base = { tint, lc, lp: null, alpha: ap.a };

      if (it.snip) {
        /* ножницы: две половинки на общей оси; раз в 9 секунд щёлкают дважды */
        const ph = (time + 3) % 9;
        const open = (6 + (ph < 1.4 ? Math.abs(Math.sin(ph / 1.4 * Math.PI * 2)) * 16 : 0)) * RAD;
        const piv = [pl.rect.x + pl.rect.w / 2, pl.rect.y + pl.rect.h / 2];
        objs.push(Object.assign({}, base, { k: 'img', tex: it.texBot, rect: pl.rect, piv, m: mul(m, rot(open / 2)) }));
        objs.push(Object.assign({}, base, { k: 'img', tex: it.texTop, rect: pl.rect, piv, m: mul(m, rot(-open / 2)) }));
        return;
      }

      const o = Object.assign({}, base, { k: 'img', tex: it.tex, rect: pl.rect, piv: pl.piv, m });
      if (it.sway) o.wob = [.006, 1.1, 0, .5];
      objs.push(o);

      if (it.machine) {
        /* маховик на торце: круг сжат по ширине, будто смотрим сбоку */
        const c = ptOn(pl.rect, pl.piv, m, PTS.wheel);
        const wm = META['work/sewing-machine-wheel'];
        const D = pl.rect.h * .29;
        const rh = D / (wm.box[3] - wm.box[1]);
        const wr = { x: c[0] - rh / 2, y: c[1] - rh / 2, w: rh, h: rh };
        const wmx = mul(rot(-4 * RAD), mul(scl(.36, 1), rot(sc.wheel.a)));
        objs.push(Object.assign({}, base, { k: 'img', tex: it.wheelTex, rect: wr, piv: c, m: wmx }));
      }

      if (it.lamp) {
        bulb = ptOn(pl.rect, pl.piv, m, PTS.lampBulb);
        const e = ptOn(pl.rect, pl.piv, m, PTS.lampElbow);
        const tm = META['work/tape-hanging'];
        const len = it.h * .52 * mp.P;
        const rh = len / (tm.box[3] - tm.box[1]), rw = rh * tm.w / tm.h;
        objs.push(Object.assign({}, base, {
          k: 'img', tex: it.tapeTex, rect: { x: e[0] - rw * .5, y: e[1] - rh * .01, w: rw, h: rh },
          piv: e, m: rot(sc.tape.a), wob: [.012, 1.4, 1, .1]
        }));
        glows.push({ k: 'glow', col: [1, .78, .45], alpha: .55 * ap.a, rect: { x: bulb[0] - mp.P * .07, y: bulb[1] - mp.P * .05, w: mp.P * .14, h: mp.P * .1 } });
      }

      if (it.steam) {
        const c = ptOn(pl.rect, pl.piv, m, PTS.cupRim);
        const sw = vw * .8, sh = it.h * mp.P * 1.7;
        glows.push({ k: 'steam', alpha: .4 * ap.a, bend: clamp(-mouseV.x * .04, -.25, .25), rect: { x: c[0] - sw / 2, y: c[1] - sh, w: sw, h: sh } });
        glows.push({ k: 'steam', alpha: .28 * ap.a, seed: 17, bend: clamp(-mouseV.x * .05, -.3, .3), rect: { x: c[0] - sw * .35, y: c[1] - sh * .9, w: sw * .7, h: sh * .9 } });
      }

      if (it.candle) {
        const wk = ptOn(pl.rect, pl.piv, m, PTS.wick);
        sc.candlePx = wk[0];
        const fm = META['closed/candle-flame'];
        const fh = it.h * mp.P * .2;
        const rh = fh / (fm.box[3] - fm.box[1]), rw = rh * fm.w / fm.h;
        const fr = { x: wk[0] - rw * .5, y: wk[1] + rh * .02 - rh, w: rw, h: rh };
        const fpiv = [wk[0], wk[1] + rh * .02];
        const fmx = mul(rot(flame.lean), scl(1 - (flame.f - 1) * .5, flame.f));
        objs.push({ k: 'img', tex: it.flameTex, rect: fr, piv: fpiv, m: fmx, tint: [1.05, 1, .95], alpha: ap.a, wob: [.03, 6, 0, 1] });
        const fc = [wk[0] + Math.sin(flame.lean) * fh * .5, wk[1] - fh * .45];
        const big = mp.P * .62 * (.9 + flame.f * .1), core = mp.P * .1;
        glows.push({ k: 'glow', col: [1, .55, .22], alpha: .32 * flame.f * ap.a, rect: { x: fc[0] - big / 2, y: fc[1] - big / 2, w: big, h: big } });
        glows.push({ k: 'glow', col: [1, .8, .5], alpha: .55 * flame.f * ap.a, rect: { x: fc[0] - core / 2, y: fc[1] - core * .6, w: core, h: core * 1.2 } });
        sc.light = [fc[0], fc[1], mp.P * .42, 1.05 * flame.f * ap.a];
      }

      if (it.clock && clockEl) {
        const q = PTS.clockScreen, r = pl.rect;
        const x0 = r.x + q[0] * r.w, y0 = r.y + q[1] * r.h, w = (q[2] - q[0]) * r.w, h = (q[3] - q[1]) * r.h;
        clockEl.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
        clockEl.style.width = w.toFixed(1) + 'px'; clockEl.style.height = h.toFixed(1) + 'px';
        clockEl.style.opacity = ap.a.toFixed(3);
        glows.push({ k: 'glow', col: [1, .32, .12], alpha: .22 * ap.a, rect: { x: x0 - w * .3, y: y0 - h * .4, w: w * 1.6, h: h * 1.9 } });
      }
      if (it.calendar && calEl) {
        const q = PTS.calendarPage, r = pl.rect;
        const x0 = r.x + q[0] * r.w, y0 = r.y + q[1] * r.h, w = (q[2] - q[0]) * r.w, h = (q[3] - q[1]) * r.h;
        calEl.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
        calEl.style.width = w.toFixed(1) + 'px'; calEl.style.height = h.toFixed(1) + 'px';
        calEl.style.fontSize = (h / 10).toFixed(2) + 'px';
        sc.calEl = { x: x0 + w / 2, y: y0 + h / 2, a: ap.a };
      }
    });

    /* общий свет режима */
    if (sc.mode === 'closed' && sc.light) { lp = sc.light; lc = [1, .62, .32]; }
    else if (sc.mode === 'work') {
      const b = bulb || [mp.x(.8), mp.y(.6)];
      lp = [b[0], b[1] + mp.P * .18, mp.P * .45, .45]; lc = [1, .86, .62];
    } else if (sc.mode === 'morning') {
      lp = [mp.x(.12), mp.y(.25), mp.P * 1.1, .4]; lc = [1, .78, .5];
    }
    objs.forEach(o => { if (!o.lp && o.tint === tint) { o.lp = lp; o.lc = lc; } });

    /* календарь в свете свечи темнее и мерцает вместе с ней */
    if (sc.calEl && calEl) {
      const d = sc.light ? Math.hypot(sc.calEl.x - sc.light[0], sc.calEl.y - sc.light[1]) / sc.light[2] : 9;
      const L = .3 + (sc.light ? sc.light[3] * Math.exp(-d * d) * .55 : 0);
      calEl.style.opacity = sc.calEl.a.toFixed(3);
      calEl.style.filter = `brightness(${clamp(L, .25, 1).toFixed(3)})`;
    }

    /* световой слой: окно ползёт и иногда тускнеет, будто идут облака */
    if (sc.lightTex) {
      let a, shift, col;
      if (sc.mode === 'morning') {
        const mins = (nowCache.h * 60 + nowCache.m - 360) / 240;
        shift = [-.02 + clamp(mins, 0, 1) * .04 + Math.sin(time * .02) * .012, Math.sin(time * .015) * .006];
        const cloud = .82 + .18 * (Math.sin(time * .11) * .5 + Math.sin(time * .047 + 2) * .5);
        a = .3 * cloud; col = [1, .78, .5];
        S.dust.amt = def.dust.amt * (.7 + .3 * cloud);
      } else {
        shift = [0, 0]; a = .16; col = [1, .84, .6];
      }
      const k = smooth(sc.t / 1.2) * appear;
      lights.push({ tex: sc.lightTex, alpha: a * k, col, shift, over: false });
      lights.push({ tex: sc.lightTex, alpha: a * .45 * k, col, shift, over: true });
    }

    items.push(...shadows, ...objs, ...glows);
  }

  /* ---------- физика: маховик, сантиметр ---------- */
  function physics(sc, dt, time) {
    const ph = (time + 2) % 11;
    const target = ph < 4 ? 11 : 0;
    sc.wheel.v += (target - sc.wheel.v) * clamp(dt * (target ? 1.6 : .9), 0, 1);
    sc.wheel.a += sc.wheel.v * dt;
    const tp = sc.tape;
    const force = -mouseV.x * .9 + Math.sin(time * .6) * .04 + (sc.wheel.v > 1 ? Math.sin(time * 40) * .05 : 0);
    tp.v += (-5 * tp.a - .55 * tp.v + force) * dt;
    tp.a = clamp(tp.a + tp.v * dt, -.4, .4);
  }

  function targetView(W, H) {
    const mob = W / H < .8;
    const A = S.bgB && S.bgB.ready ? S.bgB : { w: 16, h: 9 };
    const sa = W / H, ia = A.w / A.h;
    const k0 = sa > ia ? 1 : sa / ia;
    const zoom = mob ? 1.02 : 1.03;
    const hw = .5 * k0 / zoom;
    const want = mob ? .225 : .955 - .5 - hw;
    return { zoom, off: [clamp(want, 0, Math.max(0, .5 - hw)), 0], mob };
  }

  return {
    get mode() { return mode; },
    bg() { return stage ? bgOf(mode) : null; },
    preload() { if (stage) bgOf(mode); },
    activate(ease) {
      active = true;
      if (!S) return;
      S.bgA = bgOf(mode); S.bgB = S.bgA; S.bgMix = 0; S.dark = 0; S.bag.on = false;
      view.snap = !ease;
      if (ease) { view.zoom = S.zoom; view.off = S.off.slice(); }
      if (!peeking) { scene = null; leaving = null; }
      peeking = false;
      if (fx) fx.hidden = false;
    },
    /* конец превью: предметы уже проявляются на столе, камерой пока управляет превью */
    peek() {
      if (!S || active || peeking) return;
      peeking = true; scene = null; leaving = null;
      if (fx) fx.hidden = false;
    },
    deactivate() {
      active = false; peeking = false;
      if (S) { S.items = []; S.lights = []; }
      if (fx) fx.hidden = true;
    },
    update(dt, mouse, time) {
      check -= dt;
      nowAge -= dt;
      if (nowAge <= 0) { nowAge = .25; nowCache = shopNow(site.timeZone); }
      const now = nowCache;
      if (check <= 0) {
        check = 30;
        status = shopStatus(site);
        const next = forced || status.mode;
        if (next !== mode) {
          mode = next;
          if (!stage) els.cssbg.style.backgroundImage = `url("${url('home/' + mode + '/bg', 'bg')}")`;
          else if (active) { S.bgA = S.bgB; S.bgB = bgOf(mode); S.bgMix = 0; }
        }
        texts();
      }
      tickTexts(now);
      if (!(active || peeking) || !S) return;

      /* скорость мыши для пара, пламени и сантиметра */
      const vx = (mouse.x - lastMouse.x) / Math.max(dt, 1e-3), vy = (mouse.y - lastMouse.y) / Math.max(dt, 1e-3);
      lastMouse.x = mouse.x; lastMouse.y = mouse.y;
      mouseV.x += (vx - mouseV.x) * clamp(dt * 6, 0, 1);
      mouseV.y += (vy - mouseV.y) * clamp(dt * 6, 0, 1);

      const W = innerWidth, H = innerHeight;
      const tv = targetView(W, H);

      /* смена сцены: старая гаснет, новая проявляется */
      if (!scene || scene.mode !== mode || scene.mob !== tv.mob) {
        if (scene && scene.mode !== mode) { leaving = scene; leaving.out = 0; }
        scene = buildScene(mode, tv.mob);
      }

      /* фон перетекает за 2.5 с */
      if (active && S.bgA !== S.bgB) {
        S.bgMix = Math.min(1, S.bgMix + dt / 2.5);
        if (S.bgMix >= 1) { S.bgA = S.bgB; S.bgMix = 0; }
      }
      if (active) {
        S.dark = 0;
        /* камера: плавно к нужному кадру, лёгкое дыхание, сдвиг за мышью */
        const vk = view.snap ? 1 : clamp(dt * 1.6, 0, 1);
        view.snap = false;
        view.zoom += (tv.zoom - view.zoom) * vk;
        view.off[0] += (tv.off[0] - view.off[0]) * vk;
        view.off[1] += (tv.off[1] - view.off[1]) * vk;
        S.zoom = view.zoom + Math.sin(time * .05) * .006;
        S.off = [view.off[0] + mouse.x * -0.006, view.off[1] + mouse.y * -0.004];
        S.vig = .55;
        const d = SCENES[mode].dust;
        S.dust.amt += (d.amt - S.dust.amt) * Math.min(1, dt * 2);
        S.dust.col = d.col;
      }

      const items = [], lights = [];
      if (leaving) {
        leaving.out += dt / 1.2;
        physics(leaving, calm ? 0 : dt, calm ? 0 : time);
        if (leaving.out >= 1) leaving = null;
        else frameScene(leaving, dt, calm ? 0 : time, W, H, items, lights, 1 - smooth(leaving.out));
      }
      /* при "уменьшить движение" предметы стоят, только проявляются */
      const at = calm ? 0 : time;
      physics(scene, calm ? 0 : dt, at);
      frameScene(scene, dt, at, W, H, items, lights, 1);
      S.items = items; S.lights = lights;

      if (clockEl && !SCENES[mode].desk.some(x => x.clock)) clockEl.style.opacity = 0;
      if (calEl && !SCENES[mode].desk.some(x => x.calendar)) calEl.style.opacity = 0;
    }
  };
}
