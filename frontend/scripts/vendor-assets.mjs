/**
 * Tự host mọi thư viện trước đây tải từ CDN (jsdelivr, cdnjs, Google Fonts,
 * cdn.tailwindcss.com) vào public/static/vendor — để CSP chỉ cần 'self' và
 * không còn bên thứ ba nào chạy script trên trang.
 *
 * Chạy tự động trước `npm run dev` / `npm run build` (predev/prebuild). Thư mục
 * public/static/vendor được sinh ra nên nằm trong .gitignore; phiên bản ghim
 * chính xác trong package.json.
 *
 *   pyodide 0.27.7      → vendor/pyodide/      (chỉ lõi + thư viện chuẩn, ~13 MB)
 *   mermaid, svg-pan-zoom, codemirror 5, canvas-confetti → vendor/<tên>/
 *   Font Awesome 6.4.0  → vendor/fontawesome/  (css + webfonts)
 *   Inter, Plus Jakarta Sans, Fira Code, JetBrains Mono, Poppins → vendor/fonts/fonts.css
 *   Tailwind 3 (thay Play CDN của 3 trang interface / lesson htmlcss / java) → vendor/tailwind/tailwind.css
 */
import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NM = join(ROOT, 'node_modules');
const OUT = join(ROOT, 'public', 'static', 'vendor');
const require = createRequire(import.meta.url);

function copy(from, to) {
  const src = join(NM, from);
  if (!existsSync(src)) throw new Error(`Thiếu ${from} — chạy npm install trong frontend/`);
  const dest = join(OUT, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// --- Pyodide: worker importScripts('/static/vendor/pyodide/pyodide.js')
for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'])
  copy(`pyodide/${f}`, `pyodide/${f}`);

// --- Thư viện JS/CSS của trang legacy
copy('mermaid/dist/mermaid.min.js', 'mermaid/mermaid.min.js');
copy('svg-pan-zoom/dist/svg-pan-zoom.min.js', 'svg-pan-zoom/svg-pan-zoom.min.js');
copy('canvas-confetti/dist/confetti.browser.js', 'canvas-confetti/confetti.browser.js');
copy('codemirror5/lib/codemirror.js', 'codemirror/codemirror.js');
copy('codemirror5/lib/codemirror.css', 'codemirror/codemirror.css');
copy('codemirror5/mode/sql/sql.js', 'codemirror/mode/sql.js');
copy('codemirror5/addon/display/placeholder.js', 'codemirror/addon/placeholder.js');
copy('@fortawesome/fontawesome-free/css/all.min.css', 'fontawesome/css/all.min.css');
copy('@fortawesome/fontawesome-free/webfonts', 'fontawesome/webfonts');

// --- Fonts: gom các @font-face cần dùng thành MỘT file, chỉ subset latin,
// latin-ext và vietnamese (tiếng Việt cần vietnamese), chỉ woff2.
const FONTS = [
  ['inter', [400, 500, 600, 700, 800]],
  ['plus-jakarta-sans', [400, 500, 600, 700, 800]],
  ['fira-code', [400, 500]],
  ['jetbrains-mono', [400, 500, 600, 700]],
  ['poppins', [400, 500, 600, 700, 800]],
];
const KEEP = /-(latin|latin-ext|vietnamese)-\d+-normal\.woff2$/;
let css = '/* Sinh bởi scripts/vendor-assets.mjs — không sửa tay. */\n';
for (const [pkg, weights] of FONTS) {
  for (const w of weights) {
    const src = readFileSync(join(NM, '@fontsource', pkg, `${w}.css`), 'utf8');
    for (const block of src.split(/(?=\/\* )/)) {
      const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
      if (!file || !KEEP.test(file)) continue;
      copy(`@fontsource/${pkg}/files/${file}`, `fonts/${pkg}/${file}`);
      css += block
        .replace(/src:[^;]+;/, `src: url(./${pkg}/${file}) format('woff2');`)
        .trimEnd() + '\n';
    }
  }
}
writeFileSync(join(OUT, 'fonts', 'fonts.css'), css);

// --- Tailwind: build tĩnh đúng cấu hình Play CDN cũ (pages/*.tailwind.js),
// quét markup + JS của 3 trang dùng nó.
const twDir = join(OUT, 'tailwind');
mkdirSync(twDir, { recursive: true });
const config = {
  content: [
    'src/app/(standalone)/interface/page.tsx',
    'src/app/(standalone)/lesson/htmlcss/page.tsx',
    'src/app/(standalone)/lesson/java/page.tsx',
    'public/static/js/pages/interface.inline.js',
    'public/static/js/pages/lesson_htmlcss.inline.js',
    'public/static/js/pages/lesson_java.inline.js',
    'public/static/js/main.js',
  ].map((p) => join(ROOT, p).replace(/\\/g, '/')),
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'Plus Jakarta Sans', 'sans-serif'], mono: ['Fira Code', 'monospace'] },
      colors: { brand: { primary: '#b93ff0', secondary: '#e08cf9', accent: '#34D399', dark: '#4B4B4B' } },
    },
  },
};
const configPath = join(twDir, 'tailwind.config.cjs');
const inputPath = join(twDir, 'input.css');
writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
writeFileSync(inputPath, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(process.execPath, [
  require.resolve('tailwindcss/lib/cli.js'),
  '-c', configPath, '-i', inputPath, '-o', join(twDir, 'tailwind.css'), '--minify',
], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
rmSync(configPath);
rmSync(inputPath);

console.log('✓ vendor-assets: đã tự host pyodide, mermaid, codemirror, confetti, svg-pan-zoom, Font Awesome, fonts, tailwind');
