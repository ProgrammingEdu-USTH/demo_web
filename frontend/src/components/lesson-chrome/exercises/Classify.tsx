// Dịch từ màn Stitch "1. CLASSIFY — Phân loại dữ liệu". Bản gốc dùng kéo-thả
// (drag&drop) token vào ô; ở đây đơn giản hoá thành "chọn rồi bấm": bấm 1
// token trong kho để cầm lên (nổi bật), rồi bấm vào nhóm muốn thả vào —
// tương đương thao tác, không cần theo dõi toạ độ con trỏ.
import styles from './exercises.module.css';

export interface ClassifyBin {
  key: string;
  label: string;
  sub: string;
  items: string[];
}

export interface ClassifyProps {
  bins: ClassifyBin[];
  pool: string[];
  heldToken: string | null;
  onHold: (token: string) => void;
  onDrop: (binKey: string) => void;
}

// Số cột theo số mục: viết nguyên văn để Tailwind quét được class.
const COLS_CLS = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'];

export default function Classify({ bins, pool, heldToken, onHold, onDrop }: ClassifyProps) {
  return (
    <div>
      <div className={`grid ${COLS_CLS[Math.min(bins.length, COLS_CLS.length - 1)]} ![gap:12px] ![margin-bottom:16px]`}>
        {bins.map((bin) => (
          <button
            key={bin.key}
            type="button"
            onClick={() => heldToken && onDrop(bin.key)}
            className={`![text-align:left] ![font:inherit] ${heldToken ? '![cursor:pointer]' : '![cursor:default]'} ![background:var(--edu-card-bg)] ${heldToken ? '![border:1.5px_dashed_var(--st-slot-border)]' : '![border:1px_solid_var(--edu-sidebar-border)]'} ![border-radius:14px] ![padding:14px] ![min-height:140px] ![display:flex] ![flex-direction:column] ![gap:6px]`}
          >
            <div className="![font-size:12px] ![font-weight:700] ![color:var(--edu-t1)]">
              <code>{bin.label}</code>
            </div>
            <div className="![font-size:11px] ![color:var(--edu-t3)]">{bin.sub}</div>
            <div className="![display:flex] ![gap:6px] ![flex-wrap:wrap] ![margin-top:6px]">
              {bin.items.map((item) => (
                <span key={item} className={`${styles.chip} ![cursor:default]`} >
                  {item} ✓
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div
        className="![background:var(--edu-card-bg)] ![border-radius:12px] ![padding:12px_16px]"
      >
        <div className="![font-size:12px] ![font-weight:700] ![color:var(--edu-t2)] ![margin-bottom:8px]">
          KHO TOKEN {heldToken ? `— đang cầm "${heldToken}", bấm vào nhóm để thả` : '(bấm để cầm lên)'}
        </div>
        <div className="![display:flex] ![gap:8px] ![flex-wrap:wrap]">
          {pool.length === 0 && <span className="![font-size:12px] ![color:var(--edu-t3)]">Đã phân loại hết.</span>}
          {pool.map((token) => (
            <button
              key={token}
              type="button"
              className={styles.chip}
              onClick={() => onHold(token)}
              style={heldToken === token ? { borderColor: 'var(--edu-accent)', background: 'var(--edu-accent-soft)' } : undefined}
            >
              {token}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
