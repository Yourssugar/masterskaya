/* Стол с блокнотом цен (только на компьютере). Свет лампы из-за кадра слева,
   рядом карандаш и катушка. Камера и шаг листания как в книге library A.C.EON. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { createNotebook } from './notebook.js';
import { paintWood, toTexture } from './tex.js';

const coarse = matchMedia('(pointer: coarse)').matches;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

const PROFILES = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, pageTexture: 1024, pageSegments: 14 },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, pageTexture: 1536, pageSegments: 22 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, pageTexture: 2048, pageSegments: 30 }
};
function guess() {
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}

const T_OPEN = .5, T_OPENED = 2.1, T_CAMERA = 2.4;

/* карандаш: шестигранный, крашеный, заточенный конец, латунный хомутик и ластик */
function pencil(shadows) {
  const g = new THREE.Group();
  const L = 6.2, R = .17;
  const paint = new THREE.MeshStandardMaterial({ color: '#2f4a3b', roughness: .45 });
  const wood = new THREE.MeshStandardMaterial({ color: '#d8b483', roughness: .8 });
  const lead = new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: .4, metalness: .3 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: .3, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#c97b72', roughness: .85 });
  const add = (geo, mat, x) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = Math.PI / 2;
    m.position.x = x;
    m.castShadow = shadows; m.receiveShadow = shadows;
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(R, R, L, 6), paint, 0);
  add(new THREE.CylinderGeometry(.05, R * .98, .7, 6), wood, L / 2 + .35).rotation.z = -Math.PI / 2;
  add(new THREE.CylinderGeometry(.005, .05, .16, 12), lead, L / 2 + .78).rotation.z = -Math.PI / 2;
  add(new THREE.CylinderGeometry(R * 1.05, R * 1.05, .42, 16), brass, -L / 2 - .21);
  add(new THREE.CylinderGeometry(R * .98, R * .98, .36, 16), rubber, -L / 2 - .6);
  g.position.y = R * .87;
  return g;
}

/* катушка ниток: деревянные щёчки и бордовая нить */
function spool(shadows) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#a8794a', roughness: .7 });
  const thread = new THREE.MeshStandardMaterial({ color: '#8f2645', roughness: .75 });
  const cap = new THREE.CylinderGeometry(.55, .55, .14, 32);
  const a = new THREE.Mesh(cap, wood), b = new THREE.Mesh(cap, wood);
  a.position.y = .07; b.position.y = 1.23;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, 1.02, 32), thread);
  t.position.y = .65;
  [a, b, t].forEach(m => { m.castShadow = m.receiveShadow = shadows; g.add(m); });
  return g;
}

export function createPriceScene({ canvas, data, onState }) {
  const profile = PROFILES[new URLSearchParams(location.search).get('q')] || PROFILES[guess()];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = profile.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profile.pixelRatio));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0e0c0b');
  scene.fog = new THREE.Fog('#0e0c0b', 26, 48);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 100);

  /* стол */
  const woodMap = toTexture(paintWood({ size: 512, seed: 31, dark: '#170b05', light: '#43261a', rings: 6, planks: 3 }), true);
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.center.set(.5, .5); woodMap.rotation = Math.PI / 2; woodMap.repeat.set(2.2, 3);
  const table = new THREE.Mesh(new THREE.BoxGeometry(40, .8, 26), new THREE.MeshStandardMaterial({ map: woodMap, roughness: .5, color: '#d8b090' }));
  table.position.y = -.4;
  table.receiveShadow = true;
  scene.add(table);

  /* свет: тёплая лампа слева сверху за кадром, мягкий общий, холодная подсветка справа */
  const hemi = new THREE.HemisphereLight('#ffe3c0', '#0e0806', .55);
  scene.add(hemi);
  const lamp = new THREE.SpotLight('#ffd7a0', 0, 0, .62, .75, 1.6);
  lamp.position.set(-7.5, 10, -4);
  lamp.target.position.set(.3, 0, .3);
  lamp.castShadow = profile.shadows;
  lamp.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
  lamp.shadow.bias = -.0002; lamp.shadow.normalBias = .03;
  scene.add(lamp, lamp.target);
  const fill = new THREE.DirectionalLight('#8aa0c0', .22);
  fill.position.set(12, 8, 6);
  scene.add(fill);

  /* предметы на столе */
  const pen = pencil(profile.shadows);
  pen.position.set(5.05, pen.position.y, .6);
  pen.rotation.y = -1.42;
  scene.add(pen);
  const sp = spool(profile.shadows);
  sp.position.set(-4.85, 0, -2.0);
  sp.scale.setScalar(.8);
  scene.add(sp);

  const book = createNotebook({ renderer, camera, canvas, data, profile, onState });
  scene.add(book.root);

  const view = { dist: 12, elev: 1.08 };
  const pointer = new THREE.Vector2(), parallax = new THREE.Vector2();
  let t = RM ? T_OPENED : 0, opened = false, zoom = 1, zoomTarget = 1, roll = 0, rollV = 0;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.dist = Math.max(11.8 / (2 * tn * camera.aspect), 7.4 / (2 * tn));
  }
  resize();
  addEventListener('resize', resize);
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  });
  canvas.addEventListener('pointerdown', () => { if (t < T_OPENED) t = T_OPENED; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomTarget = Math.min(1.15, Math.max(.6, zoomTarget * (e.deltaY > 0 ? 1.08 : .93)));
  }, { passive: false });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(.05, clock.getDelta());
    if (t < T_OPENED + 1) t += dt;
    lamp.intensity = 160 * Math.min(1, .35 + t / 1.2);
    book.setOpen(ease(clamp01((t - T_OPEN) / (T_OPENED - T_OPEN))));
    if (!opened && t >= T_OPENED) { opened = true; book.setOpen(1); book.setInteractive(true); document.body.classList.add('opened'); }

    zoom = damp(zoom, zoomTarget, 6, dt);
    if (!coarse) { parallax.x = damp(parallax.x, pointer.x, 2.5, dt); parallax.y = damp(parallax.y, pointer.y, 2.5, dt); }
    const c = ease(clamp01(t / T_CAMERA));
    const elev = THREE.MathUtils.lerp(.55, view.elev, c);
    const dist = view.dist * zoom * THREE.MathUtils.lerp(1.35, 1, c);
    const zoomIn = clamp01((1 - zoom) / .4);
    const tx = THREE.MathUtils.lerp(-1.6, 0, c) + parallax.x * 2 * zoomIn;
    const tz = .2 - parallax.y * 1.1 * zoomIn;
    camera.position.set(tx + parallax.x * .3 * (1 - zoomIn), Math.sin(elev) * dist + parallax.y * .2, tz + Math.cos(elev) * dist);
    camera.lookAt(tx, 0, tz);

    /* карандаш чуть перекатывается, когда переворачивают страницу */
    rollV += (-roll * 30 - rollV * 5) * dt;
    roll += rollV * dt;
    pen.children.forEach(m => { m.rotation.x = roll; });

    book.update(performance.now());
    renderer.render(scene, camera);
  });

  return {
    next: () => book.next(),
    prev: () => book.prev(),
    nudge() { rollV += .9; }
  };
}
