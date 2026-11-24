import{V as U,g as Se,c as xt,a as H,h as re,I as Zt,B as xe,i as te,j as Ue,P as zt,A as Pe,M as qe,k as Yt,l as Jt,R as Qt,N as Te,b as Oe,W as ea,S as Dt,m as ta,D as aa,n as oa,L as na,T as ia,G as ra,o as yt,p as lt,F as wt,q as la,r as sa,e as st,d as ca,s as ua,t as va}from"./tod-BhWImzVK.js";let Qe=0,et=1.38,tt=3.55;const da=-.02,ve={x0:-.83,x1:.83,y0:.86,y1:2.62},ye=ve.x1-ve.x0,Le=ve.y1-ve.y0,at=e=>(tt-e)/(tt-da),J=(e,t,a)=>{const n=at(a);return new U(Qe+(ve.x0+e*ye-Qe)*n,et+(ve.y1-t*Le-et)*n,a)};function Ft(e){let t=e>>>0;const a=()=>(t=t*1664525+1013904223>>>0)/4294967296;return a.range=(n,o)=>n+(o-n)*a(),a.pick=n=>n[Math.floor(a()*n.length)],a}const N=(e,t)=>{const a=document.createElement("canvas");return a.width=e,a.height=t,a};function de(e){const t=new Oe(e);return t.colorSpace=Te,t.anisotropy=4,t.generateMipmaps=!0,t}const X=(e,t)=>{const a=parseInt(e.slice(1),16),n=o=>Math.max(0,Math.min(255,Math.round(o*t)));return`rgb(${n(a>>16)},${n(a>>8&255)},${n(a&255)})`},bt=`
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }`,fa=`varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;function pa(){const a=N(1024,1024),n=N(512*2,512*2),o=a.getContext("2d"),s=n.getContext("2d"),d=Ft(4242);[[.86,.92,26,.16,"tower"],[.94,.5,22,.13,"wide"],[.62,.44,12,.15,"puff"],[.98,.3,26,.09,"bank"]].forEach(([l,p,x,M,C],T)=>{const G=T%2*512,$=Math.floor(T/2)*512,I=G+512/2,B=$+512*.88,q=512*l/2,z=512*p*.86,D=m=>{const A=Math.min(1,Math.abs(m));return C==="tower"?z*Math.pow(Math.max(0,1-A*A),.55)*(A<.35?1:.62+.38*(1-A)):C==="bank"?z*(.55+.45*Math.sin(m*7.3+1.1)*.5+.3)*Math.pow(Math.max(0,1-A*A),.4):z*Math.pow(Math.max(0,1-A*A),.7)},h=[];for(let m=0;m<x;m++){const A=(d()*2-1)*Math.pow(d(),.35)*(d()<.5?-1:1),_=D(A),L=512*M*d.range(.7,1.25)*(1-.35*Math.abs(A)),ae=B-L*.55-d()*Math.max(0,_-L*1.4);h.push({x:I+A*q*.92,y:ae,r:L})}for(let m=0;m<=18;m++){const A=-1+2*m/18+d.range(-.04,.04),_=D(A);if(_<512*.04)continue;const L=512*M*d.range(.75,1.1)*(C==="tower"&&Math.abs(A)<.4?1.25:1);h.push({x:I+A*q*.9,y:B-_+L*.85,r:L})}h.sort((m,A)=>A.y-m.y),s.save(),o.save();for(const m of[s,o])m.beginPath(),m.rect(G,$,512,B-$+512*.01),m.clip();s.fillStyle="#fff";for(const m of h)s.beginPath(),s.arc(m.x,m.y,m.r,0,7),s.fill();for(const m of h){const A=m.x+m.r*.35,_=m.y-m.r*.42,L=o.createRadialGradient(A,_,0,A,_,m.r*1.45);L.addColorStop(0,"#fff"),L.addColorStop(.5,"#e6e6e6"),L.addColorStop(.82,"#a8a8a8"),L.addColorStop(1,"#8c8c8c"),o.fillStyle=L,o.beginPath(),o.arc(m.x,m.y,m.r,0,7),o.fill()}o.globalCompositeOperation="multiply";const w=B-z,F=o.createLinearGradient(I+q*.5,w,I-q*.6,B);F.addColorStop(0,"#fff"),F.addColorStop(.45,"#e2e2e2"),F.addColorStop(.8,"#8e8e8e"),F.addColorStop(1,"#5a5a5a"),o.fillStyle=F,o.fillRect(G,$,512,512),o.globalCompositeOperation="source-over",s.restore(),o.restore()});const v=N(512*2,512*2),i=v.getContext("2d");i.filter="blur(7px)",i.drawImage(n,0,0);const g=N(512*2,512*2),y=g.getContext("2d");y.filter="blur(1.2px)",y.drawImage(n,0,0);const b=y.getImageData(0,0,512*2,512*2).data,W=i.getImageData(0,0,512*2,512*2).data,R=o.getImageData(0,0,512*2,512*2).data,S=N(512*2,512*2),r=S.getContext("2d"),c=r.createImageData(512*2,512*2),u=c.data;for(let l=0;l<u.length;l+=4)u[l]=R[l],u[l+1]=Math.max(0,Math.min(255,(b[l+3]-W[l+3])*2.6)),u[l+2]=0,u[l+3]=b[l+3];return r.putImageData(c,0,0),de(S)}const ma=["#efe2cc","#e8d4c0","#d6e0ea","#f0d6cf","#e4ddef","#d8cfc2","#f4ebd8","#c8d8dc","#e9cfb4"],ha=["#8a3a3c","#56688c","#7a4c38","#3e4e6a","#9a5842","#4c5c4c","#6a4a6c","#a0603e"],_t=["#3c6a3a","#4b7c42","#5c9050","#2e5430","#66a058","#3f7748"];function ga(e,t,a,n,o,s,d){const f=Math.round(o*((n-a)*Le)/((t-e)*ye)),v=N(o,f),i=N(o,f),g=v.getContext("2d"),y=i.getContext("2d"),b=r=>(r-e)/(t-e)*o,W=r=>(r-a)/(n-a)*f,R=o/(t-e),S={A:g,X:y,W:o,H:f,U:b,V:W,wpx:R,R:Ft(d),fill(r,c,u="#000"){for(const[l,p]of[[g,c],[y,u]])l.fillStyle=p,l.beginPath(),r(l),l.fill()},rect(r,c,u,l,p,x){S.fill(M=>M.rect(r,c,u,l),p,x)},poly(r,c,u){S.fill(l=>{l.moveTo(r[0][0],r[0][1]);for(const p of r.slice(1))l.lineTo(p[0],p[1]);l.closePath()},c,u)},circle(r,c,u,l,p){S.fill(x=>x.arc(r,c,u,0,7),l,p)},line(r,c,u,l){for(const[p,x]of[[g,u],[y,"#000"]]){if(p.strokeStyle=x,p.lineWidth=c,p.lineCap="round",p.beginPath(),p.moveTo(r[0][0],r[0][1]),l)p.quadraticCurveTo(l[0],l[1],r[1][0],r[1][1]);else for(const M of r.slice(1))p.lineTo(M[0],M[1]);p.stroke()}}};return s(S),{alb:de(v),aux:de(i)}}function St(e,t,a,n){const o=e.R;e.rect(t-n*.05,a-n*.55,n*.1,n*.6,"#4a3a30");const s=[];for(let f=0;f<9;f++)s.push([t+o.range(-.42,.42)*n,a-n*o.range(.6,1.25),n*o.range(.22,.36)]);s.sort((f,v)=>v[1]-f[1]);const d=o.pick(_t);for(const[f,v,i]of s)e.circle(f,v,i,X(d,.82),"rgb(0,0,255)"),e.circle(f+i*.22,v-i*.25,i*.62,d,"rgb(0,0,255)"),e.circle(f+i*.34,v-i*.4,i*.28,X(d,1.22),"rgb(0,0,255)")}function xa(e,t,a,n,o){const s=e.R,d=e.H,f=s.pick(ma),v=s.pick(ha),i=a*s.range(.24,.4),g=n+i,y=t+a/2,b=a*.07,W=s()<.6;if(s()<.55){const c=t+a*s.range(.15,.3);e.rect(c,n+i*.1,a*.08,i*.9,X(v,.75)),e.rect(c-a*.01,n+i*.06,a*.1,a*.025,X(v,.6))}if(e.rect(t,g,a,d-g,f),e.rect(t+a*.84,g,a*.16,d-g,X(f.replace("rgb",""),1)&&X(f,.86)),W){if(e.poly([[t-b,g+a*.02],[y,n-a*.02],[t+a+b,g+a*.02]],v),e.poly([[t+a*.07,g+a*.01],[y,n+i*.2],[t+a*.93,g+a*.01]],f),s()<.7){const c=a*.12,u=n+i*.5,l=s()<o;e.rect(y-c/2-2,u-2,c+4,c*1.1+4,"#efe8dc"),e.rect(y-c/2,u,c,c*1.1,l?"#3d4a63":"#2f3a50",l?`rgb(255,${s()*255|0},0)`:"#000")}}else{e.poly([[t-b,g+a*.02],[t+a*.2,n],[t+a*.8,n],[t+a+b,g+a*.02]],v);for(let c=1;c<4;c++){const u=n+i*c/4;e.rect(t+a*(.2-.27*c/4),u,a*(.6+.54*c/4),Math.max(1,a*.008),X(v,.8))}}e.rect(t-b,g,a+b*2,a*.028,X(v,.55));const R=a>e.wpx*.2?3:2,S=a*(R===3?.16:.2),r=S*1.25;for(let c=g+a*.12;c<d-r;c+=r*2.2)for(let u=0;u<R;u++){const l=t+a*((u+.5)/R)-S/2,p=s()<o;e.rect(l-3,c-3,S+6,r+6,"#ece4d6"),e.rect(l,c,S,r,p?"#3e4b66":"#2c374d",p?`rgb(255,${s()*255|0},0)`:"#000"),e.rect(l+S/2-1,c,2,r,"#ece4d6"),s()<.4&&e.rect(l,c,S*.32,r,"#b8a48a",p?"rgb(150,0,0)":"#000"),e.rect(l-4,c+r+2,S+8,4,"#d9cfbf")}}function ya(e){const t=e.R,a=["#8f8aa6","#a39cb6","#8a93ad","#9a8fa0"];for(let d=-40;d<e.W;d+=e.wpx*t.range(.05,.09)){const f=e.wpx*t.range(.06,.1),v=e.V(t.range(.56,.62)),i=t.pick(a);e.rect(d,v+f*.25,f,e.H,X(i,1.1)),e.poly([[d-f*.06,v+f*.27],[d+f*.5,v],[d+f*1.06,v+f*.27]],i),t()<.6&&e.rect(d+f*.35,v+f*.42,f*.14,f*.16,"#6f6a84",t()<.5?`rgb(255,${t()*255|0},0)`:"#000")}for(let d=-40;d<e.W;d+=e.wpx*t.range(.04,.1)){const f=e.wpx*t.range(.025,.05),v=e.V(t.range(.6,.66));for(let i=0;i<3;i++)e.circle(d+i*f*.8,v-t()*f*.6,f,"#6d7a8a","rgb(0,0,255)")}const n=e.U(.2),o=e.V(.5);e.rect(n-3,o,6,e.V(.62)-o,"#7f7a92"),e.rect(n+e.wpx*.04-3,o,6,e.V(.62)-o,"#7f7a92"),e.fill(d=>d.ellipse(n+e.wpx*.02,o,e.wpx*.035,e.wpx*.02,0,0,7),"#8a84a0");const s=e.U(.83);e.poly([[s-e.wpx*.012,e.V(.6)],[s,e.V(.46)],[s+e.wpx*.012,e.V(.6)]],"#857f99"),e.rect(s-e.wpx*.02,e.V(.56),e.wpx*.04,e.H,"#938ca6")}function Ct(e,t){const a=e.R;let n=-a()*e.wpx*t.wMax;for(;n<e.W;){const o=e.wpx*a.range(t.wMin,t.wMax);a()<t.trees&&St(e,n+o*.3,e.V(t.ridge+.12),e.wpx*a.range(.12,.2)),xa(e,n,o,e.V(t.ridge+a.range(-t.var,t.var)),t.lit),a()<t.trees*.8&&St(e,n+o+e.wpx*.02,e.V(t.ridge+.2),e.wpx*a.range(.1,.18)),n+=o+e.wpx*a.range(.02,.07)}for(let o=-20;o<e.W;o+=e.wpx*.05){const s=e.wpx*a.range(.03,.05);e.circle(o,e.V(t.hedge)+s*.3,s,a.pick(_t),"rgb(0,0,255)")}e.rect(0,e.V(t.hedge)+e.wpx*.02,e.W,e.H,"#3a4038")}function wa(e){const t=e.R,a=[.06,.74,1.4].map(i=>e.U(i)),n=e.V(-.06),o=e.wpx*.014,s=[e.V(.03),e.V(.1)],d="#2b2630",f=[];a.forEach((i,g)=>{e.rect(i-o/2,n,o,e.H-n,d);const y=[];for(const b of s){e.rect(i-e.wpx*.075,b,e.wpx*.15,o*.8,d);for(const W of[-.065,-.025,.025,.065])e.rect(i+W*e.wpx-2,b-7,4,7,"#6a6470"),y.push([i+W*e.wpx,b-6])}f.push(y),g===1&&(e.fill(b=>b.roundRect(i+o,e.V(.2),e.wpx*.045,e.wpx*.07,6),"#4a4652"),e.rect(i+o,e.V(.2)+e.wpx*.012,e.wpx*.045,3,"#5c5864")),g===0&&(e.rect(i,e.V(.32),e.wpx*.09,o*.6,d),e.fill(b=>b.ellipse(i+e.wpx*.09,e.V(.32)+8,e.wpx*.025,7,0,0,7),"#3a3540"),e.fill(b=>b.ellipse(i+e.wpx*.09,e.V(.32)+12,e.wpx*.018,4,0,0,7),"#fff1c8","rgb(255,128,0)"))});for(let i=0;i<f.length-1;i++)f[i].forEach((g,y)=>{const b=f[i+1][y],W=e.wpx*t.range(.06,.1);e.line([g,b],2.2,"#26222a",[(g[0]+b[0])/2,Math.max(g[1],b[1])+W])});f[0].slice(0,3).forEach((i,g)=>e.line([i,[-10,i[1]+e.wpx*(.05+g*.02)]],2.2,"#26222a",[i[0]*.5,i[1]+e.wpx*.08]));const v=f[1][5];e.line([v,[e.U(1.05),e.V(.55)]],1.8,"#26222a",[e.U(.9),e.V(.4)])}function ba(){const e=N(256,384),t=e.getContext("2d"),a=()=>{t.beginPath(),t.moveTo(128,300),t.bezierCurveTo(60,250,18,180,22,118),t.arc(128,118,106,Math.PI,0),t.bezierCurveTo(238,180,196,250,128,300),t.closePath()};t.save(),a(),t.clip();const n=["#e2524a","#f6c544","#3fb0a8","#f2efe6","#e2524a","#f6c544","#3fb0a8"];for(let s=7;s>=1;s--)t.fillStyle=n[s-1],t.beginPath(),t.ellipse(128,170,108*s/7,190,0,0,7),t.fill();const o=t.createRadialGradient(92,80,10,128,150,190);o.addColorStop(0,"rgba(255,255,255,.35)"),o.addColorStop(.5,"rgba(0,0,0,0)"),o.addColorStop(1,"rgba(20,10,40,.45)"),t.fillStyle=o,t.fillRect(0,0,256,384),t.restore(),t.strokeStyle="#5a4030",t.lineWidth=2;for(const[s,d]of[[104,112],[152,144],[118,120],[138,136]])t.beginPath(),t.moveTo(s,296),t.lineTo(d,336),t.stroke();return t.fillStyle="#8a5a34",t.fillRect(108,334,40,30),t.fillStyle="#6a4226",t.fillRect(108,334,40,5),de(e)}function Sa(e,t,a,n){a&&(Qe=a.x,et=a.y,tt=a.z);const o={uTime:{value:0},uDrift:{value:0},uRain:{value:0},uWind:{value:0},uPx:{value:800},uSky:{value:[0,1,2,3,4].map(()=>new U)},uHaze:{value:new U},uHz:{value:0},uCb:{value:new U},uCr:{value:new U},uCs:{value:new U},uCa:{value:1},uAl:{value:new U(1,1,1)},uWin:{value:0},uStar:{value:0},uMoon:{value:0},uSun:{value:0},uDay:{value:0},uMoonPos:{value:new Se},uSunPos:{value:new Se},uPcb:{value:new U},uPcr:{value:new U},uPca:{value:1},uPra:{value:1}},s=(r,c,u,l,p=e)=>{const x=new qe(r,c);return x.renderOrder=u,x.frustumCulled=!1,l&&x.position.copy(l),p.add(x),x},d=new xt,f=new xt;e.add(d,f);const v=(r,c,u,l,p)=>{const x=J(c,l,r),M=J(u,p,r);return{geo:new re(M.x-x.x,x.y-M.y),pos:new U((x.x+M.x)/2,(x.y+M.y)/2,r)}},i=r=>{const c=J(0,0,r),u=J(1,1,r);return new Yt(c.x,c.y,u.x-c.x,c.y-u.y)};{const c=v(-9.5,-1.2,2.2,-.9,1.6);s(c.geo,new H({uniforms:{...o,uRect:{value:i(-9.5)}},depthWrite:!1,vertexShader:fa,fragmentShader:`
        varying vec3 vW;
        uniform vec4 uRect; uniform vec3 uSky[5], uHaze, uCb, uCr, uCs; uniform vec2 uMoonPos, uSunPos;
        uniform float uHz, uStar, uMoon, uSun, uDay, uTime, uDrift, uRain;
        ${bt}
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
          vec2 asp = vec2(1., ${(Le/ye).toFixed(3)});

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
        }`}),-20,c.pos)}const g=pa();{const r=[[.2,.6,1.1,3,-9.2,.5,.3],[.85,.62,1,3,-9.15,.45,.3],[.72,.62,.85,0,-9,.35,.16],[.12,.55,.7,1,-8.9,.55,.18],[1.45,.58,.75,0,-9,.35,.16],[.42,.36,.36,2,-8.7,.8,.1],[.95,.3,.32,2,-8.6,.9,.08],[-.05,.24,.3,2,-8.5,1,.08],[.55,.2,.5,1,-8.4,.7,.06],[-.45,.45,.5,1,-8.6,.6,.12]],c=new re(1,1),u=new Zt;u.index=c.index,u.attributes.position=c.attributes.position,u.attributes.uv=c.attributes.uv;const l=r.length,p=new Float32Array(l*3),x=new Float32Array(l),M=new Float32Array(l),C=new Float32Array(l),T=new Float32Array(l),G=new Float32Array(l),$=new Float32Array(l);r.forEach(([B,q,z,D,h,w,F],m)=>{const A=J(B,q,h),_=at(h);A.toArray(p,m*3),x[m]=z*ye*_,M[m]=D,C[m]=w,T[m]=ye*_*2.6,G[m]=J(.5,.5,h).x,$[m]=F});const I=(B,q)=>new Jt(B,q);u.setAttribute("iBase",I(p,3)),u.setAttribute("iSize",I(x,1)),u.setAttribute("iTile",I(M,1)),u.setAttribute("iSpeed",I(C,1)),u.setAttribute("iSpan",I(T,1)),u.setAttribute("iCx",I(G,1)),u.setAttribute("iFog",I($,1)),u.instanceCount=l,s(u,new H({uniforms:{...o,tCloud:{value:g}},transparent:!0,depthWrite:!1,vertexShader:`
        attribute vec3 iBase; attribute float iSize, iTile, iSpeed, iSpan, iCx, iFog;
        uniform float uDrift; varying vec2 vUv; varying float vTile, vFog;
        void main(){
          float x = mod(iBase.x - iCx + uDrift * iSpeed * iSpan * .5 + iSpan * .5, iSpan) - iSpan * .5 + iCx;
          vec3 p = vec3(x, iBase.y + iSize * .38, iBase.z) + vec3(position.xy * iSize, 0.);
          vUv = uv; vTile = iTile; vFog = iFog;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
        }`,fragmentShader:`
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
        }`}),-19,null,d)}const y=(()=>{const c=at(-8),u=.22*Le*c,l=u*256/384;return{m:s(new re(l,u),new H({uniforms:{...o,map:{value:ba()}},transparent:!0,depthWrite:!1,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",fragmentShader:`uniform sampler2D map; uniform vec3 uAl, uHaze; uniform float uDay, uRain; varying vec2 vUv;
        void main(){ vec4 t = texture2D(map, vUv); vec3 c = mix(t.rgb * uAl, uHaze, .18); gl_FragColor = vec4(c, t.a * uDay * (1. - uRain)); }`}),-18),z:-8}})();(()=>{const u=new Float32Array(21),l=new Float32Array(7);for(let M=0;M<7;M++){const C=M%2?1:-1,T=Math.ceil(M/2);u.set([-T*.045,C*T*.03,0],M*3),l[M]=Math.random()}const p=new xe;p.setAttribute("position",new te(u,3)),p.setAttribute("aPh",new te(l,1));const x=new Ue(p,new H({uniforms:{...o,uRect:{value:i(-6.5)},uZ:{value:-6.5}},transparent:!0,depthWrite:!1,vertexShader:`
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
        }`,fragmentShader:`
        uniform vec3 uAl; varying float vFlap, vA;
        float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
        void main(){
          vec2 q = (gl_PointCoord - .5) * 2.; q.y = -q.y;
          float f = vFlap * .45;
          float d = min(seg(q, vec2(-.8, f), vec2(0., -.12)), seg(q, vec2(0., -.12), vec2(.8, f)));
          float a = smoothstep(.13, .06, d) * vA;
          if (a < .01) discard;
          gl_FragColor = vec4(vec3(.16, .17, .22) * (.6 + .4 * uAl), a);
        }`}));x.frustumCulled=!1,x.renderOrder=-17,e.add(x)})();const b=(r,c)=>new H({uniforms:{...o,tAlb:{value:r.alb},tAux:{value:r.aux},uFog:{value:c}},transparent:!0,depthWrite:!1,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",fragmentShader:`
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
      }`});[{z:-7.4,u:[-.5,1.5],v:[.4,1.2],px:1536,fog:.45,seed:11,draw:r=>ya(r)},{z:-5.8,u:[-.55,1.55],v:[.46,1.25],px:2048,fog:.22,seed:29,draw:r=>Ct(r,{ridge:.64,var:.03,wMin:.12,wMax:.2,lit:.55,trees:.5,hedge:1.05})},{z:-4.4,u:[-.6,1.6],v:[.56,1.3],px:2048,fog:.06,seed:57,draw:r=>Ct(r,{ridge:.74,var:.04,wMin:.19,wMax:.28,lit:.6,trees:.4,hedge:1})},{z:-3.2,u:[-.7,1.7],v:[-.12,1.35],px:2048,fog:0,seed:83,draw:r=>wa(r)}].forEach((r,c)=>{const u=ga(r.u[0],r.u[1],r.v[0],r.v[1],r.px,r.draw,r.seed),l=v(r.z,r.u[0],r.u[1],r.v[0],r.v[1]);s(l.geo,b(u,r.fog),-16+c,l.pos,d)});{const c=v(-.7,-.2,1.2,-.1,1.1);s(c.geo,new H({uniforms:o,transparent:!0,depthWrite:!1,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",fragmentShader:`
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
        }`}),-10,c.pos)}{const c=new Float32Array(120),u=new Float32Array(40);for(let x=0;x<40;x++)J(.1+Math.random()*.8,.1+Math.random()*.7,-.25).toArray(c,x*3),u[x]=Math.random();const l=new xe;l.setAttribute("position",new te(c,3)),l.setAttribute("aPh",new te(u,1));const p=new Ue(l,new H({uniforms:o,transparent:!0,depthWrite:!1,vertexShader:`
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
        }`,fragmentShader:`
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
        }`}));p.frustumCulled=!1,p.renderOrder=5,e.add(p)}if(n){let q=function(z,D){const h=N(z.width,z.height),w=h.getContext("2d");return w.drawImage(z,0,0),w.globalCompositeOperation="source-in",w.fillStyle=D,w.fillRect(0,0,h.width,h.height),h};const u=new zt(n.vfov,n.aspect,.05,100);u.position.copy(n.pos),u.lookAt(n.target),u.updateMatrixWorld();const l=u.getWorldDirection(new U),p=(z,D,h)=>{const w=new U(z/2752*2-1,1-D/1536*2,.5).unproject(u).sub(u.position).normalize();return u.position.clone().addScaledVector(w,h/w.dot(l))},x=(z,D,h,w,F,m,A)=>{const _=p(z,D,F),L=p(h,D,F),ae=p(z,w,F),ke=p(h,w,F),Z=s(new re(_.distanceTo(L),_.distanceTo(ae)),m,A,_.clone().add(ke).multiplyScalar(.5),f);return Z.quaternion.copy(u.quaternion),Z},M="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",C={x0:1036,y0:158,x1:1842,y1:1088},T={x0:1046,y0:162,w:788,h:606},G=z=>{const D=t.load(`/assets/${z}.png`);return D.wrapS=Qt,D.colorSpace=Te,D},$=T.x0-900,I=T.x0+T.w+900;x($,T.y0,I,T.y0+T.h,10.5,new H({uniforms:{...o,tBody:{value:G("cloud-body")},tLight:{value:G("cloud-light")}},transparent:!0,depthWrite:!1,vertexShader:M,fragmentShader:`
        uniform sampler2D tBody, tLight; uniform vec3 uPcb, uPcr, uHaze; uniform float uPca, uPra, uDrift, uRain; varying vec2 vUv;
        void main(){
          float px = mix(${$.toFixed(1)}, ${I.toFixed(1)}, vUv.x) - ${T.x0.toFixed(1)};
          vec2 uv = vec2(px / 648. + uDrift * 1.1, vUv.y);
          float b = texture2D(tBody, uv).a, l = texture2D(tLight, uv).a;
          float b2 = texture2D(tBody, vec2(px / 648. * .7 + uDrift * .6 + .37, vUv.y * .85 + .08)).a;   // fainter, slower band behind
          vec3 c = mix(uPcb, uPcr, clamp(l * uPra * 1.3, 0., 1.));
          float a = clamp(max(b * uPca, b2 * uPca * .35) + l * uPra * .4, 0., 1.);
          c = mix(c, uHaze, (1. - step(.02, b)) * .3);
          float g = dot(c, vec3(.3, .59, .11));
          c = mix(c, vec3(g) * vec3(.74, .78, .88), uRain * .6);
          gl_FragColor = vec4(c, min(1., a * mix(1., 1.2, uRain)));
        }`}),-19);const B=new H({uniforms:{...o,tPlate:{value:null},tGlow:{value:null}},transparent:!0,depthWrite:!1,vertexShader:M,fragmentShader:`
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
        }`});x(C.x0,C.y0,C.x1,C.y1,5.4,B,-12),Promise.all(["pe-room.webp","sky-mask.png"].map(z=>new Promise(D=>{const h=new Image;h.onload=()=>D(h),h.src=`/assets/${z}`}))).then(([z,D])=>{const h=C.x1-C.x0,w=C.y1-C.y0,F=N(h,w),m=F.getContext("2d",{willReadFrequently:!0});m.drawImage(z,C.x0,C.y0,h,w,0,0,h,w),m.drawImage(F,26,640,2,w-640,0,640,26,w-640),m.drawImage(F,h-90,850,2,w-850,h-88,850,88,w-850);const A=N(h,w),_=A.getContext("2d",{willReadFrequently:!0});_.fillStyle="#fff",_.fillRect(0,0,h,T.y0-C.y0),_.fillRect(0,0,T.x0-C.x0,T.y0-C.y0+T.h),_.fillRect(T.x0-C.x0+T.w,0,h,T.y0-C.y0+T.h),_.drawImage(D,T.x0-C.x0,T.y0-C.y0);const L=N(h,w),ae=L.getContext("2d",{willReadFrequently:!0});ae.filter="blur(7px)",ae.drawImage(A,0,0);const ke=m.getImageData(0,0,h,w),Z=ke.data,Gt=_.getImageData(0,0,h,w).data,jt=ae.getImageData(0,0,h,w).data,Ge=new Uint8ClampedArray(h*w);for(let V=0,mt=0;V<Z.length;V+=4,mt++){const je=Z[V],ht=Z[V+1],Ke=Z[V+2],Kt=(.3*je+.59*ht+.11*Ke)/255,Xt=Gt[V+3]/255,gt=jt[V+3]/255;let Xe=1-Xt;if(gt>.03&&gt<.97){const Ze=Math.min(1,Math.max(0,(.69-Kt)/.12));Xe=Ze*Ze*(3-2*Ze)}Z[V+3]=Math.round(Xe*255),je>185&&ht>150&&Ke<175&&je-Ke>55&&Xe>.5&&(Ge[mt]=255)}m.putImageData(ke,0,0);const ft=N(h,w),Y=ft.getContext("2d"),ze=N(h,w),pt=ze.getContext("2d"),me=pt.createImageData(h,w);for(let V=0;V<Ge.length;V++)me.data[V*4]=me.data[V*4+1]=me.data[V*4+2]=255,me.data[V*4+3]=Ge[V];pt.putImageData(me,0,0),Y.fillStyle="#000",Y.fillRect(0,0,h,w),Y.globalCompositeOperation="lighter",Y.filter="blur(1.5px)",Y.drawImage(q(ze,"#ff0000"),0,0),Y.filter="blur(16px)",Y.drawImage(q(ze,"#00ff00"),0,0),Y.drawImage(q(ze,"#00ff00"),0,0),B.uniforms.tPlate.value=de(F),B.uniforms.tGlow.value=de(ft)}),x(C.x0-300,640,C.x1+300,C.y1,5.2,new H({uniforms:o,transparent:!0,depthWrite:!1,vertexShader:M,fragmentShader:`
        uniform vec3 uHaze, uSky[5]; uniform float uTime, uRain, uStar; varying vec2 vUv;
        ${bt}
        void main(){
          float n = fbm(vec2(vUv.x * 4. + uTime * .012, vUv.y * 5. - uTime * .004));
          float n2 = fbm(vec2(vUv.x * 7. - uTime * .02, vUv.y * 9.) + 4.);
          float band = smoothstep(.0, .35, 1. - vUv.y) * smoothstep(1., .55, 1. - vUv.y);
          float a = smoothstep(.42, .78, n * .7 + n2 * .4) * band * mix(.2, .38, uRain) * mix(1., .6, uStar);
          gl_FragColor = vec4(mix(uHaze, uSky[4], .5), a);
        }`}),-11);{const D=new Float32Array(54),h=new Float32Array(18);for(let m=0;m<18;m++)p(1080+Math.random()*720,820+Math.random()*230,5).toArray(D,m*3),h[m]=Math.random();const w=new xe;w.setAttribute("position",new te(D,3)),w.setAttribute("aPh",new te(h,1));const F=new Ue(w,new H({uniforms:o,transparent:!0,depthWrite:!1,blending:Pe,vertexShader:`
          attribute float aPh; uniform float uTime, uPx, uStar, uRain; varying float vA;
          void main(){
            float t = uTime * (.06 + aPh * .05) + aPh * 30.;
            vec3 p = position + vec3(sin(t * 1.3) * .12, sin(t * .9 + aPh * 4.) * .06, cos(t) * .05);
            vA = uStar * (1. - uRain) * pow(max(0., sin(uTime * (.5 + aPh * .6) + aPh * 20.)), 3.);
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_PointSize = uPx * .03 / -mv.z; gl_Position = projectionMatrix * mv;
          }`,fragmentShader:"varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., 0., d); gl_FragColor = vec4(vec3(1., .92, .55) * a * a * vA, 1.); }"}));F.frustumCulled=!1,F.renderOrder=-10,f.add(F)}}let R="painted";const S=r=>{R=n?r:"layered",f.visible=R==="painted",d.visible=R==="layered"};return S(n?"painted":"layered"),{setMode:S,get mode(){return R},update(r,c,u,l={}){o.uTime.value=c,o.uDrift.value=u,o.uRain.value=l.rain||0,o.uWind.value=l.wind||0,l.px&&(o.uPx.value=l.px),r.sky.forEach((x,M)=>o.uSky.value[M].fromArray(x)),o.uHaze.value.fromArray(r.haze),o.uHz.value=r.hz,o.uPcb.value.fromArray(r.pcb),o.uPcr.value.fromArray(r.pcr),o.uPca.value=r.pca,o.uPra.value=r.pra,o.uCb.value.fromArray(r.cb),o.uCr.value.fromArray(r.cr),o.uCs.value.fromArray(r.cs),o.uCa.value=r.ca,o.uAl.value.fromArray(r.al),o.uWin.value=r.win,o.uStar.value=r.star,o.uMoon.value=r.moon,o.uSun.value=r.sun,o.uDay.value=r.day,o.uMoonPos.value.fromArray(r.moonPos),o.uSunPos.value.fromArray(r.sunPos);const p=(c/180+.15)%1;y.m.position.copy(J(-.15+p*1.3,.5-p*.3+Math.sin(c*.2)*.01,y.z))}}}const k=e=>document.querySelector(e),ct=(e,t,a)=>new U(e,a,-t),ue=e=>ct(e[0],e[1],e[2]),j=(e,t,a,n)=>e+(t-e)*(1-Math.exp(-a*n)),Mt=matchMedia("(prefers-reduced-motion: reduce)").matches,P=new ea({canvas:k("#gl"),antialias:!0,powerPreference:"high-performance"});P.setPixelRatio(Math.min(devicePixelRatio,2));P.setClearColor(854803);const pe=new Dt,O=new zt(50,1,.05,40);P.info.autoReset=!1;const ne={pos:[.1018,-3.1477,1.8459],target:[-.102,.3221,1.4354],vfov:51.96,aspect:2752/1536},we=ue(ne.pos),We=ue(ne.target),Ut=st.degToRad(ne.vfov),Ca=2*Math.atan(Math.tan(Ut/2)*ne.aspect),Ve=new ta(1,1,{samples:4,depthTexture:new aa(1,1)}),Ce={tColor:{value:Ve.texture},tDepth:{value:Ve.depthTexture},uRes:{value:new Se(1,1)},uStyle:{value:0},uPx:{value:1},uNear:{value:O.near},uFar:{value:O.far}},Wt=new Dt,Ma=new oa(-1,1,1,-1,0,1);Wt.add(new qe(new re(2,2),new H({uniforms:Ce,depthTest:!1,depthWrite:!1,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`
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
    }`})));function Lt(){const e=innerWidth,t=innerHeight;P.setSize(e,t,!1);const a=P.getPixelRatio();Ve.setSize(Math.round(e*a),Math.round(t*a)),Ce.uRes.value.set(e*a,t*a),Ce.uPx.value=Math.max(1,a*.9),O.aspect=e/t,O.fov=st.radToDeg(O.aspect>=ne.aspect?2*Math.atan(Math.tan(Ca/2)/O.aspect):Ut),O.updateProjectionMatrix()}addEventListener("resize",Lt);Lt();const ut=new na,Vt=new ia(ut),Aa=new ra(ut),De=e=>{const t=Vt.load(`/assets/${e}.webp`);return t.flipY=!1,t.colorSpace=ca,t.anisotropy=8,t},Me={uAmb:{value:new U(1,1,1)},uLamp:{value:1}},Ra={room:{tDay:{value:De("bake_day")},tLamp:{value:De("bake_lamp")}},props:{tDay:{value:De("props_day")},tLamp:{value:De("props_lamp")}}},Ta=e=>new H({uniforms:{...Me,...Ra[e],uHi:{value:0},uShine:{value:-1}},vertexShader:"varying vec2 vUv; varying vec3 vLp; void main(){ vUv = uv; vLp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",fragmentShader:`
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
    }`}),ka=[["Vòng lặp lồng nhau là gì"],["In hình chữ nhật sao"],["Bảng cửu chương"],["Tam giác sao"],["Tam giác ngược"],["Đếm cặp số"],["Duyệt mảng hai chiều"],["Tối ưu hai vòng lặp"],["Kiểm tra cuối chặng"]],za={book:{short:"C++",lessons:ka.map(e=>e[0])},pb:{short:"Python",lessons:["Biến và kiểu dữ liệu","Nhập và xuất","Câu lệnh if","if, elif, else","Vòng lặp for","Vòng lặp while","Hàm","List","Dict","Chuỗi","Ôn tập"]},tb:{short:"Tư duy",lessons:["Chia nhỏ bài toán","Viết mã giả","Vẽ lưu đồ","Tìm quy luật","Thử bằng tay","Đếm số bước","Thuật toán tham lam","Chia để trị"]}},he=new U(0,1,0),He=new U(0,0,1),Da=new U(1,0,0),Fa=new U(-1,0,0),_a=[[/^Interactive_Laptop/,"laptop",()=>"Laptop · Đấu trường",he,"hop"],[/^Interactive_Notebook/,"notebook",()=>"Cuốn sổ · Luyện tập",he,"hop"],[/^Interactive_Phone/,"phone",()=>"Điện thoại · Hồ sơ và xếp hạng",he,"buzz"],[/^Coffee_Mug/,"mug",()=>"Cốc cà phê · Nghỉ 5 phút",he,"hop"],[/^Interactive_Corkboard/,"corkboard",()=>"Bảng ghim · Lộ trình",Da,"swingX"],[/^Interactive_Calendar/,"calendar",()=>"Lịch · Chuỗi 12 ngày",He,"swingZ"],[/^Interactive_Trophy_MedalHang/,"trophy",()=>"Kệ cúp · Thành tựu",Fa,"swingX"],[/^Interactive_Trophy/,"trophy",()=>"Kệ cúp · Thành tựu",he,"spin"],[/^Interactive_Book_(book|pb|tb)(\d+)/,"book",e=>{const t=za[e[1]],a=+e[2];return`${t.short} · Bài ${a+1}: ${t.lessons[a]}`},He,"slide"],[/^Window_(Sash|Glass)/,"window",()=>"Cửa sổ · Mở để hóng gió",null,"window"]],Ae=[],Ee=[];let ot,Ht;const le={uTime:{value:0},uLamp:Me.uLamp,uWind:{value:0},uPx:{value:1}};Promise.all(["scene-data","atlas-groups"].map(e=>fetch(`/assets/${e}.json`).then(t=>t.json()))).then(([e,t])=>{const a=new Set(t.props);Aa.load("/assets/room.glb",n=>{const o=n.scene;pe.add(o);const s=[];o.traverse(v=>{v.isMesh&&s.push(v)});for(const v of s){/^Window_Glass/.test(v.name)?(v.material=new yt({map:Va(),transparent:!0,opacity:.5,depthWrite:!1,blending:Pe,side:lt}),v.renderOrder=2):/^Laptop_Screen/.test(v.name)?v.material=new yt({map:Et.tex}):v.material=Ta(a.has(v.name)?"props":"room");const i=_a.find(r=>r[0].test(v.name));if(!i)continue;const[g,y,b,W,R]=i,S={o:v,kind:y,label:b(v.name.match(g)),dir:W,anim:R,base:v.position.clone(),rot:v.rotation.clone(),hover:0,t:9};v.userData.item=S,Ae.push(S),Ee.push(v)}ot=o.getObjectByName("Window_Sash_L"),Ht=o.getObjectByName("Window_Sash_R");const d=Ae.find(v=>v.kind==="laptop"),f=s.find(v=>/^Laptop_Screen/.test(v.name));d&&f&&d.o.attach(f)}),Ha(e.bulbs),Ea(e.led),Ia(ue(e.mugTop)),La()});const Ua=[{ic:"↑2",sh:"Hạng 37",l3:"Giải Bạc",t:"Bạn vừa tăng 2 bậc",b:"Tuần này bạn đang hạng 37 ở Giải Bạc. Thêm 160 XP nữa là vào top 30.",c:"#a9d2ff"},{ic:"2 ngày",sh:"Đệ quy",l3:"0/5 bài",t:"Còn 2 ngày cho “Đệ quy”",b:"Bạn đã làm 0/5 bài. Hoàn thành cả 5 để nhận huy hiệu Kim cương.",c:"#ffe38c"},{ic:"+40",sh:"Luyện tập",l3:"2 bài nữa",t:"Còn 2 bài luyện tập",b:"Giải thêm 2 bài trong kho Luyện tập để nhận +40 XP hôm nay.",c:"#b8e9a6"},{ic:"12/14",sh:"Streak",l3:"còn 2 ngày",t:"Giữ chuỗi thêm 2 ngày",b:"Học ít nhất 1 bài mỗi ngày đến Chủ nhật để mở huy hiệu Streak 14 ngày.",c:"#ffb7c9"}];function Wa(e,t){const a=document.createElement("canvas");a.width=160,a.height=148;const n=a.getContext("2d");n.fillStyle=e.c,n.fillRect(0,10,160,138);const o=n.createLinearGradient(0,10,0,148);o.addColorStop(0,"rgba(255,255,255,.18)"),o.addColorStop(1,"rgba(0,0,0,.12)"),n.fillStyle=o,n.fillRect(0,10,160,138),n.fillStyle="rgba(255,255,255,.55)",n.save(),n.translate(80,12),n.rotate((t%2?1:-1)*.06),n.fillRect(-34,-10,68,20),n.restore(),n.fillStyle="#2a1712",n.textBaseline="top",n.font='700 34px "Patrick Hand","Segoe Print","Comic Sans MS",cursive',n.fillText(e.ic,14,34),n.font='24px "Patrick Hand","Segoe Print","Comic Sans MS",cursive',n.fillText(e.sh,14,78),n.fillText(e.l3,14,108);const s=new Oe(a);return s.colorSpace=Te,s.anisotropy=8,s}function La(){const t=.06937499999999999;Ua.forEach((a,n)=>{const o=new re(.075,t);o.translate(0,-t/2,0);const s=new qe(o,new H({uniforms:{map:{value:Wa(a,n)},uHi:{value:0},...Me},side:lt,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",fragmentShader:`uniform sampler2D map; uniform vec3 uAmb; uniform float uLamp, uHi; varying vec2 vUv;
        void main(){ vec4 t = texture2D(map, vUv); if (t.a < .5) discard;
          float l = .18 + dot(uAmb, vec3(.33)) * .75 + uLamp * .55;              // lit like the paper around it
          gl_FragColor = vec4(t.rgb * min(l, 1.15) * (1. + uHi * .25), 1.); }`}));s.position.copy(ct(-.12+n*.17,-.158,.812)),s.rotation.set(-.04,0,(n%2?1:-1)*.07),s.name="Note_"+n,pe.add(s);const d={o:s,kind:"note",label:`Ghi chú · ${a.t}`,body:a.b,dir:He,anim:"note",base:s.position.clone(),rot:s.rotation.clone(),hover:0,t:9,i:n};s.userData.item=d,Ae.push(d),Ee.push(s)})}function Va(){const e=document.createElement("canvas");e.width=64,e.height=128;const t=e.getContext("2d"),a=t.createLinearGradient(0,128,64,0);[[0,.16],[.3,0],[.56,0],[.63,.12],[.74,0],[1,.05]].forEach(([o,s])=>a.addColorStop(o,`rgba(255,255,255,${s})`)),t.fillStyle="#000",t.fillRect(0,0,64,128),t.fillStyle=a,t.fillRect(0,0,64,128);const n=new Oe(e);return n.colorSpace=Te,n}const Et=(()=>{const e=document.createElement("canvas");e.width=512,e.height=320;const t=e.getContext("2d"),a=new Oe(e);a.colorSpace=Te,a.anisotropy=8;const n=["# Đấu trường · FizzBuzz","def solve(n):","    out = []","    for i in range(1, n + 1):","        if i % 15 == 0:",'            out.append("FizzBuzz")',"        elif i % 3 == 0:",'            out.append("Fizz")',"        else:","            out.append(str(i))","    return out"],o=n.join(`
`).length;let s=-1,d=-1;function f(v){const i=Math.floor(v*9)%(o+40),g=Math.floor(v*2)%2;if(i===s&&g===d)return;s=i,d=g,t.fillStyle="#121725",t.fillRect(0,0,512,320),t.fillStyle="#1b2236",t.fillRect(0,0,512,30),["#ff9db8","#ffc97a","#8be3a8"].forEach((R,S)=>{t.fillStyle=R,t.beginPath(),t.arc(18+S*18,15,5,0,7),t.fill()}),t.font="600 14px ui-monospace,Consolas,monospace",t.fillStyle="#d9e6ff",t.fillText("solution.py · Đấu trường",86,20),t.font="17px ui-monospace,Consolas,monospace";let y=Math.min(i,o),b=0,W=0;n.forEach((R,S)=>{t.fillStyle="#6f7a96",t.fillText(String(S+1).padStart(2),12,58+S*21);const r=R.slice(0,Math.max(0,y));y>=0&&(b=48+t.measureText(r).width,W=58+S*21),y-=R.length+1,t.fillStyle=/^\s*#/.test(R)?"#6f7a96":/^\s*(def|for|if|elif|else|return)\b/.test(R)?"#ff9db8":/"/.test(R)?"#8be3a8":"#d9e6ff",t.fillText(r,48,58+S*21)}),g&&(t.fillStyle="#ffc97a",t.fillRect(b+1,W-14,8,17)),a.needsUpdate=!0}return f(0),{tex:a,draw:f}})(),Ie=(e,t,a=Pe)=>new H({uniforms:le,vertexShader:e,fragmentShader:t,transparent:!0,depthWrite:!1,blending:a}),nt="varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., 0., d); gl_FragColor = vec4(vC * a * a * vA, 1.); }";function Ne(e,t,a){const n=new xe;n.setAttribute("position",new te(e,3)),n.setAttribute("aPh",new te(t,1));const o=new Ue(n,a);return o.frustumCulled=!1,pe.add(o),o}function Ha(e){const t=e.length,a=new Float32Array(t*3),n=new Float32Array(t);e.forEach((o,s)=>{ct(o[0],o[1],o[2]).toArray(a,s*3),n[s]=Math.random()}),Ne(a,n,Ie(`
    attribute float aPh; uniform float uTime, uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
      float tw = .78 + .22 * sin(uTime * (.6 + aPh * .9) + aPh * 30.);
      vA = (.3 + .7 * uLamp) * tw; vC = vec3(1., .78, .42);
      gl_PointSize = uPx * .085 / -mv.z; gl_Position = projectionMatrix * mv; }`,nt))}function Ea(e){const t=ue(e.a),a=ue(e.b),n=ue(e.down).normalize(),o=a.clone().sub(t).normalize(),s=.743,d=14,f=new Float32Array(d*3),v=new Float32Array(d);for(let l=0;l<d;l++)t.clone().lerp(a,(l+.5)/d).addScaledVector(n,.004).toArray(f,l*3),v[l]=l/d;Ne(f,v,Ie(`
    attribute float aPh; uniform float uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
      vA = uLamp * (.55 + .45 * sin(aPh * 3.1416)); vC = vec3(1., .86, .66);
      gl_PointSize = uPx * .05 / -mv.z; gl_Position = projectionMatrix * mv; }`,nt));const i=(t.y-s)/-n.y,g=(a.y-s)/-n.y,y=.16,b=t.clone().addScaledVector(n,i).addScaledVector(o,-y),W=a.clone().addScaledVector(n,g).addScaledVector(o,y),R=new xe;R.setAttribute("position",new wt([...t.toArray(),...a.toArray(),...W.toArray(),...b.toArray()],3)),R.setAttribute("uv",new wt([0,0,1,0,1,1,0,1],2)),R.setIndex([0,1,2,0,2,3]);const S=new qe(R,new H({uniforms:le,transparent:!0,depthWrite:!1,side:lt,blending:Pe,vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",fragmentShader:`
      varying vec2 vUv; uniform float uLamp, uTime;
      void main(){
        float across = sin(3.1416 * clamp(vUv.x, 0., 1.));
        float fall = pow(1. - vUv.y, 1.7) * smoothstep(0., .06, vUv.y);
        float breathe = .94 + .06 * sin(uTime * .35);
        float a = across * across * fall * .085 * uLamp * breathe;
        gl_FragColor = vec4(vec3(1., .83, .6) * a, 1.);
      }`}));S.renderOrder=3,pe.add(S);const r=26,c=new Float32Array(r*3),u=new Float32Array(r);for(let l=0;l<r;l++){const p=Math.random(),x=.15+Math.random()*.75,M=t.clone().lerp(a,p),C=b.clone().lerp(W,p);M.lerp(C,x).add(new U(0,0,(Math.random()-.5)*.12)).toArray(c,l*3),u[l]=Math.random()}Ne(c,u,Ie(`
    attribute float aPh; uniform float uTime, uLamp, uPx; varying float vA; varying vec3 vC;
    void main(){ vec3 p = position; float t = uTime * (.04 + aPh * .04) + aPh * 6.283;
      p += vec3(sin(t * 1.3), sin(t) * .7 + .2, cos(t * .9)) * .035;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      vA = uLamp * .45 * (.5 + .5 * sin(t * 2.)); vC = vec3(1., .88, .66);
      gl_PointSize = uPx * .009 / -mv.z; gl_Position = projectionMatrix * mv; }`,nt))}function Ia(e){const a=new Float32Array(15),n=new Float32Array(5);for(let o=0;o<5;o++)e.toArray(a,o*3),n[o]=o/5;Ne(a,n,Ie(`
    attribute float aPh; uniform float uTime, uWind, uPx; varying float vA; varying vec3 vC;
    void main(){ float k = fract(uTime * .16 + aPh); vec3 p = position;
      p.y += k * .36; p.x += sin(k * 5. + aPh * 20.) * .03 * k + uWind * k * k * .22; p.z += uWind * k * k * .12;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      vA = smoothstep(0., .2, k) * smoothstep(1., .45, k) * .15; vC = vec3(1., .97, .93);
      gl_PointSize = uPx * (.08 + k * .16) / -mv.z; gl_Position = projectionMatrix * mv; }`,"varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(vC, smoothstep(1., 0., d) * vA); }",va))}const It=Sa(pe,Vt,we,{pos:we,target:We,vfov:ne.vfov,aspect:ne.aspect});document.querySelectorAll("[data-view]").forEach(e=>e.addEventListener("click",()=>{It.setMode(e.dataset.view),document.querySelectorAll("[data-view]").forEach(t=>t.setAttribute("aria-pressed",String(t===e)))}));let K=18,Re=18,se=!1,fe=!1,ie=0,ee=0,At=0;window.__peSetTime=e=>{K=Re=e};window.__peSetWeather=({rain:e,open:t}={})=>{e!==void 0&&(ce=e,oe=e?1:0),t!==void 0&&(vt(t),ie=ee=t?1:0)};const Nt=()=>{const e=new Date;return e.getHours()+e.getMinutes()/60+e.getSeconds()/3600};k("#tod").addEventListener("input",e=>{Re=+e.target.value,se=!1,k("#bReal").setAttribute("aria-pressed","false")});k("#bReal").addEventListener("click",()=>{se=!se,k("#bReal").setAttribute("aria-pressed",String(se)),se&&(Re=Nt())});function vt(e){fe=e,k("#bWin").setAttribute("aria-pressed",String(e)),k("#bWin").textContent=e?"Đóng cửa sổ":"Mở cửa sổ"}k("#bWin").addEventListener("click",()=>vt(!fe));const Bt=[["auto","Đèn: theo giờ"],["on","Đèn: bật"],["off","Đèn: tắt"]];let ge=0,Ye=1,Pt=0;k("#bLamp").addEventListener("click",()=>{ge=(ge+1)%3,k("#bLamp").textContent=Bt[ge][1],k("#bLamp").setAttribute("aria-pressed",String(ge!==0))});document.querySelectorAll("[data-style]").forEach(e=>e.addEventListener("click",()=>{Pt=+e.dataset.style,document.querySelectorAll("[data-style]").forEach(t=>t.setAttribute("aria-pressed",String(t===e)))}));let qt=!1;const Ot=e=>{qt=e>0,document.documentElement.style.setProperty("--cut",e+"%"),k("#cutLine").style.opacity=e>0&&e<100?1:0};k("#cmp2d").addEventListener("input",e=>Ot(+e.target.value));Ot(0);let Rt;function Tt(e,t=1600){const a=k("#toast");a.textContent=e,a.style.opacity=1,clearTimeout(Rt),Rt=setTimeout(()=>a.style.opacity=0,t)}let ce=!1,oe=0;k("#bRain").addEventListener("click",()=>{ce=!ce,k("#bRain").setAttribute("aria-pressed",String(ce)),k("#bRain").textContent=ce?"Tạnh mưa":"Mưa"});const kt=new la,be=new Se(0,0),Q=new Se(0,0);let dt=!1,E=null,it=!1;const $e=P.domElement,Be=k("#tip");$e.addEventListener("pointermove",e=>{be.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1),dt=it=!0,Be.style.left=e.clientX+"px",Be.style.top=e.clientY+"px"});$e.addEventListener("pointerleave",()=>{dt=!1,be.set(0,0)});$e.addEventListener("click",()=>{if(!E)return;if(E.kind==="window"){vt(!fe),Tt(fe?"Mở cửa sổ · gió lùa vào":"Đóng cửa sổ");return}(E.kind==="trophy"?Ae.filter(t=>t.kind==="trophy"):[E]).forEach((t,a)=>t.t=-a*.08),Tt(E.kind==="note"?`${E.label.replace("Ghi chú · ","")} — ${E.body}`:E.label,E.kind==="note"?4200:1600)});const rt=new sa;let Je=0,Fe=0,_e=1;ut.onLoad=()=>{const e=k("#load");e&&(e.style.opacity=0,setTimeout(()=>e.remove(),900))};function $t(){const e=Math.min(.05,rt.getDelta()),t=rt.elapsedTime;le.uTime.value=t,le.uPx.value=P.domElement.height/(2*Math.tan(st.degToRad(O.fov)/2)),se&&(Re=Nt());const a=(Re-K+36)%24-12;K=(K+a*(1-Math.exp(-2.2*e))+24)%24;const n=ua(K);oe=j(oe,ce?1:0,.7,e),Me.uAmb.value.fromArray(n.amb).multiply(new U(1-.38*oe,1-.34*oe,1-.22*oe));const o=Bt[ge][0];Ye=j(Ye,o==="auto"?n.lamp:o==="on"?1:0,4,e),Me.uLamp.value=Ye,Ce.uStyle.value=j(Ce.uStyle.value,Pt,5,e);const s=Math.floor(K),d=Math.floor((K-s)*60);k("#clock").textContent=`${String(s).padStart(2,"0")}:${String(d).padStart(2,"0")}`,document.activeElement!==k("#tod")&&(k("#tod").value=K),ie=j(ie,fe?1:0,2.2,e),ee=j(ee,fe?1:0,.8,e);const f=ie*ie*(3-2*ie);ot&&(ot.rotation.y=f*1.08,Ht.rotation.y=-f*1.08),le.uWind.value=ee,Mt||(At+=e*(.0054+ee*.019)),It.update(n,t,K*.139+At,{rain:oe,wind:ee,px:le.uPx.value});const v=qt?0:1;if(Q.x=j(Q.x,be.x*v,2.4,e),Q.y=j(Q.y,be.y*v,2.4,e),_e=j(_e,Mt?0:v,1.5,e),O.position.set(we.x+Q.x*.22+Math.sin(t*.17)*.025*_e,we.y+Q.y*.09+Math.sin(t*.23)*.012*_e,we.z),O.lookAt(We.x+Q.x*.1,We.y+Q.y*.05,We.z),it&&Ee.length){it=!1,kt.setFromCamera(be,O);const i=dt?kt.intersectObjects(Ee,!1)[0]:null,g=i?i.object.userData.item:null;g!==E&&(E=g,$e.style.cursor=E?"pointer":"",Be.style.opacity=E?1:0,E&&(Be.textContent=E.label))}for(const i of Ae){if(i.kind==="window")continue;i.hover=j(i.hover,i===E?1:0,9,e),i.t+=e;const g=i.t>0?Math.exp(-3.2*i.t):0,y=Math.sin(i.t*11)*g;i.o.material.uniforms.uHi.value=i.hover,i.o.position.copy(i.base).addScaledVector(i.dir,i.hover*(i.kind==="book"?.045:.018)),i.o.rotation.copy(i.rot),i.anim==="hop"?i.o.position.y+=Math.abs(y)*.03:i.anim==="buzz"?i.o.rotation.y+=Math.sin(i.t*60)*g*.05:i.anim==="swingZ"?i.o.rotation.z+=y*.06:i.anim==="swingX"?i.o.rotation.x+=y*(i.kind==="trophy"?.25:.03):i.anim==="spin"?(i.o.rotation.y+=y*.5,i.o.position.y+=Math.abs(y)*.015):i.anim==="slide"?i.o.position.z+=Math.abs(y)*.06:i.anim==="note"&&(i.o.rotation.x+=Math.sin(t*5.5+i.i*1.7)*.22*ee+Math.sin(t*9+i.i)*.05*ee+y*.3,i.o.position.copy(i.base).addScaledVector(He,i.hover*.006)),i.kind==="trophy"&&(i.o.material.uniforms.uShine.value=i.t>=0&&i.t<.9?i.t/.9:-1)}if(Et.draw(t),P.info.reset(),P.setRenderTarget(Ve),P.render(pe,O),P.setRenderTarget(null),P.render(Wt,Ma),Je++,Fe+=e,Fe>=.5){const i=P.info;k("#stats").innerHTML=`<b>${Math.round(Je/Fe)}</b> fps<br>draw calls <b>${i.render.calls}</b><br>tam giác <b>${(i.render.triangles/1e3).toFixed(1)}k</b><br>textures <b>${i.memory.textures}</b>`,Je=0,Fe=0}requestAnimationFrame($t)}requestAnimationFrame($t);addEventListener("visibilitychange",()=>rt.getDelta());
