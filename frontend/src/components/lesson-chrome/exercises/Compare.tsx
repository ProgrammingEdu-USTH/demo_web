// Dịch từ màn Stitch "5. COMPARE — So sánh Sai & Đúng": 2 khối code cạnh
// nhau, một sai (viền/badge đỏ) một đúng (viền/badge xanh).
import styles from './exercises.module.css';
import { CodeBlockLine } from './CodeBlock';

export interface CompareSideProps {
  label: string;
  tag: string;
  ok: boolean;
  lines: CodeBlockLine[];
}

function CompareSide({ label, tag, ok, lines }: CompareSideProps) {
  return (
    <div className={`${styles.codeCard} ![flex:1] ![min-width:0]`} >
      <div
        className={`${styles.codeHeader} ${ok ? '![background:var(--st-ok-bg)]' : '![background:var(--st-err-bg)]'} ${ok ? '![color:var(--st-ok-text)]' : '![color:var(--st-err-text)]'} ![font-weight:700]`}
 
      >
        <span>{ok ? '✓' : '✕'} {label}</span>
        <span className={`${styles.langTag} ![color:inherit]`} >{tag}</span>
      </div>
      <div className={styles.codeBody}>
        {lines.map((line) => (
          <div key={line.num} className={styles.codeLine}>
            <span className={styles.lineNum}>{line.num}</span>
            <span className={styles.codeText}>{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CompareProps {
  wrong: CompareSideProps;
  right: CompareSideProps;
}

export default function Compare({ wrong, right }: CompareProps) {
  return (
    <div className="![display:flex] ![gap:16px] ![flex-wrap:wrap]">
      <CompareSide {...wrong} />
      <CompareSide {...right} />
    </div>
  );
}
