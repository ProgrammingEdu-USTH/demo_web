// Dịch từ màn Stitch "6. TRACE-TABLE — Bảng theo dõi biến": khối code +
// bảng nhập giá trị biến qua từng bước lặp.
import CodeBlock, { CodeBlockLine } from './CodeBlock';

export interface TraceRow {
  step: string;
  values: Record<string, string | null>; // null = ô còn trống, cần nhập
}

export interface TraceTableProps {
  filename?: string;
  code: CodeBlockLine[];
  columns: string[];
  rows: TraceRow[];
  answers: Record<string, string>; // key `${rowIndex}-${col}`
  onAnswerChange: (key: string, value: string) => void;
}

export default function TraceTable({ filename, code, columns, rows, answers, onAnswerChange }: TraceTableProps) {
  const filledCount = rows.reduce(
    (acc, row, i) =>
      acc + columns.filter((c) => row.values[c] !== null || answers[`${i}-${c}`]?.trim()).length,
    0,
  );
  const totalCells = rows.length * columns.length;

  return (
    <div>
      <CodeBlock filename={filename} lines={code} />
      <div className="![background:var(--edu-card-bg)] ![border-radius:12px] ![margin-top:16px] ![overflow:hidden]">
        <div
          className="![display:flex] ![justify-content:space-between] ![padding:10px_14px] ![font-size:12px] ![font-weight:700] ![color:var(--edu-t2)]"
        >
          <span>📊 TRẠNG THÁI BỘ NHỚ</span>
          <span>{filledCount}/{totalCells} giá trị</span>
        </div>
        <table className="![width:100%] ![border-collapse:collapse] ![font-size:13px]">
          <thead>
            <tr className="![background:var(--edu-accent-soft)]">
              <th className="![text-align:left] ![padding:8px_14px] ![font-weight:700] ![color:var(--edu-t1)]">Bước</th>
              {columns.map((c) => (
                <th key={c} className="![padding:8px_14px] ![font-family:JetBrains_Mono,_monospace] ![color:var(--edu-accent-text)]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="![border-top:1px_solid_var(--edu-sidebar-border)]">
                <td className="![padding:8px_14px] ![color:var(--edu-t2)]">{row.step}</td>
                {columns.map((c) => {
                  const given = row.values[c];
                  const key = `${i}-${c}`;
                  return (
                    <td key={c} className="![padding:8px_14px] ![text-align:center]">
                      {given !== null ? (
                        <span className="![background:var(--edu-accent-soft)] ![border-radius:999px] ![padding:2px_12px] ![font-family:JetBrains_Mono,_monospace]">
                          {given}
                        </span>
                      ) : (
                        <input
                          value={answers[key] || ''}
                          onChange={(e) => onAnswerChange(key, e.target.value)}
                          className="![width:48px] ![text-align:center] ![border:1.5px_solid_var(--st-slot-border)] ![border-radius:999px] ![padding:2px_4px] ![font:inherit] ![font-family:JetBrains_Mono,_monospace] ![background:var(--edu-panel-bg-solid)] ![color:var(--edu-t1)]"
                          aria-label={`${row.step} - ${c}`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
