'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ArenaApiError, arenaApi } from '@/lib/arena-api';
import type { Match } from '@/lib/arena-api';
import { clockOffset, pollDelayMs } from '@/lib/arena-utils';
import { messageOf } from './useLoad';

/**
 * Poll GET /matches/:id: 3 s (5 s khi tab ẩn), không chồng request (đợi xong mới hẹn lần kế),
 * dừng khi finished|cancelled hoặc 404. `offset` = serverTime − Date.now() của lần nhận gần nhất.
 */
export function useMatchPoll(matchId: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const stoppedRef = useRef(false);

  /** Nhận trận mới (từ poll hoặc từ phản hồi của nộp/đầu hàng/huỷ). */
  const apply = useCallback((m: Match, serverTime?: string) => {
    setMatch(m);
    if (serverTime) setOffset(clockOffset(serverTime));
    if (m.status === 'finished' || m.status === 'cancelled') stoppedRef.current = true;
  }, []);

  const tickRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    tickRef.current = async () => {
      if (inflightRef.current || stoppedRef.current) return;
      inflightRef.current = true;
      try {
        const env = await arenaApi.match(matchId);
        if (!aliveRef.current) return;
        apply(env.match, env.serverTime);
        setError(null);
      } catch (e) {
        if (!aliveRef.current) return;
        if (e instanceof ArenaApiError && e.status === 404) {
          stoppedRef.current = true;
          setNotFound(true);
        } else {
          setError(messageOf(e));
        }
      } finally {
        inflightRef.current = false;
      }
      if (aliveRef.current && !stoppedRef.current) {
        timerRef.current = setTimeout(() => void tickRef.current(), pollDelayMs(document.hidden));
      }
    };
  }, [matchId, apply]);

  useEffect(() => {
    aliveRef.current = true;
    stoppedRef.current = false;
    void tickRef.current();
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [matchId]);

  /** Hỏi lại ngay (vd. đồng hồ về 0, hoặc 409 MATCH_NOT_ACTIVE) mà không phá nhịp poll. */
  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stoppedRef.current = false;
    await tickRef.current();
  }, []);

  return { match, offset, error, notFound, apply, refresh };
}
