// Ngôn ngữ, mẫu code khởi đầu và lưu cục bộ cho Playground.

export type PlaygroundLang = 'python' | 'web';
export type WebFile = 'html' | 'css' | 'js';

export type PlaygroundDoc = {
  lang: PlaygroundLang;
  python: string;
  html: string;
  css: string;
  js: string;
};

export type Sample = { id: string; label: string; lang: PlaygroundLang; files: Partial<PlaygroundDoc> };

export const LANGS: { id: PlaygroundLang; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'web', label: 'HTML/CSS/JS' },
];

export const WEB_FILES: { id: WebFile; label: string }[] = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS' },
];

export const SAMPLES: Sample[] = [
  {
    id: 'py-hello',
    label: 'Xin chào',
    lang: 'python',
    files: {
      python: 'ten = "bạn"\nprint("xin chào,", ten)\n\nfor i in range(1, 4):\n    print("Lần", i)\n',
    },
  },
  {
    id: 'py-list',
    label: 'Danh sách & vòng lặp',
    lang: 'python',
    files: {
      python:
        'diem = [8, 6.5, 9, 7.5]\n\ntong = 0\nfor d in diem:\n    tong += d\n\nprint("Trung bình:", round(tong / len(diem), 2))\nprint("Cao nhất:", max(diem))\n',
    },
  },
  {
    id: 'py-func',
    label: 'Hàm & lỗi thường gặp',
    lang: 'python',
    files: {
      python:
        'def chia(a, b):\n    return a / b\n\nprint(chia(10, 4))\n# Thử xoá dấu # ở dòng dưới để xem thông báo lỗi:\n# print(chia(1, 0))\n',
    },
  },
  {
    id: 'web-counter',
    label: 'Bộ đếm',
    lang: 'web',
    files: {
      html: '<h1>Bộ đếm</h1>\n<p>Đã bấm: <strong id="so">0</strong> lần</p>\n<button id="nut">Bấm thử</button>\n',
      css: 'body {\n  font-family: system-ui, sans-serif;\n  text-align: center;\n  padding: 2rem;\n}\nbutton {\n  padding: 0.6rem 1.2rem;\n  font-size: 1rem;\n  border-radius: 8px;\n}\n',
      js: 'let dem = 0;\nconst so = document.getElementById("so");\n\ndocument.getElementById("nut").addEventListener("click", () => {\n  dem += 1;\n  so.textContent = dem;\n  console.log("Đã bấm", dem, "lần");\n});\n',
    },
  },
  {
    id: 'web-card',
    label: 'Thẻ giới thiệu',
    lang: 'web',
    files: {
      html: '<article class="the">\n  <h2>Xin chào!</h2>\n  <p>Đây là thẻ đầu tiên của tôi.</p>\n</article>\n',
      css: 'body { font-family: system-ui, sans-serif; padding: 1.5rem; background: #f5f3ff; }\n.the {\n  max-width: 320px;\n  margin: auto;\n  padding: 1.25rem;\n  background: white;\n  border-radius: 16px;\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);\n}\n',
      js: 'console.log("Trang đã sẵn sàng");\n',
    },
  },
];

export const DEFAULT_DOC: PlaygroundDoc = {
  lang: 'python',
  python: 'print("xin chào")\n',
  html: SAMPLES[3].files.html!,
  css: SAMPLES[3].files.css!,
  js: SAMPLES[3].files.js!,
};

// Chừa chỗ cho P-03: khi có API /playground/snippets, đổi khoá theo user hoặc thêm snippetId ở đây.
export const STORAGE_KEY = 'pe-playground-v1';
export const MAX_CODE_LENGTH = 50_000;

export function loadDoc(): PlaygroundDoc {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_DOC;
    const pick = (v: unknown, fallback: string) =>
      typeof v === 'string' ? v.slice(0, MAX_CODE_LENGTH) : fallback;
    return {
      lang: raw.lang === 'web' ? 'web' : 'python',
      python: pick(raw.python, DEFAULT_DOC.python),
      html: pick(raw.html, DEFAULT_DOC.html),
      css: pick(raw.css, DEFAULT_DOC.css),
      js: pick(raw.js, DEFAULT_DOC.js),
    };
  } catch {
    // Bản nháp hỏng / bị chặn lưu trữ không được làm hỏng trang.
    return DEFAULT_DOC;
  }
}

export function saveDoc(doc: PlaygroundDoc): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}
