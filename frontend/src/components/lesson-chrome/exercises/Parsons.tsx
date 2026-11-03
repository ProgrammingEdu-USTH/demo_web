// Dịch từ màn Stitch "5. PARSONS — Ghép & Thụt lề mã". Bản gốc kéo-thả tự do
// theo toạ độ + căn thụt lề bằng tay; ở đây đơn giản hoá thành "bấm để nối
// tiếp vào cuối khối mã đang lắp" — vẫn giữ đúng ý: chọn đúng dòng, bỏ qua
// dòng gây nhiễu, thứ tự do người học quyết định qua thứ tự bấm.
import styles from './exercises.module.css';

export interface ParsonsPoolItem {
  id: string;
  content: React.ReactNode;
  /** Dòng nhiễu — cố tình sai cú pháp/logic, không nên được chọn. */
  distractorReason?: string;
}

export interface ParsonsLine {
  id: string;
  content: React.ReactNode;
  indent: number;
  /** Dòng có sẵn (phần đầu/đuôi cố định của chương trình) — tô mờ. */
  fixed?: boolean;
}

export interface ParsonsProps {
  filename?: string;
  builtLines: ParsonsLine[];
  /** Phần cuối chương trình có sẵn, hiện SAU ô "bấm để nối tiếp". */
  tailLines?: ParsonsLine[];
  pool: ParsonsPoolItem[];
  onPick: (id: string) => void;
  onAttemptDistractor: (id: string) => void;
  /**
   * Có truyền thì nhãn "Nhiễu: lý do" chỉ hiện cho dòng nhiễu đã bấm nhầm
   * (dạng game); không truyền thì hiện ngay như bản demo.
   */
  revealed?: string[];
}

// Thụt lề theo cấp: class phải viết nguyên văn để Tailwind quét được.
const INDENT_CLS = ['![padding-left:0px]', '![padding-left:20px]', '![padding-left:40px]', '![padding-left:60px]', '![padding-left:80px]', '![padding-left:100px]', '![padding-left:120px]'];

function Line({ line, num }: { line: ParsonsLine; num: number }) {
  return (
    <div
      className={`${styles.codeLine} ${INDENT_CLS[Math.min(line.indent, INDENT_CLS.length - 1)]} ${line.fixed ? '![opacity:0.55]' : ''}`}
    >
      <span className={styles.lineNum}>{num}</span>
      <span className={styles.codeText}>{line.content}</span>
    </div>
  );
}

export default function Parsons({
  filename,
  builtLines,
  tailLines = [],
  pool,
  onPick,
  onAttemptDistractor,
  revealed,
}: ParsonsProps) {
  return (
    <div>
      <div className={styles.codeCard}>
        <div className={styles.codeHeader}>
          <div className={styles.dots}><i /><i /><i /></div>
          {filename && <span className={styles.filename}>{filename}</span>}
        </div>
        <div className={styles.codeBody}>
          {builtLines.map((line, i) => (
            <Line key={line.id} line={line} num={i + 1} />
          ))}
          <div
            className="![border:1px_dashed_var(--st-code-gutter)] ![border-radius:6px] ![padding:6px_12px] ![margin:6px_0] ![font-size:11px] ![color:var(--st-syn-comment)] ![text-align:center]"
          >
            + Bấm một dòng lệnh bên dưới để nối tiếp vào đây
          </div>
          {tailLines.map((line, i) => (
            <Line key={line.id} line={line} num={builtLines.length + i + 1} />
          ))}
        </div>
      </div>
      <div className="![margin-top:14px]">
        <div className="![font-size:12px] ![font-weight:700] ![color:var(--edu-t2)] ![margin-bottom:8px]">
          {revealed ? 'DÒNG LỆNH CÒN LẠI (CÓ DÒNG BẪY)' : <>DÒNG LỆNH CÒN LẠI &amp; DÒNG GÂY NHIỄU</>}
        </div>
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {pool.map((item) => {
            const showReason =
              item.distractorReason && (!revealed || revealed.includes(item.id));
            return (
              <button
                key={item.id}
                type="button"
                disabled={Boolean(revealed && showReason)}
                onClick={() => (item.distractorReason ? onAttemptDistractor(item.id) : onPick(item.id))}
                className={`${styles.optionCard} ![justify-content:space-between] ![min-width:0] ![gap:8px] ${revealed && showReason ? '![opacity:0.6]' : ''}`}
              >
                {/* Giữ thụt lề (pre) nhưng cuộn ngang trong nút, không đẩy rộng trang. */}
                <code className="![display:block] ![flex:1] ![white-space:pre] ![overflow-x:auto] ![min-width:0] ![text-align:left]">
                  {item.content}
                </code>
                {showReason && (
                  <span className="![font-size:11px] ![color:var(--st-err-text)] ![background:var(--st-err-bg)] ![border-radius:999px] ![padding:2px_10px] ![white-space:normal]">
                    Nhiễu: {item.distractorReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
