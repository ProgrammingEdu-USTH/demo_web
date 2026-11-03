/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- Prisma giả trong test */
import 'reflect-metadata';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorators';
import { ArenaController } from './arena.controller';

const proto = ArenaController.prototype as unknown as Record<string, any>;
const routes = Object.getOwnPropertyNames(proto)
  .filter((n) => n !== 'constructor')
  .map((n) => ({
    name: n,
    path: Reflect.getMetadata('path', proto[n]) as string,
    method: Reflect.getMetadata('method', proto[n]) as number,
  }));

describe('ArenaController', () => {
  it('tiền tố arena, không @Public()', () => {
    expect(Reflect.getMetadata('path', ArenaController)).toBe('arena');
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ArenaController)).toBeUndefined();
    for (const r of routes) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto[r.name])).toBeUndefined();
    }
  });

  it('GET matches/current khai báo TRƯỚC GET matches/:id', () => {
    const idx = (p: string) =>
      routes.findIndex((r) => r.path === p && r.method === 0);
    expect(idx('matches/current')).toBeGreaterThanOrEqual(0);
    expect(idx('matches/:id')).toBeGreaterThanOrEqual(0);
    expect(idx('matches/current')).toBeLessThan(idx('matches/:id'));
  });

  it('đủ route theo openapi', () => {
    const have = routes.map((r) => `${r.method}:${r.path}`).sort();
    // method: GET=0, POST=1
    expect(have).toEqual(
      [
        '0:problems',
        '0:problems/:id',
        '0:me',
        '1:rooms',
        '1:rooms/join',
        '1:queue',
        '0:matches/current',
        '0:matches/:id',
        '1:matches/:id/cancel',
        '1:matches/:id/forfeit',
        '1:matches/:id/submissions',
        '0:matches/:id/submissions',
        '0:history',
        '0:leaderboard',
      ].sort(),
    );
  });

  it('route poll và join/submit có @Throttle ghi đè cả ip_hour và ip_day', () => {
    const limit = (fn: string, tier: string, key: 'limit' | 'ttl') =>
      Reflect.getMetadata(`THROTTLER:${key.toUpperCase()}${tier}`, proto[fn]);
    for (const fn of ['current', 'match']) {
      expect(limit(fn, 'ip_hour', 'limit')).toBeGreaterThanOrEqual(4000);
      expect(limit(fn, 'ip_day', 'limit')).toBeGreaterThanOrEqual(40000);
    }
    expect(limit('joinRoom', 'ip_hour', 'limit')).toBe(10);
    expect(limit('submit', 'ip_hour', 'limit')).toBe(20);
    expect(limit('joinRoom', 'ip_day', 'limit')).toBeDefined();
    expect(limit('submit', 'ip_day', 'limit')).toBeDefined();
  });
});
