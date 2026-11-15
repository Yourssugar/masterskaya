/* Страница "Было и стало": игра с ремонтом случайной работы и галерея всех работ.
   Список работ лежит в works/list.json, фото в works/img/ (добавлять через tools/add-work.py). */

import { SITE } from './config.js';
import { shopStatus } from './clock.js';
import { setupCommon } from './common.js';
import { createRepairFx } from './repair-fx.js';

const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) < 1700;
const img = path => path + (small ? '-m' : '') + '.webp';

setupCommon();

/* фон страницы: тот же стол, что на главной сейчас */
$('pagebg').style.backgroundImage = `url("img/home/${shopStatus(SITE).mode}/bg${small ? '-m' : ''}.webp")`;

function fmtDate(s) {
  const M = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const [y, m, d] = (s || '').split('-').map(Number);
  return y ? d + ' ' + M[m - 1] + ' ' + y : '';
}

function load(src) {
  return new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im));
    im.onerror = () => res(null);
    im.src = src;
  });
}

/* ---------- игра ---------- */
const photo = $('g-photo'), tag = $('g-tag'), cap = $('g-cap'), go = $('g-go'), next = $('g-next'), frameEl = $('g-frame');
const fx = createRepairFx($('g-fx'), {
  textures: ['img/preview/tex/linen-tile.webp', 'img/preview/tex/canvas-graphite-tile.webp']
});
let works = [], cur = -1, afterReady = null;

function pick() {
  if (works.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * works.length); } while (i === cur);
  return i;
}

function show(i) {
  cur = i;
  const w = works[i];
  photo.src = img(w.before);
  photo.alt = 'До ремонта: ' + w.title;
  tag.textContent = 'Было';
  tag.classList.remove('after');
  $('g-demo').hidden = !w.demo;
  cap.textContent = '';
  go.hidden = false; go.disabled = false;
  next.hidden = true;
  afterReady = load(img(w.after));
}

async function repair() {
  const w = works[cur];
  go.disabled = true;
  const after = await afterReady;
  const swap = () => {
    if (after) photo.src = after.src;
    photo.alt = 'После ремонта: ' + w.title;
    tag.textContent = 'Стало';
    tag.classList.add('after');
  };
  const done = () => {
    cap.textContent = w.title + (w.date ? ', ' + fmtDate(w.date) : '');
    go.hidden = true;
    next.hidden = works.length < 2;
    if (!next.hidden) next.focus();
  };
  if (RM) {
    frameEl.classList.add('fade');
    setTimeout(() => { swap(); frameEl.classList.remove('fade'); done(); }, 350);
    return;
  }
  fx.run({
    shake(k, t) {
      const a = k * 4;
      frameEl.style.transform = a ? `translate(${(Math.sin(t * 90) * a).toFixed(2)}px, ${(Math.cos(t * 77) * a * .6).toFixed(2)}px) rotate(${(Math.sin(t * 60) * k * .4).toFixed(2)}deg)` : '';
    },
    swap, done
  });
}

go.addEventListener('click', repair);
next.addEventListener('click', () => show(pick()));

/* ---------- галерея: шторка между до и после ---------- */
function card(w) {
  const el = document.createElement('figure');
  el.className = 'cmp-card';
  el.innerHTML = `
    <div class="cmp" style="--p:50%">
      <img class="cmp-after" loading="lazy" alt="">
      <img class="cmp-before" loading="lazy" alt="">
      <span class="cmp-line" aria-hidden="true"><i></i></span>
      <span class="cmp-l">Было</span><span class="cmp-r">Стало</span>
      <input type="range" min="0" max="100" value="50" aria-label="Сравнить до и после">
    </div>
    <figcaption><b></b><span></span></figcaption>`;
  el.querySelector('.cmp-after').src = img(w.after);
  el.querySelector('.cmp-after').alt = 'После ремонта: ' + w.title;
  el.querySelector('.cmp-before').src = img(w.before);
  el.querySelector('.cmp-before').alt = 'До ремонта: ' + w.title;
  el.querySelector('b').textContent = w.title;
  el.querySelector('figcaption span').textContent = (w.demo ? 'пример' : '') + (w.date && !w.demo ? fmtDate(w.date) : '');
  const box = el.querySelector('.cmp'), range = el.querySelector('input');
  range.addEventListener('input', () => box.style.setProperty('--p', range.value + '%'));
  return el;
}

fetch('works/list.json', { cache: 'no-cache' })
  .then(r => r.json())
  .catch(() => [])
  .then(list => {
    works = list.filter(w => w && w.before && w.after);
    if (!works.length) {
      $('game').hidden = true; go.hidden = true;
      cap.textContent = 'Скоро здесь появятся работы мастера.';
      return;
    }
    show(pick());
    const g = $('gallery');
    works.forEach(w => g.appendChild(card(w)));
  });
