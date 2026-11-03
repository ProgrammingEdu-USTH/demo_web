'use client';

// Ô "tự giải thích" — phần S2 của studio-lesson không có trong bộ 27 màn Stitch
// (bộ đó chỉ có các dạng chọn/điền). Dựng theo cùng ngôn ngữ thị giác: thẻ nền
// sáng như các khối ngoài code, rubric hiện thành chip như kho token.
import styles from './exercises.module.css';

export interface SelfExplainProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nhãn các ý mà người chấm sẽ tìm; để trống nếu bài không khai rubric. */
  rubricLabels?: string[];
  /** Yêu cầu tối thiểu, hiện ngay dưới ô nhập để khỏi bấm Kiểm tra mới biết. */
  requirement?: string;
  disabled?: boolean;
}

export default function SelfExplain({
  value,
  onChange,
  placeholder,
  rubricLabels = [],
  requirement,
  disabled,
}: SelfExplainProps) {
  return (
    <div>
      <textarea
        aria-label="Lời giải thích của bạn"
        value={value}
        disabled={disabled}
        placeholder={placeholder || 'Nhập lời giải thích của bạn…'}
        onChange={(e) => onChange(e.target.value)}
        className="![width:100%] ![min-height:132px] ![resize:vertical] ![padding:12px_14px] ![border-radius:12px] ![border:1px_solid_var(--edu-sidebar-border)] ![background:var(--edu-panel-bg-solid)] ![color:var(--edu-t1)] ![font:inherit] ![font-size:14px] ![line-height:1.6]"
      />
      {requirement && rubricLabels.length === 0 && (
        <p className={`${styles.runHint} ![margin-top:10px]`} >
          {requirement}
        </p>
      )}
      {rubricLabels.length > 0 && (
        <div className={`${styles.suggestions} ![margin-top:12px]`} >
          <span className={`${styles.runHint} ![margin-right:4px]`} >
            Cần nêu được:
          </span>
          {rubricLabels.map((label) => (
            <span key={label} className={`${styles.chip} ![cursor:default]`} >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
