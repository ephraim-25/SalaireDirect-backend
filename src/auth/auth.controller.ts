import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, AccessToken } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: any) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: any) {
    return this.authService.login(dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: any, @AccessToken() token: string) {
    return this.authService.getMe(user?.id, token);
  }
}
