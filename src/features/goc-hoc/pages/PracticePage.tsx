/* Luyện tập: cuốn sổ mở (ảnh notebook-open.webp), trái là gợi ý hôm nay, phải là kho bài; chữ viết tay khớp dòng kẻ bằng cqh.
   #flip là nửa phải của ảnh sổ, lật sang khi trang hiện ra. Port body('practice'). */
import { usePages } from "./PagesContext";

const LEVEL = { e: "Dễ", m: "Vừa" } as const;

export function PracticePage() {
  const { practice: P } = usePages().data;
  return (
    <div className="pg">
      <div className="pghead">
        <div>
          <h1>Luyện tập</h1>
          <p>{P.head}</p>
        </div>
      </div>
      <div className="spread" id="spread">
        <div className="leafp l">
          <h3>Gợi ý hôm nay</h3>
          <ol className="hw">
            {P.suggestions.map((s) => (
              <li key={s.title}>
                {s.title} <span className={`lvl ${s.level}`}>{LEVEL[s.level]}</span>
              </li>
            ))}
          </ol>
          <p className="hw" style={{ marginTop: 12, color: "#8a3f50" }}>
            {P.questNote}
          </p>
        </div>
        <div className="leafp r">
          <h3>Kho bài tập</h3>
          <div className="chips">
            {P.topics.map((t) => (
              <span key={t.name} className={t.active ? "a" : undefined}>
                {t.name}
              </span>
            ))}
          </div>
          <ul className="plist">
            {P.problems.map((p) => (
              <li key={p.title}>
                <span className={`s${p.status ? " " + p.status : ""}`} />
                <span>
                  {p.title}
                  <small>{p.meta}</small>
                </span>
                <span className="x">+{p.xp}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flip" id="flip" />
      </div>
    </div>
  );
}
