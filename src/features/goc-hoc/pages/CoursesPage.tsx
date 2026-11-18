/* Khóa học: mỗi kệ trong phòng là một khoá, mỗi cuốn sách là một bài; thêm 2 khoá chưa có trên kệ. Port body('courses').
   Bấm sách đã mở → Học tiếp bài đó; sách khoá → toast. */
import type { CSSProperties } from "react";
import { coverColor, SHELVES, shelfStats } from "../config/shelves";
import { Icon } from "../hud/Icons";
import { useScene } from "../transitions/SceneContext";
import { usePages } from "./PagesContext";

/** Kích thước gáy sách trên kệ của trang (lặp theo chu kỳ 11 cuốn). */
const BOOK_W = [44, 48, 42, 46, 48, 44, 52, 44, 48, 42, 46];
const BOOK_H = [176, 162, 154, 170, 160, 166, 180, 158, 172, 164, 168];
const LOCKED_COURSE = "Khóa này chưa có trên kệ của bạn. Hoàn thành C++ Nền tảng để mở.";

const size = (w: number, h: number, bg: string) => ({ "--w": `${w}px`, "--h": `${h}px`, background: bg }) as CSSProperties;

export function CoursesPage() {
  const { data, toast } = usePages();
  const scene = useScene();
  return (
    <div className="pg">
      <div className="pghead">
        <div>
          <h1>Khóa học</h1>
          <p>Mỗi kệ trong phòng là một khóa, mỗi cuốn sách là một bài học</p>
        </div>
      </div>
      <div className="lib">
        {data.courses.map((c, ci) => {
          if ("shelf" in c) {
            const S = SHELVES[c.shelf], st = shelfStats(S);
            return (
              <section key={ci} className="course room-course">
                <div className="meta">
                  <h3>{S.name}</h3>
                  <p>{st.sub}</p>
                  <div className="bar">
                    <i style={{ width: `${st.pct}%` }} />
                  </div>
                </div>
                <div className="shelfrow">
                  {S.lessons.map(([title, state], i) => {
                    const k = S.key + i;
                    return (
                      <button
                        key={k}
                        className={`bk${state === "cur" ? " cur" : state === "lock" ? " lock" : ""}`}
                        data-s={c.shelf}
                        data-l={i}
                        data-k={k}
                        style={size(BOOK_W[i % 11], BOOK_H[i % 11], coverColor(k))}
                        aria-label={`Bài ${i + 1}: ${title}`}
                        onClick={() =>
                          state === "lock" ? toast(`${S.short}: học xong Bài ${i} để mở “${title}”`) : scene.sibling("learn", { shelf: c.shelf, lesson: i })
                        }
                      >
                        <span className="no">{state === "lock" ? <Icon name="lock" /> : i + 1}</span>
                        <span className="tt">{title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          }
          return (
            <section key={ci} className={`course${c.locked ? " locked" : ""}`}>
              <div className="meta">
                <h3>{c.name}</h3>
                <p>{c.sub}</p>
                <div className="bar">
                  <i style={{ width: "0%" }} />
                </div>
              </div>
              <div className="shelfrow">
                {c.titles.map((t, i) => (
                  <button
                    key={i}
                    className="bk lock"
                    data-c={ci}
                    style={size(36 + ((i * 7) % 14), 138 + ((i * 13) % 28), c.col[i % c.col.length])}
                    aria-label={`${c.name}: ${t}`}
                    onClick={() => toast(LOCKED_COURSE)}
                  >
                    <span className="no">
                      <Icon name="lock" />
                    </span>
                    <span className="tt">{t}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
