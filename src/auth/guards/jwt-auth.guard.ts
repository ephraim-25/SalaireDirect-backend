import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { CompanyContextService } from '../company-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard JWT global : TOUTE route exige un jeton Supabase valide, sauf celles marquées @Public().
 * Il renseigne ensuite request.user, request.accessToken, request.companyId et request.companyRole.
 *
 * (Ancienne version : sans jeton, ou avec un jeton invalide, la requête passait avec un
 * utilisateur « admin » fictif. Ce contournement a été supprimé.)
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentification requise.');
    }

    const token = header.substring(7).trim();
    if (token.split('.').length !== 3) {
      throw new UnauthorizedException('Jeton invalide.');
    }

    const { data, error } = await this.supabase.client.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException(
        'Session invalide ou expirée. Veuillez vous reconnecter.',
      );
    }

    const { companyId, role } = await this.companyContext.resolve(
      data.user,
      token,
    );

    request.user = data.user;
    request.accessToken = token;
    request.companyId = companyId;
    request.companyRole = role;
    return true;
  }
}
