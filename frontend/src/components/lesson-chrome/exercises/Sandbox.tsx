'use client';

// Dịch từ màn Stitch "3. SANDBOX — Môi trường kiểm thử mã": khối code +
// console kết quả + bảng kiểm thử tự động (pass/fail). Không chạy Python
// thật — output và trạng thái test là dữ liệu soạn sẵn, bấm "Chạy" mới đổ ra.
import { useState } from 'react';

import styles from './exercises.module.css';
import CodeBlock, { CodeBlockLine } from './CodeBlock';
import Console, { ConsoleLine } from './Console';

export interface SandboxTest {
  label: string;
  status: 'pass' | 'fail' | 'pending';
}

export interface SandboxProps {
  filename?: string;
  langTag?: string;
  code: CodeBlockLine[];
  tests: SandboxTest[];
  consoleOutput?: ConsoleLine[];
}

const STATUS_STYLE: Record<SandboxTest['status'], { cls: string; label: string }> = {
  pass: { cls: '![background:var(--st-ok-bg)] ![color:var(--st-ok-text)]', label: '✓ Đạt (Pass)' },
  fail: { cls: '![background:var(--st-err-bg)] ![color:var(--st-err-text)]', label: '✕ Thất bại' },
  pending: { cls: '![background:var(--edu-card-bg)] ![color:var(--edu-t3)]', label: '• Chưa chạy' },
};

export default function Sandbox({ filename, langTag, code, tests, consoleOutput }: SandboxProps) {
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);

  const shown: SandboxTest[] = ran ? tests : tests.map((t) => ({ ...t, status: 'pending' }));
  const passed = shown.filter((t) => t.status === 'pass').length;

  const run = () => {
    setRunning(true);
    setRan(false);
    setTimeout(() => {
      setRunning(false);
      setRan(true);
    }, 520);
  };

  return (
    <div>
      <CodeBlock filename={filename} langTag={langTag} lines={code} />

      <div className={styles.runRow}>
        <button type="button" className={styles.runBtn} onClick={run} disabled={running}>
          {running ? '⟳ Đang chạy…' : ran ? '↻ Chạy lại' : '▶ Chạy kiểm thử'}
        </button>
        <span className={styles.runHint}>
          {ran ? `${passed}/${tests.length} test đạt` : 'Chạy để xem kết quả ở console bên dưới'}
        </span>
      </div>

      <Console
        title="KẾT QUẢ CHẠY"
        running={running}
        lines={ran ? consoleOutput || [] : null}
        placeholder='Bấm "Chạy kiểm thử" để thực thi solution.py'
      />

      <div className="![margin-top:16px] ![background:var(--edu-card-bg)] ![border-radius:12px] ![padding:14px]">
        <div className="![font-size:13px] ![font-weight:700] ![color:var(--edu-t1)] ![margin-bottom:10px]">
          Kiểm thử &nbsp;
          <span className="![color:var(--edu-t3)] ![font-weight:500]">{passed}/{tests.length} test đạt</span>
        </div>
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {shown.map((t, i) => {
            const s = STATUS_STYLE[t.status];
            return (
              <div
                key={i}
                className="![display:flex] ![align-items:center] ![justify-content:space-between] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:8px] ![padding:8px_12px] ![font-size:13px] ![transition:border-color_.2s]"
              >
                <code>{t.label}</code>
                <span className={`${styles.chip} ${s.cls} ![border:0] ![cursor:default]`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
