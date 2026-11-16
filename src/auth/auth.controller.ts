import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AccessToken,
  CompanyId,
  CurrentUser,
} from './decorators/current-user.decorator';

/**
 * L'inscription, la connexion et la réinitialisation du mot de passe passent directement
 * par Supabase Auth (côté frontend). Le backend ne fait que vérifier le jeton obtenu.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getMe(
    @CurrentUser() user: { id: string; email?: string },
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.authService.getMe(user, companyId, token);
  }
}
