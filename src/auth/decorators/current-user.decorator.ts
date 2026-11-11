import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur @CurrentUser() - Extrait l'utilisateur authentifié de la requête.
 * Usage: @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Décorateur @AccessToken() - Extrait le token JWT de la requête.
 */
export const AccessToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.accessToken;
  },
);
