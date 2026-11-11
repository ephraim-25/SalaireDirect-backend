import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    // Configuration globale (charge le .env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Core
    SupabaseModule,
    AuthModule,

    // Métier
    CompaniesModule,
    EmployeesModule,
    PayrollModule,
    PdfModule,
  ],
})
export class AppModule {}
