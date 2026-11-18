import {
  calculateIpr,
  calculatePayslip,
  LegalParameters,
  roundMoney,
} from './payroll-calculator.engine';

const params: LegalParameters = {
  cnss_employee_rate: 0.035,
  cnss_employer_rate: 0.059,
  family_allowance_per_child: 12000,
  smig_rate: 7075,
  ipr_brackets: [
    { min: 0, max: 524999, rate: 0, cumulative_tax_below: 0 },
    { min: 525000, max: 1269999, rate: 0.15, cumulative_tax_below: 0 },
    { min: 1270000, max: 2114999, rate: 0.2, cumulative_tax_below: 111750 },
    { min: 2115000, max: null, rate: 0.225, cumulative_tax_below: 280750 },
  ],
};

describe('calculateIpr', () => {
  it("n'impose pas un revenu sous le premier seuil", () => {
    expect(calculateIpr(500000, 0, params).ipr).toBe(0);
  });

  it('applique la tranche à 15 %', () => {
    // (1 000 000 - 525 000) x 15 % = 71 250
    expect(calculateIpr(1_000_000, 0, params).ipr).toBe(71250);
  });

  it('ne tombe pas dans le « trou » entre deux tranches (revenu décimal)', () => {
    // 1 269 999,5 est entre max=1 269 999 et min=1 270 000 : l'ancien code renvoyait 0.
    const ipr = calculateIpr(1_269_999.5, 0, params).ipr;
    expect(ipr).toBeGreaterThan(111000);
  });

  it('est continu à la frontière des tranches', () => {
    expect(calculateIpr(1_270_000, 0, params).ipr).toBe(111750);
  });

  it('déduit les allocations familiales du revenu imposable', () => {
    const sans = calculateIpr(1_000_000, 0, params).ipr;
    const avec = calculateIpr(1_000_000, 2, params).ipr;
    expect(avec).toBeLessThan(sans);
    expect(calculateIpr(1_000_000, 2, params).familyAllowance).toBe(24000);
  });

  it('gère la dernière tranche sans plafond', () => {
    expect(calculateIpr(3_000_000, 0, params).ipr).toBe(
      280750 + Math.round((3_000_000 - 2_115_000) * 0.225),
    );
  });
});

describe('calculatePayslip', () => {
  const base = {
    base_salary: 1_000_000,
    salary_currency: 'CDF' as const,
    bonuses: 0,
    overtime: 0,
    absences_deductions: 0,
    advances: 0,
    dependent_children: 0,
    usd_cdf_rate: 2800,
  };

  it('calcule brut, CNSS, IPR et net en CDF', () => {
    const r = calculatePayslip(base, params);
    expect(r.gross_salary).toBe(1_000_000);
    expect(r.cnss_employee).toBe(35_000);
    expect(r.cnss_employer).toBe(59_000);
    expect(r.ipr).toBe(71_250);
    expect(r.net_payable).toBe(1_000_000 - 35_000 - 71_250);
  });

  it("convertit en CDF pour l'IPR puis reconvertit en USD", () => {
    const r = calculatePayslip(
      { ...base, base_salary: 500, salary_currency: 'USD' },
      params,
    );
    // 500 USD = 1 400 000 CDF => IPR en CDF puis /2800
    expect(r.gross_salary_cdf).toBe(1_400_000);
    expect(r.ipr).toBeCloseTo(calculateIpr(1_400_000, 0, params).ipr / 2800, 2);
    expect(r.net_payable).toBeCloseTo(500 - r.cnss_employee - r.ipr, 2);
  });

  it('arrondit en USD à 2 décimales et le net « tombe juste »', () => {
    const r = calculatePayslip(
      {
        ...base,
        base_salary: 333.333,
        salary_currency: 'USD',
        bonuses: 10.005,
      },
      params,
    );
    expect(r.gross_salary).toBe(roundMoney(r.gross_salary, 'USD'));
    expect(r.net_payable).toBeCloseTo(
      r.gross_salary - r.cnss_employee - r.ipr - r.advances,
      2,
    );
  });

  it('ne produit jamais de brut négatif', () => {
    const r = calculatePayslip(
      { ...base, absences_deductions: 5_000_000 },
      params,
    );
    expect(r.gross_salary).toBe(0);
    expect(r.cnss_employee).toBe(0);
    expect(r.ipr).toBe(0);
  });

  it('déduit les avances du net', () => {
    const r = calculatePayslip({ ...base, advances: 100_000 }, params);
    expect(r.net_payable).toBe(1_000_000 - 35_000 - 71_250 - 100_000);
  });
});
