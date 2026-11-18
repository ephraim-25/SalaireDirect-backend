import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { PdfModule } from './pdf/pdf.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Configuration globale (charge le .env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Limitation de débit : 120 requêtes / minute / IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    // Core
    SupabaseModule,
    AuthModule,

    // Métier
    CompaniesModule,
    EmployeesModule,
    PayrollModule,
    PdfModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
