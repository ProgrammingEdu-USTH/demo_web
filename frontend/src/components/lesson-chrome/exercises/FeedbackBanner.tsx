// Dịch từ màn Stitch "4. FEEDBACK — Trạng thái Trả lời Đúng/Sai". Bản gốc
// hiện thành dải banner đè lên bottom bar (rộng hết màn hình); ở đây đặt
// làm 1 thẻ trong dòng nội dung để không phải sửa lại LessonChrome cho một
// trường hợp riêng — cùng thông tin (icon, tiêu đề, giải thích), khác vị trí.
import styles from './exercises.module.css';

export interface FeedbackBannerProps {
  correct: boolean;
  title: string;
  explanation: React.ReactNode;
}

export default function FeedbackBanner({ correct, title, explanation }: FeedbackBannerProps) {
  return (
    <div
      className={`${styles.feedbackBanner} ![display:flex] ![align-items:flex-start] ![gap:14px] ![border-radius:14px] ![padding:16px_18px] ![margin-top:16px] ${correct ? '![background:var(--st-ok-bg)] ![border:1px_solid_var(--st-ok-line)]' : '![background:var(--st-err-bg)] ![border:1px_solid_var(--st-err-line)]'}`}
    >
      <span
        className={`![width:28px] ![height:28px] ![border-radius:50%] ${correct ? '![background:var(--st-ok-text)]' : '![background:var(--st-err-text)]'} ![color:var(--edu-panel-bg-solid)] ![display:flex] ![align-items:center] ![justify-content:center] ![flex-shrink:0] ![font-weight:700]`}
      >
        {correct ? '✓' : '✕'}
      </span>
      <div>
        <div className={`![font-weight:700] ${correct ? '![color:var(--st-ok-text)]' : '![color:var(--st-err-text)]'}`}>{title}</div>
        <div className="![font-size:13px] ![color:var(--edu-t2)] ![margin-top:4px]">{explanation}</div>
      </div>
    </div>
  );
}
