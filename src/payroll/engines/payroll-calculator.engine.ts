/**
 * ============================================================
 * MOTEUR DE CALCUL DE PAIE - SalaireDirect
 * ============================================================
 * Aucun taux n'est codé en dur dans ce fichier : tous les paramètres légaux
 * (CNSS, barème IPR, allocations) sont fournis via `LegalParameters`
 * (table `legal_parameters`). Le moteur est une fonction pure, facile à tester.
 *
 * ⚠️ La méthodologie fiscale (base imposable de l'IPR, traitement des charges de
 * famille) reflète la configuration actuelle et doit être validée par un
 * expert-comptable / la réglementation en vigueur.
 * ============================================================
 */

export interface IprBracket {
  min: number;
  max: number | null;
  rate: number;
  cumulative_tax_below: number;
}

export interface LegalParameters {
  cnss_employee_rate: number;
  cnss_employer_rate: number;
  ipr_brackets: IprBracket[];
  family_allowance_per_child: number;
  smig_rate: number;
}

export interface PayslipInput {
  base_salary: number;
  salary_currency: 'USD' | 'CDF';
  bonuses: number;
  overtime: number;
  absences_deductions: number;
  advances: number;
  dependent_children: number;
  usd_cdf_rate: number; // Taux de change du mois (1 USD = X CDF)
}

export interface PayslipCalculationResult {
  base_salary: number;
  bonuses: number;
  overtime: number;
  absences_deductions: number;
  advances: number;
  gross_salary: number;
  gross_salary_cdf: number;
  cnss_employee: number;
  ipr: number;
  family_allowance: number;
  net_payable: number;
  cnss_employer: number;
  items: PayslipLineItem[];
}

export interface PayslipLineItem {
  label: string;
  item_type: 'earning' | 'deduction' | 'employer_charge' | 'info';
  amount: number;
  currency: 'USD' | 'CDF';
  sort_order: number;
}

/**
 * Calcule l'IPR (Impôt Professionnel sur les Revenus) selon le barème progressif par tranches.
 *
 * La tranche applicable est la plus haute dont le seuil `min` est ≤ au revenu imposable.
 * (Ancienne version : un revenu décimal situé entre deux tranches, par ex. 1 269 999,4 avec
 * des tranches [.., 1 269 999] et [1 270 000, ..], tombait dans un « trou » et donnait IPR = 0.)
 *
 * @param grossSalaryCdf - Salaire brut imposable en CDF
 * @param dependentChildren - Nombre d'enfants à charge
 * @returns Montant IPR en CDF (arrondi à l'unité)
 */
export function calculateIpr(
  grossSalaryCdf: number,
  dependentChildren: number,
  params: LegalParameters,
): { ipr: number; familyAllowance: number } {
  const familyAllowance = dependentChildren * params.family_allowance_per_child;
  const taxableIncome = Math.max(0, grossSalaryCdf - familyAllowance);

  if (taxableIncome <= 0) {
    return { ipr: 0, familyAllowance };
  }

  const brackets = [...params.ipr_brackets].sort((a, b) => a.min - b.min);

  let active: IprBracket | undefined;
  for (const bracket of brackets) {
    if (bracket.min <= taxableIncome) active = bracket;
  }

  if (!active) return { ipr: 0, familyAllowance };

  const ipr =
    active.cumulative_tax_below + (taxableIncome - active.min) * active.rate;
  return { ipr: Math.max(0, Math.round(ipr)), familyAllowance };
}

/** Arrondi monétaire : 2 décimales en USD, unité entière en CDF. */
export function roundMoney(value: number, currency: 'USD' | 'CDF'): number {
  const decimals = currency === 'CDF' ? 0 : 2;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calcule un bulletin. Les montants sont retournés dans la devise du salarié, déjà arrondis ;
 * le net est calculé à partir des montants arrondis pour que le bulletin « tombe juste ».
 */
export function calculatePayslip(
  input: PayslipInput,
  params: LegalParameters,
): PayslipCalculationResult {
  const { usd_cdf_rate, salary_currency: currency, dependent_children } = input;
  const r = (v: number) => roundMoney(v, currency);

  const base = r(input.base_salary);
  const bonuses = r(input.bonuses);
  const overtime = r(input.overtime);
  const absences = r(input.absences_deductions);
  const advances = r(input.advances);

  // 1. Brut (jamais négatif : des absences supérieures au salaire ne créent pas de brut négatif)
  const gross = Math.max(0, r(base + bonuses + overtime - absences));

  // 2. Conversion en CDF pour l'IPR (calculé en CDF)
  const grossCdf = currency === 'USD' ? gross * usd_cdf_rate : gross;

  // 3. Cotisations CNSS (devise du salarié)
  const cnssEmployee = r(gross * params.cnss_employee_rate);
  const cnssEmployer = r(gross * params.cnss_employer_rate);

  // 4. IPR (CDF) puis conversion dans la devise du salarié
  const { ipr: iprCdf, familyAllowance } = calculateIpr(
    grossCdf,
    dependent_children,
    params,
  );
  const ipr = r(currency === 'USD' ? iprCdf / usd_cdf_rate : iprCdf);

  // 5. Net à payer, à partir de montants déjà arrondis
  const net = r(gross - cnssEmployee - ipr - advances);

  const items: PayslipLineItem[] = [
    {
      label: 'Salaire de base',
      item_type: 'earning',
      amount: base,
      currency,
      sort_order: 1,
    },
    {
      label: 'Primes & Bonus',
      item_type: 'earning',
      amount: bonuses,
      currency,
      sort_order: 2,
    },
    {
      label: 'Heures supplémentaires',
      item_type: 'earning',
      amount: overtime,
      currency,
      sort_order: 3,
    },
    {
      label: 'Absences',
      item_type: 'deduction',
      amount: absences,
      currency,
      sort_order: 10,
    },
    {
      label: `CNSS Employé (${(params.cnss_employee_rate * 100).toFixed(1)}%)`,
      item_type: 'deduction',
      amount: cnssEmployee,
      currency,
      sort_order: 11,
    },
    {
      label: 'IPR',
      item_type: 'deduction',
      amount: ipr,
      currency,
      sort_order: 12,
    },
    {
      label: 'Acompte sur salaire',
      item_type: 'deduction',
      amount: advances,
      currency,
      sort_order: 13,
    },
    {
      label: 'Salaire brut',
      item_type: 'info',
      amount: gross,
      currency,
      sort_order: 20,
    },
    {
      label: 'Net à payer',
      item_type: 'info',
      amount: net,
      currency,
      sort_order: 21,
    },
    {
      label: `Allocations familiales (${dependent_children} enfant(s)) en CDF`,
      item_type: 'info',
      amount: roundMoney(familyAllowance, 'CDF'),
      currency: 'CDF',
      sort_order: 22,
    },
    {
      label: `CNSS Patronal (${(params.cnss_employer_rate * 100).toFixed(1)}%)`,
      item_type: 'employer_charge',
      amount: cnssEmployer,
      currency,
      sort_order: 30,
    },
  ];

  return {
    base_salary: base,
    bonuses,
    overtime,
    absences_deductions: absences,
    advances,
    gross_salary: gross,
    gross_salary_cdf: roundMoney(grossCdf, 'CDF'),
    cnss_employee: cnssEmployee,
    ipr,
    family_allowance: roundMoney(familyAllowance, 'CDF'),
    net_payable: net,
    cnss_employer: cnssEmployer,
    items,
  };
}
