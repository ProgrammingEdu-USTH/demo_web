// Layout nhóm (base): landing và /arena đều đã dùng token + components/ui (arena qua AppShell),
// nên KHÔNG nạp CSS legacy (theme/auth/chatbot/fonts/Font Awesome) nữa — tải thừa và có thể đè style
// ngoài `ui-scope`. Script chống nháy chủ đề nằm ở layout GỐC (src/app/layout.tsx).
export default function BaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
