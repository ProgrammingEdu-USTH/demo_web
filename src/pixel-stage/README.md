# Pixel Stage

Engine animation pixel chibi đồng bộ theo từng dòng code (spec `pe-pixel-motion-spec`). Engine viết bằng TypeScript thuần, không phụ thuộc React; phần React là một lớp mỏng nằm trong `react/`.

- Demo: `npm run dev` rồi mở `/pixel-stage` (chọn bài mẫu theo thế giới).
- Trong app: mọi bài của khóa **Python cơ bản** (11 bài) là cảnh motion toàn màn hình, mở ngay khi vào bài; chuyển bài bằng ‹ › trong cảnh, "Góc học" / Esc về phòng. Danh sách bài → script nằm ở `PYTHON_STEP_SCRIPTS` (`src/features/goc-hoc/mock/lessons.ts`). Các khóa khác vẫn là lý thuyết + editor.
- Test nghiệm thu: `npm run test:pixel`. Kiểm tra token: `npm run check:pixel-tokens`.

## Cấu trúc

```
src/pixel-stage/
  tokens/     palette.ts, motion.ts, size.ts, fx.ts, audio.ts, ui.ts   (mọi màu, thời lượng, kích thước)
  core/       stage.ts (loop, scale nguyên, letterbox, API), clock.ts, rng.ts, ease.ts, audio.ts, transition.ts
  timeline/   types.ts (Step Script), validate.ts, state.ts (trạng thái thuần), player.ts
  render/     sprite, text (font pixel có dấu tiếng Việt), bubble, hud, particles, overlay, pixel
  assets/     sheet.ts (asset contract + loader Aseprite JSON), placeholder.ts (sprite vẽ bằng code)
  worlds/     blank, kitchen, city, memory, dungeon, dj   (layout, actors, ambient, scripts/*.json)
  react/      PixelStage.tsx, StepPlayer.tsx (màn toàn cảnh), codeLine.ts (tô cú pháp, khối chứa dòng)
  demo/       PixelDemo.tsx (route /pixel-stage)
```

## Dùng trong React / Next.js

Cả hai component là client component (`"use client"`), import từ `@/pixel-stage/react`.

### `<StepPlayer />`: màn "chạy từng dòng" toàn cảnh

Cảnh pixel phủ kín khung chứa (khung 320×180 vẫn scale nguyên; phần thừa được kéo dài từ mép cảnh và tối dần, không còn viền đen). Giao diện nổi trên cảnh:

- **Trên giữa:** dòng code đang chạy. Chỉ hiện sau khi người dùng tương tác (bấm Chạy, ← / →, Space, bấm vào cảnh); trước đó là dòng gợi ý. Dòng code được tô cú pháp, "gõ" ra từng ký tự, kèm khối chứa nó (ví dụ `async def nuong(...) ›`), nhãn `dòng 10–13` và `+3 dòng` khi bước gồm nhiều dòng. Bấm vào để mở toàn bộ code.
- **Góc phải trên:** nút **Chạy** / **Tạm dừng** / **Chạy lại**. Nền nút đầy dần theo tiến độ cả bài. Khi Chạy, mỗi bước dừng lại đủ lâu để đọc caption (theo độ dài caption, token `hold`) rồi mới sang bước sau.
- **Dưới:** biến của bước, caption dạng phụ đề (text thật, `aria-live`), thanh điều khiển: ◀, các ô bước (bấm để tua, ô đang chạy đầy dần), ▶, tốc độ, âm thanh, Code. Thanh điều khiển tự ẩn khi đang chạy mà chuột đứng yên (`ui.idleHide`).
- **Ngăn kéo phải:** toàn bộ code có highlight và bảng biến (phím C).

Khung chứa phải có kích thước (ví dụ `position: fixed; inset: 0`): StepPlayer phủ 100% khung đó.

```tsx
"use client";
import { SCRIPTS } from "@/pixel-stage";
import { StepPlayer } from "@/pixel-stage/react";

const script = SCRIPTS.find((s) => s.id === "loop-dj-01")!.raw;

export function LessonStep({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <StepPlayer
        script={script}
        title="Chạy từng dòng: vòng lặp for"
        intro="pixelate"          // cảnh hiện ra từ khối mosaic thô
        reducedMotion="auto"      // hoặc true / false theo công tắc của trang
        onClose={onBack}          // hiện nút đóng; Esc gọi hàm này
        closeLabel="Quay lại bài học"
      />
    </div>
  );
}
```

| Prop | Ý nghĩa |
|---|---|
| `script` | Step Script (JSON). Đổi script thì nạp lại từ bước đầu. |
| `title`, `toolbar` | Tiêu đề và phần tử chèn vào góc trái trên. |
| `intro` | `"pixelate"` hoặc `"none"`. |
| `keyboard` | Phím tắt toàn cửa sổ: ← / → chuyển bước, Space chạy / tạm dừng, C mở / đóng toàn bộ code, Esc đóng ngăn kéo rồi mới đóng màn (mặc định bật). |
| `reducedMotion` | `"auto"` theo `prefers-reduced-motion`, hoặc `true` / `false`. |
| `onClose`, `closeLabel` | Nút đóng + Esc. Esc được bắt ở pha capture nên không lan sang trang phía dưới. |
| `onStage` | Nhận API của stage khi tạo (null khi huỷ). |
| `nav` | `{ label, prev?, next?, prevTitle?, nextTitle? }`: chuyển bài ‹ › ở góc trái trên; ở bước cuối nút "Bài sau" sáng lên. |
| `devToggles` | Thêm công tắc giảm chuyển động và lớp hạt (trang demo). |

### `<PixelStage />`: chỉ canvas, tự dựng giao diện quanh nó

```tsx
"use client";
import { useRef, useState } from "react";
import type { PixelStage as Stage, StepEvent } from "@/pixel-stage";
import { PixelStage } from "@/pixel-stage/react";

export function MyLesson({ script }: { script: unknown }) {
  const stage = useRef<Stage | null>(null);
  const [step, setStep] = useState<StepEvent | null>(null);
  return (
    <>
      <PixelStage script={script} ref={stage} onStep={setStep} style={{ width: "100%", aspectRatio: "16 / 9" }} />
      <p aria-live="polite">{step?.caption}</p>
      <button onClick={() => stage.current?.prev()}>Bước trước</button>
      <button onClick={() => stage.current?.next()}>Bước sau</button>
      {/* step.line: các dòng code (1-based) cần highlight */}
    </>
  );
}
```

Props: `script`, `seed`, `step` (điều khiển bước từ bên ngoài, 0-based), `speed` (0.5 / 1 / 2), `overlay`, `reducedMotion`, `sound`, `intro`, `fill` (`"ink"` viền tối / `"extend"` kéo dài mép cảnh khi phủ toàn màn hình), `onStep`, `onPlay`, `onEnd`, `onReady`, `onError`, `ref`, `className`, `style`, `ariaLabel`.

Canvas nên có kích thước do CSS quyết định (ví dụ `width: 100%; aspect-ratio: 16/9`). Engine tự đặt độ phân giải canvas theo điểm ảnh thật của màn hình và chỉ phóng buffer 320×180 theo bội số nguyên, phần thừa để viền tối.

### API của stage (không dùng React)

```ts
import { createPixelStage, pixelate } from "@/pixel-stage";

const stage = createPixelStage(canvasEl, { world: "kitchen", seed: 42 });
await stage.load(scriptJson);      // kiểm tra script, báo lỗi rõ ràng nếu sai
stage.next(); stage.prev(); stage.goTo(5);
stage.play(); stage.pause(); stage.setSpeed(2);
stage.on("step", ({ index, line, caption, vars }) => { /* highlight code */ });
await pixelate(stage, "in", false); // chuyển cảnh pixelate (khối thô → pixel thật)
stage.destroy();
```

## Viết thêm một bài (Step Script)

1. Tạo `worlds/<thế-giới>/scripts/<id>.json` theo kiểu `StepScript` trong `timeline/types.ts`.
2. Thêm vào danh sách `worlds/scripts.ts`.
3. Gắn vào bài học: đổi script của bài trong `PYTHON_STEP_SCRIPTS` (`src/features/goc-hoc/mock/lessons.ts`, sau này lấy từ API); thêm id vào `PYTHON_LESSONS` trong `e2e/pixel-stage.spec.ts`.
4. Chạy `npm run test:pixel`: test tự kiểm tra tính deterministic, dòng code hợp lệ, caption không quá 2 câu và các script có đối chiếu Python.

Quy ước trong script:

- `line: [a, b]` gồm đúng 2 số là khoảng a…b; muốn highlight 2 dòng rời nhau thì ghi ≥ 3 số hoặc từng dòng.
- `after: k` là chỉ số action phải xong trước trong cùng bước; không có `after` thì chạy song song.
- Thời lượng ghi bằng tên token (`"dur": "sm" | "md" | "lg"`), màu bằng tên trong palette (`"amber1"`, `"a1"`); không ghi số ms hay mã hex.
- `say`, `label`, `highlight`, `emit`, `timer` nhận id actor/vật hoặc tên anchor; `"<id>.hand"` là tay của nhân vật.

## Thay sprite placeholder bằng asset thật (Phase 4)

1. **Lấy mẫu:** `public/pixel-stage/sprites/<thế-giới>/<tên>.{png,json}` là bộ mẫu xuất từ placeholder, đúng khung và tag. Tạo lại bằng `npm run export:pixel-sprites -- http://localhost:3000` khi dev server đang chạy. Hướng dẫn cho người vẽ nằm trong `public/pixel-stage/sprites/README.md`.
2. **Vẽ và xuất từ Aseprite:** Export Sprite Sheet, JSON Data dạng Hash, bật Tags. Giữ nguyên tên sprite, kích thước khung (nhân vật 32×32, đạo cụ 16×16) và đủ tag (`idle`, `walk`, `work`, `happy`, `confused`; đạo cụ chỉ cần `idle`).
3. **Khai báo** trong `assets/manifest.ts`:

   ```ts
   export const SPRITE_ASSETS = {
     "kitchen/cook": "/pixel-stage/sprites/kitchen/cook.json",
   };
   ```

   Khi `load()`, stage tải các sheet của thế giới đó trước rồi mới dựng cảnh. Sheet sai kích thước hoặc thiếu tag, hay tải lỗi, sẽ bị bỏ qua: console có cảnh báo và sprite đó vẫn dùng placeholder. Vì vậy có thể thay dần từng sprite. **Script không phải sửa.**

API liên quan: `createPixelStage(canvas, { assets })` để ghi đè danh mục; `stage.useAssets(map)` rồi `stage.reload()` để đổi lúc đang chạy; `stage.assets()` cho biết từng sprite đang dùng `placeholder`, `asset` hay `failed` (kèm lý do); `stage.replaceSprite(name, json, image)` để thay trực tiếp một sheet đã có trong bộ nhớ.
