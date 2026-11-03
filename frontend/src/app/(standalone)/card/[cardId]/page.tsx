'use client';

// Port concept_card.html — trang card khái niệm chen giữa 2 bài (Option-2).
// Stateless; hydrate client-side từ lesson_content_tc/nc.js theo card_id —
// giữ nguyên cơ chế (inline script gốc → concept_card.inline.js, đọc
// document.body data-card-id như cũ).
import { use } from 'react';

import LegacyScripts from '@/components/LegacyScripts';
import LessonShell from '@/components/lesson/LessonShell';
import PageStyles from '@/components/PageStyles';

export default function ConceptCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = use(params);

  return (
    <>
      <PageStyles hrefs={['/static/css/pages/concept_card.inline.css', '/static/css/edu-theme.css', '/static/css/edu-card.css']} />
      <title>Concept Card</title>
      <link href="/static/vendor/fonts/fonts.css" rel="stylesheet" />
      <link rel="stylesheet" href="/static/vendor/fontawesome/css/all.min.css" />

      <LessonShell courseId="db_design_tc" title="Thẻ khái niệm" layout="fill" nav="none" chatbot={false}>
      <div className="cc-top">
        {/* Full-load có chủ đích (tổ hợp CSS khác trang đích) — không dùng <Link> */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="cc-back" id="cc-back-link" href="/courses/db_design_tc">← Về roadmap khóa học</a>
      </div>
      <div id="card-root"><div className="cc-missing">Đang mở hồ sơ…</div></div>

      </LessonShell>

      {/* <body data-card-id="{{ card_id }}"> của template gốc — set qua prepare
          (React không thực thi <script> trong JSX của client component) */}
      <LegacyScripts
        srcs={[
          '/static/js/lesson_content_tc.js',
          '/static/js/lesson_content_nc.js',
          '/static/js/pages/concept_card.inline.js',
        ]}
        prepare={() => document.body.setAttribute('data-card-id', cardId)}
      />
    </>
  );
}
