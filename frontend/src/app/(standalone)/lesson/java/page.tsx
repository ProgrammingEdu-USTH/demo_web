'use client';

// Bài Java "Bảo vệ cổng vào": viết lại bằng MissionLesson (bố cục chung với htmlcss).
// Bỏ lesson_java.inline.js / lesson.css legacy; API vẫn là POST /api/mission/complete {mission_id:'java'}.
import MissionLesson, { type MissionConfig } from '@/components/MissionLesson';

const CFG: MissionConfig = {
  missionId: 'java',
  title: 'Java — Kiểm tra quyền truy cập',
  intro: 'Kéo các khối lệnh để Java quyết định ai được phép truy cập hệ thống.',
  windowLabel: 'Java 21 JVM',
  codeLines: [
    { text: 'int age = 20;' },
    { text: 'if ({slot}) {', slot: 'cond' },
    { text: '{slot};', slot: 'act', indent: true },
    { text: '} else {' },
    { text: 'access_denied();', indent: true },
    { text: '}' },
  ],
  elseLine: '"access_denied()"',
  blocks: [
    { id: 'c1', kind: 'cond', label: 'age >= 18', value: 'age >= 18' },
    { id: 'c2', kind: 'cond', label: 'age < 5', value: 'age < 5' },
    { id: 'a1', kind: 'act', label: 'Cho vào', value: 'access_granted()' },
    { id: 'a2', kind: 'act', label: 'Từ chối', value: 'access_denied()' },
  ],
  firstHint: "Hãy kéo thử khối 'age >= 18' vào ô điều kiện nhé!",
  wrongHint: 'Gợi ý: age = 20 — nên cho vào nếu age >= 18!',
  okOutput: 'age = 20 >= 18. Quyền truy cập được cấp — ACCESS GRANTED.',
  doneMessage: 'Bạn đã hiểu câu lệnh điều kiện Java rồi! +50 XP',
};

export default function LessonJavaPage() {
  return <MissionLesson cfg={CFG} />;
}
