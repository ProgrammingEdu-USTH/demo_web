// Tách các model 3D cần cho hiệu ứng PICK (cúp, huy chương, sách trên giá) ra khỏi room.glb của dự án PE-3d.
//
//   node scripts/extract-3d-props.mjs <thư-mục-assets-PE-3d> [thư-mục-đích]
//   ví dụ: node scripts/extract-3d-props.mjs D:/EDU/PE-3d/web/public/assets
//
// Không cần Blender hay thư viện ngoài: đọc GLB, chép nguyên byte hình học (POSITION, TEXCOORD_0, indices) của từng
// node được chọn, giữ nguyên tên node và toạ độ trong phòng (để chiếu khớp lên ảnh vẽ bằng camera-2d.json),
// gắn vật liệu unlit dùng atlas bake props_day.webp (EXT_texture_webp). Kèm props_lamp.webp + camera-2d.json để
// shader trộn ngày / đèn như pick3d.js, và một manifest JSON khoá item -> node.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = process.argv[2];
const OUT = resolve(process.argv[3] ?? "public/goc-hoc/models");
if (!SRC) {
  console.error("Thiếu đường dẫn: node scripts/extract-3d-props.mjs <thư-mục-assets-PE-3d> [thư-mục-đích]");
  process.exit(1);
}

// khoá item trong src/features/goc-hoc/config -> tên node trong room.glb (cùng quy tắc NODE() của pick3d.js)
const TROPHIES = ["cupTop", "cupLow", "medalTop", "medalLow", "medalHang"];
const BOOKS = [
  ...Array.from({ length: 9 }, (_, i) => `book${i}`),
  ...Array.from({ length: 11 }, (_, i) => `pb${i}`),
  ...Array.from({ length: 8 }, (_, i) => `tb${i}`),
];
const nodeName = (k) =>
  TROPHIES.includes(k) ? "Interactive_Trophy_" + k[0].toUpperCase() + k.slice(1) : "Interactive_Book_" + k;
const KEYS = [...TROPHIES, ...BOOKS];

/* ---------- đọc GLB ---------- */
function readGlb(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} không phải GLB`);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

const { json: src, bin: srcBin } = readGlb(join(SRC, "room.glb"));
const byName = new Map(src.nodes.map((n, i) => [n.name, i]));

/* ---------- dựng GLB mới ---------- */
const chunks = [];
let binLen = 0;
const pushBytes = (bytes) => {
  const pad = (4 - (binLen % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); binLen += pad; }
  const at = binLen;
  chunks.push(Buffer.from(bytes));
  binLen += bytes.length;
  return at;
};

const out = {
  asset: { version: "2.0", generator: "goc-hoc extract-3d-props (từ " + (src.asset.generator ?? "room.glb") + ")" },
  extensionsUsed: ["KHR_materials_unlit", "EXT_texture_webp"],
  extensionsRequired: ["EXT_texture_webp"],
  scene: 0,
  scenes: [{ name: "ShelfProps", nodes: [] }],
  nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [],
  images: [], textures: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  materials: [{
    name: "PropsBakeDay",
    pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
    extensions: { KHR_materials_unlit: {} },
  }],
};

function copyAccessor(ai) {
  const a = src.accessors[ai], bv = src.bufferViews[a.bufferView];
  if (bv.byteStride) throw new Error("Không hỗ trợ bufferView có byteStride");
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const comp = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const len = a.count * comp * n;
  const at = pushBytes(srcBin.subarray(start, start + len));
  out.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: len, ...(bv.target ? { target: bv.target } : {}) });
  const { byteOffset: _drop, ...rest } = a;
  void _drop;
  out.accessors.push({ ...rest, bufferView: out.bufferViews.length - 1 });
  return out.accessors.length - 1;
}

// khung bao trong toạ độ phòng (glTF Y-up, mét) cho manifest
function worldBox(node, posAcc) {
  const a = src.accessors[posAcc], t = node.translation ?? [0, 0, 0];
  if (node.rotation || node.scale) return null;
  return { min: a.min.map((v, i) => +(v + t[i]).toFixed(4)), max: a.max.map((v, i) => +(v + t[i]).toFixed(4)) };
}

const manifest = {
  source: "PE-3d/web/public/assets/room.glb",
  coords: "glTF Y-up, mét, cùng hệ toạ độ với camera-2d.json (đổi Blender (x,y,z) -> three (x,z,-y))",
  textures: { day: "props_day.webp", lamp: "props_lamp.webp", uv: "TEXCOORD_0, flipY = false" },
  normals: "không có: tính khi tải (computeVertexNormals) như pick3d.js",
  items: {},
};

for (const k of KEYS) {
  const name = nodeName(k);
  const ni = byName.get(name);
  if (ni === undefined) throw new Error(`Không thấy node ${name} trong room.glb`);
  const n = src.nodes[ni], m = src.meshes[n.mesh];
  const prims = m.primitives.map((p) => {
    const attributes = {};
    for (const [key, acc] of Object.entries(p.attributes)) attributes[key] = copyAccessor(acc);
    return { attributes, ...(p.indices !== undefined ? { indices: copyAccessor(p.indices) } : {}), material: 0 };
  });
  out.meshes.push({ name: m.name, primitives: prims });
  const node = { name, mesh: out.meshes.length - 1, extras: { key: k, kind: TROPHIES.includes(k) ? "trophy" : "book" } };
  for (const f of ["translation", "rotation", "scale"]) if (n[f]) node[f] = n[f];
  out.nodes.push(node);
  out.scenes[0].nodes.push(out.nodes.length - 1);
  manifest.items[k] = {
    node: name,
    kind: node.extras.kind,
    vertices: src.accessors[m.primitives[0].attributes.POSITION].count,
    box: worldBox(n, m.primitives[0].attributes.POSITION),
  };
}

// atlas ngày nhúng vào GLB để mở được ở mọi viewer hỗ trợ WebP
const webp = readFileSync(join(SRC, "props_day.webp"));
const imgAt = pushBytes(webp);
out.bufferViews.push({ buffer: 0, byteOffset: imgAt, byteLength: webp.length });
out.images.push({ name: "props_day", mimeType: "image/webp", bufferView: out.bufferViews.length - 1 });
out.textures.push({ sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } });

const binPad = (4 - (binLen % 4)) % 4;
const bin = Buffer.concat([...chunks, Buffer.alloc(binPad)]);
out.buffers.push({ byteLength: bin.length });
let jsonBuf = Buffer.from(JSON.stringify(out), "utf8");
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
const chunkHead = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "shelf-props.glb"), Buffer.concat([
  header, chunkHead(jsonBuf.length, 0x4e4f534a), jsonBuf, chunkHead(bin.length, 0x004e4942), bin,
]));
writeFileSync(join(OUT, "shelf-props.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const f of ["props_day.webp", "props_lamp.webp", "camera-2d.json"]) copyFileSync(join(SRC, f), join(OUT, f));

console.log(`Đã ghi ${KEYS.length} model (${TROPHIES.length} cúp/huy chương, ${BOOKS.length} sách) vào ${OUT}`);
