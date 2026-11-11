import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import { AccessToken } from '../auth/decorators/current-user.decorator';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Télécharge le bulletin de paie en PDF depuis un ID de payslip
   * GET /pdf/payslip/:id
   */
  @Get('payslip/:id')
  async downloadPayslip(
    @Param('id') payslipId: string,
    @AccessToken() token: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateFromPayslipId(
      payslipId,
      token,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulletin-${payslipId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  /**
   * Génération instantanée d'un bulletin PDF à partir des données transmises
   * POST /pdf/generate
   */
  @Post('generate')
  async generateFromData(
    @Body() data: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generatePayslipPdf(data);
    const lastName = data?.employee?.last_name || 'salarie';
    const month = data?.payroll?.month || '11';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulletin-${lastName}-${month}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
