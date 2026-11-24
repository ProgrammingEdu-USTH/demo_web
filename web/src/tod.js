// Time-of-day keys. Colours are display-space hex; the dusk keys follow the reference (indigo top -> magenta -> orange horizon).
//  sky: 5 gradient stops top -> horizon     haze/hz: horizon glow colour + strength
//  cb/cr/cs: cloud body / sun-lit side / shadow side   ca: cloud opacity
//  al: light on the painted scenery outside (rgb multiplier)   win: share of lit house windows
//  star/moon/sun/day: feature visibility   lamp/city/amb: interior (baked lamp layer, fairy lights, daylight tint)
const K = [
  { h: 0,    sky: ['#060a20', '#0c1336', '#18204e', '#272c62', '#3a3772'], haze: '#3b3672', hz: .35, cb: '#252b58', cr: '#7a82c4', cs: '#121633', ca: .55, al: [.15, .17, .30], win: 1,   star: 1,  moon: 1,  sun: 0,   day: 0,  lamp: 1,   city: 1,   amb: [.035, .045, .11] },
  { h: 4.8,  sky: ['#111946', '#242f6a', '#4a4588', '#8c6aa0', '#d89c9c'], haze: '#d49aa2', hz: .55, cb: '#3d3f75', cr: '#d4a0b4', cs: '#20234d', ca: .65, al: [.30, .28, .42], win: .75, star: .5, moon: .5, sun: 0,   day: .1, lamp: 1,   city: .9,  amb: [.08, .08, .17] },
  { h: 6.3,  sky: ['#4a66b4', '#7d8fd0', '#c6aed8', '#f6c0b2', '#ffd29c'], haze: '#ffd0a0', hz: .8,  cb: '#dccae2', cr: '#ffd8a2', cs: '#8a86bf', ca: .85, al: [.85, .74, .72], win: .25, star: 0,  moon: 0,  sun: .75, day: .6, lamp: .4,  city: .35, amb: [.50, .42, .44] },
  { h: 8.5,  sky: ['#3a86de', '#5aa0ea', '#92c2f2', '#cfe2f6', '#eaf1f8'], haze: '#e4edf8', hz: .5,  cb: '#ffffff', cr: '#fff7ea', cs: '#a8b8da', ca: .95, al: [1, 1, 1],        win: 0,   star: 0,  moon: 0,  sun: .4,  day: 1,  lamp: 0,   city: 0,   amb: [.86, .86, .84] },
  { h: 12.5, sky: ['#3482e4', '#539eee', '#8cc0f4', '#cbe2f8', '#e6eff9'], haze: '#dde9f7', hz: .45, cb: '#ffffff', cr: '#ffffff', cs: '#a4b5d8', ca: .95, al: [1.05, 1.05, 1.04], win: 0,  star: 0,  moon: 0,  sun: .25, day: 1,  lamp: 0,   city: 0,   amb: [.95, .95, .95] },
  { h: 16.3, sky: ['#5a88d6', '#84a6de', '#c4b8dc', '#f2c8b4', '#ffd49c'], haze: '#ffd8a8', hz: .75, cb: '#fbeae2', cr: '#ffcf8a', cs: '#a294c4', ca: .9,  al: [1, .86, .74],     win: .1,  star: 0,  moon: 0,  sun: .6,  day: .85, lamp: .25, city: .15, amb: [.82, .68, .58] },
  { h: 18,   sky: ['#28296a', '#463884', '#894e94', '#e06e7c', '#ffa262'], haze: '#ff9c66', hz: 1,   cb: '#7c5a9c', cr: '#ffb06e', cs: '#3a2d6a', ca: 1,   al: [.40, .32, .45],   win: .85, star: .1, moon: 0,  sun: 0,   day: .25, lamp: 1,  city: .8,  amb: [.36, .27, .38] },
  { h: 19.6, sky: ['#121848', '#272866', '#583c82', '#a05886', '#e27a6e'], haze: '#d8746e', hz: .75, cb: '#463b76', cr: '#f08c70', cs: '#211d48', ca: .9,  al: [.22, .20, .36],   win: 1,   star: .6, moon: .4, sun: 0,   day: 0,  lamp: 1,   city: 1,   amb: [.12, .11, .22] },
  { h: 21.5, sky: ['#060a20', '#0c1336', '#18204e', '#272c62', '#3a3772'], haze: '#3b3672', hz: .35, cb: '#252b58', cr: '#7a82c4', cs: '#121633', ca: .55, al: [.15, .17, .30], win: 1,   star: 1,  moon: 1,  sun: 0,   day: 0,  lamp: 1,   city: 1,   amb: [.035, .045, .11] },
  { h: 24,   sky: ['#060a20', '#0c1336', '#18204e', '#272c62', '#3a3772'], haze: '#3b3672', hz: .35, cb: '#252b58', cr: '#7a82c4', cs: '#121633', ca: .55, al: [.15, .17, .30], win: 1,   star: 1,  moon: 1,  sun: 0,   day: 0,  lamp: 1,   city: 1,   amb: [.035, .045, .11] },
];
// cloud colours of the 2D version (its painted cloud band), per key above: body, sun-lit rim, body opacity, rim opacity
const PE_CLOUD = [['#262a52', '#3c3f74', .8, .5], ['#36335f', '#9a7898', .75, .45], ['#ae96c4', '#ffd8c2', .8, .75], ['#f7f9fd', '#c8d5ea', .9, .55],
  ['#ffffff', '#c3d1e8', .92, .6], ['#efe3ee', '#e9b6ae', .88, .6], ['#a07aae', '#f0c0bc', .95, .55], ['#574780', '#cf96a6', .85, .42],
  ['#262a52', '#3c3f74', .8, .5], ['#262a52', '#3c3f74', .8, .5]];
K.forEach((k, i) => { [k.pcb, k.pcr, k.pca, k.pra] = PE_CLOUD[i]; });
const hx = c => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
for (const k of K) for (const f in k) {
  if (f === 'sky') k.sky = k.sky.map(hx);
  else if (typeof k[f] === 'string') k[f] = hx(k[f]);
}

const mix = (a, b, t) => a + (b - a) * t;
const mixV = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

/** Sample the keys at hour h (0..24). Positions are in window space: x 0..1 left->right, y 0..1 top->bottom. */
export function sampleTOD(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < K.length - 2 && K[i + 1].h <= h) i++;
  const A = K[i], B = K[i + 1];
  const t = Math.min(1, Math.max(0, (h - A.h) / (B.h - A.h))), s = t * t * (3 - 2 * t);
  const o = { h };
  for (const k in A) {
    if (k === 'h') continue;
    o[k] = k === 'sky' ? A.sky.map((c, j) => mixV(c, B.sky[j], s)) : Array.isArray(A[k]) ? mixV(A[k], B[k], s) : mix(A[k], B[k], s);
  }
  const mp = (h >= 18 ? h - 18 : h + 6) / 12;                  // moon arc 18h -> 6h
  o.moonPos = [.14 + mp * .72, .52 - Math.sin(mp * Math.PI) * .40];
  const sp = Math.min(1, Math.max(0, (h - 5.6) / 13));          // sun arc 5.6h -> 18.6h
  o.sunPos = [.08 + sp * .84, .80 - Math.sin(sp * Math.PI) * .66];
  return o;
}
