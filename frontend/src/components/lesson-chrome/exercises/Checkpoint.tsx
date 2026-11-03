// Dịch từ màn Stitch "2. CHECKPOINT — Điểm dừng nửa chặng". Đây là một màn
// TOÀN THẺ (đứng độc lập trong vùng nội dung, không cần ShellA/ShellB bọc).
export interface CheckpointItem {
  title: string;
  meta: string;
  xp: number;
}

export interface CheckpointProps {
  title: string;
  description: string;
  accuracyLabel: string;
  accuracyValue: string;
  items: CheckpointItem[];
  onContinue: () => void;
  onPause?: () => void;
}

export default function Checkpoint({
  title,
  description,
  accuracyLabel,
  accuracyValue,
  items,
  onContinue,
  onPause,
}: CheckpointProps) {
  return (
    <div className="![text-align:center]">
      <div
        className="![width:96px] ![height:96px] ![border-radius:50%] ![background:var(--edu-accent-grad)] ![display:flex] ![align-items:center] ![justify-content:center] ![margin:0_auto_20px] ![font-size:40px] ![color:var(--edu-panel-bg-solid)]"
      >
        🏆
      </div>
      <span
        className="![display:inline-flex] ![align-items:center] ![gap:6px] ![background:var(--edu-accent-soft)] ![color:var(--edu-accent-text)] ![border-radius:999px] ![padding:4px_12px] ![font-size:11px] ![font-weight:700] ![text-transform:uppercase]"
      >
        ● Cột mốc bài học
      </span>
      <h2 className="![font-size:26px] ![font-weight:800] ![margin:14px_0_8px] ![color:var(--edu-t1)]">{title}</h2>
      <p className="![font-size:14px] ![color:var(--edu-t3)] ![max-width:460px] ![margin:0_auto_20px]">{description}</p>
      <div
        className="![display:inline-flex] ![align-items:center] ![gap:10px] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:999px] ![padding:8px_16px] ![font-size:13px] ![margin-bottom:24px]"
      >
        🎯 {accuracyLabel}
        <span className="![background:var(--edu-card-bg)] ![border-radius:999px] ![padding:2px_10px] ![font-weight:700]">
          {accuracyValue}
        </span>
      </div>
      <div className="![display:flex] ![flex-direction:column] ![gap:10px] ![text-align:left]">
        {items.map((item, i) => (
          <div
            key={i}
            className="![display:flex] ![align-items:center] ![justify-content:space-between] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:12px] ![padding:14px_18px]"
          >
            <div className="![display:flex] ![align-items:center] ![gap:12px]">
              <span className="![color:var(--st-ok-text)] ![font-size:18px]">✓</span>
              <div>
                <div className="![font-weight:700] ![font-size:14px] ![color:var(--edu-t1)]">{item.title}</div>
                <div className="![font-size:12px] ![color:var(--st-ok-text)]">{item.meta}</div>
              </div>
            </div>
            <span className="![background:var(--edu-card-bg)] ![color:var(--edu-t2)] ![border-radius:999px] ![padding:4px_10px] ![font-size:11px] ![font-family:JetBrains_Mono,_monospace]">
              {item.xp} XP
            </span>
          </div>
        ))}
      </div>
      <div className="![display:flex] ![gap:10px] ![margin-top:20px]">
        <button
          type="button"
          onClick={onContinue}
          className="![flex:1] ![height:48px] ![border-radius:999px] ![border:0] ![background:var(--edu-accent-grad)] ![color:var(--edu-panel-bg-solid)] ![font-weight:700] ![cursor:pointer]"
        >
          ▶ Học tiếp
        </button>
        {onPause && (
          <button
            type="button"
            onClick={onPause}
            className="![padding:0_20px] ![height:48px] ![border-radius:999px] ![border:1px_solid_var(--edu-sidebar-border)] ![background:var(--edu-panel-bg-solid)] ![color:var(--edu-t2)] ![font-weight:600] ![cursor:pointer]"
          >
            🔖 Nghỉ, lưu tiến độ
          </button>
        )}
      </div>
    </div>
  );
}
