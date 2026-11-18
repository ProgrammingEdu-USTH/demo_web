// Stage: buffer 320×180, scale nguyên + letterbox lên canvas hiển thị, vòng lặp render, API công khai.
import type { AsepriteJson, Rect, SpriteSheet } from "../assets/sheet";
import { fromAseprite } from "../assets/sheet";
import { contractProblems, loadAseprite } from "../assets/loader";
import { SPRITE_ASSETS } from "../assets/manifest";
import type { Ctx } from "../render/pixel";
import type { Entity, Frame, Vec } from "../timeline/state";
import type { StepScript, WorldId } from "../timeline/types";
import type { StepEvent } from "../timeline/player";
import type { WorldDef, WorldEnv } from "../worlds/types";
import { Player } from "../timeline/player";
import { checkRefs, parseScript } from "../timeline/validate";
import { getWorld } from "../worlds";
import { Loop } from "./clock";
import { Synth } from "./audio";
import { schedule } from "../timeline/state";
import { hashBytes } from "./rng";
import { dither, makeCanvas } from "../render/pixel";
import { drawEntity, opaqueBounds, spriteRect } from "../render/sprite";
import { drawBurst } from "../render/particles";
import { drawBubble } from "../render/bubble";
import { drawHighlight, drawLabel, drawTimer } from "../render/hud";
import { drawOverlay } from "../render/overlay";
import { base, resolveColor } from "../tokens/palette";
import { darkLevel, letterbox } from "../tokens/fx";
import type { Speed } from "../tokens/motion";
import { speeds } from "../tokens/motion";
import { hand, propSize, stageH, stageW } from "../tokens/size";

export type StageOptions = {
  world: WorldId;
  seed?: number;
  /** grain + vignette */
  overlay?: boolean;
  /** "auto" = theo prefers-reduced-motion */
  reducedMotion?: boolean | "auto";
  /** Bổ sung / ghi đè danh mục spritesheet thật ("<thế-giới>/<sprite>" → URL JSON Aseprite). */
  assets?: Record<string, string>;
  /** Phần thừa quanh khung 320×180: "ink" = viền tối (mặc định); "extend" = kéo dài mép cảnh và tối dần,
   *  dùng khi canvas phủ toàn màn hình. Khung cảnh chính vẫn scale nguyên, không bị cắt. */
  fill?: "ink" | "extend";
};

/** Tình trạng một sprite: dùng placeholder, đã nạp sheet thật, hoặc nạp lỗi (đang dùng placeholder). */
export type AssetStatus = { source: "placeholder" | "asset" | "failed"; url?: string; problems?: string[] };

type Events = { step: StepEvent; play: { playing: boolean }; end: { index: number } };
type Listener<K extends keyof Events> = (e: Events[K]) => void;

export type StageState = {
  index: number; count: number; playing: boolean; speed: Speed; settled: boolean;
  reduced: boolean; running: boolean; scale: number; world: WorldId;
  /** cỡ khối mosaic đang vẽ (1 = bình thường) */
  mosaic: number;
  /** tiến độ trong step hiện tại 0…1 (khi Play tính cả lúc dừng đọc caption) */
  progress: number;
};

export type PixelStage = {
  load(script: unknown): Promise<StepScript>;
  next(): void;
  prev(): void;
  goTo(n: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(s: Speed): void;
  setOverlay(on: boolean): void;
  /** Âm thanh tổng hợp (mặc định tắt). Gọi từ cử chỉ người dùng để trình duyệt cho phát. */
  setSound(on: boolean): void;
  /** Vẽ cảnh thành khối `block`×`block` px logic (1 = bình thường). Dùng cho chuyển cảnh pixelate. */
  setMosaic(block: number): void;
  setReducedMotion(v: boolean | "auto"): void;
  on<K extends keyof Events>(type: K, fn: Listener<K>): () => void;
  readonly state: StageState;
  readonly world: WorldDef;
  /** Dựng trạng thái cuối của step hiện tại với thời gian ambient cố định, trả về mã băm pixel buffer (dùng cho test). */
  still(ambientMs: number): string;
  /** Spritesheet đang dùng cho một tên sprite của thế giới hiện tại. */
  sprite(name: string): SpriteSheet;
  /** Thay sprite bằng spritesheet Aseprite cùng tên, cùng kích thước, đủ tag. Script giữ nguyên. */
  replaceSprite(name: string, json: AsepriteJson, image: CanvasImageSource): void;
  /** Đổi danh mục spritesheet thật (áp dụng từ lần load / reload kế tiếp). */
  useAssets(map: Record<string, string>): void;
  /** Nạp lại script hiện tại (ví dụ sau khi đổi danh mục asset), giữ nguyên bước đang xem. */
  reload(): Promise<void>;
  /** Tình trạng sprite của thế giới hiện tại. */
  assets(): Record<string, AssetStatus>;
  destroy(): void;
};

type SheetInfo = { sheet: SpriteSheet; bounds: Rect };

export function createPixelStage(canvas: HTMLCanvasElement, opts: StageOptions): PixelStage {
  const seed = opts.seed ?? 1;
  const display = canvas.getContext("2d");
  if (!display) throw new Error("Trình duyệt không hỗ trợ Canvas 2D");
  canvas.style.imageRendering = "pixelated";
  const buf = makeCanvas(stageW, stageH);

  let world = getWorld(opts.world);
  const sheets = new Map<string, SheetInfo>();
  const statics = new Map<WorldId, HTMLCanvasElement>();
  let player: Player | null = null;
  let tAmb = 0;
  let speed: Speed = 1;
  let overlayOn = opts.overlay ?? true;
  let rmPref: boolean | "auto" = opts.reducedMotion ?? "auto";
  let scale = 1;
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => (rmPref === "auto" ? !!mq?.matches : rmPref);
  const listeners: { [K in keyof Events]: Set<Listener<K>> } = { step: new Set(), play: new Set(), end: new Set() };
  const emit = <K extends keyof Events>(k: K, e: Events[K]) => listeners[k].forEach((fn) => fn(e));

  const sheetOf = (name: string, w: WorldDef = world): SheetInfo => {
    let s = sheets.get(`${w.id}/${name}`);
    if (!s) {
      const make = w.sprites[name];
      if (!make) throw new Error(`Sprite "${name}" không có trong thế giới ${w.id}`);
      const sheet = make();
      s = { sheet, bounds: opaqueBounds(sheet) };
      sheets.set(`${w.id}/${name}`, s);
    }
    return s;
  };

  // spritesheet thật: nạp trước khi dựng player; sai hợp đồng hoặc lỗi mạng thì giữ placeholder
  let assetMap: Record<string, string> = { ...SPRITE_ASSETS, ...opts.assets };
  const status = new Map<string, AssetStatus>();
  const preloadAssets = async (w: WorldDef): Promise<void> => {
    await Promise.all(Object.keys(w.sprites).map(async (name) => {
      const key = `${w.id}/${name}`, url = assetMap[key];
      if (!url) {
        status.set(key, { source: "placeholder" });
        return;
      }
      if (status.get(key)?.url === url) return; // đã nạp (hoặc đã thử) đúng file này
      const placeholder = w.sprites[name]();
      try {
        const real = await loadAseprite(name, url, placeholder.origin);
        const problems = contractProblems(placeholder, real);
        if (problems.length) {
          console.warn(`[pixel-stage] ${key}: sheet ${url} sai hợp đồng, dùng placeholder.`, problems);
          status.set(key, { source: "failed", url, problems });
          sheets.set(key, { sheet: placeholder, bounds: opaqueBounds(placeholder) });
          return;
        }
        sheets.set(key, { sheet: real, bounds: opaqueBounds(real) });
        status.set(key, { source: "asset", url });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[pixel-stage] ${key}: ${msg}, dùng placeholder.`);
        status.set(key, { source: "failed", url, problems: [msg] });
        sheets.set(key, { sheet: placeholder, bounds: opaqueBounds(placeholder) });
      }
    }));
  };

  const staticLayer = (): HTMLCanvasElement => {
    let s = statics.get(world.id);
    if (!s) {
      const { canvas: cv, ctx } = makeCanvas(stageW, stageH);
      world.drawStatic(ctx, world.accents);
      statics.set(world.id, cv);
      s = cv;
    }
    return s;
  };

  const point = (name: string, ents: ReadonlyMap<string, Entity>): Vec | null => {
    const a = world.anchors[name];
    if (a) return { x: a.x, y: a.y };
    const handOf = name.endsWith(".hand") ? ents.get(name.slice(0, -5)) : undefined;
    if (handOf) return { x: handOf.x + (handOf.flip ? -hand.dx : hand.dx), y: handOf.y + hand.dy };
    const en = ents.get(name);
    return en ? { x: en.x, y: en.y } : null;
  };

  const boxOf = (target: string, f: Frame): Rect | null => {
    const en = f.entities.find((e) => e.id === target);
    if (en) {
      const { sheet, bounds } = sheetOf(en.sprite);
      const r = spriteRect(sheet, en.x, en.y);
      const bx = en.flip ? sheet.w - bounds.x - bounds.w : bounds.x;
      return { x: r.x + bx, y: r.y + bounds.y, w: bounds.w, h: bounds.h };
    }
    const a = world.anchors[target];
    if (!a) return null;
    return a.box ?? { x: a.x - propSize / 2, y: a.y - propSize / 2, w: propSize, h: propSize };
  };

  const compose = (f: Frame, tAmbient: number, rm: boolean): void => {
    const t = rm ? 0 : tAmbient; // giảm chuyển động: ambient đứng yên hoàn toàn
    const c: Ctx = buf.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = base.ink;
    c.fillRect(0, 0, stageW, stageH);
    const z = f.camera.zoom;
    const hw = stageW / (2 * z), hh = stageH / (2 * z);
    const cx = Math.max(hw, Math.min(stageW - hw, f.camera.x));
    const cy = Math.max(hh, Math.min(stageH - hh, f.camera.y));
    c.setTransform(z, 0, 0, z, Math.round(stageW / 2 - cx * z), Math.round(stageH / 2 - cy * z));
    c.drawImage(staticLayer(), 0, 0);
    const env: WorldEnv = {
      t, vars: f.vars, reduced: rm, acc: world.accents, seed,
      entity: (id) => {
        const e = f.entities.find((x) => x.id === id);
        return e ? { x: Math.round(e.x), y: Math.round(e.y), alpha: e.alpha } : null;
      },
    };
    world.drawBack?.(c, env);
    const ents = f.entities.map((e, i) => ({ e, i })).sort((a, b) => Math.round(a.e.y) - Math.round(b.e.y) || a.i - b.i);
    for (const { e } of ents) drawEntity(c, sheetOf(e.sprite).sheet, e, t, rm);
    world.drawFront?.(c, env);
    for (const b of f.bursts) drawBurst(c, b, world.accents);
    const dark = world.darkness?.(env) ?? 0;
    if (dark > 0) dither(c, 0, 0, stageW, stageH, base.ink, dark * darkLevel);
    // lớp chú thích trong cảnh
    for (const h of f.highlights) {
      const r = boxOf(h.target, f);
      if (r) drawHighlight(c, r, resolveColor(h.color, world.accents), h.age);
    }
    for (const [target, l] of Object.entries(f.labels)) {
      const r = boxOf(target, f);
      if (r && l.p > 0) drawLabel(c, l.text, r, l.place);
    }
    const lift: Record<string, number> = {};
    for (const [target, tm] of Object.entries(f.timers)) {
      const r = boxOf(target, f);
      if (r && tm.p > 0) lift[target] = drawTimer(c, tm.seconds, tm.total, r, world.accents.a1);
    }
    for (const b of f.bubbles) {
      const r = boxOf(b.target, f);
      if (r) drawBubble(c, b.text, r, lift[b.target] ?? 0, b.p);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (overlayOn) drawOverlay(c, t, seed);
  };

  // fill "extend": kéo dài cột / hàng mép của khung đã vẽ ra phần thừa (chép từ chính canvas hiển thị,
  // nên đúng cả khi đang mosaic), rồi phủ các nấc tối dần ra phía mép màn hình.
  const fill = opts.fill ?? "ink";
  const extendEdges = (W: number, H: number, ox: number, oy: number, fw: number, fh: number): void => {
    const R = ox + fw, B = oy + fh;
    if (ox > 0) {
      display.drawImage(canvas, ox, oy, 1, fh, 0, oy, ox, fh);
      display.drawImage(canvas, R - 1, oy, 1, fh, R, oy, W - R, fh);
    }
    if (oy > 0) {
      display.drawImage(canvas, 0, oy, W, 1, 0, 0, W, oy);
      display.drawImage(canvas, 0, B - 1, W, 1, 0, B, W, H - B);
    }
    const bands = letterbox.bands;
    display.fillStyle = base.ink;
    bands.forEach((a, k) => {
      display.globalAlpha = a;
      // nấc k phủ từ mép màn hình vào tới (n-k)/n của phần thừa: càng ra ngoài càng nhiều lớp chồng → càng tối
      const fx = Math.ceil((ox * (bands.length - k)) / bands.length), fy = Math.ceil((oy * (bands.length - k)) / bands.length);
      if (fx > 0) {
        display.fillRect(0, 0, fx, H);
        display.fillRect(W - fx, 0, fx, H);
      }
      if (fy > 0) {
        display.fillRect(fx, 0, W - 2 * fx, fy);
        display.fillRect(fx, H - fy, W - 2 * fx, fy);
      }
    });
    display.globalAlpha = 1;
  };

  // mosaic > 1: vẽ cảnh thành các khối mosaic×mosaic px logic (hiệu ứng pixelate khi vào / ra thế giới)
  let mosaic = 1;
  const small = makeCanvas(stageW, stageH);
  const blit = (): void => {
    const W = canvas.width, H = canvas.height;
    scale = Math.max(1, Math.floor(Math.min(W / stageW, H / stageH)));
    const ox = Math.floor((W - stageW * scale) / 2), oy = Math.floor((H - stageH * scale) / 2);
    display.imageSmoothingEnabled = false;
    display.fillStyle = base.ink;
    display.fillRect(0, 0, W, H);
    if (mosaic > 1) {
      const sw = Math.ceil(stageW / mosaic), sh = Math.ceil(stageH / mosaic);
      small.ctx.imageSmoothingEnabled = true; // thu nhỏ có lọc = màu trung bình của từng khối
      small.ctx.clearRect(0, 0, stageW, stageH);
      small.ctx.drawImage(buf.canvas, 0, 0, sw, sh);
      display.drawImage(small.canvas, 0, 0, sw, sh, ox, oy, sw * mosaic * scale, sh * mosaic * scale);
      display.fillRect(ox + stageW * scale, oy, W, H); // phần khối thừa ra ngoài khung
      display.fillRect(ox, oy + stageH * scale, W, H);
    } else {
      display.drawImage(buf.canvas, ox, oy, stageW * scale, stageH * scale);
    }
    if (fill === "extend" && (ox > 0 || oy > 0)) extendEdges(W, H, ox, oy, stageW * scale, stageH * scale);
  };

  const render = (): void => {
    if (!player) return;
    compose(player.frame(), tAmb, reduced());
    blit();
  };

  // âm thanh: mỗi action `sound` phát đúng một lần khi tới thời điểm của nó trong step
  const synth = new Synth();
  const fired = new Set<string>();
  const fireSounds = (): void => {
    if (!player || !synth.enabled) return;
    const step = player.script.steps[player.index];
    for (const sl of schedule(step, reduced()).slots) {
      const key = `${player.index}:${sl.i}`;
      if (sl.a.type === "sound" && sl.start <= player.elapsed && !fired.has(key)) {
        fired.add(key);
        synth.play(sl.a.name);
      }
    }
  };

  const loop = new Loop((dt) => {
    syncRm();
    const d = dt * speed;
    if (!reduced()) tAmb += d;
    player?.tick(d);
    fireSounds();
    render();
  });

  // kích thước theo điểm ảnh thiết bị thật, để scale nguyên không bị trình duyệt nội suy lại
  const ro = new ResizeObserver((entries) => {
    const e = entries[entries.length - 1];
    const dp = e.devicePixelContentBoxSize?.[0];
    const w = dp ? dp.inlineSize : Math.round(e.contentRect.width * devicePixelRatio);
    const h = dp ? dp.blockSize : Math.round(e.contentRect.height * devicePixelRatio);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      render();
    }
  });
  try {
    ro.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    ro.observe(canvas);
  }
  // Đồng bộ giảm chuyển động vào player ngay khi cần (không chờ sự kiện "change" của media query tới muộn)
  let rmApplied = reduced();
  const syncRm = (): void => {
    const r = reduced();
    if (r !== rmApplied) {
      rmApplied = r;
      player?.setReduced(r);
    }
  };
  const onMq = () => syncRm();
  mq?.addEventListener("change", onMq);

  const api: PixelStage = {
    async load(raw) {
      const script = parseScript(raw);
      const w = getWorld(script.world);
      await preloadAssets(w);
      checkRefs(script, {
        anchor: (n) => n in w.anchors,
        sprite: (n) => n in w.sprites,
        tag: (s, t) => t in sheetOf(s, w).sheet.tags,
      });
      player?.pause();
      world = w;
      rmApplied = reduced();
      player = new Player(
        script, w.vars,
        { point, sizeOf: (n) => { const s = sheetOf(n).sheet; return Math.max(s.w, s.h); }, reduced: reduced() },
        (e) => { fired.clear(); emit("step", e); },
        (playing) => {
          emit("play", { playing });
          if (!playing && player && player.index === player.count - 1) emit("end", { index: player.index });
        },
      );
      canvas.setAttribute("aria-label", `${w.aria}. ${script.steps.length} bước.`);
      player.goTo(0);
      loop.start();
      render();
      return script;
    },
    next: () => { syncRm(); player?.next(); },
    prev: () => { syncRm(); player?.prev(); },
    goTo: (n) => { syncRm(); player?.goTo(n); },
    play: () => { syncRm(); player?.play(); },
    pause: () => player?.pause(),
    toggle: () => (player?.playing ? player.pause() : player?.play()),
    setSpeed(s) {
      if (speeds.includes(s)) speed = s;
    },
    setOverlay(on) {
      overlayOn = on;
    },
    setSound(on) {
      synth.setEnabled(on);
    },
    setMosaic(block) {
      mosaic = Math.max(1, Math.round(block));
      render();
    },
    setReducedMotion(v) {
      rmPref = v;
      syncRm();
    },
    on(type, fn) {
      listeners[type].add(fn);
      return () => listeners[type].delete(fn);
    },
    get state() {
      syncRm();
      return {
        index: player?.index ?? 0, count: player?.count ?? 0, playing: player?.playing ?? false, speed,
        settled: player?.settled ?? true, reduced: reduced(), running: loop.running, scale, world: world.id, mosaic,
        progress: player?.progress ?? 0,
      };
    },
    get world() {
      return world;
    },
    still(ambientMs) {
      if (!player) return "";
      compose(player.frame(true), ambientMs, reduced());
      blit();
      return hashBytes(buf.ctx.getImageData(0, 0, stageW, stageH).data);
    },
    sprite(name) {
      return sheetOf(name).sheet;
    },
    replaceSprite(name, json, image) {
      const old = sheetOf(name).sheet;
      const next = fromAseprite(name, json, image, old.origin);
      if (next.w !== old.w || next.h !== old.h) throw new Error(`Sprite "${name}" phải giữ kích thước ${old.w}×${old.h}`);
      const missing = Object.keys(old.tags).filter((t) => !(t in next.tags));
      if (missing.length) throw new Error(`Sprite "${name}" thiếu tag: ${missing.join(", ")}`);
      sheets.set(`${world.id}/${name}`, { sheet: next, bounds: opaqueBounds(next) });
      render();
    },
    useAssets(map) {
      assetMap = { ...SPRITE_ASSETS, ...map };
      // quên các sheet đã nạp để lần load sau đọc lại theo danh mục mới (sprite bỏ khỏi danh mục quay về placeholder)
      for (const key of [...status.keys()]) {
        if (status.get(key)?.url !== assetMap[key]) {
          status.delete(key);
          sheets.delete(key);
        }
      }
    },
    async reload() {
      if (!player) return;
      const idx = player.index;
      await api.load(player.script);
      player?.goTo(idx);
    },
    assets() {
      const out: Record<string, AssetStatus> = {};
      for (const name of Object.keys(world.sprites)) out[name] = status.get(`${world.id}/${name}`) ?? { source: "placeholder" };
      return out;
    },
    destroy() {
      loop.destroy();
      synth.destroy();
      ro.disconnect();
      mq?.removeEventListener("change", onMq);
      player = null;
      Object.values(listeners).forEach((s) => s.clear());
    },
  };
  return api;
}
