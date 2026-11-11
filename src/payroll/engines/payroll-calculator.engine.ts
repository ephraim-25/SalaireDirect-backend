/**
 * ============================================================
 * MOTEUR DE CALCUL DE PAIE - SalaireDirect
 * ============================================================
 * RÈGLE FONDAMENTALE: Aucun taux n'est codé en dur.
 * Tous les paramètres légaux proviennent de la table `legal_parameters`
 * via un snapshot enregistré au moment de la clôture du payroll.
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
  usd_cdf_rate: number; // Taux de change du mois
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
 * Calcule l'IPR (Impôt Professionnel sur les Revenus) RDC
 * selon le barème progressif par tranches.
 *
 * @param grossSalaryCdf - Salaire brut imposable en CDF
 * @param dependentChildren - Nombre d'enfants à charge
 * @param params - Paramètres légaux (barème IPR, allocations familiales)
 * @returns Montant IPR en CDF
 */
export function calculateIpr(
  grossSalaryCdf: number,
  dependentChildren: number,
  params: LegalParameters,
): { ipr: number; familyAllowance: number } {
  // Allocations familiales déduites du brut avant calcul IPR
  const familyAllowance = dependentChildren * params.family_allowance_per_child;
  const taxableIncome = Math.max(0, grossSalaryCdf - familyAllowance);

  if (taxableIncome <= 0) {
    return { ipr: 0, familyAllowance };
  }

  let ipr = 0;
  const brackets = params.ipr_brackets;

  for (const bracket of brackets) {
    const bracketMin = bracket.min;
    const bracketMax = bracket.max ?? Infinity;

    if (taxableIncome <= bracketMin) break;

    const taxableInBracket = Math.min(taxableIncome, bracketMax) - bracketMin;

    if (taxableInBracket <= 0) continue;

    if (bracket.rate === 0) continue;

    // Calcul IPR pour cette tranche
    if (taxableIncome > bracketMin) {
      ipr = bracket.cumulative_tax_below +
        (taxableIncome - bracketMin) * bracket.rate;
      // On recalcule à chaque itération car la tranche active écrase les précédentes
    }
  }

  // Recalcul propre avec la bonne tranche active
  ipr = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    const bracketMax = bracket.max ?? Infinity;

    if (taxableIncome > bracket.min && taxableIncome <= bracketMax) {
      // C'est la tranche active
      ipr = bracket.cumulative_tax_below +
        (taxableIncome - bracket.min) * bracket.rate;
      break;
    }
  }

  return { ipr: Math.max(0, Math.round(ipr)), familyAllowance };
}

/**
 * Moteur principal de calcul d'un bulletin de paie.
 * Toutes les valeurs monétaires sont retournées dans la devise originale de l'employé.
 */
export function calculatePayslip(
  input: PayslipInput,
  params: LegalParameters,
): PayslipCalculationResult {
  const { usd_cdf_rate, salary_currency, dependent_children } = input;

  // 1. Calcul du salaire brut
  const gross_salary =
    input.base_salary +
    input.bonuses +
    input.overtime -
    input.absences_deductions;

  // 2. Conversion en CDF pour le calcul IPR (toujours en CDF selon la loi)
  const gross_salary_cdf =
    salary_currency === 'USD' ? gross_salary * usd_cdf_rate : gross_salary;

  // 3. CNSS Employé (sur le brut, dans la devise de l'employé)
  const cnss_employee = gross_salary * params.cnss_employee_rate;

  // 4. CNSS Employeur
  const cnss_employer = gross_salary * params.cnss_employer_rate;

  // 5. IPR (calculé en CDF, retourné en CDF)
  const { ipr: ipr_cdf, familyAllowance } = calculateIpr(
    gross_salary_cdf,
    dependent_children,
    params,
  );

  // 6. Conversion IPR dans la devise de paiement
  const ipr =
    salary_currency === 'USD' ? ipr_cdf / usd_cdf_rate : ipr_cdf;

  // 7. Net à payer
  const net_payable = gross_salary - cnss_employee - ipr - input.advances;

  // 8. Construction des lignes du bulletin
  const currency = salary_currency;
  const items: PayslipLineItem[] = [
    // Gains
    { label: 'Salaire de base', item_type: 'earning', amount: round(input.base_salary), currency, sort_order: 1 },
    { label: 'Primes & Bonus', item_type: 'earning', amount: round(input.bonuses), currency, sort_order: 2 },
    { label: 'Heures supplémentaires', item_type: 'earning', amount: round(input.overtime), currency, sort_order: 3 },
    // Déductions
    { label: 'Absences', item_type: 'deduction', amount: round(input.absences_deductions), currency, sort_order: 10 },
    { label: `CNSS Employé (${(params.cnss_employee_rate * 100).toFixed(1)}%)`, item_type: 'deduction', amount: round(cnss_employee), currency, sort_order: 11 },
    { label: 'IPR', item_type: 'deduction', amount: round(ipr), currency, sort_order: 12 },
    { label: 'Acompte sur salaire', item_type: 'deduction', amount: round(input.advances), currency, sort_order: 13 },
    // Infos
    { label: `Salaire brut`, item_type: 'info', amount: round(gross_salary), currency, sort_order: 20 },
    { label: `Net à payer`, item_type: 'info', amount: round(net_payable), currency, sort_order: 21 },
    { label: `Allocations familiales (${dependent_children} enfant(s)) en CDF`, item_type: 'info', amount: round(familyAllowance), currency: 'CDF', sort_order: 22 },
    // Charges patronales (hors net)
    { label: `CNSS Patronal (${(params.cnss_employer_rate * 100).toFixed(1)}%)`, item_type: 'employer_charge', amount: round(cnss_employer), currency, sort_order: 30 },
  ];

  return {
    base_salary: round(input.base_salary),
    bonuses: round(input.bonuses),
    overtime: round(input.overtime),
    absences_deductions: round(input.absences_deductions),
    advances: round(input.advances),
    gross_salary: round(gross_salary),
    gross_salary_cdf: round(gross_salary_cdf),
    cnss_employee: round(cnss_employee),
    ipr: round(ipr),
    family_allowance: round(familyAllowance),
    net_payable: round(net_payable),
    cnss_employer: round(cnss_employer),
    items,
  };
}

function round(value: number, decimals = 4): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
