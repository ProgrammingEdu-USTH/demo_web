// Pick-up animations of the 2D page, done with real 3D objects.
// The room stays the painted 2D picture. When an object is clicked, its 3D model (from room.glb, lit by the
// Blender bakes) appears exactly over the painted object, is lifted toward the viewer, turns to show its face
// and hands over to the page that opens. On the way back it lands on its spot and fades into the painting again.
//
// The 3D camera is the one solved against the painting (tools/10_fit_camera.py). Its projection is chained
// with the page's own painting -> screen transform (layout L and zoom C), so a model at its room pose is drawn
// exactly where the painting shows it, even while the page zooms.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sampleTOD } from './tod.js';

const IW = 2752, IH = 1536;
const CAM2D = { pos: [0.1018, -3.1477, 1.8459], target: [-0.1020, 0.3221, 1.4354], vfov: 51.96 };
const B = (x, y, z) => new THREE.Vector3(x, z, -y);            // Blender (Z up) -> three (Y up)

const NODE = k => k === 'mug' ? 'Coffee_Mug' : k === 'phone' ? 'Interactive_Phone' : k === 'notebook' ? 'Interactive_Notebook'
  : /^(cupTop|cupLow|medalTop|medalLow|medalHang)$/.test(k) ? 'Interactive_Trophy_' + k[0].toUpperCase() + k.slice(1)
  : /^(book|pb|tb)\d+$/.test(k) ? 'Interactive_Book_' + k
  : k === 'laptop' ? 'Interactive_Laptop' : k === 'corkboard' ? 'Interactive_Corkboard' : k === 'calendar' ? 'Interactive_Calendar' : null;
let FLIP_PHONE = true;
// book: stands on a shelf; panel: hangs on a wall; flat: lies on the desk; upright: stands on the desk / shelf
const KIND = k => /^(book|pb|tb)\d+$/.test(k) ? 'book' : (k === 'corkboard' || k === 'calendar') ? 'panel' : (k === 'phone' || k === 'notebook') ? 'flat' : 'upright';

/* ---------------- renderer: one transparent canvas over the page, drawn only while something is held ---------------- */
const canvas = document.createElement('canvas');
canvas.id = 'held3d';
Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none',
  filter: 'drop-shadow(0 22px 26px rgba(8,4,18,.45))', opacity: '1' });
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(CAM2D.vfov, IW / IH, 0.02, 30);
cam.position.copy(B(...CAM2D.pos));
cam.lookAt(B(...CAM2D.target));
cam.updateMatrixWorld();
const P0 = cam.projectionMatrix.clone();
const camPos = cam.position.clone();
const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
const FY = (IH / 2) / Math.tan(THREE.MathUtils.degToRad(CAM2D.vfov) / 2);   // painting px per unit at distance 1

/* ---------------- baked material, plus a soft key light so the form reads when it turns ---------------- */
const tex = n => { const t = new THREE.TextureLoader().load(`/assets/${n}.webp`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const U = {
  tDay: { value: null }, tLamp: { value: null }, uAmb: { value: new THREE.Vector3(1, 1, 1) }, uLamp: { value: 1 },
  uOp: { value: 1 }, uForm: { value: 0 }, uScreen: { value: new THREE.Vector3() }, uScreenUp: { value: new THREE.Vector3() }, uScreenLen: { value: 1 }, uCtr: { value: new THREE.Vector3() },
  uCoverN: { value: new THREE.Vector3() }, uSpineN: { value: new THREE.Vector3() }, uTint: { value: new THREE.Color() }, uTintOn: { value: 0 },
  uCover: { value: null }, uCoverOn: { value: 0 }, uCovR: { value: new THREE.Vector3() }, uCovU: { value: new THREE.Vector3() }, uCovW: { value: 1 }, uCovH: { value: 1 }, uShine: { value: -1 }, uB: { value: 1 }, uS: { value: 1 },
};
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true,
  vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN, vLp, vLn;
    void main(){ vUv = uv; vLp = position; vLn = normal; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN, vLp, vLn;
    uniform sampler2D tDay, tLamp; uniform vec3 uAmb, uScreen, uScreenUp, uCtr, uCoverN, uSpineN, uTint, uCovR, uCovU; uniform sampler2D uCover; uniform float uCoverOn, uCovW, uCovH, uTintOn, uScreenLen, uLamp, uOp, uForm, uShine, uB, uS;
    void main(){
      vec3 c = texture2D(tDay, vUv).rgb * uAmb + texture2D(tLamp, vUv).rgb * uLamp;
      if (dot(normalize(vLn), uScreen) > .9) {                // phone screen (it faced the desk in the bake): a soft lit screen
        float g = clamp(dot(vLp - uCtr, uScreenUp) / uScreenLen + .5, 0., 1.);
        c = mix(vec3(.035, .04, .09), vec3(.16, .15, .32), g * g) * (.7 + .5 * uForm);
      }
      vec3 n = normalize(vN);
      float key = max(dot(n, normalize(vec3(-.45, .55, .7))), 0.);
      float rim = pow(1. - max(n.z, 0.), 2.5);
      c *= mix(1., .72 + .42 * key, uForm);                  // turned away from its baked view: give it a gentle form light
      c += uForm * rim * vec3(1., .82, .62) * .10 * (.4 + uLamp);
      if (uShine >= 0.) {                                     // glint sweeping across a trophy
        float band = smoothstep(.03, 0., abs(vLp.x * .6 + vLp.y - mix(-.14, .44, uShine)));
        c += vec3(1., .95, .8) * band * sin(uShine * 3.1416) * 1.3;
      }
      c = c / (1. + c * .18) * 1.18;
      c *= uB; c = mix(vec3(dot(c, vec3(.299, .587, .114))), c, uS);   // same brightness / saturation as the painted sprites
      c = clamp(c, 0., 1.);
      if (uTintOn > 0.) {                                     // a book turning to the viewer takes on the cover colour of the 2D book it becomes
        vec3 ln = normalize(vLn);
        float face = max(step(.85, abs(dot(ln, uCoverN))), step(.85, dot(ln, uSpineN)));
        float tk = smoothstep(.2, 1., uForm) * face;
        vec3 cv = uTint * (.8 + .32 * key);
        if (uCoverOn > 0. && dot(ln, uCoverN) > .85) {        // front cover: the painted 2D cover itself
          vec2 cuv = vec2(dot(vLp - uCtr, uCovR) / uCovW + .5, .5 + dot(vLp - uCtr, uCovU) / uCovH);   // canvas textures are flipped in v
          vec4 t = texture2D(uCover, cuv);
          cv = mix(cv, t.rgb * (.9 + .16 * key), t.a);
        }
        c = mix(c, cv, tk * .95);
      }
      gl_FragColor = vec4(mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)) * uOp, uOp);
    }`,
});
mat.premultipliedAlpha = true;
// wall things (corkboard, calendar) were baked into the room atlas: same shader, other textures
const ROOM = { tDay: { value: null }, tLamp: { value: null } };
const matRoom = mat.clone(); matRoom.uniforms = { ...U, ...ROOM }; matRoom.premultipliedAlpha = true;

// laptop screen: an Arena match in progress (the laptop is the way into Đấu trường)
const screenTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
  const CODE = ['# Đấu trường · FizzBuzz', 'def solve(n):', '    out = []', '    for i in range(1, n + 1):', '        if i % 15 == 0:', '            out.append("FizzBuzz")', '        elif i % 3 == 0:', '            out.append("Fizz")', '        else:', '            out.append(str(i))', '    return out'];
  x.fillStyle = '#121725'; x.fillRect(0, 0, 512, 320); x.fillStyle = '#1b2236'; x.fillRect(0, 0, 512, 30);
  ['#ff9db8', '#ffc97a', '#8be3a8'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(18 + i * 18, 15, 5, 0, 7); x.fill(); });
  x.font = '600 14px ui-monospace,Consolas,monospace'; x.fillStyle = '#d9e6ff'; x.fillText('solution.py · Đấu trường', 86, 20);
  x.font = '17px ui-monospace,Consolas,monospace';
  CODE.forEach((ln, i) => {
    x.fillStyle = '#6f7a96'; x.fillText(String(i + 1).padStart(2), 12, 58 + i * 21);
    x.fillStyle = /^\s*#/.test(ln) ? '#6f7a96' : /^\s*(def|for|if|elif|else|return)\b/.test(ln) ? '#ff9db8' : /"/.test(ln) ? '#8be3a8' : '#d9e6ff'; x.fillText(ln, 48, 58 + i * 21);
  });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
})();
const matScreen = new THREE.ShaderMaterial({
  uniforms: { map: { value: screenTex }, uOp: U.uOp }, transparent: true, premultipliedAlpha: true,
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`varying vec2 vUv; uniform sampler2D map; uniform float uOp;
    void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb * 1.08 * uOp, uOp); }`,   // canvas values are display values already
});

/* ---------------- models ---------------- */
const MODELS = {};
let ready = false, PROPS = null;
fetch('/assets/atlas-groups.json').then(r => r.json()).then(g => { PROPS = new Set(g.props); });
new GLTFLoader().load('/assets/room.glb', g => {
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => { if (o.isMesh) MODELS[o.name] = o; });
  U.tDay.value = tex('props_day'); U.tLamp.value = tex('props_lamp');
  ROOM.tDay.value = tex('bake_day'); ROOM.tLamp.value = tex('bake_lamp');
  ready = true;
});
const withNormals = g => {                                      // the bake export has no normals: make them for the form light
  if (g.attributes.normal) return g;
  const n = g.index ? g.toNonIndexed() : g.clone(); n.computeVertexNormals(); n.computeBoundingBox(); return n;
};

/* ---------------- page link ---------------- */
const P = () => window.PE2D;                                   // set by the page: L, C, meta(k), tod()
function proj(C, fit) {
  // camera NDC -> painting px (with the room-fit correction) -> screen px (page layout + zoom) -> canvas NDC
  const { L } = P(); const W = L.W, H = L.H;
  const sc = 1 + (H0.sc - 1) * fit, tx = H0.tx * fit, ty = H0.ty * fit;
  const a = C.k * L.s * IW / W, b = 2 * (C.tx + C.k * (L.ox + L.s * IW / 2)) / W - 1;
  const d = C.k * L.s * IH / H, e = 1 - 2 * (C.ty + C.k * (L.oy + L.s * IH / 2)) / H;
  const A = new THREE.Matrix4().set(a * sc, 0, 0, a * tx + b, 0, d * sc, 0, d * ty + e, 0, 0, 1, 0, 0, 0, 0, 1);
  cam.projectionMatrix.multiplyMatrices(A, P0);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
const H0 = { sc: 1, tx: 0, ty: 0 };                            // correction from the model's projection to the painted sprite

/* ---------------- the held object ---------------- */
const holder = new THREE.Group();
scene.add(holder);
let mesh = null, cur = null, rest = null, info = null, Cref = null;
const pose = (o = {}) => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, fit: 1, op: 1, yaw: 0, pitch: 0, roll: 0, off: new THREE.Vector3(), form: 0, ...o });
const clonePose = a => ({ ...a, p: a.p.clone(), q: a.q.clone(), off: a.off.clone() });

function axesOf(m) {
  const bb = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox);
  const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  m.matrixWorld.decompose(p, q, s);
  const ax = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((v, i) => ({ v: v.applyQuaternion(q), len: size.getComponent(i) * s.getComponent(i) }));
  return { ax, q, scale: s, ctrLocal: ctr, ctrWorld: ctr.clone().applyMatrix4(m.matrixWorld) };
}

// How the object faces the viewer when held: f = side toward the camera, u = side up on screen
// A book's real axes, from its vertices: books may lean on each other, so the box axes are not enough.
// d = depth (spine side, toward the room), u = height, f = cover normal (thickness)
function bookAxes(src, a) {
  const toCam = camPos.clone().sub(a.ctrWorld);
  const d = a.ax.filter(x => Math.abs(x.v.y) < .5).reduce((m, x) => x.len > m.len ? x : m).v.clone();
  if (d.dot(toCam) < 0) d.negate();
  const e1 = new THREE.Vector3(0, 1, 0).sub(d.clone().multiplyScalar(d.y)).normalize(), e2 = new THREE.Vector3().crossVectors(d, e1);
  const pos = src.geometry.attributes.position, v = new THREE.Vector3(), c = a.ctrWorld;
  let sxx = 0, syy = 0, sxy = 0;
  const P = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(src.matrixWorld).sub(c);
    const x = v.dot(e1), y = v.dot(e2); sxx += x * x; syy += y * y; sxy += x * y; P.push(v.clone());
  }
  const th = .5 * Math.atan2(2 * sxy, sxx - syy);
  const u = e1.clone().multiplyScalar(Math.cos(th)).addScaledVector(e2, Math.sin(th)).normalize(); if (u.y < 0) u.negate();
  const f = new THREE.Vector3().crossVectors(u, d);                 // so the spine ends up on the left of the cover
  const ext = w => { let lo = 1e9, hi = -1e9; for (const p of P) { const s = p.dot(w); lo = Math.min(lo, s); hi = Math.max(hi, s); } return hi - lo; };
  return { d, u, f, hu: ext(u), depth: ext(d), thick: ext(f) };
}

function heldBasis(k, a, src) {
  const kind = KIND(k), toCam = camPos.clone().sub(a.ctrWorld).normalize();
  if (kind === 'book') {
    const b = bookAxes(src, a), qi = a.q.clone().invert();
    U.uCoverN.value.copy(b.f).applyQuaternion(qi); U.uSpineN.value.copy(b.d).applyQuaternion(qi);
    const r = new THREE.Vector3().crossVectors(b.u, b.f);
    U.uCovR.value.copy(r).applyQuaternion(qi); U.uCovU.value.copy(b.u).applyQuaternion(qi); U.uCtr.value.copy(a.ctrLocal);
    U.uCovW.value = b.depth / a.scale.x; U.uCovH.value = b.hu / a.scale.y;
    return { f: b.f, u: b.u, r, hu: b.hu, wr: b.depth, out: b.d.clone().multiplyScalar(b.depth * 1.02) };
  }
  const fwdH = camFwd.clone().setY(0).normalize();
  let f, u;
  if (kind === 'upright') {
    u = a.ax.reduce((m, x) => Math.abs(x.v.y) > Math.abs(m.v.y) ? x : m).v.clone(); if (u.y < 0) u.negate();
    f = toCam.clone().sub(u.clone().multiplyScalar(toCam.dot(u))).normalize();
  } else {
    const sorted = [...a.ax].sort((x, y) => x.len - y.len);
    f = sorted[0].v.clone(); if (f.dot(toCam) < 0) f.negate();
    if (k === 'phone' && FLIP_PHONE) {                         // the model lies screen-down: turn it over and light its screen
      f.negate();
      U.uScreen.value.copy(f).applyQuaternion(a.q.clone().invert());
    }
    if (kind === 'book' || kind === 'panel') { u = sorted.slice(1).reduce((m, x) => Math.abs(x.v.y) > Math.abs(m.v.y) ? x : m).v.clone(); if (u.y < 0) u.negate(); }
    else {   // flat on the desk: the edge farther from the viewer becomes the top, as when you pick it up
      u = (Math.abs(sorted[1].v.dot(fwdH)) > Math.abs(sorted[2].v.dot(fwdH)) ? sorted[1] : sorted[2]).v.clone();
      if (u.dot(fwdH) < 0) u.negate();
    }
  }
  const r = new THREE.Vector3().crossVectors(u, f);
  const len = v => a.ax.reduce((s, x) => s + Math.abs(x.v.dot(v)) * x.len, 0);    // extent of the box along v
  if (k === 'phone') {
    const qi = a.q.clone().invert();
    U.uScreenUp.value.copy(u).applyQuaternion(qi); U.uCtr.value.copy(a.ctrLocal); U.uScreenLen.value = len(u) / Math.max(1e-6, a.scale.x);
  }
  return { f, u, r, hu: len(u), wr: len(r) };
}

function setRoomFit(k) {
  // project the model's box at its room pose into painting px and compare with the painted sprite's box
  const m = P().meta(k); if (!m) { Object.assign(H0, { sc: 1, tx: 0, ty: 0 }); return; }
  const bb = mesh.geometry.boundingBox, v = new THREE.Vector3();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(rest.mw).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(P0);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  // sprite box in camera NDC
  const sx0 = m[0] / (IW / 2) - 1, sx1 = (m[0] + m[2]) / (IW / 2) - 1, sy0 = 1 - (m[1] + m[3]) / (IH / 2), sy1 = 1 - m[1] / (IH / 2);
  const sc = THREE.MathUtils.clamp(Math.sqrt(((sx1 - sx0) * (sy1 - sy0)) / ((x1 - x0) * (y1 - y0))), .6, 1.6);
  H0.sc = sc; H0.tx = (sx0 + sx1) / 2 - sc * (x0 + x1) / 2; H0.ty = (sy0 + sy1) / 2 - sc * (y0 + y1) / 2;
}

/** Held pose that fills screen rect R (page px) facing the viewer. */
function heldPose(R, o = {}) {
  const { L, C } = P(); Cref = { ...C };
  const px = ((R.left + R.width / 2 - C.tx) / C.k - L.ox) / L.s, py = ((R.top + R.height / 2 - C.ty) / C.k - L.oy) / L.s;
  const n = new THREE.Vector3(px / (IW / 2) - 1, 1 - py / (IH / 2), .5);
  // unproject through the plain camera (fit 0)
  const dir = n.applyMatrix4(P0.clone().invert()).applyMatrix4(cam.matrixWorld).sub(camPos).normalize();
  const fy = FY * L.s * C.k;
  const z = Math.max(info.hu * fy / R.height, info.wr * fy / R.width) * (o.pad || 1.08);
  const at = camPos.clone().add(dir.multiplyScalar(z / dir.dot(camFwd)));
  // basis rotation: rest (r,u,f) -> held (right, up, toward camera at that spot)
  const fT = camPos.clone().sub(at).normalize(), uT = camUp.clone().sub(fT.clone().multiplyScalar(camUp.dot(fT))).normalize();
  const rT = new THREE.Vector3().crossVectors(uT, fT);
  const mR = new THREE.Matrix4().makeBasis(info.r, info.u, info.f), mT = new THREE.Matrix4().makeBasis(rT, uT, fT);
  const qd = new THREE.Quaternion().setFromRotationMatrix(mT).multiply(new THREE.Quaternion().setFromRotationMatrix(mR).invert());
  return pose({ p: at, q: qd.multiply(rest.q.clone()), fit: 0, form: 1, ...o, off: o.off || new THREE.Vector3() });
}

/* ---------------- drawing ---------------- */
const qTmp = new THREE.Quaternion(), qE = new THREE.Quaternion();
function apply() {
  if (!cur || !mesh) return;
  const { C } = P();
  const f = cur.fit, Cx = Cref ? { k: Math.exp(Math.log(Cref.k) + (Math.log(C.k) - Math.log(Cref.k)) * f), tx: Cref.tx + (C.tx - Cref.tx) * f, ty: Cref.ty + (C.ty - Cref.ty) * f } : C;
  proj(Cx, f);
  holder.position.copy(cur.p).addScaledVector(camRight, cur.off.x).addScaledVector(camUp, cur.off.y).addScaledVector(camFwd, -cur.off.z);
  qE.setFromAxisAngle(camUp, cur.yaw); qTmp.copy(qE);
  qE.setFromAxisAngle(camRight, cur.pitch); qTmp.multiply(qE);
  qE.setFromAxisAngle(camFwd, -cur.roll); qTmp.multiply(qE);
  holder.quaternion.copy(qTmp).multiply(cur.q);
  holder.scale.setScalar(cur.s);
  U.uOp.value = cur.op; U.uForm.value = cur.form;
  // light follows the page's time of day
  const h = P().tod(), t = sampleTOD(h), st = getComputedStyle(document.getElementById('app'));
  const near = .25 * cur.form;                                   // held close to the face: a bit more of the room light
  U.uAmb.value.fromArray(t.amb).multiplyScalar(1 + near).addScalar(.05 * cur.form);
  U.uLamp.value = Math.max(t.lamp, .25) * (1 + near * .5);
  U.uB.value = 1 + ((+st.getPropertyValue('--b') || 1) - 1) * .35;
  U.uS.value = +st.getPropertyValue('--s') || 1;
}
let raf = 0, live = false;
function size() {
  const { L } = P(); renderer.setSize(L.W, L.H, false);
}
function frame() {
  raf = 0;
  if (!live || (!tweens.size && cur && cur.op < .002)) { renderer.clear(); return; }   // nothing showing: stop drawing
  for (const tw of [...tweens]) tw.step(performance.now());
  size(); apply(); renderer.render(scene, cam);
  raf = requestAnimationFrame(frame);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

/* ---------------- tweening ---------------- */
const tweens = new Set();
const EASE = { out: t => 1 - Math.pow(1 - t, 4), inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => 1 - Math.pow(1 - t, 3) * (1 - 2.2 * t) * 1, lin: t => t };
EASE.back = t => { const c = 1.4; const x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
function tween(to, dur, o = {}) {
  const from = clonePose(cur), ease = EASE[o.ease || 'out'];
  return new Promise(res => {
    const t0 = performance.now();
    const tw = { step(now) {
      const r = Math.min(1, (now - t0) / Math.max(1, dur)), e = ease(r);
      cur.p.lerpVectors(from.p, to.p, e);
      if (o.arc) cur.p.addScaledVector(camUp, Math.sin(Math.PI * e) * o.arc);
      cur.q.slerpQuaternions(from.q, to.q, e);
      for (const k of ['s', 'fit', 'yaw', 'pitch', 'roll', 'form']) cur[k] = lerp(from[k], to[k], e);
      cur.off.lerpVectors(from.off, to.off, e);
      cur.op = o.op ? lerp(o.op[2] ?? from.op, o.op[3] ?? to.op, seg(r, o.op[0], o.op[1])) : lerp(from.op, to.op, e);
      if (o.shine) U.uShine.value = seg(r, o.shine[0], o.shine[1]) || -1;
      if (r >= 1) { tweens.delete(tw); if (o.shine) U.uShine.value = -1; res(); }
    } };
    tweens.add(tw); kick();
  });
}

/* ---------------- API used by the page ---------------- */
const api = {
  get ready() { return ready && !!P(); },
  has: k => ready && !!MODELS[NODE(k)],
  start(k, opt = {}) {
    const src = MODELS[NODE(k)]; if (!src) return false;
    if (!canvas.isConnected) document.getElementById('held').prepend(canvas);
    holder.clear(); curK = k; U.uScreen.value.set(0, 0, 0); U.uCoverN.value.set(0, 0, 0); U.uSpineN.value.set(0, 0, 0);
    U.uTintOn.value = opt.tint ? 1 : 0; if (opt.tint) U.uTint.value.setStyle(opt.tint);
    U.uCover.value?.dispose(); U.uCover.value = null; U.uCoverOn.value = 0;
    if (opt.cover) { const t = new THREE.CanvasTexture(opt.cover); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; U.uCover.value = t; U.uCoverOn.value = 1; }
    const a = axesOf(src);
    src.geometry = withNormals(src.geometry);
    mesh = new THREE.Mesh(src.geometry, PROPS && !PROPS.has(src.name) ? matRoom : mat);
    for (const ch of src.children) if (ch.isMesh) {                // parts that move with it (the laptop's screen)
      const m = new THREE.Mesh(ch.geometry, /Screen/.test(ch.name) ? matScreen : (ch.geometry = withNormals(ch.geometry), mat));
      m.position.copy(ch.position); m.quaternion.copy(ch.quaternion); m.scale.copy(ch.scale); m.renderOrder = 1;
      mesh.add(m);
    }
    mesh.position.copy(a.ctrLocal).negate();                       // pivot at the box centre
    const wrap = new THREE.Object3D(); wrap.scale.copy(a.scale);   // keep the node's own scale under the pivot
    wrap.add(mesh); holder.add(wrap);
    info = heldBasis(k, a, src);
    rest = pose({ p: a.ctrWorld.clone(), q: a.q.clone(), fit: 1, op: 0, form: 0 });
    rest.mw = src.matrixWorld.clone();
    Cref = null;
    setRoomFit(k);
    cur = clonePose(rest);
    live = true; kick();
    return true;
  },
  /** lift off the desk / pull out of the shelf, fading in over the painted sprite */
  lift(dur) {
    const to = clonePose(rest); to.op = 1; to.form = .25;
    const toCam = camPos.clone().sub(rest.p).setY(0).normalize();
    if (KIND(curK) === 'book') { void toCam; to.p.add(info.out); to.p.y += .004; to.form = .15; }   // slide straight out of the shelf, clear of its neighbours
    else if (KIND(curK) === 'panel') { to.p.addScaledVector(info.f, .05 + .08 * info.hu); to.p.y += .02; }           // lift off its nail, away from the wall
    else { to.p.y += .3 * info.hu + .01; to.pitch = -.12; }
    return tween(to, dur, { op: [0, .55, 0, 1] });
  },
  /** fly to fill screen rect R, facing the viewer */
  toRect(R, o = {}) {
    const to = heldPose(R, o.pose);
    return tween(to, o.dur || 900, { ease: o.ease || 'out', arc: o.arc ?? .04, op: o.fade ? [o.fade[0], o.fade[1], 1, 0] : [0, .3, cur.op, 1] });
  },
  /** jump to a held pose (for coming back from a page) */
  setRect(R, o = {}) { cur = heldPose(R, o.pose); cur.op = o.op ?? 0; kick(); },
  set(fields) { Object.assign(cur, fields); kick(); },
  to(fields, dur, o = {}) { const to = clonePose(cur); for (const k in fields) { if (k === 'off') to.off.copy(fields.off); else to[k] = fields[k]; } return tween(to, dur, o); },
  /** back to its spot in the room, still showing (the page cross-fades it into the painting) */
  /** a locked book: comes a little way out, jiggles as if stuck, slides back */
  async tug() {
    const out = clonePose(rest); out.op = 1; out.p.addScaledVector(info.out, .3);
    await tween(out, 260, { ease: 'out', op: [0, .5, cur.op, 1] });
    for (const a of [.06, -.05, .03, 0]) { const w = clonePose(cur); w.yaw = a; await tween(w, 90, { ease: 'inOut' }); }
    const back = clonePose(rest); back.op = 1; await tween(back, 300, { ease: 'inOut' });
  },
  home(dur, o = {}) {
    const to = clonePose(rest); to.op = 1;
    if (KIND(curK) === 'book') {             // back in front of its slot first, then pushed in
      const out = clonePose(rest); out.op = 1; out.p.add(info.out); out.form = .15;
      return tween(out, dur * .72, { ease: 'inOut', arc: o.arc ?? .03, op: o.op || [0, .3, cur.op, 1] }).then(() => tween(to, dur * .28 + 120, { ease: 'out' }));
    }
    return tween(to, dur, { ease: o.ease || 'inOut', arc: o.arc ?? .03, op: o.op || [0, .3, cur.op, 1] });
  },
  fadeOut(dur) { return this.to({ op: 0 }, dur, { ease: 'lin' }); },
  spin(dur) { return this.to({ yaw: (cur.yaw || 0) + Math.PI * 2 }, dur, { ease: 'inOut', shine: [.15, .8] }).then(() => { cur.yaw = 0; }); },
  /** screen-pixel offset (up, right) at the held object's depth, as a camera-space vector for `off` */
  up(py, px = 0) {
    const { L, C } = P(); const z = cur ? Math.max(.05, cur.p.clone().sub(camPos).dot(camFwd)) : 1;
    const u = z / (FY * L.s * C.k); return new THREE.Vector3(px * u, py * u, 0);
  },
  _dbg: () => ({ cur, info, rest, H0, Cref, live, tweens: tweens.size, cam, U, mesh }),
  clear() { live = false; cur = null; holder.clear(); mesh = null; tweens.clear(); kick(); },
};
let curK = null;

window.PE3D = api;
addEventListener('resize', kick);
