import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import {
  calculatePayslip,
  LegalParameters,
} from './engines/payroll-calculator.engine';

@Injectable()
export class PayrollService {
  constructor(private readonly supabase: SupabaseService) {}

  async getDefaultCompanyId(accessToken: string = 'dev-token'): Promise<string> {
    const client = this.supabase.getClientForUser(accessToken);
    const { data } = await client.from('companies').select('id').limit(1).single();
    return data?.id || '00000000-0000-0000-0000-000000000001';
  }

  /**
   * Récupère les paramètres légaux applicables pour une date donnée.
   * Prend le dernier barème dont effective_date <= date fournie.
   */
  async getApplicableLegalParameters(
    forDate: string = '2024-01-01',
    accessToken: string = 'dev-token',
  ): Promise<LegalParameters & { id: string; effective_date: string }> {
    const client = this.supabase.getClientForUser(accessToken);

    const { data } = await client
      .from('legal_parameters')
      .select('*')
      .lte('effective_date', forDate)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return {
        ...data,
        ipr_brackets: data.ipr_brackets as any,
      };
    }

    // Paramètres légaux par défaut (Code des Impôts RDC 2024)
    return {
      id: '0da65001-7b94-4c96-bbd8-9f6da81b33bc',
      effective_date: '2024-01-01',
      cnss_employee_rate: 0.035,
      cnss_employer_rate: 0.059,
      family_allowance_per_child: 12000,
      smig_rate: 7075,
      ipr_brackets: [
        { min: 0, max: 524999, rate: 0.0, cumulative_tax_below: 0 },
        { min: 525000, max: 1269999, rate: 0.15, cumulative_tax_below: 0 },
        { min: 1270000, max: 2114999, rate: 0.2, cumulative_tax_below: 111750 },
        { min: 2115000, max: 3304999, rate: 0.225, cumulative_tax_below: 280750 },
        { min: 3305000, max: 4894999, rate: 0.25, cumulative_tax_below: 548500 },
        { min: 4895000, max: 7254999, rate: 0.3, cumulative_tax_below: 945750 },
        { min: 7255000, max: 10679999, rate: 0.35, cumulative_tax_below: 1653750 },
        { min: 10680000, max: null, rate: 0.4, cumulative_tax_below: 2852750 },
      ],
    };
  }

  /**
   * Calcul dynamique / simulation de la paie sans obligation de persistance.
   * Peut calculer pour un employé unique ou pour l'ensemble des employés du mois.
   */
  async calculateSimulation(
    payload: {
      month?: number;
      year?: number;
      company_id?: string;
      usd_cdf_rate?: number;
      employees?: Array<{
        employeeId?: string;
        employee_id?: string;
        employeeName?: string;
        baseSalary?: number;
        base_salary?: number;
        currency?: 'USD' | 'CDF';
        salary_currency?: 'USD' | 'CDF';
        primes?: number;
        bonuses?: number;
        overtime?: number;
        absences?: number;
        absences_deductions?: number;
        advances?: number;
        numberOfDependents?: number;
        dependent_children?: number;
      }>;
      base_salary?: number;
      bonuses?: number;
      overtime?: number;
      absences_deductions?: number;
      advances?: number;
      dependent_children?: number;
      salary_currency?: 'USD' | 'CDF';
    },
    accessToken: string = 'dev-token',
  ) {
    const usd_cdf_rate = payload.usd_cdf_rate || 2800; // Taux USD/CDF indicatif marché
    const refDate = `${payload.year || 2026}-${String(payload.month || 11).padStart(2, '0')}-01`;
    const legalParams = await this.getApplicableLegalParameters(refDate, accessToken);

    // Si une liste d'employés est fournie dans payload
    if (payload.employees && payload.employees.length > 0) {
      const results = payload.employees.map((emp) => {
        const base_salary = Number(emp.baseSalary ?? emp.base_salary ?? 0);
        const currency = (emp.currency === 'CDF' || emp.salary_currency === 'CDF' ? 'CDF' : 'USD') as 'USD' | 'CDF';
        const bonuses = Number(emp.primes ?? emp.bonuses ?? 0);
        const overtime = Number(emp.overtime ?? 0);
        const absences = Number(emp.absences ?? emp.absences_deductions ?? 0);
        const advances = Number(emp.advances ?? 0);
        const dependent_children = Number(emp.numberOfDependents ?? emp.dependent_children ?? 0);

        const calc = calculatePayslip(
          {
            base_salary,
            salary_currency: currency,
            bonuses,
            overtime,
            absences_deductions: absences,
            advances,
            dependent_children,
            usd_cdf_rate,
          },
          legalParams,
        );

        return {
          employeeId: emp.employeeId || emp.employee_id || '',
          employeeName: emp.employeeName || 'Employé',
          baseSalary: calc.base_salary,
          currency,
          primes: calc.bonuses,
          overtime: calc.overtime,
          absences: calc.absences_deductions,
          advances: calc.advances,
          grossSalary: calc.gross_salary,
          cnssEmployee: calc.cnss_employee,
          cnssEmployer: calc.cnss_employer,
          ipr: calc.ipr,
          netSalary: calc.net_payable,
          items: calc.items,
        };
      });

      return {
        month: payload.month || 11,
        year: payload.year || 2026,
        usd_cdf_rate,
        legal_parameters: {
          cnss_employee_rate: legalParams.cnss_employee_rate,
          cnss_employer_rate: legalParams.cnss_employer_rate,
          effective_date: legalParams.effective_date,
        },
        calculations: results,
      };
    }

    // Calcul pour un seul employé / formulaire
    const calc = calculatePayslip(
      {
        base_salary: Number(payload.base_salary || 0),
        salary_currency: payload.salary_currency || 'USD',
        bonuses: Number(payload.bonuses || 0),
        overtime: Number(payload.overtime || 0),
        absences_deductions: Number(payload.absences_deductions || 0),
        advances: Number(payload.advances || 0),
        dependent_children: Number(payload.dependent_children || 0),
        usd_cdf_rate,
      },
      legalParams,
    );

    return {
      usd_cdf_rate,
      calculation: calc,
    };
  }

  /**
   * Enregistrement complet ou clôture d'un mois de paie avec tous ses bulletins
   */
  async saveMonthPayroll(
    payload: {
      month: number;
      year: number;
      company_id?: string;
      usd_cdf_rate?: number;
      status?: 'draft' | 'closed';
      calculations?: any[];
    },
    accessToken: string = 'dev-token',
  ) {
    const client = this.supabase.getClientForUser(accessToken) as any;
    const company_id = payload.company_id || (await this.getDefaultCompanyId(accessToken));
    const refDate = `${payload.year}-${String(payload.month).padStart(2, '0')}-01`;
    const legalParams = await this.getApplicableLegalParameters(refDate, accessToken);

    const isClosed = payload.status === 'closed';

    const { data: payroll, error: pError } = await client
      .from('payrolls')
      .upsert(
        {
          company_id,
          month: Number(payload.month),
          year: Number(payload.year),
          usd_cdf_rate: Number(payload.usd_cdf_rate || 2800),
          status: payload.status || 'draft',
          legal_parameters_id: legalParams.id,
          legal_parameters_snapshot: isClosed ? legalParams : null,
          closed_at: isClosed ? new Date().toISOString() : null,
        },
        { onConflict: 'company_id,month,year' }
      )
      .select()
      .single();

    if (pError) throw new InternalServerErrorException(pError.message);

    // Enregistrer les bulletins de chaque employé
    const savedPayslips: any[] = [];
    if (payroll && payload.calculations && payload.calculations.length > 0) {
      for (const calc of payload.calculations) {
        if (!calc.employeeId) continue;
        const currency = calc.currency === 'CDF' || calc.currency === 'FC' ? 'CDF' : 'USD';

        const { data: ps, error: psErr } = await client
          .from('payslips')
          .upsert(
            {
              payroll_id: payroll.id,
              employee_id: calc.employeeId,
              base_salary: Number(calc.baseSalary || 0),
              salary_currency: currency,
              bonuses: Number(calc.primes || 0),
              overtime: Number(calc.overtime || 0),
              absences_deductions: Number(calc.absences || 0),
              advances: Number(calc.advances || 0),
              gross_salary: Number(calc.grossSalary || 0),
              cnss_employee: Number(calc.cnssEmployee || 0),
              ipr: Number(calc.ipr || 0),
              net_payable: Number(calc.netSalary || 0),
              cnss_employer: Number(calc.cnssEmployer || 0),
            },
            { onConflict: 'payroll_id,employee_id' }
          )
          .select()
          .single();

        if (ps) {
          savedPayslips.push(ps);

          if (calc.items && Array.isArray(calc.items) && calc.items.length > 0) {
            await client.from('payslip_items').delete().eq('payslip_id', ps.id);
            await client.from('payslip_items').insert(
              calc.items.map((it: any) => ({
                payslip_id: ps.id,
                label: it.label,
                item_type: it.item_type,
                amount: Number(it.amount || 0),
                currency: it.currency === 'CDF' || it.currency === 'FC' ? 'CDF' : 'USD',
                sort_order: it.sort_order || 0,
              }))
            );
          }
        }
      }
    }

    return {
      message: isClosed ? 'Mois de paie clôturé et archivé avec succès' : 'Mois de paie enregistré avec succès',
      payroll,
      payslipsCount: savedPayslips.length,
      payslips: savedPayslips,
    };
  }

  /**
   * Historique complet des périodes de paie
   */
  async findAllPayrolls(companyId?: string, accessToken: string = 'dev-token') {
    const client = this.supabase.getClientForUser(accessToken) as any;
    let query = client
      .from('payrolls')
      .select(`
        *,
        companies(name, main_currency),
        payslips(
          id,
          employee_id,
          base_salary,
          bonuses,
          overtime,
          absences_deductions,
          advances,
          gross_salary,
          cnss_employee,
          ipr,
          net_payable,
          cnss_employer,
          salary_currency,
          employees(first_name, last_name, position, cnss_number)
        )
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data || [];
  }

  // --- Gestion des variables du mois ---

  async getVariables(
    params: { month?: number; year?: number; employee_id?: string },
    accessToken: string = 'dev-token',
  ) {
    const client = this.supabase.getClientForUser(accessToken) as any;
    let query = client.from('monthly_variables').select('*').order('created_at', { ascending: false });

    if (params.month) query = query.eq('month', params.month);
    if (params.year) query = query.eq('year', params.year);
    if (params.employee_id) query = query.eq('employee_id', params.employee_id);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data || [];
  }

  async createVariable(
    dto: {
      employeeId?: string;
      employee_id?: string;
      type: 'prime' | 'heures_sup' | 'absence' | 'avance';
      amount?: number;
      quantity?: number;
      description: string;
      month: number | string;
      year: number | string;
    },
    accessToken: string = 'dev-token',
  ) {
    const client = this.supabase.getClientForUser(accessToken) as any;

    const employee_id = dto.employee_id || dto.employeeId;
    if (!employee_id) {
      throw new BadRequestException("L'identifiant de l'employé est requis");
    }

    const { data, error } = await client
      .from('monthly_variables')
      .insert({
        employee_id,
        type: dto.type,
        amount: dto.amount != null ? Number(dto.amount) : null,
        quantity: dto.quantity != null ? Number(dto.quantity) : null,
        description: dto.description,
        month: parseInt(String(dto.month), 10),
        year: parseInt(String(dto.year), 10),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async deleteVariable(id: string, accessToken: string = 'dev-token') {
    const client = this.supabase.getClientForUser(accessToken) as any;
    const { error } = await client.from('monthly_variables').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Variable supprimée avec succès' };
  }

  // --- Payrolls existants ---

  async findAll(companyId: string, accessToken: string) {
    return this.findAllPayrolls(companyId, accessToken);
  }

  async create(dto: CreatePayrollDto, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data: existing } = await client
      .from('payrolls')
      .select('id')
      .eq('company_id', dto.company_id)
      .eq('month', dto.month)
      .eq('year', dto.year)
      .single();

    if (existing) {
      throw new BadRequestException(`Un payroll existe déjà pour ${dto.month}/${dto.year}`);
    }

    const refDate = `${dto.year}-${String(dto.month).padStart(2, '0')}-01`;
    const legalParams = await this.getApplicableLegalParameters(refDate, accessToken);

    const { data, error } = await client
      .from('payrolls')
      .insert({
        company_id: dto.company_id,
        month: dto.month,
        year: dto.year,
        usd_cdf_rate: dto.usd_cdf_rate,
        status: 'draft',
        legal_parameters_id: legalParams.id,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findOne(payrollId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('payrolls')
      .select(`*, payslips(*, employees(first_name, last_name, position), payslip_items(*))`)
      .eq('id', payrollId)
      .single();

    if (error) throw new NotFoundException(`Payroll ${payrollId} introuvable`);
    return data;
  }

  async calculateAndSavePayslip(
    payrollId: string,
    dto: CreatePayslipDto,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data: payroll, error: payrollError } = await client
      .from('payrolls')
      .select('*, legal_parameters(*)')
      .eq('id', payrollId)
      .single();

    if (payrollError || !payroll) {
      throw new NotFoundException(`Payroll ${payrollId} introuvable`);
    }

    const { data: employee, error: empError } = await client
      .from('employees')
      .select('*')
      .eq('id', dto.employee_id)
      .single();

    if (empError || !employee) {
      throw new NotFoundException(`Employé ${dto.employee_id} introuvable`);
    }

    const legalParams = payroll.legal_parameters as unknown as LegalParameters;
    const result = calculatePayslip(
      {
        base_salary: dto.base_salary ?? employee.base_salary,
        salary_currency: employee.salary_currency as 'USD' | 'CDF',
        bonuses: dto.bonuses ?? 0,
        overtime: dto.overtime ?? 0,
        absences_deductions: dto.absences_deductions ?? 0,
        advances: dto.advances ?? 0,
        dependent_children: employee.dependent_children,
        usd_cdf_rate: payroll.usd_cdf_rate,
      },
      legalParams,
    );

    const payslipData = {
      payroll_id: payrollId,
      employee_id: dto.employee_id,
      base_salary: result.base_salary,
      salary_currency: employee.salary_currency,
      bonuses: result.bonuses,
      overtime: result.overtime,
      absences_deductions: result.absences_deductions,
      advances: result.advances,
      gross_salary: result.gross_salary,
      cnss_employee: result.cnss_employee,
      ipr: result.ipr,
      net_payable: result.net_payable,
      cnss_employer: result.cnss_employer,
    };

    const { data: payslip, error: psError } = await client
      .from('payslips')
      .upsert(payslipData, { onConflict: 'payroll_id,employee_id' })
      .select()
      .single();

    if (psError) throw new InternalServerErrorException(psError.message);

    await client.from('payslip_items').delete().eq('payslip_id', payslip.id);

    await client.from('payslip_items').insert(
      result.items.map((item) => ({
        ...item,
        payslip_id: payslip.id,
      })),
    );

    return { payslip, calculation_detail: result };
  }

  async closePayroll(payrollId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data: payroll } = await client
      .from('payrolls')
      .select('*, legal_parameters(*)')
      .eq('id', payrollId)
      .single();

    if (!payroll) throw new NotFoundException(`Payroll ${payrollId} introuvable`);

    const { data, error } = await client
      .from('payrolls')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        legal_parameters_snapshot: payroll.legal_parameters,
      })
      .eq('id', payrollId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Payroll clôturé avec succès', payroll: data };
  }

  async generateAllPayslips(
    payrollId: string,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data: employees, error } = await client
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (error) throw new InternalServerErrorException(error.message);

    const results: any[] = [];
    for (const employee of employees ?? []) {
      const result = await this.calculateAndSavePayslip(
        payrollId,
        {
          employee_id: employee.id,
          base_salary: employee.base_salary,
          bonuses: 0,
          overtime: 0,
          absences_deductions: 0,
          advances: 0,
        },
        accessToken,
      );
      results.push({ employee_id: employee.id, status: 'success', result });
    }

    return { processed: results.length, results };
  }
}
