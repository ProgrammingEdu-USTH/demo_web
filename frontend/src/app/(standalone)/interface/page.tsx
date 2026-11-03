'use client';

// Bài C/C++ "Cứu nguy Robot": viết lại bằng MissionLesson (chung bố cục với Java/HTML-CSS), vào LessonShell.
// Bỏ interface.inline.js/css, FontAwesome, Tailwind CDN tĩnh và các màu cứng (#F7F9FC, #222222, #4AAE01) của bản cũ;
// thêm chạm-chọn cho điện thoại. API vẫn là POST /api/mission/complete {mission_id:'cpp'}.
import MissionLesson, { type MissionConfig } from '@/components/MissionLesson';

const CFG: MissionConfig = {
  missionId: 'cpp',
  title: 'C/C++ · Cứu nguy Robot',
  intro: 'Kéo các khối lệnh để giúp Robot quyết định khi nào cần sạc pin nhé.',
  windowLabel: 'Compiler v1.0.4',
  codeLines: [
    { text: 'battery_level = 15  # % pin hiện tại' },
    { text: 'if {slot}:', slot: 'cond' },
    { text: '{slot}', slot: 'act', indent: true },
    { text: 'else:' },
    { text: 'work_now()', indent: true },
  ],
  elseLine: '"Tiếp tục làm việc"',
  blocks: [
    { id: 'c1', kind: 'cond', label: 'Pin < 20%', value: 'pin < 20' },
    { id: 'c2', kind: 'cond', label: 'Pin > 80%', value: 'pin > 80' },
    { id: 'a1', kind: 'act', label: 'Về trạm sạc', value: 'charge()' },
    { id: 'a2', kind: 'act', label: 'Đi ngủ', value: 'sleep()' },
  ],
  firstHint: "Hãy kéo thử khối 'Pin < 20%' vào ô điều kiện xem sao!",
  wrongHint: "Gợi ý: Hãy chọn 'Pin < 20' và 'Về trạm sạc'!",
  okOutput: 'Pin đang ở mức 15%. Robot đang di chuyển về trạm sạc... VROOM VROOM!',
  doneMessage: 'Bạn đã giải được bài toán logic đầu tiên rồi đấy! +50 XP',
};

export default function InterfacePage() {
  return <MissionLesson cfg={CFG} />;
}
