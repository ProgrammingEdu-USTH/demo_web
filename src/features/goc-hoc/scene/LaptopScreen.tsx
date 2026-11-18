/* Màn hình laptop: editor code giả gắn vào 4 góc màn hình trong ảnh laptop, tự gõ code bài đang học (renderS + typeS). */
import { Fragment, memo, type ReactNode } from "react";
import { useLaptopTyping } from "../ambient/useLaptopTyping";
import { LAPTOP_SCREEN } from "../config/scene";
import type { CodeToken } from "../types";
import { quadMatrix } from "./geometry";

const SCREEN_W = 560;
const SCREEN_H = 350;
const SCREEN_TRANSFORM = quadMatrix(SCREEN_W, SCREEN_H, LAPTOP_SCREEN);

interface Props {
  code: readonly (readonly CodeToken[])[];
  file: string;
  caption: string;
  /** Dừng gõ (giảm chuyển động, tab ẩn, đang ở trang con) */
  paused: boolean;
}

function Tokens({ line, limit = Infinity }: { line: readonly CodeToken[]; limit?: number }) {
  let left = limit;
  const out: ReactNode[] = [];
  for (const [i, [c, t]] of line.entries()) {
    if (left <= 0) break;
    const part = t.slice(0, left);
    left -= part.length;
    out.push(c ? <span key={i} className={c}>{part}</span> : part);
  }
  return <>{out}</>;
}

export const LaptopScreen = memo(function LaptopScreen({ code, file, caption, paused }: Props) {
  // sl: số dòng đã gõ xong, sc: số ký tự của dòng đang gõ
  const { sl: typedLines, sc: typedChars } = useLaptopTyping(code, paused);
  return (
    <div id="screenWrap" aria-hidden="true" style={{ transform: SCREEN_TRANSFORM }}>
      <div id="screenGlow" />
      <div id="screen">
        <div className="sbar">
          <i />
          <i />
          <i />
          <b>{file}</b>
          <span>{caption}</span>
        </div>
        <div className="sed">
          <div className="sgut" id="sgut">
            {code.map((_, i) => i + 1).join("\n")}
          </div>
          <pre id="scode">
            {code.map((line, i) =>
              i < typedLines ? (
                <Fragment key={i}>
                  <Tokens line={line} />
                  {"\n"}
                </Fragment>
              ) : i === typedLines ? (
                <Fragment key={i}>
                  <Tokens line={line} limit={typedChars} />
                  <span className="scur" />
                  {"\n"}
                </Fragment>
              ) : null,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
});
