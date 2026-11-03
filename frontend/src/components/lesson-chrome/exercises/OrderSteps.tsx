// Dịch từ màn Stitch "3. ORDER — Sắp xếp luồng lệnh". Bản gốc kéo-thả tự do;
// ở đây dùng nút lên/xuống cho từng dòng — cùng kết quả sắp xếp lại thứ tự,
// thao tác được cả bằng bàn phím/chạm thay vì chỉ con trỏ chuột.
import styles from './exercises.module.css';

export interface OrderStepItem {
  id: string;
  content: React.ReactNode;
}

export interface OrderStepsProps {
  items: OrderStepItem[];
  onMove: (index: number, direction: -1 | 1) => void;
}

export default function OrderSteps({ items, onMove }: OrderStepsProps) {
  return (
    <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="![display:flex] ![align-items:center] ![gap:12px] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:10px] ![padding:10px_14px]"
        >
          <span
            className="![width:22px] ![height:22px] ![border-radius:50%] ![background:var(--edu-accent-soft)] ![color:var(--edu-accent-text)] ![display:flex] ![align-items:center] ![justify-content:center] ![font-size:11px] ![font-weight:700] ![flex-shrink:0]"
          >
            {i + 1}
          </span>
          <code className="![flex:1] ![font-size:13px]">{item.content}</code>
          <div className="![display:flex] ![gap:4px] ![flex-shrink:0]">
            <button
              type="button"
              className={`${styles.chip} ${i === 0 ? '![opacity:0.35]' : ''}`}
              disabled={i === 0}
              onClick={() => onMove(i, -1)}
              aria-label="Chuyển lên trên"
            >
              ↑
            </button>
            <button
              type="button"
              className={`${styles.chip} ${i === items.length - 1 ? '![opacity:0.35]' : ''}`}
              disabled={i === items.length - 1}
              onClick={() => onMove(i, 1)}
              aria-label="Chuyển xuống dưới"
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
