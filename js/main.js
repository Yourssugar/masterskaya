import { SITE, INTRO_VERSION } from './config.js';
import { createStage } from './stage.js';
import { createIntro } from './intro.js';
import { createHome } from './home.js';

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'masterskaya:intro';

/* ---------- качество графики (как в library A.C.EON) ---------- */
const PROFILES = {
  low: { id: 'low', pixelRatio: 1, dust: 0 },
  medium: { id: 'medium', pixelRatio: 1.5, dust: 110 },
  high: { id: 'high', pixelRatio: 2, dust: 220 }
};
function guessQuality() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (touch || cores <= 4) return 'medium';
  return 'high';
}
const quality = PROFILES[Q.get('q')] || PROFILES[guessQuality()];

/* маленькие версии картинок (-m) для телефонов и слабых машин */
const small = quality.id === 'low' || Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) < 1700;
function url(name) { return 'img/' + name + (small ? '-m' : '') + '.webp'; }

/* ---------- где стоит сумка: k = 0 по центру, k = 1 в финале ---------- */
function layout(W, H, k) {
  const mob = W / H < 0.8;
  let s, cx, base;
  if (!mob) {
    s = Math.min(H * 0.72, W * 0.46); cx = W * 0.5; base = H * 0.86;
    s += (s * 0.84 - s) * k; cx += (W * 0.72 - cx) * k;
  } else {
    s = Math.min(W * 0.96, H * 0.5); cx = W * 0.5; base = H * 0.76;
    s += (s * 0.5 - s) * k; base += (H * 0.36 - base) * k;
  }
  return { x: cx - s / 2, y: base - s * (1700 / 2048), w: s, h: s };
}

/* ---------- тексты из настроек ---------- */
document.title = SITE.name + ' ' + SITE.place + '. ' + SITE.tagline;
document.querySelectorAll('[data-site]').forEach(el => { el.textContent = SITE[el.dataset.site]; });
document.querySelectorAll('[data-tel]').forEach(el => { el.href = 'tel:' + SITE.phoneRaw; });
document.querySelectorAll('[data-viber]').forEach(el => { el.href = 'viber://chat?number=' + encodeURIComponent(SITE.phoneRaw); });
document.querySelectorAll('[data-telegram]').forEach(el => { el.href = 'https://t.me/' + SITE.phoneRaw; });

/* ---------- сцена ---------- */
const canvas = $('gl');
let stage = null;
try { stage = createStage(canvas, quality); } catch (e) { console.warn(e); }
if (!stage) document.body.classList.add('nogl');

const home = createHome({ stage, site: SITE, url, forced: Q.get('t'), els: { status: $('status'), cssbg: $('cssbg') } });

const els = {
  root: $('intro'), svg: $('thread'), props: $('props'), phrases: $('phrases'),
  needle: $('needle'), scissors: $('scissors'), bladeTop: $('blade-top'), bladeBot: $('blade-bot'),
  home: $('home'), top: $('top'), bar: $('bar'), skip: $('skip')
};

let seen = false;
try { seen = localStorage.getItem(KEY) === INTRO_VERSION; } catch (e) { /* приватный режим */ }
function markSeen() { try { localStorage.setItem(KEY, INTRO_VERSION); } catch (e) { /* ничего */ } }

const intro = stage ? createIntro({
  stage, url, layout, els,
  homeBg: () => home.bg(),
  onEnd() { markSeen(); home.activate(); }
}) : null;

async function play(at = 0) {
  if (!intro) return;
  home.deactivate();
  home.preload();
  document.body.classList.add('in-intro', 'loading');
  const ok = await intro.prepare();
  document.body.classList.remove('loading');
  if (!ok) {
    document.body.classList.remove('in-intro');
    home.activate();
    return;
  }
  intro.start(at);
}

$('skip').addEventListener('click', () => { intro && intro.skip(); markSeen(); });
$('replay').addEventListener('click', () => play(0));
addEventListener('keydown', e => { if (e.key === 'Escape' && intro && intro.running) intro.skip(); });
if (!intro) $('replay').hidden = true;

const wantIntro = Q.has('intro') || Q.has('seek') || (!seen && !RM);
if (intro && wantIntro) play(parseFloat(Q.get('seek')) || 0);
else home.activate();

/* ---------- мышь ---------- */
const mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  target.x = e.clientX / innerWidth * 2 - 1;
  target.y = e.clientY / innerHeight * 2 - 1;
}, { passive: true });

addEventListener('resize', () => stage && stage.resize());

/* ---------- цикл ---------- */
const paused = Q.has('pause');
let last = performance.now(), time = 0, ema = 16, cool = 3;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now; time += dt;
  const k = 1 - Math.pow(1 - 0.06, dt * 60);
  mouse.x += (target.x - mouse.x) * k;
  mouse.y += (target.y - mouse.y) * k;

  if (intro && intro.running) intro.update(paused ? 0 : dt, mouse);
  home.update(dt, mouse, time);
  if (!stage) return;
  stage.render(time);

  /* если кадры тяжёлые, снижаем разрешение, а не плавность */
  ema = ema * .95 + dt * 1000 * .05;
  cool -= dt;
  if (cool <= 0 && ema > 26 && stage.scale > .6) { stage.setScale(stage.scale * .85); cool = 3; }
}
requestAnimationFrame(loop);
