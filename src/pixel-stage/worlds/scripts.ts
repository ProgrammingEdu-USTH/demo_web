// Các script mẫu, xếp theo thế giới.
import type { WorldId } from "../timeline/types";
import asyncKitchen01 from "./kitchen/scripts/async-kitchen-01.json";
import asyncKitchen02 from "./kitchen/scripts/async-kitchen-02.json";
import threadKitchen01 from "./kitchen/scripts/thread-kitchen-01.json";
import bfsCity01 from "./city/scripts/bfs-city-01.json";
import refMemory01 from "./memory/scripts/ref-memory-01.json";
import gcMemory02 from "./memory/scripts/gc-memory-02.json";
import oopDungeon01 from "./dungeon/scripts/oop-dungeon-01.json";
import loopDj01 from "./dj/scripts/loop-dj-01.json";
import demoBlank01 from "./blank/scripts/demo-blank-01.json";
import varMemory01 from "./memory/scripts/var-memory-01.json";
import ioKitchen01 from "./kitchen/scripts/io-kitchen-01.json";
import funcKitchen01 from "./kitchen/scripts/func-kitchen-01.json";
import reviewKitchen01 from "./kitchen/scripts/review-kitchen-01.json";
import ifDj01 from "./dj/scripts/if-dj-01.json";
import branchDj01 from "./dj/scripts/branch-dj-01.json";
import whileCity01 from "./city/scripts/while-city-01.json";
import dictDungeon01 from "./dungeon/scripts/dict-dungeon-01.json";
import strBlank01 from "./blank/scripts/str-blank-01.json";

export type ScriptEntry = { id: string; world: WorldId; title: string; raw: unknown };

export const SCRIPTS: ScriptEntry[] = [
  { id: "io-kitchen-01", world: "kitchen", title: "input() và print()", raw: ioKitchen01 },
  { id: "func-kitchen-01", world: "kitchen", title: "Hàm: def, tham số, return", raw: funcKitchen01 },
  { id: "review-kitchen-01", world: "kitchen", title: "Ôn tập: hàm + if + for", raw: reviewKitchen01 },
  { id: "async-kitchen-01", world: "kitchen", title: "async/await với gather", raw: asyncKitchen01 },
  { id: "async-kitchen-02", world: "kitchen", title: "await tuần tự (so sánh)", raw: asyncKitchen02 },
  { id: "thread-kitchen-01", world: "kitchen", title: "Threading và Lock", raw: threadKitchen01 },
  { id: "while-city-01", world: "city", title: "Vòng lặp while giao hàng", raw: whileCity01 },
  { id: "bfs-city-01", world: "city", title: "BFS tìm đường giao hàng", raw: bfsCity01 },
  { id: "var-memory-01", world: "memory", title: "Biến và kiểu dữ liệu", raw: varMemory01 },
  { id: "ref-memory-01", world: "memory", title: "Biến, reference và giải phóng", raw: refMemory01 },
  { id: "gc-memory-02", world: "memory", title: "Vòng tham chiếu và bộ GC", raw: gcMemory02 },
  { id: "dict-dungeon-01", world: "dungeon", title: "Dict: khóa và giá trị", raw: dictDungeon01 },
  { id: "oop-dungeon-01", world: "dungeon", title: "Class, object, kế thừa, state machine", raw: oopDungeon01 },
  { id: "if-dj-01", world: "dj", title: "Câu lệnh if", raw: ifDj01 },
  { id: "branch-dj-01", world: "dj", title: "if, elif, else", raw: branchDj01 },
  { id: "loop-dj-01", world: "dj", title: "for, if/elif/else, break", raw: loopDj01 },
  { id: "str-blank-01", world: "blank", title: "Chuỗi: index, len, upper, +", raw: strBlank01 },
  { id: "demo-blank-01", world: "blank", title: "Thử engine", raw: demoBlank01 },
];
