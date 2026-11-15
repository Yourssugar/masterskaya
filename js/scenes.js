/* Что стоит на столе в каждое время суток.

   Координаты в долях фоновой картинки: u слева направо (0..1 по ширине),
   v сверху вниз (0..1 по высоте). Край стола на фоне около v = 0.645,
   передний край около v = 0.95. Размеры h и w в долях высоты фона.

   Стоящий предмет: at = середина низа, h = видимая высота.
   Лежащий (flat): at = середина предмета, w = видимая ширина,
   flat = насколько сплющить по высоте, чтобы он лёг на стол, rot = поворот на столе.

   desk для широких экранов (текст слева, предметы справа),
   mob для телефона (текст сверху, предметы внизу в узком окне). */

/* размеры исходников и видимая рамка без прозрачных полей (доли) */
const M = (w, h, box) => ({ w, h, box: box || [50 / w, 50 / h, 1 - 50 / w, 1 - 50 / h] });
export const META = {
  'morning/cup-saucer': M(1400, 1208),
  'morning/spoon': M(1400, 941),
  'morning/croissant-napkin': M(1400, 1010),
  'morning/notebook-pencil': M(1400, 1216),
  'morning/glasses': M(1400, 553),
  'morning/vase-twig': M(623, 1400),
  'morning/fabric-folded': M(1400, 1094),
  'work/sewing-machine': M(1379, 1400),
  'work/sewing-machine-wheel': M(1400, 1400),
  'work/lamp': M(1311, 1400),
  'work/tape-hanging': M(800, 1600, [220 / 800, 0, 503 / 800, 1500 / 1600]),
  'work/tape-coil': M(1400, 1010),
  'work/bag-in-progress': M(1400, 1319),
  'work/pincushion': M(1308, 1399),
  'work/chalk': M(1400, 1219),
  'work/hardware-scatter': M(1400, 1317),
  'work/leather-offcuts': M(1400, 1120),
  'work/pattern-pieces': M(1400, 1277),
  'work/spool-red': M(914, 1400),
  'work/spool-olive': M(916, 1400),
  'work/spool-linen': M(915, 1400),
  'work/spool-graphite': M(916, 1400),
  'work/spool-brass': M(916, 1400),
  'work/scissors-blade-top': M(2048, 2048, [265 / 2048, 685 / 2048, 1859 / 2048, 1378 / 2048]),
  'work/scissors-blade-bottom': M(2048, 2048, [265 / 2048, 685 / 2048, 1859 / 2048, 1378 / 2048]),
  'closed/candle-body': M(1305, 1400),
  'closed/candle-flame': M(512, 1024, [168 / 512, 94 / 1024, 344 / 512, 1]),
  'closed/clock': M(1400, 761),
  'closed/calendar': M(1400, 1277),
  'closed/bag-finished': M(829, 1400),
  'closed/cloth': M(1400, 1031),
  'closed/scissors': M(1400, 661),
  'closed/spool-red': M(916, 1400)
};

/* точки на картинках (доли размера исходника) */
export const PTS = {
  wheel: [0.872, 0.30],          // торец машинки, где стоит маховик
  lampBulb: [0.29, 0.40],        // лампочка в абажуре
  lampElbow: [0.915, 0.305],     // верхний шарнир лампы, на нём висит сантиметр
  cupRim: [0.47, 0.17],          // середина кофе в чашке
  wick: [613.51 / 1305, 172.91 / 1400],
  clockScreen: [237 / 1400, 219 / 761, 1165 / 1400, 546 / 761],
  calendarPage: [156 / 1400, 330 / 1277, 1240 / 1400, 1118 / 1277]
};

export const SCENES = {
  morning: {
    dust: { amt: .95, col: [1, .86, .6] },
    tint: [.95, .86, .76],
    desk: [
      { id: 'morning/vase-twig', at: [.905, .715], h: .30, sway: 1 },
      { id: 'morning/fabric-folded', at: [.79, .725], h: .12 },
      { id: 'morning/croissant-napkin', at: [.745, .835], h: .13, flatSh: 1 },
      { id: 'morning/cup-saucer', at: [.615, .865], h: .165, steam: 1 },
      { id: 'morning/spoon', at: [.69, .875], w: .11, flat: .5, rot: -18 },
      { id: 'morning/notebook-pencil', at: [.855, .865], w: .25, flat: .48, rot: 5 },
      { id: 'morning/glasses', at: [.53, .89], w: .14, flat: .65, rot: -7 }
    ],
    mob: [
      { id: 'morning/vase-twig', at: [.825, .725], h: .2, sway: 1 },
      { id: 'morning/croissant-napkin', at: [.775, .84], h: .11, flatSh: 1 },
      { id: 'morning/cup-saucer', at: [.665, .87], h: .14, steam: 1 },
      { id: 'morning/glasses', at: [.72, .925], w: .1, flat: .65, rot: -7 }
    ]
  },
  work: {
    dust: { amt: .4, col: [1, .9, .75] },
    tint: [.86, .82, .78],
    desk: [
      { id: 'work/lamp', at: [.875, .705], h: .42, lamp: 1 },
      { id: 'work/spool-graphite', at: [.585, .715], h: .075 },
      { id: 'work/sewing-machine', at: [.70, .725], h: .30, machine: 1 },
      { id: 'work/spool-red', at: [.835, .775], h: .09 },
      { id: 'work/spool-olive', at: [.868, .762], h: .085 },
      { id: 'work/spool-linen', at: [.905, .79], h: .085 },
      { id: 'work/spool-brass', at: [.53, .80], h: .08 },
      { id: 'work/pincushion', at: [.765, .845], h: .1 },
      { id: 'work/bag-in-progress', at: [.61, .885], h: .24 },
      { id: 'work/leather-offcuts', at: [.9, .885], w: .23, flat: .5, rot: 8 },
      { id: 'work/pattern-pieces', at: [.475, .9], w: .25, flat: .42, rot: -6 },
      { id: 'work/chalk', at: [.545, .925], w: .075, flat: .5, rot: 20 },
      { id: 'work/scissors', at: [.745, .905], w: .25, flat: .55, rot: -10, snip: 1 },
      { id: 'work/hardware-scatter', at: [.83, .935], w: .12, flat: .5 }
    ],
    mob: [
      { id: 'work/sewing-machine', at: [.705, .745], h: .215, machine: 1 },
      { id: 'work/spool-red', at: [.815, .78], h: .075 },
      { id: 'work/spool-olive', at: [.84, .765], h: .07 },
      { id: 'work/pincushion', at: [.63, .84], h: .085 },
      { id: 'work/scissors', at: [.745, .9], w: .18, flat: .55, rot: -10, snip: 1 }
    ]
  },
  closed: {
    dust: { amt: .25, col: [1, .7, .45] },
    tint: [.34, .29, .26],
    desk: [
      { id: 'closed/bag-finished', at: [.83, .725], h: .36 },
      { id: 'closed/calendar', at: [.625, .74], h: .19, calendar: 1 },
      { id: 'closed/spool-red', at: [.945, .75], h: .085 },
      { id: 'closed/candle-body', at: [.715, .845], h: .27, candle: 1 },
      { id: 'closed/clock', at: [.885, .855], h: .12, clock: 1 },
      { id: 'closed/cloth', at: [.54, .895], w: .2, flat: .6, rot: -4 },
      { id: 'closed/scissors', at: [.775, .91], w: .2, flat: .6, rot: -8 }
    ],
    mob: [
      { id: 'closed/calendar', at: [.635, .745], h: .155, calendar: 1 },
      { id: 'closed/spool-red', at: [.835, .755], h: .07 },
      { id: 'closed/candle-body', at: [.715, .85], h: .22, candle: 1 },
      { id: 'closed/clock', at: [.79, .9], h: .1, clock: 1 }
    ]
  }
};
