import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Décorateur @CurrentUser() - Utilisateur authentifié (vérifié par JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/** Décorateur @AccessToken() - Jeton JWT Supabase de la requête (déjà vérifié). */
export const AccessToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.accessToken;
  },
);

/**
 * Décorateur @CompanyId() - Entreprise de l'utilisateur, déterminée côté serveur.
 * Ne jamais lui préférer un identifiant d'entreprise envoyé par le client.
 */
export const CompanyId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.companyId as string;
  },
);
