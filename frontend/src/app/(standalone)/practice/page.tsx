// Trang Ôn tập độc lập — vào thẳng /practice. Logic quiz và hợp đồng API nằm ở PracticeView.
// Nằm trong nhóm (standalone) (không đổi đường dẫn file) nên tự bọc AppShell; nav tô sáng mục "Khoá học".
import type { Metadata } from 'next';

import AppShell from '@/components/AppShell';
import PracticeView from '@/components/PracticeView';

export const metadata: Metadata = { title: 'Ôn tập — Programming EDU' };

export default function PracticePage() {
  return (
    <AppShell>
      <PracticeView />
    </AppShell>
  );
}
