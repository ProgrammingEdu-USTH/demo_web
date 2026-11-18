/* #hint: ô "Hỏi gợi ý…". Chỉ trả lần lượt các câu hỏi gợi mở có sẵn, không bao giờ đưa đáp án. */
"use client";
import { memo, useRef, useState } from "react";
import { animate } from "../anim";
import { Icon } from "./Icons";

export const Hint = memo(function Hint({ questions, rm, inert }: { questions: readonly string[]; rm: boolean; inert: boolean }) {
  const [reply, setReply] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const qi = useRef(0);
  const replyRef = useRef<HTMLDivElement>(null);

  return (
    <div id="hint" className="ui" inert={inert}>
      <div id="reply" className="glass" hidden={reply === null} ref={replyRef} aria-live="polite">
        {reply !== null && (
          <>
            <b>Gợi ý</b>
            <br />
            {reply}
          </>
        )}
      </div>
      <form
        className="glass"
        id="hintForm"
        onSubmit={(e) => {
          e.preventDefault();
          setReply(questions[qi.current++ % questions.length]);
          setValue("");
          // #reply đang hidden thì phải chờ React bỏ hidden mới animate được
          requestAnimationFrame(() =>
            animate(replyRef.current, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 450 }, rm),
          );
        }}
      >
        <Icon name="spark" />
        <input
          id="hintIn"
          placeholder="Hỏi gợi ý…"
          autoComplete="off"
          aria-label="Hỏi gợi ý"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="ib" aria-label="Gửi">
          <Icon name="send" />
        </button>
      </form>
    </div>
  );
});
