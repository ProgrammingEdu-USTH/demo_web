// ============================================================================
// PIXEL CANVAS 2D ENGINE (320×180 PIXEL ART + HIGH-DPI NATIVE TEXT + DRAG & DROP)
// Nguồn: "PE · Kế hoạch Motion Graphic bài học" (trang 6–9) & tokens.js
// Quy chuẩn:
// - Mọi màu sắc lấy từ `base` và `accents[world]` trong tokens.js (0 hard-coded hex).
// - Đồ họa pixel vẽ trên buffer 320×180 (imageSmoothingEnabled = false).
// - Chữ/nhãn/số vẽ trực tiếp lên lớp canvas độ phân giải màn hình thật (High-DPI)
//   sau khi upscale buffer -> chữ sắc nét 100%, tuyệt đối không bị mờ.
// - Hỗ trợ kéo-thả trực tiếp các vật thể trong cảnh (như Táo, Sữa, Bánh, Kem...)
//   thả vào Máy sản xuất (Máy in tem, Máy ép đĩa, Trạm Shipper, Rương đồ, Bếp).
// ============================================================================

import { STAGE, base, accents, WORLDS, motion, createRng } from './tokens.js';
import { drawSprite, getSprite, hasSprite } from './sprites.js';

export class PixelStageRenderer {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onInspectObject = options.onInspectObject || (() => {});
    this.onSelectOption = options.onSelectOption || (() => {});
    // Vùng UI phủ lên cảnh (CSS px) để đặt sân khấu 320×180 không bị che: { top, bottom }
    this.getInsets = options.getInsets || (() => ({ top: 0, bottom: 0 }));
    // Tỉ lệ đồng nhất (không kéo méo pixel) + phần nền mở rộng ra hai bên/trên/dưới
    this.view = { s: 1, ox: 0, oy: 0, padX: 0, padY: 0 };

    // Visible display canvas ở độ phân giải màn hình thật (High-DPI)
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pe-pixel-canvas';
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.dpr = 1;
    this.world = 'memory';
    this.speed = 1;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Current & previous state for deterministic tweening
    this.curStep = null;
    this.prevStep = null;
    this.curLesson = null;
    this.curOptionId = null;
    this.tweenStartMs = 0;
    this.tweenDurMs = motion.dur.md;
    this.errorStartMs = 0;
    this.isErrorState = false;
    this.hoveredObjectId = null;
    this.inspectedObjectId = null;

    // Trạng thái kéo-thả trực tiếp vật thể trong cảnh vào máy sản xuất
    this.dragState = null;

    // Lớp nhìn (concreteness fading): 'story' = ẩn dụ thuần · 'bridge' = ẩn dụ + nhãn code
    // + làm mờ vật không liên quan · 'abstract' = chỉ còn hộp dữ liệu mang tên biến
    this.lens = 'bridge';
    this.focusIds = null;
    this._drawnPos = new Map();

    // Hàng đợi chữ sắc nét High-DPI cho mỗi frame
    this.textQueue = [];

    // Deterministic ambient particles
    this.particles = [];
    this.seedAmbient(101);

    // Bind pointer & HTML5 drag events
    this._onResize = () => this.resize();
    this._onPointerDown = (e) => this.handlePointerDown(e);
    this._onPointerMove = (e) => this.handlePointerMove(e);
    this._onPointerUp = (e) => this.handlePointerUp(e);
    this._onDragOver = (e) => this.handleHtmlDragOver(e);
    this._onDrop = (e) => this.handleHtmlDrop(e);

    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('dragover', this._onDragOver);
    this.canvas.addEventListener('drop', this._onDrop);
    // Khung #lesson đổi kích thước khi sách mở ra / thu gọn panel → canvas phải theo kịp,
    // nếu chỉ nghe window.resize thì độ phân giải canvas bị cũ và chữ nhòe, méo.
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.container);
    }

    this.resize();
    this._rafId = null;
    this._running = true;
    this._loop = (now) => {
      if (!this._running) return;
      this.renderFrame(now);
      this._rafId = requestAnimationFrame(this._loop);
    };
    this._rafId = requestAnimationFrame(this._loop);
  }

  destroy() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._ro) this._ro.disconnect();
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('dragover', this._onDragOver);
    this.canvas.removeEventListener('drop', this._onDrop);
  }

  seedAmbient(seed) {
    const rng = createRng(seed);
    this.particles = [];
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: Math.round(rng() * (STAGE.W - 24) + 12),
        y: Math.round(rng() * (STAGE.FLOOR_Y - 36) + 18),
        phase: Math.round(rng() * 100),
        speed: 0.25 + rng() * 0.5,
        size: rng() > 0.65 ? 2 : 1,
      });
    }
  }

  resize() {
    if (!this.container) return;
    // Dùng kích thước layout (clientWidth/Height) chứ không dùng getBoundingClientRect:
    // khi sách đang mở ra, #lesson bị CSS transform thu nhỏ → đo rect sẽ ra canvas độ phân
    // giải thấp và kẹt luôn như vậy (transform không kích hoạt resize) → chữ nhòe.
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cssW = Math.max(160, Math.floor(this.container.clientWidth || window.innerWidth));
    const cssH = Math.max(90, Math.floor(this.container.clientHeight || window.innerHeight));
    const W = Math.round(cssW * this.dpr);
    const H = Math.round(cssH * this.dpr);
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;

    // Tỉ lệ ĐỒNG NHẤT cho cả 2 trục (trước đây object-fit: fill kéo giãn pixel theo khung).
    // Sân khấu 320×180 được đặt vừa trong vùng không bị thanh điều khiển dưới che.
    const ins = this.getInsets() || {};
    const top = Math.max(0, (ins.top || 0) * this.dpr);
    const bottom = Math.max(0, (ins.bottom || 0) * this.dpr);
    const availH = Math.max(STAGE.H, H - top - bottom);
    const s = Math.max(0.5, Math.min(W / STAGE.W, availH / STAGE.H));
    const stageW = STAGE.W * s;
    const stageH = STAGE.H * s;
    const ox = Math.round((W - stageW) / 2);
    const oy = Math.round(top + Math.max(0, (availH - stageH) / 2));
    // Phần dư quanh sân khấu được vẽ tiếp nền thế giới (tường gạch, sàn) cho liền mạch
    const padX = Math.ceil(ox / s) + 1;
    const padY = Math.ceil(Math.max(oy, H - oy - stageH) / s) + 1;
    this.view = { s, ox, oy, padX, padY };

  }

  /** Toạ độ logic (0..320, 0..180) → toạ độ client (CSS px) trên màn hình */
  logicalToClient(lx, ly) {
    const rect = this.canvas.getBoundingClientRect();
    const k = rect.width ? this.canvas.width / rect.width : 1;
    const { s, ox, oy } = this.view;
    return {
      x: rect.left + (ox + lx * s) / k,
      y: rect.top + (oy + ly * s) / k,
    };
  }

  /** Đo bề rộng chữ (theo đơn vị pixel logic) đúng với font vẽ High-DPI */
  measureLogical(text, size = 3.3) {
    const s = this.view.s || 1;
    const fontPx = Math.max(10, Math.round(size * s));
    this.ctx.save();
    this.ctx.font = `800 ${fontPx}px "JetBrains Mono", "Plus Jakarta Sans", Consolas, monospace`;
    const w = this.ctx.measureText(String(text || '')).width;
    this.ctx.restore();
    return w / s;
  }

  setLens(lens) {
    this.lens = ['story', 'bridge', 'abstract'].includes(lens) ? lens : 'bridge';
  }

  /** Vật đang được Python "tính tới" ở bước nhỏ hiện tại (id hoặc mảng id); null = không */
  setFocus(ids) {
    const arr = [].concat(ids ?? []).filter(Boolean);
    this.focusIds = arr.length ? new Set(arr) : null;
  }

  /** Hình chữ nhật (toạ độ client) của vật đang vẽ — dùng để nối dây từ dòng code tới vật */
  getObjectClientRect(id) {
    const p = this._drawnPos.get(id) || (this.curStep?.objects || []).find((o) => o.id === id);
    if (!p) return null;
    const a = this.logicalToClient(p.x, p.y);
    const b = this.logicalToClient(p.x + (p.w || 40), p.y + (p.h || 30));
    return { left: a.x, top: a.y, right: b.x, bottom: b.y, width: b.x - a.x, height: b.y - a.y };
  }

  setSpeed(mult) {
    this.speed = mult || 1;
  }

  setSnapshot(snapshot, animate = true) {
    const now = performance.now();
    this.curLesson = snapshot.lesson;
    this.curOptionId = snapshot.optionId;
    const nextWorld = snapshot.lesson.world || 'memory';
    if (nextWorld !== this.world) {
      this.world = nextWorld;
      this.seedAmbient((snapshot.lesson.idx + 1) * 97);
    }

    if (animate && !this.reducedMotion && this.curStep) {
      this.prevStep = this.curStep;
      this.tweenStartMs = now;
      this.tweenDurMs = Math.round(motion.dur.md / this.speed);
    } else {
      this.prevStep = null;
      this.tweenStartMs = 0;
    }

    this.curStep = snapshot.step;
    this.isErrorState = Boolean(snapshot.step && snapshot.step.error);
    this.errorStartMs = this.isErrorState ? now : 0;
  }

  clientToLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: -1, y: -1 };
    const k = this.canvas.width / rect.width;
    const { s, ox, oy } = this.view;
    const x = Math.floor(((clientX - rect.left) * k - ox) / s);
    const y = Math.floor(((clientY - rect.top) * k - oy) / s);
    return { x, y };
  }

  isDropMachine(obj) {
    if (!obj) return false;
    return (
      Boolean(obj.isDropTarget) ||
      ['printer', 'disc_presser', 'shipper_gate', 'loot_chest', 'kitchen_hatch'].includes(obj.kind)
    );
  }

  findDropTarget(lx, ly) {
    if (!this.curStep || !this.curStep.objects) return null;
    for (const o of this.curStep.objects) {
      if (this.isDropMachine(o)) {
        const pad = 18; // Vùng hút nam châm quanh máy in giúp thả dễ dàng
        if (
          lx >= o.x - pad &&
          lx <= o.x + (o.w || 40) + pad &&
          ly >= o.y - pad &&
          ly <= o.y + (o.h || 50) + pad
        ) {
          return o;
        }
      }
    }
    return null;
  }

  getDefaultDropMachine() {
    if (!this.curStep || !this.curStep.objects) return null;
    return this.curStep.objects.find((o) => this.isDropMachine(o)) || null;
  }

  hitTest(lx, ly) {
    if (!this.curStep) return null;
    const objs = this.curStep.objects || [];
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      const ox = o.x || 0;
      const oy = o.y || 0;
      const ow = o.w || 40;
      const oh = o.h || 30;
      if (lx >= ox - 3 && lx <= ox + ow + 3 && ly >= oy - 10 && ly <= oy + oh + 3) {
        return o;
      }
    }
    const m = this.curStep.mascot;
    if (m) {
      if (
        lx >= m.x - 2 &&
        lx <= m.x + STAGE.CHIBI + 2 &&
        ly >= m.y - 2 &&
        ly <= m.y + STAGE.CHIBI + 2
      ) {
        const wMeta = WORLDS[this.world] || WORLDS.memory;
        return {
          id: 'mascot-bit',
          kind: 'mascot',
          x: m.x,
          y: m.y,
          w: STAGE.CHIBI,
          h: STAGE.CHIBI,
          label: 'Mascot Bit',
          inspect: `Nhân vật Bit (${wMeta.name}) · Kéo một vật thể trên bàn thả vào ${wMeta.machineName} để xem Bit thực thi!`,
        };
      }
    }
    return null;
  }

  // ==========================================================================
  // XỬ LÝ KÉO-THẢ & CLICK TRỰC TIẾP VẬT THỂ TRONG CẢNH (TÁO, SỮA, BÁNH -> MÁY IN)
  // ==========================================================================
  handlePointerDown(e) {
    if (e.button !== 0) return;
    const { x, y } = this.clientToLogical(e.clientX, e.clientY);
    const hit = this.hitTest(x, y);
    if (hit && hit.optId) {
      this.dragState = {
        obj: hit,
        optId: hit.optId,
        startX: x,
        startY: y,
        curX: x,
        curY: y,
        offsetX: Math.max(6, Math.min((hit.w || 40) - 6, x - hit.x)),
        offsetY: Math.max(6, Math.min((hit.h || 30) - 6, y - hit.y)),
        isDragging: false,
        overTarget: null,
      };
      this.canvas.style.cursor = 'grabbing';
      this.onInspectObject(null, null);
    } else if (hit) {
      this.inspectedObjectId = hit.id;
      const p = this.logicalToClient(hit.x + (hit.w || 32) / 2, hit.y);
      this.onInspectObject(hit, { screenX: p.x, screenY: p.y });
    } else {
      this.inspectedObjectId = null;
      this.onInspectObject(null, null);
    }
  }

  handlePointerMove(e) {
    const { x, y } = this.clientToLogical(e.clientX, e.clientY);
    if (this.dragState) {
      this.dragState.curX = Math.max(8, Math.min(STAGE.W - 8, x));
      this.dragState.curY = Math.max(8, Math.min(STAGE.H - 8, y));
      const dist = Math.hypot(
        this.dragState.curX - this.dragState.startX,
        this.dragState.curY - this.dragState.startY,
      );
      if (dist > 3) {
        this.dragState.isDragging = true;
      }
      this.dragState.overTarget = this.findDropTarget(this.dragState.curX, this.dragState.curY);
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const hit = this.hitTest(x, y);
    this.hoveredObjectId = hit ? hit.id : null;
    if (hit && hit.optId) {
      this.canvas.style.cursor = 'grab';
    } else if (hit) {
      this.canvas.style.cursor = 'pointer';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  handlePointerUp() {
    if (!this.dragState) return;
    const ds = this.dragState;
    this.dragState = null;
    this.canvas.style.cursor = 'default';

    if (ds.isDragging) {
      // Nếu thả vào máy sản xuất hoặc kéo về phía máy sản xuất (>= 24px sang phải)
      if (ds.overTarget || ds.curX >= 175 || ds.curX - ds.startX >= 24) {
        this.onSelectOption(ds.optId, { via: 'drag', obj: ds.obj });
      }
    } else {
      // Nếu click trực tiếp vào vật thể có optId (như ngăn "táo", "sữa", "bánh", "kem")
      this.onSelectOption(ds.optId, { via: 'click', obj: ds.obj });
    }
  }

  handleHtmlDragOver(e) {
    e.preventDefault();
    const { x, y } = this.clientToLogical(e.clientX, e.clientY);
    this.hoveredObjectId = this.findDropTarget(x, y)?.id || this.getDefaultDropMachine()?.id || null;
  }

  handleHtmlDrop(e) {
    e.preventDefault();
    this.hoveredObjectId = null;
    const droppedOptId = e.dataTransfer?.getData('text/plain');
    if (droppedOptId) {
      this.onSelectOption(droppedOptId, { via: 'html-drop' });
    }
  }

  // ==========================================================================
  // VÒNG LẶP VẼ FRAME (320×180 PIXEL BUFFER -> HIGH-DPI DISPLAY + CRISP TEXT)
  // ==========================================================================
  renderFrame(now) {
    // Vẽ THẲNG lên canvas hiển thị ở độ phân giải thật (không qua bộ đệm 320×180 rồi phóng
    // to nữa): toạ độ logic 320×180 được nhân tỉ lệ bằng transform → khối code sắc cạnh,
    // ảnh minh hoạ AI hiển thị đúng độ nét gốc.
    const g = this.ctx;
    const pal = accents[this.world] || accents.memory;
    this.textQueue = [];

    let tweenT = 1;
    if (this.prevStep && this.tweenDurMs > 0) {
      const elapsed = now - this.tweenStartMs;
      tweenT = Math.min(1, Math.max(0, elapsed / this.tweenDurMs));
      if (tweenT >= 1) this.prevStep = null;
    }
    const easedT = motion.easeSine(tweenT);

    let shakeX = 0;
    let shakeY = 0;
    let freezeAnim = false;
    if (this.isErrorState) {
      const errElapsed = now - this.errorStartMs;
      if (!this.reducedMotion && errElapsed < motion.dur.errorShake) {
        shakeX = Math.round(Math.sin(errElapsed * 0.09) * 3);
        shakeY = Math.round(Math.cos(errElapsed * 0.12) * 2);
      } else {
        freezeAnim = true;
      }
    }
    this._curShakeX = shakeX;
    this._curShakeY = shakeY;

    const spriteTick = freezeAnim
      ? 1
      : Math.floor((now * this.speed) / (1000 / motion.spriteFps));

    const { s, ox, oy } = this.view;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = base.ink;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.save();
    g.setTransform(s, 0, 0, s, ox + shakeX * s, oy + shakeY * s);
    g.imageSmoothingEnabled = true;

    const abstract = this.lens === 'abstract';
    // 1. Nền: thế giới ẩn dụ, hoặc nền lưới trơn ở lớp "Code" (bỏ hết trang trí)
    if (abstract) this.drawAbstractBackground(g, pal);
    else this.drawWorldBackground(g, pal, spriteTick);

    // 2. Hạt ambient
    if (!abstract && !this.reducedMotion && !freezeAnim) {
      this.drawAmbientParticles(g, pal, spriteTick);
    }

    // Tiêu điểm của bước tính hiện tại: vật liên quan sáng, vật khác mờ đi
    const focus = this.lens !== 'story' && this.focusIds && this.focusIds.size ? this.focusIds : null;
    const chips = [];
    const focusDrawn = [];
    this._drawnPos = new Map();

    // 3. Các vật thể trong cảnh
    const machineObj = this.getDefaultDropMachine();
    if (this.curStep && this.curStep.objects) {
      const prevMap = new Map();
      const curIds = new Set(this.curStep.objects.map((o) => o.id));
      if (this.prevStep && this.prevStep.objects) {
        for (const po of this.prevStep.objects) prevMap.set(po.id, po);
        // Vật biến mất ở bước mới: mờ dần thay vì biến mất đột ngột
        for (const po of this.prevStep.objects) {
          if (curIds.has(po.id)) continue;
          this.drawSceneObject(g, { ...po, _alpha: 1 - easedT }, pal, spriteTick);
        }
      }

      for (const obj of this.curStep.objects) {
        const po = prevMap.get(obj.id);
        const ox = po ? Math.round(po.x + (obj.x - po.x) * easedT) : Math.round(obj.x);
        let oy = po ? Math.round(po.y + (obj.y - po.y) * easedT) : Math.round(obj.y);
        let alpha = 1;
        // Vật mới xuất hiện: hiện dần + nảy nhẹ (bảng lỗi bật ra kiểu back-out)
        if (!po && this.prevStep) {
          alpha = easedT;
          const pop = obj.kind === 'jam_alert' ? motion.easeBackOut(tweenT) : easedT;
          oy = Math.round(obj.y - (1 - pop) * 8);
        }
        const isBeingDragged =
          this.dragState && this.dragState.isDragging && this.dragState.obj.id === obj.id;
        // Tiến độ "lớn dần" cho biểu đồ (cột equalizer mọc lên, đường vẽ dần)
        const sameChart =
          po && po.vizMode === obj.vizMode && Boolean(po.empty) === Boolean(obj.empty);
        const growT = sameChart ? 1 : this.prevStep ? easedT : 1;
        const isFocus = Boolean(focus && focus.has(obj.id));
        const dim = Boolean(focus && !isFocus && obj.kind !== 'jam_alert');
        const drawn = { ...obj, x: ox, y: oy, _beingDragged: isBeingDragged, _alpha: alpha, _growT: growT, _focus: isFocus, _dim: dim };
        this.drawSceneObject(g, drawn, pal, spriteTick);
        if (isFocus) focusDrawn.push(drawn);
        this._drawnPos.set(obj.id, { x: ox, y: oy, w: obj.w || 40, h: obj.h || 30 });
        // Nhãn code: hiện trên vật đang được tính (hoặc tất cả khi bước không có tiêu điểm)
        if (this.lens === 'bridge' && obj.code && (!focus || isFocus)) chips.push(drawn);
      }
    }

    // 3b. Vòng tiêu điểm + nhãn code vẽ đè lên trên mọi vật
    for (const o of focusDrawn) this.drawFocusRing(g, o, now);
    for (const o of chips) this.drawCodeChip(g, o, Boolean(focus));

    // 4. Vẽ đường chỉ dẫn kéo vật thể vào máy sản xuất (khi ở bước tương tác hoặc đang kéo)
    if (this.dragState && this.dragState.isDragging && machineObj) {
      this.drawActiveDragLayer(g, this.dragState, machineObj, pal, spriteTick);
    } else if (this.curStep && this.curStep.isInteraction && machineObj) {
      this.drawDragHintArc(g, machineObj, pal, spriteTick);
    }

    // 5. Vẽ Mascot Bit (32x32 pixel chibi) — ẩn ở lớp "Code" để chỉ còn dữ liệu
    if (!abstract && this.curStep && this.curStep.mascot) {
      const cm = this.curStep.mascot;
      const pm = this.prevStep && this.prevStep.mascot ? this.prevStep.mascot : null;
      const mx = pm ? Math.round(pm.x + (cm.x - pm.x) * easedT) : Math.round(cm.x);
      const my = pm ? Math.round(pm.y + (cm.y - pm.y) * easedT) : Math.round(cm.y);
      const isMoving = pm && Math.abs(cm.x - pm.x) > 3 && tweenT < 0.95;
      const pose = isMoving ? 'walk' : cm.pose || 'idle';
      let sayText = cm.say;
      if (this.dragState && this.dragState.isDragging) {
        sayText = this.dragState.overTarget
          ? 'Thả vào máy luôn!'
          : `Kéo ${this.dragState.obj.label} vào máy!`;
      }
      this.drawMascotBit(g, mx, my, pose, sayText, pal, spriteTick);
    }

    // 6. Hiệu ứng sản phẩm bay từ máy sản xuất vào Khay sản phẩm
    if (this.curStep && this.curStep.justPrinted && tweenT < 1) {
      this.drawFlyingProduct(g, this.curStep.justPrinted, easedT, pal, machineObj);
    }

    g.restore();

    // Ánh sáng theo thế giới + làm tối mép (mượt, ở độ phân giải thật, nằm dưới lớp chữ)
    this.drawLighting(now, spriteTick);

    // Vẽ toàn bộ chữ/nhãn ở độ phân giải màn hình thật (High-DPI) -> Sắc nét 100%
    this.flushHighDpiText();
  }

  // ==========================================================================
  // HIỆU ỨNG KÉO-THẢ VẬT THỂ VÀO MÁY IN TRÊN CANVAS
  // ==========================================================================
  drawDragHintArc(g, machine, pal, tick) {
    // Có vật kéo được ngay trong cảnh (vd. ngăn tủ M1) → mũi tên đi từ cụm vật sang máy.
    // Không có → mũi tên đi từ thanh thẻ lệnh phía dưới lên máy (tránh bảo người học
    // "kéo vật trên bàn" trong khi vật trên bàn không mang lựa chọn nào).
    const sceneDraggable = (this.curStep.objects || []).some((o) => o.optId);
    const startX = sceneDraggable ? 118 : 96;
    const startY = sceneDraggable ? 74 : STAGE.H - 6;
    const endX = Math.round(machine.x + (machine.w || 40) / 2);
    const endY = Math.round(machine.y + 8);
    const lift = sceneDraggable ? 16 : 30;
    const segs = 16;
    const march = tick % 4;
    g.fillStyle = pal.a2;
    for (let i = 0; i <= segs; i++) {
      if ((i + march) % 4 >= 2) continue;
      const t = i / segs;
      const px = Math.round(startX + (endX - startX) * t);
      const py = Math.round(startY + (endY - startY) * t - Math.sin(t * Math.PI) * lift);
      g.fillRect(px, py, 2, 2);
    }
    // Đầu mũi tên chỉ xuống khe nhận của máy
    g.fillStyle = base.amber1;
    g.fillRect(endX - 3, endY - 6, 7, 2);
    g.fillRect(endX - 2, endY - 4, 5, 2);
    g.fillRect(endX - 1, endY - 2, 3, 2);

    // Bảng chỉ dẫn nhỏ sắc nét phía trên bàn
    const text = sceneDraggable
      ? `👆 Kéo vật thể thả vào ${machine.label || 'Máy'} ⤵`
      : `👇 Kéo thẻ lệnh bên dưới thả vào ${machine.label || 'Máy'}`;
    const tw = Math.min(200, Math.ceil(this.measureLogical(text, 3.1)) + 10);
    const bx = Math.max(4, Math.round(132 - tw / 2));
    this.fillBorderRect(g, bx, 46, tw, 13, base.uiBg, pal.a2, base.amber1);
    this.enqueueText(text, bx + tw / 2, 55, base.amber1, { size: 3.1 });
  }

  drawActiveDragLayer(g, ds, machine, pal, tick) {
    const mx = Math.round(machine.x);
    const my = Math.round(machine.y);
    const mw = Math.round(machine.w || 42);
    const mh = Math.round(machine.h || 50);

    // Viền sáng nhấp nháy quanh Máy sản xuất (Drop Target)
    const targetCol = ds.overTarget ? base.ok : base.amber1;
    g.fillStyle = targetCol;
    g.fillRect(mx - 3, my - 3, mw + 6, 2);
    g.fillRect(mx - 3, my + mh + 1, mw + 6, 2);
    g.fillRect(mx - 3, my - 3, 2, mh + 6);
    g.fillRect(mx + mw + 1, my - 3, 2, mh + 6);

    // Nhãn mời thả trên đầu Máy sản xuất
    this.fillBorderRect(g, mx - 18, my - 18, mw + 36, 13, targetCol, base.ink, base.paper);
    this.enqueueText(
      ds.overTarget ? '⬇ THẢ VÀO ĐÂY!' : `⬇ Thả vào ${machine.label}`,
      mx + mw / 2,
      my - 9,
      base.ink,
      { size: 3.1 },
    );

    // Đường nối chấm từ vật đang kéo tới khe nhận của máy
    const tx = mx + Math.round(mw / 2);
    const ty = my + Math.round(mh / 2);
    g.fillStyle = targetCol;
    for (let i = 1; i <= 10; i++) {
      if ((i + tick) % 2 === 0) continue;
      const t = i / 10;
      const lx = Math.round(ds.curX + (tx - ds.curX) * t);
      const ly = Math.round(ds.curY + (ty - ds.curY) * t);
      g.fillRect(lx - 1, ly - 1, 2, 2);
    }

    // Vẽ vật thể đang được kéo nổi dưới con trỏ chuột
    const dw = Math.min(52, ds.obj.w || 44);
    const dh = Math.min(34, ds.obj.h || 30);
    const dx = Math.round(ds.curX - dw / 2);
    const dy = Math.round(ds.curY - dh / 2);

    // Bóng đổ dưới vật đang kéo
    g.fillStyle = base.ink;
    g.fillRect(dx + 3, dy + 4, dw, dh);

    const isErrOpt = Boolean(ds.obj.isErrorOpt);
    this.fillBorderRect(
      g,
      dx,
      dy,
      dw,
      dh,
      isErrOpt ? base.err : pal.a1,
      base.ink,
      base.amber1,
    );
    if (ds.obj.foodIcon) {
      this.drawPixelFoodIcon(g, ds.obj.foodIcon, dx + 6, dy + 7, pal);
    }
    this.enqueueText(ds.obj.label || '', dx + dw / 2 + (ds.obj.foodIcon ? 4 : 0), dy + 13, base.paper, {
      size: 3.4,
    });
    if (ds.obj.inside) {
      this.enqueueText(
        `Giá: ${ds.obj.inside}`,
        dx + dw / 2,
        dy + dh - 5,
        base.amber1,
        { size: 3.1 },
      );
    }
  }

  // ==========================================================================
  // 1. NỀN 5 THẾ GIỚI (BÀN & KHO · DJ · SHIPPER · DUNGEON · QUÁN)
  //    Vẽ tràn ra phần dư quanh sân khấu; chi tiết tất định (hash) nên không nhấp nháy.
  // ==========================================================================
  drawWorldBackground(g, pal, tick) {
    const T = STAGE.TILE;
    const x0 = -Math.ceil(this.view.padX / T) * T - T;
    const x1 = STAGE.W + this.view.padX + T;
    const y0 = -Math.ceil(this.view.padY / T) * T - T;
    const y1 = STAGE.H + this.view.padY + T;
    const F = STAGE.FLOOR_Y;
    const ext = { x0, x1, y0, y1, F };

    // Có ảnh nền minh hoạ (AI) → vẽ ảnh nền + đồ nội thất chức năng (bàn, bục…)
    const bgImg = getSprite(`bg_${this.world}`);
    if (bgImg) {
      this.drawBgImage(g, bgImg, ext);
      this.drawWorldFurniture(g, pal, tick, ext);
      return;
    }

    if (this.world === 'memory') this.bgMemory(g, pal, tick, ext);
    else if (this.world === 'dj') this.bgDj(g, pal, tick, ext);
    else if (this.world === 'city') this.bgCity(g, pal, tick, ext);
    else if (this.world === 'dungeon') this.bgDungeon(g, pal, tick, ext);
    else this.bgKitchen(g, pal, tick, ext);

    this.drawFloor(g, pal, ext);
  }

  /**
   * Ảnh nền 16:9 khớp đúng khung sân khấu 320×180 (sàn ~78% trùng FLOOR_Y);
   * phần dư hai bên/trên/dưới (màn hình khác tỉ lệ) kéo dãn dải mép ảnh cho liền mạch.
   */
  drawBgImage(g, img, ext) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const W = STAGE.W;
    const H = STAGE.H;
    // Căn mép sàn trong ảnh (tỉ lệ chiều cao) trùng FLOOR_Y của cảnh
    const floorRatio = BG_FLOOR[this.world] ?? STAGE.FLOOR_Y / STAGE.H;
    const dy = Math.round(STAGE.FLOOR_Y - floorRatio * H);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, iw, ih, 0, dy, W, H);
    const e = 2; // độ dày dải mép lấy mẫu (px ảnh)
    const top = dy;
    const bottom = dy + H;
    if (ext.x0 < 0) {
      g.drawImage(img, 0, 0, e, ih, ext.x0, top, -ext.x0, H);
      g.drawImage(img, iw - e, 0, e, ih, W, top, ext.x1 - W, H);
    }
    // Phần trên/dưới còn trống (do lệch sàn hoặc màn hình cao) → kéo dãn dải mép
    if (ext.y0 < top) g.drawImage(img, 0, 0, iw, e, ext.x0, ext.y0, ext.x1 - ext.x0, top - ext.y0);
    if (ext.y1 > bottom) g.drawImage(img, 0, ih - e, iw, e, ext.x0, bottom, ext.x1 - ext.x0, ext.y1 - bottom);
    // Nền nhiều màu → phủ tối nhẹ phần tường để vật trong cảnh nổi hơn nền
    const dim = BG_DIM[this.world];
    if (dim) {
      g.save();
      g.globalAlpha = dim;
      g.fillStyle = base.ink;
      g.fillRect(ext.x0, ext.y0, ext.x1 - ext.x0, STAGE.FLOOR_Y - ext.y0);
      g.restore();
    }
  }

  /** Đồ nội thất có vai trò trong cảnh (vật đặt lên) — vẽ trên ảnh nền minh hoạ */
  drawWorldFurniture(g, pal, tick, ext) {
    const F = ext.F;
    if (this.world === 'memory') {
      if (!drawSprite(g, 'table_long', 2, 112, 222, F - 112 + 2, { fit: 'fill' })) {
        this.fillBorderRect(g, 8, 118, 210, 6, base.wood1, base.ink, base.amber1);
        g.fillStyle = base.wood3;
        g.fillRect(16, 124, 6, F - 124);
        g.fillRect(204, 124, 6, F - 124);
      }
    } else if (this.world === 'dj') {
      if (!drawSprite(g, 'dj_desk', 30, 114, 186, F - 114 + 2, { fit: 'fill' })) {
        this.fillBorderRect(g, 36, 118, 174, 7, base.shade, base.ink, pal.a2);
        g.fillStyle = base.ink;
        g.fillRect(46, 125, 6, F - 125);
        g.fillRect(196, 125, 6, F - 125);
      }
    } else if (this.world === 'city') {
      if (!drawSprite(g, 'city_platform', 32, 113, 186, 12, { fit: 'fill' })) {
        this.fillBorderRect(g, 38, 116, 172, 6, base.shade, base.ink, pal.a1);
      }
    } else if (this.world === 'kitchen') {
      if (!drawSprite(g, 'kitchen_counter', 34, 122, 180, F - 122 + 2, { fit: 'fill' })) {
        this.fillBorderRect(g, 40, 126, 168, 14, base.wood2, base.ink, base.wood1);
      }
    }
  }

  /** Tường gạch: mỗi viên một sắc độ nhẹ khác nhau (tất định) */
  drawBrickWall(g, ext, yTop, yBot, brick, mortar, bw = 16, bh = 8) {
    g.fillStyle = mortar;
    g.fillRect(ext.x0, yTop, ext.x1 - ext.x0, yBot - yTop);
    const yStart = yTop - (((yTop % bh) + bh) % bh);
    for (let y = yStart; y < yBot; y += bh) {
      const row = Math.round(y / bh);
      const off = ((row % 2) + 2) % 2 ? bw / 2 : 0;
      for (let x = ext.x0 - bw + off; x < ext.x1; x += bw) {
        const r = hash2(Math.round(x / bw), row);
        g.fillStyle = r < 0.18 ? mix(brick, base.ink, 0.22) : r > 0.86 ? mix(brick, base.paper, 0.06) : brick;
        const top = Math.max(y, yTop);
        const hgt = Math.min(y + bh - 1, yBot) - top;
        if (hgt > 0) g.fillRect(x, top, bw - 1, hgt);
      }
    }
  }

  drawFloor(g, pal, ext) {
    const F = ext.F;
    const top = this.world === 'city' ? base.gray2 : this.world === 'dj' ? pal.a2 : this.world === 'dungeon' ? base.mid : base.wood1;
    const body = this.world === 'city' || this.world === 'dj' ? base.ink : this.world === 'dungeon' ? base.ink2 : base.wood3;
    g.fillStyle = base.ink;
    g.fillRect(ext.x0, F - 1, ext.x1 - ext.x0, 1);
    g.fillStyle = top;
    g.fillRect(ext.x0, F, ext.x1 - ext.x0, 3);
    // Sàn đậm dần về phía người xem (3 dải) cho có chiều sâu
    for (let i = 0; i < 3; i++) {
      g.fillStyle = mix(body, base.ink, i * 0.18);
      const yy = F + 3 + i * 10;
      g.fillRect(ext.x0, yy, ext.x1 - ext.x0, i === 2 ? ext.y1 - yy : 10);
    }
    if (this.world === 'city') {
      g.fillStyle = pal.a1;
      for (let x = ext.x0 + 12; x < ext.x1; x += 28) g.fillRect(x, F + 14, 14, 3);
    } else if (this.world === 'dj') {
      // Sàn sân khấu: lưới neon phối cảnh
      g.fillStyle = mix(pal.a1, base.ink, 0.55);
      for (let x = ext.x0; x < ext.x1; x += 24) g.fillRect(x, F + 3, 1, ext.y1 - F);
      g.fillRect(ext.x0, F + 12, ext.x1 - ext.x0, 1);
      g.fillRect(ext.x0, F + 26, ext.x1 - ext.x0, 1);
    } else if (this.world === 'dungeon') {
      g.fillStyle = base.ink;
      for (let x = ext.x0; x < ext.x1; x += 20) g.fillRect(x + ((x / 20) % 2 ? 10 : 0), F + 3, 1, 12);
      g.fillRect(ext.x0, F + 14, ext.x1 - ext.x0, 1);
    } else {
      // Ván gỗ: khe ván + vân gỗ
      g.fillStyle = mix(base.wood3, base.ink, 0.35);
      for (let x = ext.x0; x < ext.x1; x += 32) g.fillRect(x, F + 3, 1, ext.y1 - F);
      g.fillStyle = mix(base.wood3, base.wood2, 0.4);
      for (let x = ext.x0 + 6; x < ext.x1; x += 32) g.fillRect(x + Math.floor(hash1(x) * 14), F + 7, 8, 1);
    }
  }

  bgMemory(g, pal, tick, ext) {
    const { x0, x1, y0, F } = ext;
    this.drawBrickWall(g, ext, y0, 100, base.uiBg, base.ink2);
    // Ốp gỗ chân tường
    g.fillStyle = mix(base.wood3, base.ink, 0.45);
    g.fillRect(x0, 100, x1 - x0, F - 100);
    g.fillStyle = base.wood2;
    g.fillRect(x0, 100, x1 - x0, 2);
    g.fillStyle = mix(base.wood3, base.ink, 0.6);
    for (let x = x0; x < x1; x += 24) g.fillRect(x, 104, 1, F - 106);

    // Đèn treo trần
    g.fillStyle = base.ink;
    g.fillRect(44, y0, 1, 10 - y0);
    this.fillBorderRect(g, 36, 10, 18, 7, base.amber2, base.ink, base.amber1);
    g.fillStyle = base.paper;
    g.fillRect(43, 17, 4, 2);

    // Kệ gỗ phía sau + đồ trên kệ
    this.fillBorderRect(g, 12, 40, 200, 5, base.wood2, base.ink, base.wood1);
    g.fillStyle = base.wood3;
    g.fillRect(18, 45, 5, 55);
    g.fillRect(202, 45, 5, 55);
    const jars = [
      { x: 24, w: 8, h: 11, c: pal.a1 },
      { x: 34, w: 8, h: 8, c: pal.a4 },
      { x: 120, w: 10, h: 12, c: pal.a2 },
      { x: 180, w: 9, h: 9, c: base.amber1 },
    ];
    for (const j of jars) {
      this.fillBorderRect(g, j.x, 40 - j.h, j.w, j.h, j.c, base.ink, base.paper);
      g.fillStyle = base.wood3;
      g.fillRect(j.x + 1, 40 - j.h, j.w - 2, 2);
    }
    const books = [pal.a3, pal.a1, base.lav, pal.a4, base.amber2];
    books.forEach((c, i) => this.fillBorderRect(g, 56 + i * 5, 40 - 13 + (i % 2), 5, 13 - (i % 2), c, base.ink));
    this.fillBorderRect(g, 146, 30, 22, 10, base.wood1, base.ink, base.amber1);

    // Mặt bàn gỗ dài tại y=118 (đỡ đúng đáy các ngăn tủ y=86, h=32)
    this.fillBorderRect(g, 8, 118, 210, 6, base.wood1, base.ink, base.amber1);
    g.fillStyle = base.wood3;
    g.fillRect(16, 124, 6, F - 124);
    g.fillRect(204, 124, 6, F - 124);
  }

  bgDj(g, pal, tick, ext) {
    const { x0, x1, y0, F } = ext;
    // Tường sân khấu chuyển sắc theo dải
    for (let y = y0; y < F; y += 6) {
      const t = Math.max(0, Math.min(1, (y + 20) / (F + 20)));
      g.fillStyle = mix(base.ink, pal.a4, 0.35 + t * 0.65);
      g.fillRect(x0, y, x1 - x0, 6);
    }
    // Tấm tiêu âm hình thoi
    g.fillStyle = mix(pal.a4, base.ink, 0.35);
    for (let y = 50; y < 112; y += 12) {
      for (let x = x0 + ((y / 12) % 2 ? 6 : 0); x < x1; x += 12) g.fillRect(x, y, 6, 6);
    }
    // Giàn đèn + chùm sáng (mờ, đổi màu theo nhịp)
    g.fillStyle = base.ink;
    g.fillRect(x0, 4, x1 - x0, 3);
    const lamps = [40, 110, 180, 250];
    lamps.forEach((lx, i) => {
      const c = [pal.a1, pal.a2, pal.a3, pal.a1][i];
      this.fillBorderRect(g, lx - 4, 6, 9, 6, base.ink2, base.ink, c);
      if (!this.reducedMotion || i % 2 === 0) {
        const on = this.reducedMotion || (tick + i * 3) % 12 < 8;
        if (on) {
          g.save();
          g.globalAlpha *= 0.1;
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(lx - 2, 12);
          g.lineTo(lx + 3, 12);
          g.lineTo(lx + 26 - i * 6, F);
          g.lineTo(lx - 26 + i * 4, F);
          g.closePath();
          g.fill();
          g.restore();
        }
      }
    });
    g.fillStyle = pal.a1;
    g.fillRect(x0, 42, x1 - x0, 2);
    g.fillStyle = mix(pal.a1, base.ink, 0.5);
    g.fillRect(x0, 44, x1 - x0, 1);

    this.drawSpeaker(g, 6, 74, 26, 62, pal, tick);
    this.drawSpeaker(g, 296, 74, 26, 62, pal, tick + 1);
    // Bàn DJ
    this.fillBorderRect(g, 36, 118, 174, 7, base.shade, base.ink, pal.a2);
    g.fillStyle = pal.a1;
    for (let x = 44; x < 204; x += 8) g.fillRect(x, 121, 3, 1);
    g.fillStyle = base.ink;
    g.fillRect(46, 125, 6, F - 125);
    g.fillRect(196, 125, 6, F - 125);
  }

  bgCity(g, pal, tick, ext) {
    const { x0, x1, y0, F } = ext;
    // Bầu trời đêm chuyển sắc
    for (let y = y0; y < F; y += 4) {
      const t = Math.max(0, Math.min(1, (y + 10) / F));
      g.fillStyle = mix(mix(pal.a3, base.ink, 0.55), mix(pal.a3, pal.a2, 0.25), t);
      g.fillRect(x0, y, x1 - x0, 4);
    }
    // Sao
    for (let i = 0; i < 40; i++) {
      const sx = Math.floor(x0 + hash1(i * 7 + 1) * (x1 - x0));
      const sy = Math.floor(y0 + hash1(i * 13 + 5) * (60 - y0));
      const tw = this.reducedMotion ? 1 : (tick + i) % 9 === 0 ? 0 : 1;
      if (!tw) continue;
      g.fillStyle = i % 5 === 0 ? base.amber1 : base.pale;
      g.fillRect(sx, sy, 1, 1);
    }
    // Trăng
    this.drawDisc(g, 278, 20, 8, base.paper, mix(base.paper, base.lav, 0.4));
    g.fillStyle = mix(base.paper, base.lav, 0.35);
    g.fillRect(275, 17, 2, 2);
    g.fillRect(281, 22, 3, 2);

    // Dãy nhà xa (bóng mờ)
    g.fillStyle = mix(pal.a3, base.ink, 0.25);
    for (let x = x0; x < x1; x += 14) {
      const hgt = 30 + Math.floor(hash1(Math.round(x / 14) + 99) * 40);
      g.fillRect(x, F - hgt, 13, hgt);
    }
    // Nhà gần: cửa sổ sáng tối khác nhau
    const buildings = [
      { x: 10, y: 46, w: 34 },
      { x: 48, y: 36, w: 42 },
      { x: 96, y: 52, w: 38 },
      { x: 140, y: 40, w: 46 },
      { x: 190, y: 58, w: 40 },
    ];
    buildings.forEach((b, bi) => {
      this.fillBorderRect(g, b.x, b.y, b.w, F - b.y, base.ink2, base.ink, base.shade);
      g.fillStyle = base.ink;
      g.fillRect(b.x + 3, b.y - 3, b.w - 6, 3);
      if (bi % 2 === 0) g.fillRect(b.x + Math.floor(b.w / 2), b.y - 10, 1, 7);
      for (let wy = b.y + 7; wy < F - 26; wy += 12) {
        for (let wx = b.x + 5; wx < b.x + b.w - 7; wx += 9) {
          const r = hash2(wx, wy);
          g.fillStyle = r < 0.45 ? mix(base.ink2, base.ink, 0.3) : r < 0.85 ? pal.a1 : base.paper;
          g.fillRect(wx, wy, 4, 6);
          if (r >= 0.45) {
            g.fillStyle = mix(pal.a1, base.ink, 0.3);
            g.fillRect(wx, wy + 5, 4, 1);
          }
        }
      }
    });
    // Đèn đường
    g.fillStyle = base.ink;
    g.fillRect(302, 62, 2, F - 62);
    g.fillRect(294, 60, 10, 2);
    this.fillBorderRect(g, 290, 61, 8, 4, base.amber1, base.ink, base.paper);
    // Vỉa hè / bục giao hàng
    this.fillBorderRect(g, 38, 116, 172, 6, base.shade, base.ink, pal.a1);
  }

  bgDungeon(g, pal, tick, ext) {
    const { x0, x1, y0, F } = ext;
    this.drawBrickWall(g, ext, y0, F, mix(base.shade, base.ink2, 0.45), base.ink, 20, 10);
    // Rêu & vết nứt
    for (let i = 0; i < 26; i++) {
      const mx = Math.floor(x0 + hash1(i * 31 + 3) * (x1 - x0));
      const my = Math.floor(20 + hash1(i * 17 + 9) * (F - 30));
      g.fillStyle = i % 3 ? mix(base.ok, base.ink, 0.45) : mix(pal.a1, base.ink, 0.3);
      g.fillRect(mx, my, 3 + (i % 3), 1);
      g.fillRect(mx + 1, my + 1, 1, 1);
    }
    // Xích treo
    for (const cx of [96, 238]) {
      for (let y = y0; y < 34; y += 4) {
        g.fillStyle = (y / 4) % 2 ? base.gray2 : base.gray1;
        g.fillRect(cx, y, 2, 3);
      }
      this.fillBorderRect(g, cx - 3, 34, 8, 6, base.gray2, base.ink, base.gray1);
    }
    // Cờ hiệu
    this.fillBorderRect(g, 150, 12, 18, 26, pal.a1, base.ink, pal.a3);
    g.fillStyle = base.amber1;
    g.fillRect(157, 20, 4, 4);
    this.drawTorch(g, 18, 62, pal, tick);
    this.drawTorch(g, 210, 62, pal, tick + 2);
    g.fillStyle = pal.a1;
    g.fillRect(60, F - 3, 160, 3);
  }

  bgKitchen(g, pal, tick, ext) {
    const { x0, x1, y0, F } = ext;
    this.drawBrickWall(g, ext, y0, 52, base.uiBg, base.ink2);
    // Gạch men ốp bếp
    const t1 = mix(base.pale, base.shade, 0.62);
    const t2 = mix(base.pale, base.shade, 0.7);
    g.fillStyle = base.ink2;
    g.fillRect(x0, 52, x1 - x0, F - 52);
    for (let y = 52; y < F; y += 9) {
      for (let x = x0; x < x1; x += 9) {
        g.fillStyle = ((x / 9 + y / 9) & 1) === 0 ? t1 : t2;
        g.fillRect(x, y, 8, 8);
      }
    }
    // Kệ + đĩa, hũ gia vị
    this.fillBorderRect(g, 18, 46, 192, 6, base.wood2, base.ink, base.wood1);
    [30, 44, 58].forEach((px) => this.drawDisc(g, px, 39, 6, base.paper, base.pale));
    [150, 162, 174].forEach((px, i) => this.fillBorderRect(g, px, 36, 8, 10, [pal.a1, pal.a2, pal.a4][i], base.ink, base.paper));
    // Thanh treo dụng cụ
    g.fillStyle = base.gray2;
    g.fillRect(20, 56, 44, 1);
    g.fillStyle = base.gray1;
    g.fillRect(26, 57, 1, 10);
    this.drawDisc(g, 27, 70, 4, base.gray2, base.gray1);
    g.fillRect(42, 57, 1, 14);
    this.fillBorderRect(g, 39, 70, 7, 3, base.gray2, base.ink, base.gray1);
    g.fillRect(56, 57, 1, 8);
    this.fillBorderRect(g, 52, 64, 9, 9, base.wood2, base.ink, base.wood1);
    // Quầy bếp có cánh tủ
    this.fillBorderRect(g, 40, 126, 168, 14, base.wood2, base.ink, base.wood1);
    g.fillStyle = base.wood3;
    for (let x = 82; x < 208; x += 42) g.fillRect(x, 128, 1, 11);
    g.fillStyle = base.amber1;
    for (let x = 58; x < 208; x += 42) g.fillRect(x, 132, 4, 1);
  }

  drawSpeaker(g, x, y, w, h, pal, tick) {
    this.fillBorderRect(g, x, y, w, h, base.ink2, base.ink, base.shade);
    const pulse = !this.reducedMotion && tick % 2 === 0 ? 1 : 0;
    const cx = x + Math.floor(w / 2);
    this.drawDisc(g, cx, y + 13, 6, base.ink, pal.a2);
    this.drawDisc(g, cx, y + 38, 8 + pulse, base.ink, pal.a1);
    g.fillStyle = pal.a3;
    g.fillRect(cx - 1, y + 37, 3, 3);
  }

  drawTorch(g, x, y, pal, tick) {
    g.fillStyle = base.wood3;
    g.fillRect(x, y + 6, 4, 12);
    g.fillStyle = base.gray2;
    g.fillRect(x - 1, y + 5, 6, 2);
    const flicker = this.reducedMotion ? 1 : tick % 3;
    g.fillStyle = base.err;
    g.fillRect(x - 1, y, 6, 6);
    g.fillStyle = base.amber2;
    g.fillRect(x, y - (flicker === 0 ? 3 : 1), 4, 5);
    g.fillStyle = base.amber1;
    g.fillRect(x + 1, y - (flicker === 0 ? 1 : 0), 2, 3);
  }

  drawAmbientParticles(g, pal, tick) {
    for (const p of this.particles) {
      const span = STAGE.FLOOR_Y - 24;
      const y = (((p.y - Math.floor(tick * p.speed + p.phase)) % span) + span) % span + 12;
      const x = p.x + Math.round(Math.sin((tick + p.phase) * 0.2) * 2);
      g.fillStyle =
        this.world === 'dj' ? pal.a2 : this.world === 'dungeon' ? base.amber1 : this.world === 'kitchen' ? base.paper : this.world === 'city' ? pal.a1 : base.lav;
      g.save();
      g.globalAlpha *= this.world === 'kitchen' ? 0.45 : 0.8;
      g.fillRect(x, y, p.size, p.size);
      g.restore();
    }
  }

  // ==========================================================================
  // 2. ÁNH SÁNG & KHÔNG KHÍ (vẽ ở độ phân giải thật, mượt, dưới lớp chữ)
  // ==========================================================================
  drawLighting(now, tick) {
    const ctx = this.ctx;
    const { s, ox, oy } = this.view;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const pal = accents[this.world] || accents.memory;
    const P = (lx, ly) => [ox + lx * s, oy + ly * s];
    const flick = this.reducedMotion ? 1 : 0.9 + 0.1 * Math.sin(now / 140);
    const lights = {
      memory: [{ x: 44, y: 16, r: 120, c: base.amber1, a: 0.16 }],
      kitchen: [{ x: 120, y: 0, r: 160, c: base.amber1, a: 0.13 }],
      dj: [
        { x: 60, y: 10, r: 110, c: pal.a1, a: 0.14 * (this.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(now / 300)) },
        { x: 250, y: 10, r: 110, c: pal.a2, a: 0.12 },
      ],
      city: [
        { x: 278, y: 20, r: 80, c: pal.a2, a: 0.12 },
        { x: 294, y: 66, r: 60, c: base.amber1, a: 0.14 },
      ],
      dungeon: [
        { x: 20, y: 62, r: 80, c: base.amber2, a: 0.2 * flick },
        { x: 212, y: 62, r: 80, c: base.amber2, a: 0.2 * flick },
      ],
    }[this.world] || [];
    if (this.lens === 'abstract') lights.length = 0;
    // Nền minh hoạ ban ngày đã có ánh sáng riêng → đèn & tối mép chỉ nhẹ thôi
    const dayArt = this.lens !== 'abstract' && Boolean(getSprite(`bg_${this.world}`));
    if (dayArt) lights.length = 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const [cx, cy] = P(L.x, L.y);
      const r = L.r * s;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, rgba(L.c, L.a));
      grd.addColorStop(1, rgba(L.c, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // Tối dần ở mép để mắt tập trung vào giữa cảnh
    const [vx, vy] = P(150, 96);
    const R = Math.hypot(W, H) * 0.62;
    const vig = ctx.createRadialGradient(vx, vy, R * 0.32, vx, vy, R);
    vig.addColorStop(0, rgba(base.ink, 0));
    vig.addColorStop(1, rgba(base.ink, dayArt ? 0.3 : 0.6));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    // Đang lỗi: viền đỏ nhẹ
    if (this.isErrorState) {
      const e = ctx.createRadialGradient(vx, vy, R * 0.45, vx, vy, R);
      e.addColorStop(0, rgba(base.err, 0));
      e.addColorStop(1, rgba(base.err, 0.22));
      ctx.fillStyle = e;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ==========================================================================
  // 3. VẼ VẬT THỂ TRONG CẢNH (THEO KIND CỦA 5 THẾ GIỚI)
  // ==========================================================================
  drawSceneObject(g, obj, pal, tick) {
    const x = Math.round(obj.x || 0);
    const y = Math.round(obj.y || 0);
    const w = Math.round(obj.w || 40);
    const h = Math.round(obj.h || 30);
    const isHovered = this.hoveredObjectId === obj.id || this.inspectedObjectId === obj.id;

    const alpha =
      Math.max(0, Math.min(1, obj._alpha ?? 1)) * (obj._beingDragged ? 0.38 : 1) * (obj._dim ? 0.32 : 1);
    if (alpha <= 0.01) return;
    g.save();
    g.globalAlpha = alpha;
    this._curAlpha = alpha;

    if (this.lens === 'abstract') {
      this.drawAbstractObject(g, x, y, w, h, obj, pal);
      g.restore();
      this._curAlpha = 1;
      return;
    }

    // Bóng đổ xuống mặt bàn / sàn cho vật đặt dưới đất
    if (GROUNDED.has(obj.kind)) this.drawGroundShadow(g, x, y + h, w);
    else if (FLOATING.has(obj.kind)) this.drawFloatShadow(g, x, y, w, h);

    if (obj.jammed) {
      const cx = x + Math.round(w / 2);
      const cy = y + Math.round(h / 2);
      g.translate(cx, cy);
      g.rotate(0.08);
      g.translate(-cx, -cy);
    }

    // Viền sáng khi highlight hoặc hover (2 lớp: quầng mờ + viền sắc)
    if (obj.highlight || isHovered) {
      const col = obj.error || obj.jammed ? base.err : isHovered && obj.optId ? pal.a1 : base.amber1;
      g.save();
      g.globalAlpha *= 0.35;
      g.fillStyle = col;
      g.fillRect(x - 4, y - 4, w + 8, h + 8);
      g.restore();
      g.fillStyle = col;
      g.fillRect(x - 2, y - 1, w + 4, h + 2);
      g.fillRect(x - 1, y - 2, w + 2, h + 4);
    }

    const fn = {
      drawer: this.drawDrawer,
      drawer_ghost: this.drawGhostBox,
      tag_card: this.drawTagCard,
      storage_box: this.drawStorageBox,
      printer: this.drawPrinterMachine,
      dj_pad: this.drawDjPad,
      viz_frame: this.drawVizFrame,
      disc_presser: this.drawDiscPresser,
      parcel: this.drawParcel,
      shipper_gate: this.drawShipperGate,
      dungeon_portal: this.drawDungeonPortal,
      slime: this.drawSlime,
      loot_chest: this.drawLootChest,
      lock_hook: this.drawLockHook,
      stove_pan: this.drawStovePan,
      fridge: this.drawFridge,
      queue_window: this.drawQueueWindow,
      pos_terminal: this.drawPosTerminal,
      kitchen_hatch: this.drawKitchenHatch,
      jam_alert: this.drawJamAlert,
      chef: this.drawChef,
      hour_ledger: this.drawHourLedger,
      distance_ruler: this.drawDistanceRuler,
      wall_clock: this.drawWallClock,
    }[obj.kind];
    if (this.drawSpriteObject(g, x, y, w, h, obj, pal, tick)) {
      /* đã vẽ bằng ảnh minh hoạ + lớp dữ liệu */
    } else if (fn) fn.call(this, g, x, y, w, h, obj, pal, tick);
    else {
      this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, base.lav);
      this.enqueueText(obj.label || obj.id, x + w / 2, y + h / 2 + 2, base.paper);
    }

    if (obj.jammed && obj.kind !== 'chef' && obj.kind !== 'jam_alert') {
      this.fillBorderRect(g, x + w - 8, y - 5, 10, 10, base.err, base.ink, base.amber1);
      this.enqueueText('!', x + w - 3, y + 2, base.paper, { size: 3.4 });
    }

    g.restore();
    this._curAlpha = 1;
  }

  // ==========================================================================
  // VẼ BẰNG ẢNH MINH HOẠ (phong cách B): ảnh làm thân vật, code vẽ lớp dữ liệu
  // (nhãn, giá trị, trạng thái) đè lên. Trả false → dùng hàm vẽ code cũ.
  // ==========================================================================
  /** Thẻ chữ nhỏ nền đặc để chữ luôn đọc rõ trên ảnh */
  drawChip(g, cx, y, text, bg = base.ink, fg = base.paper, size = 2.9) {
    if (!text) return;
    const tw = Math.ceil(this.measureLogical(text, size)) + 6;
    const x = Math.round(cx - tw / 2);
    this.fillBorderRect(g, x, y, tw, 10, bg, mix(bg, base.ink, 0.5));
    this.enqueueText(text, cx, y + 7.5, fg, { size });
  }

  drawSpriteObject(g, x, y, w, h, obj, pal, tick) {
    const cx = x + w / 2;
    const bob = this.reducedMotion || obj.jammed ? 0 : tick % 2;
    switch (obj.kind) {
      case 'dj_pad': {
        if (!drawSprite(g, 'dj_pad', x - 2, y - 2, w + 4, h + 4, { fit: 'fill' })) return false;
        const lit = obj.highlight && !obj.muted;
        // Tô màu mặt pad theo trạng thái: sáng (mask True) / tắt tiếng (False)
        g.save();
        g.globalAlpha *= lit ? 0.55 : obj.muted ? 0.55 : 0;
        g.fillStyle = lit ? pal.a1 : base.ink;
        g.fillRect(x + 3, y + 2, w - 6, h - 9);
        g.restore();
        this.enqueueText(obj.label || '', cx, y + h / 2, obj.muted ? base.gray1 : base.ink, { size: 3.1 });
        if (obj.sub) this.enqueueText(obj.sub, x + w - 4, y + h - 9, obj.muted ? base.gray2 : base.shade, { size: 2.4, align: 'right' });
        if (obj.maskBit !== undefined) this.drawChip(g, cx, y + h + 1, obj.maskBit ? 'True' : 'False', obj.maskBit ? base.ok : base.ink2, obj.maskBit ? base.ink : base.gray1, 2.6);
        if (obj.picked) {
          g.fillStyle = base.amber1;
          g.beginPath();
          g.moveTo(cx - 4, y - 9);
          g.lineTo(cx + 4, y - 9);
          g.lineTo(cx, y - 4);
          g.closePath();
          g.fill();
        }
        return true;
      }
      case 'disc_presser': {
        if (!drawSprite(g, 'disc_presser', x - 4, y - 6, w + 8, h + 6)) return false;
        if (obj.active) {
          g.save();
          g.globalAlpha *= 0.35 + 0.15 * (tick % 2);
          g.fillStyle = pal.a2;
          g.beginPath();
          g.arc(cx, y + 20, 13, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        this.drawLabelPlate(g, x - 2, y - 18, w + 4, obj.label || 'Máy ép đĩa', base.ink2, pal.a2, base.paper);
        return true;
      }
      case 'parcel': {
        const name = obj.variant === 'rider' ? 'scooter' : 'parcel';
        if (!drawSprite(g, name, x - 2, y - (obj.variant === 'rider' ? 8 : 2), w + 4, h + (obj.variant === 'rider' ? 8 : 2))) return false;
        this.drawChip(g, cx, y + h / 2 - 3, obj.label || '', base.paper, base.ink, 2.9);
        return true;
      }
      case 'shipper_gate': {
        if (!drawSprite(g, 'shipper_gate', x - 4, y - 6, w + 8, h + 6)) return false;
        if (obj.active && !drawSprite(g, 'parcel', x + 8, y + 22, w - 16, 14)) this.fillBorderRect(g, x + 9, y + 24, w - 18, 12, base.wood1, base.ink);
        this.drawLabelPlate(g, x - 2, y - 18, w + 4, obj.label || 'Trạm Shipper', base.ink2, pal.a1, base.paper);
        return true;
      }
      case 'dungeon_portal': {
        if (!drawSprite(g, 'dungeon_portal', x - 4, y - 6, w + 8, h + 6)) return false;
        this.drawLabelPlate(g, x - 2, y - 18, w + 4, obj.label || 'class Slime', base.ink2, pal.a3, base.paper);
        return true;
      }
      case 'slime': {
        const angry = obj.angry || (obj.label || '').includes('duoi_theo');
        const k = angry ? 3 : obj.variant === 'ice' ? 2 : 1;
        if (!drawSprite(g, `slimes_${k}`, x, y + 2 - bob, w, h - 2 + bob)) return false;
        this.drawLabelPlate(g, x - 2, y - 10, w + 4, obj.label || 'Slime', base.ink2, angry ? base.err : pal.a3, base.paper);
        return true;
      }
      case 'loot_chest': {
        if (obj.active) {
          g.save();
          g.globalAlpha *= 0.45;
          g.fillStyle = base.amber1;
          g.beginPath();
          g.arc(cx, y + 14, 22, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        if (!drawSprite(g, 'loot_chest', x - 4, y - 2, w + 8, h + 2)) return false;
        this.drawLabelPlate(g, x - 2, y - 14, w + 4, obj.label || 'Rương đồ', base.ink2, base.amber1, base.paper);
        return true;
      }
      case 'stove_pan': {
        if (!drawSprite(g, 'stove', x - 4, y - 8, w + 8, h + 8)) return false;
        if (obj.jammed) {
          g.save();
          g.globalAlpha *= 0.6;
          this.drawDisc(g, x + 22, y - 6, 5, base.gray2, base.ink2);
          this.drawDisc(g, x + 34, y - 11, 6, base.gray2, base.ink2);
          g.restore();
        }
        this.drawChip(g, cx, y + h - 11, obj.label || '', obj.jammed ? base.err : base.ink, obj.jammed ? base.paper : base.amber1, 3.0);
        return true;
      }
      case 'fridge': {
        if (!drawSprite(g, 'fridge', x - 2, y - 2, w + 4, h + 2)) return false;
        const n = Math.max(0, Math.min(6, obj.items ?? 0));
        const cols = [pal.a1, pal.a2, base.amber1, pal.a4, base.err, base.ok];
        for (let i = 0; i < n; i++) {
          g.fillStyle = cols[i];
          g.beginPath();
          g.arc(x + 9 + i * 6, y + h * 0.62, 2.4, 0, Math.PI * 2);
          g.fill();
        }
        this.drawLabelPlate(g, x - 1, y - 13, w + 2, obj.label || 'Tủ lạnh', base.ink2, pal.a2, base.paper, 3.0);
        return true;
      }
      case 'queue_window': {
        if (!drawSprite(g, 'queue_window', x - 2, y - 4, w + 4, h + 4, { fit: 'fill' })) return false;
        this.drawChip(g, cx, y + h / 2 - 4, obj.label || 'Queue', base.ink, base.amber1, 2.9);
        return true;
      }
      case 'pos_terminal': {
        if (!drawSprite(g, 'pos_terminal', x - 2, y - 4, w + 4, h + 4)) return false;
        if (obj.jammed) {
          g.save();
          g.globalAlpha *= 0.4;
          g.fillStyle = base.err;
          g.fillRect(x + 6, y + 4, w - 12, h * 0.45);
          g.restore();
        }
        this.drawChip(g, cx, y + h * 0.22, obj.label || 'POS', obj.jammed ? base.err : base.ink, obj.jammed ? base.paper : base.ok, 2.8);
        return true;
      }
      case 'kitchen_hatch': {
        if (!drawSprite(g, 'kitchen_hatch', x - 4, y - 6, w + 8, h + 6)) return false;
        g.fillStyle = obj.active ? base.ok : base.gray2;
        g.beginPath();
        g.arc(x + w - 4, y + 3, 2.5, 0, Math.PI * 2);
        g.fill();
        this.drawLabelPlate(g, x - 2, y - 18, w + 4, obj.label || 'Bếp ra món', base.ink2, pal.a1, base.paper);
        return true;
      }
      case 'lock_hook': {
        if (!drawSprite(g, 'lock_hook', x - 2, y - 4, w + 4, h + 6, { fit: 'fill' })) return false;
        this.drawChip(g, cx, y + h - 2, obj.label || 'Lock', obj.jammed ? base.err : base.ink, obj.jammed ? base.paper : base.amber1, 2.8);
        return true;
      }
      case 'wall_clock': {
        if (!drawSprite(g, 'wall_clock', x - 2, y - 2, w + 4, h + 4, { align: 'center' })) return false;
        // Kim giây vẽ bằng code: chạy theo nhịp, đứng im khi đơ
        const r = Math.min(w, h) / 2;
        const a = obj.jammed || this.reducedMotion ? -0.6 : ((tick % 24) / 24) * Math.PI * 2;
        g.strokeStyle = obj.jammed ? base.err : base.err;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + r, y + r);
        g.lineTo(x + r + Math.sin(a) * (r - 3), y + r - Math.cos(a) * (r - 3));
        g.stroke();
        if (obj.jammed) {
          g.save();
          g.globalAlpha *= 0.35;
          g.fillStyle = base.err;
          g.beginPath();
          g.arc(x + r, y + r, r, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        this.enqueueText(obj.label || '', x + r, y + h + 7, obj.jammed ? base.err : base.ink, { size: 2.7 });
        return true;
      }
      case 'chef': {
        const k = (obj.variant === 'B' ? 3 : 1) + (obj.pose === 'work' && !obj.jammed ? 1 : 0);
        if (!getSprite(`chefs_${k}`)) return false;
        g.save();
        g.globalAlpha *= 0.4;
        g.fillStyle = base.ink;
        g.beginPath();
        g.ellipse(cx, y + h + 1, 9, 2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        drawSprite(g, `chefs_${k}`, x - 8, y - 10 - bob, w + 16, h + 10);
        const hy = y + 6;
        if (obj.holding === 'key') this.fillBorderRect(g, cx + 7, hy, 6, 6, base.amber1, base.ink, base.paper);
        else if (obj.holding === 'pan') this.fillBorderRect(g, cx + 7, hy + 2, 10, 4, base.gray2, base.ink, base.gray1);
        else if (obj.holding === 'stove') this.fillBorderRect(g, cx - 17, hy, 10, 6, base.err, base.ink, base.amber2);
        const apron = obj.variant === 'B' ? pal.a4 : pal.a1;
        this.enqueueText(obj.label || 'Thread', cx, y + h + 8, apron, { size: 2.8 });
        if (obj.say) {
          const tw = Math.ceil(this.measureLogical(obj.say, 2.8)) + 8;
          const bY = y - 24;
          this.fillBorderRect(g, cx - tw / 2, bY, tw, 10, obj.jammed ? base.err : base.paper, base.ink, base.pale);
          this.enqueueText(obj.say, cx, bY + 7, obj.jammed ? base.paper : base.ink, { size: 2.8 });
        }
        return true;
      }
      case 'storage_box': {
        if (!getSprite('storage_box')) return false;
        // Dây buộc + nhãn tên (refcount) vẽ trước, hộp vẽ đè lên đầu dây
        const ropes = obj.ropes || [];
        const cut = obj.cut || [];
        const all = [...ropes.map((n) => ({ n, live: true })), ...cut.map((n) => ({ n, live: false }))];
        all.forEach((r, i) => {
          const ry = y + 9 + i * 14;
          if (r.live) {
            g.strokeStyle = i === 0 ? pal.a1 : pal.a4;
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(x - 22, ry);
            g.quadraticCurveTo(x - 10, ry + 4, x + 4, ry);
            g.stroke();
            this.drawChip(g, x - 37, ry - 5, r.n, base.paper, base.ink, 2.7);
          } else {
            g.strokeStyle = base.gray2;
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(x + 4, ry);
            g.lineTo(x - 6, ry + 5);
            g.stroke();
            this.drawChip(g, x - 37, ry, r.n, base.ink2, base.gray1, 2.7);
            g.fillStyle = base.err;
            g.fillRect(x - 50, ry + 5, 26, 1);
          }
        });
        drawSprite(g, 'storage_box', x - 2, y - 4, w + 4, h + 4, { fit: 'fill' });
        this.drawChip(g, cx, y + h / 2 - 5, obj.label || '', base.ink, base.amber1, 3.0);
        return true;
      }
      default:
        return false;
    }
  }

  /** Vòng "kiến bò" quanh vật đang được Python tính tới ở bước nhỏ hiện tại */
  drawFocusRing(g, o, now) {
    const x = Math.round(o.x) - 4;
    const y = Math.round(o.y) - 4;
    const w = Math.round(o.w || 40) + 8;
    const h = Math.round(o.h || 30) + 8;
    const march = this.reducedMotion ? 0 : Math.floor(now / 90) % 4;
    const col = o.error || o.jammed ? base.err : base.amber1;
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = col;
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.restore();
    g.fillStyle = col;
    const dash = (len, fn) => {
      for (let k = 0; k < len; k++) if ((k + march) % 4 < 2) fn(k);
    };
    dash(w, (k) => g.fillRect(x + k, y, 1, 1));
    dash(w, (k) => g.fillRect(x + w - 1 - k, y + h - 1, 1, 1));
    dash(h, (k) => g.fillRect(x + w - 1, y + k, 1, 1));
    dash(h, (k) => g.fillRect(x, y + h - 1 - k, 1, 1));
    // Góc đậm cho dễ thấy
    [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]].forEach(([cx, cy]) => g.fillRect(cx, cy, 3, 3));
  }

  /** Nhãn code dưới chân vật: nói thẳng vật này là gì trong Python */
  drawCodeChip(g, o, strong) {
    const text = String(o.code);
    const tw = Math.ceil(this.measureLogical(text, 2.7)) + 6;
    const cx = Math.round(o.x + (o.w || 40) / 2);
    const below = o.kind === 'dj_pad' ? 9 : 2;
    const y = Math.min(STAGE.H - 11, Math.round(o.y + (o.h || 30) + below));
    const x = Math.max(2, Math.min(STAGE.W - tw - 2, cx - Math.round(tw / 2)));
    const bg = strong ? base.amber1 : base.ink;
    this.fillBorderRect(g, x, y, tw, 9, bg, strong ? base.ink : base.amber1);
    // Gạch nối chip với vật
    g.fillStyle = strong ? base.amber1 : base.amber2;
    g.fillRect(cx, y - below, 1, below);
    this.enqueueText(text, x + tw / 2, y + 7, strong ? base.ink : base.amber1, { size: 2.7 });
  }

  /** Lớp "Code": nền lưới trơn, không trang trí — chỉ còn dữ liệu */
  drawAbstractBackground(g, pal) {
    const T = STAGE.TILE;
    const x0 = -Math.ceil(this.view.padX / T) * T - T;
    const x1 = STAGE.W + this.view.padX + T;
    const y0 = -Math.ceil(this.view.padY / T) * T - T;
    const y1 = STAGE.H + this.view.padY + T;
    g.fillStyle = base.ink;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = mix(base.ink, base.shade, 0.45);
    for (let y = y0; y < y1; y += 8) for (let x = x0; x < x1; x += 8) g.fillRect(x, y, 1, 1);
    g.fillStyle = mix(base.ink, base.shade, 0.7);
    g.fillRect(x0, STAGE.FLOOR_Y, x1 - x0, 1);
  }

  /** Lớp "Code": mỗi vật là một hộp mang tên biểu thức Python + giá trị */
  drawAbstractObject(g, x, y, w, h, obj, pal) {
    if (obj.kind === 'jam_alert') return this.drawJamAlert(g, x, y, w, h, obj);
    const focused = obj._focus;
    const isErr = obj.jammed || obj.isErrorOpt || obj.error;
    const border = isErr ? base.err : focused ? base.amber1 : base.mid;
    if (obj.kind === 'drawer_ghost') {
      g.fillStyle = border;
      for (let dx = x; dx < x + w; dx += 4) {
        g.fillRect(dx, y, 2, 1);
        g.fillRect(dx, y + h - 1, 2, 1);
      }
      for (let dy = y; dy < y + h; dy += 4) {
        g.fillRect(x, dy, 1, 2);
        g.fillRect(x + w - 1, dy, 1, 2);
      }
    } else {
      this.fillBorderRect(g, x, y, w, h, base.ink2, border, mix(base.ink2, base.paper, 0.08));
    }
    const head = obj.code || KIND_NAMES[obj.kind] || obj.kind;
    if (h >= 18) {
      g.fillStyle = focused ? mix(base.amber1, base.ink, 0.65) : base.shade;
      g.fillRect(x + 1, y + 1, w - 2, 8);
      this.enqueueText(head, x + w / 2, y + 7, focused ? base.amber1 : base.pale, { size: 2.6 });
      this.enqueueText(obj.label || '', x + w / 2, y + 9 + Math.round((h - 9) / 2) + 2, isErr ? base.err : base.paper, { size: 2.8 });
      if (obj.inside && obj.kind === 'drawer') this.enqueueText(`= ${obj.inside}`, x + w / 2, y + h - 3, base.ok, { size: 2.6 });
    } else {
      const t = obj.code && obj.label ? `${obj.code}: ${obj.label}` : obj.label || head;
      this.enqueueText(t, x + w / 2, y + Math.round(h / 2) + 3, isErr ? base.err : focused ? base.amber1 : base.paper, { size: 2.8 });
    }
  }

  drawGroundShadow(g, x, yb, w) {
    // Bóng elip mềm dưới chân vật (hợp phong cách phẳng hơn 2 vạch pixel)
    g.save();
    g.globalAlpha *= 0.28;
    g.fillStyle = base.ink;
    g.beginPath();
    g.ellipse(x + w / 2, yb + 0.5, w / 2, 2.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  drawFloatShadow(g, x, y, w, h) {
    g.save();
    g.globalAlpha *= 0.35;
    g.fillStyle = base.ink;
    g.fillRect(x + 2, y + h, w - 2, 2);
    g.fillRect(x + w, y + 2, 2, h);
    g.restore();
  }

  /** Hình tròn pixel (tô từng hàng) — dùng cho đĩa, trăng, mặt đồng hồ… */
  drawDisc(g, cx, cy, r, fill, rim) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      if (rim) {
        g.fillStyle = rim;
        g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
      }
      const inner = Math.floor(Math.sqrt(Math.max(0, (r - 1) * (r - 1) - dy * dy)));
      if (Math.abs(dy) < r) {
        g.fillStyle = fill;
        g.fillRect(cx - inner, cy + dy, inner * 2 + 1, 1);
      }
    }
  }

  /** Icon đồ vật 8×8 pixel cho Táo, Sữa, Bánh, Kem */
  drawPixelFoodIcon(g, iconType, ix, iy, pal) {
    const k = { tao: 1, sua: 2, banh: 3, kem: 4 }[iconType];
    if (k && drawSprite(g, `food_icons_${k}`, ix - 2, iy - 2, 12, 12, { align: 'center' })) return;
    if (iconType === 'tao') {
      g.fillStyle = base.ok;
      g.fillRect(ix + 4, iy, 3, 2);
      g.fillStyle = base.wood3;
      g.fillRect(ix + 3, iy, 1, 3);
      this.fillBorderRect(g, ix, iy + 2, 8, 7, base.err, base.ink, pal.a4);
      g.fillStyle = base.paper;
      g.fillRect(ix + 2, iy + 4, 1, 1);
    } else if (iconType === 'sua') {
      this.fillBorderRect(g, ix + 1, iy, 6, 3, pal.a2, base.ink, base.paper);
      this.fillBorderRect(g, ix, iy + 2, 8, 7, base.paper, base.ink, pal.a2);
      g.fillStyle = pal.a1;
      g.fillRect(ix + 2, iy + 5, 4, 2);
    } else if (iconType === 'banh') {
      this.fillBorderRect(g, ix, iy + 2, 8, 7, base.amber1, base.ink, base.paper);
      g.fillStyle = base.paper;
      g.fillRect(ix + 1, iy + 3, 6, 1);
      g.fillStyle = base.err;
      g.fillRect(ix + 3, iy, 2, 2);
    } else if (iconType === 'kem') {
      this.fillBorderRect(g, ix + 1, iy, 6, 5, pal.a4, base.ink, base.paper);
      this.fillBorderRect(g, ix + 2, iy + 4, 4, 5, base.wood1, base.ink, base.amber1);
    }
  }

  drawLabelPlate(g, x, y, w, text, body, border, textCol, size = 3.1) {
    this.fillBorderRect(g, x, y, w, 11, body, border, mix(body, base.paper, 0.25));
    this.enqueueText(text, x + w / 2, y + 8, textCol, { size });
  }

  drawDrawer(g, x, y, w, h, obj, pal) {
    if (drawSprite(g, 'drawer', x - 3, y - 3, w + 6, h + 4)) {
      // Ảnh minh hoạ làm thân tủ; nhãn khóa, món và giá trị vẫn vẽ bằng code đè lên.
      // Ngăn mở: dùng cùng ảnh + lớp sáng vẽ bằng code (giữ đồng bộ phong cách)
      if (obj.open) {
        g.save();
        g.globalAlpha *= 0.55;
        g.fillStyle = pal.a1;
        g.fillRect(x + 6, y + 6, w - 12, h - 12);
        g.restore();
        g.fillStyle = pal.a2;
        g.fillRect(x + 6, y + 6, w - 12, 1);
      }
      if (obj.foodIcon) this.drawPixelFoodIcon(g, obj.foodIcon, x + 4, y + 4, pal);
      this.fillBorderRect(g, x + 2, y - 11, w - 4, 11, base.paper, base.ink, base.pale);
      g.fillStyle = base.err;
      g.fillRect(x + Math.round(w / 2), y - 11, 2, 2);
      this.enqueueText(obj.label || '', x + w / 2, y - 2, base.ink, { size: 3.3 });
      if (obj.inside) {
        const t = obj.open ? `→ ${obj.inside}k` : `${obj.inside}k`;
        const tw = Math.ceil(this.measureLogical(t, 3.2)) + 6;
        this.fillBorderRect(g, x + w - tw - 2, y + h - 11, tw, 10, obj.open ? base.amber1 : base.ink, base.ink);
        this.enqueueText(t, x + w - tw / 2 - 2, y + h - 3, obj.open ? base.ink : base.amber1, { size: 3.2 });
      }
      return;
    }
    this.fillBorderRect(g, x, y, w, h, base.wood2, base.ink, base.wood1);
    const pull = obj.open ? 5 : 0;
    // Mặt ngăn kéo (kéo ra khi mở) + vân gỗ
    const fy = y + 4 + pull;
    this.fillBorderRect(g, x + 3, fy, w - 6, h - 8, obj.open ? pal.a1 : base.wood3, base.ink, obj.open ? pal.a2 : base.wood1);
    if (!obj.open) {
      g.fillStyle = mix(base.wood3, base.wood2, 0.5);
      g.fillRect(x + 6, fy + 6, w - 20, 1);
      g.fillRect(x + 12, fy + 14, w - 18, 1);
    } else {
      g.fillStyle = mix(pal.a1, base.ink, 0.3);
      g.fillRect(x + 4, fy + h - 10, w - 8, 1);
    }
    // Tay nắm đồng
    this.fillBorderRect(g, x + Math.round(w / 2) - 5, fy + 2, 10, 3, base.amber2, base.ink, base.amber1);
    if (obj.foodIcon) this.drawPixelFoodIcon(g, obj.foodIcon, x + 6, y + 11 + pull, pal);
    // Nhãn khóa dán trên ngăn (có đinh ghim)
    this.fillBorderRect(g, x + 2, y - 11, w - 4, 11, base.paper, base.ink, base.pale);
    g.fillStyle = base.err;
    g.fillRect(x + Math.round(w / 2), y - 11, 2, 2);
    this.enqueueText(obj.label || '', x + w / 2, y - 2, base.ink, { size: 3.3 });
    if (obj.inside) {
      this.enqueueText(obj.open ? `→ ${obj.inside}k` : `${obj.inside}k`, x + w / 2 + (obj.foodIcon ? 5 : 0), y + h - 7 + pull, obj.open ? base.ink : base.paper, { size: 3.4 });
    }
  }

  drawGhostBox(g, x, y, w, h, obj, pal) {
    // Hộp mặc định (.get() -> 0, None), khóa chưa có ngăn hoặc vị trí không tồn tại
    const isErrCard = Boolean(obj.isErrorOpt);
    g.save();
    g.globalAlpha *= 0.7;
    g.fillStyle = base.uiBg;
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = isErrCard ? base.err : base.gray2;
    for (let dx = x; dx < x + w; dx += 4) {
      g.fillRect(dx, y, 2, 1);
      g.fillRect(dx, y + h - 1, 2, 1);
    }
    for (let dy = y; dy < y + h; dy += 4) {
      g.fillRect(x, dy, 1, 2);
      g.fillRect(x + w - 1, dy, 1, 2);
    }
    if (obj.foodIcon) this.drawPixelFoodIcon(g, obj.foodIcon, x + 5, y + 10, pal);
    if (isErrCard) {
      this.fillBorderRect(g, x + 1, y - 10, w - 2, 11, base.err, base.ink, base.amber1);
      this.enqueueText(obj.label || '?', x + w / 2, y - 2, base.paper, { size: 3.2 });
      this.enqueueText(obj.inside || 'Chưa có', x + w / 2 + (obj.foodIcon ? 4 : 0), y + h - 8, base.amber1, { size: 2.9 });
    } else {
      this.enqueueText(obj.label || '0', x + w / 2, y + Math.round(h / 2) + 3, base.gray1, { size: 3.2 });
    }
  }

  drawTagCard(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, pal.a4 === base.err ? pal.a3 : pal.a4, base.ink, base.paper);
    // Lỗ đục + dây treo của thẻ
    g.fillStyle = base.ink;
    g.fillRect(x + 3, y + Math.floor(h / 2) - 1, 2, 2);
    if (obj.foodIcon) this.drawPixelFoodIcon(g, obj.foodIcon, x + 7, y + Math.max(2, Math.floor(h / 2) - 4), pal);
    this.enqueueText(obj.label || '', x + w / 2 + (obj.foodIcon ? 5 : 2), y + Math.round(h / 2) + 3, base.ink, { size: 3.1 });
    if (obj.smoke) {
      g.save();
      g.globalAlpha *= 0.6;
      [[6, -6, 4], [14, -10, 5], [24, -7, 4]].forEach(([dx, dy, r]) => this.drawDisc(g, x + dx, y + dy, r, base.gray2, base.ink2));
      g.restore();
    }
  }

  drawStorageBox(g, x, y, w, h, obj, pal) {
    // Hộp gỗ trên kệ + dây buộc nhãn: số dây = refcount
    this.fillBorderRect(g, x, y, w, h, base.wood2, base.ink, base.wood1);
    g.fillStyle = base.wood3;
    g.fillRect(x + 2, y + 6, w - 4, 1);
    g.fillRect(x + 2, y + h - 7, w - 4, 1);
    const ropes = obj.ropes || [];
    const cut = obj.cut || [];
    const all = [...ropes.map((n) => ({ n, live: true })), ...cut.map((n) => ({ n, live: false }))];
    all.forEach((r, i) => {
      const ry = y + 8 + i * 14;
      const col = i === 0 ? pal.a1 : pal.a4;
      if (r.live) {
        g.fillStyle = col;
        for (let k = 0; k < 22; k++) g.fillRect(x - 22 + k, ry + Math.round(Math.sin(k / 3) * 1), 1, 2);
        this.fillBorderRect(g, x - 52, ry - 5, 30, 11, base.paper, base.ink, base.pale);
        this.enqueueText(r.n, x - 37, ry + 3, base.ink, { size: 2.7 });
      } else {
        // Dây đã cắt (del): đoạn ngắn rủ xuống, nhãn mờ
        g.fillStyle = base.gray2;
        for (let k = 0; k < 8; k++) g.fillRect(x - 8 + k, ry + Math.floor(k / 2), 1, 2);
        this.fillBorderRect(g, x - 52, ry + 2, 30, 11, base.ink2, base.gray2);
        g.fillStyle = base.err;
        g.fillRect(x - 50, ry + 7, 26, 1); // gạch ngang: tên đã bị del
        this.enqueueText(`${r.n}`, x - 37, ry + 10, base.gray1, { size: 2.7 });
      }
    });
    this.enqueueText(obj.label || '', x + w / 2, y + Math.round(h / 2) + 3, base.paper, { size: 3.2 });
  }

  drawPrinterMachine(g, x, y, w, h, obj, pal, tick) {
    if (drawSprite(g, 'printer', x - 6, y - 8, w + 12, h + 8)) {
      // Trạng thái máy + tem đang in vẽ đè lên ảnh minh hoạ
      const chip = obj.active ? 'ĐANG IN' : 'NHẬN MÓN';
      const cw = Math.ceil(this.measureLogical(chip, 2.6)) + 8;
      this.fillBorderRect(g, x + w / 2 - cw / 2, y + 8, cw, 9, base.ink, obj.active ? base.ok : pal.a2);
      this.enqueueText(chip, x + w / 2, y + 15, obj.active ? base.ok : pal.a2, { size: 2.6 });
      if (obj.active) {
        const slide = this.reducedMotion ? 4 : (tick % 4) + 2;
        this.fillBorderRect(g, x + 9, y + 26, w - 18, 10 + slide, base.paper, base.ink, base.amber1);
        this.enqueueText('TEM GIÁ', x + w / 2, y + 34, base.ink, { size: 2.4 });
      }
      this.drawLabelPlate(g, x - 2, y - 21, w + 4, obj.label || 'Máy in tem', base.ink2, pal.a1, base.paper);
      return;
    }
    // Cuộn giấy trên nóc
    this.fillBorderRect(g, x + 8, y - 4, w - 16, 6, base.paper, base.ink, base.pale);
    this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, base.lav);
    // Khe thông gió hai bên
    g.fillStyle = base.ink2;
    for (let vy = y + 30; vy < y + h - 6; vy += 4) {
      g.fillRect(x + 3, vy, 5, 1);
      g.fillRect(x + w - 8, vy, 5, 1);
    }
    // Màn hình nhận lệnh + đèn trạng thái
    this.fillBorderRect(g, x + 4, y + 6, w - 8, 14, base.ink, base.ink2, pal.a2);
    const blink = this.reducedMotion || tick % 6 < 3;
    g.fillStyle = obj.active ? (blink ? base.ok : mix(base.ok, base.ink, 0.5)) : base.amber1;
    g.fillRect(x + w - 9, y + 8, 3, 3);
    this.enqueueText(obj.active ? 'ĐANG IN' : 'NHẬN MÓN', x + w / 2 - 2, y + 15, obj.active ? base.ok : pal.a2, { size: 2.6 });
    // Khe giấy ra tem
    g.fillStyle = base.ink;
    g.fillRect(x + 5, y + 24, w - 10, 4);
    if (obj.active) {
      const slide = this.reducedMotion ? 4 : (tick % 4) + 2;
      this.fillBorderRect(g, x + 7, y + 26, w - 14, 10 + slide, base.paper, base.ink, base.amber1);
      g.fillStyle = base.gray1;
      g.fillRect(x + 10, y + 30, w - 20, 1);
      this.enqueueText('TEM GIÁ', x + w / 2, y + 35, base.ink, { size: 2.4 });
    }
    this.drawLabelPlate(g, x - 2, y - 16, w + 4, obj.label || 'Máy in tem', base.ink2, pal.a1, base.paper);
  }

  drawDjPad(g, x, y, w, h, obj, pal, tick) {
    const lit = obj.highlight && !obj.muted;
    if (lit && !this.reducedMotion) {
      g.save();
      g.globalAlpha *= 0.3 + (tick % 4) * 0.05;
      g.fillStyle = pal.a1;
      g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.restore();
    }
    const bodyCol = obj.muted ? base.ink2 : lit ? pal.a1 : base.shade;
    const hiCol = obj.muted ? base.shade : lit ? pal.a3 : pal.a2;
    this.fillBorderRect(g, x, y, w, h, bodyCol, base.ink, hiCol);
    // Mặt pad cao su
    g.fillStyle = obj.muted ? base.ink : mix(bodyCol, base.paper, 0.15);
    g.fillRect(x + 3, y + 3, w - 6, h - 12);
    g.fillStyle = obj.muted ? base.gray2 : pal.a2;
    g.fillRect(x + 4, y + h - 7, w - 8, 3);
    this.enqueueText(obj.label || '', x + w / 2, y + Math.round(h / 2) - 1, obj.muted ? base.gray2 : base.paper, { size: 3.1 });
    if (obj.sub) this.enqueueText(obj.sub, x + w - 3, y + h - 9, obj.muted ? base.gray2 : base.pale, { size: 2.4, align: 'right' });
    if (obj.maskBit !== undefined) {
      this.enqueueText(obj.maskBit ? 'True' : 'False', x + w / 2, y + h + 6, obj.maskBit ? base.ok : base.gray2, { size: 2.6 });
    }
    if (obj.picked) {
      g.fillStyle = base.amber1;
      const cx = x + Math.round(w / 2);
      g.fillRect(cx - 3, y - 9, 7, 2);
      g.fillRect(cx - 2, y - 7, 5, 2);
      g.fillRect(cx - 1, y - 5, 3, 2);
    }
  }

  drawVizFrame(g, x, y, w, h, obj, pal, tick) {
    // Figure = vỏ ngoài (khung xám); Axes = vùng vẽ có trục — hai lớp tách bạch
    this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, base.lav);
    g.fillStyle = base.ink2;
    g.fillRect(x + w - 16, y + 3, 3, 3);
    g.fillRect(x + w - 11, y + 3, 3, 3);
    g.fillStyle = base.err;
    g.fillRect(x + w - 6, y + 3, 3, 3);
    this.enqueueText(obj.label || 'Figure (fig)', x + 4, y + 9, base.paper, { size: 3.0, align: 'left' });

    const ax = { x: x + 6, y: y + 12, w: w - 12, h: h - 16 };
    this.fillBorderRect(g, ax.x, ax.y, ax.w, ax.h, base.ink, pal.a2, pal.a4);
    this.enqueueText('ax (Axes)', ax.x + ax.w - 3, ax.y + 7, pal.a2, { size: 2.7, align: 'right' });
    const ox = ax.x + 12;
    const oy = ax.y + ax.h - 9;
    const plotTop = ax.y + 10;
    // Lưới nền mờ
    g.fillStyle = mix(base.ink, base.shade, 0.5);
    for (let gy = oy - 8; gy > plotTop; gy -= 8) g.fillRect(ox + 1, gy, ax.w - 17, 1);
    g.fillStyle = base.gray2;
    g.fillRect(ox, plotTop, 1, oy - plotTop + 1);
    g.fillRect(ox, oy, ax.w - 16, 1);

    const names = obj.names || ['CF', 'Trà', 'Bánh'];
    const vals = obj.vals || [36, 24, 15];
    const slotW = Math.floor((ax.w - 18) / names.length);
    const cx = (i) => ox + 4 + i * slotW + Math.floor(slotW / 2);
    names.forEach((n, i) => this.enqueueText(n, cx(i), oy + 7, base.gray1, { size: 2.6 }));

    if (obj.jammed) {
      this.enqueueText(obj.jamText || 'fig không có .bar()!', ax.x + ax.w / 2, ax.y + ax.h / 2 + 1, base.err, { size: 3.2 });
      return;
    }
    const plotH = oy - plotTop - 2;
    const t = obj._growT ?? 1;
    const maxV = Math.max(1, ...vals);
    const topOf = (v) => oy - Math.round((Math.max(0, v) / maxV) * plotH);
    if (!obj.vizMode) {
      this.enqueueText('trống · chờ lệnh vẽ', ox + (ax.w - 16) / 2, plotTop + plotH / 2 + 2, base.gray2, { size: 2.8 });
      return;
    }
    if (obj.vizMode === 'line') {
      const pts = names.map((_, i) => ({ px: cx(i), py: topOf(vals[i] ?? 0) }));
      const total = pts.length - 1;
      const drawn = t * total;
      g.fillStyle = pal.a2;
      for (let i = 0; i < total; i++) {
        const segT = Math.max(0, Math.min(1, drawn - i));
        if (segT <= 0) break;
        const n = 14;
        for (let k = 0; k <= Math.round(n * segT); k++) {
          g.fillRect(Math.round(pts[i].px + ((pts[i + 1].px - pts[i].px) * k) / n), Math.round(pts[i].py + ((pts[i + 1].py - pts[i].py) * k) / n), 2, 2);
        }
      }
      pts.forEach((p, i) => {
        if (i > drawn + 0.01) return;
        this.fillBorderRect(g, p.px - 2, p.py - 2, 6, 6, pal.a1, base.ink, base.paper);
        this.enqueueText(String(vals[i]), p.px, p.py - 4, base.paper, { size: 2.6 });
      });
    } else {
      const cols = [pal.a1, pal.a2, pal.a3];
      names.forEach((_, i) => {
        const fullH = oy - topOf(vals[i] ?? 0);
        const pulse = t >= 1 && !this.reducedMotion ? ((tick + i) % 3 === 0 ? 1 : 0) : 0;
        const bh = Math.max(2, Math.round(fullH * t) + pulse);
        const bw = Math.min(16, slotW - 6);
        this.fillBorderRect(g, cx(i) - Math.floor(bw / 2), oy - bh, bw, bh, cols[i % 3], base.ink, base.paper);
        if (t >= 0.99) this.enqueueText(String(vals[i]), cx(i), oy - bh - 2, base.paper, { size: 2.6 });
      });
    }
  }

  drawDiscPresser(g, x, y, w, h, obj, pal, tick) {
    this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, pal.a2);
    const cx = x + Math.round(w / 2);
    const cy = y + 22;
    // Đĩa than xoay khi đang ép
    this.drawDisc(g, cx, cy, 11, base.ink, pal.a1);
    g.fillStyle = base.ink2;
    this.drawDisc(g, cx, cy, 7, base.ink2);
    const spin = obj.active && !this.reducedMotion ? tick % 4 : 0;
    g.fillStyle = pal.a2;
    const sp = [[0, -9], [9, 0], [0, 8], [-9, 0]][spin];
    g.fillRect(cx + sp[0], cy + sp[1], 2, 2);
    this.drawDisc(g, cx, cy, 3, obj.active ? pal.a3 : pal.a1);
    // Cần ép
    g.fillStyle = base.gray1;
    g.fillRect(x + w - 6, y + 6, 2, 14);
    g.fillRect(cx + 4, y + 6, x + w - cx - 8, 2);
    // Kệ đĩa đầu ra
    this.fillBorderRect(g, x + 4, y + h - 12, w - 8, 8, base.ink2, base.ink, pal.a2);
    this.drawLabelPlate(g, x - 2, y - 13, w + 4, obj.label || 'Máy ép đĩa', base.ink2, pal.a2, base.paper);
  }

  drawParcel(g, x, y, w, h, obj, pal) {
    if (obj.variant === 'rider') {
      // Shipper: thùng hàng trên xe + bánh xe + mũ bảo hiểm
      this.fillBorderRect(g, x, y, w, h - 5, base.wood1, base.ink, base.amber1);
      this.drawDisc(g, x + 8, y + h - 2, 3, base.ink2, base.ink);
      this.drawDisc(g, x + w - 9, y + h - 2, 3, base.ink2, base.ink);
      this.fillBorderRect(g, x + w - 12, y - 6, 9, 6, pal.a1, base.ink, base.paper);
      this.enqueueText(obj.label || '', x + w / 2, y + Math.round(h / 2) + 1, base.ink, { size: 2.9 });
      return;
    }
    this.fillBorderRect(g, x, y, w, h, base.wood1, base.ink, base.amber1);
    // Băng keo chữ thập + nhãn dán
    g.fillStyle = mix(base.wood1, base.amber1, 0.5);
    g.fillRect(x + Math.round(w / 2) - 2, y + 1, 4, h - 2);
    g.fillStyle = base.wood2;
    g.fillRect(x + 1, y + 4, w - 2, 1);
    this.fillBorderRect(g, x + 3, y + 3, 9, 6, base.paper, base.ink);
    g.fillStyle = pal.a2;
    g.fillRect(x + 5, y + 5, 5, 1);
    this.enqueueText(obj.label || '', x + w / 2, y + Math.round(h / 2) + 5, base.ink, { size: 3.0 });
  }

  drawShipperGate(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, pal.a2);
    // Mái hiên sọc
    for (let i = 0; i < w + 4; i += 6) {
      g.fillStyle = (i / 6) % 2 ? base.paper : pal.a1;
      g.fillRect(x - 2 + i, y, Math.min(6, w + 4 - i), 8);
    }
    g.fillStyle = base.ink;
    g.fillRect(x - 2, y + 8, w + 4, 1);
    this.fillBorderRect(g, x + 5, y + 14, w - 10, h - 16, base.ink, base.ink2, pal.a1);
    if (obj.active) {
      this.fillBorderRect(g, x + 9, y + 24, w - 18, 14, base.wood1, base.ink, base.amber1);
      g.fillStyle = mix(base.wood1, base.amber1, 0.5);
      g.fillRect(x + Math.round(w / 2) - 1, y + 25, 3, 12);
    }
    this.drawLabelPlate(g, x - 2, y - 13, w + 4, obj.label || 'Trạm Shipper', base.ink2, pal.a1, base.paper);
  }

  drawDungeonPortal(g, x, y, w, h, obj, pal, tick) {
    this.fillBorderRect(g, x, y, w, h, base.gray2, base.ink, base.gray1);
    // Vòm đá + xoáy năng lượng
    const inner = { x: x + 5, y: y + 6, w: w - 10, h: h - 10 };
    this.fillBorderRect(g, inner.x, inner.y, inner.w, inner.h, base.ink, base.ink, pal.a3);
    const ph = this.reducedMotion ? 0 : tick % 6;
    for (let k = 0; k < 4; k++) {
      const inset = 2 + k * 4 + ((ph + k) % 2);
      g.fillStyle = [pal.a1, pal.a3, pal.a2, pal.a1][k];
      g.fillRect(inner.x + inset, inner.y + inset, Math.max(1, inner.w - inset * 2), 1);
      g.fillRect(inner.x + inset, inner.y + inner.h - inset - 1, Math.max(1, inner.w - inset * 2), 1);
      g.fillRect(inner.x + inset, inner.y + inset, 1, Math.max(1, inner.h - inset * 2));
      g.fillRect(inner.x + inner.w - inset - 1, inner.y + inset, 1, Math.max(1, inner.h - inset * 2));
    }
    this.drawLabelPlate(g, x - 2, y - 13, w + 4, obj.label || 'class Slime', base.ink2, pal.a3, base.paper);
  }

  drawSlime(g, x, y, w, h, obj, pal, tick) {
    const angry = obj.angry || (obj.label || '').includes('duoi_theo');
    const bodyCol = angry ? base.err : obj.variant === 'ice' ? mix(pal.a3, base.paper, 0.35) : obj.variant === 'fire' ? base.amber2 : pal.a2;
    const bounce = obj.jammed || this.reducedMotion ? 0 : tick % 2;
    const by = y + 8 - bounce;
    const bh = h - 8 + bounce;
    // Thân giọt nhớt: bo tròn mạnh phía trên
    g.fillStyle = base.ink;
    g.fillRect(x + 8, by, w - 16, 1);
    g.fillRect(x + 5, by + 1, w - 10, 2);
    g.fillRect(x + 3, by + 3, w - 6, 3);
    g.fillRect(x + 2, by + 6, w - 4, bh - 6);
    g.fillStyle = bodyCol;
    g.fillRect(x + 8, by + 1, w - 16, 1);
    g.fillRect(x + 5, by + 2, w - 10, 2);
    g.fillRect(x + 3, by + 4, w - 6, 3);
    g.fillRect(x + 3, by + 6, w - 6, bh - 7);
    g.fillStyle = mix(bodyCol, base.ink, 0.25);
    g.fillRect(x + 3, by + bh - 4, w - 6, 3);
    // Bóng sáng
    g.fillStyle = base.paper;
    g.fillRect(x + 9, by + 4, 4, 2);
    g.fillRect(x + 8, by + 6, 2, 1);
    // Mắt + miệng
    const ey = by + 11;
    g.fillStyle = base.ink;
    g.fillRect(x + 12, ey, 4, 5);
    g.fillRect(x + w - 16, ey, 4, 5);
    g.fillStyle = base.paper;
    g.fillRect(x + 13, ey + 1, 1, 1);
    g.fillRect(x + w - 15, ey + 1, 1, 1);
    if (angry) {
      g.fillStyle = base.ink;
      g.fillRect(x + 11, ey - 3, 4, 1);
      g.fillRect(x + 13, ey - 2, 3, 1);
      g.fillRect(x + w - 15, ey - 3, 4, 1);
      g.fillRect(x + w - 16, ey - 2, 3, 1);
      g.fillRect(x + Math.round(w / 2) - 3, ey + 8, 6, 1);
    } else if (obj.jammed) {
      g.fillStyle = base.ink;
      g.fillRect(x + Math.round(w / 2) - 2, ey + 8, 4, 2);
    } else {
      g.fillStyle = base.ink;
      g.fillRect(x + Math.round(w / 2) - 3, ey + 7, 1, 1);
      g.fillRect(x + Math.round(w / 2) - 2, ey + 8, 4, 1);
      g.fillRect(x + Math.round(w / 2) + 2, ey + 7, 1, 1);
    }
    this.drawLabelPlate(g, x - 2, y - 9, w + 4, obj.label || 'Slime', base.ink2, base.ink, base.paper);
    g.fillStyle = bodyCol;
    g.fillRect(x - 1, y - 8, 2, 9);
  }

  drawLootChest(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y + 10, w, h - 10, base.wood2, base.ink, base.wood1);
    const lidY = obj.active ? y + 1 : y + 5;
    if (obj.active) {
      g.save();
      g.globalAlpha *= 0.5;
      g.fillStyle = base.amber1;
      g.fillRect(x + 4, y + 6, w - 8, 6);
      g.restore();
    }
    this.fillBorderRect(g, x, lidY, w, 10, base.wood3, base.ink, base.amber1);
    // Đai kim loại
    g.fillStyle = base.gray2;
    g.fillRect(x + 6, lidY + 1, 2, h - (lidY - y) - 2);
    g.fillRect(x + w - 8, lidY + 1, 2, h - (lidY - y) - 2);
    this.fillBorderRect(g, x + Math.round(w / 2) - 4, y + 12, 8, 8, base.amber1, base.ink, base.paper);
    g.fillStyle = base.ink;
    g.fillRect(x + Math.round(w / 2) - 1, y + 15, 2, 3);
    this.drawLabelPlate(g, x - 2, y - 13, w + 4, obj.label || 'Rương đồ', base.ink2, base.amber1, base.paper);
  }

  drawLockHook(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.wood2, base.ink, base.wood1);
    g.fillStyle = base.wood3;
    g.fillRect(x + 2, y + h - 4, w - 4, 1);
    // Móc treo bằng sắt
    g.fillStyle = base.gray1;
    g.fillRect(x + 4, y + 3, 1, 4);
    g.fillRect(x + 4, y + 7, 3, 1);
    g.fillRect(x + w - 5, y + 3, 1, 4);
    g.fillRect(x + w - 7, y + 7, 3, 1);
    if (obj.jammed) {
      g.fillStyle = base.err;
      g.fillRect(x + 2, y + 2, w - 4, 1);
    }
    this.enqueueText(obj.label || 'Lock', x + w / 2, y + Math.round(h / 2) + 3, base.paper, { size: 3.0 });
  }

  drawStovePan(g, x, y, w, h, obj, pal, tick) {
    // Bếp (thân + núm vặn) + lửa + chảo + bảng đếm món
    this.fillBorderRect(g, x, y + 8, w, h - 8, base.shade, base.ink, base.gray1);
    g.fillStyle = base.ink;
    for (let kx = x + 6; kx < x + w - 4; kx += 12) this.drawDisc(g, kx, y + h - 5, 2, base.gray1, base.ink);
    const fl = this.reducedMotion ? 0 : tick % 2;
    g.fillStyle = obj.jammed ? base.err : base.amber2;
    for (let fx = x + 14; fx < x + w - 14; fx += 6) g.fillRect(fx, y + 6 - fl, 3, 3 + fl);
    g.fillStyle = obj.jammed ? base.ink : base.amber1;
    for (let fx = x + 15; fx < x + w - 14; fx += 6) g.fillRect(fx, y + 7, 1, 2);
    // Chảo
    this.fillBorderRect(g, x + 10, y + 1, w - 20, 6, obj.jammed ? base.ink2 : base.gray2, base.ink, base.gray1);
    g.fillStyle = base.wood3;
    g.fillRect(x + w - 10, y + 3, 12, 2);
    if (obj.jammed) {
      g.save();
      g.globalAlpha *= 0.6;
      this.drawDisc(g, x + 22, y - 4, 4, base.gray2, base.ink2);
      this.drawDisc(g, x + 32, y - 8, 5, base.gray2, base.ink2);
      g.restore();
    }
    // Bảng đếm
    this.fillBorderRect(g, x + 8, y + 12, w - 16, 11, base.ink, base.ink2, base.shade);
    this.enqueueText(obj.label || 'Chảo', x + w / 2, y + 20, obj.jammed ? base.err : base.amber1, { size: 3.0 });
  }

  drawFridge(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.pale, base.ink, base.paper);
    const split = y + Math.round(h * 0.38);
    g.fillStyle = base.gray1;
    g.fillRect(x + 1, split, w - 2, 1);
    g.fillStyle = base.gray2;
    g.fillRect(x + 1, y + h - 3, w - 2, 1);
    // Tay nắm
    this.fillBorderRect(g, x + w - 7, y + 5, 3, 10, base.gray2, base.ink, base.gray1);
    this.fillBorderRect(g, x + w - 7, split + 4, 3, 14, base.gray2, base.ink, base.gray1);
    // Nam châm: mỗi chấm = 1 món trong tủ
    const n = Math.max(0, Math.min(6, obj.items ?? 0));
    const cols = [pal.a1, pal.a2, base.amber1, pal.a4, base.err, base.ok];
    for (let i = 0; i < n; i++) this.fillBorderRect(g, x + 5 + i * 7, split + 6, 6, 6, cols[i], base.ink, base.paper);
    this.drawLabelPlate(g, x - 1, y - 12, w + 2, obj.label || 'Tủ lạnh', base.ink2, base.ink, base.paper, 3.0);
  }

  drawQueueWindow(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.wood2, base.ink, base.wood1);
    this.fillBorderRect(g, x + 4, y + 4, w - 8, h - 9, base.ink2, base.ink, mix(pal.a3, base.ink, 0.3));
    // Bậu cửa
    this.fillBorderRect(g, x - 2, y + h - 5, w + 4, 5, base.wood1, base.ink, base.amber1);
    this.enqueueText(obj.label || 'Queue', x + w / 2, y + Math.round(h / 2) + 1, base.amber1, { size: 3.0 });
  }

  drawPosTerminal(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.shade, base.ink, base.gray1);
    const scr = obj.jammed ? mix(base.err, base.ink, 0.35) : base.ink;
    this.fillBorderRect(g, x + 4, y + 4, w - 8, h - 14, scr, base.ink2, obj.jammed ? base.err : pal.a3);
    if (!obj.jammed) {
      g.save();
      g.globalAlpha *= 0.25;
      g.fillStyle = pal.a3;
      g.fillRect(x + 5, y + 5, w - 10, 2);
      g.restore();
    }
    // Bàn phím
    g.fillStyle = base.ink2;
    for (let kx = x + 6; kx < x + w - 6; kx += 6) g.fillRect(kx, y + h - 7, 4, 3);
    this.enqueueText(obj.label || 'POS', x + w / 2, y + Math.round((h - 10) / 2) + 5, base.paper, { size: 3.0 });
  }

  drawKitchenHatch(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.wood2, base.ink, pal.a1);
    this.fillBorderRect(g, x + 4, y + 10, w - 8, 22, base.ink2, base.ink, pal.a3);
    // Đèn gọi món
    g.fillStyle = obj.active ? base.ok : base.gray2;
    g.fillRect(x + w - 8, y + 4, 4, 3);
    if (obj.active) {
      // Khay + nắp chuông
      this.fillBorderRect(g, x + 7, y + 26, w - 14, 4, base.gray1, base.ink, base.paper);
      this.drawDisc(g, x + Math.round(w / 2), y + 25, 7, base.gray1, base.ink);
      g.fillStyle = base.paper;
      g.fillRect(x + Math.round(w / 2) - 3, y + 21, 2, 2);
    }
    this.drawLabelPlate(g, x - 2, y - 13, w + 4, obj.label || 'Bếp ra món', base.ink2, pal.a1, base.paper);
  }

  /** Đầu bếp = 1 Thread (M6). holding: 'key' | 'pan' | 'stove'; say: bong bóng thoại nhỏ */
  drawChef(g, x, y, w, h, obj, pal, tick) {
    const apron = obj.variant === 'B' ? pal.a4 : pal.a1;
    const working = obj.pose === 'work' && !obj.jammed;
    const bob = working && !this.reducedMotion ? tick % 2 : 0;
    const cx = x + Math.round(w / 2);
    const by = y + bob;
    g.save();
    g.globalAlpha *= 0.4;
    g.fillStyle = base.ink;
    g.fillRect(cx - 8, y + h, 16, 2);
    g.restore();
    this.fillBorderRect(g, cx - 7, by, 14, 7, base.paper, base.ink, base.pale);
    g.fillStyle = base.pale;
    g.fillRect(cx - 5, by + 5, 10, 1);
    this.fillBorderRect(g, cx - 6, by + 6, 12, 10, base.skin2, base.ink, base.skin1);
    g.fillStyle = base.ink;
    if (obj.jammed) {
      g.fillRect(cx - 4, by + 10, 2, 1);
      g.fillRect(cx + 2, by + 10, 2, 1);
    } else {
      g.fillRect(cx - 4, by + 9, 2, 3);
      g.fillRect(cx + 2, by + 9, 2, 3);
    }
    g.fillStyle = base.skin3;
    g.fillRect(cx - 5, by + 12, 1, 1);
    g.fillRect(cx + 4, by + 12, 1, 1);
    this.fillBorderRect(g, cx - 7, by + 16, 14, h - 20, base.paper, base.ink, base.pale);
    this.fillBorderRect(g, cx - 5, by + 18, 10, h - 23, apron, base.ink, base.paper);
    const armY = working ? by + 14 : by + 18;
    this.fillBorderRect(g, cx - 10, armY, 4, 6, base.skin2, base.ink, base.skin1);
    this.fillBorderRect(g, cx + 6, armY, 4, 6, base.skin2, base.ink, base.skin1);
    g.fillStyle = base.ink2;
    g.fillRect(cx - 5, y + h - 4, 4, 4);
    g.fillRect(cx + 1, y + h - 4, 4, 4);
    if (obj.holding === 'key') {
      this.fillBorderRect(g, cx + 8, armY - 4, 6, 6, base.amber1, base.ink, base.paper);
      g.fillStyle = base.amber2;
      g.fillRect(cx + 13, armY - 2, 4, 2);
    } else if (obj.holding === 'pan') {
      this.fillBorderRect(g, cx + 8, armY - 2, 9, 4, base.gray2, base.ink, base.gray1);
    } else if (obj.holding === 'stove') {
      this.fillBorderRect(g, cx - 18, armY - 2, 9, 6, base.err, base.ink, base.amber2);
    }
    this.enqueueText(obj.label || 'Thread', cx, y + h + 7, apron, { size: 2.8 });
    if (obj.say) {
      const tw = Math.ceil(this.measureLogical(obj.say, 2.8)) + 8;
      const bx = Math.round(cx - tw / 2);
      const bY = by - 13;
      this.fillBorderRect(g, bx, bY, tw, 10, obj.jammed ? base.err : base.paper, base.ink, base.pale);
      g.fillStyle = obj.jammed ? base.err : base.paper;
      g.fillRect(cx - 1, bY + 10, 3, 1);
      g.fillStyle = base.ink;
      g.fillRect(cx, bY + 11, 1, 1);
      this.enqueueText(obj.say, cx, bY + 7, obj.jammed ? base.paper : base.ink, { size: 2.8 });
    }
  }

  /** Sổ đếm đơn theo giờ (M11): cột đỉnh tô sáng, đỉnh bị bỏ sót gạch chéo đỏ */
  drawHourLedger(g, x, y, w, h, obj, pal) {
    this.fillBorderRect(g, x, y, w, h, base.paper, base.ink, base.pale);
    g.fillStyle = base.err;
    g.fillRect(x + 10, y + 1, 1, h - 2);
    g.fillStyle = mix(base.pale, base.paper, 0.4);
    for (let ly = y + 14; ly < y + h - 10; ly += 6) g.fillRect(x + 3, ly, w - 6, 1);
    this.enqueueText(obj.title || 'Sổ đếm theo giờ', x + w / 2 + 4, y + 8, base.ink, { size: 2.8 });
    const bars = obj.bars || [];
    const baseY = y + h - 9;
    g.fillStyle = base.ink;
    g.fillRect(x + 4, baseY, w - 8, 1);
    if (!bars.length || obj.empty) {
      this.enqueueText(obj.emptyText || 'chưa đếm', x + w / 2, y + h / 2 + 4, base.gray2, { size: 2.8 });
      return;
    }
    const maxV = Math.max(...bars.map((b) => b.v));
    const plotH = baseY - (y + 18);
    const slot = Math.floor((w - 8) / bars.length);
    const t = obj._growT ?? 1;
    bars.forEach((b, i) => {
      const bw = Math.min(16, slot - 6);
      const bx = x + 4 + i * slot + Math.floor((slot - bw) / 2);
      const bh = Math.max(2, Math.round((b.v / maxV) * plotH * Math.min(1, t)));
      const col = b.missed ? base.gray1 : b.peak ? pal.a1 : base.gray2;
      this.fillBorderRect(g, bx, baseY - bh, bw, bh, col, base.ink, b.missed ? base.paper : base.amber1);
      if (b.missed) {
        g.fillStyle = base.err;
        for (let k = 0; k < bh - 2; k += 3) g.fillRect(bx + 2 + (k % (bw - 4)), baseY - bh + 1 + k, 2, 1);
      }
      this.enqueueText(b.h, bx + bw / 2, baseY + 7, base.ink, { size: 2.6 });
      this.enqueueText(String(b.v), bx + bw / 2, baseY - bh - 2, b.missed ? base.err : base.ink, { size: 2.6 });
      if (b.peak) {
        g.fillStyle = base.amber2;
        g.fillRect(bx + Math.floor(bw / 2) - 1, baseY - bh - 9, 3, 3);
      }
    });
    if (obj.note) {
      this.fillBorderRect(g, x + 8, y + h + 2, w - 16, 10, obj.noteErr ? base.err : base.ok, base.ink, base.paper);
      this.enqueueText(obj.note, x + w / 2, y + h + 9, obj.noteErr ? base.paper : base.ink, { size: 2.8 });
    }
  }

  /** Thước khoảng cách (M5): vạch chia theo đơn vị, mốc ngưỡng "5" đỏ */
  drawDistanceRuler(g, x, y, w, h, obj, pal) {
    const unit = 6;
    const col = obj.inside ? base.err : base.gray1;
    g.fillStyle = col;
    for (let k = 0; k < w; k += 3) g.fillRect(x + k, y + 4, 2, 1);
    for (let k = 0; k <= w; k += unit) g.fillRect(x + k, y + 2, 1, k % (unit * 5) === 0 ? 5 : 3);
    if (obj.threshold) {
      g.fillStyle = base.err;
      g.fillRect(x + obj.threshold, y - 1, 2, 9);
      this.enqueueText('5', x + obj.threshold + 1, y - 2, base.err, { size: 2.6 });
    }
    // Vùng đuổi (kc < 5) tô nhạt
    g.save();
    g.globalAlpha *= 0.18;
    g.fillStyle = base.err;
    g.fillRect(x, y + 1, obj.threshold || 0, 6);
    g.restore();
    this.enqueueText(obj.label || '', x + w / 2, y + 13, col, { size: 2.8 });
  }

  /** Đồng hồ treo tường (M8): kim quay theo nhịp; đơ thì kim đứng, mặt đỏ */
  drawWallClock(g, x, y, w, h, obj, pal, tick) {
    const r = Math.floor(Math.min(w, h) / 2);
    const cx = x + r;
    const cy = y + r;
    this.drawDisc(g, cx, cy, r, obj.jammed ? mix(base.err, base.paper, 0.6) : base.paper, base.ink);
    g.fillStyle = base.gray2;
    [[0, -r + 2], [r - 3, 0], [0, r - 3], [-r + 2, 0]].forEach(([dx, dy]) => g.fillRect(cx + dx, cy + dy, 1, 1));
    const a = obj.jammed || this.reducedMotion ? -0.6 : ((tick % 24) / 24) * Math.PI * 2;
    g.fillStyle = base.ink;
    for (let k = 1; k < r - 2; k++) g.fillRect(Math.round(cx + Math.sin(a) * k), Math.round(cy - Math.cos(a) * k), 1, 1);
    for (let k = 1; k < r - 5; k++) g.fillRect(Math.round(cx + Math.sin(0.9) * k), Math.round(cy - Math.cos(0.9) * k), 1, 1);
    g.fillStyle = base.err;
    g.fillRect(cx, cy, 1, 1);
    this.enqueueText(obj.label || '', cx, y + h + 7, obj.jammed ? base.err : base.paper, { size: 2.7 });
  }

  drawJamAlert(g, x, y, w, h, obj) {
    this.fillBorderRect(g, x, y, w, h, base.err, base.ink, base.amber1);
    // Sọc cảnh báo hai đầu
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k % 2 ? base.ink : base.amber1;
      g.fillRect(x + 2 + k * 2, y + 2, 2, h - 4);
      g.fillRect(x + w - 4 - k * 2, y + 2, 2, h - 4);
    }
    this.enqueueText(obj.label || 'Sự cố!', x + w / 2, y + Math.round(h / 2) + 3, base.paper, { size: 3.2 });
  }

  // ==========================================================================
  // 4. MASCOT BIT (32×32 PIXEL CHIBI · ĐẦU LỚN · TRANG PHỤC 5 THẾ GIỚI)
  // ==========================================================================
  drawMascotBit(g, x, y, pose, sayText, pal, tick) {
    const anim = !this.reducedMotion;
    const bob = !anim ? 0 : pose === 'idle' ? (tick % 8 < 4 ? 0 : 1) : pose === 'walk' ? (tick % 2) * 2 : pose === 'happy' ? -2 : 0;
    const bx = Math.round(x);
    const by = Math.round(y + bob);

    g.save();
    g.globalAlpha *= 0.45;
    g.fillStyle = base.ink;
    g.fillRect(bx + 6, STAGE.FLOOR_Y - 1, 20, 2);
    g.fillRect(bx + 9, STAGE.FLOOR_Y + 1, 14, 1);
    g.restore();

    // Ảnh minh hoạ Bit theo trang phục thế giới (4 tư thế); thiếu ảnh → vẽ pixel như cũ
    const outfitName = (WORLDS[this.world] || WORLDS.memory).outfit;
    const poseIdx = pose === 'work' ? 2 : pose === 'happy' ? 3 : pose === 'error' ? 4 : 1;
    const spriteDrawn = drawSprite(g, `bit_${outfitName}_${poseIdx}`, bx - 6, by - 12, 44, 44);
    if (!spriteDrawn) {
      g.save();
      if (pose === 'error') {
        g.translate(bx + 16, by + 24);
        g.rotate(-0.18);
        g.translate(-(bx + 16), -(by + 24));
      }
      const legStep = pose === 'walk' && anim ? (tick % 2 === 0 ? 2 : -2) : 0;
      this.fillBorderRect(g, bx + 9, by + 26 + Math.max(0, legStep), 5, 6, base.ink2, base.ink, base.shade);
      this.fillBorderRect(g, bx + 18, by + 26 + Math.max(0, -legStep), 5, 6, base.ink2, base.ink, base.shade);
      // Thân + tay
      this.fillBorderRect(g, bx + 7, by + 17, 18, 10, pal.a1, base.ink, pal.a2);
      const armRaise = pose === 'work' || pose === 'happy' ? -4 : 0;
      this.fillBorderRect(g, bx + 4, by + 18 + armRaise, 4, 7, base.skin2, base.ink, base.skin1);
      this.fillBorderRect(g, bx + 24, by + 18 + armRaise, 4, 7, base.skin2, base.ink, base.skin1);
      // Đầu
      this.fillBorderRect(g, bx + 6, by + 3, 20, 15, base.skin2, base.ink, base.skin1);
      // Tóc
      g.fillStyle = base.wood3;
      g.fillRect(bx + 7, by + 4, 18, 3);
      g.fillRect(bx + 7, by + 7, 3, 2);
      g.fillRect(bx + 20, by + 7, 2, 1);
      g.fillStyle = mix(base.wood3, base.wood2, 0.6);
      g.fillRect(bx + 10, by + 4, 6, 1);
      g.fillStyle = base.skin3;
      g.fillRect(bx + 7, by + 15, 18, 2);
      // Mắt (chớp mắt định kỳ) + má hồng
      const blink = anim && pose !== 'error' && tick % 40 === 0;
      g.fillStyle = base.ink;
      if (pose === 'error') {
        g.fillRect(bx + 10, by + 9, 3, 3);
        g.fillRect(bx + 19, by + 9, 3, 3);
        g.fillStyle = base.err;
        g.fillRect(bx + 14, by + 13, 4, 2);
      } else if (blink) {
        g.fillRect(bx + 10, by + 10, 3, 1);
        g.fillRect(bx + 19, by + 10, 3, 1);
      } else {
        g.fillRect(bx + 10, by + 8, 3, 4);
        g.fillRect(bx + 19, by + 8, 3, 4);
        g.fillStyle = base.paper;
        g.fillRect(bx + 10, by + 8, 1, 1);
        g.fillRect(bx + 19, by + 8, 1, 1);
        g.fillStyle = base.skin3;
        g.fillRect(bx + 14, by + 13, 4, pose === 'happy' ? 2 : 1);
      }
      g.fillStyle = mix(base.skin3, base.err, 0.25);
      g.fillRect(bx + 8, by + 12, 2, 1);
      g.fillRect(bx + 22, by + 12, 2, 1);

      const outfit = (WORLDS[this.world] || WORLDS.memory).outfit;
      if (outfit === 'apron') {
        this.fillBorderRect(g, bx + 10, by + 19, 12, 8, base.wood1, base.ink, base.amber1);
        g.fillStyle = base.wood3;
        g.fillRect(bx + 13, by + 22, 6, 1);
      } else if (outfit === 'headphones') {
        this.fillBorderRect(g, bx + 5, by + 1, 22, 3, pal.a2, base.ink, base.paper);
        this.fillBorderRect(g, bx + 3, by + 6, 4, 8, pal.a1, base.ink, pal.a3);
        this.fillBorderRect(g, bx + 25, by + 6, 4, 8, pal.a1, base.ink, pal.a3);
      } else if (outfit === 'helmet') {
        this.fillBorderRect(g, bx + 5, by, 22, 7, pal.a1, base.ink, base.paper);
        g.fillStyle = pal.a2;
        g.fillRect(bx + 6, by + 5, 20, 1);
      } else if (outfit === 'mage') {
        this.fillBorderRect(g, bx + 3, by + 2, 26, 3, pal.a1, base.ink, pal.a3);
        this.fillBorderRect(g, bx + 9, by - 4, 14, 7, pal.a1, base.ink, pal.a3);
        this.fillBorderRect(g, bx + 13, by - 8, 6, 5, pal.a1, base.ink, pal.a3);
        g.fillStyle = base.amber1;
        g.fillRect(bx + 15, by - 2, 2, 2);
      } else if (outfit === 'chef') {
        this.fillBorderRect(g, bx + 7, by - 4, 18, 8, base.paper, base.ink, base.pale);
        g.fillStyle = base.pale;
        g.fillRect(bx + 9, by + 2, 14, 1);
      }
      g.restore();
    }

    const lift = spriteDrawn ? 12 : 0; // nhân vật ảnh minh hoạ cao hơn bản pixel
    if (pose === 'error') {
      this.fillBorderRect(g, bx + 11, by - 13 - lift, 12, 10, base.err, base.ink, base.amber1);
      const errSym = (sayText || '').includes('?') ? '?' : '!';
      this.enqueueText(errSym, bx + 17, by - 5 - lift, base.paper, { size: 3.4 });
    }

    if (sayText) {
      const bubbleW = Math.min(120, Math.max(24, Math.ceil(this.measureLogical(sayText, 3.1)) + 10));
      const bubbleX = Math.max(4, Math.min(STAGE.W - bubbleW - 4, bx + 16 - Math.round(bubbleW / 2)));
      const bubbleY = Math.max(4, by - lift - (pose === 'error' ? 27 : 16));
      const bc = pose === 'error' ? base.err : base.paper;
      this.fillBorderRect(g, bubbleX, bubbleY, bubbleW, 12, bc, base.ink, pose === 'error' ? base.amber1 : base.pale);
      // Đuôi bong bóng chỉ về Bit
      const tx = Math.max(bubbleX + 3, Math.min(bubbleX + bubbleW - 5, bx + 15));
      g.fillStyle = base.ink;
      g.fillRect(tx, bubbleY + 12, 3, 1);
      g.fillRect(tx + 1, bubbleY + 13, 1, 1);
      g.fillStyle = bc;
      g.fillRect(tx + 1, bubbleY + 11, 1, 1);
      this.enqueueText(sayText, bubbleX + Math.round(bubbleW / 2), bubbleY + 9, pose === 'error' ? base.paper : base.ink, { size: 3.1 });
    }
  }

  // ==========================================================================
  // 5. HIỆU ỨNG SẢN PHẨM BAY TỪ MÁY VÀO KHAY SẢN PHẨM (KHI PRINT() CHẠY)
  // ==========================================================================
  drawFlyingProduct(g, prod, easedT, pal, machine) {
    const sx = machine ? Math.round(machine.x + (machine.w || 40) / 2) : 236;
    const sy = machine ? Math.round(machine.y + 28) : 114;
    const tx = 292;
    const ty = 156;
    const px = Math.round(sx + (tx - sx) * easedT);
    const py = Math.round(sy + (ty - sy) * easedT - Math.sin(easedT * Math.PI) * 24);
    const label = prod.title.length > 18 ? `${prod.title.slice(0, 17)}…` : prod.title;
    const pw = Math.min(84, Math.ceil(this.measureLogical(label, 2.9)) + 10);
    // Vệt sáng phía sau
    g.save();
    g.globalAlpha *= 0.35;
    g.fillStyle = base.amber1;
    for (let k = 1; k <= 3; k++) {
      const t = Math.max(0, easedT - k * 0.06);
      g.fillRect(Math.round(sx + (tx - sx) * t) - 1, Math.round(sy + (ty - sy) * t - Math.sin(t * Math.PI) * 24), 3, 3);
    }
    g.restore();
    if (prod.isEmpty) {
      this.drawGhostBox(g, px - pw / 2, py - 7, pw, 13, { label }, pal);
    } else {
      this.fillBorderRect(g, px - pw / 2, py - 7, pw, 13, pal.a1, base.ink, base.amber1);
      this.enqueueText(label, px, py + 2, base.ink, { size: 2.9 });
    }
  }

  // ==========================================================================
  // 6. TIỆN ÍCH VẼ: KHỐI BO GÓC CÓ MẶT SÁNG/TỐI + HÀNG ĐỢI CHỮ HIGH-DPI
  // ==========================================================================
  fillBorderRect(g, x, y, w, h, bodyColor, borderColor, topLeftHighlight) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.max(2, Math.round(w));
    const rh = Math.max(2, Math.round(h));
    // Phong cách phẳng (B): viền đen đậm → viền cùng tông, đậm hơn thân một chút
    const body0 = bodyColor || base.shade;
    g.fillStyle = !borderColor || borderColor === base.ink ? mix(body0, base.ink, 0.42) : borderColor;
    if (rw >= 6 && rh >= 6) {
      // Bo 4 góc 1px: khối trông mềm hơn, đúng chất pixel art
      g.fillRect(rx + 1, ry, rw - 2, rh);
      g.fillRect(rx, ry + 1, rw, rh - 2);
    } else {
      g.fillRect(rx, ry, rw, rh);
    }
    const body = bodyColor || base.shade;
    g.fillStyle = body;
    g.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
    if (rw > 4 && rh > 4) {
      // Mặt tối dưới & phải → khối có chiều sâu
      g.fillStyle = mix(body, base.ink, 0.28);
      g.fillRect(rx + 1, ry + rh - 2, rw - 2, 1);
      g.fillRect(rx + rw - 2, ry + 1, 1, rh - 2);
    }
    if (topLeftHighlight && rw > 3 && rh > 3) {
      g.fillStyle = topLeftHighlight;
      g.fillRect(rx + 1, ry + 1, rw - 3, 1);
      g.fillRect(rx + 1, ry + 1, 1, rh - 3);
    }
  }

  enqueueText(text, logicalX, logicalBaselineY, color, opts = {}) {
    if (!text) return;
    this.textQueue.push({
      text: String(text),
      x: logicalX + (this._curShakeX || 0),
      y: logicalBaselineY + (this._curShakeY || 0),
      color: color || base.paper,
      size: opts.size || 3.3,
      align: opts.align || 'center',
      alpha: this._curAlpha ?? 1,
    });
  }

  /**
   * Vẽ toàn bộ nhãn chữ ở độ phân giải thật của màn hình (High-DPI) trên this.ctx.
   * Chữ sắc nét tuyệt đối; thêm viền tối mảnh để luôn đọc được trên nền sáng/tối.
   */
  flushHighDpiText() {
    if (!this.textQueue.length) return;
    const ctx = this.ctx;
    const { s, ox, oy } = this.view;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const item of this.textQueue) {
      const fontPx = Math.max(10, Math.round(item.size * s));
      ctx.font = `800 ${fontPx}px "JetBrains Mono", "Plus Jakarta Sans", Consolas, monospace`;
      ctx.textAlign = item.align;
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = item.alpha ?? 1;
      const px = Math.round(ox + item.x * s);
      const py = Math.round(oy + item.y * s);
      if (isLight(item.color)) {
        ctx.strokeStyle = rgba(base.ink, 0.55);
        ctx.lineWidth = Math.max(2, fontPx * 0.18);
        ctx.strokeText(item.text, px, py);
      }
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, px, py);
    }
    ctx.restore();
  }
}

// ============================================================================
// Tiện ích màu (chỉ pha trộn các token trong tokens.js, không thêm màu lạ)
// ============================================================================
const _rgbCache = new Map();
function hexToRgb(hex) {
  let v = _rgbCache.get(hex);
  if (!v) {
    const n = parseInt(String(hex).slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _rgbCache.set(hex, v);
  }
  return v;
}
const _mixCache = new Map();
function mix(a, b, t) {
  const key = `${a}|${b}|${t}`;
  let v = _mixCache.get(key);
  if (!v) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    v = `#${A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
    _mixCache.set(key, v);
  }
  return v;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function isLight(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return false;
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
/** Hash tất định → [0,1) để rải chi tiết nền mà không nhấp nháy giữa các frame */
function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function hash2(a, b) {
  return hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
}

// Vật đứng trên mặt bàn / sàn → có bóng đổ dưới đáy; vật lơ lửng → bóng lệch
const GROUNDED = new Set([
  'drawer', 'printer', 'disc_presser', 'parcel', 'shipper_gate', 'dungeon_portal', 'slime', 'loot_chest',
  'stove_pan', 'fridge', 'pos_terminal', 'kitchen_hatch', 'viz_frame', 'dj_pad', 'storage_box', 'hour_ledger',
]);
const FLOATING = new Set(['tag_card', 'jam_alert']);

// Vị trí mép sàn trong từng ảnh nền AI (tỉ lệ chiều cao ảnh) để khớp FLOOR_Y
const BG_FLOOR = { memory: 0.815, dj: 0.807, city: 0.797, dungeon: 0.796, kitchen: 0.778 };
// Độ phủ tối phần tường của ảnh nền (nền quá rực thì giảm bớt để vật nổi lên)
const BG_DIM = { city: 0.22 };

// Tên gọi trung tính cho vật ở lớp "Code" khi vật không có nhãn code riêng
const KIND_NAMES = {
  printer: 'print()', disc_presser: 'print()', shipper_gate: 'print()', loot_chest: 'print()', kitchen_hatch: 'print()',
  chef: 'Thread', tag_card: 'giá trị', parcel: 'dòng dữ liệu', distance_ruler: 'kc', wall_clock: 'r.after',
};
