/**
 * playground-api.ts — client cho API snippets (src/playground) và đề Arena dùng trong Playground.
 * Mọi lời gọi qua apiFetch (token + refresh 401). Backend chỉ cho chủ sở hữu xem snippet
 * (không có chế độ công khai) nên Playground KHÔNG có nút "chia sẻ liên kết".
 */
import { apiFetch } from '@/lib/api';
import type { PlaygroundDoc } from '@/lib/playground-samples';

export type SnippetLang = 'python' | 'web' | 'sql';

export type Snippet = {
  id: number;
  title: string;
  language: SnippetLang;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export class AuthRequired extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (res.status === 401) throw new AuthRequired('Cần đăng nhập');
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const m = data?.message ?? (data?.error as { message?: unknown } | undefined)?.message;
    throw new Error(Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : 'Có lỗi xảy ra, thử lại sau.');
  }
  return data as T;
}

export const listSnippets = () =>
  call<{ snippets: Snippet[] }>('/api/playground/snippets').then((r) => r.snippets);

type Body = { title: string; language: SnippetLang; code: string };

export const createSnippet = (b: Body) =>
  call<{ snippet: Snippet }>('/api/playground/snippets', { method: 'POST', body: JSON.stringify(b) }).then(
    (r) => r.snippet,
  );

export const updateSnippet = (id: number, b: Body) =>
  call<{ snippet: Snippet }>(`/api/playground/snippets/${id}`, { method: 'PUT', body: JSON.stringify(b) }).then(
    (r) => r.snippet,
  );

export const deleteSnippet = (id: number) =>
  call<unknown>(`/api/playground/snippets/${id}`, { method: 'DELETE' });

// Snippet chỉ có một chuỗi `code`: web (3 tệp) được gói thành JSON, python để nguyên.
export function docToSnippet(doc: PlaygroundDoc): Pick<Body, 'language' | 'code'> {
  if (doc.lang === 'python') return { language: 'python', code: doc.python };
  return { language: 'web', code: JSON.stringify({ html: doc.html, css: doc.css, js: doc.js }) };
}

export function snippetToDoc(s: Snippet, base: PlaygroundDoc): PlaygroundDoc | null {
  if (s.language === 'python') return { ...base, lang: 'python', python: s.code };
  if (s.language === 'web') {
    try {
      const o = JSON.parse(s.code) as Record<string, unknown>;
      const pick = (v: unknown, f: string) => (typeof v === 'string' ? v : f);
      return { ...base, lang: 'web', html: pick(o.html, ''), css: pick(o.css, ''), js: pick(o.js, '') };
    } catch {
      return null;
    }
  }
  return null; // sql: Playground chưa hỗ trợ
}

// ───────────── Đề Arena (?problem=<id>) ─────────────

export type PlaygroundProblem = {
  id: string;
  title: string;
  difficulty: string;
  statement: string;
  signature: string;
  starterCode: string;
  sampleTests: { args: unknown[]; expected: unknown }[];
};

// Gọi trực tiếp thay vì arena-api.ts: ở đó kiểu Problem còn dùng `examples`, backend thật trả `sampleTests`.
export async function fetchProblem(id: string): Promise<PlaygroundProblem | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  try {
    const r = await call<{ problem?: PlaygroundProblem }>(`/api/arena/problems/${encodeURIComponent(id)}`);
    const p = r.problem;
    if (!p || typeof p.starterCode !== 'string' || !Array.isArray(p.sampleTests)) return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Mã Python nối vào SAU code của người học để chạy các ví dụ mẫu (nối sau nên số dòng lỗi của
 * người học không bị lệch). Test được nhúng bằng JSON hai lớp → thành literal chuỗi Python hợp lệ.
 */
export function buildSampleHarness(p: PlaygroundProblem): string {
  const fn = /def\s+([A-Za-z_]\w*)/.exec(p.signature)?.[1] ?? 'solve';
  const payload = JSON.stringify(JSON.stringify(p.sampleTests));
  return `

# ── Chạy các ví dụ mẫu (do Playground thêm vào, không nằm trong code của bạn) ──
import json as _json
_tests = _json.loads(${payload})
_ok = 0
for _i, _t in enumerate(_tests, 1):
    try:
        _got = ${fn}(*_t["args"])
    except Exception as _e:
        print(f"✗ Ví dụ {_i}: lỗi {type(_e).__name__}: {_e}")
        continue
    if _got == _t["expected"]:
        _ok += 1
        print(f"✓ Ví dụ {_i}: đúng")
    else:
        print(f"✗ Ví dụ {_i}: nhận {_got!r}, cần {_t['expected']!r} (đầu vào {_t['args']!r})")
print(f"Đạt {_ok}/{len(_tests)} ví dụ mẫu")
`;
}
