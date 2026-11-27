# LESSON BLUEPRINT: CẨM NANG THIẾT KẾ & XÂY DỰNG BÀI HỌC TRỰC QUAN TƯƠNG TÁC (V2)

> Tài liệu cố định đúc kết kiến trúc sư phạm, hệ thống thiết kế và quy chuẩn kỹ thuật từ ứng dụng học **Python BFS Shortest Path (Guided Discovery V2 + Mini-Code Sandbox)** để tái sử dụng cho mọi bài học thuật toán và cấu trúc dữ liệu tương tác bằng tiếng Việt sau này.

---

## 1. Tổng quan & Triết lý Sư phạm 5 Pha (Guided Discovery & Productive Failure)

Thay vì dạy theo kiểu **"Solution-First"** (đưa thẳng code chuẩn rồi chạy từng dòng ngay từ bước đầu), bài học sử dụng mô hình **Khám phá có hướng dẫn & Thất bại có chủ đích (Guided Discovery & Productive Failure)** gồm **5 Pha (9 bước)**:

### Pha 1: Phân rã bài toán không cần Code (No-Code Problem Decomposition)
- **Mục tiêu:** Ẩn hoàn toàn bảng Python code (`CodePanel`) để người học tập trung 100% vào trực giác giải quyết vấn đề như con người.
- **Bước 1 — Tự giải bằng tay:** Người học tự click/tương tác trên mô hình gốc (ví dụ: tự nối đường ngắn nhất `A → C → E → F` trên đồ thị 6 đỉnh).
- **Bước 2 — Phân rã việc (Decomposition Checklist):** Hiển thị khung 3 ô trống cùng **5 mảnh yêu cầu** (3 mảnh đúng tương ứng 3 bài toán con + 2 mảnh nhiễu). Chỉ khi chọn đúng 3 mảnh cốt lõi mới mở khóa **Macro Pipeline** ở thanh trên cùng và cho phép sang Pha 2.

### Pha 2: Đấu trường Công cụ — Thất bại có chủ đích (The Tool Arena)
- **Mục tiêu:** Với mỗi bài toán con, không đưa đáp án sẵn. Trình bày bộ chọn **A vs B** ngay phía trên sân khấu và nút **`Chạy thử`** để người học tự chạy cả công cụ sai lẫn công cụ đúng.
- **Bước 3 — Đấu trường 1 (Ví dụ: `Stack (LIFO)` vs `Queue (FIFO)`):**
  - Chọn công cụ kém/sai (`Stack`) → mô phỏng đi sâu vào nhánh sai (`A → B → D → E → F` = 4 bước, đồng thời chỉ rõ các nhánh rẽ như `D → A` và `D → E → F`) + cảnh báo `WATCH OUT`.
  - Chọn công cụ đúng (`Queue`) → tỏa đều từng lớp và tìm ra đường ngắn nhất 3 bước → bấm nút **"Chốt dùng..."** để mở khóa bước tiếp.
- **Bước 4 — Đấu trường 2 (Ví dụ: `List` vs `Set`):**
  - Không chỉ chạy trên mẫu nhỏ mà phải hiển thị **khác biệt cơ chế trực quan** (ví dụ: `List` quét tuần tự từng phần tử màu hổ phách vs `Set` băm trực tiếp $O(1)$ màu tím) kèm **Stress-test quy mô lớn** (100,000 phần tử) để chứng minh sự sụp đổ hiệu năng của lựa chọn A.
- **Bước 5 — Đấu trường 3 (Ví dụ: `1 biến prev` vs `Dict parent`):**
  - Minh họa thất bại bằng **bộ đếm/dòng thời gian các nhịp ghi đè** (ví dụ: 5 nhịp `step5Beat` trên ô nhớ đơn `Ô NHỚ ĐƠN:` cho thấy giá trị cũ bị xóa sạch) đối lập với `Dict` lưu đủ cặp `con: cha`.

### Pha 3: Lắp ráp Tư duy thành Code & Chạy hợp nhất (Mind-to-Code Assembly)
- **Bước 6 — Lắp ráp Code (`CodeAssembler`):** Hiển thị bộ khung thuật toán với **3 khe đứt nét (`dashed slots`)**. Người học lắp đúng 3 công cụ vừa chốt ở Pha 2 vào đúng vị trí để biến thành code Python hoàn chỉnh.
- **Bước 7 — Chạy hợp nhất & Đóng/Mở Hộp đen (`Unified Execution`):**
  - Hiển thị code Python đầy đủ tô màu theo luồng + bảng trạng thái 3 cấu trúc dữ liệu (`DataStructuresDock`) theo nguyên tắc **Black-Box Expand/Collapse** (mở rộng cái đang chạy, thu gọn hoặc nhấn mạnh luồng đang tương tác).
  - Cho phép chạy từng bước (`Step`) hoặc tự động (`Play/Pause`) với **1 đường dẫn thắng / 1 cạnh hoạt động rõ ràng tại mỗi nhịp**, tránh vẽ chồng chéo làm rối mắt.

### Pha 4: Phá vỡ Giới hạn & Chuyển tiếp (Limit Breaker)
- **Bước 8 — Ca phản ví dụ (`LimitBreaker`):** Giữ nguyên mô hình vừa học nhưng thêm một điều kiện thực tế khiến thuật toán hiện tại thất bại (ví dụ: gắn trọng số `km` lên cạnh sao cho đường ít bước `A → C → E → F` tốn **50 km**, còn đường nhiều bước hơn `A → B → D → E → F` chỉ tốn **10 km**).
- Chốt bằng hộp **`KEY TAKEAWAY`** giải thích vì sao thuật toán cũ bó tay và giới thiệu bước tiến tự nhiên tiếp theo (ví dụ: **Dijkstra + Priority Queue**).

### Pha 5: Mini-Code Sandbox thực hành (20–40% quy mô bài gốc)
- **Bước 9 — Lập trình trên bài toán con (`MiniCodeSandbox`):**
  - Ngay sau khi hoàn thành Bước 8, mở khóa Sandbox thực hành: bài toán thu gọn khoảng **20–40%** so với bài gốc (ví dụ: đồ thị 4 đỉnh thay vì 6 đỉnh) kèm code khung (`STARTER_MINI_CODE`), trình thông dịch Python an toàn chạy ngay trên trình duyệt và bộ **4 test case** tự động chấm đạt/chưa đạt.

> **Cơ chế Cổng khóa tuần tự (Sequential Lock Gates):** Sử dụng `isCurrentStepCompleted`, `maxUnlockedIndex` và `lockReason` để đảm bảo người học phải thực hiện xong thao tác chốt ở bước hiện tại mới được tiến tới bước kế tiếp.

---

## 2. Hệ thống Thiết kế "Warm Technical Blueprint" & Đồng bộ Màu 1-1

### 2.1. Bảng token nền, viền & kiểu chữ
| Thành phần | Giá trị chuẩn | Ghi chú sử dụng |
|---|---|---|
| Nền Canvas chính | `#F7F5EE` | Giấy kỹ thuật kem ấm |
| Lưới chấm kỹ thuật (`.bg-blueprint-dots`) | `#E5E0D5` (`18px 18px`) | Tạo cảm giác bản vẽ kỹ thuật |
| Bề mặt thẻ / Panel | `#FAF8F2` / `#FFFDF9` | Tách lớp nhẹ trên nền `#F7F5EE` |
| Viền chuẩn | `1.5px solid #1E293B` | Nét mực đen xám sắc nét |
| Đổ bóng cứng (Hard Shadow) | `3px 3px 0px #1E293B` | Tạo chiều sâu 2.5D kiểu bản vẽ |
| Bo góc | `8px` (`rounded-lg`) | Thống nhất cho thẻ, nút, khung code |
| Font tiêu đề & giải thích | `Be Vietnam Pro` | Hỗ trợ dấu tiếng Việt sắc nét |
| Font code & số liệu | `JetBrains Mono` | Dùng cho Python code, metrics, badge |

### 2.2. Quy tắc Đồng bộ Màu 1-1 (Color Threading)
Mỗi bài học chia thuật toán thành **3 bài toán con**, gán cứng **1 màu chủ đạo duy nhất** xuyên suốt từ **Top Bar (Macro Pipeline) → Khung Code → Sân khấu SVG/Dock → Chip trong Sidebar**:

| Vai trò | Key định danh | Màu nền (Fill) | Màu viền / nhấn (Border & Accent) |
|---|---|---|---|
| **Thành phần 1** (Ví dụ: `queue` — Duyệt lớp) | `queue` | Sky Blue `#BAE6FD` | `#0284C7` |
| **Thành phần 2** (Ví dụ: `visited` — Chống lặp) | `visited` | Lavender Purple `#DDD6FE` | `#7C3AED` |
| **Thành phần 3** (Ví dụ: `parent` — Truy vết) | `parent` | Mint Green `#BBF7D0` | `#16A34A` |
| **Lỗi / Vòng lặp / Kết quả sai** | `bug` | Coral Red `#FECACA` | `#DC2626` |
| **Cảnh báo chậm / Quét tuần tự** | `amber` (phụ trợ) | Soft Amber `#FEF3C7` | `#D97706` |

- **Tương tác Hover Highlight chéo (`HighlightContext`):** Khi người học rê chuột vào chip `[[queue:...]]` trong Sidebar hoặc thẻ trong `DataStructuresDock`, cả dòng code tương ứng trong `CodePanel` và phần tử trên SVG cùng sáng lên theo đúng màu luồng đó.

---

## 3. Kiến trúc Bố cục 4 Vùng (Macro–Micro)

Bố cục toàn trang phải giữ cố định khung nhìn desktop **`1280×800`** (`lg:h-screen lg:overflow-hidden`) gồm 4 vùng rõ ràng:

```text
+-------------------------------------------------------------------+
| VÙNG 1: TOP BAR (MacroPipeline)                                   |
| [Tên bài + Concept Recipe] | [1 ➔ 2 ➔ 3 Pipeline] | [3 Metrics]   |
+-----------------------------------------+-------------------------+
| VÙNG 2: MAIN STAGE (~65% chiều rộng)    | VÙNG 3: SIDEBAR (~35%)  |
| - Interactive Header Widget (theo pha)  | - Context Compass       |
| - Persistent Anchor SVG (không đổi vị)  | - Giải thích 2 lớp      |
| - Micro Focus Dock / Code / Sandbox     | - Highlight Chips       |
|                                         | - KEY IDEA / WATCH OUT  |
|                                         | - WHAT CHANGED          |
+-----------------------------------------+-------------------------+
| VÙNG 4: BOTTOM BAR (BottomStepper)                                |
| [IN THIS LESSON: 1..9 Milestones]   [Back] [Play/Pause] [Next]    |
+-------------------------------------------------------------------+
```

1. **Vùng 1 — Top Bar (`MacroPipeline`):**
   - Trái: Tên bài + huy hiệu công thức (`BFS = Queue + Set + Dict`).
   - Giữa: Chuỗi **3 pill** có mũi tên nối tiếp (`1. Duyệt lớp ➔ 2. Chống lặp ➔ 3. Truy vết`). Pill đang học mở rộng & tô màu luồng; pill đã chốt hiện dấu `✓`; pill chưa tới làm mờ.
   - Phải: 3 bộ đếm trực tiếp dạng monospace (`Bước`, `Đỉnh đang xét`, `Độ dài Queue`).
2. **Vùng 2 — Main Stage (~65% chiều rộng):**
   - **Persistent Anchor:** Một SVG cố định (ví dụ `viewBox="0 0 560 360"`) giữ nguyên tọa độ các đối tượng qua mọi bước từ 1 đến 8 để não người học xây dựng bản đồ không gian bền vững.
   - **Interactive Top Widget / Bottom Dock:** Hiển thị có chọn lọc theo từng pha (`DecompositionStage`, `ToolArenaSelector` + `ToolArenaBottomWidget`, `CodeAssembler`, `CodePanel` + `DataStructuresDock`, `LimitBreaker`, hoặc `MiniCodeSandbox`).
3. **Vùng 3 — Right Sidebar (~35% chiều rộng):**
   - Chỉ số bước (`BƯỚC X / 9`), **Context Compass**, giải thích súc tích 2 lớp (1 ý chính + 1–2 câu "tại sao"), cú pháp chip tương tác `[[queue:...]]` / `[[visited:...]]` / `[[parent:...]]`, hộp nhấn mạnh (`KEY IDEA`, `WATCH OUT`, `KEY TAKEAWAY`) và 2–3 gạch đầu dòng **`WHAT CHANGED`**.
4. **Vùng 4 — Bottom Bar (`BottomStepper`):**
   - Dải milestone có tên ngắn gọn (`IN THIS LESSON`), hiển thị trạng thái khóa/đã hoàn thành, nhóm nút `Back`, `Next`, `Play/Pause`, `Replay` và hỗ trợ bàn phím (`←`, `→`, `Space`).

---

## 4. 7 Quy tắc Kỹ thuật Chống Lỗi Hiển thị & Tương tác (Battle-Tested Rules)

Đây là các lỗi thực tế đã gặp và đã xử lý dứt điểm trong quá trình kiểm thử trình duyệt; **bắt buộc tuân thủ** ở mọi bài học sau:

1. **Cấm đặt `transform="translate(x, y)"` trực tiếp lên `<motion.g>`:**
   - **Lỗi:** Framer Motion ghi đè thuộc tính `transform` của SVG bằng CSS transform khi animate (`scale`, `opacity`, v.v.), khiến cả nhóm SVG bị giật về gốc tọa độ `(0, 0)`.
   - **Cách đúng:** Luôn bọc một thẻ `<g>` thường giữ `transform` bên ngoài, còn `<motion.g>` đặt ở bên trong:
     ```tsx
     <g transform={`translate(${x}, ${y})`}>
       <motion.g animate={{ scale: isActive ? 1.08 : 1 }}>
         {/* nội dung SVG */}
       </motion.g>
     </g>
     ```
2. **Animate hạt di chuyển (particle) trực tiếp qua `cx` / `cy` trên `<motion.circle>`:**
   - **Lỗi:** Animate `x` / `y` trên `<motion.g>` không có `initial` rõ ràng dễ làm chấm tròn kẹt hoặc bị cắt nửa ở góc trái trên `(0, 0)` của `viewBox`.
   - **Cách đúng:** Dùng trực tiếp `<motion.circle initial={{ cx: x0, cy: y0 }} animate={{ cx: [...], cy: [...] }} />` bằng tọa độ SVG thuần.
3. **Chống tràn khung nhìn `1280×800` bằng `min-h-0`:**
   - **Lỗi:** Các widget nằm dưới Persistent Anchor (như bảng Stress-test 100,000 phần tử hoặc `DataStructuresDock`) đẩy chiều cao vượt `800px` hoặc bị cắt khuất.
   - **Cách đúng:** Khung gốc dùng `lg:h-screen lg:overflow-hidden`; **mọi container flex/grid** nằm giữa `header` và `footer` (bao gồm `<main>`, `<section>` của Main Stage và vùng chứa SVG) đều phải gắn `min-h-0` (và `lg:overflow-hidden` hoặc `overflow-y-auto` đúng chỗ cho Sidebar/Sandbox).
4. **Tính nhất quán toán học cho ca phản ví dụ có trọng số:**
   - **Lỗi:** Gắn trọng số minh họa tùy hứng khiến hai lộ trình dùng chung 1 đoạn đường lại có tổng hoặc cạnh chung khác số liệu.
   - **Cách đúng:** Cạnh dùng chung (ví dụ đoạn `E → F = 3 km` thuộc cả `A → C → E → F` lẫn `A → B → D → E → F`) phải giữ nguyên một giá trị duy nhất trên đồ thị, phần chênh lệch dồn vào các cạnh riêng (`A → C = 42 km` so với `A → B = 3 km`).
5. **Không lồng Markdown đậm quanh backtick trong `Sidebar`:**
   - **Lỗi:** Bộ tách chuỗi inline Markdown nếu gặp `` **`code`** `` hoặc `*italic*` không được xử lý sẽ in ra dấu sao thô trên giao diện.
   - **Cách đúng:** Không viết `**` bọc quanh `` `...` `` trong dữ liệu văn bản, đồng thời hỗ trợ tường minh token `*italic*` trong parser của `Sidebar.tsx`.
6. **Phân biệt trực quan cơ chế & hiển thị đủ nhánh trong Đấu trường:**
   - Khi mô phỏng công cụ sai ở Pha 2:
     - Nếu đỉnh có nhiều nhánh ra (như `D → A` và `D → E → F`), phải thể hiện đủ các nhánh thay vì giấu mất một nhánh.
     - Không vẽ 2 công cụ đối lập (như `List` và `Set`) giống hệt nhau: `List` phải hiện mũi tên quét tuần tự từng phần tử màu hổ phách (`O(n)`), còn `Set` hiện kiểm tra trực tiếp `O(1)` màu tím; `prev` phải hiện chuỗi 5 nhịp ghi đè trên 1 ô nhớ đơn.
     - Ở bước chạy toàn đồ thị (`Step 7`), tại mỗi nhịp chỉ tô sáng **1 đường đi hoặc 1 cạnh đang duyệt**, tránh làm loang màu toàn màn hình.
7. **Cô lập Mini-Code Sandbox hoàn toàn ở phía Client:**
   - Viết trình chạy subset Python riêng (`miniPythonRunner.ts`) với **bộ đếm giới hạn vòng lặp** (`MAX_LOOP_ITERS = 250`) để người học viết `while` vô hạn cũng không làm treo tab trình duyệt; giữ bài tập thu gọn 20–40% quy mô bài gốc và chấm tự động bằng 4 test case.

---

## 5. Cấu trúc Tệp Mẫu (Modular File Tree)

Dưới đây là cấu trúc module chuẩn đã triển khai tại dự án mẫu để sao chép khung sườn cho các bài học mới:

```text
index.html                              # Nạp Google Fonts: Be Vietnam Pro & JetBrains Mono
src/
├── index.css                           # Nền #F7F5EE, .bg-blueprint-dots (#E5E0D5), màu chữ #1E293B
├── App.tsx                             # Điều phối 4 vùng, 9 bước, cổng khóa tuần tự, timer Play/Step
├── context/
│   └── HighlightContext.tsx            # HighlightProvider & useHighlight ('queue' | 'visited' | 'parent' | 'bug')
├── data/
│   └── bfsLesson.ts                    # Dữ liệu 9 bước (phase 1..4), chip phân rã, code hợp nhất, mô phỏng từng nhịp
├── utils/
│   └── miniPythonRunner.ts             # Trình thông dịch subset Python an toàn (MAX_LOOP_ITERS=250) & hàm chấm 4 test
└── components/
    ├── MacroPipeline.tsx               # Vùng 1: Công thức + 3 pill tiến trình + 3 metrics live
    ├── DecompositionStage.tsx          # Pha 1 (Bước 1–2): Giải tay & checklist 3 ô từ 5 mảnh
    ├── ToolArena.tsx                   # Pha 2 (Bước 3–5): ToolArenaSelector + ToolArenaBottomWidget (100k test & 5-beat prev)
    ├── CodeAssembler.tsx               # Pha 3 (Bước 6): Lắp 3 mảnh công cụ vào 3 khe code Python
    ├── CodePanel.tsx                   # Pha 3 (Bước 7): Bảng code Python tô màu đồng bộ 1-1
    ├── GraphCanvas.tsx                 # Persistent Anchor SVG (viewBox="0 0 560 360") cho mọi trạng thái
    ├── DataStructuresDock.tsx          # Micro Focus Dock (Queue, Visited Set, Parent Dict) dạng thẻ đóng/mở
    ├── LimitBreaker.tsx                # Pha 4 (Bước 8): Ca phản ví dụ trọng số & KEY TAKEAWAY
    ├── MiniCodeSandbox.tsx             # Pha 5 (Bước 9): Editor Python + mô hình mini 4 đơn vị + 4 test case
    ├── Sidebar.tsx                     # Vùng 3: Context Compass, giải thích 2 lớp, chip hover, Callout, WHAT CHANGED
    └── BottomStepper.tsx               # Vùng 4: IN THIS LESSON milestones + điều khiển + phím tắt ←/→/Space
```

---

## 6. Khuôn mẫu Prompt Tạo Bài Mới (Copy-Paste Master Prompt Template)

Sao chép và điền thông tin vào các phần trong ngoặc `[...]` dưới đây để tạo nhanh một bài học tương tác mới đúng chuẩn `LESSON_BLUEPRINT`:

```markdown
# TASK: XÂY DỰNG BÀI HỌC TƯƠNG TÁC VISUALIZER V2 — [TÊN THUẬT TOÁN]

Hãy xây dựng một ứng dụng học tương tác bằng **tiếng Việt** dạy thuật toán **[TÊN THUẬT TOÁN & MỤC TIÊU BÀI TOÁN]** sử dụng React, TypeScript, Tailwind CSS, SVG và Framer Motion, tuân thủ nghiêm ngặt kiến trúc trong `LESSON_BLUEPRINT.md`.

## 1. HỆ THỐNG THIẾT KẾ & COLOR THREADING (3 BÀI TOÁN CON)
- Giữ nguyên thẩm mỹ **Warm Technical Blueprint**: nền `#F7F5EE`, chấm `#E5E0D5`, viền `1.5px solid #1E293B`, bóng `3px 3px 0 #1E293B`, font `Be Vietnam Pro` + `JetBrains Mono`.
- Phân rã thuật toán thành 3 bài toán con đồng bộ màu 1-1:
  1. **Luồng 1 (Sky Blue `#BAE6FD` / `#0284C7`):** [Tên bài toán con 1 & cấu trúc dữ liệu 1]
  2. **Luồng 2 (Lavender `#DDD6FE` / `#7C3AED`):** [Tên bài toán con 2 & cấu trúc dữ liệu 2]
  3. **Luồng 3 (Mint Green `#BBF7D0` / `#16A34A`):** [Tên bài toán con 3 & cấu trúc dữ liệu 3]
- Concept Recipe trên Top Bar: `[TÊN THUẬT TOÁN] = [CTDL 1] + [CTDL 2] + [CTDL 3]`.

## 2. LỘ TRÌNH 5 PHA (9 BƯỚC) VỚI CỔNG KHÓA TUẦN TỰ
- **Pha 1 — Không dùng Code (Bước 1–2):**
  - Persistent Anchor SVG cố định trên Stage: [Mô tả mô hình trực quan chuẩn — ví dụ đồ thị / mảng / DAG gồm X phần tử].
  - Bước 1: Cho người học tự giải bằng tay [mô tả thao tác click trực tiếp].
  - Bước 2: Trình bày 5 mảnh (3 mảnh đúng của 3 luồng + 2 mảnh nhiễu `[Mảnh nhiễu 1]`, `[Mảnh nhiễu 2]`). Chọn đúng 3 mảnh mới mở khóa Macro Pipeline.
- **Pha 2 — Đấu trường Công cụ A vs B (Bước 3–5):**
  - Bước 3 (Luồng 1): `[Công cụ sai A1]` vs `[Công cụ đúng B1]` — chạy thử để thấy [hậu quả trực quan của A1] so với [kết quả đúng của B1].
  - Bước 4 (Luồng 2): `[Công cụ chậm/thiếu A2]` vs `[Công cụ chuẩn B2]` — thể hiện khác biệt cơ chế trên SVG + mini Stress-test [ví dụ 100,000 phần tử].
  - Bước 5 (Luồng 3): `[Cách lưu thô sơ A3]` vs `[Công cụ chuẩn B3]` — minh họa bằng timeline các nhịp bị ghi đè/mất dấu trên A3.
- **Pha 3 — Lắp ráp & Chạy hợp nhất (Bước 6–7):**
  - Bước 6: Khung `CodeAssembler` gồm 3 khe đứt nét để ghép 3 công cụ đã chốt thành code Python.
  - Bước 7: Hiển thị `CodePanel` đầy đủ + `DataStructuresDock` (đóng/mở từng hộp đen) + chạy từng bước/tự động qua các nhịp mô phỏng trên cùng Persistent Anchor SVG (chỉ làm nổi bật 1 đường/nhánh tại mỗi nhịp).
- **Pha 4 — Ca phản ví dụ & Bước tiếp theo (Bước 8):**
  - Thêm điều kiện `[ĐIỀU KIỆN PHÁ VỠ GIỚI HẠN]` làm thuật toán hiện tại chọn sai kết quả (đảm bảo nhất quán toán học nếu dùng trọng số trên cạnh/phần tử chung).
  - Hiển thị `KEY TAKEAWAY` giới thiệu thuật toán kế tiếp: `[TÊN THUẬT TOÁN NÂNG CAO]`.
- **Pha 5 — Mini-Code Sandbox thực hành (Bước 9):**
  - Bài toán con thu gọn **20–40%** quy mô bài gốc ([mô tả bài toán mini]).
  - Có `STARTER_MINI_CODE`, trình chạy subset Python an toàn giới hạn vòng lặp (`MAX_LOOP_ITERS = 250`) ngay trên trình duyệt và 4 test case tự động chấm điểm.

## 3. RÀNG BUỘC KỸ THUẬT BẮT BUỘC
- Tuân thủ tuyệt đối khung desktop `1280×800` (`lg:h-screen lg:overflow-hidden` + `min-h-0` trên toàn bộ chuỗi container giữa header và footer).
- Bọc `<g transform="translate(x, y)">` ngoài `<motion.g>`, animate hạt bằng `cx`/`cy` trực tiếp trên `<motion.circle>`, không lồng `**` quanh backtick trong văn bản Sidebar.
```
