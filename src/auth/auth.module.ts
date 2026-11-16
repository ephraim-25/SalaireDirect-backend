import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CompanyContextService } from './company-context.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CompanyContextService,
    // L'ordre compte : l'authentification d'abord, puis les rôles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, CompanyContextService],
})
export class AuthModule {}
