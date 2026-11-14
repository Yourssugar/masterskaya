/* Главная: стол мастерской в свете текущего времени в Минске.
   Пока это только фон и первый экран, предметы и их анимации добавим,
   когда Codex нарисует часть B. */

import { shopStatus } from './clock.js';

const DUST = { morning: { amt: .9, col: [1, .86, .6] }, work: { amt: .35, col: [1, .92, .8] }, closed: { amt: .3, col: [1, .7, .45] } };

export function createHome({ stage, site, url, forced, els }) {
  const S = stage ? stage.S : null;
  let status = shopStatus(site), mode = forced || status.mode;
  let fade = 1, from = null, check = 0, active = false;

  const bgOf = m => stage.tex(url('home/' + m + '/bg', 'bg'));

  function texts() {
    els.status.textContent = status.text;
    els.status.dataset.open = status.open ? '1' : '0';
    document.body.dataset.mode = mode;
  }
  texts();

  if (!stage) {
    /* без WebGL: просто картинка фоном */
    els.cssbg.style.backgroundImage = `url("${url('home/' + mode + '/bg', 'bg')}")`;
  }

  return {
    get mode() { return mode; },
    bg() { return stage ? bgOf(mode) : null; },
    preload() { if (stage) bgOf(mode); },
    activate() {
      active = true;
      if (!S) return;
      S.bgA = bgOf(mode); S.bgB = S.bgA; S.bgMix = 0; S.dark = 0; S.bag.on = false;
    },
    deactivate() { active = false; },
    update(dt, mouse, time) {
      check -= dt;
      if (check <= 0) {
        check = 30;
        status = shopStatus(site);
        const next = forced || status.mode;
        if (next !== mode) {
          from = mode; mode = next; fade = 0;
          if (!stage) els.cssbg.style.backgroundImage = `url("${url('home/' + mode + '/bg', 'bg')}")`;
        }
        texts();
      }
      if (!active || !S) return;
      fade = Math.min(1, fade + dt / 2.5);
      const k = fade * fade * (3 - 2 * fade);
      S.bgA = from && fade < 1 ? bgOf(from) : bgOf(mode);
      S.bgB = bgOf(mode);
      S.bgMix = from && fade < 1 ? k : 0;
      S.dark = 0;
      S.zoom = 1.03 + Math.sin(time * .05) * .01;
      S.off = [mouse.x * -0.008, mouse.y * -0.006];
      S.vig = .55;
      const d = DUST[mode];
      S.dust.amt += (d.amt - S.dust.amt) * Math.min(1, dt * 2);
      S.dust.col = d.col;
    }
  };
}
