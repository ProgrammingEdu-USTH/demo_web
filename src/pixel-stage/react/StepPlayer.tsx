"use client";

// Màn "chạy từng dòng" toàn cảnh: cảnh pixel phủ kín khung chứa, giao diện nổi phía trên.
//  - Trên giữa: dòng code đang chạy (hiện ra khi người dùng tương tác), tô cú pháp, "gõ" ra từng ký tự.
//  - Góc phải trên: nút Chạy / Tạm dừng / Chạy lại, nền đầy dần theo tiến độ cả bài.
//  - Dưới: caption dạng phụ đề, biến, thanh điều khiển (tự ẩn khi đang chạy mà chuột đứng yên).
//  - Ngăn kéo phải: toàn bộ code + bảng biến.
// Phím tắt: ← / → chuyển bước, Space chạy / tạm dừng, C mở / đóng toàn bộ code, Esc đóng ngăn kéo rồi mới đóng màn (nếu có onClose).
// Khung chứa phải có kích thước (ví dụ position: fixed; inset: 0): StepPlayer phủ 100% khung đó.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { PixelStage as Stage } from "../core/stage";
import type { StepEvent } from "../timeline/player";
import { speeds } from "../tokens/motion";
import type { Speed } from "../tokens/motion";
import { playerVars, ui } from "../tokens/ui";
import { contextOf, leadLine, tokenize } from "./codeLine";
import type { Tok } from "./codeLine";
import { PixelStage } from "./PixelStage";
import s from "./StepPlayer.module.css";

type Motion = "auto" | "on" | "off";

export type StepNav = {
  /** ví dụ "Bài 3/11" */
  label: string;
  prev?: () => void;
  next?: () => void;
  prevTitle?: string;
  nextTitle?: string;
};

export type StepPlayerProps = {
  script: unknown;
  /** Tiêu đề góc trái trên (ví dụ tên bài). */
  title?: ReactNode;
  intro?: "pixelate" | "none";
  /** Bật phím tắt toàn cửa sổ (mặc định bật). */
  keyboard?: boolean;
  /** Hiện thêm công tắc giảm chuyển động và lớp hạt (cho trang demo). */
  devToggles?: boolean;
  /** Giảm chuyển động do trang chứa quyết định (khi không bật devToggles). Mặc định theo hệ thống. */
  reducedMotion?: boolean | "auto";
  /** Có thì hiện nút đóng và Esc sẽ gọi hàm này. */
  onClose?: () => void;
  closeLabel?: string;
  /** Nhận API của stage khi tạo (và null khi huỷ). */
  onStage?: (stage: Stage | null) => void;
  /** Phần tử chèn vào góc trái trên, sau tiêu đề (ví dụ ô chọn bài mẫu). */
  toolbar?: ReactNode;
  /** Chuyển bài trong một khóa: ‹ nhãn › ở góc trái trên. Ở bước cuối, nút bài sau sáng lên gợi ý. */
  nav?: StepNav;
  className?: string;
};

const THEME = playerVars as CSSProperties;
const codeOf = (raw: unknown): string => (raw as { code?: string })?.code ?? "";
const rangeLabel = (on: number[]): string => {
  if (!on.length) return "";
  const a = Math.min(...on), b = Math.max(...on);
  return a === b ? `dòng ${a}` : on.length === b - a + 1 ? `dòng ${a}–${b}` : `dòng ${[...on].sort((x, y) => x - y).join(", ")}`;
};

function Code({ toks }: { toks: Tok[] }) {
  return (
    <>
      {toks.map((t, i) => (t.k === "txt" ? t.t : <span key={i} className={s[t.k]}>{t.t}</span>))}
    </>
  );
}

export function StepPlayer({ script, title, intro = "none", keyboard = true, devToggles = false, reducedMotion = "auto", onClose, closeLabel = "Đóng", onStage, toolbar, nav, className }: StepPlayerProps) {
  const stage = useRef<Stage | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const codeBox = useRef<HTMLPreElement>(null);
  const [step, setStep] = useState<StepEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [motion, setMotion] = useState<Motion>("auto");
  const [overlay, setOverlay] = useState(true);
  const [sound, setSound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  // dòng code phía trên chỉ hiện sau khi người dùng tương tác với đúng script đang mở (đổi bài thì ẩn lại)
  const [shownFor, setShownFor] = useState<unknown>(null);
  const revealed = shownFor === script;
  const lastAct = useRef(0);

  // giữ bản mới nhất cho các trình nghe sự kiện gắn một lần
  const latest = useRef({ onClose, onStage, script, drawer, settings });
  useEffect(() => {
    latest.current = { onClose, onStage, script, drawer, settings };
  });
  const setStage = (st: Stage | null) => {
    stage.current = st;
    latest.current.onStage?.(st);
  };
  const poke = () => {
    lastAct.current = performance.now();
  };
  const reveal = () => {
    poke();
    setShownFor(latest.current.script);
  };
  /** Thao tác của người dùng: hiện dòng code rồi làm việc cần làm. */
  const act = (fn: (st: Stage) => void) => {
    const st = stage.current;
    if (!st) return;
    reveal();
    fn(st);
  };
  const run = () =>
    act((st) => {
      if (st.state.playing) return st.pause();
      // lần đầu bấm Chạy: phát lại bước đầu để dòng code và cảnh đi cùng nhau từ đầu
      if (!revealed && st.state.index === 0) st.goTo(0);
      st.play();
    });

  // phím tắt
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const L = latest.current;
      poke();
      if (e.key === "Escape") {
        // bắt ở pha capture để Esc chỉ đóng lớp trên cùng, không đóng luôn trang phía dưới
        if (L.settings || L.drawer) {
          e.preventDefault();
          e.stopPropagation();
          setSettings(false);
          setDrawer(false);
        } else if (L.onClose) {
          e.preventDefault();
          e.stopPropagation();
          L.onClose();
        }
        return;
      }
      if (t?.closest("input, select, textarea") || e.altKey || e.ctrlKey || e.metaKey) return;
      const st = stage.current;
      if (!st) return;
      if (e.key === "ArrowRight") { e.preventDefault(); reveal(); st.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); reveal(); st.prev(); }
      else if (e.key === " ") { e.preventDefault(); runRef.current(); }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); setDrawer((v) => !v); }
    };
    // Space luôn là Chạy / Tạm dừng, kể cả khi đang focus một nút khác
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && (e.target as HTMLElement | null)?.closest("button")) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp);
    };
    // reveal / poke chỉ đọc ref và setState nên không cần gắn lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard]);

  // mỗi khung: tiến độ (thanh bước, nút Chạy), trạng thái rảnh tay (ẩn điều khiển), giảm chuyển động.
  // Ghi thẳng vào biến CSS / data-* nên không render lại React 60 lần mỗi giây.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = root.current, st = stage.current;
      if (!el || !st) return;
      const S = st.state;
      if (!S.count) return;
      el.style.setProperty("--ps-p", S.progress.toFixed(4));
      el.style.setProperty("--ps-total", ((S.index + S.progress) / S.count).toFixed(4));
      const idle = String(S.playing && performance.now() - lastAct.current > ui.idleHide);
      if (el.dataset.idle !== idle) el.dataset.idle = idle;
      const rm = String(S.reduced);
      if (el.dataset.rm !== rm) el.dataset.rm = rm;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ngăn kéo code: cuộn tới dòng đang chạy
  useEffect(() => {
    if (!drawer) return;
    codeBox.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [drawer, step]);

  const lines = codeOf(script).split("\n");
  const on = step?.line ?? [];
  const active = new Set(on);
  const vars = Object.entries(step?.vars ?? {});
  const lead = leadLine(lines, on);
  const leadText = lead ? (lines[lead - 1] ?? "").trim() : "";
  const ctx = lead ? contextOf(lines, lead) : null;
  const extra = on.length - 1;
  const typeMs = Math.min(ui.typeMax, leadText.length * ui.typePerChar);
  const atEnd = !!step && step.index >= step.count - 1;
  const runLabel = playing ? "Tạm dừng" : atEnd && revealed ? "Chạy lại" : "Chạy";
  const st = () => stage.current;

  return (
    <div
      ref={root}
      className={`${s.player} ${className ?? ""}`}
      style={THEME}
      data-revealed={revealed}
      data-drawer={drawer}
      onPointerMove={poke}
      onPointerDown={(e) => {
        // bấm vào cảnh cũng là tương tác: hiện dòng code
        if ((e.target as HTMLElement).tagName === "CANVAS") reveal();
        else poke();
      }}
    >
      <PixelStage
        script={script}
        seed={42}
        speed={speed}
        overlay={overlay}
        reducedMotion={devToggles ? (motion === "auto" ? "auto" : motion === "on") : reducedMotion}
        sound={sound}
        intro={intro}
        fill="extend"
        ref={setStage}
        className={s.canvas}
        onStep={setStep}
        onPlay={(p) => {
          setPlaying(p);
          if (p) reveal();
        }}
        onReady={() => setError(null)}
        onError={(e) => setError(e.message)}
      />

      {/* ───────── trên: tiêu đề · dòng code · nút Chạy ───────── */}
      <header className={s.top}>
        <div className={s.left}>
          {onClose ? (
            <button type="button" className={`${s.btn} ${s.close}`} onClick={onClose} aria-label={`${closeLabel} (phím Esc)`}>
              <span aria-hidden="true">←</span> {closeLabel}
            </button>
          ) : null}
          {title ? <h2 className={s.title}>{title}</h2> : null}
          {toolbar}
          {nav ? (
            <div className={s.nav} role="group" aria-label="Chuyển bài">
              <button type="button" className={s.btn} onClick={nav.prev} disabled={!nav.prev} aria-label={nav.prevTitle ? `Bài trước: ${nav.prevTitle}` : "Bài trước"} title={nav.prevTitle}>
                ‹
              </button>
              <span className={s.navLabel} data-testid="lesson-label">{nav.label}</span>
              <button
                type="button"
                className={`${s.btn} ${s.navNext}`}
                onClick={nav.next}
                disabled={!nav.next}
                data-hot={!!nav.next && atEnd && revealed && !playing}
                aria-label={nav.nextTitle ? `Bài sau: ${nav.nextTitle}` : "Bài sau"}
                title={nav.nextTitle}
              >
                Bài sau ›
              </button>
            </div>
          ) : null}
        </div>

        <div className={s.center}>
          {revealed && step && lead ? (
            <button
              key={`${step.index}:${lead}`}
              type="button"
              className={s.codeLine}
              onClick={() => { poke(); setDrawer(true); }}
              data-testid="code-line"
              data-lines={on.join(",")}
              title="Xem toàn bộ code (phím C)"
              style={{ "--type": `${typeMs}ms`, "--n": Math.max(1, leadText.length) } as CSSProperties}
            >
              {ctx ? <span className={s.ctx}>{ctx} <span aria-hidden="true">›</span></span> : null}
              <span className={s.ln}>{rangeLabel(on)}</span>
              <code className={s.src}>
                <span className={s.typed}><Code toks={tokenize(leadText)} /></span>
                <span className={s.caret} aria-hidden="true" />
              </code>
              {extra > 0 ? <span className={s.more}>+{extra} dòng</span> : null}
            </button>
          ) : (
            <p className={s.hint} data-testid="code-hint">
              Bấm <b>Chạy</b> hoặc phím <kbd>→</kbd> để xem code chạy từng dòng
            </p>
          )}
          {error ? <p className={s.error} role="alert">{error}</p> : null}
        </div>

        <div className={s.right}>
          <button
            type="button"
            className={s.run}
            onClick={run}
            aria-pressed={playing}
            data-testid="run"
            title={`${runLabel} (phím Space)`}
            disabled={!step}
          >
            <span className={s.runFill} aria-hidden="true" />
            <span className={s.runIcon} aria-hidden="true">{playing ? "❚❚" : atEnd && revealed ? "↻" : "▶"}</span>
            <span className={s.runText}>{runLabel}</span>
          </button>
        </div>
      </header>

      {/* ───────── dưới: biến · caption · điều khiển ───────── */}
      <footer className={s.bottom}>
        {revealed && vars.length ? (
          <ul className={s.vars} aria-label="Biến ở bước này">
            {vars.map(([k, v]) => (
              <li key={k}><b>{k}</b> = {v}</li>
            ))}
          </ul>
        ) : null}
        <p className={s.caption} aria-live="polite" data-testid="caption" data-empty={!step?.caption}>
          <span key={step?.index ?? -1} className={s.capText}>{step?.caption ?? ""}</span>
        </p>

        <div className={s.controls} role="group" aria-label="Điều khiển">
          <button type="button" className={s.btn} onClick={() => act((x) => x.prev())} disabled={!step || step.index === 0} aria-label="Bước trước (phím ←)">◀</button>
          <div className={s.dots}>
            {Array.from({ length: step?.count ?? 0 }, (_, k) => (
              <button
                key={k}
                type="button"
                className={s.dot}
                data-state={k < (step?.index ?? 0) ? "done" : k === step?.index ? "now" : "todo"}
                aria-current={k === step?.index ? "step" : undefined}
                aria-label={`Tới bước ${k + 1}`}
                onClick={() => act((x) => x.goTo(k))}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" className={s.btn} onClick={() => act((x) => x.next())} disabled={!step || atEnd} aria-label="Bước sau (phím →)">▶</button>
          <span className={s.count} data-testid="step-count">{step ? `Bước ${step.index + 1}/${step.count}` : "…"}</span>

          <span className={s.sep} aria-hidden="true" />
          <div className={s.seg} role="group" aria-label="Tốc độ">
            {speeds.map((v) => (
              <button key={v} type="button" className={s.btn} aria-pressed={speed === v} onClick={() => setSpeed(v)} aria-label={`Tốc độ ×${v}`}>×{v}</button>
            ))}
          </div>
          <button
            type="button"
            className={s.btn}
            aria-pressed={sound}
            aria-label="Âm thanh"
            title="Âm thanh"
            onClick={() => {
              // bật trong chính sự kiện click để trình duyệt cho phép phát âm thanh
              st()?.setSound(!sound);
              setSound(!sound);
            }}
          >
            ♪
          </button>
          <button type="button" className={s.btn} aria-pressed={drawer} aria-controls="ps-code-drawer" onClick={() => setDrawer((v) => !v)} title="Toàn bộ code (phím C)">
            {"</>"} Code
          </button>
          {devToggles ? (
            <div className={s.popWrap}>
              <button type="button" className={s.btn} aria-expanded={settings} aria-label="Tuỳ chọn hiển thị" onClick={() => setSettings((v) => !v)}>⚙</button>
              {settings ? (
                <div className={s.pop} role="group" aria-label="Tuỳ chọn hiển thị">
                  <label className={s.field}>
                    <span>Giảm chuyển động</span>
                    <select value={motion} onChange={(e) => setMotion(e.target.value as Motion)}>
                      <option value="auto">Theo hệ thống</option>
                      <option value="on">Bật</option>
                      <option value="off">Tắt</option>
                    </select>
                  </label>
                  <label className={s.check}>
                    <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                    <span>Lớp hạt + viền tối</span>
                  </label>
                  <p className={s.keys}>← / → chuyển bước · Space chạy · C code{onClose ? " · Esc đóng" : ""}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </footer>

      {/* ───────── ngăn kéo: toàn bộ code ───────── */}
      <aside id="ps-code-drawer" className={s.drawer} data-open={drawer} inert={!drawer} aria-label="Toàn bộ code">
        <div className={s.drawerHead}>
          <h3 className={s.h3}>Code (Python)</h3>
          <button type="button" className={s.btn} onClick={() => setDrawer(false)} aria-label="Đóng toàn bộ code">✕</button>
        </div>
        <pre ref={codeBox} className={s.code} aria-label="Code bài học">
          {lines.map((ln, i) => (
            <span key={i} className={active.has(i + 1) ? `${s.line} ${s.on}` : s.line} data-line={i + 1} aria-current={active.has(i + 1) ? "true" : undefined}>
              <span className={s.no} aria-hidden="true">{i + 1}</span>
              {ln ? <Code toks={tokenize(ln)} /> : " "}
            </span>
          ))}
        </pre>
        <h3 className={s.h3}>Biến</h3>
        {vars.length ? (
          <table className={s.varTable}>
            <tbody>
              {vars.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={s.muted}>Chưa có biến ở bước này.</p>
        )}
      </aside>
    </div>
  );
}
