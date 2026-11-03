// Arena dùng vỏ AppShell mới (sidebar/rail/bottom-nav); riêng /arena/match/* AppShell tự chuyển sang
// chế độ tập trung (isFocusPath) nên trận có toàn bộ màn hình cho đề + editor.
import AppShell from '@/components/AppShell';

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
