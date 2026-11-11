import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { AccessToken } from '../auth/decorators/current-user.decorator';

@Controller('payrolls')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * Endpoint de calcul dynamique / simulation de la paie
   * POST /payrolls/calculate
   */
  @Post('calculate')
  calculateSimulation(@Body() body: any, @AccessToken() token: string) {
    return this.payrollService.calculateSimulation(body, token);
  }

  /**
   * Enregistrement / clôture complète d'une période de paie avec ses bulletins
   * POST /payrolls/save-month
   */
  @Post('save-month')
  saveMonth(@Body() body: any, @AccessToken() token: string) {
    return this.payrollService.saveMonthPayroll(body, token);
  }

  /**
   * Liste complète des périodes de paie (Historique)
   * GET /payrolls
   */
  @Get()
  getAllPayrolls(
    @Query('companyId') companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.findAllPayrolls(companyId, token);
  }

  /**
   * Liste des variables du mois (primes, heures sup, absences, avances)
   * GET /payrolls/variables?month=11&year=2026
   */
  @Get('variables')
  getVariables(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('employee_id') employee_id: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.getVariables(
      {
        month: month ? parseInt(month, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
        employee_id,
      },
      token,
    );
  }

  /**
   * Ajout d'une variable du mois
   * POST /payrolls/variables
   */
  @Post('variables')
  createVariable(@Body() dto: any, @AccessToken() token: string) {
    return this.payrollService.createVariable(dto, token);
  }

  /**
   * Suppression d'une variable du mois
   * DELETE /payrolls/variables/:id
   */
  @Delete('variables/:id')
  deleteVariable(@Param('id') id: string, @AccessToken() token: string) {
    return this.payrollService.deleteVariable(id, token);
  }

  /** Liste les payrolls d'une entreprise */
  @Get('company/:companyId')
  findAll(
    @Param('companyId') companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.findAll(companyId, token);
  }

  /** Détail d'un payroll avec bulletins */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.findOne(id, token);
  }

  /** Crée un nouveau mois de paie */
  @Post()
  create(@Body() dto: CreatePayrollDto, @AccessToken() token: string) {
    return this.payrollService.create(dto, token);
  }

  /** Calcule et enregistre un bulletin individuel */
  @Post(':id/payslips')
  calculatePayslip(
    @Param('id') payrollId: string,
    @Body() dto: CreatePayslipDto,
    @AccessToken() token: string,
  ) {
    return this.payrollService.calculateAndSavePayslip(payrollId, dto, token);
  }

  /** Génère automatiquement tous les bulletins des employés actifs */
  @Post(':id/generate-all')
  generateAll(
    @Param('id') payrollId: string,
    @Body('company_id') companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.generateAllPayslips(payrollId, companyId, token);
  }

  /** Clôture un payroll */
  @Put(':id/close')
  closePayroll(
    @Param('id') id: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.closePayroll(id, token);
  }

  /** Récupère les paramètres légaux applicables */
  @Get('legal-parameters/:date')
  getLegalParameters(
    @Param('date') date: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.getApplicableLegalParameters(date, token);
  }
}
