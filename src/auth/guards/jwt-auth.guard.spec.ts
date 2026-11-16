import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>, isPublic = false) {
  const request: Record<string, any> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
  return { request, context, reflector };
}

const FAKE_JWT = 'aaa.bbb.ccc';

describe('JwtAuthGuard', () => {
  const companyContext = { resolve: jest.fn() };
  const getUser = jest.fn();
  const supabase = { client: { auth: { getUser } } };

  beforeEach(() => jest.resetAllMocks());

  const build = (reflector: Reflector) =>
    new JwtAuthGuard(reflector, supabase as any, companyContext as any);

  it('laisse passer une route publique', async () => {
    const { context, reflector } = makeContext({}, true);
    await expect(build(reflector).canActivate(context)).resolves.toBe(true);
  });

  it('refuse une requête sans jeton (ancien comportement : administrateur fictif)', async () => {
    const { context, reflector } = makeContext({});
    await expect(build(reflector).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each(['dev-token', 'mock-token', 'undefined'])(
    'refuse le jeton factice « %s »',
    async (token) => {
      const { context, reflector } = makeContext({
        authorization: `Bearer ${token}`,
      });
      await expect(
        build(reflector).canActivate(context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it('refuse un jeton rejeté par Supabase (expiré / falsifié)', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid'),
    });
    const { context, reflector } = makeContext({
      authorization: `Bearer ${FAKE_JWT}`,
    });
    await expect(build(reflector).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("renseigne l'utilisateur et l'entreprise pour un jeton valide", async () => {
    const user = { id: 'u1', email: 'a@b.cd' };
    getUser.mockResolvedValue({ data: { user }, error: null });
    companyContext.resolve.mockResolvedValue({
      companyId: 'c1',
      role: 'admin',
    });
    const { request, context, reflector } = makeContext({
      authorization: `Bearer ${FAKE_JWT}`,
    });

    await expect(build(reflector).canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(user);
    expect(request.companyId).toBe('c1');
    expect(request.companyRole).toBe('admin');
    expect(request.accessToken).toBe(FAKE_JWT);
  });
});
