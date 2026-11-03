'use client';

import Link from 'next/link';
import { use } from 'react';

import { ArenaFocusFrame } from '@/components/arena/ArenaShell';
import MatchView from '@/components/arena/MatchView';
import { ErrorState, buttonVariants } from '@/components/ui';

// Next 16: `params` là Promise → đọc bằng React `use()` trong Client Component.
export default function ArenaMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const matchId = /^[1-9]\d{0,9}$/.test(id) ? Number(id) : null;
  if (matchId === null) {
    return (
      <ArenaFocusFrame pageTitle="Không tìm thấy trận">
        <ErrorState
          title="Không tìm thấy trận"
          description="Mã trận không hợp lệ."
          action={<Link href="/arena" className={buttonVariants({ variant: 'primary' })}>Về sảnh</Link>}
        />
      </ArenaFocusFrame>
    );
  }
  return <MatchView matchId={matchId} />;
}
