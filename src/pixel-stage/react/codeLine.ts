// Tiện ích cho dòng code hiển thị phía trên cảnh: tô cú pháp Python tối giản và tìm khối chứa dòng đó.
// Thuần hàm, không phụ thuộc React.

export type TokKind = "kw" | "str" | "num" | "com" | "fn" | "bi" | "txt";
export type Tok = { k: TokKind; t: string };

const KEYWORDS = new Set([
  "and", "as", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield", "None", "True", "False", "self",
]);
const BUILTINS = new Set(["print", "len", "range", "enumerate", "super", "list", "dict", "set", "str", "int", "sum", "min", "max", "sorted", "id"]);

// thứ tự quan trọng: comment, chuỗi (kể cả f-string), số, tên, ký tự còn lại
const RE = /(#.*$)|([rbfuRBFU]{0,2}(?:"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?))|(\b\d+(?:\.\d+)?\b)|([A-Za-z_À-ỹ][\wÀ-ỹ]*)|(\s+|.)/gu;

/** Tách một dòng Python thành các mẩu có loại để tô màu. Nối lại các `t` cho đúng dòng gốc. */
export function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  const push = (k: TokKind, t: string) => {
    const last = out[out.length - 1];
    if (last && last.k === k && k === "txt") last.t += t;
    else out.push({ k, t });
  };
  for (const m of line.matchAll(RE)) {
    const [all, com, str, num, name] = m;
    if (com) push("com", all);
    else if (str) push("str", all);
    else if (num) push("num", all);
    else if (name) {
      const rest = line.slice((m.index ?? 0) + all.length);
      if (KEYWORDS.has(name)) push("kw", name);
      else if (BUILTINS.has(name)) push("bi", name);
      else if (/^\s*\(/.test(rest)) push("fn", name);
      else push("txt", name);
    } else push("txt", all);
  }
  return out;
}

const indentOf = (s: string): number => s.length - s.trimStart().length;
const BLOCK = /^\s*(?:async\s+def|def|class|for|while|if|elif|else|with|try|except|finally)\b/;

/** Dòng mở khối gần nhất bao quanh dòng `n` (1-based), bỏ dấu ":" cuối. Không có thì null. */
export function contextOf(lines: readonly string[], n: number): string | null {
  const target = lines[n - 1];
  if (target === undefined || !target.trim()) return null;
  let ind = indentOf(target);
  for (let i = n - 2; i >= 0 && ind > 0; i--) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    const k = indentOf(ln);
    if (k < ind) {
      if (BLOCK.test(ln)) return ln.trim().replace(/:\s*(#.*)?$/, "");
      ind = k;
    }
  }
  return null;
}

/** Dòng đại diện của một bước: dòng có nội dung đầu tiên trong các dòng được highlight. */
export function leadLine(lines: readonly string[], on: readonly number[]): number | null {
  const sorted = [...on].sort((a, b) => a - b);
  return sorted.find((n) => lines[n - 1]?.trim()) ?? sorted[0] ?? null;
}
