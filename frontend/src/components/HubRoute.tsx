'use client';

// Route của nhóm (app) cho /dashboard và /courses (community/profile/settings đã có view React riêng).
// Tab con (?tab=) là link thật: chia sẻ URL / nút Back / mở tab mới đều chạy (PAGES.md §2).
// Hai tab đều là React thuần (CoursesList, RoadmapView); không còn nạp CSS/JS legacy.
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import CoursesList from '@/components/CoursesList';
import DashboardHead from '@/components/DashboardHead';
import DashboardPanels from '@/components/DashboardPanels';
import { Skeleton, TabNav, TabNavLink } from '@/components/ui';

// ssr:false: view đọc localStorage (ghim/tiến độ) ngay khi khởi tạo, và dữ liệu 26 lộ trình chỉ tải khi mở tab này.
const RoadmapView = dynamic(() => import('@/components/roadmap/RoadmapView'), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Đang tải lộ trình" className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  ),
});

export type HubRouteName = 'dashboard' | 'courses';

function Inner({ route }: { route: HubRouteName }) {
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') ?? '';
  if (route === 'dashboard') {
    return (
      <>
        <DashboardHead />
        <DashboardPanels />
      </>
    );
  }
  const roadmap = tab === 'roadmap';
  const tabs = [
    { id: '', label: 'Khoá học', active: !roadmap },
    { id: 'roadmap', label: 'Lộ trình của tôi', active: roadmap },
  ];
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <TabNav label="Mục con">
          {tabs.map((t) => (
            <TabNavLink key={t.id} href={t.id ? `${pathname}?tab=${t.id}` : pathname} active={t.active}>
              {t.label}
            </TabNavLink>
          ))}
        </TabNav>
      </div>
      {roadmap ? (
        <RoadmapView />
      ) : (
        <CoursesList />
      )}
    </>
  );
}

export default function HubRoute({ route }: { route: HubRouteName }) {
  return (
    // useSearchParams cần Suspense để trang vẫn prerender được.
    <Suspense fallback={null}>
      <Inner route={route} />
    </Suspense>
  );
}
