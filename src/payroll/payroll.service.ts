import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import {
  CalculatePayrollDto,
  CreateVariableDto,
  PayrollEntryDto,
  SaveMonthDto,
} from './dto/payroll-inputs.dto';
import {
  calculatePayslip,
  LegalParameters,
  PayslipCalculationResult,
} from './engines/payroll-calculator.engine';

type LegalParametersRecord = LegalParameters & {
  id: string;
  effective_date: string;
  /** true si aucun barème n'est enregistré en base et que les valeurs de repli sont utilisées. */
  is_default?: boolean;
};

/** Valeurs de repli (RDC 2024), utilisées UNIQUEMENT si la table `legal_parameters` est vide. */
const FALLBACK_LEGAL_PARAMETERS: LegalParametersRecord = {
  id: '0da65001-7b94-4c96-bbd8-9f6da81b33bc',
  effective_date: '2024-01-01',
  is_default: true,
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

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  base_salary: number;
  salary_currency: 'USD' | 'CDF';
  dependent_children: number;
}

interface ComputedPayslip {
  employee: EmployeeRow;
  calc: PayslipCalculationResult;
}

const firstOfMonth = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}-01`;

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /* ------------------------------------------------------------------ */
  /*  Paramètres légaux                                                  */
  /* ------------------------------------------------------------------ */

  /** Dernier barème dont effective_date <= date fournie (date du jour par défaut). */
  async getApplicableLegalParameters(
    forDate: string = new Date().toISOString().slice(0, 10),
    accessToken: string,
  ): Promise<LegalParametersRecord> {
    const client = this.supabase.getClientForUser(accessToken);

    const { data } = await client
      .from('legal_parameters')
      .select('*')
      .lte('effective_date', forDate)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        ...data,
        ipr_brackets:
          data.ipr_brackets as unknown as LegalParameters['ipr_brackets'],
      };
    }

    this.logger.warn(
      `Aucun barème légal en base pour le ${forDate} : utilisation des valeurs de repli (${FALLBACK_LEGAL_PARAMETERS.effective_date}).`,
    );
    return FALLBACK_LEGAL_PARAMETERS;
  }

  /* ------------------------------------------------------------------ */
  /*  Calcul                                                             */
  /* ------------------------------------------------------------------ */

  /** Charge les salariés demandés ET vérifie qu'ils appartiennent bien à l'entreprise. */
  private async loadEmployees(
    ids: string[],
    companyId: string,
    accessToken: string,
  ): Promise<Map<string, EmployeeRow>> {
    const client = this.supabase.getClientForUser(accessToken);
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const { data, error } = await client
      .from('employees')
      .select(
        'id, first_name, last_name, base_salary, salary_currency, dependent_children',
      )
      .eq('company_id', companyId)
      .in('id', unique);

    if (error) throw new InternalServerErrorException(error.message);

    const map = new Map<string, EmployeeRow>(
      (data ?? []).map((e) => [e.id, e as EmployeeRow]),
    );
    const missing = unique.filter((id) => !map.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Employé(s) introuvable(s) dans votre entreprise : ${missing.join(', ')}`,
      );
    }
    return map;
  }

  /**
   * Calcule les bulletins. Le salaire de base, la devise et les enfants à charge viennent de la base
   * (jamais du navigateur) ; seules les variables du mois sont fournies par le client.
   */
  private async compute(
    entries: PayrollEntryDto[],
    period: { month: number; year: number; usd_cdf_rate: number },
    companyId: string,
    accessToken: string,
  ) {
    const legalParams = await this.getApplicableLegalParameters(
      firstOfMonth(period.year, period.month),
      accessToken,
    );
    const employees = await this.loadEmployees(
      entries.map((e) => e.employeeId),
      companyId,
      accessToken,
    );

    const computed: ComputedPayslip[] = entries.map((entry) => {
      const employee = employees.get(entry.employeeId)!;
      const calc = calculatePayslip(
        {
          base_salary: Number(employee.base_salary) || 0,
          salary_currency: employee.salary_currency,
          bonuses: entry.primes ?? 0,
          overtime: entry.overtime ?? 0,
          absences_deductions: entry.absences ?? 0,
          advances: entry.advances ?? 0,
          dependent_children: employee.dependent_children ?? 0,
          usd_cdf_rate: period.usd_cdf_rate,
        },
        legalParams,
      );
      return { employee, calc };
    });

    return { computed, legalParams };
  }

  /** Simulation : calcule sans rien enregistrer. */
  async calculateSimulation(
    dto: CalculatePayrollDto,
    companyId: string,
    accessToken: string,
  ) {
    const { computed, legalParams } = await this.compute(
      dto.employees,
      dto,
      companyId,
      accessToken,
    );

    return {
      month: dto.month,
      year: dto.year,
      usd_cdf_rate: dto.usd_cdf_rate,
      legal_parameters: {
        cnss_employee_rate: legalParams.cnss_employee_rate,
        cnss_employer_rate: legalParams.cnss_employer_rate,
        effective_date: legalParams.effective_date,
        is_default: legalParams.is_default ?? false,
      },
      calculations: computed.map(({ employee, calc }) => ({
        employeeId: employee.id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        baseSalary: calc.base_salary,
        currency: employee.salary_currency,
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
      })),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Enregistrement / clôture d'un mois                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Enregistre (brouillon) ou clôture un mois de paie. Les montants sont RECALCULÉS par le serveur :
   * les montants envoyés par le navigateur ne sont pas pris en compte. Une paie clôturée est définitive.
   */
  async saveMonthPayroll(
    dto: SaveMonthDto,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const isClosed = dto.status === 'closed';

    const { data: existing, error: existingError } = await client
      .from('payrolls')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('month', dto.month)
      .eq('year', dto.year)
      .maybeSingle();
    if (existingError)
      throw new InternalServerErrorException(existingError.message);

    if (existing?.status === 'closed') {
      throw new ConflictException(
        `La paie de ${String(dto.month).padStart(2, '0')}/${dto.year} est déjà clôturée et ne peut plus être modifiée.`,
      );
    }

    const { computed, legalParams } = await this.compute(
      dto.calculations,
      dto,
      companyId,
      accessToken,
    );

    const { data: payroll, error: pError } = await client
      .from('payrolls')
      .upsert(
        {
          company_id: companyId,
          month: dto.month,
          year: dto.year,
          usd_cdf_rate: dto.usd_cdf_rate,
          status: isClosed ? 'closed' : 'draft',
          legal_parameters_id: legalParams.id,
          legal_parameters_snapshot: isClosed ? (legalParams as any) : null,
          closed_at: isClosed ? new Date().toISOString() : null,
        },
        { onConflict: 'company_id,month,year' },
      )
      .select()
      .single();
    if (pError || !payroll)
      throw new InternalServerErrorException(
        pError?.message ?? 'Enregistrement impossible',
      );

    const savedPayslips: any[] = [];
    for (const { employee, calc } of computed) {
      const slip = await this.upsertPayslip(client, payroll.id, employee, calc);
      savedPayslips.push(slip);
    }

    return {
      message: isClosed
        ? 'Mois de paie clôturé et archivé avec succès'
        : 'Mois de paie enregistré avec succès',
      payroll,
      payslipsCount: savedPayslips.length,
      payslips: savedPayslips,
    };
  }

  private async upsertPayslip(
    client: ReturnType<SupabaseService['getClientForUser']>,
    payrollId: string,
    employee: EmployeeRow,
    calc: PayslipCalculationResult,
  ) {
    const { data: payslip, error } = await client
      .from('payslips')
      .upsert(
        {
          payroll_id: payrollId,
          employee_id: employee.id,
          base_salary: calc.base_salary,
          salary_currency: employee.salary_currency,
          bonuses: calc.bonuses,
          overtime: calc.overtime,
          absences_deductions: calc.absences_deductions,
          advances: calc.advances,
          gross_salary: calc.gross_salary,
          cnss_employee: calc.cnss_employee,
          ipr: calc.ipr,
          net_payable: calc.net_payable,
          cnss_employer: calc.cnss_employer,
        },
        { onConflict: 'payroll_id,employee_id' },
      )
      .select()
      .single();

    if (error || !payslip) {
      throw new InternalServerErrorException(
        `Bulletin de ${employee.first_name} ${employee.last_name} non enregistré : ${error?.message ?? 'erreur inconnue'}`,
      );
    }

    const { error: delError } = await client
      .from('payslip_items')
      .delete()
      .eq('payslip_id', payslip.id);
    if (delError) throw new InternalServerErrorException(delError.message);

    const { error: itemsError } = await client
      .from('payslip_items')
      .insert(calc.items.map((item) => ({ ...item, payslip_id: payslip.id })));
    if (itemsError) throw new InternalServerErrorException(itemsError.message);

    return payslip;
  }

  /* ------------------------------------------------------------------ */
  /*  Historique                                                         */
  /* ------------------------------------------------------------------ */

  async findAllPayrolls(companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('payrolls')
      .select(
        `*,
        companies(name, main_currency),
        payslips(
          id, employee_id, base_salary, bonuses, overtime, absences_deductions, advances,
          gross_salary, cnss_employee, ipr, net_payable, cnss_employer, salary_currency,
          employees(first_name, last_name, position, cnss_number)
        )`,
      )
      .eq('company_id', companyId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /* ------------------------------------------------------------------ */
  /*  Variables du mois                                                  */
  /* ------------------------------------------------------------------ */

  /** `monthly_variables` n'est pas dans les types générés : accès non typé, mais toujours borné à l'entreprise. */
  private variablesTable(accessToken: string) {
    return (this.supabase.getClientForUser(accessToken) as any).from(
      'monthly_variables',
    );
  }

  private async companyEmployeeIds(
    companyId: string,
    accessToken: string,
  ): Promise<string[]> {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .select('id')
      .eq('company_id', companyId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((e) => e.id);
  }

  async getVariables(
    params: { month?: number; year?: number; employee_id?: string },
    companyId: string,
    accessToken: string,
  ) {
    const ids = await this.companyEmployeeIds(companyId, accessToken);
    if (ids.length === 0) return [];

    let query = this.variablesTable(accessToken)
      .select('*')
      .in('employee_id', ids)
      .order('created_at', { ascending: false });

    if (params.month) query = query.eq('month', params.month);
    if (params.year) query = query.eq('year', params.year);
    if (params.employee_id) query = query.eq('employee_id', params.employee_id);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async createVariable(
    dto: CreateVariableDto,
    companyId: string,
    accessToken: string,
  ) {
    const needsAmount = dto.type === 'prime' || dto.type === 'avance';
    const value = needsAmount ? dto.amount : dto.quantity;
    if (!(Number(value) > 0)) {
      throw new BadRequestException(
        needsAmount
          ? 'Un montant supérieur à zéro est requis.'
          : 'Une quantité supérieure à zéro est requise.',
      );
    }

    // Le salarié doit appartenir à l'entreprise de l'utilisateur.
    await this.loadEmployees([dto.employee_id], companyId, accessToken);

    const { data, error } = await this.variablesTable(accessToken)
      .insert({
        employee_id: dto.employee_id,
        type: dto.type,
        amount: needsAmount ? dto.amount : null,
        quantity: needsAmount ? null : dto.quantity,
        description: dto.description,
        month: dto.month,
        year: dto.year,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async deleteVariable(id: string, companyId: string, accessToken: string) {
    const ids = await this.companyEmployeeIds(companyId, accessToken);
    if (ids.length === 0) throw new NotFoundException('Variable introuvable');

    const { data, error } = await this.variablesTable(accessToken)
      .delete()
      .eq('id', id)
      .in('employee_id', ids)
      .select('id');

    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.length === 0)
      throw new NotFoundException('Variable introuvable');
    return { message: 'Variable supprimée avec succès' };
  }

  /* ------------------------------------------------------------------ */
  /*  Paies individuelles (API détaillée)                                */
  /* ------------------------------------------------------------------ */

  /** Retourne la paie si elle appartient à l'entreprise, sinon 404. */
  private async getOwnPayroll(
    payrollId: string,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('payrolls')
      .select('*, legal_parameters(*)')
      .eq('id', payrollId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Payroll ${payrollId} introuvable`);
    return data;
  }

  async create(dto: CreatePayrollDto, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);

    const { data: existing } = await client
      .from('payrolls')
      .select('id')
      .eq('company_id', companyId)
      .eq('month', dto.month)
      .eq('year', dto.year)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        `Un payroll existe déjà pour ${dto.month}/${dto.year}`,
      );
    }

    const legalParams = await this.getApplicableLegalParameters(
      firstOfMonth(dto.year, dto.month),
      accessToken,
    );

    const { data, error } = await client
      .from('payrolls')
      .insert({
        company_id: companyId,
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

  async findOne(payrollId: string, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('payrolls')
      .select(
        `*, payslips(*, employees(first_name, last_name, position), payslip_items(*))`,
      )
      .eq('id', payrollId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Payroll ${payrollId} introuvable`);
    return data;
  }

  async calculateAndSavePayslip(
    payrollId: string,
    dto: CreatePayslipDto,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const payroll = await this.getOwnPayroll(payrollId, companyId, accessToken);

    if (payroll.status === 'closed') {
      throw new ConflictException(
        'Cette paie est clôturée et ne peut plus être modifiée.',
      );
    }

    const employees = await this.loadEmployees(
      [dto.employee_id],
      companyId,
      accessToken,
    );
    const employee = employees.get(dto.employee_id)!;

    const legalParams =
      (payroll.legal_parameters as unknown as LegalParameters | null) ??
      (await this.getApplicableLegalParameters(
        firstOfMonth(payroll.year, payroll.month),
        accessToken,
      ));

    const calc = calculatePayslip(
      {
        base_salary: dto.base_salary ?? Number(employee.base_salary),
        salary_currency: employee.salary_currency,
        bonuses: dto.bonuses ?? 0,
        overtime: dto.overtime ?? 0,
        absences_deductions: dto.absences_deductions ?? 0,
        advances: dto.advances ?? 0,
        dependent_children: employee.dependent_children ?? 0,
        usd_cdf_rate: Number(payroll.usd_cdf_rate),
      },
      legalParams,
    );

    const payslip = await this.upsertPayslip(client, payrollId, employee, calc);
    return { payslip, calculation_detail: calc };
  }

  async closePayroll(
    payrollId: string,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const payroll = await this.getOwnPayroll(payrollId, companyId, accessToken);

    if (payroll.status === 'closed') {
      throw new ConflictException('Cette paie est déjà clôturée.');
    }

    const { data, error } = await client
      .from('payrolls')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        legal_parameters_snapshot: payroll.legal_parameters,
      })
      .eq('id', payrollId)
      .eq('company_id', companyId)
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
    await this.getOwnPayroll(payrollId, companyId, accessToken);

    const { data: employees, error } = await client
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'active');
    if (error) throw new InternalServerErrorException(error.message);

    const results: Array<{ employee_id: string; status: 'success' }> = [];
    for (const employee of employees ?? []) {
      await this.calculateAndSavePayslip(
        payrollId,
        { employee_id: employee.id },
        companyId,
        accessToken,
      );
      results.push({ employee_id: employee.id, status: 'success' });
    }

    return { processed: results.length, results };
  }
}
