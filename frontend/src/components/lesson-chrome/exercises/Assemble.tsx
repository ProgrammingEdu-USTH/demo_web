// Dịch từ màn Stitch "4. ASSEMBLE — Lắp ráp mã nguồn". Cùng cơ chế "cầm rồi
// thả" như Classify: bấm token trong kho để cầm lên, rồi bấm vào ô trống
// trong code để điền — thay cho kéo-thả tự do.
import styles from './exercises.module.css';

export interface AssembleLine {
  num: number;
  before: React.ReactNode;
  /** Có ô trống trên dòng này thì đặt slotId; dòng thường thì bỏ trống. */
  slotId?: string;
  after?: React.ReactNode;
}

export interface AssembleProps {
  filename?: string;
  langTag?: string;
  lines: AssembleLine[];
  filled: Record<string, string>;
  bank: string[];
  heldToken: string | null;
  onHold: (token: string) => void;
  onFillSlot: (slotId: string) => void;
}

export default function Assemble({
  filename,
  langTag,
  lines,
  filled,
  bank,
  heldToken,
  onHold,
  onFillSlot,
}: AssembleProps) {
  return (
    <div>
      <div className={styles.codeCard}>
        <div className={styles.codeHeader}>
          <div className={styles.dots}><i /><i /><i /></div>
          {filename && <span className={styles.filename}>{filename}</span>}
          {langTag && <span className={styles.langTag}>{langTag}</span>}
        </div>
        <div className={styles.codeBody}>
          {lines.map((line) => (
            <div key={line.num} className={styles.codeLine}>
              <span className={styles.lineNum}>{line.num}</span>
              <span className={styles.codeText}>
                {line.before}
                {line.slotId && (
                  <button
                    type="button"
                    onClick={() => heldToken && onFillSlot(line.slotId!)}
                    className={`![display:inline-block] ![min-width:90px] ![margin:0_4px] ![padding:1px_10px] ![border-radius:6px] ![color:var(--st-syn-plain)] ![font:inherit] ![font-weight:700] ${filled[line.slotId] ? '![border:1px_solid_var(--st-slot-border)] ![background:rgba(255,255,255,.08)]' : '![border:1.5px_dashed_var(--st-slot-border)] ![background:transparent]'} ${heldToken ? '![cursor:pointer]' : '![cursor:default]'}`}
                  >
                    {filled[line.slotId] || (heldToken ? 'thả vào đây' : '···')}
                  </button>
                )}
                {line.after}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="![background:var(--edu-card-bg)] ![border-radius:12px] ![padding:14px] ![margin-top:12px]">
        <div className="![font-size:12px] ![font-weight:700] ![color:var(--edu-t2)] ![margin-bottom:8px]">
          KHO TỪ KHOÁ {heldToken ? `— đang cầm "${heldToken}"` : '(bấm để cầm lên)'}
        </div>
        <div className="![display:flex] ![gap:8px] ![flex-wrap:wrap]">
          {bank.length === 0 && <span className="![font-size:12px] ![color:var(--edu-t3)]">Hết token.</span>}
          {bank.map((token) => (
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
