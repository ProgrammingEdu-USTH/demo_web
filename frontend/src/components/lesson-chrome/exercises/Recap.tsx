// Dịch từ màn Stitch "3. RECAP — Tổng kết bài học & Nhận XP". Cũng là màn
// toàn thẻ, đứng độc lập như Checkpoint.
export interface RecapStat {
  icon: string;
  value: string;
  label: string;
}

export interface RecapProps {
  xpLabel: string;
  title: string;
  description: string;
  stats: RecapStat[];
  facts: string[];
  onFinish: () => void;
}

// Số cột theo số mục: viết nguyên văn để Tailwind quét được class.
const COLS_CLS = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'];

export default function Recap({ xpLabel, title, description, stats, facts, onFinish }: RecapProps) {
  return (
    <div className="![text-align:center]">
      <span
        className="![display:inline-flex] ![align-items:center] ![gap:8px] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:999px] ![padding:10px_20px] ![font-size:22px] ![font-weight:800] ![color:var(--edu-accent-text)]"
      >
        💎 {xpLabel} ✨
      </span>
      <h2 className="![font-size:24px] ![font-weight:800] ![margin:16px_0_8px] ![color:var(--edu-t1)]">{title}</h2>
      <p className="![font-size:14px] ![color:var(--edu-t3)] ![max-width:460px] ![margin:0_auto_20px]">{description}</p>
      <div className={`grid ${COLS_CLS[Math.min(stats.length, COLS_CLS.length - 1)]} ![gap:12px] ![margin-bottom:20px]`}>
        {stats.map((s, i) => (
          <div
            key={i}
            className="![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:12px] ![padding:16px]"
          >
            <div className="![font-size:22px]">{s.icon}</div>
            <div className="![font-size:18px] ![font-weight:800] ![color:var(--edu-t1)] ![margin:6px_0_2px]">{s.value}</div>
            <div className="![font-size:11px] ![color:var(--edu-t3)]">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="![text-align:left]">
        <div className="![font-size:12px] ![font-weight:700] ![color:var(--edu-t2)] ![margin-bottom:8px]">
          📖 KIẾN THỨC CỐT LÕI ĐÃ HỌC
        </div>
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {facts.map((f, i) => (
            <div
              key={i}
              className="![display:flex] ![gap:10px] ![align-items:flex-start] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:10px] ![padding:10px_14px] ![font-size:13px] ![color:var(--edu-t1)]"
            >
              <span className="![color:var(--st-ok-text)]">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onFinish}
        className="![width:100%] ![height:52px] ![border-radius:999px] ![border:0] ![background:var(--edu-accent-grad)] ![color:var(--edu-panel-bg-solid)] ![font-weight:700] ![font-size:15px] ![cursor:pointer] ![margin-top:20px]"
      >
        Hoàn thành ✓
      </button>
    </div>
  );
}
