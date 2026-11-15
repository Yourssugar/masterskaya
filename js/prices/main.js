/* Страница цен. На телефоне и без WebGL цены просто списком, на компьютере
   блокнот на столе, его можно листать. Список есть в разметке всегда,
   на компьютере открывается кнопкой "Текстом". */

import { SITE } from '../config.js';
import { contactText } from '../clock.js';
import { setupCommon } from '../common.js';
import { PRICES } from './data.js';

const $ = id => document.getElementById(id);
setupCommon();

const data = Object.assign({}, PRICES, {
  phone: SITE.phone,
  hours: 'пишите ' + contactText(SITE.contact || SITE.hours)
});

/* ---------- список ---------- */
function renderList() {
  const box = $('list-body');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  data.intro.forEach(l => box.appendChild(el('p', 'p-intro', l)));
  data.sections.forEach(sec => {
    const s = el('section', 'p-sec');
    s.appendChild(el('h2', null, sec.title));
    const ul = el('ul');
    sec.items.forEach(it => {
      const li = el('li');
      if (it.strike) { li.className = 'p-strike'; li.appendChild(el('s', null, it.strike)); }
      else if (it.text) { li.className = 'p-text'; li.textContent = it.text; }
      else {
        const row = el('div', 'p-row');
        row.appendChild(el('span', 'p-name', it.name));
        row.appendChild(el('span', 'p-dots'));
        row.appendChild(el('span', 'p-price', it.price || ''));
        li.appendChild(row);
        if (it.note) li.appendChild(el('span', 'p-note', it.note));
      }
      ul.appendChild(li);
    });
    s.appendChild(ul);
    box.appendChild(s);
  });
  data.outro.forEach((l, i) => box.appendChild(el('p', 'p-outro' + (i ? '' : ' first'), l)));
}
renderList();

const list = $('list');
function openList(v) {
  document.body.classList.toggle('show-list', v);
  $('as-text').textContent = v ? 'Блокнотом' : 'Текстом';
}
$('as-text').addEventListener('click', () => openList(!document.body.classList.contains('show-list')));

/* ---------- блокнот ---------- */
const wide = innerWidth >= 900 && innerWidth / innerHeight >= .85;
function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

async function fonts() {
  if (!document.fonts) return;
  const t = new Promise(r => setTimeout(r, 3000));
  await Promise.race([Promise.all([
    document.fonts.load('500 40px "Caveat"', 'Цены'),
    document.fonts.load('700 40px "Caveat"', 'Цены')
  ]).catch(() => null), t]);
}

if (wide && webgl()) {
  document.body.classList.add('book');
  fonts().then(() => import('./scene.js')).then(({ createPriceScene }) => {
    let last = false, sc = null;
    sc = createPriceScene({
      canvas: $('scene'), data,
      onState(s) {
        $('prev').disabled = !s.canPrev;
        $('next').disabled = !s.canNext;
        $('pager-page').textContent = (s.spread + 1) + ' из ' + s.spreads;
        if (s.busy && !last) sc && sc.nudge();
        last = s.busy;
      }
    });
    $('prev').addEventListener('click', () => sc.prev());
    $('next').addEventListener('click', () => sc.next());
    addEventListener('keydown', e => {
      if (document.body.classList.contains('show-list') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); sc.next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); sc.prev(); }
      if (e.key === 'Escape') openList(false);
    });
    document.body.classList.add('ready');
  }).catch(err => {
    console.error(err);
    document.body.classList.remove('book');
  });
}
