import {
  ArgumentsHost,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions/all-exceptions.filter';
import { PrismaExceptionFilter } from 'src/common/filters/prisma-exception/prisma-exception.filter';
import { redactQuery } from './redact-url';

const hostFor = (url: string) => {
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnValue({ json }) };
  const request = { method: 'GET', url, originalUrl: url, requestId: 'r1' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
};

describe('redactQuery', () => {
  it('che token, mật khẩu, email, số điện thoại; giữ path và tham số thường', () => {
    expect(redactQuery('/auth/logout?refresh=abc&page=2')).toBe(
      '/auth/logout?refresh=%5BREDACTED%5D&page=2',
    );
    expect(redactQuery('/x?Email=a@b.c&phone=0912&q=ok')).not.toMatch(
      /a%40b|0912/,
    );
    expect(redactQuery('/courses')).toBe('/courses');
  });
});

describe('log lỗi 5xx không rò thông tin cá nhân', () => {
  const URL_WITH_SECRET =
    '/auth/logout?refresh=SECRET-TOKEN-123&email=nguoi@dung.vn';
  let logged: string;
  beforeEach(() => {
    logged = '';
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((...a: unknown[]) => {
        logged += a.map(String).join(' ');
      });
  });
  afterEach(() => jest.restoreAllMocks());

  it('AllExceptionsFilter che query string trong dòng log', () => {
    new AllExceptionsFilter().catch(
      new InternalServerErrorException('hỏng'),
      hostFor(URL_WITH_SECRET),
    );
    expect(logged).toContain('/auth/logout');
    expect(logged).not.toContain('SECRET-TOKEN-123');
    expect(logged).not.toContain('nguoi@dung.vn');
  });

  it('PrismaExceptionFilter không ghi giá trị tham số trong message/stack của Prisma', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.user.create()` invocation: data: { email: "nguoi@dung.vn", password: "scrypt:HASH-BI-MAT" }',
      { code: 'P2025', clientVersion: 'test' },
    );
    new PrismaExceptionFilter().catch(err, hostFor(URL_WITH_SECRET));
    expect(logged).toContain('Prisma P2025');
    expect(logged).not.toContain('nguoi@dung.vn');
    expect(logged).not.toContain('HASH-BI-MAT');
    expect(logged).not.toContain('SECRET-TOKEN-123');
  });
});
