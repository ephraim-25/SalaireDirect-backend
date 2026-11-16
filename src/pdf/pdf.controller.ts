import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import {
  AccessToken,
  CompanyId,
} from '../auth/decorators/current-user.decorator';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /** Bulletin de paie en PDF — GET /pdf/payslip/:id */
  @Get('payslip/:id')
  async downloadPayslip(
    @Param('id', ParseUUIDPipe) payslipId: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateFromPayslipId(
      payslipId,
      companyId,
      token,
    );
    this.sendPdf(res, pdfBuffer, `bulletin-${payslipId}.pdf`);
  }

  /** Récapitulatif PDF d'une période de paie — GET /pdf/payroll-summary/:id */
  @Get('payroll-summary/:id')
  async downloadPayrollSummary(
    @Param('id', ParseUUIDPipe) payrollId: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generatePayrollSummaryPdf(
      payrollId,
      companyId,
      token,
    );
    this.sendPdf(res, pdfBuffer, `recapitulatif-${payrollId}.pdf`);
  }

  // NB : l'ancienne route POST /pdf/generate (PDF à partir de données arbitraires envoyées par le client)
  // a été supprimée : elle permettait de fabriquer de faux bulletins à en-tête SalaireDirect.

  private sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }
}
