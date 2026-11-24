// Góc học PE in 3D.
// Render budget: the whole room is unlit and reads its lighting from Blender bakes (2 atlases x 2 light layers),
// so there are no realtime lights or shadows. Static furniture is one merged mesh; only things that move are separate.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sampleTOD } from './tod.js';
import { createOutside } from './outside.js';

const $ = s => document.querySelector(s);
const B = (x, y, z) => new THREE.Vector3(x, z, -y);            // Blender (Z up) -> three (Y up)
const Bv = a => B(a[0], a[1], a[2]);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x0d0b13);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
renderer.info.autoReset = false;
// Camera solved against the 2D illustration (tools/10_fit_camera.py), so the 3D room lines up with room.webp.
const CAM2D = { pos: [0.1018, -3.1477, 1.8459], target: [-0.1020, 0.3221, 1.4354], vfov: 51.96, aspect: 2752 / 1536 };
const CAM = Bv(CAM2D.pos), LOOK = Bv(CAM2D.target);
const VFOV = THREE.MathUtils.degToRad(CAM2D.vfov), HFOV = 2 * Math.atan(Math.tan(VFOV / 2) * CAM2D.aspect);

/* ---------------- post pass: "Vẽ tay" = light posterised into bands + ink outlines, so 3D sits with the 2D art ---------------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthTexture: new THREE.DepthTexture(1, 1) });
const post = {
  tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(1, 1) },
  uStyle: { value: 0 }, uPx: { value: 1 }, uNear: { value: camera.near }, uFar: { value: camera.far },
};
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: post, depthTest: false, depthWrite: false,
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uStyle, uPx, uNear, uFar;
    float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }
    float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
    void main(){
      vec3 c = texture2D(tColor, vUv).rgb;
      if (uStyle > .001) {
        vec2 px = uPx / uRes;
        // outlines: 2nd derivative of depth (ignores smooth slopes like the floor, catches silhouettes and creases)
        float d0 = lin(vUv);
        float dl = lin(vUv - vec2(px.x, 0.)), dr = lin(vUv + vec2(px.x, 0.)), du = lin(vUv + vec2(0., px.y)), dd = lin(vUv - vec2(0., px.y));
        float eD = smoothstep(.010, .028, (abs(dl + dr - 2. * d0) + abs(du + dd - 2. * d0)) / d0);
        // plus strong colour changes (book spines, keys, notes) as thinner, lighter lines
        vec3 cl = texture2D(tColor, vUv - vec2(px.x, 0.)).rgb, cr = texture2D(tColor, vUv + vec2(px.x, 0.)).rgb;
        vec3 cu = texture2D(tColor, vUv + vec2(0., px.y)).rgb, cd = texture2D(tColor, vUv - vec2(0., px.y)).rgb;
        float eC = smoothstep(.20, .42, length(cl - cr) + length(cu - cd)) * .55;
        float edge = max(eD, eC);
        // cel shading: brightness snapped into 5 soft-edged bands, hue kept
        float l = lum(c), f = l * 5.;
        float lq = (floor(f) + smoothstep(.3, .7, fract(f))) / 5.;
        vec3 p = c * mix(1., lq / max(l, .001), .8);
        p = mix(vec3(lum(p)), p, 1.12);                         // a touch more saturation, like the illustration
        c = mix(c, p, uStyle);
        c = mix(c, vec3(.17, .10, .10), edge * .85 * uStyle);  // warm dark-brown ink, not black
      }
      gl_FragColor = vec4(c, 1.);
    }`,
})));

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  rt.setSize(Math.round(w * pr), Math.round(h * pr));
  post.uRes.value.set(w * pr, h * pr);
  post.uPx.value = Math.max(1, pr * .9);
  camera.aspect = w / h;
  // frame exactly like CSS object-fit: cover on the 2D image: wider screens crop top/bottom, narrower crop the sides
  camera.fov = THREE.MathUtils.radToDeg(camera.aspect >= CAM2D.aspect ? 2 * Math.atan(Math.tan(HFOV / 2) / camera.aspect) : VFOV);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);

/* ---------------- baked materials: colour = day * skyTint + lamp * lampLevel ---------------- */
const bakeTex = n => { const t = texLoader.load(`/assets/${n}.webp`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const light = { uAmb: { value: new THREE.Vector3(1, 1, 1) }, uLamp: { value: 1 } };
const ATLAS = {
  room: { tDay: { value: bakeTex('bake_day') }, tLamp: { value: bakeTex('bake_lamp') } },
  props: { tDay: { value: bakeTex('props_day') }, tLamp: { value: bakeTex('props_lamp') } },
};
const bakedMat = atlas => new THREE.ShaderMaterial({
  uniforms: { ...light, ...ATLAS[atlas], uHi: { value: 0 }, uShine: { value: -1 } },
  vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vLp; void main(){ vUv = uv; vLp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv; varying vec3 vLp;
    uniform sampler2D tDay, tLamp; uniform vec3 uAmb; uniform float uLamp, uHi, uShine;
    void main(){
      vec3 c = texture2D(tDay, vUv).rgb * uAmb + texture2D(tLamp, vUv).rgb * uLamp;
      c *= 1. + uHi * .32; c += uHi * vec3(.045, .03, .012);
      if (uShine >= 0.) {                                   // a glint sweeping across a trophy after a click
        float band = smoothstep(.025, 0., abs(vLp.x * .6 + vLp.y - mix(-.12, .42, uShine)));
        c += vec3(1., .95, .8) * band * (1. - uShine) * 1.4;
      }
      c = c / (1. + c * .18) * 1.18;                       // soft shoulder so the lamp pool never clips hard
      c = clamp(c, 0., 1.);
      // write display (sRGB) values ourselves: the frame goes through a post pass, where three would not convert
      gl_FragColor = vec4(mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)), 1.);
    }`,
});

/* ---------------- what can be clicked ---------------- */
const LESSONS = [['Vòng lặp lồng nhau là gì'], ['In hình chữ nhật sao'], ['Bảng cửu chương'], ['Tam giác sao'], ['Tam giác ngược'],
  ['Đếm cặp số'], ['Duyệt mảng hai chiều'], ['Tối ưu hai vòng lặp'], ['Kiểm tra cuối chặng']];
const SHELVES = {
  book: { short: 'C++', lessons: LESSONS.map(l => l[0]) },
  pb: { short: 'Python', lessons: ['Biến và kiểu dữ liệu', 'Nhập và xuất', 'Câu lệnh if', 'if, elif, else', 'Vòng lặp for', 'Vòng lặp while', 'Hàm', 'List', 'Dict', 'Chuỗi', 'Ôn tập'] },
  tb: { short: 'Tư duy', lessons: ['Chia nhỏ bài toán', 'Viết mã giả', 'Vẽ lưu đồ', 'Tìm quy luật', 'Thử bằng tay', 'Đếm số bước', 'Thuật toán tham lam', 'Chia để trị'] },
};
const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(0, 0, 1), RIGHT = new THREE.Vector3(1, 0, 0), LEFT = new THREE.Vector3(-1, 0, 0);
// [name pattern, kind, label, hover-lift direction, click animation]
const DEFS = [
  [/^Interactive_Laptop/, 'laptop', () => 'Laptop · Đấu trường', UP, 'hop'],
  [/^Interactive_Notebook/, 'notebook', () => 'Cuốn sổ · Luyện tập', UP, 'hop'],
  [/^Interactive_Phone/, 'phone', () => 'Điện thoại · Hồ sơ và xếp hạng', UP, 'buzz'],
  [/^Coffee_Mug/, 'mug', () => 'Cốc cà phê · Nghỉ 5 phút', UP, 'hop'],
  [/^Interactive_Corkboard/, 'corkboard', () => 'Bảng ghim · Lộ trình', RIGHT, 'swingX'],
  [/^Interactive_Calendar/, 'calendar', () => 'Lịch · Chuỗi 12 ngày', OUT, 'swingZ'],
  [/^Interactive_Trophy_MedalHang/, 'trophy', () => 'Kệ cúp · Thành tựu', LEFT, 'swingX'],
  [/^Interactive_Trophy/, 'trophy', () => 'Kệ cúp · Thành tựu', UP, 'spin'],
  [/^Interactive_Book_(book|pb|tb)(\d+)/, 'book', m => { const S = SHELVES[m[1]], i = +m[2]; return `${S.short} · Bài ${i + 1}: ${S.lessons[i]}`; }, OUT, 'slide'],
  [/^Window_(Sash|Glass)/, 'window', () => 'Cửa sổ · Mở để hóng gió', null, 'window'],
];
const items = [], pickables = [];
let sashL, sashR;

const fx = { uTime: { value: 0 }, uLamp: light.uLamp, uWind: { value: 0 }, uPx: { value: 1 } };

Promise.all(['scene-data', 'atlas-groups'].map(n => fetch(`/assets/${n}.json`).then(r => r.json()))).then(([sd, groups]) => {
  const propSet = new Set(groups.props);
  gltfLoader.load('/assets/room.glb', g => {
    const root = g.scene;
    scene.add(root);
    const nodes = [];
    root.traverse(o => { if (o.isMesh) nodes.push(o); });
    for (const o of nodes) {
      if (/^Window_Glass/.test(o.name)) {
        o.material = new THREE.MeshBasicMaterial({ map: glassTex(), transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        o.renderOrder = 2;
      } else if (/^Laptop_Screen/.test(o.name)) {
        o.material = new THREE.MeshBasicMaterial({ map: screen.tex });
      } else {
        o.material = bakedMat(propSet.has(o.name) ? 'props' : 'room');
      }
      const def = DEFS.find(d => d[0].test(o.name));
      if (!def) continue;
      const [re, kind, label, dir, anim] = def;
      const it = { o, kind, label: label(o.name.match(re)), dir, anim, base: o.position.clone(), rot: o.rotation.clone(), hover: 0, t: 9 };
      o.userData.item = it;
      items.push(it);
      pickables.push(o);
    }
    sashL = root.getObjectByName('Window_Sash_L');
    sashR = root.getObjectByName('Window_Sash_R');
    const lap = items.find(i => i.kind === 'laptop'), scr = nodes.find(n => /^Laptop_Screen/.test(n.name));
    if (lap && scr) lap.o.attach(scr);                     // the screen rides with the laptop when it lifts
  });
  addFairyLights(sd.bulbs);
  addLampLight(sd.led);
  addSteam(Bv(sd.mugTop));
  addStickyNotes();
});

/* ---------------- sticky-note notifications taped under the window sill (from the 2D version) ---------------- */
const NOTES = [
  { ic: '↑2', sh: 'Hạng 37', l3: 'Giải Bạc', t: 'Bạn vừa tăng 2 bậc', b: 'Tuần này bạn đang hạng 37 ở Giải Bạc. Thêm 160 XP nữa là vào top 30.', c: '#a9d2ff' },
  { ic: '2 ngày', sh: 'Đệ quy', l3: '0/5 bài', t: 'Còn 2 ngày cho “Đệ quy”', b: 'Bạn đã làm 0/5 bài. Hoàn thành cả 5 để nhận huy hiệu Kim cương.', c: '#ffe38c' },
  { ic: '+40', sh: 'Luyện tập', l3: '2 bài nữa', t: 'Còn 2 bài luyện tập', b: 'Giải thêm 2 bài trong kho Luyện tập để nhận +40 XP hôm nay.', c: '#b8e9a6' },
  { ic: '12/14', sh: 'Streak', l3: 'còn 2 ngày', t: 'Giữ chuỗi thêm 2 ngày', b: 'Học ít nhất 1 bài mỗi ngày đến Chủ nhật để mở huy hiệu Streak 14 ngày.', c: '#ffb7c9' },
];
const notes = [];
function noteTex(n, i) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 148;
  const x = c.getContext('2d');
  x.fillStyle = n.c; x.fillRect(0, 10, 160, 138);
  const g = x.createLinearGradient(0, 10, 0, 148); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
  x.fillStyle = g; x.fillRect(0, 10, 160, 138);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.save(); x.translate(80, 12); x.rotate((i % 2 ? 1 : -1) * .06); x.fillRect(-34, -10, 68, 20); x.restore();   // tape
  x.fillStyle = '#2a1712'; x.textBaseline = 'top';
  x.font = '700 34px "Patrick Hand","Segoe Print","Comic Sans MS",cursive'; x.fillText(n.ic, 14, 34);
  x.font = '24px "Patrick Hand","Segoe Print","Comic Sans MS",cursive'; x.fillText(n.sh, 14, 78); x.fillText(n.l3, 14, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t;
}
function addStickyNotes() {
  const W = .075, H = W * 148 / 160;
  NOTES.forEach((n, i) => {
    const geo = new THREE.PlaneGeometry(W, H); geo.translate(0, -H / 2, 0);   // pivot on the taped top edge
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { map: { value: noteTex(n, i) }, uHi: { value: 0 }, ...light }, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: /* glsl */`uniform sampler2D map; uniform vec3 uAmb; uniform float uLamp, uHi; varying vec2 vUv;
        void main(){ vec4 t = texture2D(map, vUv); if (t.a < .5) discard;
          float l = .18 + dot(uAmb, vec3(.33)) * .75 + uLamp * .55;              // lit like the paper around it
          gl_FragColor = vec4(t.rgb * min(l, 1.15) * (1. + uHi * .25), 1.); }`,
    }));
    m.position.copy(B(-.12 + i * .17, -.158, .812));
    m.rotation.set(-.04, 0, (i % 2 ? 1 : -1) * .07);
    m.name = 'Note_' + i;
    scene.add(m);
    const it = { o: m, kind: 'note', label: `Ghi chú · ${n.t}`, body: n.b, dir: OUT, anim: 'note', base: m.position.clone(), rot: m.rotation.clone(), hover: 0, t: 9, i };
    m.userData.item = it; items.push(it); pickables.push(m); notes.push(it);
  });
}

/* ---------------- small live textures ---------------- */
function glassTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 128, 64, 0);
  [[0, .16], [.3, 0], [.56, 0], [.63, .12], [.74, 0], [1, .05]].forEach(([p, a]) => g.addColorStop(p, `rgba(255,255,255,${a})`));
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
const screen = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8;
  const CODE = ['# Đấu trường · FizzBuzz', 'def solve(n):', '    out = []', '    for i in range(1, n + 1):', '        if i % 15 == 0:', '            out.append("FizzBuzz")', '        elif i % 3 == 0:', '            out.append("Fizz")', '        else:', '            out.append(str(i))', '    return out'];
  const total = CODE.join('\n').length;
  let typed = -1, last = -1;
  function draw(time) {
    const n = Math.floor(time * 9) % (total + 40);               // type, hold, restart
    const blink = Math.floor(time * 2) % 2;
    if (n === typed && blink === last) return;
    typed = n; last = blink;
    x.fillStyle = '#121725'; x.fillRect(0, 0, 512, 320);
    x.fillStyle = '#1b2236'; x.fillRect(0, 0, 512, 30);
    ['#ff9db8', '#ffc97a', '#8be3a8'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(18 + i * 18, 15, 5, 0, 7); x.fill(); });
    x.font = '600 14px ui-monospace,Consolas,monospace'; x.fillStyle = '#d9e6ff'; x.fillText('solution.py · Đấu trường', 86, 20);
    x.font = '17px ui-monospace,Consolas,monospace';
    let left = Math.min(n, total), cx = 0, cy = 0;
    CODE.forEach((ln, i) => {
      x.fillStyle = '#6f7a96'; x.fillText(String(i + 1).padStart(2), 12, 58 + i * 21);
      const s = ln.slice(0, Math.max(0, left));
      if (left >= 0) { cx = 48 + x.measureText(s).width; cy = 58 + i * 21; }
      left -= ln.length + 1;
      x.fillStyle = /^\s*#/.test(ln) ? '#6f7a96' : /^\s*(def|for|if|elif|else|return)\b/.test(ln) ? '#ff9db8' : /"/.test(ln) ? '#8be3a8' : '#d9e6ff';
      x.fillText(s, 48, 58 + i * 21);
    });
    if (blink) { x.fillStyle = '#ffc97a'; x.fillRect(cx + 1, cy - 14, 8, 17); }
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
})();

/* ---------------- cheap ambience: a few Points draw calls + one light sheet ---------------- */
const pointsMat = (vert, frag, blending = THREE.AdditiveBlending) => new THREE.ShaderMaterial({ uniforms: fx, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending });
const softDot = /* glsl */`varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., 0., d); gl_FragColor = vec4(vC * a * a * vA, 1.); }`;
function points(posArr, phArr, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('aPh', new THREE.BufferAttribute(phArr, 1));
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  scene.add(p);
  return p;
}

function addFairyLights(bulbs) {   // every bulb in one draw call, each with its own slow twinkle
  const n = bulbs.length, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  bulbs.forEach((b, i) => { B(b[0], b[1], b[2]).toArray(pos, i * 3); ph[i] = Math.random(); });
  points(pos, ph, pointsMat(/* glsl */`
    attribute float aPh; uniform float uTime, uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
      float tw = .78 + .22 * sin(uTime * (.6 + aPh * .9) + aPh * 30.);
      vA = (.3 + .7 * uLamp) * tw; vC = vec3(1., .78, .42);
      gl_PointSize = uPx * .085 / -mv.z; gl_Position = projectionMatrix * mv; }`, softDot));
}

function addLampLight(led) {
  const a = Bv(led.a), b = Bv(led.b), down = Bv(led.down).normalize();
  const along = b.clone().sub(a).normalize();
  const deskY = 0.743;

  // 1) the diffuser glows: a short row of soft dots along the LED strip
  const n = 14, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { a.clone().lerp(b, (i + .5) / n).addScaledVector(down, .004).toArray(pos, i * 3); ph[i] = i / n; }
  points(pos, ph, pointsMat(/* glsl */`
    attribute float aPh; uniform float uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
      vA = uLamp * (.55 + .45 * sin(aPh * 3.1416)); vC = vec3(1., .86, .66);
      gl_PointSize = uPx * .05 / -mv.z; gl_Position = projectionMatrix * mv; }`, softDot));

  // 2) the light "volume": one sheet from the strip down to the desk, fading with distance and toward its sides
  const t0 = (a.y - deskY) / -down.y, t1 = (b.y - deskY) / -down.y;
  const spread = .16;
  const A1 = a.clone().addScaledVector(down, t0).addScaledVector(along, -spread);
  const B1 = b.clone().addScaledVector(down, t1).addScaledVector(along, spread);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...B1.toArray(), ...A1.toArray()], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const beam = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: fx, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uLamp, uTime;
      void main(){
        float across = sin(3.1416 * clamp(vUv.x, 0., 1.));
        float fall = pow(1. - vUv.y, 1.7) * smoothstep(0., .06, vUv.y);
        float breathe = .94 + .06 * sin(uTime * .35);
        float a = across * across * fall * .085 * uLamp * breathe;
        gl_FragColor = vec4(vec3(1., .83, .6) * a, 1.);
      }`,
  }));
  beam.renderOrder = 3;
  scene.add(beam);

  // 3) dust drifting slowly inside that beam
  const m = 26, dpos = new Float32Array(m * 3), dph = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const u = Math.random(), v = .15 + Math.random() * .75;
    const top = a.clone().lerp(b, u), bot = A1.clone().lerp(B1, u);
    top.lerp(bot, v).add(new THREE.Vector3(0, 0, (Math.random() - .5) * .12)).toArray(dpos, i * 3);
    dph[i] = Math.random();
  }
  points(dpos, dph, pointsMat(/* glsl */`
    attribute float aPh; uniform float uTime, uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec3 p = position; float t = uTime * (.04 + aPh * .04) + aPh * 6.283;
      p += vec3(sin(t * 1.3), sin(t) * .7 + .2, cos(t * .9)) * .035;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      vA = uLamp * .45 * (.5 + .5 * sin(t * 2.)); vC = vec3(1., .88, .66);
      gl_PointSize = uPx * .009 / -mv.z; gl_Position = projectionMatrix * mv; }`, softDot));
}

function addSteam(origin) {   // 5 soft wisps; they lean into the room when the window is open
  const n = 5, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { origin.toArray(pos, i * 3); ph[i] = i / n; }
  points(pos, ph, pointsMat(/* glsl */`
    attribute float aPh; uniform float uTime, uWind, uPx; varying float vA; varying vec3 vC;
    void main(){ float k = fract(uTime * .16 + aPh); vec3 p = position;
      p.y += k * .36; p.x += sin(k * 5. + aPh * 20.) * .03 * k + uWind * k * k * .22; p.z += uWind * k * k * .12;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      vA = smoothstep(0., .2, k) * smoothstep(1., .45, k) * .15; vC = vec3(1., .97, .93);
      gl_PointSize = uPx * (.08 + k * .16) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    /* glsl */`varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(vC, smoothstep(1., 0., d) * vA); }`,
    THREE.NormalBlending));
}

const outside = createOutside(scene, texLoader, CAM, { pos: CAM, target: LOOK, vfov: CAM2D.vfov, aspect: CAM2D.aspect });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  outside.setMode(b.dataset.view);
  document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));

/* ---------------- state + UI ---------------- */
let tod = 18, todTarget = 18, realTime = false, windowOpen = false, openK = 0, wind = 0, drift = 0;
window.__peSetTime = h => { tod = todTarget = h; };      // jump straight to an hour (handy for checking looks)
window.__peSetWeather = ({ rain, open } = {}) => {        // same, for rain / open window without the fade
  if (rain !== undefined) { rainOn = rain; rainK = rain ? 1 : 0; }
  if (open !== undefined) { setWindow(open); openK = wind = open ? 1 : 0; }
};
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
$('#tod').addEventListener('input', e => { todTarget = +e.target.value; realTime = false; $('#bReal').setAttribute('aria-pressed', 'false'); });
$('#bReal').addEventListener('click', () => { realTime = !realTime; $('#bReal').setAttribute('aria-pressed', String(realTime)); if (realTime) todTarget = nowH(); });
function setWindow(v) { windowOpen = v; $('#bWin').setAttribute('aria-pressed', String(v)); $('#bWin').textContent = v ? 'Đóng cửa sổ' : 'Mở cửa sổ'; }
$('#bWin').addEventListener('click', () => setWindow(!windowOpen));

// comparison tools: lamp mode, render style, wipe against the original 2D illustration
const LAMP_MODES = [['auto', 'Đèn: theo giờ'], ['on', 'Đèn: bật'], ['off', 'Đèn: tắt']];
let lampMode = 0, lampK = 1, styleTarget = 0;
$('#bLamp').addEventListener('click', () => {
  lampMode = (lampMode + 1) % 3;
  $('#bLamp').textContent = LAMP_MODES[lampMode][1];
  $('#bLamp').setAttribute('aria-pressed', String(lampMode !== 0));
});
document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => {
  styleTarget = +b.dataset.style;
  document.querySelectorAll('[data-style]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));
let comparing = false;
const wipe = v => { comparing = v > 0; document.documentElement.style.setProperty('--cut', v + '%'); $('#cutLine').style.opacity = v > 0 && v < 100 ? 1 : 0; };
$('#cmp2d').addEventListener('input', e => wipe(+e.target.value));
wipe(0);
let toastT;
function toast(s, ms = 1600) { const t = $('#toast'); t.textContent = s; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => t.style.opacity = 0, ms); }
let rainOn = false, rainK = 0;
$('#bRain').addEventListener('click', () => {
  rainOn = !rainOn;
  $('#bRain').setAttribute('aria-pressed', String(rainOn));
  $('#bRain').textContent = rainOn ? 'Tạnh mưa' : 'Mưa';
});

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(0, 0), par = new THREE.Vector2(0, 0);
let pointerIn = false, hot = null, pointerMoved = false;
const canvas = renderer.domElement, tip = $('#tip');
canvas.addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerIn = pointerMoved = true;
  tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
});
canvas.addEventListener('pointerleave', () => { pointerIn = false; mouse.set(0, 0); });
canvas.addEventListener('click', () => {
  if (!hot) return;
  if (hot.kind === 'window') { setWindow(!windowOpen); toast(windowOpen ? 'Mở cửa sổ · gió lùa vào' : 'Đóng cửa sổ'); return; }
  const group = hot.kind === 'trophy' ? items.filter(i => i.kind === 'trophy') : [hot];
  group.forEach((it, i) => it.t = -i * .08);
  toast(hot.kind === 'note' ? `${hot.label.replace('Ghi chú · ', '')} — ${hot.body}` : hot.label, hot.kind === 'note' ? 4200 : 1600);
});

/* ---------------- frame loop ---------------- */
const clock = new THREE.Clock();
let frames = 0, fpsT = 0, idleK = 1;
manager.onLoad = () => { const l = $('#load'); if (!l) return; l.style.opacity = 0; setTimeout(() => l.remove(), 900); };

function tick() {
  const dt = Math.min(.05, clock.getDelta()), time = clock.elapsedTime;
  fx.uTime.value = time;
  fx.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  // time of day eases toward its target the short way round the clock
  if (realTime) todTarget = nowH();
  const d = ((todTarget - tod + 36) % 24) - 12;
  tod = (tod + d * (1 - Math.exp(-2.2 * dt)) + 24) % 24;
  const o = sampleTOD(tod);
  rainK = damp(rainK, rainOn ? 1 : 0, .7, dt);
  light.uAmb.value.fromArray(o.amb).multiply(new THREE.Vector3(1 - .38 * rainK, 1 - .34 * rainK, 1 - .22 * rainK));   // overcast: dimmer, cooler daylight
  const mode = LAMP_MODES[lampMode][0];
  lampK = damp(lampK, mode === 'auto' ? o.lamp : mode === 'on' ? 1 : 0, 4, dt);   // lamp fades, never pops
  light.uLamp.value = lampK;
  post.uStyle.value = damp(post.uStyle.value, styleTarget, 5, dt);
  const H = Math.floor(tod), M = Math.floor((tod - H) * 60);
  $('#clock').textContent = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
  if (document.activeElement !== $('#tod')) $('#tod').value = tod;

  // window + wind ease in together; clouds only ever change speed gradually
  openK = damp(openK, windowOpen ? 1 : 0, 2.2, dt);
  wind = damp(wind, windowOpen ? 1 : 0, .8, dt);
  const e = openK * openK * (3 - 2 * openK);
  if (sashL) { sashL.rotation.y = e * 1.08; sashR.rotation.y = -e * 1.08; }
  fx.uWind.value = wind;
  if (!RM) drift += dt * (.0054 + wind * .019);
  outside.update(o, time, tod * .139 + drift, { rain: rainK, wind, px: fx.uPx.value });

  // camera: mouse parallax plus a very slow idle sway, all critically damped
  // while comparing with the 2D art the camera settles exactly on the solved pose
  const free = comparing ? 0 : 1;
  par.x = damp(par.x, mouse.x * free, 2.4, dt); par.y = damp(par.y, mouse.y * free, 2.4, dt);
  idleK = damp(idleK, RM ? 0 : free, 1.5, dt);
  camera.position.set(CAM.x + par.x * .22 + Math.sin(time * .17) * .025 * idleK, CAM.y + par.y * .09 + Math.sin(time * .23) * .012 * idleK, CAM.z);
  camera.lookAt(LOOK.x + par.x * .1, LOOK.y + par.y * .05, LOOK.z);

  // hover picking only when the pointer actually moved
  if (pointerMoved && pickables.length) {
    pointerMoved = false;
    ray.setFromCamera(mouse, camera);
    const hit = pointerIn ? ray.intersectObjects(pickables, false)[0] : null;
    const it = hit ? hit.object.userData.item : null;
    if (it !== hot) {
      hot = it;
      canvas.style.cursor = hot ? 'pointer' : '';
      tip.style.opacity = hot ? 1 : 0;
      if (hot) tip.textContent = hot.label;
    }
  }
  for (const it of items) {
    if (it.kind === 'window') continue;
    it.hover = damp(it.hover, it === hot ? 1 : 0, 9, dt);
    it.t += dt;
    const k = it.t > 0 ? Math.exp(-3.2 * it.t) : 0, s = Math.sin(it.t * 11) * k;       // decaying wobble after a click
    it.o.material.uniforms.uHi.value = it.hover;
    it.o.position.copy(it.base).addScaledVector(it.dir, it.hover * (it.kind === 'book' ? .045 : .018));
    it.o.rotation.copy(it.rot);
    if (it.anim === 'hop') it.o.position.y += Math.abs(s) * .03;
    else if (it.anim === 'buzz') it.o.rotation.y += Math.sin(it.t * 60) * k * .05;
    else if (it.anim === 'swingZ') it.o.rotation.z += s * .06;
    else if (it.anim === 'swingX') it.o.rotation.x += s * (it.kind === 'trophy' ? .25 : .03);
    else if (it.anim === 'spin') { it.o.rotation.y += s * .5; it.o.position.y += Math.abs(s) * .015; }
    else if (it.anim === 'slide') it.o.position.z += Math.abs(s) * .06;
    else if (it.anim === 'note') {                          // notes flutter in the breeze from the open window
      it.o.rotation.x += Math.sin(time * 5.5 + it.i * 1.7) * .22 * wind + Math.sin(time * 9 + it.i) * .05 * wind + s * .3;
      it.o.position.copy(it.base).addScaledVector(OUT, it.hover * .006);
    }
    if (it.kind === 'trophy') it.o.material.uniforms.uShine.value = it.t >= 0 && it.t < .9 ? it.t / .9 : -1;
  }
  screen.draw(time);

  renderer.info.reset();
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);

  frames++; fpsT += dt;
  if (fpsT >= .5) {
    const i = renderer.info;
    $('#stats').innerHTML = `<b>${Math.round(frames / fpsT)}</b> fps<br>draw calls <b>${i.render.calls}</b><br>tam giác <b>${(i.render.triangles / 1000).toFixed(1)}k</b><br>textures <b>${i.memory.textures}</b>`;
    frames = 0; fpsT = 0;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
addEventListener('visibilitychange', () => clock.getDelta());
