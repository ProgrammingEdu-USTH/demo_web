// Everything beyond the window is flat, painted once at load into canvas textures and coloured per time of day in shaders.
// Depth comes from placing the layers at different distances (camera parallax), not from geometry.
//   sky (gradient, cirrus, stars, Milky Way, shooting stars, moon, sun, airplane)
//   anime cumulus clouds (one instanced draw call)   hot-air balloon + bird flock (day)
//   far city -> back houses + trees -> front houses + trees -> utility poles & wires
//   rain streaks, petals/leaves blowing into the room when the window is open
import * as THREE from 'three';

let CAM_X = 0, CAM_Y = 1.38, CAM_Z = 3.55;
const WIN_Z = -0.02;
const WIN = { x0: -0.83, x1: 0.83, y0: 0.86, y1: 2.62 };
const WW = WIN.x1 - WIN.x0, WH = WIN.y1 - WIN.y0;
const ratio = z => (CAM_Z - z) / (CAM_Z - WIN_Z);
/** window space (u 0..1 left->right, v 0..1 top->bottom, as seen from the resting camera) -> world point at depth z */
const toWorld = (u, v, z) => { const k = ratio(z); return new THREE.Vector3(CAM_X + (WIN.x0 + u * WW - CAM_X) * k, CAM_Y + (WIN.y1 - v * WH - CAM_Y) * k, z); };

/* ------------------------------------------------------------------ small helpers */
function rng(seed) {
  let s = seed >>> 0;
  const f = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  f.range = (a, b) => a + (b - a) * f();
  f.pick = a => a[Math.floor(f() * a.length)];
  return f;
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; return t; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

const GLSL_NOISE = /* glsl */`
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }`;
const VERT_WORLD = /* glsl */`varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

/* ------------------------------------------------------------------ cloud atlas: anime cumulus, painted puff by puff
   R = shading (0 shadow side .. 1 sun side, every puff shaded on its own so the puff edges read), G = rim near the outline, A = coverage */
export function paintCloudAtlas() {
  const S = 512, N = 2, shadeC = canvas(S * N, S * N), alphaC = canvas(S * N, S * N);
  const sh = shadeC.getContext('2d'), al = alphaC.getContext('2d');
  const R = rng(4242);
  // [width share, height share, puffs, puff size, tiers]
  const TYPES = [[.86, .92, 26, .16, 'tower'], [.94, .5, 22, .13, 'wide'], [.62, .44, 12, .15, 'puff'], [.98, .3, 26, .09, 'bank']];
  TYPES.forEach(([ws, hs, n, ps, kind], t) => {
    const ox = (t % N) * S, oy = Math.floor(t / N) * S;
    const cx = ox + S / 2, base = oy + S * .88, halfW = S * ws / 2, height = S * hs * .86;
    const prof = u => { // silhouette height across the cloud (u -1..1)
      const a = Math.min(1, Math.abs(u));
      if (kind === 'tower') return height * Math.pow(Math.max(0, 1 - a * a), .55) * (a < .35 ? 1 : .62 + .38 * (1 - a));
      if (kind === 'bank') return height * (.55 + .45 * Math.sin(u * 7.3 + 1.1) * .5 + .3) * Math.pow(Math.max(0, 1 - a * a), .4);
      return height * Math.pow(Math.max(0, 1 - a * a), .7);
    };
    const puffs = [];
    for (let i = 0; i < n; i++) {           // body puffs fill the volume
      const u = (R() * 2 - 1) * Math.pow(R(), .35) * (R() < .5 ? -1 : 1);
      const hmax = prof(u);
      const r = S * ps * R.range(.7, 1.25) * (1 - .35 * Math.abs(u));
      const y = base - r * .55 - R() * Math.max(0, hmax - r * 1.4);
      puffs.push({ x: cx + u * halfW * .92, y, r });
    }
    for (let i = 0; i <= 18; i++) {          // crown puffs trace the bumpy top edge
      const u = -1 + 2 * i / 18 + R.range(-.04, .04);
      const hmax = prof(u);
      if (hmax < S * .04) continue;
      const r = S * ps * R.range(.75, 1.1) * (kind === 'tower' && Math.abs(u) < .4 ? 1.25 : 1);
      puffs.push({ x: cx + u * halfW * .9, y: base - hmax + r * .85, r });
    }
    puffs.sort((a, b) => b.y - a.y);         // lower puffs first, higher ones overlap them
    al.save(); sh.save();
    for (const g of [al, sh]) { g.beginPath(); g.rect(ox, oy, S, base - oy + S * .01); g.clip(); }
    al.fillStyle = '#fff';
    for (const p of puffs) { al.beginPath(); al.arc(p.x, p.y, p.r, 0, 7); al.fill(); }
    // each puff: soft sphere shading that only dips a little at its edge, so puffs read as one mass with gentle seams
    for (const p of puffs) {
      const lx = p.x + p.r * .35, ly = p.y - p.r * .42;
      const gr = sh.createRadialGradient(lx, ly, 0, lx, ly, p.r * 1.45);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.5, '#e6e6e6'); gr.addColorStop(.82, '#a8a8a8'); gr.addColorStop(1, '#8c8c8c');
      sh.fillStyle = gr; sh.beginPath(); sh.arc(p.x, p.y, p.r, 0, 7); sh.fill();
    }
    // one light for the whole cloud: sun side (upper right) bright, underside and far side falling into shadow
    sh.globalCompositeOperation = 'multiply';
    const top = base - height;
    const glob = sh.createLinearGradient(cx + halfW * .5, top, cx - halfW * .6, base);
    glob.addColorStop(0, '#fff'); glob.addColorStop(.45, '#e2e2e2'); glob.addColorStop(.8, '#8e8e8e'); glob.addColorStop(1, '#5a5a5a');
    sh.fillStyle = glob; sh.fillRect(ox, oy, S, S);
    sh.globalCompositeOperation = 'source-over';
    al.restore(); sh.restore();
  });
  // rim = coverage minus blurred coverage (bright just inside the outline)
  const blurC = canvas(S * N, S * N), bl = blurC.getContext('2d');
  bl.filter = 'blur(7px)'; bl.drawImage(alphaC, 0, 0);
  const soft = canvas(S * N, S * N), so = soft.getContext('2d');
  so.filter = 'blur(1.2px)'; so.drawImage(alphaC, 0, 0);
  const A = so.getImageData(0, 0, S * N, S * N).data, B = bl.getImageData(0, 0, S * N, S * N).data, Sd = sh.getImageData(0, 0, S * N, S * N).data;
  const out = canvas(S * N, S * N), oc = out.getContext('2d'), img = oc.createImageData(S * N, S * N), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Sd[i]; d[i + 1] = Math.max(0, Math.min(255, (A[i + 3] - B[i + 3]) * 2.6)); d[i + 2] = 0; d[i + 3] = A[i + 3];
  }
  oc.putImageData(img, 0, 0);
  return tex(out);
}

/* ------------------------------------------------------------------ painted scenery (albedo + aux canvases)
   aux: R = lit window / lamp, G = per-window id, B = foliage (sways) */
const WALLS = ['#efe2cc', '#e8d4c0', '#d6e0ea', '#f0d6cf', '#e4ddef', '#d8cfc2', '#f4ebd8', '#c8d8dc', '#e9cfb4'];
const ROOFS = ['#8a3a3c', '#56688c', '#7a4c38', '#3e4e6a', '#9a5842', '#4c5c4c', '#6a4a6c', '#a0603e'];
const GREENS = ['#3c6a3a', '#4b7c42', '#5c9050', '#2e5430', '#66a058', '#3f7748'];

function scenery(uL, uR, vT, vB, Wpx, draw, seed) {
  const H = Math.round(Wpx * ((vB - vT) * WH) / ((uR - uL) * WW));
  const a = canvas(Wpx, H), x = canvas(Wpx, H);
  const A = a.getContext('2d'), X = x.getContext('2d');
  const U = u => (u - uL) / (uR - uL) * Wpx, V = v => (v - vT) / (vB - vT) * H;
  const wpx = Wpx / (uR - uL);                      // one window width in canvas px
  const P = {
    A, X, W: Wpx, H, U, V, wpx, R: rng(seed),
    fill(path, colA, colX = '#000') { for (const [g, c] of [[A, colA], [X, colX]]) { g.fillStyle = c; g.beginPath(); path(g); g.fill(); } },
    rect(x0, y0, w, h, colA, colX) { P.fill(g => g.rect(x0, y0, w, h), colA, colX); },
    poly(pts, colA, colX) { P.fill(g => { g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); }, colA, colX); },
    circle(cx, cy, r, colA, colX) { P.fill(g => g.arc(cx, cy, r, 0, 7), colA, colX); },
    line(pts, w, colA, curve) {
      for (const [g, c] of [[A, colA], [X, '#000']]) {
        g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        if (curve) g.quadraticCurveTo(curve[0], curve[1], pts[1][0], pts[1][1]); else for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke();
      }
    },
  };
  draw(P);
  return { alb: tex(a), aux: tex(x) };
}

function tree(P, cx, baseY, s) {
  const R = P.R;
  P.rect(cx - s * .05, baseY - s * .55, s * .1, s * .6, '#4a3a30');
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([cx + R.range(-.42, .42) * s, baseY - s * R.range(.6, 1.25), s * R.range(.22, .36)]);
  blobs.sort((a, b) => b[1] - a[1]);
  const g = R.pick(GREENS);
  for (const [x, y, r] of blobs) {
    P.circle(x, y, r, shade(g, .82), 'rgb(0,0,255)');
    P.circle(x + r * .22, y - r * .25, r * .62, g, 'rgb(0,0,255)');
    P.circle(x + r * .34, y - r * .4, r * .28, shade(g, 1.22), 'rgb(0,0,255)');
  }
}

function house(P, x0, w, ridgeY, litP) {
  const R = P.R, H = P.H;
  const wall = R.pick(WALLS), roof = R.pick(ROOFS);
  const rh = w * R.range(.24, .4), eave = ridgeY + rh, cx = x0 + w / 2, ov = w * .07;
  const gable = R() < .6;
  if (R() < .55) {                                        // chimney
    const chx = x0 + w * R.range(.15, .3);
    P.rect(chx, ridgeY + rh * .1, w * .08, rh * .9, shade(roof, .75));
    P.rect(chx - w * .01, ridgeY + rh * .06, w * .1, w * .025, shade(roof, .6));
  }
  P.rect(x0, eave, w, H - eave, wall);
  P.rect(x0 + w * .84, eave, w * .16, H - eave, shade(wall.replace('rgb', ''), 1) && shade(wall, .86));
  if (gable) {
    P.poly([[x0 - ov, eave + w * .02], [cx, ridgeY - w * .02], [x0 + w + ov, eave + w * .02]], roof);
    P.poly([[x0 + w * .07, eave + w * .01], [cx, ridgeY + rh * .2], [x0 + w * .93, eave + w * .01]], wall);
    if (R() < .7) {                                       // attic window
      const ww = w * .12, wy = ridgeY + rh * .5;
      const lit = R() < litP;
      P.rect(cx - ww / 2 - 2, wy - 2, ww + 4, ww * 1.1 + 4, '#efe8dc');
      P.rect(cx - ww / 2, wy, ww, ww * 1.1, lit ? '#3d4a63' : '#2f3a50', lit ? `rgb(255,${R() * 255 | 0},0)` : '#000');
    }
  } else {
    P.poly([[x0 - ov, eave + w * .02], [x0 + w * .2, ridgeY], [x0 + w * .8, ridgeY], [x0 + w + ov, eave + w * .02]], roof);
    for (let k = 1; k < 4; k++) {
      const yy = ridgeY + rh * k / 4;
      P.rect(x0 + w * (.2 - .27 * k / 4), yy, w * (.6 + .54 * k / 4), Math.max(1, w * .008), shade(roof, .8));
    }
  }
  P.rect(x0 - ov, eave, w + ov * 2, w * .028, shade(roof, .55));
  const cols = w > P.wpx * .2 ? 3 : 2, ww = w * (cols === 3 ? .16 : .2), wh = ww * 1.25;
  for (let fy = eave + w * .12; fy < H - wh; fy += wh * 2.2) {
    for (let i = 0; i < cols; i++) {
      const wx = x0 + w * ((i + .5) / cols) - ww / 2;
      const lit = R() < litP;
      P.rect(wx - 3, fy - 3, ww + 6, wh + 6, '#ece4d6');
      P.rect(wx, fy, ww, wh, lit ? '#3e4b66' : '#2c374d', lit ? `rgb(255,${R() * 255 | 0},0)` : '#000');
      P.rect(wx + ww / 2 - 1, fy, 2, wh, '#ece4d6');
      if (R() < .4) P.rect(wx, fy, ww * .32, wh, '#b8a48a', lit ? 'rgb(150,0,0)' : '#000');   // curtain
      P.rect(wx - 4, fy + wh + 2, ww + 8, 4, '#d9cfbf');
    }
  }
}

function paintCity(P) {                                   // far: low rooftops and tree tops fading into the haze
  const R = P.R, roofs = ['#8f8aa6', '#a39cb6', '#8a93ad', '#9a8fa0'];
  for (let x = -40; x < P.W; x += P.wpx * R.range(.05, .09)) {
    const w = P.wpx * R.range(.06, .1), ridge = P.V(R.range(.56, .62)), c = R.pick(roofs);
    P.rect(x, ridge + w * .25, w, P.H, shade(c, 1.1));
    P.poly([[x - w * .06, ridge + w * .27], [x + w * .5, ridge], [x + w * 1.06, ridge + w * .27]], c);
    if (R() < .6) P.rect(x + w * .35, ridge + w * .42, w * .14, w * .16, '#6f6a84', R() < .5 ? `rgb(255,${R() * 255 | 0},0)` : '#000');
  }
  for (let x = -40; x < P.W; x += P.wpx * R.range(.04, .1)) {
    const r = P.wpx * R.range(.025, .05), y = P.V(R.range(.6, .66));
    for (let k = 0; k < 3; k++) P.circle(x + k * r * .8, y - R() * r * .6, r, '#6d7a8a', 'rgb(0,0,255)');
  }
  // a distant water tower and a church spire make the skyline less generic
  const tx = P.U(.2), ty = P.V(.5);
  P.rect(tx - 3, ty, 6, P.V(.62) - ty, '#7f7a92'); P.rect(tx + P.wpx * .04 - 3, ty, 6, P.V(.62) - ty, '#7f7a92');
  P.fill(g => g.ellipse(tx + P.wpx * .02, ty, P.wpx * .035, P.wpx * .02, 0, 0, 7), '#8a84a0');
  const sx = P.U(.83);
  P.poly([[sx - P.wpx * .012, P.V(.6)], [sx, P.V(.46)], [sx + P.wpx * .012, P.V(.6)]], '#857f99');
  P.rect(sx - P.wpx * .02, P.V(.56), P.wpx * .04, P.H, '#938ca6');
}

function paintHouseRow(P, o) {
  const R = P.R;
  let x = -R() * P.wpx * o.wMax;
  while (x < P.W) {
    const w = P.wpx * R.range(o.wMin, o.wMax);
    if (R() < o.trees) tree(P, x + w * .3, P.V(o.ridge + .12), P.wpx * R.range(.12, .2));
    house(P, x, w, P.V(o.ridge + R.range(-o.var, o.var)), o.lit);
    if (R() < o.trees * .8) tree(P, x + w + P.wpx * .02, P.V(o.ridge + .2), P.wpx * R.range(.1, .18));
    x += w + P.wpx * R.range(.02, .07);
  }
  for (let hx = -20; hx < P.W; hx += P.wpx * .05) {        // hedge along the bottom
    const r = P.wpx * R.range(.03, .05);
    P.circle(hx, P.V(o.hedge) + r * .3, r, R.pick(GREENS), 'rgb(0,0,255)');
  }
  P.rect(0, P.V(o.hedge) + P.wpx * .02, P.W, P.H, '#3a4038');
}

function paintPoles(P) {
  const R = P.R, poles = [.06, .74, 1.4].map(u => P.U(u)), top = P.V(-.06), pw = P.wpx * .014;
  const arms = [P.V(.03), P.V(.1)], dark = '#2b2630';
  const ends = [];
  poles.forEach((px, i) => {
    P.rect(px - pw / 2, top, pw, P.H - top, dark);
    const e = [];
    for (const ay of arms) {
      P.rect(px - P.wpx * .075, ay, P.wpx * .15, pw * .8, dark);
      for (const k of [-.065, -.025, .025, .065]) {
        P.rect(px + k * P.wpx - 2, ay - 7, 4, 7, '#6a6470');
        e.push([px + k * P.wpx, ay - 6]);
      }
    }
    ends.push(e);
    if (i === 1) {                                       // transformer drum
      P.fill(g => g.roundRect(px + pw, P.V(.2), P.wpx * .045, P.wpx * .07, 6), '#4a4652');
      P.rect(px + pw, P.V(.2) + P.wpx * .012, P.wpx * .045, 3, '#5c5864');
    }
    if (i === 0) {                                       // street lamp
      P.rect(px, P.V(.32), P.wpx * .09, pw * .6, dark);
      P.fill(g => g.ellipse(px + P.wpx * .09, P.V(.32) + 8, P.wpx * .025, 7, 0, 0, 7), '#3a3540');
      P.fill(g => g.ellipse(px + P.wpx * .09, P.V(.32) + 12, P.wpx * .018, 4, 0, 0, 7), '#fff1c8', 'rgb(255,128,0)');
    }
  });
  for (let i = 0; i < ends.length - 1; i++) {             // sagging wires between poles
    ends[i].forEach((a, k) => {
      const b = ends[i + 1][k], sag = P.wpx * R.range(.06, .1);
      P.line([a, b], 2.2, '#26222a', [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag]);
    });
  }
  ends[0].slice(0, 3).forEach((a, k) => P.line([a, [-10, a[1] + P.wpx * (.05 + k * .02)]], 2.2, '#26222a', [a[0] * .5, a[1] + P.wpx * .08]));
  const drop = ends[1][5];
  P.line([drop, [P.U(1.05), P.V(.55)]], 1.8, '#26222a', [P.U(.9), P.V(.4)]);
}

function paintBalloon() {
  const c = canvas(256, 384), g = c.getContext('2d');
  const env = () => { g.beginPath(); g.moveTo(128, 300); g.bezierCurveTo(60, 250, 18, 180, 22, 118); g.arc(128, 118, 106, Math.PI, 0); g.bezierCurveTo(238, 180, 196, 250, 128, 300); g.closePath(); };
  g.save(); env(); g.clip();
  const cols = ['#e2524a', '#f6c544', '#3fb0a8', '#f2efe6', '#e2524a', '#f6c544', '#3fb0a8'];
  for (let i = 7; i >= 1; i--) { g.fillStyle = cols[i - 1]; g.beginPath(); g.ellipse(128, 170, 108 * i / 7, 190, 0, 0, 7); g.fill(); }
  const sh = g.createRadialGradient(92, 80, 10, 128, 150, 190);
  sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,10,40,.45)');
  g.fillStyle = sh; g.fillRect(0, 0, 256, 384);
  g.restore();
  g.strokeStyle = '#5a4030'; g.lineWidth = 2;
  for (const [a, b] of [[104, 112], [152, 144], [118, 120], [138, 136]]) { g.beginPath(); g.moveTo(a, 296); g.lineTo(b, 336); g.stroke(); }
  g.fillStyle = '#8a5a34'; g.fillRect(108, 334, 40, 30); g.fillStyle = '#6a4226'; g.fillRect(108, 334, 40, 5);
  return tex(c);
}

/* ------------------------------------------------------------------ the module */
export function createOutside(scene, loader, cam, rest) {
  if (cam) { CAM_X = cam.x; CAM_Y = cam.y; CAM_Z = cam.z; }
  const U = {
    uTime: { value: 0 }, uDrift: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0 }, uPx: { value: 800 },
    uSky: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3()) },
    uHaze: { value: new THREE.Vector3() }, uHz: { value: 0 },
    uCb: { value: new THREE.Vector3() }, uCr: { value: new THREE.Vector3() }, uCs: { value: new THREE.Vector3() }, uCa: { value: 1 },
    uAl: { value: new THREE.Vector3(1, 1, 1) }, uWin: { value: 0 },
    uStar: { value: 0 }, uMoon: { value: 0 }, uSun: { value: 0 }, uDay: { value: 0 },
    uMoonPos: { value: new THREE.Vector2() }, uSunPos: { value: new THREE.Vector2() },
    uPcb: { value: new THREE.Vector3() }, uPcr: { value: new THREE.Vector3() }, uPca: { value: 1 }, uPra: { value: 1 },
  };
  const add = (geo, mat, order, pos, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; if (pos) m.position.copy(pos); parent.add(m); return m; };
  // two interchangeable looks for what is beyond the glass; sky, balloon, birds, rain and petals are shared
  const layered = new THREE.Group(), painted = new THREE.Group();
  scene.add(layered, painted);
  const rectAt = (z, uL, uR, vT, vB) => {
    const a = toWorld(uL, vT, z), b = toWorld(uR, vB, z);
    return { geo: new THREE.PlaneGeometry(b.x - a.x, a.y - b.y), pos: new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, z) };
  };
  const winRectAt = z => { const a = toWorld(0, 0, z), b = toWorld(1, 1, z); return new THREE.Vector4(a.x, a.y, b.x - a.x, a.y - b.y); };

  /* ---- sky ---- */
  {
    const z = -9.5, r = rectAt(z, -1.2, 2.2, -.9, 1.6);
    add(r.geo, new THREE.ShaderMaterial({
      uniforms: { ...U, uRect: { value: winRectAt(z) } }, depthWrite: false,
      vertexShader: VERT_WORLD,
      fragmentShader: /* glsl */`
        varying vec3 vW;
        uniform vec4 uRect; uniform vec3 uSky[5], uHaze, uCb, uCr, uCs; uniform vec2 uMoonPos, uSunPos;
        uniform float uHz, uStar, uMoon, uSun, uDay, uTime, uDrift, uRain;
        ${GLSL_NOISE}
        float stars(vec2 px, float cs, float th, float t){
          vec2 id = floor(px / cs), f = fract(px / cs);
          float r = hash(id);
          vec2 pos = vec2(hash(id + 3.1), hash(id + 7.7)) * .8 + .1;
          vec2 d = (f - pos) * cs;
          float b = clamp((r - th) / (1. - th), 0., 1.);
          float sz = .55 + b * 1.5;
          float core = exp(-dot(d, d) / (sz * sz));
          float flare = step(.82, b) * (exp(-abs(d.x) * .8) * exp(-abs(d.y) * .14) + exp(-abs(d.y) * .8) * exp(-abs(d.x) * .14)) * .4;
          float tw = .55 + .45 * sin(t * (.6 + r * 2.2) + r * 60.);
          return step(th, r) * (core + flare) * (.3 + b) * tw;
        }
        float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
        void main(){
          vec2 w = vec2((vW.x - uRect.x) / uRect.z, (uRect.y - vW.y) / uRect.w);   // window space
          float g = w.y;
          vec3 c = uSky[0];
          // the horizon sits around v .62 (just above the rooftops), so the warm bands are pulled up to be seen
          c = mix(c, uSky[1], smoothstep(-.1, .2, g));
          c = mix(c, uSky[2], smoothstep(.15, .4, g));
          c = mix(c, uSky[3], smoothstep(.36, .56, g));
          c = mix(c, uSky[4], smoothstep(.5, .66, g));
          c = mix(c, uHaze, smoothstep(.35, .7, g) * smoothstep(.35, .7, g) * uHz * .6);
          vec2 asp = vec2(1., ${(WH / WW).toFixed(3)});

          // stars, a faint Milky Way band, and an occasional shooting star (night only)
          float night = uStar * (1. - uRain) * smoothstep(.9, .3, g);
          vec2 px = w * vec2(900., 950.);
          float st = stars(px, 17., .78, uTime) + stars(px * 1.6 + 31., 11., .86, uTime * 1.3) * .55;
          float band = exp(-pow((w.y - (.05 + w.x * .42)) * 4.2, 2.)) * smoothstep(.35, .8, fbm(w * vec2(5., 9.) + 3.));
          c += vec3(.86, .9, 1.) * st * night + vec3(.55, .5, .8) * band * .16 * night;
          float k = floor(uTime / 9.), ph = fract(uTime / 9.);
          vec2 s0 = vec2(hash(vec2(k, 1.)) * .7 + .05, hash(vec2(k, 2.)) * .25 + .02), dir = normalize(vec2(.85, .45));
          vec2 head = s0 + dir * ph / .14 * .32;
          float sh = step(.45, hash(vec2(k, 3.))) * step(ph, .14);
          float dl = seg(w * asp, (head - dir * .12) * asp, head * asp);
          float along = clamp(dot(w - (head - dir * .12), dir) / .12, 0., 1.);
          c += vec3(1., .95, .85) * smoothstep(.004, 0., dl) * along * sh * night * 1.6;

          // moon: disc with soft craters + halo
          vec2 md = (w - uMoonPos) * asp; float mr = length(md);
          float disc = smoothstep(.042, .039, mr);
          float crater = .82 + .18 * smoothstep(.3, .7, fbm(md * 60. + 5.));
          c += vec3(1., .96, .86) * exp(-mr * 9.) * .22 * uMoon * (1. - uRain);
          c = mix(c, vec3(1., .97, .9) * crater, disc * uMoon * (1. - uRain * .7));

          // sun: bright disc + wide glow, warmer when low
          vec2 sd = (w - uSunPos) * asp; float sr = length(sd);
          vec3 sunC = mix(vec3(1., .98, .9), vec3(1., .74, .45), smoothstep(.3, .75, uSunPos.y));
          float sunA = uSun * (1. - uRain * .8);
          c += sunC * (exp(-sr * 7.) * .45 + exp(-sr * 2.2) * .18) * sunA;
          c = mix(c, vec3(1., .99, .94), smoothstep(.032, .029, sr) * sunA);

          // high cirrus streaks lit by the horizon colour
          float wisp = smoothstep(.56, .82, fbm(vec2(w.x * 2.4 + uDrift * .5, g * 15.))) * smoothstep(.05, .35, g) * smoothstep(.85, .55, g);
          c = mix(c, mix(uCs, uCr, smoothstep(.3, .75, g)), wisp * .5 * (1. - uRain * .5));

          // airliner with a contrail (daytime)
          float pp = fract(uTime / 75. + .2);
          vec2 pl = vec2(-.15 + pp * 1.3, .17 - pp * .07), pdir = normalize(vec2(1.3, -.07));
          float trail = smoothstep(.0035 + .004 * clamp(dot(pl - w, pdir) / .5, 0., 1.), 0., seg(w * asp, (pl - pdir * .5) * asp, pl * asp));
          float fade = clamp(1. - dot(pl - w, pdir) / .5, 0., 1.);
          c = mix(c, vec3(1.), trail * fade * .55 * uDay * (1. - uRain));
          c = mix(c, vec3(.95, .96, 1.), smoothstep(.006, .003, length((w - pl) * asp)) * uDay * (1. - uRain));

          // overcast when it rains
          float l = dot(c, vec3(.3, .59, .11));
          c = mix(c, vec3(l) * vec3(.78, .82, .92) * .8, uRain * .65);
          gl_FragColor = vec4(c, 1.);
        }`,
    }), -20, r.pos);
  }

  /* ---- anime cumulus: one instanced draw, far -> near ---- */
  const cloudTex = paintCloudAtlas();
  {
    // u, v of the cloud base, width (window widths), atlas tile, depth, drift speed, haze
    // like the reference: a long lit bank on the horizon, one big towering cumulus, a few puffs drifting higher up
    const C = [
      [.2, .6, 1.1, 3, -9.2, .5, .3], [.85, .62, 1.0, 3, -9.15, .45, .3],
      [.72, .62, .85, 0, -9.0, .35, .16], [.12, .55, .7, 1, -8.9, .55, .18], [1.45, .58, .75, 0, -9.0, .35, .16],
      [.42, .36, .36, 2, -8.7, .8, .1], [.95, .3, .32, 2, -8.6, .9, .08], [-.05, .24, .3, 2, -8.5, 1., .08],
      [.55, .2, .5, 1, -8.4, .7, .06], [-.45, .45, .5, 1, -8.6, .6, .12],
    ];
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    const n = C.length, iBase = new Float32Array(n * 3), iSize = new Float32Array(n), iTile = new Float32Array(n), iSpeed = new Float32Array(n), iSpan = new Float32Array(n), iCx = new Float32Array(n), iFog = new Float32Array(n);
    C.forEach(([u, v, wu, tile, z, sp, fog], i) => {
      const p = toWorld(u, v, z), k = ratio(z);
      p.toArray(iBase, i * 3); iSize[i] = wu * WW * k; iTile[i] = tile; iSpeed[i] = sp; iSpan[i] = WW * k * 2.6; iCx[i] = toWorld(.5, .5, z).x; iFog[i] = fog;
    });
    const at = (a, s) => new THREE.InstancedBufferAttribute(a, s);
    g.setAttribute('iBase', at(iBase, 3)); g.setAttribute('iSize', at(iSize, 1)); g.setAttribute('iTile', at(iTile, 1));
    g.setAttribute('iSpeed', at(iSpeed, 1)); g.setAttribute('iSpan', at(iSpan, 1)); g.setAttribute('iCx', at(iCx, 1)); g.setAttribute('iFog', at(iFog, 1));
    g.instanceCount = n;
    add(g, new THREE.ShaderMaterial({
      uniforms: { ...U, tCloud: { value: cloudTex } }, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec3 iBase; attribute float iSize, iTile, iSpeed, iSpan, iCx, iFog;
        uniform float uDrift; varying vec2 vUv; varying float vTile, vFog;
        void main(){
          float x = mod(iBase.x - iCx + uDrift * iSpeed * iSpan * .5 + iSpan * .5, iSpan) - iSpan * .5 + iCx;
          vec3 p = vec3(x, iBase.y + iSize * .38, iBase.z) + vec3(position.xy * iSize, 0.);
          vUv = uv; vTile = iTile; vFog = iFog;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tCloud; uniform vec3 uCb, uCr, uCs, uHaze; uniform float uCa, uRain;
        varying vec2 vUv; varying float vTile, vFog;
        void main(){
          float col = mod(vTile, 2.), row = floor(vTile / 2.);
          vec4 t = texture2D(tCloud, vec2((col + vUv.x) * .5, 1. - (row + 1. - vUv.y) * .5));
          if (t.a < .01) discard;
          float s = t.r * mix(.5, 1., smoothstep(.12, .4, vUv.y));          // flat, shaded base
          vec3 c = mix(uCs, uCb, smoothstep(.1, .5, s));
          c = mix(c, uCr, smoothstep(.55, .95, s));
          c += uCr * t.g * .35 * smoothstep(.2, .8, s + .3);                   // silver lining on the outline
          c = mix(c, uHaze, vFog);
          float l = dot(c, vec3(.3, .59, .11));
          c = mix(c, vec3(l) * vec3(.72, .76, .86), uRain * .6);
          gl_FragColor = vec4(c, t.a * mix(uCa, 1., uRain * .6));
        }`,
    }), -19, null, layered);
  }

  /* ---- hot-air balloon (day) ---- */
  const balloon = (() => {
    const z = -8.0, k = ratio(z), h = .22 * WH * k, w = h * 256 / 384;
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
      uniforms: { ...U, map: { value: paintBalloon() } }, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`uniform sampler2D map; uniform vec3 uAl, uHaze; uniform float uDay, uRain; varying vec2 vUv;
        void main(){ vec4 t = texture2D(map, vUv); vec3 c = mix(t.rgb * uAl, uHaze, .18); gl_FragColor = vec4(c, t.a * uDay * (1. - uRain)); }`,
    }), -18);
    return { m, z };
  })();

  /* ---- birds (day): one Points draw call, V formation, flapping ---- */
  const birds = (() => {
    const n = 7, z = -6.5, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2); pos.set([-rank * .045, side * rank * .03, 0], i * 3); ph[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const p = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { ...U, uRect: { value: winRectAt(z) }, uZ: { value: z } }, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute float aPh; uniform vec4 uRect; uniform float uTime, uPx, uZ, uDay, uRain; varying float vFlap, vA;
        void main(){
          float t = fract(uTime / 42.), u = -.2 + t * 2.4;                 // crosses the window in ~20 s, then rests
          vec2 w = vec2(u, .26 + sin(t * 9.) * .03) + position.xy;
          w.y += sin(uTime * 1.3 + aPh * 6.) * .006;
          vec3 p = vec3(uRect.x + w.x * uRect.z, uRect.y - w.y * uRect.w, uZ);
          vFlap = sin(uTime * (7. + aPh * 2.) + aPh * 6.);
          vA = uDay * (1. - uRain) * step(t, .55);
          vec4 mv = viewMatrix * vec4(p, 1.);
          gl_PointSize = uPx * .09 / -mv.z; gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uAl; varying float vFlap, vA;
        float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
        void main(){
          vec2 q = (gl_PointCoord - .5) * 2.; q.y = -q.y;
          float f = vFlap * .45;
          float d = min(seg(q, vec2(-.8, f), vec2(0., -.12)), seg(q, vec2(0., -.12), vec2(.8, f)));
          float a = smoothstep(.13, .06, d) * vA;
          if (a < .01) discard;
          gl_FragColor = vec4(vec3(.16, .17, .22) * (.6 + .4 * uAl), a);
        }`,
    }));
    p.frustumCulled = false; p.renderOrder = -17; scene.add(p);
  })();

  /* ---- painted scenery layers ---- */
  const layerMat = (t, fog) => new THREE.ShaderMaterial({
    uniforms: { ...U, tAlb: { value: t.alb }, tAux: { value: t.aux }, uFog: { value: fog } }, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tAlb, tAux; uniform vec3 uAl, uHaze; uniform float uFog, uWin, uTime, uRain, uWind; varying vec2 vUv;
      float h1(float x){ return fract(sin(x * 91.7) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float leaf = texture2D(tAux, uv).b;                                  // foliage sways a touch, more with the window open
        uv.x += leaf * sin(uTime * .9 + uv.y * 40. + uv.x * 60.) * .0009 * (1. + uWind * 2.5);
        vec4 a = texture2D(tAlb, uv); vec4 x = texture2D(tAux, uv);
        if (a.a < .01) discard;
        vec3 c = a.rgb * uAl;
        c = mix(c, uHaze * mix(1., .55, step(.5, 1. - uAl.r)), uFog);
        float id = x.g * 255.;
        float on = step(h1(id), .3 + .65 * uWin) * step(.02, uWin);
        on *= mix(1., step(.25, fract(h1(id + 3.) + floor(uTime / 50. + h1(id) * 9.) * .618)), .3);   // a few windows switch now and then
        c = mix(c, vec3(1., .80, .48) * (1.05 + .1 * h1(id + 7.)), x.r * on);
        c = mix(c, c * vec3(.74, .78, .88), uRain * .45);
        gl_FragColor = vec4(c, a.a);
      }`,
  });
  const LAYERS = [
    { z: -7.4, u: [-.5, 1.5], v: [.4, 1.2], px: 1536, fog: .45, seed: 11, draw: P => paintCity(P) },
    { z: -5.8, u: [-.55, 1.55], v: [.46, 1.25], px: 2048, fog: .22, seed: 29,
      draw: P => paintHouseRow(P, { ridge: .64, var: .03, wMin: .12, wMax: .2, lit: .55, trees: .5, hedge: 1.05 }) },
    { z: -4.4, u: [-.6, 1.6], v: [.56, 1.3], px: 2048, fog: .06, seed: 57,
      draw: P => paintHouseRow(P, { ridge: .74, var: .04, wMin: .19, wMax: .28, lit: .6, trees: .4, hedge: 1.0 }) },
    { z: -3.2, u: [-.7, 1.7], v: [-.12, 1.35], px: 2048, fog: 0, seed: 83, draw: P => paintPoles(P) },
  ];
  LAYERS.forEach((L, i) => {
    const t = scenery(L.u[0], L.u[1], L.v[0], L.v[1], L.px, L.draw, L.seed);
    const r = rectAt(L.z, L.u[0], L.u[1], L.v[0], L.v[1]);
    add(r.geo, layerMat(t, L.fog), -16 + i, r.pos, layered);
  });

  /* ---- rain: two layers of streaks just outside the glass ---- */
  {
    const z = -.7, r = rectAt(z, -.2, 1.2, -.1, 1.1);
    add(r.geo, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uRain; uniform vec3 uHaze; varying vec2 vUv;
        float h1(float x){ return fract(sin(x * 91.7) * 43758.5453); }
        float layer(vec2 uv, float cols, float speed, float len){
          vec2 p = vec2(uv.x * cols + uv.y * cols * .08, uv.y);
          float id = floor(p.x), o = h1(id);
          float y = fract(p.y * (1.2 + o) + uTime * speed * (.8 + o * .5) + o * 7.);
          float xw = 1. - smoothstep(.02, .12, abs(fract(p.x) - .5));
          return smoothstep(0., .02, y) * smoothstep(len, 0., y) * xw * step(.35, h1(id + 5.));
        }
        void main(){
          vec2 uv = vec2(vUv.x, 1. - vUv.y);
          float r = layer(uv, 70., 1.6, .14) * .75 + layer(uv * 1.7 + .3, 120., 2.3, .1) * .45;
          gl_FragColor = vec4(mix(vec3(.88, .92, 1.), uHaze, .15), min(1., r * uRain * 1.1));
        }`,
    }), -10, r.pos);
  }

  /* ---- petals & leaves blowing in through the open window (as in the 2D version: mostly sakura pink) ---- */
  {
    const n = 40, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { toWorld(.1 + Math.random() * .8, .1 + Math.random() * .7, -.25).toArray(pos, i * 3); ph[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const p = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute float aPh; uniform float uTime, uPx, uWind; varying float vA, vRot, vKind;
        void main(){
          float life = fract(uTime * (.07 + aPh * .04) + aPh);
          vec3 p = position;
          p.z += life * 2.2;
          p.x += (aPh - .5) * life * 1.4 + sin(life * 7. + aPh * 20.) * .12;
          p.y += -life * .9 + sin(life * 11. + aPh * 9.) * .06;
          vA = uWind * sin(3.1416 * life) * smoothstep(.0, .08, life);
          vRot = uTime * (1.5 + aPh * 2.) + aPh * 6.;
          vKind = aPh;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = uPx * .085 / -mv.z; gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uAl; varying float vA, vRot, vKind;
        void main(){
          vec2 q = (gl_PointCoord - .5) * 2.;
          float c = cos(vRot), s = sin(vRot); q = mat2(c, -s, s, c) * q;
          q.y *= 1. + .6 * abs(sin(vRot * .7));                               // tumbling
          float d = length(vec2(q.x * 1.9, q.y));
          float a = smoothstep(.62, .5, d) * vA;
          if (a < .01) discard;
          vec3 col = vKind < .65 ? mix(vec3(1., .76, .83), vec3(1., .86, .9), fract(vKind * 7.)) : mix(vec3(.6, .77, .54), vec3(.73, .84, .6), fract(vKind * 5.));
          col *= .75 + .25 * smoothstep(.0, .4, -q.x) + .15;
          gl_FragColor = vec4(col * (.45 + .55 * uAl), a);
        }`,
    }));
    p.frustumCulled = false; p.renderOrder = 5; scene.add(p);
  }

  /* ================= "Tranh 2D": the street view painted in the 2D version, alive =================
     Every plane faces the resting camera at its own distance, sized so each pixel lands exactly where the
     painting has it; when the camera sways the planes slide against each other, which gives quiet depth. */
  if (rest) {
    const RW = 2752, RH = 1536;
    const rc = new THREE.PerspectiveCamera(rest.vfov, rest.aspect, .05, 100);
    rc.position.copy(rest.pos); rc.lookAt(rest.target); rc.updateMatrixWorld();
    const fwd = rc.getWorldDirection(new THREE.Vector3());
    const at = (px, py, D) => {
      const dir = new THREE.Vector3(px / RW * 2 - 1, 1 - py / RH * 2, .5).unproject(rc).sub(rc.position).normalize();
      return rc.position.clone().addScaledVector(dir, D / dir.dot(fwd));
    };
    const plane = (x0, y0, x1, y1, D, mat, order) => {
      const a = at(x0, y0, D), b = at(x1, y0, D), c = at(x0, y1, D), d = at(x1, y1, D);
      const m = add(new THREE.PlaneGeometry(a.distanceTo(b), a.distanceTo(c)), mat, order, a.clone().add(d).multiplyScalar(.5), painted);
      m.quaternion.copy(rc.quaternion);
      return m;
    };
    const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
    const P = { x0: 1036, y0: 158, x1: 1842, y1: 1088 };          // window glass in the painting
    const SKY = { x0: 1046, y0: 162, w: 788, h: 606 };             // sky-mask box in the painting

    // PE cloud band behind the street: two painted masks (body + sun-lit rims) repeating sideways, drifting
    const cl = n => { const t = loader.load(`/assets/${n}.png`); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; };
    const cx0 = SKY.x0 - 900, cx1 = SKY.x0 + SKY.w + 900;
    plane(cx0, SKY.y0, cx1, SKY.y0 + SKY.h, 10.5, new THREE.ShaderMaterial({
      uniforms: { ...U, tBody: { value: cl('cloud-body') }, tLight: { value: cl('cloud-light') } }, transparent: true, depthWrite: false,
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tBody, tLight; uniform vec3 uPcb, uPcr, uHaze; uniform float uPca, uPra, uDrift, uRain; varying vec2 vUv;
        void main(){
          float px = mix(${cx0.toFixed(1)}, ${cx1.toFixed(1)}, vUv.x) - ${SKY.x0.toFixed(1)};
          vec2 uv = vec2(px / 648. + uDrift * 1.1, vUv.y);
          float b = texture2D(tBody, uv).a, l = texture2D(tLight, uv).a;
          float b2 = texture2D(tBody, vec2(px / 648. * .7 + uDrift * .6 + .37, vUv.y * .85 + .08)).a;   // fainter, slower band behind
          vec3 c = mix(uPcb, uPcr, clamp(l * uPra * 1.3, 0., 1.));
          float a = clamp(max(b * uPca, b2 * uPca * .35) + l * uPra * .4, 0., 1.);
          c = mix(c, uHaze, (1. - step(.02, b)) * .3);
          float g = dot(c, vec3(.3, .59, .11));
          c = mix(c, vec3(g) * vec3(.74, .78, .88), uRain * .6);
          gl_FragColor = vec4(c, min(1., a * mix(1., 1.2, uRain)));
        }`,
    }), -19);

    // the street itself: cut out of the painting with the PE sky mask, refined along the rooftops by brightness
    const plateMat = new THREE.ShaderMaterial({
      uniforms: { ...U, tPlate: { value: null }, tGlow: { value: null } }, transparent: true, depthWrite: false,
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tPlate, tGlow; uniform vec3 uAl, uHaze; uniform float uDay, uWin, uRain, uTime; varying vec2 vUv;
        float h1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        void main(){
          vec4 p = texture2D(tPlate, vUv);
          if (p.a < .01) discard;
          vec3 c = p.rgb;
          float l = dot(c, vec3(.3, .59, .11));
          vec3 dayC = mix(vec3(l), c, .32) * vec3(1.07, 1.01, .92) * 1.24 + vec3(.04, .04, .035);   // the dusk painting, sunlit
          c = mix(c, dayC, uDay * .75);
          c *= min(vec3(1.), uAl / vec3(.40, .32, .45));                                       // darker and bluer at night
          c = mix(c, uHaze, .08 * (1. - vUv.y));
          vec2 gw = texture2D(tGlow, vUv).rg;                                                   // r: lit window, g: its soft halo
          float cell = h1(floor(vUv * vec2(18., 22.)));
          float on = uWin * step(cell, .2 + .8 * uWin) * (.82 + .18 * sin(uTime * (.25 + cell * .4) + cell * 40.));
          c = mix(c, c * .62 + vec3(.04, .045, .07), gw.r * (1. - uWin));                       // painted windows go dark by day
          c += vec3(1., .78, .46) * (gw.r * .35 + gw.g * .4) * on;
          c = mix(c, c * vec3(.74, .78, .88), uRain * .45);
          gl_FragColor = vec4(c, p.a);
        }`,
    });
    plane(P.x0, P.y0, P.x1, P.y1, 5.4, plateMat, -12);
    Promise.all(['pe-room.webp', 'sky-mask.png'].map(n => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = `/assets/${n}`; })))
      .then(([room, mask]) => {
        const W = P.x1 - P.x0, H = P.y1 - P.y0;
        const pc = canvas(W, H), pg = pc.getContext('2d', { willReadFrequently: true });
        pg.drawImage(room, P.x0, P.y0, W, H, 0, 0, W, H);
        // inpaint the bits of the 2D lamp / ivy that stick into the window edges by stretching their neighbours over them
        pg.drawImage(pc, 26, 640, 2, H - 640, 0, 640, 26, H - 640);
        pg.drawImage(pc, W - 90, 850, 2, H - 850, W - 88, 850, 88, H - 850);
        const mc = canvas(W, H), mg = mc.getContext('2d', { willReadFrequently: true });
        mg.fillStyle = '#fff'; mg.fillRect(0, 0, W, SKY.y0 - P.y0); mg.fillRect(0, 0, SKY.x0 - P.x0, SKY.y0 - P.y0 + SKY.h);
        mg.fillRect(SKY.x0 - P.x0 + SKY.w, 0, W, SKY.y0 - P.y0 + SKY.h);
        mg.drawImage(mask, SKY.x0 - P.x0, SKY.y0 - P.y0);                // mask alpha 1 = sky
        const bc = canvas(W, H), bg = bc.getContext('2d', { willReadFrequently: true });
        bg.filter = 'blur(7px)'; bg.drawImage(mc, 0, 0);
        const img = pg.getImageData(0, 0, W, H), d = img.data;
        const m = mg.getImageData(0, 0, W, H).data, mb = bg.getImageData(0, 0, W, H).data;
        const glow = new Uint8ClampedArray(W * H);
        for (let i = 0, k = 0; i < d.length; i += 4, k++) {
          const r = d[i], g = d[i + 1], b = d[i + 2], lum = (.3 * r + .59 * g + .11 * b) / 255;
          const sky = m[i + 3] / 255, soft = mb[i + 3] / 255;
          let a = 1 - sky;
          if (soft > .03 && soft < .97) {                                  // near the roofline: key on brightness (sky is lighter)
            const t = Math.min(1, Math.max(0, (.69 - lum) / .12));
            a = t * t * (3 - 2 * t);
          }
          d[i + 3] = Math.round(a * 255);
          if (r > 185 && g > 150 && b < 175 && r - b > 55 && a > .5) glow[k] = 255;
        }
        pg.putImageData(img, 0, 0);
        // glow texture: r = window mask (slightly grown), g = wide soft halo
        const gc = canvas(W, H), gx = gc.getContext('2d');
        const wm = canvas(W, H), wx = wm.getContext('2d'), wi = wx.createImageData(W, H);
        for (let k = 0; k < glow.length; k++) { wi.data[k * 4] = wi.data[k * 4 + 1] = wi.data[k * 4 + 2] = 255; wi.data[k * 4 + 3] = glow[k]; }
        wx.putImageData(wi, 0, 0);
        gx.fillStyle = '#000'; gx.fillRect(0, 0, W, H);
        gx.globalCompositeOperation = 'lighter';
        gx.filter = 'blur(1.5px)'; gx.drawImage(tint(wm, '#ff0000'), 0, 0);
        gx.filter = 'blur(16px)'; gx.drawImage(tint(wm, '#00ff00'), 0, 0); gx.drawImage(tint(wm, '#00ff00'), 0, 0);
        plateMat.uniforms.tPlate.value = tex(pc);
        plateMat.uniforms.tGlow.value = tex(gc);
      });
    function tint(src, col) { const c = canvas(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; }

    // low mist drifting along the rooftops, a touch thicker when it rains
    plane(P.x0 - 300, 640, P.x1 + 300, P.y1, 5.2, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform vec3 uHaze, uSky[5]; uniform float uTime, uRain, uStar; varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          float n = fbm(vec2(vUv.x * 4. + uTime * .012, vUv.y * 5. - uTime * .004));
          float n2 = fbm(vec2(vUv.x * 7. - uTime * .02, vUv.y * 9.) + 4.);
          float band = smoothstep(.0, .35, 1. - vUv.y) * smoothstep(1., .55, 1. - vUv.y);
          float a = smoothstep(.42, .78, n * .7 + n2 * .4) * band * mix(.2, .38, uRain) * mix(1., .6, uStar);
          gl_FragColor = vec4(mix(uHaze, uSky[4], .5), a);
        }`,
    }), -11);

    // fireflies over the gardens at night
    {
      const n = 18, pos = new Float32Array(n * 3), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { at(1080 + Math.random() * 720, 820 + Math.random() * 230, 5.0).toArray(pos, i * 3); ph[i] = Math.random(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
      const p = new THREE.Points(geo, new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */`
          attribute float aPh; uniform float uTime, uPx, uStar, uRain; varying float vA;
          void main(){
            float t = uTime * (.06 + aPh * .05) + aPh * 30.;
            vec3 p = position + vec3(sin(t * 1.3) * .12, sin(t * .9 + aPh * 4.) * .06, cos(t) * .05);
            vA = uStar * (1. - uRain) * pow(max(0., sin(uTime * (.5 + aPh * .6) + aPh * 20.)), 3.);
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_PointSize = uPx * .03 / -mv.z; gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., 0., d); gl_FragColor = vec4(vec3(1., .92, .55) * a * a * vA, 1.); }`,
      }));
      p.frustumCulled = false; p.renderOrder = -10; painted.add(p);
    }
  }

  let mode = 'painted';
  const setMode = m => { mode = rest ? m : 'layered'; painted.visible = mode === 'painted'; layered.visible = mode === 'layered'; };
  setMode(rest ? 'painted' : 'layered');

  return {
    setMode, get mode() { return mode; },
    /** o = sampleTOD(h); drift in window widths; extra = { rain, wind, px } */
    update(o, time, drift, extra = {}) {
      U.uTime.value = time; U.uDrift.value = drift;
      U.uRain.value = extra.rain || 0; U.uWind.value = extra.wind || 0; if (extra.px) U.uPx.value = extra.px;
      o.sky.forEach((c, i) => U.uSky.value[i].fromArray(c));
      U.uHaze.value.fromArray(o.haze); U.uHz.value = o.hz;
      U.uPcb.value.fromArray(o.pcb); U.uPcr.value.fromArray(o.pcr); U.uPca.value = o.pca; U.uPra.value = o.pra;
      U.uCb.value.fromArray(o.cb); U.uCr.value.fromArray(o.cr); U.uCs.value.fromArray(o.cs); U.uCa.value = o.ca;
      U.uAl.value.fromArray(o.al); U.uWin.value = o.win;
      U.uStar.value = o.star; U.uMoon.value = o.moon; U.uSun.value = o.sun; U.uDay.value = o.day;
      U.uMoonPos.value.fromArray(o.moonPos); U.uSunPos.value.fromArray(o.sunPos);
      // the balloon drifts slowly up and across over three minutes
      const bt = (time / 180 + .15) % 1;
      balloon.m.position.copy(toWorld(-.15 + bt * 1.3, .5 - bt * .3 + Math.sin(time * .2) * .01, balloon.z));
    },
  };
}
