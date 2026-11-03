'use client';

// Dịch từ màn Stitch "4. DEBUG — Sửa lỗi chương trình": khối code có dòng
// lỗi bôi đỏ kèm thông báo, console traceback và bảng kiểm thử tự động.
import { useState } from 'react';

import styles from './exercises.module.css';
import { CodeBlockLine } from './CodeBlock';
import { SandboxTest } from './Sandbox';
import Console, { ConsoleLine } from './Console';

export interface DebugProps {
  filename?: string;
  errorBadge?: string;
  code: CodeBlockLine[];
  errorLine?: number;
  errorMessage?: string;
  tests: SandboxTest[];
  consoleOutput?: ConsoleLine[];
}

const STATUS_STYLE: Record<SandboxTest['status'], { cls: string; label: string }> = {
  pass: { cls: '![background:var(--st-ok-bg)] ![color:var(--st-ok-text)]', label: '✓ Đạt' },
  fail: { cls: '![background:var(--st-err-bg)] ![color:var(--st-err-text)]', label: '✕ Thất bại' },
  pending: { cls: '![background:var(--edu-card-bg)] ![color:var(--edu-t3)]', label: '⟳ Đang chờ' },
};

export default function Debug({
  filename,
  errorBadge,
  code,
  errorLine,
  errorMessage,
  tests,
  consoleOutput,
}: DebugProps) {
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
      <div className={styles.codeCard}>
        <div className={styles.codeHeader}>
          <div className={styles.dots}><i /><i /><i /></div>
          {filename && <span className={styles.filename}>{filename}</span>}
          {errorBadge && (
            <span className={`${styles.langTag} ![color:var(--st-err-text)]`} >{errorBadge}</span>
          )}
        </div>
        <div className={styles.codeBody}>
          {code.map((line) => (
            <div key={line.num}>
              <div
                className={styles.codeLine}
                style={line.num === errorLine ? { background: 'var(--st-err-bg)', borderRadius: 4 } : undefined}
              >
                <span className={styles.lineNum}>{line.num}</span>
                <span className={styles.codeText}>{line.content}</span>
              </div>
              {line.num === errorLine && errorMessage && (
                <div
                  className="![background:var(--st-err-bg)] ![color:var(--st-err-text)] ![font-size:11px] ![border-radius:4px] ![padding:4px_12px_8px_44px]"
                >
                  ⚠ {errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.runRow}>
        <button type="button" className={styles.runBtn} onClick={run} disabled={running}>
          {running ? '⟳ Đang chạy…' : ran ? '↻ Chạy lại' : '▶ Chạy chương trình'}
        </button>
        <span className={styles.runHint}>
          {ran ? `${passed}/${tests.length} test đạt` : 'Chạy để xem traceback ở console bên dưới'}
        </span>
      </div>

      <Console
        title="TRACEBACK / OUTPUT"
        running={running}
        lines={ran ? consoleOutput || [] : null}
        placeholder='Bấm "Chạy chương trình" để xem lỗi thực tế'
      />

      <div className="![margin-top:16px] ![background:var(--edu-card-bg)] ![border-radius:12px] ![padding:14px]">
        <div className="![font-size:13px] ![font-weight:700] ![margin-bottom:10px]">
          Kiểm thử tự động &nbsp;<span className="![color:var(--edu-t3)] ![font-weight:500]">{passed}/{tests.length} test đạt</span>
        </div>
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {shown.map((t, i) => {
            const s = STATUS_STYLE[t.status];
            return (
              <div
                key={i}
                className="![display:flex] ![align-items:center] ![justify-content:space-between] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:8px] ![padding:8px_12px] ![font-size:13px]"
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
