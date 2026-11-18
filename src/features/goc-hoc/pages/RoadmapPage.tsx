/* Lộ trình: nền bảng ghim, tờ bản đồ ghim 2 đinh, đường nét đứt qua 10 chặng, chỉ đỏ nối các chặng đã qua, ghi chú chặng hiện tại. Port body('roadmap'). */
import { useScene } from "../transitions/SceneContext";
import { goTab, usePages } from "./PagesContext";

export function RoadmapPage() {
  const { data } = usePages();
  const scene = useScene();
  const { stages, current, course, note } = data.roadmap;
  const d = "M" + stages.map((st) => st.node.join(" ")).join(" L ");
  const done = "M" + stages.slice(0, current + 1).map((st) => st.node.join(" ")).join(" L ");
  return (
    <div className="pg">
      <div className="pghead">
        <div>
          <h1>Lộ trình</h1>
          <p>
            {course} · đang ở chặng {current + 1}/{stages.length}
          </p>
        </div>
      </div>
      <div className="paperwrap">
        <div className="board" id="board">
          <div className="paper" id="paper">
            <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
              <path className="path" d={d} id="rpath" />
              <path className="string" id="rstr" d={done} />
              {stages.map(({ name, node: [x, y], label: [lx, ly, an] }, i) => {
                const st = i < current ? "done" : i === current ? "cur" : "next";
                const fill = st === "done" ? "#c8323d" : st === "cur" ? "#e39a4a" : "#b8a88a";
                return (
                  <g key={i} className="node" style={{ transformOrigin: `${x}px ${y}px` }}>
                    {st === "cur" && <circle cx={x} cy={y} r="30" fill="#ffc97a" opacity=".35" />}
                    <circle cx={x} cy={y} r="17" fill={fill} />
                    <text className="num" x={x} y={y + 5.5} textAnchor="middle">
                      {i + 1}
                    </text>
                    <text x={lx} y={ly} textAnchor={an}>
                      {name}
                      {st === "done" ? " ✓" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="note" id="note">
              <b>{note.title}</b>
              {note.chapter}
              <br />
              {note.detail}
              <br />
              <button className="btn" data-tab="learn" onClick={() => goTab(scene, "learn")}>
                Học tiếp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
