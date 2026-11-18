/* Thành tựu: 24 huy hiệu trên 3 tầng kệ × 8, tóm tắt vàng/bạc/đồng, vệt sáng quét qua (#sweep). Port body('achievements'). */
import { Icon } from "../hud/Icons";
import { usePages } from "./PagesContext";

const PER_PLANK = 8;

export function AchievementsPage() {
  const { badges, badgeSummary: B } = usePages().data;
  const planks = Array.from({ length: Math.ceil(badges.length / PER_PLANK) }, (_, r) => badges.slice(r * PER_PLANK, r * PER_PLANK + PER_PLANK));
  return (
    <div className="pg">
      <div className="pghead">
        <div>
          <h1>Thành tựu</h1>
          <p>
            {B.owned}/{B.total} huy hiệu · sắp mở: {B.next.name} ({B.next.progress})
          </p>
        </div>
        <div className="summary">
          <span className="pill">
            <Icon name="medal" style={{ stroke: "#f3be52" }} />
            {B.gold} vàng
          </span>
          <span className="pill">
            <Icon name="medal" style={{ stroke: "#c7cbd6" }} />
            {B.silver} bạc
          </span>
          <span className="pill">
            <Icon name="medal" style={{ stroke: "#cf8a52" }} />
            {B.bronze} đồng
          </span>
        </div>
      </div>
      <div className="trophy" id="trophy">
        {planks.map((row, r) => (
          <div key={r} className="plank">
            {row.map((b) => (
              <div key={b.name} className={`bdg${b.tier === "soon" ? " soon" : ""}`} title={b.name}>
                <div className={`med ${b.tier}`}>{b.glyph}</div>
                <span>{b.name}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="sweep" id="sweep" />
      </div>
    </div>
  );
}
