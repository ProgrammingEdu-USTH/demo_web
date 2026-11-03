// Dịch từ màn Stitch "6. MISCONCEPTION — Sửa hiểu lầm sai sót": câu hiểu lầm
// bị gạch ngang, kèm khối "thực tế chính xác" và ví dụ minh hoạ.
import shellStyles from '../ShellB.module.css';
import CodeBlock, { CodeBlockLine } from './CodeBlock';

export interface MisconceptionProps {
  myth: string;
  correction: React.ReactNode;
  exampleLabel?: string;
  langTag?: string;
  code?: CodeBlockLine[];
}

export default function Misconception({ myth, correction, exampleLabel, langTag, code }: MisconceptionProps) {
  return (
    <div>
      <span className={`${shellStyles.eyebrow} ![background:var(--st-err-bg)] ![color:var(--st-err-text)]`} >
        ⚠ Hiểu lầm phổ biến
      </span>
      <p
        className="![font-size:20px] ![font-weight:700] ![text-decoration:line-through] ![color:var(--edu-t3)] ![margin:16px_0_20px]"
      >
        &ldquo;{myth}&rdquo;
      </p>
      <div
        className="![background:var(--st-ok-bg)] ![border-radius:12px] ![padding:16px_18px] ![margin-bottom:16px]"
      >
        <div className="![font-size:12px] ![font-weight:700] ![color:var(--st-ok-text)] ![margin-bottom:6px]">
          ✓ THỰC TẾ CHÍNH XÁC
        </div>
        <div className="![font-size:14px] ![color:var(--edu-t1)] ![line-height:1.6]">{correction}</div>
      </div>
      {code && (
        <>
          {exampleLabel && (
            <div className="![display:flex] ![justify-content:space-between] ![font-size:12px] ![color:var(--edu-t3)] ![margin-bottom:6px]">
              <span>● {exampleLabel}</span>
              {langTag && <span>{langTag}</span>}
            </div>
          )}
          <CodeBlock lines={code} showDots={false} />
        </>
      )}
    </div>
  );
}
