/* Học tiếp: cột bài học (lý thuyết, "Thử suy nghĩ", tiến độ) + editor (code, Chạy thử, kết quả). Port body('learn').
   Kệ C++ dùng LESSON_BODY, các kệ khác dùng GENERIC (đã gộp sẵn trong data.lessonBodies).
   Khóa Python (kệ 1): mỗi bài là một cảnh motion toàn màn hình (Pixel Stage), mở ngay khi trang hiện xong;
   chuyển bài ‹ › ngay trong cảnh, nút "Góc học" / Esc về phòng.
   Đoạn văn và code là HTML tô màu sẵn từ mock (nội dung cố định, không đến từ người dùng). */
import { useEffect, useRef, useState } from "react";
import { transition } from "@/pixel-stage/tokens/motion";
import { animate } from "../anim";
import { SHELVES } from "../config/shelves";
import { StepRunner } from "./StepRunner";
import { Icon } from "../hud/Icons";
import type { GoOpts } from "../targets";
import { usePages } from "./PagesContext";
import { useScene } from "../transitions/SceneContext";

/** Kệ có bài học dạng motion thay cho lý thuyết + editor. */
const MOTION_SHELF = 1;

const LINE_MS = 240;

export function LearnPage({ opts }: { opts: GoOpts }) {
  const { data, rm } = usePages();
  const scene = useScene();
  const s = opts.shelf ?? 0;
  const li = opts.lesson ?? 3;
  const S = SHELVES[s];
  const L = data.lessonBodies[`${s}:${li}`];
  const [lessonTitle, state] = S.lessons[li];
  const n = S.lessons.length;

  /* Chạy thử: in kết quả từng dòng */
  const [out, setOut] = useState("");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const run = () => {
    timers.current.forEach(window.clearTimeout);
    setOut("");
    timers.current = (L?.out ?? []).map((line, i) => window.setTimeout(() => setOut((o) => o + line + "\n"), rm ? 0 : i * LINE_MS));
  };

  /* Chạy từng dòng (Pixel Stage): editor phóng lên và mờ đi như đi vào màn hình, rồi thế giới pixel hiện ra (pixelate) */
  const [runner, setRunner] = useState(false);
  const edx = useRef<HTMLDivElement>(null);
  const stepBtn = useRef<HTMLButtonElement>(null);
  const openRunner = async () => {
    await animate(edx.current, [{ transform: "none", opacity: 1 }, { transform: "scale(1.06)", opacity: 0 }], { duration: transition.zoom, fill: "forwards" }, rm)?.finished;
    setRunner(true);
  };
  const runnerClosed = () => {
    setRunner(false);
    animate(edx.current, [{ transform: "scale(1.06)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: transition.zoom, fill: "forwards" }, rm);
  };
  // trả focus về nút sau khi hộp thoại đã gỡ (lúc đó #app mới hết inert)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (runner) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      stepBtn.current?.focus({ preventScroll: true });
    }
  }, [runner]);

  /* Thử suy nghĩ */
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === data.quiz.answer;

  if (!L) return null;

  if (s === MOTION_SHELF) {
    // chuyển bài trong cảnh dùng updateOpts (không chuyển trang) nên đọc bài hiện tại từ scene
    const cur = scene.route === "learn" ? (scene.opts.lesson ?? li) : li;
    const B = data.lessonBodies[`${s}:${cur}`];
    const titleOf = (i: number) => S.lessons[i]?.[0];
    const go = (i: number) => () => scene.updateOpts({ shelf: s, lesson: i });
    return (
      <div className="pg">
        <div className="lesson" id="lesson">
          <div className="lx">
            <div className="eyebrow">{`${S.name} · Bài ${cur + 1}/${n}`}</div>
            <h2>{titleOf(cur)}</h2>
            <p>Bài học dạng cảnh pixel: code chạy từng dòng, mỗi dòng là một hành động trong cảnh.</p>
          </div>
        </div>
        {/* mở sau khi hiệu ứng vào trang chạy xong; khi về phòng (busy) thì gỡ */}
        {!scene.busy && B?.stepScript && (
          <StepRunner
            scriptId={B.stepScript.id}
            title={`Bài ${cur + 1}. ${B.stepScript.title}`}
            rm={rm}
            closeLabel="Góc học"
            onClosed={scene.back}
            nav={{
              label: `Bài ${cur + 1}/${n}`,
              prev: cur > 0 ? go(cur - 1) : undefined,
              next: cur < n - 1 ? go(cur + 1) : undefined,
              prevTitle: titleOf(cur - 1),
              nextTitle: titleOf(cur + 1),
            }}
          />
        )}
      </div>
    );
  }
  const lines = L.codeHtml.split("\n").length;
  const eyebrow = s === 0 ? `${S.chap} · Bài ${li + 1}/${n}` : `${S.name} · Bài ${li + 1}/${n}`;
  const file = L.file ?? `bai_${li + 1}.cpp`;

  return (
    <div className="pg">
      <div className="lesson" id="lesson">
        <div className="lx">
          <div className="eyebrow">{eyebrow}</div>
          <h2>{lessonTitle}</h2>
          {state === "done" && (
            <p>
              <span className="done-chip">
                <Icon name="check" />
                Đã học · đang ôn lại
              </span>
            </p>
          )}
          {L.paragraphsHtml.map((t, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: t }} />
          ))}
          {L.quiz && (
            <div className="think">
              <b>{data.quiz.title}</b>
              <p dangerouslySetInnerHTML={{ __html: data.quiz.questionHtml }} />
              <div className="opts">
                {data.quiz.options.map((a) => (
                  <button key={a} className={`opt${picked === a ? (ok ? " ok" : " no") : ""}`} data-a={a} onClick={() => setPicked(a)}>
                    {a}
                  </button>
                ))}
              </div>
              <p id="fb">{picked === null ? "" : ok ? data.quiz.right : data.quiz.wrong}</p>
            </div>
          )}
          <div className="dots">
            {S.lessons.map((x, i) => (
              <i key={i} className={x[1] === "done" ? "d" : x[1] === "cur" ? "c" : ""} />
            ))}
            <span>
              Bài {li + 1}/{n}
            </span>
          </div>
        </div>
        <div className="edx" ref={edx}>
          <div className="bar">
            <b>{file}</b>
            {L.stepScript && (
              <button className="btn steprun" id="steprun" ref={stepBtn} onClick={openRunner} title={L.stepScript.title}>
                <Icon name="spark" />
                Chạy từng dòng
              </button>
            )}
            <button className="btn run" id="run" onClick={run}>
              <Icon name="play" />
              Chạy thử
            </button>
          </div>
          <div className="code">
            <div className="gut">{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</div>
            <pre dangerouslySetInnerHTML={{ __html: L.codeHtml }} />
          </div>
          <div className="out">
            <small>Kết quả</small>
            <pre id="outp">{out}</pre>
          </div>
        </div>
      </div>
      {runner && L.stepScript && <StepRunner scriptId={L.stepScript.id} title={L.stepScript.title} rm={rm} onClosed={runnerClosed} />}
    </div>
  );
}
