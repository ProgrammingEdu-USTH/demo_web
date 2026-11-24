import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_CODE_BYTES } from '../sandbox/docker-sandbox';
import { TRACE_BEGIN, TRACE_END } from './trace-program';
import { TRACER_SOURCE, TRACER_SOURCE_SHA256 } from './tracer-source';

/**
 * Canh lệch giữa `pe_tracer.py` (nguồn, chạy được, test được bằng `py`) và
 * `tracer-source.ts` (bản nhúng mà backend thật sự gửi đi).
 *
 * Vì sao cần: hai bản mà lệch nhau thì bộ test Python vẫn xanh trên bản .py
 * trong khi người học nhận bản .ts cũ — đúng kiểu lỗi không ai phát hiện được.
 * Băm file .py rồi so với con số đã ghi lúc sinh: sửa .py mà quên chạy
 * `node scripts/build-tracer-source.mjs` là `npx jest` đỏ ngay.
 *
 * Bằng chứng test bắt được lỗi thật: thêm một dòng vào pe_tracer.py mà không
 * sinh lại → 1 ca trượt, kèm đúng lệnh phải chạy.
 */
describe('tracer-source.ts — bản nhúng phải khớp pe_tracer.py', () => {
  const python = readFileSync(join(__dirname, 'pe_tracer.py'), 'utf8').replace(
    /\r\n/g,
    '\n',
  );

  // Trượt ca này nghĩa là: đã sửa pe_tracer.py nhưng chưa chạy
  //   node scripts/build-tracer-source.mjs
  it('SHA-256 của pe_tracer.py khớp con số ghi trong bản nhúng (quên sinh lại là đỏ)', () => {
    const sha = createHash('sha256').update(python, 'utf8').digest('hex');
    expect(sha).toBe(TRACER_SOURCE_SHA256);
  });

  it('bản nhúng còn đủ phần cốt lõi sau khi rút gọn chú thích', () => {
    expect(TRACER_SOURCE).toContain('def _pe_run(');
    expect(TRACER_SOURCE).toContain('sys.settrace');
    expect(TRACER_SOURCE).toContain('SIGALRM');
    // Bỏ chú thích KHÔNG được bỏ thông điệp cho người học.
    expect(TRACER_SOURCE).toContain('stdin');
  });

  it('mốc JSON ở hai bên phải là cùng một chuỗi', () => {
    expect(TRACER_SOURCE).toContain(TRACE_BEGIN);
    expect(TRACER_SOURCE).toContain(TRACE_END);
  });

  it('bản nhúng phải còn chỗ cho mã người học trong trần 20 KB', () => {
    const bytes = Buffer.byteLength(TRACER_SOURCE, 'utf8');
    // Cần ít nhất ~5 KB cho mã người học sau khi nén; dưới mức đó thì tính năng
    // vô dụng và phải rút gọn tracer, không phải nâng trần của POST /run.
    expect(bytes).toBeLessThan(MAX_CODE_BYTES - 5 * 1024);
  });

  it('không còn chú thích tiếng Việt (nguồn phình 27 KB, bản gửi đi ~13 KB)', () => {
    expect(TRACER_SOURCE.includes('# Vì sao')).toBe(false);
    expect(Buffer.byteLength(TRACER_SOURCE, 'utf8')).toBeLessThan(
      Buffer.byteLength(python, 'utf8'),
    );
  });
});
