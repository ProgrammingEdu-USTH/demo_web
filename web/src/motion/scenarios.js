// ============================================================================
// KỊCH BẢN CHUẨN CHO 11 CHẶNG (M1–M11) THEO "PE · KẾ HOẠCH MOTION GRAPHIC BÀI HỌC"
//
// Mỗi bài gồm:
// - world: 'memory' | 'dj' | 'city' | 'dungeon' | 'kitchen' (5 thế giới chuẩn)
// - interactionStep: bước tự động dừng chờ người học quyết định
// - inputs: các ô người học GÕ TỪ BÀN PHÍM (giá trị điền thẳng vào code), mỗi ô có
//   kind: 'str' (chuỗi, gõ không cần ngoặc kép) | 'int' | 'num' | 'expr' (gõ tự do)
//   | 'list' (dãy số cách nhau dấu phẩy)
// - interaction.options: thẻ chọn nhanh. Thẻ có `preset` chỉ là "giá trị gõ sẵn" cho
//   các ô nhập; thẻ không có preset là một CÁCH VIẾT CODE khác (mode).
//   `ignoresInput: true` = mode không dùng ô nhập (gõ giá trị mới sẽ quay về mode mặc định).
// - buildSteps(optId, input): hàm thuần (deterministic) tính kết quả THẬT từ giá trị
//   nhập (mô phỏng đúng Python/NumPy/pandas), trả về danh sách bước (steps) để
//   goTo(n) luôn cho đúng hình ảnh, bảng biến và khay sản phẩm như khi bấm Next n lần.
// - Ô có thể sửa trong code được đánh dấu bằng slot(key, text) → UI tô sáng, bấm vào
//   sẽ nhảy tới ô nhập tương ứng.
// ============================================================================

const SLOT_L = '⟦';
const SLOT_R = '⟧';

/** Đánh dấu phần code người học có thể sửa bằng bàn phím */
export function slot(key, text) {
  const safe = String(text).replace(/[⟦⟧|]/g, '');
  return `${SLOT_L}${key}|${safe}${SLOT_R}`;
}

/** Bỏ dấu slot, trả về dòng code thuần */
export function stripSlots(line) {
  return String(line).replace(/⟦[^|⟧]*\|([^⟧]*)⟧/g, '$1');
}

/** Tách dòng code thành các mảnh [{ text, key? }] để UI tô sáng slot */
export function splitSlots(line) {
  const parts = [];
  const re = /⟦([^|⟧]*)\|([^⟧]*)⟧/g;
  let last = 0;
  let m;
  const s = String(line);
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    parts.push({ text: m[2], key: m[1] });
    last = re.lastIndex;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  return parts;
}

// ---------------------------------------------------------------------------
// Tiện ích mô phỏng Python
// ---------------------------------------------------------------------------
const pyStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const pyNum = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));
const pyFloat = (n) => (Number.isInteger(n) ? `${n}.0` : String(Number(n.toFixed(4))));
const pyKey = (k) => (typeof k === 'string' ? pyStr(k) : pyNum(k));
const npArr = (arr) => `[${arr.map(pyNum).join(' ')}]`;
const pyList = (arr) => `[${arr.map((v) => (typeof v === 'string' ? pyStr(v) : pyNum(v))).join(', ')}]`;
const pyFloorDiv = (a, b) => Math.floor(a / b);
const noAccent = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const IDENT_RE = /^[A-Za-z_À-ỹ][A-Za-z0-9_À-ỹ]*$/;
const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

/** Chuẩn hoá & kiểm tra một ô nhập. Trả { ok, value, text, msg } */
export function validateField(field, raw) {
  let text = String(raw ?? '').replace(/[⟦⟧|]/g, '').trim();
  if (field.kind === 'str') {
    const m = text.match(/^(["'])(.*)\1$/);
    if (m) text = m[2];
    if (text.length > (field.maxLen || 20)) return { ok: false, msg: `Tối đa ${field.maxLen || 20} ký tự` };
    return { ok: true, value: text, text };
  }
  if (field.kind === 'int' || field.kind === 'num') {
    if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(text)) {
      return { ok: false, msg: field.kind === 'int' ? 'Cần một số nguyên, ví dụ 3' : 'Cần một con số, ví dụ 20' };
    }
    const v = Number(text);
    if (field.kind === 'int' && !Number.isInteger(v)) return { ok: false, msg: 'Cần số nguyên (không có phần thập phân)' };
    if (field.min != null && v < field.min) return { ok: false, msg: `Nhỏ nhất là ${field.min}` };
    if (field.max != null && v > field.max) return { ok: false, msg: `Lớn nhất là ${field.max}` };
    return { ok: true, value: v, text: pyNum(v) };
  }
  if (field.kind === 'list') {
    const t = text.replace(/^\[|\]$/g, '');
    const parts = t.split(/[,\s]+/).filter(Boolean);
    if (!parts.length) return { ok: false, msg: 'Gõ các số cách nhau dấu phẩy, ví dụ 36, 24, 15' };
    const vals = [];
    for (const p of parts) {
      if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(p)) return { ok: false, msg: `"${p}" không phải số` };
      const v = Number(p);
      if (field.intOnly && !Number.isInteger(v)) return { ok: false, msg: 'Chỉ dùng số nguyên' };
      if (field.min != null && v < field.min) return { ok: false, msg: `Mỗi số phải ≥ ${field.min}` };
      if (field.max != null && v > field.max) return { ok: false, msg: `Mỗi số phải ≤ ${field.max}` };
      vals.push(v);
    }
    if (field.minCount && vals.length < field.minCount) return { ok: false, msg: `Cần ít nhất ${field.minCount} số` };
    if (field.maxCount && vals.length > field.maxCount) return { ok: false, msg: `Tối đa ${field.maxCount} số` };
    return { ok: true, value: vals, text: vals.map(pyNum).join(', ') };
  }
  // 'expr': gõ tự do, bài học tự diễn giải (có thể ra SyntaxError thật trong cảnh)
  if (!text) return { ok: false, msg: 'Không được để trống' };
  if (text.length > (field.maxLen || 24)) return { ok: false, msg: `Tối đa ${field.maxLen || 24} ký tự` };
  return { ok: true, value: text, text };
}

/** Gộp giá trị nhập với mặc định của bài → object { key: giá trị đã chuẩn hoá } */
export function resolveInput(lesson, input = {}) {
  const out = {};
  for (const f of lesson.inputs || []) {
    const raw = input && input[f.key] != null ? input[f.key] : f.default;
    const v = validateField(f, raw);
    out[f.key] = v.ok ? v.value : validateField(f, f.default).value;
  }
  return out;
}

/** Dạng chữ (đã chuẩn hoá) của giá trị để hiện lại trong ô nhập */
export function inputText(lesson, input = {}) {
  const out = {};
  for (const f of lesson.inputs || []) {
    const raw = input && input[f.key] != null ? input[f.key] : f.default;
    const v = validateField(f, raw);
    out[f.key] = v.ok ? v.text : String(f.default);
  }
  return out;
}

// ============================================================================
export const LESSONS_11 = [
  // ==========================================================================
  // 1. M1 · PY12 · Dictionary (Thế giới: Bàn & Kho — Bản mẫu chuẩn trang 9)
  // ==========================================================================
  {
    idx: 0,
    module: 'M1 · Python nền tảng',
    codeId: 'PY12',
    title: 'Dictionary và tra cứu theo khóa',
    world: 'memory',
    coreConcept: 'Biết khóa thì lấy thẳng giá trị trong ngăn tủ; khóa phải khớp CHÍNH XÁC từng ký tự.',
    metaphor: 'Dict = tủ ngăn, khóa = nhãn dán trên ngăn, giá trị = đồ chứa trong ngăn.',
    context: {
      story: 'Quầy tạp hoá cần in tem giá theo tên món. Giá được cất trong một tủ nhiều ngăn, mỗi ngăn dán nhãn là tên món.',
      goal: 'Có tên món, lấy đúng giá bằng cách nào — và chuyện gì xảy ra khi tên món không có trong tủ?',
      legend: [['🗄️', 'Tủ nhiều ngăn', 'gia_ca (dict)'], ['🏷️', 'Nhãn trên ngăn', 'khóa "sữa"'], ['📦', 'Đồ trong ngăn', 'giá trị 18'], ['🖨️', 'Máy in tem', 'print()'], ['🧰', 'Tủ kẹt cứng', 'KeyError']],
    },
    codeTags: { 'dr-tao': 'gia_ca["táo"]', 'dr-sua': 'gia_ca["sữa"]', 'dr-banh': 'gia_ca["bánh"]', 'dr-kem': '"kem" ∉ gia_ca', printer: 'print()', 'carried-item': 'gia', 'key-card': 'mon' },
    xp: 120,
    interactionStep: 1,
    defaultOption: 'sua',
    inputs: [{ key: 'mon', label: 'mon =', kind: 'str', default: 'sữa', maxLen: 14, placeholder: 'táo / sữa / bánh…' }],
    interaction: {
      type: 'drag',
      typeLabel: 'Gõ khóa / kéo ngăn vào máy',
      prompt: 'Gõ tên khóa `mon` rồi Enter, hoặc kéo ngăn "táo", "sữa", "bánh" (hay thẻ "kem") thả vào Máy in tem.',
      options: [
        { id: 'sua', label: '🥛 "sữa"', preset: { mon: 'sữa' }, desc: 'Tra ngăn Sữa (18k)' },
        { id: 'tao', label: '🍎 "táo"', preset: { mon: 'táo' }, desc: 'Tra ngăn Táo (15k)' },
        { id: 'banh', label: '🍰 "bánh"', preset: { mon: 'bánh' }, desc: 'Tra ngăn Bánh (25k)' },
        { id: 'kem', label: '🍦 "kem"', preset: { mon: 'kem' }, isError: true, desc: 'Thử khóa chưa có ngăn' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const DICT = { táo: 15, sữa: 18, bánh: 25 };
      const KEYS = Object.keys(DICT);
      const key = inp.mon ?? 'sữa';
      const found = Object.prototype.hasOwnProperty.call(DICT, key);
      const slotIdx = KEYS.indexOf(key);
      const price = found ? DICT[key] : null;
      const icon = { táo: 'tao', sữa: 'sua', bánh: 'banh' }[key] || (key === 'kem' ? 'kem' : null);

      const codeLines = [
        'gia_ca = {"táo": 15, "sữa": 18, "bánh": 25}',
        `mon = "${slot('mon', key)}"`,
        'gia = gia_ca[mon]',
        'print(f"Giá {mon}: {gia}k")',
        'kem = gia_ca.get("kem", 0)',
        'print(f"Kem: {kem}")',
      ];

      const kemCard = {
        id: 'dr-kem', kind: 'drawer_ghost', optId: 'kem', foodIcon: 'kem', isErrorOpt: true,
        x: 12, y: 86, w: 40, h: 32, label: '"kem"', inside: '? chưa có',
        inspect: 'Thẻ "kem" chưa có ngăn trong tủ gia_ca — kéo vào Máy in tem để xem KeyError!',
      };
      const drawers = [
        { id: 'dr-tao', kind: 'drawer', optId: 'tao', foodIcon: 'tao', x: 56, y: 86, w: 46, h: 32, label: '"táo"', inside: '15', inspect: 'Ngăn "táo" chứa 15 — kéo vào Máy in tem để in giá!' },
        { id: 'dr-sua', kind: 'drawer', optId: 'sua', foodIcon: 'sua', x: 108, y: 86, w: 46, h: 32, label: '"sữa"', inside: '18', inspect: 'Ngăn "sữa" chứa 18 — kéo vào Máy in tem để in giá!' },
        { id: 'dr-banh', kind: 'drawer', optId: 'banh', foodIcon: 'banh', x: 160, y: 86, w: 46, h: 32, label: '"bánh"', inside: '25', inspect: 'Ngăn "bánh" chứa 25 — kéo vào Máy in tem để in giá!' },
      ];
      const machine = {
        id: 'printer', kind: 'printer', x: 222, y: 86, w: 46, h: 54, label: 'Máy in tem',
        inspect: 'Máy in tem: nhận món đã tra được và in tem giá ra Khay tem',
      };
      // Thẻ khóa người học gõ (mang đúng chữ đã gõ, kể cả sai dấu)
      const keyCard = { id: 'key-card', kind: 'tag_card', x: 92, y: 56, w: 60, h: 16, label: `mon = "${key}"`, highlight: true };

      const steps = [
        {
          line: 1,
          trace: [
            { t: 'gia_ca = {"táo": 15, "sữa": 18, "bánh": 25}', n: 'tạo 1 dict gồm 3 cặp khóa → giá trị', f: ['dr-tao', 'dr-sua', 'dr-banh'] },
            { t: 'gia_ca ──► tủ 3 ngăn', n: 'tên gia_ca trỏ tới cả chiếc tủ', f: ['dr-tao', 'dr-sua', 'dr-banh'] },
          ],
          caption: 'Dựng tủ ngăn `gia_ca` gồm 3 ngăn `"táo": 15`, `"sữa": 18`, `"bánh": 25` trên bàn gỗ và `Máy in tem` ở bên phải.',
          vars: { gia_ca: '{"táo": 15, "sữa": 18, "bánh": 25}' },
          mascot: { x: 276, y: 108, pose: 'idle', say: 'Tủ 3 ngăn!' },
          objects: [kemCard, ...drawers, machine],
          products: [],
        },
        {
          line: 2,
          isInteraction: true,
          trace: [{ t: `mon = "${key}"`, n: 'mới gán chuỗi vào tên mon — chưa tra gì cả', f: icon ? `dr-${icon}` : null }],
          caption: 'Gõ tên khóa vào ô `mon = "…"` (Enter để chạy) hoặc kéo một ngăn thả vào **Máy in tem**. Khóa phải khớp chính xác nhãn trên ngăn!',
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key) },
          mascot: { x: 276, y: 108, pose: 'work', say: 'Gõ khóa nào?' },
          objects: [kemCard, ...drawers.map((d) => (d.id === `dr-${icon}` ? { ...d, highlight: true } : d)), { ...machine, highlight: true }],
          products: [],
        },
      ];

      if (!found) {
        // Gợi ý khóa gần đúng (sai dấu / hoa thường) — lỗi rất hay gặp khi gõ tiếng Việt
        const near = KEYS.find((k) => noAccent(k) === noAccent(key) && k !== key);
        const isKem = key === 'kem';
        steps.push({
          line: 3,
          trace: [
            { t: 'gia = gia_ca[mon]', n: 'Python tính vế phải trước', f: null },
            { t: `gia = gia_ca["${key}"]`, n: 'thay tên mon bằng giá trị nó đang giữ', f: isKem ? 'dr-kem' : 'key-card' },
            { t: `KeyError: ${pyStr(key)}`, n: near ? `không ngăn nào dán nhãn "${key}" (chỉ có "${near}")` : 'không ngăn nào dán nhãn này → dừng chương trình', f: ['dr-tao', 'dr-sua', 'dr-banh'] },
          ],
          caption: near
            ? `Sự cố! Bạn gõ \`"${key}"\` nhưng nhãn trên ngăn là \`"${near}"\`. Với dict, khác một dấu hay một chữ hoa cũng là **khóa khác** → tủ kẹt cứng!`
            : `Sự cố! Tra \`gia_ca["${key}"]\` nhưng tủ chỉ có ngăn \`"táo"\`, \`"sữa"\`, \`"bánh"\`: tủ ngăn kẹt cứng và nghiêng lệch!`,
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key), gia: '❌ KeyError' },
          mascot: { x: 276, y: 110, pose: 'error', say: `Không có ngăn "${key}"!` },
          error: {
            name: `KeyError: ${pyStr(key)}`,
            line: 3,
            incident: `Tra khóa "${key}" không có trong tủ gia_ca: tủ bị kẹt cứng và nghiêng lệch.`,
            hint: near
              ? `Gõ đúng "${near}" (khóa so khớp từng ký tự), hoặc dùng gia_ca.get(mon, 0) để không bị lỗi.`
              : 'Gõ một khóa có sẵn (táo, sữa, bánh), hoặc dùng gia_ca.get(mon, 0) để lấy giá trị mặc định.',
          },
          objects: [
            isKem ? { ...kemCard, jammed: true, highlight: true } : kemCard,
            ...drawers.map((d) => ({ ...d, jammed: true, highlight: near && d.label === `"${near}"` })),
            ...(isKem ? [] : [{ ...keyCard, jammed: true }]),
            { id: 'jam-sign', kind: 'jam_alert', x: 92, y: 36, w: 92, h: 16, label: `KeyError: ${pyStr(key)}`, error: true },
            machine,
          ],
          products: [],
        });
        return { codeLines, steps };
      }

      const activeDrawerId = ['dr-tao', 'dr-sua', 'dr-banh'][slotIdx];
      const targetX = [56, 108, 160][slotIdx];
      const p1 = { id: 'prod-1', kind: 'price_tag', title: `Giá ${key}: ${price}k`, raw: `print(f"Giá {mon}: {gia}k") → Giá ${key}: ${price}k`, isEmpty: false };
      const p2 = { id: 'prod-2', kind: 'price_tag', title: 'Kem: 0', raw: 'print(f"Kem: {kem}") → Kem: 0', isEmpty: true };
      const carried = { id: 'carried-item', kind: 'tag_card', foodIcon: icon, w: 44, h: 16, label: `${key}: ${price}k`, highlight: true };

      steps.push(
        {
          line: 3,
          trace: [
            { t: 'gia = gia_ca[mon]', n: 'Python tính vế phải trước', f: null },
            { t: `gia = gia_ca["${key}"]`, n: 'thay tên mon bằng giá trị nó đang giữ', f: activeDrawerId },
            { t: `gia = ${price}`, n: 'mở đúng ngăn có nhãn đó, lấy giá trị, gán cho tên gia', f: 'carried-item' },
          ],
          caption: `Khóa \`"${key}"\` khớp nhãn ngăn: Bit mở thẳng ngăn đó (không lục các ngăn khác) và nhấc ra \`gia = ${price}\`.`,
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key), gia: String(price) },
          mascot: { x: 276, y: 108, pose: 'happy', say: `${key} = ${price}k!` },
          objects: [
            kemCard,
            ...drawers.map((d) => (d.id === activeDrawerId ? { ...d, open: true, highlight: true } : d)),
            { ...carried, x: targetX + 1, y: 62 },
            machine,
          ],
          products: [],
        },
        {
          line: 4,
          trace: [
            { t: 'print(f"Giá {mon}: {gia}k")', n: 'f-string: điền giá trị vào các chỗ {…}', f: 'carried-item' },
            { t: `print("Giá ${key}: ${price}k")`, n: 'chuỗi đã hoàn chỉnh', f: 'printer' },
            { t: `→ Giá ${key}: ${price}k`, n: 'in ra màn hình = 1 tem rơi vào khay', f: 'printer' },
          ],
          caption: `Món \`${key}: ${price}\` đi vào **Máy in tem**: lệnh \`print()\` in ngay **Tem "Giá ${key}: ${price}k"** bay vào Khay tem!`,
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key), gia: String(price) },
          mascot: { x: 276, y: 108, pose: 'work', say: 'Máy in xuất tem!' },
          objects: [
            kemCard,
            ...drawers.map((d) => (d.id === activeDrawerId ? { ...d, open: true } : d)),
            { ...carried, x: 174, y: 60 },
            { ...machine, active: true, highlight: true },
          ],
          products: [p1],
          justPrinted: p1,
        },
        {
          line: 5,
          trace: [
            { t: 'kem = gia_ca.get("kem", 0)', n: '.get(khóa, mặc định) là cách tra "mềm"', f: 'dr-kem' },
            { t: '"kem" in gia_ca → False', n: 'không có ngăn "kem"', f: 'dr-kem' },
            { t: 'kem = 0', n: 'trả về mặc định thay vì báo lỗi', f: 'dr-kem' },
          ],
          caption: 'Dòng 5 tra `"kem"` bằng `gia_ca.get("kem", 0)`: không có ngăn nhưng `.get()` êm ái trả về mặc định `0` thay vì làm kẹt tủ.',
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key), gia: String(price), kem: '0 (mặc định)' },
          mascot: { x: 276, y: 108, pose: 'idle', say: '.get → 0' },
          objects: [{ ...kemCard, label: '"kem" → 0', inside: '0k', isErrorOpt: false, highlight: true }, ...drawers, machine],
          products: [p1],
        },
        {
          line: 6,
          trace: [
            { t: 'print(f"Kem: {kem}")', n: 'điền kem = 0 vào chuỗi', f: 'dr-kem' },
            { t: '→ Kem: 0', n: 'tem thứ hai', f: 'printer' },
          ],
          caption: 'Máy in tiếp tem mặc định `"Kem: 0"` (viền đứt mờ). Gõ khóa khác vào ô `mon` (thử cả `"sua"` không dấu!) để xem tủ phản ứng thế nào.',
          vars: { gia_ca: '{...3 ngăn}', mon: pyStr(key), gia: String(price), kem: '0' },
          mascot: { x: 276, y: 108, pose: 'happy', say: 'Thử khóa khác!' },
          objects: [kemCard, ...drawers, { ...machine, active: true, highlight: true }],
          products: [p1, p2],
          justPrinted: p2,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 2. M2 · NP14 · NumPy: Lọc bằng mask & Chỉ số (Thế giới: DJ Sequencer)
  // ==========================================================================
  {
    idx: 1,
    module: 'M2 · NumPy',
    codeId: 'NP14',
    title: 'NumPy: Hàng ô nhịp, lọc bằng mask và chỉ số',
    world: 'dj',
    coreConcept: 'Boolean mask bật/tắt cả hàng ô cùng lúc; chỉ số hợp lệ là 0..n-1 (hoặc âm -n..-1), ngoài đó là IndexError.',
    metaphor: 'Array 1D = hàng 4 pad nhịp, mask = công tắc mute từng ô, Máy ép đĩa xuất đĩa nhạc.',
    context: {
      story: 'Bàn DJ có 4 ô nhịp xếp thành một hàng. Bạn muốn giữ lại các nhịp đủ mạnh và đọc một ô theo vị trí.',
      goal: 'mask lọc cả hàng trong một lệnh như thế nào? Chỉ số nào hợp lệ, chỉ số âm nghĩa là gì?',
      legend: [['🎛️', 'Hàng 4 pad', 'nhip (np.array)'], ['🔢', 'Số thứ tự pad', 'chỉ số nhip[i]'], ['💡', 'Đèn bật / tắt', 'mask True / False'], ['💿', 'Đĩa ép ra', 'print()'], ['🕳️', 'Ô không tồn tại', 'IndexError']],
    },
    codeTags: { 'pad-0': 'nhip[0]', 'pad-1': 'nhip[1]', 'pad-2': 'nhip[2]', 'pad-3': 'nhip[3]', 'pad-ghost': 'nhip[idx]', presser: 'print()' },
    xp: 130,
    interactionStep: 1,
    defaultOption: '20',
    inputs: [
      { key: 'nguong', label: 'nguong =', kind: 'num', default: '20', min: -999, max: 999 },
      { key: 'idx', label: 'idx =', kind: 'int', default: '0', min: -99, max: 99 },
    ],
    interaction: {
      type: 'number',
      typeLabel: 'Gõ ngưỡng & chỉ số',
      prompt: 'Gõ ngưỡng lọc `nguong` và chỉ số `idx` (thử số âm như -1, hay 4 để vượt kệ) rồi Enter.',
      options: [
        { id: '20', label: 'nguong=20, idx=0', preset: { nguong: '20', idx: '0' }, desc: 'Giữ các ô ≥ 20' },
        { id: '25', label: 'nguong=25, idx=-1', preset: { nguong: '25', idx: '-1' }, desc: 'Chỉ số âm: ô cuối' },
        { id: '35', label: 'nguong=35 (rỗng)', preset: { nguong: '35', idx: '0' }, desc: 'Không ô nào đạt' },
        { id: 'err_idx', label: 'idx = 4 (vượt kệ)', preset: { idx: '4' }, isError: true, desc: 'Chỉ số thứ 5 trên kệ 4 ô' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const th = inp.nguong ?? 20;
      const idx = inp.idx ?? 0;
      const arr = [18, 25, 14, 30];
      const n = arr.length;
      const norm = idx < 0 ? n + idx : idx;
      const idxOk = norm >= 0 && norm < n;
      const mask = arr.map((v) => v >= th);
      const filtered = arr.filter((v) => v >= th);

      const codeLines = [
        'import numpy as np',
        'nhip = np.array([18, 25, 14, 30])',
        `mask = nhip >= ${slot('nguong', pyNum(th))}`,
        'print(nhip[mask])',
        `print(nhip[${slot('idx', String(idx))}])`,
      ];

      const pads = arr.map((v, i) => ({
        id: `pad-${i}`, kind: 'dj_pad', x: 46 + i * 40, y: 88, w: 34, h: 30,
        label: `[${i}] ${v}`, sub: `[${i - n}]`, inside: String(v), inspect: `nhip[${i}] (hay nhip[${i - n}]) = ${v}`,
      }));
      const presser = { id: 'presser', kind: 'disc_presser', x: 250, y: 90, w: 40, h: 50, label: 'Máy ép đĩa', inspect: 'Máy ép đĩa: đóng gói kết quả print() thành Đĩa nhạc vào Kệ đĩa' };
      const maskStr = `[${mask.map((b) => (b ? 'True' : 'False')).join(', ')}]`;

      const p1 = {
        id: 'dj-p1', kind: 'vinyl_disc',
        title: filtered.length ? `Đĩa ${npArr(filtered)}` : 'Đĩa rỗng []',
        raw: `print(nhip[mask]) → ${npArr(filtered)}`,
        isEmpty: filtered.length === 0,
      };

      const steps = [
        {
          line: [1, 2],
          trace: [
            { t: 'nhip = np.array([18, 25, 14, 30])', n: '1 mảng 4 phần tử, chỉ số 0..3', f: ['pad-0', 'pad-1', 'pad-2', 'pad-3'] },
            { t: 'nhip[0]=18 · nhip[1]=25 · nhip[2]=14 · nhip[3]=30', n: 'mỗi ô có 1 vị trí', f: ['pad-0', 'pad-1', 'pad-2', 'pad-3'] },
          ],
          caption: 'Bàn DJ nạp 4 ô nhịp `nhip = np.array([18, 25, 14, 30])`. Mỗi ô có hai tên: chỉ số dương `0..3` và chỉ số âm `-4..-1`.',
          vars: { nhip: 'array([18, 25, 14, 30])', 'len(nhip)': '4' },
          mascot: { x: 4, y: 108, pose: 'idle', say: '4 ô: 0..3' },
          objects: [...pads, presser],
          products: [],
        },
        {
          line: 3,
          isInteraction: true,
          trace: [
            { t: `mask = nhip >= ${pyNum(th)}`, n: 'so sánh CẢ mảng trong 1 lệnh (vector hoá)', f: ['pad-0', 'pad-1', 'pad-2', 'pad-3'] },
            { t: `[${arr.map((v) => `${v}>=${pyNum(th)}`).join(', ')}]`, n: 'NumPy tự so từng ô', f: ['pad-0', 'pad-1', 'pad-2', 'pad-3'] },
            { t: `mask = ${maskStr}`, n: 'được 1 mảng công tắc True/False', f: arr.map((_, i) => `pad-${i}`).filter((_, i) => mask[i]) },
          ],
          caption: `So sánh cả hàng một lần \`nhip >= ${pyNum(th)}\` tạo mảng công tắc \`mask\`. Gõ ngưỡng khác để thấy đèn bật/tắt thay đổi!`,
          vars: { nhip: '[18, 25, 14, 30]', mask: maskStr },
          mascot: { x: 4, y: 108, pose: 'work', say: `Lọc >= ${pyNum(th)}` },
          objects: [...pads.map((p, i) => ({ ...p, highlight: mask[i], muted: !mask[i], maskBit: mask[i] })), presser],
          products: [],
        },
        {
          line: 4,
          trace: [
            { t: 'print(nhip[mask])', n: 'dùng mask làm chỉ số', f: arr.map((_, i) => `pad-${i}`).filter((_, i) => mask[i]) },
            { t: `nhip[${maskStr}]`, n: 'chỉ giữ ô nào ứng với True', f: arr.map((_, i) => `pad-${i}`).filter((_, i) => mask[i]) },
            { t: `→ ${npArr(filtered)}`, n: filtered.length ? 'mảng mới chỉ còn các ô đèn sáng' : 'không ô nào đạt → mảng rỗng', f: 'presser' },
          ],
          caption: filtered.length
            ? `\`print(nhip[mask])\` chỉ giữ ô đèn sáng (${filtered.length}/4 ô), Máy ép đĩa tạo **${p1.title}**.`
            : `Không ô nào \`>= ${pyNum(th)}\`: mask toàn \`False\` nên kết quả là mảng **rỗng** \`[]\` — không lỗi, chỉ là không còn gì.`,
          vars: { mask: maskStr, 'nhip[mask]': npArr(filtered) },
          mascot: { x: 206, y: 108, pose: filtered.length ? 'happy' : 'idle', say: filtered.length ? 'Ép đĩa mask!' : 'Đĩa trống trơn' },
          objects: [...pads.map((p, i) => ({ ...p, highlight: mask[i], muted: !mask[i], maskBit: mask[i] })), { ...presser, active: true, highlight: true }],
          products: [p1],
          justPrinted: p1,
        },
      ];

      if (!idxOk) {
        const right = idx >= n;
        steps.push({
          line: 5,
          trace: [
            { t: `print(nhip[${idx}])`, n: 'đọc ô ở vị trí idx', f: 'pad-ghost' },
            { t: idx < 0 ? `${idx} → 4 + (${idx}) = ${norm}` : `${idx} ≥ len(nhip) = 4`, n: 'nằm ngoài khoảng hợp lệ (0..3 hoặc -4..-1)', f: 'pad-ghost' },
            { t: 'IndexError', n: 'không có ô đó → dừng chương trình', f: 'pad-ghost' },
          ],
          caption: right
            ? `Sự cố! Bit với tay sang phải tìm ô \`nhip[${idx}]\` nhưng bàn chỉ có ô \`0..3\`: hụt tay và ngã khỏi bục DJ!`
            : `Sự cố! Chỉ số âm \`${idx}\` lùi quá đầu bàn (âm nhỏ nhất là \`-4\`): Bit với tay sang trái và hụt!`,
          vars: { 'len(nhip)': '4', [`nhip[${idx}]`]: '❌ IndexError' },
          mascot: { x: right ? 206 : 12, y: 112, pose: 'error', say: 'Hụt tay ngã!' },
          error: {
            name: `IndexError: index ${idx} is out of bounds for axis 0 with size 4`,
            line: 5,
            incident: `Với tới ô [${idx}] ngoài bàn 4 ô (hợp lệ: 0..3 hoặc -4..-1): hụt tay và ngã.`,
            hint: 'Chỉ số hợp lệ từ 0 đến len(nhip)-1 = 3, hoặc âm từ -4 đến -1 (đếm từ cuối).',
          },
          objects: [
            ...pads,
            { id: 'pad-ghost', kind: 'drawer_ghost', isErrorOpt: true, x: right ? 210 : 6, y: 88, w: 34, h: 30, label: `[${idx}]`, inside: 'không có' },
            { id: 'idx-err', kind: 'jam_alert', x: 110, y: 50, w: 100, h: 16, label: `IndexError: [${idx}]`, error: true },
            presser,
          ],
          products: [p1],
        });
      } else {
        const val = arr[norm];
        const p2 = { id: 'dj-p2', kind: 'vinyl_disc', title: `nhip[${idx}] = ${val}`, raw: `print(nhip[${idx}]) → ${val}`, isEmpty: false };
        steps.push({
          line: 5,
          trace: [
            { t: `print(nhip[${idx}])`, n: 'đọc ô ở vị trí idx', f: `pad-${norm}` },
            ...(idx < 0 ? [{ t: `${idx} → 4 + (${idx}) = ${norm}`, n: 'chỉ số âm được đổi thành đếm từ cuối', f: `pad-${norm}` }] : []),
            { t: `→ ${val}`, n: 'giá trị của ô đó', f: `pad-${norm}` },
          ],
          caption:
            idx < 0
              ? `Chỉ số âm \`${idx}\` đếm từ cuối: \`nhip[${idx}]\` chính là ô \`[${norm}]\` = \`${val}\`. Máy ép thêm đĩa thứ hai.`
              : `\`print(nhip[${idx}])\` lấy đúng ô thứ ${idx + 1} (chỉ số bắt đầu từ 0) = \`${val}\`. Máy ép thêm đĩa thứ hai.`,
          vars: { [`nhip[${idx}]`]: String(val) },
          mascot: { x: 206, y: 108, pose: 'happy', say: `nhip[${idx}] = ${val}!` },
          objects: [...pads.map((p, i) => (i === norm ? { ...p, highlight: true, picked: true } : p)), { ...presser, active: true }],
          products: [p1, p2],
          justPrinted: p2,
        });
      }
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 3. M3 · PD14 · pandas: Groupby gom đơn theo khu (Thế giới: Giao thông & Shipper)
  // ==========================================================================
  {
    idx: 2,
    module: 'M3 · pandas',
    codeId: 'PD14',
    title: 'pandas: Bảng điều phối đơn và Groupby theo khu',
    world: 'city',
    coreConcept: 'groupby chia các dòng về từng nhóm theo giá trị một cột, rồi phép gộp (sum/size/mean…) chạy riêng trên từng nhóm.',
    metaphor: 'DataFrame = bảng điều phối đơn, groupby = gom kiện theo khu, Shipper giao biên nhận vào Cổng nhận hàng.',
    context: {
      story: 'Trạm điều phối có 3 đơn hàng thuộc các khu Q1, Q2. Cần biết mỗi khu tổng cộng bao nhiêu cốc.',
      goal: 'groupby chia các dòng thành nhóm thế nào, rồi phép gộp (sum, mean…) chạy trên đâu?',
      legend: [['📋', 'Bảng điều phối', 'don (DataFrame)'], ['📦', 'Một kiện hàng', 'một dòng'], ['🗂️', 'Một chồng kiện', 'một nhóm của groupby'], ['➕', 'Tính trên chồng', '.sum() / .mean() …'], ['🚚', 'Biên nhận', 'print(dict)']],
    },
    codeTags: { 'p-1': 'dòng 0', 'p-2': 'dòng 1', 'p-3': 'dòng 2', depot: 'print()' },
    xp: 140,
    interactionStep: 1,
    defaultOption: 'khu_sum',
    inputs: [
      { key: 'cot', label: 'groupby("', suffix: '")', kind: 'str', default: 'khu', maxLen: 10 },
      { key: 'gop', label: '["coc"].', suffix: '()', kind: 'expr', default: 'sum', maxLen: 10 },
    ],
    interaction: {
      type: 'card',
      typeLabel: 'Gõ cột & phép gộp',
      prompt: 'Gõ tên cột để gom (`khu` hay `coc`) và phép gộp (`sum`, `size`, `mean`, `max`, `min`) rồi Enter.',
      options: [
        { id: 'khu_sum', label: 'groupby("khu") · sum', preset: { cot: 'khu', gop: 'sum' }, desc: 'Cộng số cốc mỗi khu' },
        { id: 'khu_size', label: 'groupby("khu") · size', preset: { cot: 'khu', gop: 'size' }, desc: 'Đếm số đơn mỗi khu' },
        { id: 'khu_mean', label: 'groupby("khu") · mean', preset: { cot: 'khu', gop: 'mean' }, desc: 'Trung bình cốc mỗi khu' },
        { id: 'err_col', label: 'groupby("quan")', preset: { cot: 'quan', gop: 'sum' }, isError: true, desc: 'Cột không tồn tại' },
        { id: 'err_type', label: 'don["khu"] + 5', ignoresInput: true, isError: true, desc: 'Cộng chữ với số' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const ROWS = [
        { khu: 'Q1', coc: 12 },
        { khu: 'Q2', coc: 25 },
        { khu: 'Q1', coc: 18 },
      ];
      const COLS = ['khu', 'coc'];
      const isTypeErr = optId === 'err_type';
      const col = inp.cot ?? 'khu';
      const gop = inp.gop ?? 'sum';
      const AGGS = ['sum', 'size', 'count', 'mean', 'max', 'min'];

      const expr = isTypeErr ? 'don["khu"] + 5' : `don.groupby("${slot('cot', col)}")["coc"].${slot('gop', gop)}()`;
      const codeLines = [
        'import pandas as pd',
        'don = pd.DataFrame({"khu": ["Q1", "Q2", "Q1"], "coc": [12, 25, 18]})',
        `ket_qua = ${expr}`,
        'print(ket_qua.to_dict())',
      ];

      const parcels = ROWS.map((r, i) => ({
        id: `p-${i + 1}`, kind: 'parcel', x: 44 + i * 56, y: 88, w: 48, h: 28,
        label: `Đơn${i + 1} ${r.khu}:${r.coc}`, inspect: `Hàng ${i}: khu="${r.khu}", coc=${r.coc}`,
      }));
      const depot = { id: 'depot', kind: 'shipper_gate', x: 236, y: 90, w: 42, h: 50, label: 'Trạm Shipper', inspect: 'Shipper chở kết quả print() tới Cổng nhận hàng' };

      const steps = [
        {
          line: [1, 2],
          trace: [
            { t: 'don = pd.DataFrame({...})', n: 'bảng 3 dòng × 2 cột', f: ['p-1', 'p-2', 'p-3'] },
            { t: 'mỗi dòng = 1 kiện (khu, coc)', n: 'ví dụ dòng 0: khu="Q1", coc=12', f: 'p-1' },
          ],
          caption: 'Bảng điều phối `don` có 3 dòng (3 kiện hàng) và 2 cột: `"khu"` (chữ) và `"coc"` (số cốc).',
          vars: { 'len(don)': '3 đơn', columns: "['khu', 'coc']" },
          mascot: { x: 4, y: 108, pose: 'idle', say: '3 đơn chờ gom!' },
          objects: [...parcels, depot],
          products: [],
        },
        {
          line: 3,
          isInteraction: true,
          trace: [{ t: stripSlots(expr), n: 'chưa chạy — chờ bạn chọn cột và phép gộp', f: ['p-1', 'p-2', 'p-3'] }],
          caption: 'Gõ tên cột muốn gom nhóm và phép gộp chạy trên cột `"coc"` của mỗi nhóm.',
          vars: { columns: "['khu', 'coc']", lenh: stripSlots(expr) },
          mascot: { x: 4, y: 108, pose: 'work', say: 'Gom theo cột nào?' },
          objects: [...parcels.map((p) => ({ ...p, highlight: true })), depot],
          products: [],
        },
      ];

      const fail = (error, caption, alertLabel, vars) => {
        steps.push({
          line: 3,
          trace: [
            { t: stripSlots(expr), n: 'Python chạy dòng này…', f: ['p-1', 'p-2', 'p-3'] },
            { t: alertLabel, n: error.incident, f: null },
          ],
          caption,
          vars,
          mascot: { x: 4, y: 110, pose: 'error', say: 'Kẹt máy rồi!' },
          error: { line: 3, ...error },
          objects: [
            ...parcels.map((p) => ({ ...p, jammed: true })),
            { id: 'err-b', kind: 'jam_alert', x: 80, y: 52, w: 116, h: 16, label: alertLabel, error: true },
            depot,
          ],
          products: [],
        });
        return { codeLines, steps };
      };

      if (isTypeErr) {
        return fail(
          {
            name: 'TypeError: can only concatenate str (not "int") to str',
            incident: 'Ghép hai thứ không khớp (chuỗi "Q1" + số 5): máy phân loại bật nắp, bắn kiện ra.',
            hint: 'Chỉ cộng số trên cột số don["coc"], hoặc đổi kiểu bằng astype(int) / astype(str).',
          },
          'Sự cố! Cột `"khu"` chứa chữ (`"Q1"`), cộng với số `5` không khớp kiểu: máy phân loại bật nắp, bắn kiện văng ra!',
          'TypeError: str + int',
          { 'don["khu"]': 'chữ ("Q1"…)', ket_qua: '❌ TypeError' },
        );
      }
      if (!COLS.includes(col)) {
        const near = COLS.find((c) => noAccent(c) === noAccent(col));
        return fail(
          {
            name: `KeyError: ${pyStr(col)}`,
            incident: `Gom theo cột "${col}" nhưng bảng không có cột đó: cổng điều phối kẹt cứng.`,
            hint: near ? `Tên cột phân biệt hoa/thường: dùng "${near}".` : 'Xem don.columns (chỉ có "khu" và "coc") trước khi groupby.',
          },
          `Sự cố! Bảng \`don\` chỉ có cột \`"khu"\` và \`"coc"\`, không có \`"${col}"\` nên cổng điều phối kẹt cứng!`,
          `KeyError: ${pyStr(col)}`,
          { columns: "['khu', 'coc']", ket_qua: `❌ KeyError: ${pyStr(col)}` },
        );
      }
      if (!IDENT_RE.test(gop) || PY_KEYWORDS.has(gop)) {
        return fail(
          { name: 'SyntaxError: invalid syntax', incident: `"${gop}" không phải tên hợp lệ để gọi sau dấu chấm.`, hint: 'Gõ tên phép gộp như sum, size, mean, max, min.' },
          `Sự cố! \`["coc"].${gop}()\` không phải câu lệnh Python hợp lệ.`,
          'SyntaxError',
          { ket_qua: '❌ SyntaxError' },
        );
      }
      if (!AGGS.includes(gop)) {
        return fail(
          {
            name: `AttributeError: 'SeriesGroupBy' object has no attribute ${pyStr(gop)}`,
            incident: `Ra lệnh "${gop}" cho các nhóm, nhưng nhóm không biết phép đó: máy đứng im.`,
            hint: 'Các phép gộp thường dùng: sum, size, count, mean, max, min.',
          },
          `Sự cố! Nhóm đơn không có phép \`.${gop}()\`: máy gom đứng im lắc đầu.`,
          `AttributeError: ${gop}`,
          { ket_qua: '❌ AttributeError' },
        );
      }

      // Gom nhóm thật (pandas sắp khóa nhóm tăng dần)
      const keys = [...new Set(ROWS.map((r) => r[col]))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const groups = keys.map((k) => ({ key: k, rows: ROWS.map((r, i) => ({ ...r, i })).filter((r) => r[col] === k) }));
      const agg = (rows) => {
        const v = rows.map((r) => r.coc);
        if (gop === 'sum') return v.reduce((a, b) => a + b, 0);
        if (gop === 'size' || gop === 'count') return v.length;
        if (gop === 'mean') return v.reduce((a, b) => a + b, 0) / v.length;
        if (gop === 'max') return Math.max(...v);
        return Math.min(...v);
      };
      const fmt = (x) => (gop === 'mean' ? pyFloat(x) : pyNum(x));
      const unit = gop === 'size' || gop === 'count' ? 'đơn' : gop === 'mean' ? 'cốc TB' : 'cốc';
      const results = groups.map((g) => ({ ...g, val: agg(g.rows) }));
      const outText = `{${results.map((r) => `${pyKey(r.key)}: ${fmt(r.val)}`).join(', ')}}`;

      // Bố trí chồng kiện: mỗi nhóm một cột, các kiện trong nhóm chồng lên nhau
      const xs = results.length === 2 ? [56, 146] : results.length === 3 ? [44, 102, 160] : [44];
      const grouped = [];
      const zones = [];
      results.forEach((g, gi) => {
        g.rows.forEach((r, k) => grouped.push({ ...parcels[r.i], x: xs[gi], y: 88 - k * 29, highlight: true }));
        const topY = 88 - (g.rows.length - 1) * 29;
        zones.push({ id: `zone-${gi}`, kind: 'tag_card', x: xs[gi] - 4, y: topY - 19, w: 56, h: 15, label: `Nhóm ${g.key}`, inspect: `Nhóm ${col} = ${pyKey(g.key)}` });
      });
      const prod = { id: 'city-p1', kind: 'parcel_box', title: `Biên nhận ${outText}`, raw: `print(ket_qua.to_dict()) → ${outText}`, isEmpty: false };
      const detail = results
        .map((g) => {
          const vals = g.rows.map((r) => r.coc);
          if (gop === 'sum') return `${g.key}: ${vals.join(' + ')} = **${fmt(g.val)}**`;
          if (gop === 'mean') return `${g.key}: (${vals.join(' + ')}) / ${vals.length} = **${fmt(g.val)}**`;
          if (gop === 'size' || gop === 'count') return `${g.key}: **${g.val}** đơn`;
          return `${g.key}: ${gop}(${vals.join(', ')}) = **${fmt(g.val)}**`;
        })
        .join(' · ');

      steps.push(
        {
          line: 3,
          trace: [
            { t: `don.groupby("${col}")`, n: `đọc cột ${col} từng dòng, chia dòng theo giá trị`, f: grouped.map((p) => p.id) },
            ...results.map((g, i) => ({ t: `nhóm ${pyKey(g.key)}: [${g.rows.map((r) => `Đơn${r.i + 1}`).join(', ')}]`, n: i === 0 ? 'cùng giá trị → chung 1 chồng' : '', f: [`zone-${i}`, ...g.rows.map((r) => `p-${r.i + 1}`)] })),
          ],
          caption: `\`groupby("${col}")\` tách bảng thành **${results.length} nhóm** theo giá trị cột \`${col}\`: các kiện cùng giá trị xếp chung một chồng.`,
          vars: Object.fromEntries(results.map((g) => [`nhóm ${g.key}`, `[${g.rows.map((r) => `Đơn${r.i + 1}`).join(', ')}]`])),
          mascot: { x: 4, y: 108, pose: 'work', say: 'Chia nhóm!' },
          objects: [...grouped, ...zones, depot],
          products: [],
        },
        {
          line: 4,
          trace: [
            ...results.map((g, i) => ({ t: `${pyKey(g.key)}: ${gop}([${g.rows.map((r) => r.coc).join(', ')}]) = ${fmt(g.val)}`, n: i === 0 ? 'phép gộp chạy RIÊNG trên từng chồng' : '', f: [`zone-${i}`, ...g.rows.map((r) => `p-${r.i + 1}`)] })),
            { t: `ket_qua = ${outText}`, n: 'gom kết quả mỗi nhóm lại → in ra dict', f: 'depot' },
          ],
          caption: `\`["coc"].${gop}()\` chạy riêng trên từng chồng → ${detail}. Shipper giao biên nhận tới Cổng nhận hàng!`,
          vars: Object.fromEntries(results.map((g) => [String(g.key), fmt(g.val)])),
          mascot: { x: 4, y: 108, pose: 'happy', say: 'Giao xong!' },
          objects: [
            ...grouped,
            ...zones.map((z, i) => ({ ...z, label: `${results[i].key}: ${fmt(results[i].val)} ${unit}`, highlight: true })),
            { ...depot, active: true, highlight: true },
          ],
          products: [prod],
          justPrinted: prod,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 4. M4 · VZ04 · Trực quan hóa: Bar chart & Axes (Thế giới: DJ Visualizer)
  // ==========================================================================
  {
    idx: 3,
    module: 'M4 · Trực quan hóa',
    codeId: 'VZ04',
    title: 'Matplotlib: Cột Equalizer Bar Chart trên tấm toan Axes',
    world: 'dj',
    coreConcept: 'Figure là vỏ khung, Axes là vùng vẽ bên trong; lệnh vẽ gọi trên ax, và số nhãn x phải bằng số giá trị y.',
    metaphor: 'Cột equalizer = bar chart, sóng âm = line chart, khung màn hình = Figure (fig).',
    context: {
      story: 'Màn hình visualizer của DJ cần vẽ số cốc bán được của 3 món.',
      goal: 'Lệnh vẽ phải gọi lên khung ngoài hay vùng vẽ bên trong? Nhãn và số liệu ghép cặp thế nào?',
      legend: [['🖼️', 'Khung màn hình', 'fig (Figure)'], ['📈', 'Vùng vẽ có trục', 'ax (Axes)'], ['📊', 'Cột equalizer', 'ax.bar()'], ['〰️', 'Sóng âm', 'ax.plot()'], ['💿', 'Đĩa ép ra', 'print()']],
    },
    codeTags: { fig: 'fig ⊃ ax', presser: 'print()' },
    xp: 130,
    interactionStep: 1,
    defaultOption: 'ax_bar',
    inputs: [{ key: 'coc', label: 'coc = [', suffix: ']', kind: 'list', default: '36, 24, 15', min: 0, max: 99, minCount: 1, maxCount: 5 }],
    interaction: {
      type: 'card',
      typeLabel: 'Chọn lệnh vẽ & gõ số liệu',
      prompt: 'Chọn lệnh vẽ (ax.bar / ax.plot / fig.bar) và gõ 3 số cho `coc` — thử gõ 2 hoặc 4 số xem sao!',
      options: [
        { id: 'ax_bar', label: 'ax.bar(mon, coc)', desc: 'Vẽ cột lên vùng Axes' },
        { id: 'ax_plot', label: 'ax.plot(mon, coc)', desc: 'Vẽ đường nối các đỉnh' },
        { id: 'err_fig', label: 'fig.bar(mon, coc)', isError: true, desc: 'Gọi .bar() lên khung ngoài fig' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const vals = inp.coc ?? [36, 24, 15];
      const isFig = optId === 'err_fig';
      const fn = optId === 'ax_plot' ? 'plot' : 'bar';
      const cmd = isFig ? 'fig.bar(mon, coc)' : `ax.${fn}(mon, coc)`;
      const names = ['CF', 'Trà', 'Bánh'];
      const codeLines = [
        'import matplotlib.pyplot as plt',
        'fig, ax = plt.subplots()',
        `mon, coc = ["CF", "Trà", "Bánh"], [${slot('coc', vals.map(pyNum).join(', '))}]`,
        cmd,
        'print(f"Axes: {len(fig.axes)}, Vật vẽ: {len(ax.patches or ax.lines)}")',
      ];

      const frame = { id: 'fig', kind: 'viz_frame', x: 48, y: 62, w: 152, h: 76, names, vals, label: 'Figure (fig)', inspect: 'Figure: khung ngoài cùng; vùng vẽ bên trong là ax (Axes)' };
      const presser = { id: 'presser', kind: 'disc_presser', x: 250, y: 90, w: 40, h: 50, label: 'Máy ép đĩa' };

      const steps = [
        {
          line: [1, 2, 3],
          trace: [
            { t: 'fig, ax = plt.subplots()', n: 'tạo khung Figure và 1 vùng vẽ Axes bên trong', f: 'fig' },
            { t: `mon = 3 nhãn · coc = ${vals.length} số`, n: 'mới có dữ liệu, chưa vẽ gì', f: 'fig' },
          ],
          caption: `\`plt.subplots()\` dựng khung \`fig\` và vùng vẽ \`ax\` (còn trống), nạp 3 nhãn \`mon\` và ${vals.length} số \`coc = [${vals.map(pyNum).join(', ')}]\`.`,
          vars: { fig: 'Figure', ax: 'Axes (trống)', mon: '3 nhãn', coc: `[${vals.map(pyNum).join(', ')}]` },
          mascot: { x: 4, y: 108, pose: 'idle', say: 'ax còn trống!' },
          objects: [frame, presser],
          products: [],
        },
        {
          line: 4,
          isInteraction: true,
          trace: [{ t: cmd, n: 'chờ bạn chọn lệnh vẽ', f: 'fig' }],
          caption: 'Chọn lệnh vẽ ở thanh thẻ lệnh, hoặc gõ số liệu mới cho `coc` rồi Enter.',
          vars: { fig: 'Figure', ax: 'Axes', lenh: cmd },
          mascot: { x: 4, y: 108, pose: 'work', say: cmd },
          objects: [{ ...frame, highlight: true }, presser],
          products: [],
        },
      ];

      const fail = (error, caption, alert, vars, frameExtra = {}) => {
        steps.push({
          line: 4,
          trace: [
            { t: cmd, n: 'Python chạy lệnh vẽ…', f: 'fig' },
            { t: alert, n: error.incident, f: 'fig' },
          ],
          caption,
          vars,
          mascot: { x: 206, y: 110, pose: 'error', say: 'Không vẽ được!' },
          error: { line: 4, ...error },
          objects: [{ ...frame, jammed: true, jamText: alert, ...frameExtra }, { id: 'err-a', kind: 'jam_alert', x: 70, y: 42, w: 110, h: 16, label: alert, error: true }, presser],
          products: [],
        });
        return { codeLines, steps };
      };

      if (isFig) {
        return fail(
          {
            name: "AttributeError: 'Figure' object has no attribute 'bar'",
            incident: 'Ra lệnh .bar() cho khung Figure: khung đứng im, lắc đầu vì không có method đó.',
            hint: 'Gọi lệnh vẽ trên vùng vẽ: ax.bar(mon, coc).',
          },
          'Sự cố! `fig.bar(...)` ra lệnh cho khung vỏ ngoài `Figure` — nó không biết vẽ: khung đứng im và lắc đầu!',
          'AttributeError: fig.bar',
          { fig: 'Figure (không có .bar)', loi: '❌ AttributeError' },
        );
      }
      if (vals.length !== names.length) {
        return fail(
          fn === 'bar'
            ? {
                name: `ValueError: shape mismatch: objects cannot be broadcast to a single shape. Mismatch is between arg 0 with shape (3,) and arg 1 with shape (${vals.length},).`,
                incident: `3 nhãn cột nhưng ${vals.length} giá trị chiều cao: máy không biết ghép cặp nào với nhau.`,
                hint: `Gõ đúng 3 số cho coc (mỗi nhãn CF, Trà, Bánh một số).`,
              }
            : {
                name: `ValueError: x and y must have same first dimension, but have shapes (3,) and (${vals.length},)`,
                incident: `3 điểm x nhưng ${vals.length} giá trị y: đường sóng không nối được.`,
                hint: 'Số phần tử của mon và coc phải bằng nhau.',
              },
          `Sự cố! \`mon\` có **3** nhãn nhưng \`coc\` có **${vals.length}** số — không ghép đủ cặp (nhãn, giá trị) nên không vẽ được.`,
          `ValueError: 3 ≠ ${vals.length}`,
          { 'len(mon)': '3', 'len(coc)': `${vals.length} ❌` },
          { jamText: `3 nhãn ≠ ${vals.length} số` },
        );
      }

      const count = fn === 'plot' ? 1 : 3;
      const prod = {
        id: 'viz-p1', kind: 'vinyl_disc',
        title: fn === 'plot' ? 'Đĩa Sóng âm (1 đường)' : 'Đĩa Equalizer (3 cột)',
        raw: `print(...) → Axes: 1, Vật vẽ: ${count}`,
        isEmpty: false,
      };
      const maxI = vals.indexOf(Math.max(...vals));
      steps.push({
        line: 5,
        trace: [
          { t: cmd, n: 'gọi lệnh vẽ trên vùng vẽ ax', f: 'fig' },
          { t: names.map((nm, i) => `(${nm}, ${pyNum(vals[i])})`).join(' '), n: fn === 'bar' ? 'ghép từng cặp → mỗi cặp 1 cột' : 'ghép từng cặp → mỗi cặp 1 điểm', f: 'fig' },
          { t: fn === 'bar' ? 'ax.patches = 3 cột' : 'ax.lines = 1 đường', n: 'vật vẽ nằm TRONG ax, không phải fig', f: 'fig' },
          { t: `print → Axes: 1, Vật vẽ: ${count}`, n: '', f: 'presser' },
        ],
        caption: `Vùng \`ax\` vẽ ${fn === 'plot' ? '1 đường nối 3 đỉnh' : '3 cột'} đúng tỉ lệ số liệu — cao nhất là \`${names[maxI]}\` (${pyNum(vals[maxI])}). Máy ép xuất **${prod.title}**!`,
        vars: { 'len(fig.axes)': '1', 'vật vẽ': String(count) },
        mascot: { x: 206, y: 108, pose: 'happy', say: 'Visualizer lên đèn!' },
        objects: [{ ...frame, vizMode: fn === 'plot' ? 'line' : 'bar', highlight: true }, { ...presser, active: true, highlight: true }],
        products: [prod],
        justPrinted: prod,
      });
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 5. M5 · SY05 · OOP: Class, Object & State (Thế giới: RPG Dungeon)
  // ==========================================================================
  {
    idx: 4,
    module: 'M5 · OOP & lưu trữ',
    codeId: 'SY05',
    title: 'OOP: Bản thiết kế Class và quái Slime độc lập',
    world: 'dungeon',
    coreConcept: 'Hai instance cùng tạo từ một Class có trạng thái riêng; gọi method không có trong Class gây AttributeError.',
    metaphor: 'Class = cổng triệu hồi theo bản thiết kế, Object = quái Slime có trạng thái riêng.',
    context: {
      story: 'Hầm ngục có cổng triệu hồi quái theo một bản thiết kế. Hai con Slime được tạo ra; người chơi tiến lại gần một con.',
      goal: 'Gọi method trên s1 có làm s2 thay đổi không? Gọi method không có trong bản thiết kế thì sao?',
      legend: [['🌀', 'Cổng + bản thiết kế', 'class Slime'], ['🟠', 'Slime Lửa', 'object s1'], ['🟣', 'Slime Băng', 'object s2'], ['📏', 'Khoảng cách', 'tham số kc'], ['🏷️', 'Bảng tên trên đầu', 'thuộc tính self.tt']],
    },
    codeTags: { portal: 'class Slime', s1: 's1', s2: 's2', ruler: 'kc', chest: 'print()' },
    xp: 150,
    interactionStep: 1,
    defaultOption: 's1_chase',
    inputs: [
      { key: 'ham', label: 's1.', kind: 'expr', default: 'cap_nhat', maxLen: 14 },
      { key: 'kc', label: '(', suffix: ')', kind: 'num', default: '3', min: -99, max: 99 },
    ],
    interaction: {
      type: 'drag',
      typeLabel: 'Gõ method & khoảng cách',
      prompt: 'Gõ tên method và khoảng cách `kc` từ người chơi tới `s1` rồi Enter. Vùng đuổi của Slime là `kc < 5`.',
      options: [
        { id: 's1_chase', label: 's1.cap_nhat(3)', preset: { ham: 'cap_nhat', kc: '3' }, desc: '3 < 5 → đuổi theo' },
        { id: 's1_idle', label: 's1.cap_nhat(8)', preset: { ham: 'cap_nhat', kc: '8' }, desc: '8 ≥ 5 → vẫn tuần tra' },
        { id: 'err_attr', label: 's1.bay_len(3)', preset: { ham: 'bay_len', kc: '3' }, isError: true, desc: 'Method không có trong class' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const ham = inp.ham ?? 'cap_nhat';
      const kc = inp.kc ?? 3;
      const callStr = `s1.${slot('ham', ham)}(${slot('kc', pyNum(kc))})`;
      const codeLines = [
        'class Slime:',
        '    def __init__(self, ten): self.ten, self.tt = ten, "tuan_tra"',
        '    def cap_nhat(self, kc):',
        '        if kc < 5: self.tt = "duoi_theo"',
        's1, s2 = Slime("Lửa"), Slime("Băng")',
        callStr,
        'print(f"s1:{s1.tt} | s2:{s2.tt}")',
      ];

      const UNIT = 6; // 1 đơn vị khoảng cách = 6px trong cảnh
      const portal = { id: 'portal', kind: 'dungeon_portal', x: 14, y: 84, w: 40, h: 52, label: 'class Slime', inspect: 'Bản thiết kế class Slime: khuôn triệu hồi các thực thể' };
      const slime2 = { id: 's2', kind: 'slime', variant: 'ice', x: 62, y: 102, w: 42, h: 34, label: 's2: tuan_tra', inspect: 'Instance s2 ("Băng"): trạng thái riêng, không bị lệnh của s1 ảnh hưởng' };
      const slime1 = { id: 's1', kind: 'slime', variant: 'fire', x: 116, y: 102, w: 42, h: 34, label: 's1: tuan_tra', inspect: 'Instance s1 ("Lửa"): có self.tt riêng' };
      const chest = { id: 'chest', kind: 'loot_chest', x: 262, y: 96, w: 40, h: 44, label: 'Rương đồ', inspect: 'Rương rơi ra Cuộn thông báo mỗi khi print() chạy' };
      const s1Edge = slime1.x + slime1.w;
      const kcVis = Math.max(0, Math.min(11, kc));
      const heroX = s1Edge + 2 + Math.round(kcVis * UNIT);
      const ruler = { id: 'ruler', kind: 'distance_ruler', x: s1Edge, y: 143, w: heroX + 16 - s1Edge, h: 8, threshold: 5 * UNIT, label: `kc = ${pyNum(kc)}`, inside: kc < 5 };

      const steps = [
        {
          line: [1, 2, 5],
          trace: [
            { t: 'class Slime: …', n: 'mới là bản thiết kế — chưa có con quái nào', f: 'portal' },
            { t: 's1, s2 = Slime("Lửa"), Slime("Băng")', n: 'gọi class 2 lần → 2 object riêng', f: ['s1', 's2'] },
            { t: 's1.tt = "tuan_tra" · s2.tt = "tuan_tra"', n: '__init__ gán thuộc tính cho TỪNG object', f: ['s1', 's2'] },
          ],
          caption: 'Cổng `class Slime` triệu hồi 2 thực thể độc lập `s1 ("Lửa")` và `s2 ("Băng")`, cả hai đang `"tuan_tra"`. Vạch đứt quanh `s1` là vùng đuổi `kc < 5`.',
          vars: { 's1.tt': '"tuan_tra"', 's2.tt': '"tuan_tra"' },
          mascot: { x: heroX, y: 108, pose: 'idle', say: 'Người chơi' },
          objects: [portal, slime2, slime1, chest],
          products: [],
        },
        {
          line: 6,
          isInteraction: true,
          trace: [{ t: `s1.${ham}(${pyNum(kc)})`, n: 'gọi method trên object s1', f: 's1' }],
          caption: `Gõ method và khoảng cách \`kc\`: người chơi đang cách \`s1\` **${pyNum(kc)}** bước (vùng đuổi là dưới 5 bước).`,
          vars: { 's1.tt': '"tuan_tra"', 's2.tt': '"tuan_tra"', kc: pyNum(kc) },
          mascot: { x: heroX, y: 108, pose: 'work', say: `kc = ${pyNum(kc)}` },
          objects: [portal, slime2, { ...slime1, highlight: true }, ruler, chest],
          products: [],
        },
      ];

      if (!IDENT_RE.test(ham) || PY_KEYWORDS.has(ham)) {
        steps.push({
          line: 6,
          trace: [
            { t: `s1.${ham}(${pyNum(kc)})`, n: 'Python đọc câu lệnh', f: 's1' },
            { t: 'SyntaxError', n: 'tên method không hợp lệ', f: 's1' },
          ],
          caption: `Sự cố! \`s1.${ham}(...)\` không phải câu lệnh hợp lệ — tên method phải là chữ/số/gạch dưới, không bắt đầu bằng số.`,
          vars: { loi: '❌ SyntaxError' },
          mascot: { x: heroX, y: 110, pose: 'error', say: 'Lệnh lạ quá!' },
          error: { name: 'SyntaxError: invalid syntax', line: 6, incident: 'Câu lệnh viết sai cú pháp: hầm ngục không hiểu.', hint: 'Gõ tên method hợp lệ, ví dụ cap_nhat.' },
          objects: [portal, slime2, { ...slime1, jammed: true }, chest],
          products: [],
        });
        return { codeLines, steps };
      }
      if (ham !== 'cap_nhat') {
        steps.push({
          line: 6,
          trace: [
            { t: `s1.${ham}(${pyNum(kc)})`, n: 'Python tìm thuộc tính này trên s1', f: 's1' },
            { t: `class Slime có "${ham}"?`, n: 'chỉ có __init__ và cap_nhat', f: ['s1', 'portal'] },
            { t: `AttributeError: ${pyStr(ham)}`, n: 'không tìm thấy → dừng', f: 's1' },
          ],
          caption: `Sự cố! Ra lệnh \`s1.${ham}()\` nhưng bản thiết kế \`class Slime\` chỉ có \`cap_nhat()\`: con Slime đứng im, lắc đầu ngơ ngác!`,
          vars: { 's1.tt': '"tuan_tra"', loi: '❌ AttributeError' },
          mascot: { x: heroX, y: 110, pose: 'error', say: `${ham}?` },
          error: {
            name: `AttributeError: 'Slime' object has no attribute ${pyStr(ham)}`,
            line: 6,
            incident: 'Ra lệnh một việc không có trong bản thiết kế Class: quái đứng im, lắc đầu.',
            hint: noAccent(ham).replace(/[_\s]/g, '') === 'capnhat' ? 'Tên method phải gõ đúng y hệt: cap_nhat.' : 'class Slime chỉ có __init__ và cap_nhat.',
          },
          objects: [portal, slime2, { ...slime1, jammed: true, label: 's1: ???' }, { id: 'err-sl', kind: 'jam_alert', x: 70, y: 52, w: 120, h: 16, label: `AttributeError: ${ham}`, error: true }, chest],
          products: [],
        });
        return { codeLines, steps };
      }

      const chase = kc < 5;
      const s1State = chase ? 'duoi_theo' : 'tuan_tra';
      const prod = { id: 'dg-p1', kind: 'loot_scroll', title: `Cuộn: s1=${s1State}, s2=tuan_tra`, raw: `print(...) → s1:${s1State} | s2:tuan_tra`, isEmpty: false };
      steps.push(
        {
          line: [3, 4],
          trace: [
            { t: `s1.cap_nhat(${pyNum(kc)})`, n: 'tìm thấy cap_nhat trong class Slime', f: ['s1', 'portal'] },
            { t: `cap_nhat(self=s1, kc=${pyNum(kc)})`, n: 'self chính là s1 (không phải s2)', f: 's1' },
            { t: `if ${pyNum(kc)} < 5 → ${chase ? 'True' : 'False'}`, n: 'so khoảng cách với vùng đuổi', f: ['s1', 'ruler'] },
            { t: chase ? 's1.tt = "duoi_theo"' : '(bỏ qua dòng gán)', n: chase ? 'chỉ đổi thuộc tính của s1' : 's1 giữ nguyên trạng thái', f: 's1' },
          ],
          caption: chase
            ? `\`cap_nhat(${pyNum(kc)})\`: \`${pyNum(kc)} < 5\` đúng → \`s1.tt = "duoi_theo"\`. Slime lửa đỏ mặt, lao về phía người chơi!`
            : `\`cap_nhat(${pyNum(kc)})\`: \`${pyNum(kc)} < 5\` sai → bỏ qua dòng gán, \`s1\` vẫn \`"tuan_tra"\`.`,
          vars: { kc: pyNum(kc), 'kc < 5': chase ? 'True' : 'False', 's1.tt': `"${s1State}"`, 's2.tt': '"tuan_tra"' },
          mascot: { x: heroX, y: 108, pose: chase ? 'work' : 'idle', say: chase ? 'Bị phát hiện!' : 'Chưa thấy mình' },
          objects: [portal, slime2, { ...slime1, x: chase ? slime1.x + Math.min(14, kcVis * UNIT) : slime1.x, label: `s1: ${s1State}`, angry: chase, highlight: true }, { ...ruler, x: chase ? s1Edge + Math.min(14, kcVis * UNIT) : s1Edge, w: Math.max(4, ruler.w - (chase ? Math.min(14, kcVis * UNIT) : 0)) }, chest],
          products: [],
        },
        {
          line: 7,
          trace: [
            { t: 'print(f"s1:{s1.tt} | s2:{s2.tt}")', n: 'đọc thuộc tính của từng object', f: ['s1', 's2'] },
            { t: `→ s1:${s1State} | s2:tuan_tra`, n: 's2 không đổi: mỗi object giữ state riêng', f: 'chest' },
          ],
          caption: `Chỉ \`s1\` đổi thành \`"${s1State}"\`; \`s2\` không hề bị đụng tới vì mỗi object giữ \`self.tt\` của riêng nó. Rương rơi ra **${prod.title}**!`,
          vars: { 's1.tt': `"${s1State}"`, 's2.tt': '"tuan_tra"' },
          mascot: { x: heroX, y: 108, pose: 'happy', say: 'State riêng biệt!' },
          objects: [portal, { ...slime2, highlight: true }, { ...slime1, x: chase ? slime1.x + Math.min(14, kcVis * UNIT) : slime1.x, label: `s1: ${s1State}`, angry: chase, highlight: true }, { ...chest, active: true, highlight: true }],
          products: [prod],
          justPrinted: prod,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 6. M6 · CT12 · Đa luồng: Race condition & Lock (Thế giới: Quán: bếp sau)
  // ==========================================================================
  {
    idx: 5,
    module: 'M6 · Tiến trình & đa luồng',
    codeId: 'CT12',
    title: 'Đa luồng: Hai đầu bếp dùng chung bếp và móc khóa Lock',
    world: 'kitchen',
    coreConcept: 'Nhiều thread dùng chung biến phải khóa vùng đọc–cộng–ghi bằng cùng một Lock; lấy nhiều khóa phải cùng thứ tự.',
    metaphor: 'Thread = đầu bếp dùng chung bếp, biến đếm = bảng số món, Lock = chìa khóa treo trên móc.',
    context: {
      story: 'Hai đầu bếp cùng nấu và cùng cộng vào một bảng đếm món treo trên bếp.',
      goal: 'Vì sao không có khóa thì bảng đếm bị thiếu? Có 2 khóa thì phải lấy theo thứ tự nào?',
      legend: [['👨‍🍳', 'Đầu bếp A / B', 'Thread A / B'], ['📋', 'Bảng đếm món', 'so_mon (biến dùng chung)'], ['🔑', 'Chìa trên móc', 'Lock'], ['🔥', 'Món bị cháy', 'Race condition'], ['🧍', 'Đứng chờ nhau', 'Deadlock']],
    },
    codeTags: { 'lock-hook': 'Lock', 'lock-lo': 'Lock lo', stove: 'so_mon', hatch: 'print()' },
    xp: 150,
    interactionStep: 1,
    defaultOption: 'with_lock',
    inputs: [{ key: 'luot', label: 'so_luot =', kind: 'int', default: '1', min: 1, max: 3 }],
    interaction: {
      type: 'card',
      typeLabel: 'Chọn cơ chế khóa & số lượt',
      prompt: 'Chọn quy tắc vào bếp và gõ `so_luot` (1–3) mỗi đầu bếp phải nấu rồi Enter.',
      options: [
        { id: 'with_lock', label: 'with khoa_chao: (Có Lock)', desc: 'Ai cầm chìa mới được dùng chảo' },
        { id: 'no_lock', label: 'Không dùng Lock', isError: true, desc: 'Hai đầu bếp cùng giành 1 chảo' },
        { id: 'deadlock', label: 'Khóa chéo (ngược thứ tự)', isError: true, ignoresInput: true, desc: 'Mỗi người giữ 1 khóa rồi chờ nhau' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const isRace = optId === 'no_lock';
      const isDead = optId === 'deadlock';
      const n = isDead ? 1 : inp.luot ?? 1;
      const expected = 2 * n;

      const codeLines = isDead
        ? [
            'from threading import Thread, Lock',
            'chao, lo = Lock(), Lock(); so_mon = 0',
            'def nau(k1, k2):',
            '    global so_mon',
            '    with k1, k2: so_mon += 1',
            'chay_song_song((nau, chao, lo), (nau, lo, chao))',
            'print(f"Tổng ra món: {so_mon}")',
          ]
        : [
            'from threading import Thread, Lock',
            `khoa_chao = Lock(); so_mon = 0; so_luot = ${slot('luot', String(n))}`,
            'def nau():',
            '    global so_mon',
            // with lồng trong for phải xuống dòng riêng mới hợp lệ trong Python
            ...(isRace
              ? ['    for _ in range(so_luot): so_mon = so_mon + 1  # không khóa!']
              : ['    for _ in range(so_luot):', '        with khoa_chao: so_mon += 1']),
            'chay_song_song(Thread(target=nau), Thread(target=nau))',
            'print(f"Tổng ra món: {so_mon}")',
          ];
      const L = isDead || isRace ? { body: 5, run: 6, print: 7 } : { body: 6, run: 7, print: 8 };

      const CHEF_Y = 108;
      const chefA = { id: 'chef-a', kind: 'chef', variant: 'A', x: 46, y: CHEF_Y, w: 20, h: 32, label: 'Thread A', inspect: 'Đầu bếp A = Thread A, chạy hàm nau()' };
      const chefB = { id: 'chef-b', kind: 'chef', variant: 'B', x: 182, y: CHEF_Y, w: 20, h: 32, label: 'Thread B', inspect: 'Đầu bếp B = Thread B, chạy cùng hàm nau()' };
      const AT_STOVE = 100;
      const hook = { id: 'lock-hook', kind: 'lock_hook', x: 108, y: 64, w: 58, h: 20, label: '🔑 Lock chảo', inspect: 'Móc treo chìa khóa: chỉ 1 thread cầm được tại 1 thời điểm' };
      const hookChao = { id: 'lock-hook', kind: 'lock_hook', x: 70, y: 64, w: 58, h: 20, label: '🔑 khóa chảo', inspect: 'Lock thứ nhất: chao' };
      const hookLo = { id: 'lock-lo', kind: 'lock_hook', x: 146, y: 64, w: 58, h: 20, label: '🔑 khóa lò', inspect: 'Lock thứ hai: lo' };
      const stove = { id: 'stove', kind: 'stove_pan', x: 102, y: 94, w: 70, h: 32, label: 'Bảng: 0 món', inspect: 'Biến dùng chung so_mon' };
      const hatch = { id: 'hatch', kind: 'kitchen_hatch', x: 236, y: 90, w: 40, h: 50, label: 'Bếp ra món' };
      const locks = isDead ? [hookChao, hookLo] : [hook];

      const steps = [
        {
          line: [1, 2],
          trace: isDead
            ? [{ t: 'chao, lo = Lock(), Lock()', n: '2 chìa khóa riêng biệt', f: ['lock-hook', 'lock-lo'] }]
            : [
                { t: `so_mon = 0; so_luot = ${n}`, n: '1 biến dùng chung cho cả 2 luồng', f: 'stove' },
                { t: 'khoa_chao = Lock()', n: '1 chìa khóa duy nhất', f: 'lock-hook' },
              ],
          caption: isDead
            ? 'Bếp có 1 chảo, 1 lò và **hai** chìa khóa `chao`, `lo`. Hai đầu bếp `Thread A`, `Thread B` cùng chạy `nau()` nhưng truyền khóa theo thứ tự ngược nhau.'
            : `Bếp có 1 bảng đếm dùng chung \`so_mon = 0\` và móc chìa \`khoa_chao\`. Mỗi đầu bếp sẽ nấu \`so_luot = ${n}\` món → kỳ vọng tổng **${expected}**.`,
          vars: isDead ? { so_mon: '0', chao: 'trống', lo: 'trống' } : { so_mon: '0', so_luot: String(n), 'kỳ vọng': String(expected) },
          mascot: null,
          objects: [...locks, stove, chefA, chefB, hatch],
          products: [],
        },
        {
          line: [3, 4, L.body],
          isInteraction: true,
          trace: [{ t: 'Thread(target=nau) × 2', n: '2 luồng chạy CÙNG một hàm, CÙNG lúc', f: ['chef-a', 'chef-b'] }],
          caption: 'Chọn quy tắc vào bếp ở thanh thẻ lệnh (và gõ số lượt) để xem hai đầu bếp phối hợp hay giành chảo của nhau.',
          vars: { so_mon: '0', che_do: optId },
          mascot: null,
          objects: [...locks.map((l) => ({ ...l, highlight: true })), { ...stove, highlight: true }, chefA, chefB, hatch],
          products: [],
        },
      ];

      if (isRace) {
        // Mỗi lượt cả hai cùng đọc một giá trị rồi ghi đè nhau → mỗi lượt chỉ tăng 1
        const got = n;
        steps.push(
          {
            line: L.body,
            trace: [
              { t: 'so_mon = so_mon + 1', n: 'thật ra là 3 bước: đọc → cộng → ghi', f: 'stove' },
              { t: `A đọc so_mon → ${got - 1}`, n: '', f: 'chef-a' },
              { t: `B đọc so_mon → ${got - 1}`, n: 'B đọc khi A CHƯA kịp ghi', f: 'chef-b' },
            ],
            caption: `Không có khóa: ở mỗi lượt **cả hai** đầu bếp cùng **đọc** bảng một lúc (cùng thấy \`${got - 1}\` ở lượt cuối) rồi mỗi người tự cộng 1.`,
            vars: { doc_A: String(got - 1), doc_B: String(got - 1), so_mon: String(got - 1) },
            mascot: null,
            objects: [hook, { ...stove, label: `Bảng: ${got - 1} món`, highlight: true }, { ...chefA, x: 96, pose: 'work', say: `đọc ${got - 1}` }, { ...chefB, x: 156, pose: 'work', say: `đọc ${got - 1}` }, hatch],
            products: [],
          },
          {
            line: L.body,
            trace: [
              { t: `A ghi ${got - 1} + 1 = ${got}`, n: '', f: 'chef-a' },
              { t: `B ghi ${got - 1} + 1 = ${got}`, n: 'đè lên kết quả của A!', f: 'chef-b' },
              { t: `so_mon = ${got} ≠ ${expected}`, n: 'mất lượt cập nhật', f: 'stove' },
            ],
            caption: `Sự cố Race Condition! Cả hai cùng **ghi** \`${got}\` đè lên nhau. Sau ${n} lượt bảng chỉ có \`${got}\` thay vì \`${expected}\` — mất ${expected - got} món!`,
            vars: { so_mon: `❌ ${got}`, 'kỳ vọng': String(expected) },
            mascot: null,
            error: {
              name: `RaceConditionError: Lost Update (so_mon = ${got}, kỳ vọng ${expected})`,
              line: L.body,
              incident: 'Hai đầu bếp đọc cùng một giá trị rồi ghi đè lên nhau làm mất món.',
              hint: 'Bọc thao tác đọc–cộng–ghi trong with khoa_chao: để hai đầu bếp lần lượt.',
            },
            objects: [hook, { ...stove, jammed: true, label: `Cháy! ${got}≠${expected}` }, { ...chefA, x: 96, jammed: true, say: `ghi ${got}` }, { ...chefB, x: 156, jammed: true, say: `ghi ${got}` }, { id: 'err-rc', kind: 'jam_alert', x: 84, y: 42, w: 106, h: 16, label: `Race: ${got} ≠ ${expected}`, error: true }, hatch],
            products: [],
          },
        );
        return { codeLines, steps };
      }
      if (isDead) {
        steps.push(
          {
            line: [L.body, L.run],
            trace: [
              { t: 'A: with chao, lo → giữ chao', n: 'lấy khóa thứ nhất', f: ['chef-a', 'lock-hook'] },
              { t: 'B: with lo, chao → giữ lo', n: 'thứ tự NGƯỢC với A', f: ['chef-b', 'lock-lo'] },
            ],
            caption: 'A gọi `nau(chao, lo)` nên lấy chìa `chao` trước; B gọi `nau(lo, chao)` nên lấy `lo` trước. Mỗi người đang giữ đúng thứ người kia cần…',
            vars: { Thread_A: 'giữ chao, chờ lo', Thread_B: 'giữ lo, chờ chao' },
            mascot: null,
            objects: [{ ...hookChao, label: '🔑 chảo: A giữ' }, { ...hookLo, label: '🔑 lò: B giữ' }, stove, { ...chefA, x: 84, holding: 'pan', say: 'chờ lò…' }, { ...chefB, x: 164, holding: 'stove', say: 'chờ chảo…' }, hatch],
            products: [],
          },
          {
            line: L.body,
            trace: [
              { t: 'A chờ lo (B đang giữ)', n: '', f: ['chef-a', 'lock-lo'] },
              { t: 'B chờ chao (A đang giữ)', n: '', f: ['chef-b', 'lock-hook'] },
              { t: 'chờ nhau mãi → Deadlock', n: 'không ai nhả khóa trước', f: ['chef-a', 'chef-b'] },
            ],
            caption: 'Sự cố Deadlock! A giữ chảo chờ lò, B giữ lò chờ chảo — cả hai đứng bất động chờ nhau mãi, bếp ngừng ra món!',
            vars: { Thread_A: 'Giữ chảo, chờ lò', Thread_B: 'Giữ lò, chờ chảo', trang_thai: '❌ Deadlock' },
            mascot: null,
            error: {
              name: 'DeadlockError: Hai luồng khóa chéo chờ nhau vô tận',
              line: L.body,
              incident: 'Cả hai đầu bếp chờ chiếc khóa người kia đang cầm, bếp ngừng hoạt động.',
              hint: 'Luôn lấy các Lock theo cùng một thứ tự (ví dụ luôn chao rồi mới lo).',
            },
            objects: [{ ...hookChao, label: '🔑 chảo: A giữ', jammed: true }, { ...hookLo, label: '🔑 lò: B giữ', jammed: true }, { ...stove, label: 'Treo cứng!' }, { ...chefA, x: 84, holding: 'pan', jammed: true, say: 'chờ lò…' }, { ...chefB, x: 164, holding: 'stove', jammed: true, say: 'chờ chảo…' }, { id: 'err-dl', kind: 'jam_alert', x: 88, y: 42, w: 98, h: 16, label: 'Deadlock: Chờ chéo', error: true }, hatch],
            products: [],
          },
        );
        return { codeLines, steps };
      }

      const prod = { id: 'kt-p1', kind: 'dish_tray', title: `Khay ${expected} món hoàn chỉnh`, raw: `print(...) → Tổng ra món: ${expected}`, isEmpty: false };
      steps.push(
        {
          line: L.body,
          trace: [
            { t: 'A: with khoa_chao: → lấy chìa', n: 'móc đang có chìa', f: ['chef-a', 'lock-hook'] },
            { t: 'B: with khoa_chao: → chờ', n: 'chìa đang ở chỗ A', f: 'chef-b' },
            { t: `A: so_mon 0 → ${n}`, n: `đọc–cộng–ghi ${n} lần, không ai chen ngang`, f: 'stove' },
          ],
          caption: `A cầm chìa \`khoa_chao\` vào bếp, nấu đủ ${n} lượt: \`0 → ${n}\`. B tới sau thấy móc trống chìa nên **đứng chờ**.`,
          vars: { so_mon: String(n), 'khoa_chao.locked': 'True (A giữ)' },
          mascot: null,
          objects: [{ ...hook, label: '🔑 A đang giữ', highlight: true }, { ...stove, label: `Bảng: ${n} món`, highlight: true }, { ...chefA, x: AT_STOVE, pose: 'work', holding: 'key', say: `0 → ${n}` }, { ...chefB, say: 'chờ khóa…' }, hatch],
          products: [],
        },
        {
          line: L.body,
          trace: [
            { t: 'A ra khỏi with → trả chìa', n: '', f: ['chef-a', 'lock-hook'] },
            { t: 'B lấy chìa', n: '', f: ['chef-b', 'lock-hook'] },
            { t: `B: so_mon ${n} → ${expected}`, n: 'đọc đúng giá trị MỚI nhất', f: 'stove' },
          ],
          caption: `A **trả chìa** rồi lui ra. B cầm chìa vào bếp, đọc \`${n}\` và nấu tiếp \`${n} → ${expected}\`. Không ai ghi đè ai.`,
          vars: { so_mon: String(expected), 'khoa_chao.locked': 'True (B giữ)' },
          mascot: null,
          objects: [{ ...hook, label: '🔑 B đang giữ', highlight: true }, { ...stove, label: `Bảng: ${expected} món`, highlight: true }, { ...chefA, say: 'xong!' }, { ...chefB, x: AT_STOVE, pose: 'work', holding: 'key', say: `${n} → ${expected}` }, hatch],
          products: [],
        },
        {
          line: [L.run, L.print],
          trace: [
            { t: 'chay_song_song(...) xong', n: 'đợi cả 2 luồng kết thúc', f: ['chef-a', 'chef-b'] },
            { t: `print(...) → Tổng ra món: ${expected}`, n: 'đúng kỳ vọng', f: 'hatch' },
          ],
          caption: `Nhờ \`with khoa_chao:\` các lượt nấu xếp hàng tuần tự nên đủ \`${expected}\` món đúng kỳ vọng. Bếp ra món xuất **${prod.title}**!`,
          vars: { so_mon: String(expected), 'khoa_chao.locked': 'False' },
          mascot: null,
          objects: [{ ...hook, highlight: true }, { ...stove, label: `Bảng: ${expected} ✓`, highlight: true }, { ...chefA, say: 'đủ món!' }, { ...chefB, x: 190 }, { ...hatch, active: true, highlight: true }],
          products: [prod],
          justPrinted: prod,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 7. M7 · CT14 · Multiprocessing & Queue (Thế giới: Quán: nhiều gian bếp)
  // ==========================================================================
  {
    idx: 6,
    module: 'M7 · Multiprocessing & shell',
    codeId: 'CT14',
    title: 'Multiprocessing: Mỗi gian một tủ lạnh riêng và cửa sổ Queue',
    world: 'kitchen',
    coreConcept: 'Tiến trình con có bộ nhớ riêng (chỉ sửa bản sao); muốn gửi kết quả về cha phải chuyền qua Queue.',
    metaphor: 'Mỗi Process = một gian bếp có tủ lạnh riêng, Queue = cửa sổ chuyền món giữa hai gian.',
    context: {
      story: 'Quán mở thêm một gian bếp phụ. Mỗi gian có tủ lạnh riêng; giữa hai gian có một cửa sổ chuyền món.',
      goal: 'Gian phụ sửa tủ của nó thì tủ chính có đổi không? Kết quả về gian chính bằng đường nào?',
      legend: [['🏠', 'Một gian bếp', 'Process'], ['🧊', 'Tủ lạnh của gian', 'bộ nhớ riêng (tu_lanh)'], ['🪟', 'Cửa chuyền món', 'Queue'], ['🃏', 'Thẻ kết quả', 'q.put() / q.get()']],
    },
    codeTags: { 'fr-1': 'tu_lanh (chính)', 'fr-2': 'tu_lanh (bản sao)', 'win-q': 'q', 'q-card': '16 // so_gian', hatch: 'print()' },
    xp: 150,
    interactionStep: 1,
    defaultOption: 'chia_2',
    inputs: [{ key: 'so_gian', label: 'so_gian =', kind: 'int', default: '2', min: -16, max: 32 }],
    interaction: {
      type: 'number',
      typeLabel: 'Gõ số gian bếp',
      prompt: 'Gõ `so_gian` để chia 16 mẻ bánh (thử 3, 0, hay số âm) rồi Enter.',
      options: [
        { id: 'chia_2', label: 'so_gian = 2', preset: { so_gian: '2' }, desc: '16 // 2 = 8 mẻ' },
        { id: 'chia_3', label: 'so_gian = 3 (dư)', preset: { so_gian: '3' }, desc: '16 // 3 = 5, dư 1' },
        { id: 'err_zero', label: 'so_gian = 0', preset: { so_gian: '0' }, isError: true, desc: 'Chia cho 0' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const nGian = inp.so_gian ?? 2;
      const isErr = nGian === 0;
      const per = isErr ? 0 : pyFloorDiv(16, nGian);
      const du = isErr ? 0 : 16 - per * nGian;

      const codeLines = [
        'from multiprocessing import Process, Queue',
        'tu_lanh = ["sữa", "bột"]; q = Queue()',
        `so_gian = ${slot('so_gian', String(nGian))}`,
        'def gian_phu(tl, q):',
        '    tl.append("trứng"); q.put(16 // so_gian)',
        'chay_process(gian_phu, tu_lanh, q)',
        'print(f"Tủ chính: {len(tu_lanh)} món | Mẻ/gian: {q.get()}")',
      ];

      const fridge1 = { id: 'fr-1', kind: 'fridge', x: 42, y: 86, w: 50, h: 50, items: 2, label: 'Tủ chính (2)', inspect: 'Tủ lạnh của tiến trình chính: ["sữa", "bột"]' };
      const windowQ = { id: 'win-q', kind: 'queue_window', x: 102, y: 90, w: 46, h: 30, label: 'Cửa Queue', inspect: 'multiprocessing.Queue: cửa sổ chuyền dữ liệu giữa các gian bếp' };
      const fridge2 = { id: 'fr-2', kind: 'fridge', x: 158, y: 86, w: 50, h: 50, items: 2, label: 'Tủ phụ (2)', inspect: 'Bản sao tủ lạnh ở tiến trình con: thêm "trứng" không ảnh hưởng tủ chính' };
      const hatch = { id: 'hatch', kind: 'kitchen_hatch', x: 236, y: 90, w: 40, h: 50, label: 'Máy in đơn' };
      const resultCard = { id: 'q-card', kind: 'tag_card', x: 161, y: 58, w: 44, h: 14, label: `16//${nGian}`, inspect: 'Kết quả tiến trình con tính ra, chỉ về được gian chính qua Queue' };
      const f2Copy = { ...fridge2, items: 3, label: 'Tủ phụ (3)' };

      const steps = [
        {
          line: [1, 2, 3],
          trace: [
            { t: 'tu_lanh = ["sữa", "bột"]; q = Queue()', n: 'bộ nhớ của tiến trình chính', f: 'fr-1' },
            { t: `so_gian = ${nGian}`, n: '', f: 'fr-1' },
          ],
          caption: 'Gian chính có `tu_lanh = ["sữa", "bột"]`. Khi mở gian phụ (`Process`), gian phụ nhận một tủ lạnh **bản sao** cũng có 2 món.',
          vars: { tu_lanh_chinh: '["sữa", "bột"] (2 món)', tu_lanh_phu: 'bản sao (2 món)', so_gian: String(nGian) },
          mascot: { x: 4, y: 108, pose: 'idle', say: '2 gian tách biệt!' },
          objects: [fridge1, windowQ, fridge2, hatch],
          products: [],
        },
        {
          line: [4, 5],
          isInteraction: true,
          trace: [
            { t: 'chay_process(gian_phu, tu_lanh, q)', n: 'tiến trình con nhận BẢN SAO của tu_lanh', f: ['fr-1', 'fr-2'] },
            { t: 'tl.append("trứng")', n: 'chỉ sửa bản sao trong gian phụ', f: 'fr-2' },
          ],
          caption: `Gian phụ thêm \`"trứng"\` vào tủ **của nó** (3 món) và tính \`16 // ${nGian}\`. Gõ \`so_gian\` khác rồi Enter để chia lại!`,
          vars: { tu_lanh_chinh: '2 món', tu_lanh_phu: '3 món (bản sao)', so_gian: String(nGian) },
          mascot: { x: 4, y: 108, pose: 'work', say: `16 // ${nGian}` },
          objects: [fridge1, { ...windowQ, highlight: true }, { ...f2Copy, highlight: true }, resultCard, hatch],
          products: [],
        },
      ];

      if (isErr) {
        steps.push({
          line: 5,
          trace: [
            { t: 'q.put(16 // so_gian)', n: '', f: 'q-card' },
            { t: 'q.put(16 // 0)', n: 'thay so_gian bằng giá trị 0', f: 'q-card' },
            { t: 'ZeroDivisionError', n: 'không chia được cho 0', f: 'q-card' },
          ],
          caption: 'Sự cố! `16 // 0` — chia 16 mẻ cho 0 gian bếp: máy chia mẻ bốc khói đen và dừng khẩn cấp! Tiến trình con chết, Queue không nhận được gì.',
          vars: { so_gian: '0', ket_qua: '❌ ZeroDivisionError' },
          mascot: { x: 4, y: 110, pose: 'error', say: 'Máy chia bốc khói!' },
          error: {
            name: 'ZeroDivisionError: integer division or modulo by zero',
            line: 5,
            incident: 'Chia 16 mẻ bánh cho 0 gian bếp: máy chia quá tải, bốc khói đen.',
            hint: 'Kiểm tra so_gian != 0 trước khi chia (// hoặc /).',
          },
          objects: [fridge1, { ...windowQ, jammed: true }, { ...f2Copy, jammed: true }, { ...resultCard, label: '16//0 ✗', jammed: true, smoke: true }, { id: 'err-zd', kind: 'jam_alert', x: 56, y: 42, w: 98, h: 16, label: 'ZeroDivisionError', error: true }, hatch],
          products: [],
        });
        return { codeLines, steps };
      }

      const prod = { id: 'mp-p1', kind: 'dish_tray', title: `Đơn: Tủ chính 2 món | ${per} mẻ`, raw: `print(...) → Tủ chính: 2 món | Mẻ/gian: ${per}`, isEmpty: false };
      const note = nGian < 0
        ? ` (\`//\` làm tròn **xuống** nên ra số âm \`${per}\` — số gian âm là vô nghĩa, nên kiểm tra \`so_gian > 0\`)`
        : du
          ? ` (còn dư \`16 % ${nGian} = ${du}\` mẻ không chia hết — \`//\` bỏ phần dư)`
          : '';
      steps.push(
        {
          line: 5,
          trace: [
            { t: 'q.put(16 // so_gian)', n: '', f: 'q-card' },
            { t: `q.put(16 // ${nGian})`, n: 'thay so_gian bằng giá trị', f: 'q-card' },
            { t: `q.put(${per})`, n: du ? `// bỏ phần dư ${du}` : 'chia lấy phần nguyên', f: ['q-card', 'win-q'] },
          ],
          caption: `\`q.put(16 // ${nGian})\` = \`${per}\`${note}. Gian phụ đặt thẻ \`${per} mẻ\` vào cửa Queue — con đường DUY NHẤT để dữ liệu về được gian chính.`,
          vars: { tu_lanh_phu: '3 món (bản sao)', 'q (trong cửa)': String(per), ...(du ? { 'dư': String(du) } : {}) },
          mascot: { x: 4, y: 108, pose: 'work', say: 'Đặt vào Queue' },
          objects: [fridge1, { ...windowQ, highlight: true }, f2Copy, { ...resultCard, x: 103, y: 72, label: `${per} mẻ`, highlight: true }, hatch],
          products: [],
        },
        {
          line: [6, 7],
          trace: [
            { t: 'q.get()', n: 'gian chính nhận thẻ qua cửa Queue', f: ['q-card', 'win-q'] },
            { t: 'len(tu_lanh) → 2', n: 'tủ chính KHÔNG có "trứng"', f: 'fr-1' },
            { t: `→ Tủ chính: 2 món | Mẻ/gian: ${per}`, n: '', f: 'hatch' },
          ],
          caption: `Gian chính \`q.get()\` nhận thẻ \`${per} mẻ\`, còn tủ chính vẫn nguyên \`2 món\` — "trứng" chỉ nằm trong bản sao của gian phụ. Máy in xuất đơn!`,
          vars: { 'len(tu_lanh)': '2 (không đổi)', 'q.get()': String(per) },
          mascot: { x: 4, y: 108, pose: 'happy', say: `Nhận ${per} mẻ!` },
          objects: [{ ...fridge1, highlight: true }, windowQ, f2Copy, { ...resultCard, x: 45, y: 58, label: `${per} mẻ ✓`, highlight: true }, { ...hatch, active: true, highlight: true }],
          products: [prod],
          justPrinted: prod,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 8. M8 · GU11 · Tkinter: Event loop (Thế giới: Quán: quầy nhận đơn)
  // ==========================================================================
  {
    idx: 7,
    module: 'M8 · Tkinter',
    codeId: 'GU11',
    title: 'Tkinter: Nhân viên Event Loop và hẹn lịch r.after',
    world: 'kitchen',
    coreConcept: 'Callback chặn (vòng lặp chờ) làm đơ mainloop; dùng r.after(ms, poll) để hẹn liếc Queue mà quầy vẫn thông.',
    metaphor: 'Widget = màn hình máy POS, event loop = nhân viên quầy luôn để mắt tới khách.',
    context: {
      story: 'Nhân viên quầy vừa phục vụ khách vừa phải để ý khay xem bếp đã làm xong đơn #42 chưa.',
      goal: 'Chờ đơn theo cách nào để quầy (giao diện) không bị đơ?',
      legend: [['🧑‍💼', 'Nhân viên quầy', 'mainloop'], ['🖥️', 'Màn hình POS', 'status (StringVar)'], ['🧺', 'Khay đơn', 'q (Queue)'], ['⏰', 'Hẹn giờ liếc khay', 'r.after(ms, poll)']],
    },
    codeTags: { pos: 'status', 'tray-q': 'q', 'tk-42': 'q.get()', clock: 'r.after', hatch: 'print()' },
    xp: 140,
    interactionStep: 1,
    defaultOption: 'use_after',
    inputs: [{ key: 'ms', label: 'r.after(', suffix: ', poll)', kind: 'int', default: '5', min: 0, max: 10000 }],
    interaction: {
      type: 'card',
      typeLabel: 'Chọn cách chờ & gõ ms',
      prompt: 'Gõ số mili-giây giữa hai lần liếc khay Queue (thử 5 và 3000) rồi Enter, hoặc chọn `while True`.',
      options: [
        { id: 'use_after', label: 'r.after(5, poll)', preset: { ms: '5' }, desc: 'Cứ 5ms liếc khay 1 lần' },
        { id: 'use_after_slow', label: 'r.after(3000, poll)', preset: { ms: '3000' }, desc: 'Liếc thưa: 3 giây 1 lần' },
        { id: 'err_loop', label: 'while True: (chờ chết)', isError: true, ignoresInput: true, desc: 'Đứng chờ trong callback' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const isErr = optId === 'err_loop';
      const ms = inp.ms ?? 5;
      const schedLine = isErr ? '    while q.empty(): pass  # đứng chờ trên luồng UI!' : `    r.after(${slot('ms', String(ms))}, poll)  # hẹn lần liếc sau`;
      const codeLines = [
        'status.set("Đang pha...")',
        'def poll():',
        '    if not q.empty(): status.set(f"Xong đơn #{q.get()}")',
        schedLine,
        'r.after(0, poll); r.mainloop()',
        'print(status.get())',
      ];

      const pos = { id: 'pos', kind: 'pos_terminal', x: 48, y: 86, w: 64, h: 42, label: 'POS: Đang pha', inspect: 'Màn hình tk.StringVar trên máy POS tại quầy' };
      const trayQ = { id: 'tray-q', kind: 'queue_window', x: 128, y: 92, w: 58, h: 32, label: 'Khay Queue', inspect: 'Khay Queue nhận kết quả từ worker Thread bếp sau' };
      const hatch = { id: 'hatch', kind: 'kitchen_hatch', x: 236, y: 90, w: 40, h: 50, label: 'Máy in hóa đơn' };
      const ticket42 = { id: 'tk-42', kind: 'tag_card', x: 135, y: 74, w: 44, h: 14, label: 'Đơn #42', inspect: 'Kết quả worker đặt vào Queue, chờ mainloop nhấc lên' };
      const clock = { id: 'clock', kind: 'wall_clock', x: 196, y: 56, w: 22, h: 22, label: isErr ? 'đơ' : `${ms}ms`, inspect: 'Nhịp hẹn giờ của r.after' };

      const steps = [
        {
          line: [1, 2],
          trace: [{ t: 'status.set("Đang pha...")', n: 'màn hình POS hiện chữ này', f: 'pos' }],
          caption: 'Máy POS hiện `"Đang pha..."`. Phụ bếp ở luồng nền đang làm đơn `#42`; khi xong sẽ đặt vào khay `Queue`.',
          vars: { status: '"Đang pha..."', 'q.empty()': 'True' },
          mascot: { x: 4, y: 108, pose: 'idle', say: 'Trông quầy!' },
          objects: [pos, { ...trayQ, label: 'Queue (trống)' }, hatch],
          products: [],
        },
        {
          line: [3, 4],
          isInteraction: true,
          trace: [
            { t: 'r.after(0, poll); r.mainloop()', n: 'mainloop = vòng lặp sự kiện của Tkinter', f: 'pos' },
            { t: isErr ? 'poll(): while q.empty(): pass' : `poll(): … r.after(${ms}, poll)`, n: isErr ? 'callback không chịu kết thúc' : 'callback chạy xong ngay, hẹn lần sau', f: ['tray-q', 'clock'] },
          ],
          caption: 'Phiếu `#42` vừa vào khay. Gõ số ms để hẹn lịch liếc khay bằng `r.after`, hoặc thử `while True` để xem quầy bị đơ.',
          vars: { status: '"Đang pha..."', che_do: isErr ? 'while True' : `r.after(${ms}, poll)` },
          mascot: { x: 4, y: 108, pose: 'work', say: isErr ? 'while…' : `after(${ms})` },
          objects: [{ ...pos, highlight: true }, { ...trayQ, highlight: true }, ticket42, clock, hatch],
          products: [],
        },
      ];

      if (isErr) {
        steps.push({
          line: 4,
          trace: [
            { t: 'mainloop gọi poll()', n: '', f: 'pos' },
            { t: 'while q.empty(): pass', n: 'poll không bao giờ return', f: 'tray-q' },
            { t: 'mainloop bị chặn → UI đơ', n: 'không vẽ lại, không nhận click', f: 'pos' },
          ],
          caption: 'Sự cố! Callback đứng trong vòng `while` không trả quyền cho `mainloop`: không vẽ lại được, không nhận click — màn hình POS đơ "Not Responding"!',
          vars: { status: '"Đang pha..." (đơ UI)', mainloop: '❌ Bị chặn' },
          mascot: { x: 4, y: 110, pose: 'error', say: 'Đơ quầy!' },
          error: {
            name: 'InfiniteLoopError: Vòng lặp chặn cứng Tkinter mainloop',
            line: 4,
            incident: 'Nhân viên quầy đứng nhìn khay mãi, giao diện quầy đơ hoàn toàn.',
            hint: 'Không chờ bằng vòng lặp trong callback UI; dùng r.after(ms, poll) để trả quyền cho mainloop.',
          },
          objects: [{ ...pos, jammed: true, label: 'Not Responding' }, { ...trayQ, jammed: true }, { ...ticket42, label: '#42 chưa ai nhận', w: 62, x: 126, jammed: true }, { ...clock, jammed: true }, { id: 'err-inf', kind: 'jam_alert', x: 60, y: 42, w: 104, h: 16, label: 'mainloop bị chặn', error: true }, hatch],
          products: [],
        });
        return { codeLines, steps };
      }

      const slow = ms >= 1000;
      const prod = { id: 'gu-p1', kind: 'dish_tray', title: 'Hóa đơn: Xong đơn #42', raw: 'print(status.get()) → Xong đơn #42', isEmpty: false };
      steps.push({
        line: [3, 5, 6],
        trace: [
          { t: `r.after(${ms}, poll)`, n: `${ms} ms sau mainloop gọi lại poll`, f: 'clock' },
          { t: 'q.empty() → False', n: 'đơn #42 đã nằm trong Queue', f: ['tray-q', 'tk-42'] },
          { t: 'status.set("Xong đơn #42")', n: 'mainloop vẽ lại màn hình POS', f: ['pos', 'tk-42'] },
        ],
        caption: slow
          ? `\`r.after(${ms}, poll)\` không làm đơ quầy, nhưng liếc thưa quá: khách phải chờ tới **${(ms / 1000).toFixed(1)} giây** mới thấy "Xong đơn #42". Giá trị vài chục ms là vừa.`
          : `Nhờ \`r.after(${ms}, poll)\`, cứ ${ms}ms nhân viên liếc khay một lần, giữa các lần vẫn phục vụ khách. Đơn \`#42\` lên màn hình POS và in hóa đơn!`,
        vars: { status: '"Xong đơn #42"', mainloop: 'Thông suốt ✓', 'độ trễ tối đa': `${ms} ms` },
        mascot: { x: 4, y: 108, pose: 'happy', say: slow ? 'Hơi chậm…' : 'Xong #42!' },
        objects: [{ ...pos, label: 'POS: Xong #42 ✓', highlight: true }, { ...trayQ, label: 'Queue (trống)' }, { ...ticket42, x: 58, y: 70, label: '#42 ✓', highlight: true }, clock, { ...hatch, active: true, highlight: true }],
        products: [prod],
        justPrinted: prod,
      });
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 9. M9 · EX05 · Ôn tập: Refcount, GC (Thế giới: Bàn & Kho)
  // ==========================================================================
  {
    idx: 8,
    module: 'M9 · Ôn tập',
    codeId: 'EX05',
    title: 'CPython: Dây buộc Reference Counting và thu gom rác',
    world: 'memory',
    coreConcept: 'Biến là nhãn buộc dây vào hộp; del chỉ gỡ nhãn. Gọi tên đã gỡ → NameError; viết trong ngoặc kép là chuỗi, không phải biến.',
    metaphor: 'Object = hộp đồ trên kệ, reference = dây buộc nhãn vào hộp, số dây = refcount.',
    context: {
      story: 'Trên kệ có một hộp đồ. Mỗi tên biến là một nhãn buộc dây vào hộp đó.',
      goal: 'del xoá hộp hay chỉ gỡ nhãn? Khi nào hộp thật sự bị dọn đi?',
      legend: [['📦', 'Hộp trên kệ', 'object (list)'], ['🏷️', 'Nhãn + dây', 'tên biến (reference)'], ['🔢', 'Số dây', 'refcount'], ['✂️', 'Cắt dây', 'del / gán None']],
    },
    codeTags: { 'heap-box': 'list object', printer: 'print()' },
    xp: 140,
    interactionStep: 1,
    defaultOption: 'in_bansao',
    inputs: [{ key: 'ten', label: 'print(', suffix: ')', kind: 'expr', default: 'ban_sao', maxLen: 18 }],
    interaction: {
      type: 'card',
      typeLabel: 'Gõ thứ cần in',
      prompt: 'Sau `del gio_hang`, gõ thứ truyền vào `print(...)` rồi Enter: thử `ban_sao`, `gio_hang`, hoặc `"ban_sao"` có ngoặc kép.',
      options: [
        { id: 'in_bansao', label: 'print(ban_sao)', preset: { ten: 'ban_sao' }, desc: 'Đọc hộp qua dây còn buộc' },
        { id: 'in_chuoi', label: 'print("ban_sao")', preset: { ten: '"ban_sao"' }, desc: 'Chuỗi chữ, không phải biến' },
        { id: 'err_name', label: 'print(gio_hang)', preset: { ten: 'gio_hang' }, isError: true, desc: 'Tên đã bị del' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const raw = String(inp.ten ?? 'ban_sao').trim();
      const codeLines = ['gio_hang = ["táo", "sữa"]', 'ban_sao = gio_hang', 'ban_sao.append("bánh")', 'del gio_hang', `print(${slot('ten', raw)})`, 'ban_sao = None; print(ban_sao)'];

      const box = { id: 'heap-box', kind: 'storage_box', x: 102, y: 82, w: 78, h: 36, ropes: ['ban_sao', 'gio_hang'], label: 'Hộp (3 món)', inspect: 'Object list trên Heap: số dây đang buộc vào hộp là refcount' };
      const printer = { id: 'printer', kind: 'printer', x: 222, y: 86, w: 46, h: 54, label: 'Máy in tem' };

      const steps = [
        {
          line: [1, 2, 3],
          trace: [
            { t: 'gio_hang = ["táo", "sữa"]', n: 'tạo 1 list, buộc dây tên gio_hang', f: 'heap-box' },
            { t: 'ban_sao = gio_hang', n: 'KHÔNG chép: buộc thêm dây vào CÙNG hộp', f: 'heap-box' },
            { t: 'ban_sao.append("bánh")', n: 'sửa hộp chung → gio_hang cũng thấy', f: 'heap-box' },
          ],
          caption: '`ban_sao = gio_hang` buộc dây thứ 2 vào **CÙNG** chiếc hộp (không sao chép!). Thêm `"bánh"` qua `ban_sao` làm hộp có 3 món.',
          vars: { gio_hang: '──► Hộp #1', ban_sao: '──► Hộp #1', refcount: '2 dây' },
          mascot: { x: 4, y: 108, pose: 'idle', say: '2 dây, 1 hộp!' },
          objects: [{ ...box, label: 'Hộp (3 món) · 2 dây' }, printer],
          products: [],
        },
        {
          line: 4,
          isInteraction: true,
          trace: [
            { t: 'del gio_hang', n: 'gỡ TÊN, không xoá hộp', f: 'heap-box' },
            { t: 'refcount: 2 → 1', n: 'hộp còn 1 dây (ban_sao)', f: 'heap-box' },
          ],
          caption: '`del gio_hang` chỉ tháo **dây** `gio_hang`; hộp vẫn còn vì dây `ban_sao` (`1 dây`). Gõ thứ muốn `print` rồi Enter!',
          vars: { gio_hang: '(đã gỡ dây)', ban_sao: '──► Hộp #1', refcount: '1 dây' },
          mascot: { x: 4, y: 108, pose: 'work', say: `In ${raw}?` },
          objects: [{ ...box, ropes: ['ban_sao'], cut: ['gio_hang'], label: 'Hộp (3 món) · 1 dây', highlight: true }, printer],
          products: [],
        },
      ];

      // Diễn giải đúng như Python
      let out = null;
      let kind = '';
      let err = null;
      const strM = raw.match(/^(["'])(.*)\1$/);
      const BUILTINS = { print: '<built-in function print>', len: '<built-in function len>', list: "<class 'list'>", str: "<class 'str'>", int: "<class 'int'>", dict: "<class 'dict'>" };
      if (raw === 'ban_sao') {
        out = "['táo', 'sữa', 'bánh']";
        kind = 'var';
      } else if (strM) {
        out = strM[2];
        kind = 'str';
      } else if (/^[+-]?\d+(\.\d+)?$/.test(raw)) {
        out = pyNum(Number(raw));
        kind = 'num';
      } else if (raw === 'None' || raw === 'True' || raw === 'False') {
        out = raw;
        kind = 'const';
      } else if (IDENT_RE.test(raw) && BUILTINS[raw]) {
        out = BUILTINS[raw];
        kind = 'builtin';
      } else if (IDENT_RE.test(raw) && !PY_KEYWORDS.has(raw)) {
        err = {
          name: `NameError: name ${pyStr(raw)} is not defined`,
          incident: raw === 'gio_hang' ? 'Gọi một cái tên đã bị del: không hộp nào đáp lại, dấu "?" trên đầu.' : `Chưa có nhãn nào tên "${raw}" buộc vào hộp nào cả.`,
          hint: raw === 'gio_hang' ? 'del đã gỡ tên gio_hang; đọc hộp qua dây ban_sao còn buộc.' : 'Dùng tên đã gán (ban_sao) hoặc gán biến trước khi dùng.',
        };
      } else {
        err = { name: 'SyntaxError: invalid syntax', incident: `"${raw}" không phải biểu thức Python hợp lệ.`, hint: 'Gõ tên biến (ban_sao), một chuỗi trong ngoặc kép hoặc một con số.' };
      }

      if (err) {
        steps.push({
          line: 5,
          trace: [
            { t: `print(${raw})`, n: 'Python tìm tên trong bảng tên', f: 'heap-box' },
            { t: err.name.startsWith('NameError') ? `"${raw}" → không có dây nào` : 'cú pháp không hợp lệ', n: '', f: 'heap-box' },
            { t: err.name.split(':')[0], n: 'dừng chương trình', f: null },
          ],
          caption:
            raw === 'gio_hang'
              ? 'Sự cố! Bit gọi to tên `gio_hang` nhưng nhãn đó đã bị tháo ở dòng 4: không chiếc hộp nào đáp lại!'
              : `Sự cố! \`print(${raw})\`: ${err.incident}`,
          vars: { [raw.slice(0, 12)]: `❌ ${err.name.split(':')[0]}`, ban_sao: '──► Hộp #1' },
          mascot: { x: 4, y: 110, pose: 'error', say: `${raw.slice(0, 10)} là ai?` },
          error: { line: 5, ...err },
          objects: [{ ...box, ropes: ['ban_sao'], cut: ['gio_hang'], label: 'Hộp (3 món) · 1 dây' }, { id: 'err-nm', kind: 'jam_alert', x: 84, y: 50, w: 110, h: 16, label: err.name.split(':')[0], error: true }, printer],
          products: [],
        });
        return { codeLines, steps };
      }

      const p1 = { id: 'ex-p1', kind: 'price_tag', title: `Nhãn: ${out}`, raw: `print(${raw}) → ${out}`, isEmpty: false };
      const p2 = { id: 'ex-p2', kind: 'price_tag', title: 'Nhãn rỗng: None', raw: 'print(ban_sao) → None', isEmpty: true };
      const explain = {
        var: 'Đọc qua dây `ban_sao` lấy được nguyên hộp `[\'táo\', \'sữa\', \'bánh\']` — kể cả món "bánh" thêm qua tên kia, vì hai tên là CÙNG một hộp.',
        str: `\`"${out}"\` trong ngoặc kép là **chuỗi chữ**, không phải tên biến: Python in nguyên chữ \`${out}\` mà không đụng tới chiếc hộp nào.`,
        num: `\`${raw}\` là một con số, in thẳng ra \`${out}\` — không liên quan tới hộp.`,
        const: `\`${raw}\` là hằng có sẵn của Python, in ra \`${out}\`.`,
        builtin: `\`${raw}\` là hàm/kiểu có sẵn của Python nên tên này luôn tồn tại: in ra \`${out}\`.`,
      }[kind];
      steps.push(
        {
          line: 5,
          trace: [
            { t: `print(${raw})`, n: kind === 'var' ? 'tìm tên ban_sao → lần theo dây tới hộp' : 'đây là giá trị trực tiếp, không phải tên biến', f: kind === 'var' ? 'heap-box' : 'printer' },
            { t: `→ ${out}`, n: '', f: 'printer' },
          ],
          caption: `${explain} Máy in tem xuất **${p1.title}**.`,
          vars: { [`print(${raw.slice(0, 10)})`]: out, refcount: '1 dây' },
          mascot: { x: 4, y: 108, pose: 'happy', say: kind === 'var' ? 'Còn dây ban_sao!' : 'In ra chữ!' },
          objects: [{ ...box, ropes: ['ban_sao'], cut: ['gio_hang'], label: 'Hộp (3 món) · 1 dây', highlight: kind === 'var' }, { ...printer, active: true, highlight: true }],
          products: [p1],
          justPrinted: p1,
        },
        {
          line: 6,
          trace: [
            { t: 'ban_sao = None', n: 'gỡ nốt dây cuối', f: 'heap-box' },
            { t: 'refcount: 1 → 0', n: 'CPython thu hồi hộp ngay', f: 'heap-box' },
            { t: 'print(ban_sao) → None', n: '', f: 'printer' },
          ],
          caption: '`ban_sao = None` tháo nốt sợi dây cuối (`0 dây`) → không ai giữ hộp nữa, CPython dọn hộp ngay. Máy in tem in ra tem **`None`** viền đứt mờ!',
          vars: { ban_sao: 'None', refcount: '0 dây (đã thu hồi)' },
          mascot: { x: 4, y: 108, pose: 'happy', say: 'Hết dây → dọn hộp!' },
          objects: [{ ...box, kind: 'drawer_ghost', ropes: [], label: 'Hộp đã dọn' }, { ...printer, active: true, highlight: true }],
          products: [p1, p2],
          justPrinted: p2,
        },
      );
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 10. M10 · RD03 · NumPy mở rộng: argsort (Thế giới: Giao thông & Shipper)
  // ==========================================================================
  {
    idx: 9,
    module: 'M10 · API & NumPy mở rộng',
    codeId: 'RD03',
    title: 'NumPy: Shipper xếp hàng giữ đúng biển tên với argsort',
    world: 'city',
    coreConcept: 'argsort trả về mảng VỊ TRÍ để sắp xếp; dùng nó làm chỉ số giúp mảng tên đi đúng cặp với mảng số.',
    metaphor: 'Shipper xếp hàng theo số đơn, biển tên đi theo đúng người nhờ vé vị trí argsort.',
    context: {
      story: '3 shipper đứng xếp hàng, mỗi người có một số đơn. Cần xếp lại theo số đơn tăng dần mà biển tên vẫn đúng người.',
      goal: 'argsort trả về cái gì, và vì sao phải dùng nó làm chỉ số cho mảng tên?',
      legend: [['🛵', 'Một shipper', 'ten[i], don[i]'], ['🎫', 'Vé vị trí', 'thu_tu = argsort(don)'], ['🔀', 'Xếp hàng mới', 'ten[thu_tu]']],
    },
    codeTags: { 'sh-0': 'ten[0]', 'sh-1': 'ten[1]', 'sh-2': 'ten[2]', tickets: 'thu_tu', depot: 'print()' },
    xp: 140,
    interactionStep: 1,
    defaultOption: 'use_thu_tu',
    inputs: [{ key: 'don', label: 'don = [', suffix: ']', kind: 'list', default: '30, 10, 20', intOnly: true, min: -99, max: 99, minCount: 3, maxCount: 3 }],
    interaction: {
      type: 'predict',
      typeLabel: 'Gõ số đơn & chọn chỉ số',
      prompt: 'Gõ 3 số đơn cho An, Bình, Chi (thử `2, 0, 1`!) rồi Enter, và chọn biểu thức chỉ số để xếp hàng.',
      options: [
        { id: 'use_thu_tu', label: 'ten[thu_tu] (tăng dần)', desc: 'Dùng vé vị trí từ argsort' },
        { id: 'use_rev', label: 'ten[thu_tu[::-1]] (giảm)', desc: 'Đảo ngược vé vị trí' },
        { id: 'err_idx', label: 'ten[don] (nhầm giá trị)', isError: true, desc: 'Dùng số đơn làm vị trí' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const don = inp.don ?? [30, 10, 20];
      const TEN = ['An', 'Bình', 'Chi'];
      const n = 3;
      const thuTu = [0, 1, 2].sort((a, b) => don[a] - don[b] || a - b); // argsort ổn định
      const mode = optId === 'use_rev' ? 'rev' : optId === 'err_idx' ? 'don' : 'asc';
      const idxExpr = mode === 'rev' ? 'thu_tu[::-1]' : mode === 'don' ? 'don' : 'thu_tu';
      const order = mode === 'rev' ? [...thuTu].reverse() : mode === 'don' ? don : thuTu;

      const codeLines = [
        'import numpy as np',
        'ten = np.array(["An", "Bình", "Chi"])',
        `don = np.array([${slot('don', don.join(', '))}])`,
        'thu_tu = np.argsort(don)',
        `xep = ten[${idxExpr}]`,
        'print(thu_tu.tolist(), xep.tolist())',
      ];

      const SLOTS = [40, 98, 156];
      const shippers = TEN.map((t, i) => ({ id: `sh-${i}`, kind: 'parcel', variant: 'rider', x: SLOTS[i], y: 88, w: 50, h: 28, label: `#${i} ${t} (${don[i]})`, inspect: `Vị trí ${i}: shipper ${t} có ${don[i]} đơn` }));
      const depot = { id: 'depot', kind: 'shipper_gate', x: 236, y: 90, w: 40, h: 50, label: 'Trạm Shipper' };
      const tickets = { id: 'tickets', kind: 'tag_card', x: 92, y: 50, w: 78, h: 15, label: `thu_tu = [${thuTu.join(', ')}]`, inspect: 'argsort: vị trí của số nhỏ nhất, rồi nhì, rồi ba' };

      const steps = [
        {
          line: [1, 2, 3, 4],
          trace: [
            { t: 'thu_tu = np.argsort(don)', n: 'trả về VỊ TRÍ, không phải giá trị', f: 'tickets' },
            ...thuTu.map((p, k) => ({ t: `hạng ${k + 1}: vị trí ${p} (${TEN[p]}, ${don[p]} đơn)`, n: k === 0 ? 'nhỏ nhất trước' : '', f: `sh-${p}` })),
            { t: `thu_tu = [${thuTu.join(', ')}]`, n: '', f: 'tickets' },
          ],
          caption: `3 shipper đứng ở vị trí \`#0 An (${don[0]})\`, \`#1 Bình (${don[1]})\`, \`#2 Chi (${don[2]})\`. \`np.argsort(don)\` phát vé vị trí \`thu_tu = [${thuTu.join(', ')}]\`: người ít đơn nhất đang đứng ở vị trí \`${thuTu[0]}\`.`,
          vars: { ten: '["An", "Bình", "Chi"]', don: `[${don.join(', ')}]`, thu_tu: `[${thuTu.join(', ')}]` },
          mascot: { x: 4, y: 108, pose: 'idle', say: `Vé: [${thuTu.join(', ')}]` },
          objects: [...shippers, tickets, depot],
          products: [],
        },
        {
          line: 5,
          isInteraction: true,
          trace: [{ t: `xep = ten[${idxExpr}]`, n: 'chờ bạn chọn cách đánh chỉ số', f: 'tickets' }],
          caption: 'Gõ số đơn khác cho 3 shipper, và chọn cách dùng vé chỉ số để xếp lại đội hình.',
          vars: { thu_tu: `[${thuTu.join(', ')}]`, bieu_thuc: `ten[${idxExpr}]` },
          mascot: { x: 4, y: 108, pose: 'work', say: `ten[${idxExpr}]` },
          objects: [...shippers.map((s) => ({ ...s, highlight: true })), { ...tickets, highlight: true }, depot],
          products: [],
        },
      ];

      const bad = mode === 'don' ? don.find((v) => v >= n || v < -n) : undefined;
      if (bad !== undefined) {
        steps.push({
          line: 5,
          trace: [
            { t: 'ten[don]', n: '', f: 'tickets' },
            { t: `ten[[${don.join(', ')}]]`, n: 'thay don bằng giá trị → số đơn bị dùng làm vị trí', f: 'tickets' },
            { t: `ten[${bad}] → IndexError`, n: 'ten chỉ có vị trí 0..2', f: `sh-${don.indexOf(bad)}` },
          ],
          caption: `Sự cố! \`ten[don]\` lấy chính **số đơn** \`${bad}\` làm vị trí đứng, trong khi bến chỉ có 3 chỗ (\`0..2\`): xe shipper lao quá cuối bến và ngã!`,
          vars: { don: `[${don.join(', ')}]`, [`ten[${bad}]`]: '❌ IndexError' },
          mascot: { x: 4, y: 112, pose: 'error', say: `Lố bến số ${bad}!` },
          error: {
            name: `IndexError: index ${bad} is out of bounds for axis 0 with size 3`,
            line: 5,
            incident: `Shipper chạy tới ô số ${bad} trên bến chỉ có 3 ô (0..2): lao quá cuối và ngã.`,
            hint: 'Truyền mảng VỊ TRÍ ten[thu_tu] (từ argsort) chứ không truyền mảng GIÁ TRỊ don.',
          },
          objects: [...shippers.map((s, i) => (don[i] === bad ? { ...s, jammed: true } : s)), { ...tickets, label: `ten[don] = ten[[${don.join(', ')}]]`, jammed: true }, { id: 'err-id', kind: 'jam_alert', x: 82, y: 50, w: 104, h: 16, label: `IndexError: ${bad}`, error: true }, depot],
          products: [],
        });
        return { codeLines, steps };
      }

      const norm = order.map((v) => (v < 0 ? n + v : v));
      const names = norm.map((i) => TEN[i]);
      const namesOut = pyList(names);
      const sortedOk = mode !== 'don';
      const prod = { id: 'rd-p1', kind: 'parcel_box', title: `Đội hình: ${namesOut}`, raw: `print(...) → [${thuTu.join(', ')}] ${namesOut}`, isEmpty: false };
      // Mỗi chỗ đứng lấy shipper ở vị trí norm[slot]; ten[don] có thể lấy trùng 1 người nhiều lần
      const used = new Map();
      const lineup = norm.map((srcIdx, s) => {
        const k = used.get(srcIdx) || 0;
        used.set(srcIdx, k + 1);
        const src = shippers[srcIdx];
        return { ...src, id: k ? `${src.id}-dup${k}` : src.id, x: SLOTS[s], label: `${s + 1}. ${TEN[srcIdx]} (${don[srcIdx]}) [#${srcIdx}]`, highlight: true, jammed: !sortedOk && k > 0 };
      });
      const dupNames = names.filter((v, i) => names.indexOf(v) !== i);
      steps.push({
        line: 6,
        trace: [
          { t: `ten[${idxExpr}]`, n: '', f: 'tickets' },
          { t: `ten[[${norm.join(', ')}]]`, n: 'thay bằng mảng vị trí', f: 'tickets' },
          { t: `[${norm.map((i) => `ten[${i}]`).join(', ')}]`, n: 'lấy từng phần tử theo vị trí', f: lineup.map((l) => l.id) },
          { t: `→ ${namesOut}`, n: '', f: 'depot' },
        ],
        caption: sortedOk
          ? `Mỗi shipper chạy tới chỗ mới theo vé \`${idxExpr}\` = \`[${norm.join(', ')}]\`, biển tên đi theo đúng người. Đội hình ${mode === 'rev' ? 'giảm' : 'tăng'} dần số đơn: **${namesOut}**.`
          : `\`ten[don]\` chạy được vì mọi số đơn đều nằm trong \`0..2\`, nhưng **sai nghĩa**: lấy theo giá trị đơn chứ không theo thứ tự${dupNames.length ? `, thậm chí ${dupNames[0]} xuất hiện 2 lần` : ''}. So với \`ten[thu_tu]\` để thấy khác biệt!`,
        vars: { thu_tu: `[${thuTu.join(', ')}]`, xep: namesOut },
        mascot: { x: 4, y: 108, pose: sortedOk ? 'happy' : 'idle', say: sortedOk ? 'Đúng người đúng số!' : 'Có gì đó sai sai…' },
        objects: [...lineup, { ...tickets, label: `${idxExpr} = [${norm.join(', ')}]`, highlight: true }, { ...depot, active: true, highlight: true }],
        products: [prod],
        justPrinted: prod,
      });
      return { codeLines, steps };
    },
  },

  // ==========================================================================
  // 11. M11 · TH03 · Số liệu thật CC0: Giờ cao điểm (Thế giới: Cả quán)
  // ==========================================================================
  {
    idx: 10,
    module: 'M11 · Số liệu thật',
    codeId: 'TH03',
    title: 'Chặng tổng kết: Ticket qua máy đọc giờ và sổ báo cáo giờ cao điểm',
    world: 'kitchen',
    coreConcept: 'Chuỗi thời gian phải tách bằng to_datetime(...).hour, không ép thẳng int(); dữ liệu thật có thể có nhiều đỉnh đồng hạng (tie).',
    metaphor: 'Ticket đi qua máy đọc giờ ở quầy rồi ghi lên sổ báo cáo cuối ngày.',
    context: {
      story: 'Quán có 2.623 hoá đơn thật. Mỗi vé ghi thời gian dưới dạng chữ. Cần tìm giờ bán Espresso chạy nhất.',
      goal: 'Tách giờ từ chuỗi thời gian thế nào cho đúng, và nếu 2 giờ cùng cao nhất thì báo cáo ra sao?',
      legend: [['🎫', 'Vé', 've (chuỗi thời gian)'], ['📟', 'Máy đọc giờ', 'to_datetime(…).hour'], ['📒', 'Sổ đếm theo giờ', 'dem (value_counts)'], ['⛰️', 'Đỉnh cao nhất', 'dem.max()']],
    },
    codeTags: { tk: 've', lg: 'dem', hatch: 'print()' },
    xp: 160,
    interactionStep: 1,
    defaultOption: 'dt_hour',
    inputs: [{ key: 've', label: 've = "', suffix: '"', kind: 'str', default: '2024-03-01 11:15:00', maxLen: 22 }],
    interaction: {
      type: 'card',
      typeLabel: 'Gõ vé & chọn cách đọc giờ',
      prompt: 'Gõ chuỗi thời gian trên vé theo mẫu `FMT` = `YYYY-MM-DD HH:MM:SS` (thử sai mẫu như `11:15`, hay chỉ `11` với int) rồi Enter.',
      options: [
        { id: 'dt_hour', label: 'to_datetime(ve).hour · giữ mọi đỉnh', desc: 'Đọc giờ chuẩn, giữ cả 11h và 12h' },
        { id: 'only_one', label: 'to_datetime · idxmax()', desc: 'Chỉ lấy 1 giờ đầu tiên' },
        { id: 'err_val', label: 'int(ve) (ép thẳng)', isError: true, desc: 'Ép chuỗi giờ sang số nguyên' },
      ],
    },
    buildSteps(optId, inp = {}) {
      const ve = String(inp.ve ?? '2024-03-01 11:15:00');
      const useInt = optId === 'err_val';
      const onlyOne = optId === 'only_one';
      const parseLine = useInt ? 'gio_ve = int(ve)' : 'gio_ve = pd.to_datetime(ve, format=FMT).hour';
      const peakLine = onlyOne ? 'dinh = [int(dem.idxmax())]' : 'dinh = sorted(int(g) for g in dem[dem == dem.max()].index)';
      const codeLines = [
        'import pandas as pd; FMT = "%Y-%m-%d %H:%M:%S"',
        'ban = pd.read_csv("coffee-sales-cc0.csv")',
        `ve = "${slot('ve', ve)}"`,
        parseLine,
        'ban["gio"] = pd.to_datetime(ban["datetime"], format=FMT).dt.hour',
        'dem = ban[ban["coffee_name"] == "Espresso"]["gio"].value_counts()',
        peakLine,
        'print(f"Vé {gio_ve}h · Cao điểm: {dinh} ({int(dem.max())} đơn)")',
      ];

      // Mô phỏng to_datetime / int cho 1 chuỗi
      let hour = null;
      let err = null;
      if (useInt) {
        if (/^\s*[+-]?\d+\s*$/.test(ve)) hour = parseInt(ve, 10);
        else err = { name: `ValueError: invalid literal for int() with base 10: ${pyStr(ve)}`, incident: `Đưa thẻ "${ve}" (có ký tự không phải số) thẳng vào máy int(): máy kêu bíp đỏ và nhả thẻ ra.`, hint: 'Dùng pd.to_datetime(ve, format=FMT).hour để tách phần giờ từ chuỗi thời gian.' };
      } else {
        // format=FMT cố định → hành vi xác định như strptime: sai mẫu là ValueError
        const m = ve.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        const fmtErr = {
          name: `ValueError: time data "${ve}" doesn't match format "%Y-%m-%d %H:%M:%S"`,
          incident: `Vé "${ve}" không đúng mẫu năm-tháng-ngày giờ:phút:giây nên máy đọc giờ từ chối.`,
          hint: 'Gõ đủ dạng 2024-03-01 11:15:00 (giờ 0..23, phút/giây 0..59, tháng 1..12).',
        };
        if (!m) err = fmtErr;
        else {
          const [, y, mo, d, h, mi, se] = m.map(Number);
          if (mo < 1 || mo > 12 || h > 23 || mi > 59 || se > 59 || d < 1) err = fmtErr;
          else if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) {
            err = { name: 'ValueError: day is out of range for month', incident: `Tháng ${mo}/${y} không có ngày ${d}: máy đọc giờ từ chối.`, hint: 'Kiểm tra lại ngày trong tháng.' };
          } else hour = h;
        }
      }

      const ticket = { id: 'tk', kind: 'pos_terminal', x: 40, y: 88, w: 62, h: 40, label: `"${ve.length > 11 ? `…${ve.slice(-8)}` : ve}"`, inspect: `Vé thử: ve = "${ve}"` };
      const ledger = { id: 'lg', kind: 'hour_ledger', x: 118, y: 68, w: 84, h: 58, title: 'Espresso / giờ', bars: [], empty: true, emptyText: 'chưa đếm', inspect: 'Sổ đếm theo giờ của Espresso trong dữ liệu thật: cả 11h và 12h đều 13 đơn' };
      const hatch = { id: 'hatch', kind: 'kitchen_hatch', x: 236, y: 90, w: 40, h: 50, label: 'Máy in báo cáo' };

      const steps = [
        {
          line: [1, 2],
          trace: [{ t: 'ban = pd.read_csv(...)', n: '2.623 dòng; cột datetime là CHUỖI chữ', f: ['tk', 'lg'] }],
          caption: 'Nạp 2.623 ticket thật của quán từ `coffee-sales-cc0.csv`. Mỗi ticket mang chuỗi thời gian như `"2024-03-01 11:15:00"`.',
          vars: { 'len(ban)': '2623 đơn', mau_gio: '"2024-03-01 11:15:00"' },
          mascot: { x: 4, y: 108, pose: 'idle', say: '2.623 đơn thật!' },
          objects: [ticket, ledger, hatch],
          products: [],
        },
        {
          line: [3, 4],
          isInteraction: true,
          trace: [
            { t: `ve = "${ve}"`, n: '1 vé để thử máy đọc giờ', f: 'tk' },
            { t: parseLine, n: 'chờ bạn chọn cách đọc giờ', f: 'tk' },
          ],
          caption: 'Thử máy đọc giờ với 1 vé trước: gõ chuỗi thời gian vào `ve` rồi Enter, và chọn cách đọc giờ ở thanh thẻ lệnh.',
          vars: { ve: `"${ve}"`, cach_doc: useInt ? 'int(ve)' : 'to_datetime(ve).hour' },
          mascot: { x: 4, y: 108, pose: 'work', say: 'Đọc giờ vé…' },
          objects: [{ ...ticket, highlight: true }, ledger, hatch],
          products: [],
        },
      ];

      if (err) {
        steps.push({
          line: 4,
          trace: [
            { t: parseLine, n: '', f: 'tk' },
            { t: useInt ? `int("${ve}")` : `to_datetime("${ve}", format=FMT)`, n: 'thay ve bằng giá trị', f: 'tk' },
            { t: err.name.split(':')[0], n: err.incident, f: 'tk' },
          ],
          caption: `Sự cố! ${err.incident}`,
          vars: { ve: `"${ve}"`, gio_ve: `❌ ${err.name.split(':')[0]}` },
          mascot: { x: 4, y: 110, pose: 'error', say: 'Máy nhả thẻ!' },
          error: { line: 4, ...err },
          objects: [{ ...ticket, jammed: true }, { ...ledger, emptyText: 'dừng ở dòng 4' }, { id: 'err-vl', kind: 'jam_alert', x: 60, y: 42, w: 120, h: 16, label: err.name.split(':')[0], error: true }, hatch],
          products: [],
        });
        return { codeLines, steps };
      }

      const listStr = onlyOne ? '[11]' : '[11, 12]';
      const prod = { id: 'th-p1', kind: 'dish_tray', title: `Báo cáo: ${listStr} (13 đơn)`, raw: `print(...) → Vé ${hour}h · Cao điểm: ${listStr} (13 đơn)`, isEmpty: false };
      steps.push(
        {
          line: 4,
          trace: [
            { t: parseLine, n: '', f: 'tk' },
            { t: useInt ? `int("${ve}")` : `to_datetime("${ve}", format=FMT)`, n: useInt ? 'chuỗi chỉ toàn chữ số' : 'khớp mẫu %Y-%m-%d %H:%M:%S', f: 'tk' },
            { t: `gio_ve = ${hour}`, n: '', f: 'tk' },
          ],
          caption: useInt
            ? `\`int("${ve}")\` = \`${hour}\` chạy được vì chuỗi chỉ toàn chữ số${hour > 23 ? ` — nhưng \`${hour}\` không phải giờ hợp lệ, \`int()\` không hề biết giờ chỉ có 0..23!` : '. Nhưng vé thật luôn có dạng "YYYY-MM-DD HH:MM:SS", nên cột dữ liệu vẫn phải đọc bằng to_datetime.'}`
            : `\`pd.to_datetime(ve, format=FMT)\` khớp đúng mẫu ngày giờ nên tách ra được giờ \`${hour}\`.`,
          vars: { ve: `"${ve}"`, gio_ve: String(hour) },
          mascot: { x: 4, y: 108, pose: 'happy', say: `Vé lúc ${hour}h` },
          objects: [{ ...ticket, label: `${hour}h ✓`, highlight: true }, ledger, hatch],
          products: [],
        },
        {
          line: [5, 6],
          trace: [
            { t: 'ban["gio"] = …dt.hour', n: 'đọc giờ cho CẢ cột một lần', f: 'lg' },
            { t: 'dem = …value_counts()', n: 'đếm số đơn Espresso theo từng giờ', f: 'lg' },
            { t: 'dem[11] = 13 · dem[12] = 13', n: '2 giờ cùng cao nhất', f: 'lg' },
          ],
          caption: 'Đọc giờ cho cả cột rồi đếm số đơn Espresso theo từng giờ: hai khung **11h** và **12h** cùng đạt **13 đơn** — hai đỉnh đồng hạng!',
          vars: { 'dem[11]': '13', 'dem[12]': '13', 'dem.max()': '13' },
          mascot: { x: 4, y: 108, pose: 'work', say: 'Đếm theo giờ…' },
          objects: [ticket, { ...ledger, empty: false, bars: [{ h: '11h', v: 13 }, { h: '12h', v: 13 }], highlight: true }, hatch],
          products: [],
        },
        {
          line: [7, 8],
          trace: onlyOne
            ? [
                { t: 'dem.idxmax()', n: 'chỉ trả về 1 nhãn đầu tiên', f: 'lg' },
                { t: 'dinh = [11]', n: 'bỏ sót 12h!', f: 'lg' },
              ]
            : [
                { t: 'dem == dem.max()', n: 'đánh dấu MỌI giờ bằng max', f: 'lg' },
                { t: 'dinh = [11, 12]', n: 'giữ đủ các đỉnh hoà', f: 'lg' },
                { t: 'print(...)', n: '', f: 'hatch' },
              ],
          caption: onlyOne
            ? '`idxmax()` chỉ trả về **một** giờ đầu tiên `[11]` và im lặng bỏ sót `12h` (cũng 13 đơn). Báo cáo thiếu! Thử lại với cách "giữ mọi đỉnh".'
            : 'Lọc `dem == dem.max()` giữ trọn cả hai khung giờ đồng hạng `[11, 12]`. Máy in xuất **Báo cáo giờ cao điểm**!',
          vars: { dinh: listStr, so_luot: '13' },
          mascot: { x: 4, y: 108, pose: onlyOne ? 'idle' : 'happy', say: `Đỉnh: ${listStr}` },
          objects: [
            ticket,
            {
              ...ledger,
              empty: false,
              highlight: true,
              bars: onlyOne ? [{ h: '11h', v: 13, peak: true }, { h: '12h', v: 13, missed: true }] : [{ h: '11h', v: 13, peak: true }, { h: '12h', v: 13, peak: true }],
              note: onlyOne ? 'bỏ sót 12h!' : 'giữ đủ 2 đỉnh',
              noteErr: onlyOne,
            },
            { ...hatch, active: true, highlight: true },
          ],
          products: [prod],
          justPrinted: prod,
        },
      );
      return { codeLines, steps };
    },
  },
];

/**
 * Hàm tất định (deterministic snapshot):
 * Cho trước (lessonIdx, optionId, stepIdx, input), luôn trả về đúng trạng thái cảnh,
 * dòng code, bảng biến và khay sản phẩm tại bước đó (phục vụ goTo(n) và test tự động).
 */
export function getDeterministicSnapshot(lessonIdx, optionId, stepIdx, input) {
  const lesson = LESSONS_11[Math.max(0, Math.min(LESSONS_11.length - 1, lessonIdx))];
  const opt = optionId || lesson.defaultOption;
  const inp = resolveInput(lesson, input);
  const { codeLines, steps } = lesson.buildSteps(opt, inp);
  const clampedStep = Math.max(0, Math.min(steps.length - 1, stepIdx));
  const rawStep = steps[clampedStep];
  const machineKinds = new Set(['printer', 'disc_presser', 'shipper_gate', 'loot_chest', 'kitchen_hatch']);
  // Chỉ máy sản xuất là đích thả; vật trong cảnh chỉ kéo được khi kịch bản gán optId rõ ràng
  const options = lesson.interaction?.options || [];
  const optIds = new Set(options.map((o) => o.id));
  const tags = lesson.codeTags || {};
  const enrichedObjects = (rawStep.objects || []).map((o0) => {
    // Nhãn code gắn lên vật (lớp "Cầu nối"): vật trong cảnh ↔ biểu thức Python tương ứng
    const baseId = String(o0.id).replace(/-dup\d+$/, '');
    const o = o0.code || !tags[baseId] ? o0 : { ...o0, code: tags[baseId] };
    if (machineKinds.has(o.kind)) return { ...o, isDropTarget: true };
    if (o.optId && !optIds.has(o.optId)) {
      const { optId, ...rest } = o;
      return rest;
    }
    return o;
  });

  return {
    lesson,
    optionId: opt,
    input: inp,
    stepIdx: clampedStep,
    totalSteps: steps.length,
    codeLines,
    step: { ...rawStep, objects: enrichedObjects },
  };
}
