import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { PythonRunnerAccessGuard } from './python-runner-access.guard';

// Chốt hành vi: PY_RUNNER_PUBLIC bật thì không chạm tới passport, tắt/thiếu thì
// vẫn đòi JWT (fail-closed). Giả lập AuthGuard('jwt').canActivate để khỏi dựng cả
// passport — việc cần chứng minh là guard CÓ nhường cho nó hay không.
function makeGuard(value: unknown) {
  const config = { get: () => value } as unknown as ConfigService;
  return new PythonRunnerAccessGuard(config);
}

describe('PythonRunnerAccessGuard', () => {
  const ctx = {} as ExecutionContext;
  let jwtCanActivate: jest.SpyInstance;

  beforeEach(() => {
    const jwtProto = Object.getPrototypeOf(
      PythonRunnerAccessGuard.prototype,
    ) as { canActivate: () => unknown };
    jwtCanActivate = jest.spyOn(jwtProto, 'canActivate').mockReturnValue(false);
  });
  afterEach(() => jest.restoreAllMocks());

  it('PY_RUNNER_PUBLIC=true (boolean hoặc chuỗi): cho qua, không gọi JWT', () => {
    expect(makeGuard(true).canActivate(ctx)).toBe(true);
    expect(makeGuard('true').canActivate(ctx)).toBe(true);
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it.each([false, 'false', undefined, '', 'TRUE', 1])(
    'PY_RUNNER_PUBLIC=%p: nhường cho AuthGuard("jwt") (vẫn đòi đăng nhập)',
    (value) => {
      expect(makeGuard(value).canActivate(ctx)).toBe(false);
      expect(jwtCanActivate).toHaveBeenCalledTimes(1);
    },
  );

  it('là AuthGuard("jwt"): cùng kiểu với guard JWT chuẩn của app', () => {
    expect(makeGuard(false)).toBeInstanceOf(AuthGuard('jwt'));
  });
});
