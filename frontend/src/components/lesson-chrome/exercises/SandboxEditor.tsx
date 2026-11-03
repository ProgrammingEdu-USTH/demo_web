'use client';

// Bản CHẠY THẬT của màn Stitch "3. SANDBOX": cùng bố cục với Sandbox.tsx (khối
// code — thanh chạy — console — bảng kiểm thử) nhưng code là ô soạn thảo được
// và kết quả đến từ Pyodide trong Web Worker, không phải dữ liệu soạn sẵn.
// Sandbox.tsx giữ nguyên cho trang xem trước; bài học thật dùng file này.
import styles from './exercises.module.css';
import Console, { ConsoleLine } from './Console';

export interface SandboxTestRow {
  label: string;
  detail?: string;
  status: 'pass' | 'fail' | 'pending';
}

export interface SandboxEditorProps {
  filename?: string;
  langTag?: string;
  code: string;
  onCodeChange: (code: string) => void;
  running: boolean;
  /** Chạy thử: chỉ xem output, không chấm. */
  onRun: () => void;
  onStop: () => void;
  /** Có lời giải mẫu thì hiện nút xem — bài nào không có thì bỏ trống. */
  onShowSolution?: () => void;
  consoleLines: ConsoleLine[] | null;
  consoleMeta?: string;
  tests: SandboxTestRow[];
  disabled?: boolean;
  /** Chữ mờ khi ô còn trống — bài không có code khởi tạo thì nói rõ ô này dùng làm gì. */
  placeholder?: string;
}

const STATUS_STYLE: Record<SandboxTestRow['status'], { cls: string; label: string }> = {
  pass: { cls: '![background:var(--st-ok-bg)] ![color:var(--st-ok-text)]', label: '✓ Đạt' },
  fail: { cls: '![background:var(--st-err-bg)] ![color:var(--st-err-text)]', label: '✕ Chưa đạt' },
  pending: { cls: '![background:var(--edu-card-bg)] ![color:var(--edu-t3)]', label: '• Chưa chạy' },
};

export default function SandboxEditor({
  filename = 'solution.py',
  langTag = 'CPython 3.12',
  code,
  onCodeChange,
  running,
  onRun,
  onStop,
  onShowSolution,
  consoleLines,
  consoleMeta,
  tests,
  disabled,
  placeholder,
}: SandboxEditorProps) {
  const passed = tests.filter((t) => t.status === 'pass').length;

  return (
    <div>
      <div className={styles.codeCard}>
        <div className={styles.codeHeader}>
          <div className={styles.dots}><i /><i /><i /></div>
          <span className={styles.filename}>{filename}</span>
          <span className={styles.langTag}>{langTag}</span>
        </div>
        <textarea
          aria-label="Trình soạn mã Python"
          spellCheck={false}
          placeholder={placeholder}
          value={code}
          disabled={disabled}
          onChange={(e) => onCodeChange(e.target.value)}
          className={`${styles.codeBody} ![width:100%] ![min-height:220px] ![resize:vertical] ![border:0] ![outline:none] ![color:var(--st-syn-plain)] ![background:transparent] ![font-family:JetBrains_Mono,ui-monospace,SFMono-Regular,Menlo,monospace] ![font-size:13px] ![line-height:1.7] ![tab-size:4]`}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            onCodeChange(code.slice(0, at) + '    ' + code.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(at + 4, at + 4));
          }}
        />
      </div>

      <div className={styles.runRow}>
        <button
          type="button"
          className={styles.runBtn}
          onClick={running ? onStop : onRun}
          disabled={disabled}
        >
          {running ? '■ Dừng' : '▶ Chạy thử'}
        </button>
        {onShowSolution && (
          <button type="button" className={styles.chip} onClick={onShowSolution}>
            Xem lời giải mẫu
          </button>
        )}
        <span className={styles.runHint}>
          {tests.length
            ? `${passed}/${tests.length} ca kiểm thử đạt`
            : 'Bài này chấm trên máy lab, không có ca tự động'}
        </span>
      </div>

      <Console
        title="KẾT QUẢ CHẠY"
        meta={consoleMeta}
        running={running}
        lines={consoleLines}
        placeholder='Bấm "Chạy thử" để thực thi solution.py ngay trong trình duyệt.'
      />

      {tests.length > 0 && (
        <div className="![margin-top:16px] ![background:var(--edu-card-bg)] ![border-radius:12px] ![padding:14px]">
          <div className="![font-size:13px] ![font-weight:700] ![color:var(--edu-t1)] ![margin-bottom:10px]">
            Kiểm thử &nbsp;
            <span className="![color:var(--edu-t3)] ![font-weight:500]">
              {passed}/{tests.length} đạt
            </span>
          </div>
          <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
            {tests.map((t, i) => {
              const style = STATUS_STYLE[t.status];
              return (
                <div
                  key={i}
                  className="![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:8px] ![padding:8px_12px] ![font-size:13px]"
                >
                  <div className="![display:flex] ![align-items:center] ![justify-content:space-between] ![gap:10px]">
                    <span className="![color:var(--edu-t1)]">{t.label}</span>
                    <span
                      className={`${styles.chip} ${style.cls} ![border:0] ![cursor:default] ![flex-shrink:0]`}
                    >
                      {style.label}
                    </span>
                  </div>
                  {t.detail && t.status !== 'pending' && (
                    <div className="![font-size:12px] ![color:var(--edu-t3)] ![margin-top:4px]">{t.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
