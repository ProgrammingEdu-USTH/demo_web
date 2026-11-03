'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ArenaApiError, describeArenaError, redirectToLogin } from '@/lib/arena-api';

/** Xử lý lỗi chung: 401 → đăng nhập lại; còn lại trả thông điệp tiếng Việt. */
export function messageOf(e: unknown): string {
  if (e instanceof ArenaApiError && e.status === 401) {
    redirectToLogin();
    return 'Cần đăng nhập…';
  }
  return describeArenaError(e);
}

/** Tải dữ liệu một lần (và khi gọi reload). `fn` đổi giữa các lần render không kích hoạt tải lại. */
export function useLoad<T>(fn: () => Promise<T>) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const invalidate = useCallback(() => {
    seq.current++;
  }, []);

  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fnRef.current();
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError(messageOf(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);

  return { data, error, loading, reload };
}
