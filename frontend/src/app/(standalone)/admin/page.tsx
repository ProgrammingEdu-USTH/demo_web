// Trang quản trị: vỏ AppShell + AdminConsole (React thuần, thay admin.inline.js).
// Backend vẫn chốt quyền: mọi /api/admin/* trả 403 nếu không phải admin (AdminConsole hiện ErrorState).
// Nằm ở (standalone) để không đổi đường dẫn file; AppShell tự dựng điều hướng.
import AppShell from '@/components/AppShell';
import AdminConsole from '@/components/admin/AdminConsole';

export const metadata = { title: 'Quản trị | Programming EDU' };

export default function AdminPage() {
  return (
    <AppShell>
      <AdminConsole />
    </AppShell>
  );
}
