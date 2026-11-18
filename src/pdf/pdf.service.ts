import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { SupabaseService } from '../supabase/supabase.service';

export interface PayslipPdfData {
  company: {
    name: string;
    address?: string;
    nif?: string;
    cnss_number?: string;
  };
  employee: {
    first_name: string;
    last_name: string;
    position?: string;
    cnss_number?: string;
  };
  payroll: {
    month: number;
    year: number;
    usd_cdf_rate: number;
  };
  payslip: {
    base_salary: number;
    bonuses: number;
    overtime: number;
    absences_deductions: number;
    advances: number;
    gross_salary: number;
    cnss_employee: number;
    ipr: number;
    net_payable: number;
    cnss_employer: number;
    salary_currency: 'USD' | 'CDF';
  };
  items: Array<{
    label: string;
    item_type: string;
    amount: number;
    currency: string;
  }>;
}

const MONTH_NAMES_FR = [
  '',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

@Injectable()
export class PdfService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Génère un bulletin de paie au standard européen/OHADA/RDC en PDF.
   * Rendu haute précision, typographie soignée, conformité légale.
   */
  async generatePayslipPdf(data: PayslipPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        info: {
          Title: `Bulletin de Paie - ${data.employee.last_name} ${data.employee.first_name}`,
          Author: 'SalaireDirect Cloud RDC',
          Subject: `Paie ${MONTH_NAMES_FR[data.payroll.month] || ''} ${data.payroll.year}`,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const currency = data.payslip.salary_currency === 'CDF' ? 'CDF' : 'USD';
      const monthLabel =
        MONTH_NAMES_FR[data.payroll.month] || `Mois ${data.payroll.month}`;

      // ─── BANDEAU SUPÉRIEUR HAUT DE GAMME ──────────────────────
      doc.rect(45, 40, 505, 4).fill('#1E40AF'); // Accent Bleu Marine

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#0F172A')
        .text('BULLETIN DE PAIE & DÉCOMPTE SALARIAL', 45, 55, {
          align: 'left',
        });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748B')
        .text(
          `Période : ${monthLabel} ${data.payroll.year}  •  Conforme Code du Travail & Loi Fiscale RDC`,
          45,
          75,
        );

      doc.rect(45, 92, 505, 1).fill('#E2E8F0');

      // ─── CADRES EMPLOYEUR ET SALARIÉ ──────────────────────────
      const yBox = 105;
      const boxW = 245;
      const boxH = 95;

      // Cadre Employeur
      doc
        .roundedRect(45, yBox, boxW, boxH, 6)
        .fillAndStroke('#F8FAFC', '#CBD5E1');
      doc
        .fillColor('#1E3A8A')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('EMPLOYEUR (ENTREPRISE)', 55, yBox + 10);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(data.company.name || 'Société', 55, yBox + 26);
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(
        `Adresse : ${data.company.address || 'Non renseignée'}`,
        55,
        yBox + 42,
        { width: 225 },
      );
      doc.text(`NIF : ${data.company.nif || 'Non renseigné'}`, 55, yBox + 56);
      doc.text(
        `Immatriculation CNSS : ${data.company.cnss_number || 'Non renseignée'}`,
        55,
        yBox + 70,
      );

      // Cadre Salarié
      const xEmp = 305;
      doc
        .roundedRect(xEmp, yBox, boxW, boxH, 6)
        .fillAndStroke('#F8FAFC', '#CBD5E1');
      doc
        .fillColor('#1E3A8A')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('SALARIÉ BÉNÉFICIAIRE', xEmp + 10, yBox + 10);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(
          `${data.employee.last_name.toUpperCase()} ${data.employee.first_name}`,
          xEmp + 10,
          yBox + 26,
        );
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(
        `Fonction / Poste : ${data.employee.position || 'Non spécifié'}`,
        xEmp + 10,
        yBox + 42,
      );
      doc.text(
        `N° Matricule CNSS : ${data.employee.cnss_number || 'CNSS-SAL-001'}`,
        xEmp + 10,
        yBox + 56,
      );
      doc.text(
        `Devise de base : ${currency}  •  Taux appliqué : 1 $ = ${Number(data.payroll.usd_cdf_rate).toLocaleString('fr-FR')} CDF`,
        xEmp + 10,
        yBox + 70,
      );

      // ─── TABLEAU CENTRAL DES RUBRIQUES DE PAIE ───────────────
      const tableTop = 220;
      const colX = 45;
      const colW = 505;
      const headerH = 22;

      // Entête tableau
      doc.roundedRect(colX, tableTop, colW, headerH, 4).fill('#1E293B');
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('RUBRIQUE & DÉSIGNATION', colX + 12, tableTop + 7)
        .text('TYPE', colX + 270, tableTop + 7)
        .text(`MONTANT (${currency})`, colX + 390, tableTop + 7, {
          width: 100,
          align: 'right',
        });

      let curY = tableTop + headerH + 6;

      const items =
        data.items && data.items.length > 0
          ? data.items
          : [
              {
                label: 'Salaire de base',
                item_type: 'earning',
                amount: data.payslip.base_salary,
                currency,
              },
              {
                label: 'Primes & Gratifications',
                item_type: 'earning',
                amount: data.payslip.bonuses,
                currency,
              },
              {
                label: 'Heures supplémentaires',
                item_type: 'earning',
                amount: data.payslip.overtime,
                currency,
              },
              {
                label: 'Retenue pour Absences',
                item_type: 'deduction',
                amount: data.payslip.absences_deductions,
                currency,
              },
              {
                label: 'Cotisation CNSS Employé (3,5%)',
                item_type: 'deduction',
                amount: data.payslip.cnss_employee,
                currency,
              },
              {
                label: 'Impôt Professionnel s/ Revenus (IPR)',
                item_type: 'deduction',
                amount: data.payslip.ipr,
                currency,
              },
              {
                label: 'Acompte versé sur salaire',
                item_type: 'deduction',
                amount: data.payslip.advances,
                currency,
              },
            ];

      items.forEach((item, idx) => {
        const isEarning = item.item_type === 'earning';
        const isDeduction = item.item_type === 'deduction';
        const isCharge = item.item_type === 'employer_charge';
        const isInfo = item.item_type === 'info';

        if (isCharge || isInfo) return; // Traités dans les totaux séparés

        const rowH = 19;
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(colX, curY, colW, rowH).fill(bg);

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#1E293B')
          .text(item.label, colX + 12, curY + 5);

        const typeLabel = isEarning
          ? 'Gain brut'
          : isDeduction
            ? 'Retenue'
            : 'Autre';
        const typeColor = isEarning ? '#16A34A' : '#DC2626';

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(typeColor)
          .text(typeLabel, colX + 270, curY + 6);

        const prefix = isEarning ? '+' : isDeduction ? '-' : '';
        const amtStr = `${prefix}${formatAmount(item.amount)} ${currency}`;

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor(isDeduction ? '#DC2626' : '#0F172A')
          .text(amtStr, colX + 390, curY + 5, { width: 100, align: 'right' });

        doc.rect(colX, curY + rowH - 1, colW, 0.5).fill('#F1F5F9');
        curY += rowH;
      });

      // ─── BLOC RÉCAPITULATIF FINANCIER & NET ───────────────────
      curY += 12;

      // Encadré Salaire Brut
      doc
        .roundedRect(colX, curY, 245, 45, 6)
        .fillAndStroke('#EFF6FF', '#BFDBFE');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#1E40AF')
        .text('SALAIRE BRUT IMPOSABLE', colX + 12, curY + 10);
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#1E3A8A')
        .text(
          `${formatAmount(data.payslip.gross_salary)} ${currency}`,
          colX + 12,
          curY + 22,
        );

      // Encadré Net à Payer (Mise en avant)
      doc.roundedRect(xEmp, curY, boxW, 45, 6).fill('#1E40AF');
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#93C5FD')
        .text('NET NET À PAYER (SALAIRE NET)', xEmp + 14, curY + 10);
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#FFFFFF')
        .text(
          `${formatAmount(data.payslip.net_payable)} ${currency}`,
          xEmp + 14,
          curY + 22,
        );

      curY += 58;

      // ─── COTISATIONS PATRONALES & FISCALITÉ RDC ──────────────
      doc
        .roundedRect(colX, curY, colW, 55, 6)
        .fillAndStroke('#F8FAFC', '#E2E8F0');
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text(
          'RÉCAPITULATIF CHARGES PATRONALES & FISCALES (RDC)',
          colX + 12,
          curY + 8,
        );

      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      doc.text(
        `• CNSS Salariale (3,5%) : ${formatAmount(data.payslip.cnss_employee)} ${currency}`,
        colX + 12,
        curY + 22,
      );
      doc.text(
        `• CNSS Patronale (5,9%) : ${formatAmount(data.payslip.cnss_employer)} ${currency}`,
        colX + 12,
        curY + 36,
      );

      doc.text(
        `• IPR Retenu à la source : ${formatAmount(data.payslip.ipr)} ${currency}`,
        colX + 270,
        curY + 22,
      );
      doc.text(
        `• Total Débours Entreprise : ${formatAmount(data.payslip.gross_salary + data.payslip.cnss_employer)} ${currency}`,
        colX + 270,
        curY + 36,
      );

      // ─── SIGNATURES ET MENTIONS LÉGALES ──────────────────────
      const signY = 485;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B');
      doc.text('Visa & Signature de l’Employeur', colX + 30, signY);
      doc.text('Pour Acquit (Signature du Salarié)', xEmp + 30, signY);

      doc.rect(colX + 20, signY + 15, 170, 50).stroke('#CBD5E1');
      doc.rect(xEmp + 20, signY + 15, 170, 50).stroke('#CBD5E1');

      // ─── FOOTER CONFORMITÉ ───────────────────────────────────
      const footerY = 580;
      doc.rect(colX, footerY, colW, 0.5).fill('#CBD5E1');
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text(
          'Document généré par SalaireDirect. Les montants sont à vérifier avant tout paiement ou déclaration.',
          colX,
          footerY + 8,
          { align: 'center', width: colW },
        )
        .text(
          `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
          colX,
          footerY + 19,
          { align: 'center', width: colW },
        );

      doc.end();
    });
  }

  /**
   * Génère le PDF d'un bulletin depuis Supabase avec gestion gracieuse des IDs
   */
  async generateFromPayslipId(
    payslipId: string,
    companyId: string,
    accessToken: string,
  ): Promise<Buffer> {
    const client = this.supabase.getClientForUser(accessToken);

    const { data, error } = await client
      .from('payslips')
      .select(
        `
        *,
        payslip_items(*),
        employees(first_name, last_name, position, cnss_number, salary_currency),
        payrolls(
          month, year, usd_cdf_rate, company_id,
          companies(name, address, nif, cnss_number)
        )
      `,
      )
      .eq('id', payslipId)
      .maybeSingle();

    // Le bulletin doit appartenir à l'entreprise de l'utilisateur (défense en profondeur en plus de la RLS).
    if (error || !data || (data.payrolls as any)?.company_id !== companyId) {
      throw new NotFoundException(`Bulletin de paie ${payslipId} introuvable`);
    }

    const payrollData = data.payrolls as any;
    const companyData = payrollData?.companies;
    const employeeData = data.employees as any;

    return this.generatePayslipPdf({
      company: {
        name: companyData?.name || 'Société',
        address: companyData?.address,
        nif: companyData?.nif,
        cnss_number: companyData?.cnss_number,
      },
      employee: {
        first_name: employeeData?.first_name || 'Salarié',
        last_name: employeeData?.last_name || '',
        position: employeeData?.position,
        cnss_number: employeeData?.cnss_number,
      },
      payroll: {
        month: payrollData?.month || 1,
        year: payrollData?.year || new Date().getFullYear(),
        usd_cdf_rate: Number(payrollData?.usd_cdf_rate) || 0,
      },
      payslip: {
        base_salary: Number(data.base_salary) || 0,
        bonuses: Number(data.bonuses) || 0,
        overtime: Number(data.overtime) || 0,
        absences_deductions: Number(data.absences_deductions) || 0,
        advances: Number(data.advances) || 0,
        gross_salary: Number(data.gross_salary) || 0,
        cnss_employee: Number(data.cnss_employee) || 0,
        ipr: Number(data.ipr) || 0,
        net_payable: Number(data.net_payable) || 0,
        cnss_employer: Number(data.cnss_employer) || 0,
        salary_currency: (data.salary_currency as 'USD' | 'CDF') || 'USD',
      },
      items: (data.payslip_items as any[]) || [],
    });
  }

  /**
   * Génère le récapitulatif PDF d'une période de paie complète
   * (tous les bulletins d'un payroll) avec les données réelles de Supabase.
   */
  async generatePayrollSummaryPdf(
    payrollId: string,
    companyId: string,
    accessToken: string,
  ): Promise<Buffer> {
    const client = this.supabase.getClientForUser(accessToken);

    const { data, error } = await client
      .from('payrolls')
      .select(
        `
        *,
        companies(name, address, nif, cnss_number),
        payslips(
          id, base_salary, bonuses, overtime, absences_deductions, advances,
          gross_salary, cnss_employee, ipr, net_payable, cnss_employer,
          salary_currency,
          employees(first_name, last_name, position)
        )
      `,
      )
      .eq('id', payrollId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Période de paie ${payrollId} introuvable`);
    }

    const company = data.companies as any;
    const payslips = (data.payslips as any[]) || [];
    const monthLabel = MONTH_NAMES_FR[data.month] || `Mois ${data.month}`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        info: {
          Title: `Récapitulatif de Paie - ${monthLabel} ${data.year}`,
          Author: 'SalaireDirect Cloud RDC',
          Subject: `Récapitulatif paie ${monthLabel} ${data.year}`,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ─── EN-TÊTE ────────────────────────────────────────────
      doc.rect(45, 40, 505, 4).fill('#1E40AF');
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#0F172A')
        .text('RÉCAPITULATIF DE PAIE', 45, 55, { align: 'left' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748B')
        .text(
          `Période : ${monthLabel} ${data.year}  •  ${company?.name || 'Société'}`,
          45,
          75,
        );
      doc.rect(45, 92, 505, 1).fill('#E2E8F0');

      // ─── TABLEAU DES BULLETINS ──────────────────────────────
      const tableTop = 110;
      const colX = 45;
      const colW = 505;
      const headerH = 22;

      doc.roundedRect(colX, tableTop, colW, headerH, 4).fill('#1E293B');
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('SALARIÉ', colX + 10, tableTop + 7)
        .text('POSTE', colX + 160, tableTop + 7)
        .text('DEVISE', colX + 260, tableTop + 7)
        .text('BRUT', colX + 320, tableTop + 7, { width: 70, align: 'right' })
        .text('CNSS + IPR', colX + 400, tableTop + 7, {
          width: 70,
          align: 'right',
        })
        .text('NET À PAYER', colX + 475, tableTop + 7, {
          width: 65,
          align: 'right',
        });

      let curY = tableTop + headerH + 4;
      const totalsByCurrency: Record<
        string,
        { gross: number; deductions: number; net: number }
      > = {};

      payslips.forEach((ps, idx) => {
        const emp = ps.employees as any;
        const currency = ps.salary_currency === 'CDF' ? 'CDF' : 'USD';
        const gross = Number(ps.gross_salary) || 0;
        const deductions =
          (Number(ps.cnss_employee) || 0) +
          (Number(ps.ipr) || 0) +
          (Number(ps.advances) || 0);
        const net = Number(ps.net_payable) || 0;

        totalsByCurrency[currency] = totalsByCurrency[currency] || {
          gross: 0,
          deductions: 0,
          net: 0,
        };
        totalsByCurrency[currency].gross += gross;
        totalsByCurrency[currency].deductions += deductions;
        totalsByCurrency[currency].net += net;

        const rowH = 20;
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        if (curY + rowH > 760) {
          doc.addPage();
          curY = 50;
        }
        doc.rect(colX, curY, colW, rowH).fill(bg);

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#1E293B')
          .text(
            `${emp?.last_name || ''} ${emp?.first_name || ''}`.trim() ||
              'Salarié',
            colX + 10,
            curY + 6,
            { width: 145 },
          );
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#475569')
          .text(emp?.position || '-', colX + 160, curY + 6, { width: 95 });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#1E40AF')
          .text(currency, colX + 260, curY + 6);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#0F172A')
          .text(formatAmount(gross), colX + 320, curY + 6, {
            width: 70,
            align: 'right',
          });
        doc
          .fillColor('#DC2626')
          .text(formatAmount(deductions), colX + 400, curY + 6, {
            width: 70,
            align: 'right',
          });
        doc
          .font('Helvetica-Bold')
          .fillColor('#1E3A8A')
          .text(formatAmount(net), colX + 475, curY + 6, {
            width: 65,
            align: 'right',
          });

        doc.rect(colX, curY + rowH - 0.5, colW, 0.5).fill('#F1F5F9');
        curY += rowH;
      });

      if (payslips.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#64748B')
          .text(
            'Aucun bulletin enregistré pour cette période.',
            colX + 10,
            curY + 10,
          );
        curY += 24;
      }

      // ─── TOTAUX PAR DEVISE ──────────────────────────────────
      curY += 10;
      doc
        .roundedRect(
          colX,
          curY,
          colW,
          20 + Object.keys(totalsByCurrency).length * 14,
          6,
        )
        .fillAndStroke('#EFF6FF', '#BFDBFE');
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#1E40AF')
        .text('TOTAUX GÉNÉRAUX', colX + 12, curY + 7);

      let ty = curY + 22;
      Object.entries(totalsByCurrency).forEach(([currency, t]) => {
        doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B');
        doc.text(
          `Masse brute : ${formatAmount(t.gross)} ${currency}   •   Retenues : ${formatAmount(t.deductions)} ${currency}   •   Net à payer : ${formatAmount(t.net)} ${currency}`,
          colX + 12,
          ty,
          { width: colW - 24 },
        );
        ty += 14;
      });

      // ─── FOOTER ─────────────────────────────────────────────
      const footerY = 800;
      doc.rect(colX, footerY, colW, 0.5).fill('#CBD5E1');
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text(
          `Document généré le ${new Date().toLocaleDateString('fr-FR')} par SalaireDirect • ${payslips.length} bulletin(s)`,
          colX,
          footerY + 8,
          { align: 'center', width: colW },
        );

      doc.end();
    });
  }
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}
