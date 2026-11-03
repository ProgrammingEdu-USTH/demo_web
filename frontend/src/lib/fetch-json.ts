import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

/** GET JSON qua apiFetch (proxy /backend + Bearer + refresh); non-2xx → ném lỗi để UI hiện "Thử lại". */
export async function fetchJson<T = unknown>(path: string): Promise<T> {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export type Remote<T> = { state: 'loading' } | { state: 'error' } | { state: 'ok'; data: T };

/**
 * Tải một khối dữ liệu độc lập: mỗi khối tự có trạng thái tải/lỗi/xong, nên một API chậm hoặc hỏng
 * không kéo cả trang theo. `reload` đặt lại về "loading" rồi gọi lại (nút Thử lại);
 * đổi `version` thì tải lại ÂM THẦM (giữ dữ liệu cũ trên màn hình, không nháy skeleton).
 */
export function useRemote<T>(load: () => Promise<T>, version = 0): [Remote<T>, () => void] {
  const [res, setRes] = useState<Remote<T>>({ state: 'loading' });
  const [tick, setTick] = useState(0);
  // `load` thường là hàm tạo mới mỗi lần render → giữ trong ref, chỉ chạy lại khi tick/version đổi.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => {
    let alive = true;
    loadRef.current().then(
      (data) => { if (alive) setRes({ state: 'ok', data }); },
      () => { if (alive) setRes({ state: 'error' }); },
    );
    return () => { alive = false; };
  }, [tick, version]);
  const reload = useCallback(() => { setRes({ state: 'loading' }); setTick((t) => t + 1); }, []);
  return [res, reload];
}

/** Lỗi API đã bóc thông điệp tiếng Việt từ NestJS ({error:{message,fields}}) hoặc {message}. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) {
    super(message);
  }
}

/** Gửi POST/PUT/DELETE JSON; non-2xx → ApiError mang đúng câu báo lỗi của backend để hiện dưới ô nhập. */
export async function sendJson<T = unknown>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await apiFetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Vui lòng thử lại.', 0);
  }
  const data = (await r.json().catch(() => ({}))) as {
    error?: string | { message?: string | string[]; fields?: Record<string, string> };
    message?: string | string[];
  };
  if (!r.ok) {
    const e = data.error;
    const raw = (typeof e === 'object' ? e?.message : e) ?? data.message;
    const msg = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(msg || 'Có lỗi xảy ra, vui lòng thử lại.', r.status, typeof e === 'object' ? (e?.fields ?? {}) : {});
  }
  return data as T;
}

/** "5 phút trước", "2 ngày trước"… cho thời gian bài viết. */
export function timeAgo(iso: string | Date): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
