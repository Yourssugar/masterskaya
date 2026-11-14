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
