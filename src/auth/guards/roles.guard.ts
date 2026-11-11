import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard Rôles - Vérifie que l'utilisateur a le rôle requis pour l'entreprise courante.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const companyRole = request.companyRole;

    if (!companyRole || !requiredRoles.includes(companyRole)) {
      throw new ForbiddenException(
        `Accès refusé. Rôle requis: ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
