/* Общее для всех страниц: тексты из настроек, ссылки связи, подсказка
   вне часов связи, ссылка на карту. */

import { SITE } from './config.js';
import { contactStatus, contactText } from './clock.js';

const $ = id => document.getElementById(id);

export function setupCommon() {
  /* маршрут в Google Картах: на телефоне откроется приложение с навигацией */
  const dest = encodeURIComponent(SITE.mapQuery || (SITE.city + ', ' + SITE.address));
  document.querySelectorAll('[data-map]').forEach(el => {
    el.href = 'https://www.google.com/maps/dir/?api=1&destination=' + dest;
    el.title = 'Маршрут до мастерской';
  });

  /* ---------- тексты из настроек ---------- */
  document.querySelectorAll('[data-site]').forEach(el => { el.textContent = SITE[el.dataset.site]; });
  document.querySelectorAll('[data-tel]').forEach(el => { el.href = 'tel:' + SITE.phoneRaw; });
  document.querySelectorAll('[data-viber]').forEach(el => { el.href = 'viber://chat?number=' + encodeURIComponent(SITE.phoneRaw); });
  document.querySelectorAll('[data-telegram]').forEach(el => { el.href = 'https://t.me/' + SITE.phoneRaw; });

  /* ---------- кнопки связи: вне часов связи сначала подсказка ---------- */
  document.querySelectorAll('[data-contact]').forEach(el => { el.textContent = contactText(SITE.contact || SITE.hours); });
  document.querySelectorAll('[data-contact-short]').forEach(el => { el.textContent = contactText(SITE.contact || SITE.hours, true); });
  const pop = $('pop'), popGo = $('pop-go');
  let popFrom = null;
  function closePop() {
    pop.hidden = true;
    if (popFrom) popFrom.focus();
    popFrom = null;
  }
  function openPop(link) {
    const st = contactStatus(SITE);
    $('pop-next').textContent = st.next ? 'Ответим ' + st.next + '.' : '';
    const call = link.hasAttribute('data-tel');
    popGo.href = link.href;
    popGo.textContent = call ? 'Всё равно позвонить' : 'Всё равно написать';
    pop.hidden = false;
    popFrom = link;
    /* на широком экране облачко над кнопкой, на телефоне панель снизу */
    if (innerWidth / innerHeight >= .8) {
      const r = link.getBoundingClientRect();
      pop.style.left = Math.max(12, Math.min(innerWidth - pop.offsetWidth - 12, r.left)) + 'px';
      pop.style.top = Math.max(12, r.top - pop.offsetHeight - 12) + 'px';
    } else { pop.style.left = pop.style.top = ''; }
    $('pop-close').focus();
  }
  document.querySelectorAll('main [data-tel], main [data-viber], main [data-telegram], .top [data-tel]').forEach(a => {
    a.addEventListener('click', e => {
      if (contactStatus(SITE).ok) return;
      e.preventDefault();
      openPop(a);
    });
  });
  popGo.addEventListener('click', () => { pop.hidden = true; popFrom = null; });
  $('pop-close').addEventListener('click', closePop);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !pop.contains(e.target) && !(popFrom && popFrom.contains(e.target))) closePop();
  });
}
