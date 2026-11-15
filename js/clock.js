/* Время мастерской и режим главной: утро, работа, закрыто. */

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const ON_DAY = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];

export function shopNow(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  }).formatToParts(date);
  const p = {};
  for (const x of parts) p[x.type] = x.value;
  const h = +p.hour % 24, m = +p.minute;
  return {
    dow: DOW[p.weekday], year: +p.year, month: +p.month, day: +p.day,
    h, m, s: +p.second, hours: h + m / 60
  };
}

export function fmtHour(x) {
  const h = Math.floor(x), m = Math.round((x - h) * 60);
  return h + ':' + String(m).padStart(2, '0');
}

/* mode: 'work' | 'morning' | 'closed', text: строка для посетителя */
export function shopStatus(site, now = shopNow(site.timeZone)) {
  const today = site.hours[now.dow];
  if (today && now.hours >= today[0] && now.hours < today[1]) {
    return { mode: 'work', open: true, text: 'Сейчас открыто, до ' + fmtHour(today[1]) };
  }
  if (today && now.hours < today[0]) {
    const morning = now.hours >= site.morningFrom;
    return {
      mode: morning ? 'morning' : 'closed', open: false,
      text: 'Откроемся сегодня в ' + fmtHour(today[0])
    };
  }
  for (let d = 1; d <= 7; d++) {
    const dow = (now.dow + d) % 7, hrs = site.hours[dow];
    if (!hrs) continue;
    const when = d === 1 ? 'завтра' : ON_DAY[dow];
    return { mode: 'closed', open: false, text: 'Откроемся ' + when + ' в ' + fmtHour(hrs[0]) };
  }
  return { mode: 'closed', open: false, text: 'Сейчас закрыто' };
}

/* ---------- когда можно звонить и писать ---------- */
const EXCEPT = ['воскресенья', 'понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы'];

/* "с 10:00 до 20:00, кроме воскресенья" из таблицы как у hours,
   short: "10:00-20:00, кроме воскресенья" для шапки */
export function contactText(table, short) {
  const on = [0, 1, 2, 3, 4, 5, 6].filter(d => table[d]);
  const off = [1, 2, 3, 4, 5, 6, 0].filter(d => !table[d]);
  const same = on.every(d => table[d][0] === table[on[0]][0] && table[d][1] === table[on[0]][1]);
  if (!on.length) return '';
  if (!same) {
    const SH = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return [1, 2, 3, 4, 5, 6, 0].filter(d => table[d])
      .map(d => SH[d] + ' ' + fmtHour(table[d][0]) + '-' + fmtHour(table[d][1])).join(', ');
  }
  const h = table[on[0]];
  let t = short ? fmtHour(h[0]) + '-' + fmtHour(h[1]) : 'с ' + fmtHour(h[0]) + ' до ' + fmtHour(h[1]);
  if (off.length) t += ', кроме ' + off.map(d => EXCEPT[d]).join(' и ');
  return t;
}

/* ok: мастер сейчас на связи; next: когда ответит, если нет */
export function contactStatus(site, now = shopNow(site.timeZone)) {
  const table = site.contact || site.hours;
  const today = table[now.dow];
  if (today && now.hours >= today[0] && now.hours < today[1]) return { ok: true, next: '' };
  if (today && now.hours < today[0]) return { ok: false, next: 'сегодня после ' + fmtHour(today[0]) };
  for (let d = 1; d <= 7; d++) {
    const dow = (now.dow + d) % 7, h = table[dow];
    if (!h) continue;
    return { ok: false, next: (d === 1 ? 'завтра' : ON_DAY[dow]) + ' после ' + fmtHour(h[0]) };
  }
  return { ok: false, next: '' };
}
