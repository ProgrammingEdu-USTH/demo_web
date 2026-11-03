// Nhóm (app): các trang có vỏ AppShell (sidebar/rail/topbar/bottom-nav).
// KHÔNG gồm /playground và /arena (agent playground sở hữu, tự dựng vỏ) và trang bài học (chế độ tập trung).
// Chỉ còn CSS của trợ lý AI nổi (chatbot, PAGES.md: giữ). CSS/JS legacy của tab "Lộ trình" do HubRoute tự nạp
// khi mở tab đó — các trang khác dùng token mới, không kéo hai hệ chữ/màu chồng nhau.
import AppShell from '@/components/AppShell';
import Chatbot from '@/components/Chatbot';
import LegacyScripts from '@/components/LegacyScripts';
import PageStyles from '@/components/PageStyles';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageStyles hrefs={["/static/css/chatbot.css"]} />
      <link rel="stylesheet" href="/static/vendor/fontawesome/css/all.min.css" />
      <AppShell>{children}</AppShell>
      {/* Đặt ở layout (không remount khi đổi trang trong nhóm) vì chatbot.js bắt phần tử DOM một lần lúc nạp. */}
      <Chatbot />
      <LegacyScripts srcs={['/static/js/chatbot.js']} />
    </>
  );
}
