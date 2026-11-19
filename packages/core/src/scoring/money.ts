/**
 * 月供与首付。纯函数，三端与测试共用同一份。
 * 金额统一「元」，万元只在展示层换算（TECH-STACK §7）。
 */

/** 等额本息月供。rate 为年利率（0.031 = 3.1%）。 */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** 首付金额（万元）。deal 万元口径，downRatio 0.35 = 三成五。 */
export function downPayment(dealWan: number, downRatio: number): number {
  return dealWan * downRatio;
}

/** 贷款总额（元）。 */
export function loanPrincipal(dealWan: number, downRatio: number): number {
  return Math.max(0, dealWan * 10000 * (1 - downRatio));
}

/** 等额本息反推本金：给定能承受的月供，反算能贷多少。rate 为年利率。 */
export function principalFromMonthly(monthly: number, annualRate: number, years: number): number {
  if (monthly <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  const grow = Math.pow(1 + r, n);
  return (monthly * (grow - 1)) / (r * grow);
}

/** 月供压力 = 月供 / 家庭税后月收入。 */
export function pressureRatio(monthly: number, income: number): number | null {
  if (income <= 0) return null;
  return monthly / income;
}
