// Dịch từ màn Stitch "5. SPOT-ERROR — Tìm dòng mã lỗi": nhấn vào dòng nghi
// chứa lỗi; dòng được chọn hiện khung tím + nhãn mô tả lỗi.
import styles from './exercises.module.css';

export interface SpotErrorLine {
  num: number;
  content: React.ReactNode;
  /** Chỉ dòng đúng mới có nhãn lỗi — hiện ra khi người dùng chọn dòng này. */
  errorLabel?: string;
}

export interface SpotErrorProps {
  filename?: string;
  lines: SpotErrorLine[];
  selected: number | null;
  onSelect: (num: number) => void;
  /** Dòng chứa lỗi thật — chỉ dùng để tô màu SAU khi bấm "Kiểm tra". */
  correctLine?: number;
  checked?: boolean;
}

export default function SpotError({ filename, lines, selected, onSelect, correctLine, checked }: SpotErrorProps) {
  return (
    <div className={styles.codeCard}>
      <div className={styles.codeHeader}>
        <div className={styles.dots}><i /><i /><i /></div>
        {filename && <span className={styles.filename}>{filename}</span>}
      </div>
      <div className={styles.codeBody}>
        {lines.map((line) => {
          const isSelected = selected === line.num;
          const isRight = checked && correctLine === line.num;
          const isWrong = checked && isSelected && correctLine !== line.num;
          const showLabel = (isSelected || isRight) && line.errorLabel;

          const borderCls = isRight
            ? '![border-color:var(--st-ok-line)]'
            : isWrong
              ? '![border-color:var(--st-err-line)]'
              : isSelected
                ? '![border-color:var(--edu-accent)]'
                : '![border-color:transparent]';
          const bgCls = isRight ? '![background:var(--st-ok-bg)]' : isWrong ? '![background:var(--st-err-bg)]' : '![background:transparent]';

          return (
            <button
              key={line.num}
              type="button"
              onClick={() => onSelect(line.num)}
              disabled={checked}
              className={`${styles.codeLine} ${borderCls} ${bgCls} ${checked ? '![cursor:default]' : '![cursor:pointer]'} ![width:100%] ![border-style:solid] ![border-width:1px] ![border-radius:6px] ![text-align:left] ![font:inherit] ![justify-content:space-between] ![padding:2px_6px] ![transition:background_.18s,border-color_.18s]`}
            >
              <span className="![display:flex] ![gap:12px]">
                <span className={styles.lineNum}>{line.num}</span>
                <span className={styles.codeText}>{line.content}</span>
              </span>
              {showLabel && (
                <span
                  className={`${isRight ? '![background:var(--st-ok-bg)]' : '![background:var(--edu-accent-soft)]'} ${isRight ? '![color:var(--st-ok-text)]' : '![color:var(--edu-accent-text)]'} ![border-radius:999px] ![padding:2px_10px] ![font-size:11px] ![font-weight:700] ![flex-shrink:0] ![margin-left:12px]`}
                >
                  ! {line.errorLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
