'use client';

// Bài HTML/CSS "Thiết kế responsive": viết lại bằng MissionLesson (bố cục chung với java).
// Bỏ lesson_htmlcss.inline.js / lesson.css legacy; API vẫn là POST /api/mission/complete {mission_id:'htmlcss'}.
import MissionLesson, { type MissionConfig } from '@/components/MissionLesson';

const CFG: MissionConfig = {
  missionId: 'htmlcss',
  title: 'HTML/CSS — Thiết kế responsive',
  intro: 'Kéo các khối để CSS quyết định layout nào phù hợp với màn hình điện thoại.',
  windowLabel: 'CSS Breakpoint',
  codeLines: [
    { text: 'screen_width = 480  # px' },
    { text: '# Breakpoint mobile: 768px' },
    { text: 'if {slot}:', slot: 'cond' },
    { text: '{slot}', slot: 'act', indent: true },
    { text: 'else:' },
    { text: 'desktop_view()', indent: true },
  ],
  elseLine: '"desktop_view()"',
  blocks: [
    { id: 'c1', kind: 'cond', label: 'width < 768px', value: 'width < 768' },
    { id: 'c2', kind: 'cond', label: 'width > 1200px', value: 'width > 1200' },
    { id: 'a1', kind: 'act', label: 'Mobile view', value: 'mobile_view()' },
    { id: 'a2', kind: 'act', label: 'Desktop view', value: 'desktop_view()' },
  ],
  firstHint: "Hãy kéo 'width < 768px' — màn hình 480px là mobile!",
  wrongHint: 'Gợi ý: 480px < 768px → dùng mobile layout!',
  okOutput: '480px < 768px → Mobile layout được áp dụng.',
  doneMessage: 'Bạn đã hiểu CSS responsive breakpoint rồi! +50 XP',
};

export default function LessonHtmlcssPage() {
  return <MissionLesson cfg={CFG} />;
}
