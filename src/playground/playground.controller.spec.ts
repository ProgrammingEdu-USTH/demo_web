import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorators';
import { SnippetDto } from './dto/snippet.dto';
import { PlaygroundController } from './playground.controller';

const proto = PlaygroundController.prototype as unknown as Record<string, any>;
const routes = Object.getOwnPropertyNames(proto)
  .filter((n) => n !== 'constructor')
  .map((n) => ({
    name: n,
    path: Reflect.getMetadata('path', proto[n]) as string,
    method: Reflect.getMetadata('method', proto[n]) as number,
  }));

describe('PlaygroundController', () => {
  it('tiền tố playground, không @Public()', () => {
    expect(Reflect.getMetadata('path', PlaygroundController)).toBe(
      'playground',
    );
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PlaygroundController),
    ).toBeUndefined();
    for (const r of routes) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto[r.name])).toBeUndefined();
    }
  });

  it('đủ 4 route (GET=0 POST=1 PUT=2 DELETE=3)', () => {
    expect(routes.map((r) => `${r.method}:${r.path}`).sort()).toEqual([
      '0:snippets',
      '1:snippets',
      '2:snippets/:id',
      '3:snippets/:id',
    ]);
  });

  it('uỷ quyền cho service kèm userId', () => {
    const svc = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const c = new PlaygroundController(svc as never);
    const d = { title: 't', language: 'sql', code: 'x' } as SnippetDto;
    c.list(5);
    c.create(5, d);
    c.update(5, 9, d);
    c.remove(5, 9);
    expect(svc.list).toHaveBeenCalledWith(5);
    expect(svc.create).toHaveBeenCalledWith(5, d);
    expect(svc.update).toHaveBeenCalledWith(5, 9, d);
    expect(svc.remove).toHaveBeenCalledWith(5, 9);
  });

  it('DTO: hợp lệ qua; ngôn ngữ lạ / rỗng / NUL / >100KB bị chặn', async () => {
    const ok = { title: 't', language: 'web', code: '<p>x</p>' };
    const errs = async (o: object) =>
      (await validate(plainToInstance(SnippetDto, o))).length;
    expect(await errs(ok)).toBe(0);
    expect(await errs({ ...ok, language: 'ruby' })).toBeGreaterThan(0);
    expect(await errs({ ...ok, title: '' })).toBeGreaterThan(0);
    expect(await errs({ ...ok, code: 'a\u0000b' })).toBeGreaterThan(0);
    expect(await errs({ ...ok, code: 'a'.repeat(102401) })).toBeGreaterThan(0);
  });
});
