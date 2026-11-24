import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map } from 'rxjs';

const VERSION = Symbol('http-cache-version');

/** Metadata không tuần tự hoá ra JSON; version chỉ gồm cột nhỏ, không băm content_json. */
export function cacheVersion<T extends object>(body: T, version: unknown): T {
  Object.defineProperty(body, VERSION, { value: version });
  return body;
}

export function matchesTag(header: string | undefined, tag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  if (
    !/^\s*(?:W\/)?"[^"\r\n]*"(?:\s*,\s*(?:W\/)?"[^"\r\n]*")*\s*$/.test(header)
  )
    return false;
  const tags = header.match(/(?:W\/)?"[^"\r\n]*"|\*/g) ?? [];
  return tags.some(
    (t) => t === '*' || t.replace(/^W\//, '') === tag.replace(/^W\//, ''),
  );
}

/** Chỉ xét 304 SAU khi guard và service đã kiểm quyền. Mọi route khác no-store. */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: number } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    return next.handle().pipe(
      map((body: unknown) => {
        if (
          req.method !== 'GET' ||
          !body ||
          typeof body !== 'object' ||
          !(VERSION in body)
        ) {
          // Express tự biến If-None-Match:* thành 304 ngay cả khi đã tắt etag.
          // Route không có hợp đồng cache phải luôn trả body mới (tiến độ, phiên).
          delete req.headers['if-none-match'];
          delete req.headers['if-modified-since'];
          return body;
        }
        const version = body[VERSION];
        const digest = createHash('sha256')
          .update(JSON.stringify([req.originalUrl, req.user?.sub, version]))
          .digest('hex');
        const tag = `W/"${digest}"`;
        res.setHeader('ETag', tag);
        res.setHeader('Cache-Control', 'private, no-cache');
        res.vary('Authorization');
        res.vary('Cookie');
        if (matchesTag(req.get('If-None-Match'), tag)) {
          res.status(304);
          return undefined;
        }
        return body;
      }),
    );
  }
}
