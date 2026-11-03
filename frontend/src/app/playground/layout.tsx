import '../globals.css';

import type { Metadata } from 'next';

import { fontVariables } from '@/components/ui/fonts';

export const metadata: Metadata = {
  title: 'Playground · Programming EDU',
  description: 'Viết và chạy thử Python, HTML, CSS, JavaScript ngay trên trình duyệt — không cần cài đặt.',
};

// Tạm thời tự nạp token + font vì vỏ ứng dụng mới (F-01) chưa gắn vào layout gốc.
// Khi F-01 xong, import globals.css lặp lại vô hại; chỉ cần gỡ lớp font nếu vỏ đã tự gắn.
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontVariables}>{children}</div>;
}
