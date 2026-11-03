import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';

// Định nghĩa font MỘT chỗ (mỗi lần gọi hàm font là một bản tự host riêng).
// next/font tải file lúc build và phục vụ cùng origin — không hotlink Google.
// Be Vietnam Pro: thiết kế cho tiếng Việt, dấu chồng tầng rõ; chỉ 3 độ đậm để nhẹ.
export const fontUi = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-ui',
});

// Font code: JetBrains Mono (font biến thiên → không cần liệt kê độ đậm).
export const fontCode = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-code',
});

/** Gắn lên <html> ở layout gốc: `<html className={fontVariables}>`. */
export const fontVariables = `${fontUi.variable} ${fontCode.variable}`;
