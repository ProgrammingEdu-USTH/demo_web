// Tiêu chí nghiệm thu 3 (spec Pixel Motion): không có màu hex hay thời lượng ghi cứng ngoài src/pixel-stage/tokens/.
//   node scripts/check-pixel-tokens.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = "src/pixel-stage";
const SKIP = join(ROOT, "tokens");
const RULES = [
  { name: "màu hex", re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g },
  { name: "màu rgb()/hsl()", re: /\b(?:rgba?|hsla?)\s*\(/g },
  { name: "thời lượng ms/s", re: /\b\d+(?:\.\d+)?\s*m?s\b(?!\w)/g, ext: [".css"] },
  { name: "thời lượng ms trong script", re: /"ms"\s*:/g, ext: [".json"] },
  { name: "setTimeout/setInterval", re: /\bset(?:Timeout|Interval)\s*\(/g, ext: [".ts", ".tsx"] },
  { name: "chữ số kèm ms", re: /\b\d{2,}\s*\/\*\s*ms|\b\d{2,}ms\b/g, ext: [".ts", ".tsx"] },
];

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (p !== SKIP) walk(p); }
    else if (/\.(tsx?|css|json)$/.test(n)) files.push(p);
  }
})(ROOT);

const problems = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const ext = f.slice(f.lastIndexOf("."));
  for (const r of RULES) {
    if (r.ext && !r.ext.includes(ext)) continue;
    for (const m of src.matchAll(r.re)) {
      const line = src.slice(0, m.index).split("\n").length;
      problems.push(`${relative(".", f).split(sep).join("/")}:${line}  ${r.name}: ${m[0]}`);
    }
  }
}

if (problems.length) {
  console.error(`Có ${problems.length} giá trị ghi cứng ngoài tokens/:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`OK: ${files.length} file trong ${ROOT} (trừ tokens/) không có màu hex hay thời lượng ghi cứng.`);
