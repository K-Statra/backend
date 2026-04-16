import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';

function makeContext(token: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-admin-token': token } }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminTokenGuard', () => {
  let guard: AdminTokenGuard;

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'secret';
    guard = new AdminTokenGuard();
  });

  afterAll(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it('유효한 토큰 → true 반환', () => {
    expect(guard.canActivate(makeContext('secret'))).toBe(true);
  });

  it('잘못된 토큰 → UnauthorizedException', () => {
    expect(() => guard.canActivate(makeContext('wrong'))).toThrow(UnauthorizedException);
  });

  it('토큰 미전송 → UnauthorizedException', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
  });

  it('ADMIN_TOKEN 환경변수 미설정 → UnauthorizedException', () => {
    delete process.env.ADMIN_TOKEN;
    expect(() => guard.canActivate(makeContext('secret'))).toThrow(UnauthorizedException);
  });
});
