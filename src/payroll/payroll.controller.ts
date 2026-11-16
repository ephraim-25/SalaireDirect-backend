import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import {
  CalculatePayrollDto,
  CreateVariableDto,
  SaveMonthDto,
} from './dto/payroll-inputs.dto';
import {
  AccessToken,
  CompanyId,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Pour ces deux routes, les champs inconnus (montants calculés par l'ancien navigateur, libellés…)
 * sont retirés au lieu de provoquer une erreur : le serveur recalcule tout lui-même.
 */
const lenientPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

@Controller('payrolls')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /** Simulation de la paie (rien n'est enregistré) — POST /payrolls/calculate */
  @Post('calculate')
  calculateSimulation(
    @Body(lenientPipe) dto: CalculatePayrollDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.calculateSimulation(dto, companyId, token);
  }

  /** Enregistre ou clôture un mois de paie — POST /payrolls/save-month */
  @Post('save-month')
  saveMonth(
    @Body(lenientPipe) dto: SaveMonthDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.saveMonthPayroll(dto, companyId, token);
  }

  /** Historique des périodes de paie de l'entreprise — GET /payrolls */
  @Get()
  getAllPayrolls(@CompanyId() companyId: string, @AccessToken() token: string) {
    return this.payrollService.findAllPayrolls(companyId, token);
  }

  /** Variables du mois — GET /payrolls/variables?month=11&year=2026 */
  @Get('variables')
  getVariables(
    @Query('month', new ParseIntPipe({ optional: true }))
    month: number | undefined,
    @Query('year', new ParseIntPipe({ optional: true }))
    year: number | undefined,
    @Query('employee_id') employee_id: string | undefined,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.getVariables(
      { month, year, employee_id },
      companyId,
      token,
    );
  }

  @Post('variables')
  createVariable(
    @Body() dto: CreateVariableDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.createVariable(dto, companyId, token);
  }

  @Delete('variables/:id')
  deleteVariable(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.deleteVariable(id, companyId, token);
  }

  /** Paramètres légaux applicables à une date — GET /payrolls/legal-parameters/2026-11-01 */
  @Get('legal-parameters/:date')
  getLegalParameters(
    @Param('date') date: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.getApplicableLegalParameters(date, token);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.findOne(id, companyId, token);
  }

  @Post()
  create(
    @Body() dto: CreatePayrollDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.create(dto, companyId, token);
  }

  @Post(':id/payslips')
  calculatePayslip(
    @Param('id', ParseUUIDPipe) payrollId: string,
    @Body() dto: CreatePayslipDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.calculateAndSavePayslip(
      payrollId,
      dto,
      companyId,
      token,
    );
  }

  @Post(':id/generate-all')
  generateAll(
    @Param('id', ParseUUIDPipe) payrollId: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.generateAllPayslips(payrollId, companyId, token);
  }

  @Put(':id/close')
  @Roles('admin')
  closePayroll(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.payrollService.closePayroll(id, companyId, token);
  }
}
