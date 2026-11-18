import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro, JetBrains_Mono, Patrick_Hand } from "next/font/google";
import "@/styles/goc-hoc/tokens.css";
import "@/styles/goc-hoc/room.css";
import "@/styles/goc-hoc/hud.css";
import "@/styles/goc-hoc/pages.css";

/* next/font tải 4 font (tự host, subset tiếng Việt) và khai báo @font-face với đúng tên font gốc;
   tokens.css dùng các tên đó trong --f-display, --f-body, --f-mono, --f-hand (xem lý do ở tokens.css). */
const baloo = Baloo_2({
  variable: "--font-baloo-2",
  subsets: ["vietnamese", "latin"],
  weight: ["500", "600", "700"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick-hand",
  subsets: ["vietnamese", "latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Góc học PE",
  description: "Góc học của Programming EDU: căn phòng học lofi, mỗi đồ vật là một lối vào bài học.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${baloo.variable} ${beVietnam.variable} ${jetbrainsMono.variable} ${patrickHand.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
