// Dịch từ màn Stitch "2. MATCH — Ghép nối cặp giá trị". Bản gốc kéo dây nối
// giữa 2 cột; ở đây đơn giản hoá thành "bấm chọn 2 đầu": bấm 1 mục cột trái
// rồi bấm mục cột phải để ghép cặp — bỏ vẽ đường SVG cong theo con trỏ.
import styles from './exercises.module.css';

export interface MatchItem {
  id: string;
  content: React.ReactNode;
}

export interface MatchPairsProps {
  left: MatchItem[];
  right: MatchItem[];
  /** id bên trái → id bên phải đã ghép đúng vị trí. */
  matched: Record<string, string>;
  pendingLeft: string | null;
  onPickLeft: (id: string) => void;
  onPickRight: (id: string) => void;
}

export default function MatchPairs({ left, right, matched, pendingLeft, onPickLeft, onPickRight }: MatchPairsProps) {
  const matchedRightIds = new Set(Object.values(matched));
  return (
    <div>
      <div
        className="![display:grid] ![grid-template-columns:1fr_1fr] ![gap:10px] ![background:var(--edu-panel-bg-solid)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:12px] ![padding:16px]"
      >
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {left.map((item) => {
            const isMatched = !!matched[item.id];
            const isPending = pendingLeft === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isMatched}
                onClick={() => onPickLeft(item.id)}
                className={`${styles.optionCard} ![justify-content:flex-start] ${isMatched ? '![border-color:var(--st-ok-line)] ![background:var(--st-ok-bg)] ![opacity:0.7]' : isPending ? '![border-color:var(--edu-accent)] ![background:var(--edu-accent-soft)]' : ''}`}
              >
                <code>{item.content}</code>
              </button>
            );
          })}
        </div>
        <div className="![display:flex] ![flex-direction:column] ![gap:8px]">
          {right.map((item) => {
            const isMatched = matchedRightIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={isMatched || !pendingLeft}
                onClick={() => onPickRight(item.id)}
                className={`${styles.optionCard} ![justify-content:flex-start] ${isMatched ? '![border-color:var(--st-ok-line)] ![background:var(--st-ok-bg)] ![opacity:0.7]' : pendingLeft ? '' : '![opacity:0.5]'}`}
              >
                {item.content}
              </button>
            );
          })}
        </div>
      </div>
      <div className="![font-size:12px] ![color:var(--edu-t3)] ![margin-top:10px]">
        Đã ghép {Object.keys(matched).length}/{left.length} cặp
      </div>
    </div>
  );
}
