/* Lộ trình trên bảng ghim: 10 chặng, toạ độ trong SVG viewBox 1000×600. */
import type { LabelAnchor, Roadmap } from "../types";

const STAGES = ["Tư duy thuật toán", "Biến & kiểu dữ liệu", "Rẽ nhánh", "Vòng lặp", "Hàm", "Mảng một chiều", "Vòng lặp lồng nhau", "Mảng hai chiều", "Đệ quy", "Dự án cuối chặng"];
const NODES: readonly (readonly [number, number])[] = [[90, 470], [200, 380], [150, 250], [285, 150], [420, 215], [470, 360], [610, 420], [700, 270], [820, 175], [905, 330]];
const LBL: readonly (readonly [number, number, LabelAnchor])[] = [
  [118, 477, "start"], [228, 387, "start"], [122, 257, "end"], [285, 118, "middle"], [448, 222, "start"],
  [442, 367, "end"], [640, 476, "end"], [672, 277, "end"], [820, 143, "middle"], [905, 378, "middle"],
];

export const roadmap: Roadmap = {
  course: "C++ Nền tảng",
  current: 6,
  stages: STAGES.map((name, i) => ({ name, node: NODES[i], label: LBL[i] })),
  note: { title: "Chặng 7", chapter: "Vòng lặp lồng nhau", detail: "4/9 bài · còn khoảng 50 phút" },
};
