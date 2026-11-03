// Dịch từ màn Stitch "5. HINT SHEET — Ngăn kéo gợi ý từng bước". Bản gốc là
// một drawer nổi đè lên trên bài; ở đây trình bày như 1 thẻ nằm trong dòng
// chảy nội dung (đơn giản hoá bớt phần overlay) — vẫn giữ đủ 3 mức gợi ý mở
// khoá dần và 2 lựa chọn hành động cuối.
export interface HintLevel {
  title: string;
  body?: React.ReactNode;
  locked: boolean;
  cost?: number;
}

export interface HintSheetProps {
  levels: HintLevel[];
  openIndex: number;
  onUnlock: (index: number) => void;
  onBackToCode: () => void;
  onContinueWriting: () => void;
}

export default function HintSheet({ levels, openIndex, onUnlock, onBackToCode, onContinueWriting }: HintSheetProps) {
  return (
    <div>
      <div className="![display:flex] ![flex-direction:column] ![gap:10px]">
        {levels.map((level, i) => {
          const isOpen = i === openIndex;
          const locked = level.locked && i > openIndex;
          return (
            <div
              key={i}
              className="![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:12px] ![padding:14px_16px]"
            >
              {/* Trước đây chỉ mở khoá được khi có `cost`; bài học thật không
                  trừ XP nên không truyền cost, và học viên kẹt ở tầng 1. */}
              <button
                type="button"
                onClick={() => locked && onUnlock(i)}
                disabled={!locked}
                className={`![width:100%] ![display:flex] ![justify-content:space-between] ![align-items:center] ![background:transparent] ![border:0] ![font:inherit] ${locked ? '![cursor:pointer]' : '![cursor:default]'} ![color:var(--edu-t1)] ![font-weight:700] ![font-size:13px]`}
              >
                <span>{locked ? '🔒' : '💡'} {level.title}</span>
                {locked && (
                  <span className="![background:var(--edu-accent-soft)] ![color:var(--edu-accent-text)] ![border-radius:999px] ![padding:3px_10px] ![font-size:11px]">
                    {level.cost != null ? `⚡ Mở khoá (-${level.cost} XP)` : 'Mở gợi ý này'}
                  </span>
                )}
              </button>
              {isOpen && level.body && (
                <div className="![font-size:13px] ![color:var(--edu-t2)] ![line-height:1.7] ![margin-top:10px]">{level.body}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="![display:flex] ![gap:10px] ![margin-top:16px]">
        <button
          type="button"
          onClick={onBackToCode}
          className="![flex:1] ![padding:12px_16px] ![border-radius:999px] ![border:1px_solid_var(--edu-sidebar-border)] ![background:var(--edu-card-bg)] ![color:var(--edu-t1)] ![font-weight:600] ![cursor:pointer]"
        >
          ✓ Đã hiểu, quay lại làm bài
        </button>
        <button
          type="button"
          onClick={onContinueWriting}
          className="![flex:1] ![padding:12px_16px] ![border-radius:999px] ![border:0] ![background:transparent] ![color:var(--edu-accent-text)] ![font-weight:600] ![cursor:pointer]"
        >
          Tiếp tục viết mã
        </button>
      </div>
    </div>
  );
}
