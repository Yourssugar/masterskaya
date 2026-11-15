/* WebGL-сцена: фон из двух картинок с перетеканием, сумка с шейдером
   растворения и ремонта, тень под сумкой, пыль в воздухе.
   Координаты везде в CSS-пикселях, y вниз, как у DOM. */

const VS = `
attribute vec2 a;
uniform vec4 rect;
uniform mediump vec2 res;
varying vec2 vUv;
void main(){
  vUv = a;
  vec2 px = rect.xy + a * rect.zw;
  gl_Position = vec4(px.x / res.x * 2. - 1., 1. - px.y / res.y * 2., 0., 1.);
}`;

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ float s = 0., a = .5; for(int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }`;

const BG_FS = `
precision mediump float;
uniform sampler2D tA, tB;
uniform vec2 sA, sB, res, off;
uniform float mixv, zoom, dark, vig, time;
varying vec2 vUv;
${NOISE}
vec2 cover(vec2 uv, vec2 s){
  float sa = res.x / res.y, ia = s.x / s.y;
  vec2 k = sa > ia ? vec2(1., ia / sa) : vec2(sa / ia, 1.);
  return (uv - .5) * k / zoom + .5 + off;
}
vec3 smp(sampler2D t, vec2 uv){ return texture2D(t, clamp(uv, .001, .999)).rgb; }
void main(){
  vec3 c = mix(smp(tA, cover(vUv, sA)), smp(tB, cover(vUv, sB)), mixv);
  vec2 p = vUv - .5; p.x *= res.x / res.y;
  c *= 1. - vig * smoothstep(.3, 1.15, length(p));
  c += (h21(vUv * res + fract(time) * 91.) - .5) * .03;
  c *= 1. - dark;
  gl_FragColor = vec4(c, 1.);
}`;

const BAG_FS = `
precision mediump float;
uniform sampler2D tA, tB, tM;
uniform float mixv, edgeW, tear, repair, useMask, alpha, seed;
uniform vec3 edgeCol;
varying vec2 vUv;
${NOISE}
void main(){
  vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv);
  float n = fbm(vUv * 3.4 + seed);
  float v = n * .72 + (1. - vUv.y) * .28;
  float t = mixv * (1. + edgeW * 2.) - edgeW;
  float showB = smoothstep(t + edgeW * .35, t - edgeW * .35, v);
  float edge = (1. - smoothstep(0., edgeW * .28, abs(v - t))) * step(.001, mixv) * step(mixv, .999);

  vec4 m = texture2D(tM, vUv);
  float mk = m.r * useMask;
  float id = floor(m.b * 255. + .5);
  float nt = fbm(vUv * 9. + 3.1);
  float tr = smoothstep(nt - .2, nt, tear * 1.25) * step(.001, tear) * mk;
  float rp = clamp((repair - id - m.g) / .07, 0., 1.);
  float seam = mk * (1. - smoothstep(0., .07, abs(repair - id - m.g))) * step(.001, repair) * step(repair, 9.);
  showB = max(showB, tr * (1. - rp));

  vec4 pa = vec4(a.rgb * a.a, a.a), pb = vec4(b.rgb * b.a, b.a);
  vec4 c = mix(pa, pb, showB);
  float cov = max(a.a, b.a);
  c.rgb += edgeCol * (edge * .4 + seam * .3) * cov;
  gl_FragColor = c * alpha;
}`;

const SH_FS = `
precision mediump float;
uniform float alpha;
varying vec2 vUv;
void main(){
  vec2 p = (vUv - .5) * 2.;
  float d = length(p * vec2(1., 1.));
  float a = (1. - smoothstep(.15, 1., d)) * alpha;
  gl_FragColor = vec4(0., 0., 0., a);
}`;

const DUST_VS = `
attribute vec4 seed;
uniform float time, pr, amt;
varying float vA;
void main(){
  float x = fract(seed.x + sin(time * .07 + seed.w * 6.) * .02 + time * .003 * (seed.z - .5));
  float y = fract(seed.y - time * (.004 + seed.z * .008));
  gl_Position = vec4(x * 2. - 1., 1. - y * 2., 0., 1.);
  gl_PointSize = (1.4 + seed.w * seed.w * 5.) * pr;
  vA = amt * (.2 + .8 * abs(sin(time * (.4 + seed.z) + seed.w * 30.)));
}`;

const DUST_FS = `
precision mediump float;
uniform vec3 col;
varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, 0., d); a *= a * vA;
  gl_FragColor = vec4(col * a, a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const u = name => (name in loc ? loc[name] : (loc[name] = gl.getUniformLocation(p, name)));
  return { p, u };
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('не загрузилось: ' + url));
    img.src = url;
  });
}

export function createStage(canvas, quality) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const bgP = program(gl, VS, BG_FS);
  const bagP = program(gl, VS, BAG_FS);
  const shP = program(gl, VS, SH_FS);
  const dustP = program(gl, DUST_VS, DUST_FS);

  const DUST_N = quality.dust;
  const dustBuf = gl.createBuffer();
  const seeds = new Float32Array(DUST_N * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

  function texFrom(src, w, h, data) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  const blank = { t: texFrom(null, 1, 1, new Uint8Array([0, 0, 0, 0])), w: 1, h: 1, ready: true };
  const black = { t: texFrom(null, 1, 1, new Uint8Array([10, 8, 7, 255])), w: 16, h: 9, ready: true };

  const cache = new Map();
  function tex(url) {
    if (cache.has(url)) return cache.get(url);
    const rec = { t: null, w: 1, h: 1, ready: false, img: null };
    rec.promise = loadImage(url).then(img => {
      rec.img = img; rec.w = img.naturalWidth; rec.h = img.naturalHeight;
      rec.t = texFrom(img); rec.ready = true;
      return rec;
    }).catch(err => { console.warn(err.message); rec.failed = true; return rec; });
    cache.set(url, rec);
    return rec;
  }
  function dataTex(data, n) {
    return { t: texFrom(null, n, n, data), w: n, h: n, ready: true };
  }

  /* состояние, которое меняют превью и главная */
  const S = {
    bgA: black, bgB: black, bgMix: 0, zoom: 1.04, dark: 1, vig: .55, off: [0, 0],
    bag: {
      on: false, a: blank, b: blank, mask: blank, mix: 0, tear: 0, repair: 0, useMask: 0,
      alpha: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, edge: [0.78, 0.2, 0.33], edgeW: .07, seed: 0
    },
    shadow: { alpha: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
    dust: { amt: .5, col: [1, .82, .62] }
  };

  let W = 1, H = 1, pr = 1, scale = 1;
  function resize() {
    W = innerWidth; H = innerHeight;
    pr = Math.min(devicePixelRatio || 1, quality.pixelRatio) * scale;
    canvas.width = Math.round(W * pr);
    canvas.height = Math.round(H * pr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
  resize();

  function bindQuad(prog) {
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(prog.p, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(prog.u('res'), W, H);
  }
  function bindTex(prog, name, unit, rec) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, (rec && rec.ready ? rec : blank).t);
    gl.uniform1i(prog.u(name), unit);
  }

  function render(time) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);

    /* фон */
    bindQuad(bgP);
    gl.uniform4f(bgP.u('rect'), 0, 0, W, H);
    const A = S.bgA.ready ? S.bgA : black, B = S.bgB.ready ? S.bgB : A;
    bindTex(bgP, 'tA', 0, A);
    bindTex(bgP, 'tB', 1, B);
    gl.uniform2f(bgP.u('sA'), A.w, A.h);
    gl.uniform2f(bgP.u('sB'), B.w, B.h);
    gl.uniform2f(bgP.u('off'), S.off[0], S.off[1]);
    gl.uniform1f(bgP.u('mixv'), S.bgMix);
    gl.uniform1f(bgP.u('zoom'), S.zoom);
    gl.uniform1f(bgP.u('dark'), S.dark);
    gl.uniform1f(bgP.u('vig'), S.vig);
    gl.uniform1f(bgP.u('time'), time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    /* тень и сумка */
    const bag = S.bag;
    if (bag.on && bag.alpha > .001) {
      if (S.shadow.alpha > .001) {
        bindQuad(shP);
        const r = S.shadow.rect;
        gl.uniform4f(shP.u('rect'), r.x, r.y, r.w, r.h);
        gl.uniform1f(shP.u('alpha'), S.shadow.alpha * bag.alpha * (1 - S.dark));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      bindQuad(bagP);
      const r = bag.rect;
      gl.uniform4f(bagP.u('rect'), r.x, r.y, r.w, r.h);
      bindTex(bagP, 'tA', 0, bag.a);
      bindTex(bagP, 'tB', 1, bag.b);
      bindTex(bagP, 'tM', 2, bag.mask);
      gl.uniform1f(bagP.u('mixv'), bag.mix);
      gl.uniform1f(bagP.u('edgeW'), bag.edgeW);
      gl.uniform1f(bagP.u('tear'), bag.tear);
      gl.uniform1f(bagP.u('repair'), bag.repair);
      gl.uniform1f(bagP.u('useMask'), bag.useMask);
      gl.uniform1f(bagP.u('alpha'), bag.alpha * (1 - S.dark));
      gl.uniform1f(bagP.u('seed'), bag.seed);
      gl.uniform3f(bagP.u('edgeCol'), bag.edge[0], bag.edge[1], bag.edge[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /* пыль */
    if (DUST_N && S.dust.amt > .001) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(dustP.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
      const loc = gl.getAttribLocation(dustP.p, 'seed');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(dustP.u('time'), time);
      gl.uniform1f(dustP.u('pr'), pr);
      gl.uniform1f(dustP.u('amt'), S.dust.amt * (1 - S.dark));
      gl.uniform3f(dustP.u('col'), S.dust.col[0], S.dust.col[1], S.dust.col[2]);
      gl.drawArrays(gl.POINTS, 0, DUST_N);
      gl.disableVertexAttribArray(loc);
    }
  }

  return {
    S, tex, dataTex, blank, render, resize,
    setScale(k) { scale = k; resize(); },
    get scale() { return scale; },
    size: () => ({ W, H })
  };
}
