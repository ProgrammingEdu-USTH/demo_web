// Dịch từ màn Stitch "1. VISUAL — Sơ đồ bộ nhớ Stack & Heap": thẻ trực quan
// tĩnh, không tương tác.
import styles from './exercises.module.css';

export interface StackEntry {
  name: string;
  address: string;
  note: string;
}
export interface HeapEntry {
  tag: string;
  address: string;
  refcount: number;
  rows: { label: string; value: string }[];
}

export interface VisualProps {
  stack: StackEntry[];
  heap: HeapEntry[];
}

export default function Visual({ stack, heap }: VisualProps) {
  const col: React.CSSProperties = {
    background: 'var(--edu-panel-bg-solid)',
    border: '1px solid var(--edu-sidebar-border)',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };
  return (
    <div className="![display:grid] ![grid-template-columns:1fr_1fr] ![gap:16px]">
      <div>
        <div className="![font-size:13px] ![font-weight:700] ![color:var(--edu-accent)] ![margin-bottom:8px]">● Stack</div>
        <div style={col}>
          {stack.map((s, i) => (
            <div key={i} className={`![padding-bottom:8px] ${i < stack.length - 1 ? '![border-bottom:1px_solid_var(--edu-sidebar-border)]' : ''}`}>
              <div className="![display:flex] ![justify-content:space-between] ![font-size:13px]">
                <code className="![color:var(--edu-accent-text)] ![font-weight:700]">{s.name}</code>
                <code className="![color:var(--edu-t3)]">{s.address}</code>
              </div>
              <div className="![font-size:12px] ![color:var(--edu-t3)] ![margin-top:2px]">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="![font-size:13px] ![font-weight:700] ![color:var(--edu-accent)] ![margin-bottom:8px]">● Heap</div>
        <div style={col}>
          {heap.map((h, i) => (
            <div key={i}>
              <div className="![display:flex] ![align-items:center] ![gap:8px] ![margin-bottom:6px]">
                <span className={`${styles.chip} ![background:var(--edu-accent)] ![color:var(--edu-panel-bg-solid)] ![border:0] ![cursor:default]`} >
                  {h.tag}
                </span>
                <code className="![font-size:11px] ![color:var(--edu-t3)]">@ {h.address}</code>
                <span className={`${styles.chip} ![margin-left:auto] ![background:var(--st-ok-bg)] ![color:var(--st-ok-text)] ![border:0] ![cursor:default]`} >
                  Refcount: {h.refcount}
                </span>
              </div>
              <div className="![display:flex] ![gap:8px] ![flex-wrap:wrap]">
                {h.rows.map((r, j) => (
                  <div key={j} className="![font-size:11px] ![color:var(--edu-t3)]">
                    {r.label} <code className="![color:var(--edu-t1)] ![font-weight:700]">{r.value}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
