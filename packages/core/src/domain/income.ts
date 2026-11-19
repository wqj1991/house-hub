/**
 * 收入与公积金：纯函数域内核，零 IO（ARCHITECTURE §4：三端与测试共用同一份）。
 * 金额一律「元」，利率用小数（0.0285 = 2.85%），缴存年限单位「年」（可带小数）。
 * 额度口径默认取北京公积金现行规则，全部收进 HfPolicy —— 政策变了自己改一处，别散落在页面里。
 */

import { monthlyPayment, principalFromMonthly } from "../scoring/money";

export type MemberRelation = "self" | "spouse" | "child" | "parent" | "other";

export const RELATION_LABEL: Record<MemberRelation, string> = {
  self: "老公",
  spouse: "老婆",
  child: "子女",
  parent: "父母",
  other: "其他",
};

export type ContributionState = "active" | "paused" | "none";

export const CONTRIBUTION_LABEL: Record<ContributionState, string> = {
  active: "正常缴存",
  paused: "断缴 / 停缴",
  none: "未缴存",
};

/** 一个家庭成员的收入与公积金画像。uid 认人，不认顺序。 */
export interface IncomeMember {
  uid: string;
  name: string;
  relation: MemberRelation;
  /** 税后月收入（元/月）：现金流口径，不是税前工资 */
  monthlyNet: number;
  /** 奖金 / 年终奖（元/年，税后）：按 12 个月摊入月均，审批与月供占比都算它 */
  bonusAnnual: number;
  /** 公积金月缴存额（个人 + 单位，元/月） */
  hfMonthly: number;
  /** 公积金账户余额（元） */
  hfBalance: number;
  /** 连续缴存年限（年，可带小数；额度按「不足 1 整年进 1 年」进位） */
  hfYears: number;
  hfState: ContributionState;
  /** 是否在北京缴存；异地缴存要先转入/回京认定，默认不计入额度 */
  hfInBeijing: boolean;
}

/**
 * 家庭条件（京建发〔2026〕400 号 三（一））：收入页只问这两项，跟具体哪套房无关。
 */
export interface HfFamilyFlags {
  /** 北京户籍：城六区户籍家庭买城六区外首套时才多 20 万，这里先记「有没有京籍」 */
  hukouBeijing: boolean;
  /** 本市户籍二孩及以上多子女家庭：+40 万 */
  child: boolean;
}

/** 房子的条件：等选完房、算房贷时再问，收入页不出现。 */
export interface HfPropertyFlags {
  /** 所购住房在城六区外（只限首套，且需北京户籍） */
  outerSix: boolean;
  /** 所购住房符合本市建筑绿色发展支持政策：+40 万 */
  green: boolean;
}

export const NO_FAMILY_FLAGS: HfFamilyFlags = { hukouBeijing: false, child: false };

export const NO_PROPERTY_FLAGS: HfPropertyFlags = { outerSix: false, green: false };

export const FAMILY_FLAG_LABEL: Record<keyof HfFamilyFlags, string> = {
  hukouBeijing: "北京户籍",
  child: "二孩及以上",
};

export const PROPERTY_FLAG_LABEL: Record<keyof HfPropertyFlags, string> = {
  outerSix: "城六区外首套",
  green: "绿色建筑",
};

export interface HfPolicy {
  /** 1 人缴存：每缴存满 1 年可贷（万元） */
  singlePerYearWan: number;
  /** 夫妻双方均缴存：每缴存满 1 年可贷（万元） */
  couplePerYearWan: number;
  /** 1 人缴存：首套最高可贷（万元） */
  singleFirstCapWan: number;
  /** 1 人缴存：二套最高可贷（万元） */
  singleSecondCapWan: number;
  /** 双方缴存：首套最高可贷（万元） */
  coupleFirstCapWan: number;
  /** 双方缴存：二套最高可贷（万元） */
  coupleSecondCapWan: number;
  /** 城六区外首套上浮（万元） */
  upliftOuterSixWan: number;
  /** 建筑绿色发展上浮（万元） */
  upliftGreenWan: number;
  /** 二孩及以上多子女上浮（万元） */
  upliftChildWan: number;
  /** 1 人缴存家庭的上浮上限（万元） */
  singleUpliftCapWan: number;
  /** 双方缴存家庭的上浮上限（万元） */
  coupleUpliftCapWan: number;
  /** 首套公积金贷款年利率（5 年以上） */
  firstRate: number;
  /** 二套公积金贷款年利率（5 年以上） */
  secondRate: number;
  /** 组合贷里商业部分的年利率 */
  commercialRate: number;
  /** 公积金中心审批口径：月还款额 ≤ 家庭月收入 × 该比例 */
  approvalRatio: number;
  /** 自用财务铁律：月供 ≤ 家庭税后月入 × 该比例 */
  safetyRatio: number;
  /** 最长可贷年限 */
  maxYears: number;
  /** 断流缓冲：按月供应留几个月（指南里的 12 个月极端备用金） */
  bufferMonths: number;
  /** 首套最低首付款比例 */
  minDownFirst: number;
  /** 二套最低首付款比例 */
  minDownSecond: number;
  /** 申请门槛：连续缴存月数 */
  minContributeMonths: number;
}

/**
 * 北京公积金默认口径（2026-11 现行）：
 * - 额度：京建发〔2026〕400 号（2026-08-08 施行）—— 1 人缴存 首套 120 万 / 二套 100 万；
 *   夫妻双方均为缴存人 首套 240 万 / 二套 200 万；上浮 20 / 40 / 40 万，1 人上浮 ≤60 万、双方 ≤100 万（→180 / 340 万）。
 * - 年限挂钩：1 人每缴存满 1 年 20 万，双方每满 1 年 40 万；按夫妻中缴存年限较长一方算，不足 1 年按 1 年。
 * - 利率：2025-05-08 起新发放，5 年以上 首套 2.6% / 二套 3.075%。
 * - 首付：首套 ≥20%（京建发〔2024〕219 号）；二套 ≥25%（京建发〔2025〕565 号）。
 * - 期限：2023-12 起最长 30 年；审批口径 月还款 ≤ 家庭月收入 60%。
 */
export const DEFAULT_HF_POLICY: HfPolicy = {
  singlePerYearWan: 20,
  couplePerYearWan: 40,
  singleFirstCapWan: 120,
  singleSecondCapWan: 100,
  coupleFirstCapWan: 240,
  coupleSecondCapWan: 200,
  upliftOuterSixWan: 20,
  upliftGreenWan: 40,
  upliftChildWan: 40,
  singleUpliftCapWan: 60,
  coupleUpliftCapWan: 100,
  firstRate: 0.026,
  secondRate: 0.03075,
  commercialRate: 0.031,
  approvalRatio: 0.6,
  safetyRatio: 0.4,
  maxYears: 30,
  bufferMonths: 12,
  minDownFirst: 0.2,
  minDownSecond: 0.25,
  minContributeMonths: 6,
};

function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** 夫妻关系（老公 / 老婆）：只有夫妻双方的缴存才能并成一份家庭额度。 */
export function isSpouseRelation(relation: MemberRelation): boolean {
  return relation === "self" || relation === "spouse";
}

/** 计入额度：夫妻一方、在京缴存且状态正常（父母 / 子女的缴存不并入额度）。 */
export function countsForQuota(member: IncomeMember): boolean {
  return member.hfState === "active" && member.hfInBeijing && isSpouseRelation(member.relation);
}

export interface FamilyIncome {
  /** 家庭税后工资月入合计（元/月，不含奖金） */
  monthlyNet: number;
  /** 家庭奖金 / 年终奖合计（元/年） */
  bonusAnnual: number;
  /** 家庭税后年收入（元）＝ 工资月入 × 12 + 奖金 */
  annualNet: number;
  /** 家庭月均收入（元/月）＝ 年入 ÷ 12，奖金已摊平；审批口径与月供占比用它 */
  monthlyAvg: number;
  /** 家庭公积金月缴存合计（元/月） */
  hfMonthly: number;
  /** 家庭公积金账户余额合计（元） */
  hfBalance: number;
  /** 计入额度的缴存人数 */
  contributors: number;
}

export function familyIncome(members: IncomeMember[]): FamilyIncome {
  let monthlyNet = 0;
  let bonusAnnual = 0;
  let hfMonthly = 0;
  let hfBalance = 0;
  let contributors = 0;
  for (const member of members) {
    monthlyNet += Math.max(0, member.monthlyNet);
    bonusAnnual += Math.max(0, member.bonusAnnual);
    hfMonthly += Math.max(0, member.hfMonthly);
    hfBalance += Math.max(0, member.hfBalance);
    if (countsForQuota(member)) contributors += 1;
  }
  const annualNet = monthlyNet * 12 + bonusAnnual;
  return { monthlyNet, bonusAnnual, annualNet, monthlyAvg: annualNet / 12, hfMonthly, hfBalance, contributors };
}

/** 缴存年限：不足 1 整年按 1 整年计（北京口径）。 */
export function countedYears(member: IncomeMember, policy: HfPolicy = DEFAULT_HF_POLICY): number {
  if (!countsForQuota(member)) return 0;
  const raw = Math.max(0, member.hfYears);
  const whole = raw > 0 ? Math.ceil(raw) : member.hfMonthly > 0 ? 1 : 0;
  return Math.min(whole, policy.maxYears);
}

export interface MemberQuota {
  uid: string;
  name: string;
  relation: MemberRelation;
  /** 本人的缴存年限（整年进位后） */
  countedYears: number;
  /** 本人贡献给家庭额度的金额（万元；夫妻双方缴存时只有年限较长一方有值） */
  yearsWan: number;
  /** 是否属于「夫妻 + 在京 + 正常缴存」的缴存人 */
  counted: boolean;
  /** 是否为年限较长一方 */
  leader: boolean;
  /** 不计入 / 不参与核算的原因 */
  reason: string | null;
}

/**
 * 逐人额度：夫妻双方都缴存时，只按缴存年限较长的一方核算（京建发〔2026〕400 号三（一）），
 * 年限不叠加；父母 / 子女的缴存不并入家庭额度。
 */
export function memberQuotas(members: IncomeMember[], policy: HfPolicy = DEFAULT_HF_POLICY): MemberQuota[] {
  const counted = members.filter((member) => countsForQuota(member));
  const couple = counted.length >= 2;
  const perYearWan = couple ? policy.couplePerYearWan : policy.singlePerYearWan;
  let leaderUid: string | null = null;
  let longest = 0;
  for (const member of counted) {
    const years = countedYears(member, policy);
    if (leaderUid === null || years > longest) {
      leaderUid = member.uid;
      longest = years;
    }
  }
  return members.map((member) => {
    const years = countedYears(member, policy);
    const isCounted = countsForQuota(member);
    const leader = isCounted && member.uid === leaderUid;
    const yearsWan = leader ? years * perYearWan : 0;
    let reason: string | null = null;
    if (!isCounted) {
      reason = !isSpouseRelation(member.relation)
        ? "共同借款人只认夫妻，父母 / 子女的缴存不并入额度"
        : member.hfState !== "active"
          ? CONTRIBUTION_LABEL[member.hfState] + "，不计入额度"
          : "异地缴存，需先转入 / 回京认定";
    } else if (couple && !leader) {
      reason = "双方都缴存时按年限较长的一方核算（" + longest + " 年），本人的年限不叠加";
    }
    return { uid: member.uid, name: member.name, relation: member.relation, countedYears: years, yearsWan, counted: isCounted, leader, reason };
  });
}

export interface HfAssessmentInput {
  /** 二套（利率、额度上限、首付比例都变） */
  second?: boolean;
  /** 贷款年限（年） */
  years?: number;
  /** 家庭条件（北京户籍 / 二孩及以上）：收入页录入 */
  family?: HfFamilyFlags;
  /** 房子的条件（城六区外 / 绿色建筑）：选完房算房贷时才传 */
  property?: HfPropertyFlags;
  policy?: HfPolicy;
}

export interface HfAssessment {
  policy: HfPolicy;
  second: boolean;
  years: number;
  rate: number;
  /** 夫妻双方是否都缴存：决定每年 20 万还是 40 万、首套上限 120 万还是 240 万 */
  couple: boolean;
  /** 每缴存满 1 年可贷（万元） */
  perYearWan: number;
  /** 政策基准上限（万元，不含上浮） */
  baseCapWan: number;
  /** 实际计入的上浮额度（万元，已按家庭上限截断） */
  upliftWan: number;
  /** 家庭条件（北京户籍 / 二孩及以上） */
  family: HfFamilyFlags;
  /** 房子的条件（城六区外 / 绿色建筑） */
  property: HfPropertyFlags;
  /** 有效上限（万元）＝ baseCapWan + upliftWan */
  capWan: number;
  members: MemberQuota[];
  /** 计入额度的缴存年限（夫妻中较长一方，年） */
  countedYears: number;
  /** 年限折算额度（万元，封顶前） */
  rawWan: number;
  /** 年限口径可贷（万元，封顶后） */
  quotaWan: number;
  /** 吃满有效上限还差几年（0 = 已到顶） */
  yearsToCap: number;
  quotaYuan: number;
  quotaMonthly: number;
  /** 审批口径月还款上限（元/月） */
  approvalMonthly: number;
  /** 审批口径反推的最大额度（万元） */
  approvalQuotaWan: number;
  /** 审批口径是否成为瓶颈 */
  limitedByApproval: boolean;
  /** 最终可贷（万元）＝ 年限口径与审批口径取小 */
  finalQuotaWan: number;
  finalQuotaYuan: number;
  finalMonthly: number;
  /** 公积金按月冲还贷后的现金月供（元/月） */
  cashMonthly: number;
  warnings: string[];
}

/**
 * 公积金可贷评估（2026 口径）：
 * 年限口径 ＝ 夫妻中缴存年限较长一方 × 每年额度（1 人 20 万 / 双方 40 万），受「基准 + 上浮」上限截断；
 * 审批口径 ＝ 月还款 ≤ 家庭月均入 × 60% 反推本金；两者取小，再给出冲还贷后的现金月供。
 */
export function assessHf(members: IncomeMember[], family: FamilyIncome, input: HfAssessmentInput = {}): HfAssessment {
  const policy = input.policy ?? DEFAULT_HF_POLICY;
  const second = input.second ?? false;
  const years = clamp(input.years ?? policy.maxYears, 1, policy.maxYears);
  const rate = second ? policy.secondRate : policy.firstRate;
  const familyFlags = input.family ?? NO_FAMILY_FLAGS;
  const property = input.property ?? NO_PROPERTY_FLAGS;
  const quotas = memberQuotas(members, policy);
  const couple = quotas.filter((quota) => quota.counted).length >= 2;
  const perYearWan = couple ? policy.couplePerYearWan : policy.singlePerYearWan;
  const baseCapWan = couple
    ? second
      ? policy.coupleSecondCapWan
      : policy.coupleFirstCapWan
    : second
      ? policy.singleSecondCapWan
      : policy.singleFirstCapWan;
  const upliftCapWan = couple ? policy.coupleUpliftCapWan : policy.singleUpliftCapWan;
  let upliftRaw = 0;
  const outerSixApplied = property.outerSix && familyFlags.hukouBeijing && !second;
  if (outerSixApplied) upliftRaw += policy.upliftOuterSixWan;
  if (property.green) upliftRaw += policy.upliftGreenWan;
  if (familyFlags.child) upliftRaw += policy.upliftChildWan;
  const upliftWan = Math.min(upliftRaw, upliftCapWan);
  const capWan = baseCapWan + upliftWan;

  const leader = quotas.find((quota) => quota.leader);
  const longestYears = leader ? leader.countedYears : 0;
  const rawWan = leader ? leader.yearsWan : 0;
  const quotaWan = Math.min(rawWan, capWan);
  const yearsToCap = rawWan >= capWan ? 0 : Math.ceil((capWan - rawWan) / perYearWan);
  const quotaYuan = Math.round(quotaWan * 10000);
  const quotaMonthly = Math.round(monthlyPayment(quotaYuan, rate, years));
  const approvalMonthly = Math.round(family.monthlyAvg * policy.approvalRatio);
  const approvalQuotaWan = Math.min(principalFromMonthly(approvalMonthly, rate, years) / 10000, capWan);
  const limitedByApproval = approvalQuotaWan < quotaWan;
  const finalQuotaWan = Math.max(0, Math.min(quotaWan, approvalQuotaWan));
  const finalQuotaYuan = Math.round(finalQuotaWan * 10000);
  const finalMonthly = Math.round(monthlyPayment(finalQuotaYuan, rate, years));
  const cashMonthly = Math.max(0, Math.round(finalMonthly - family.hfMonthly));

  const warnings: string[] = [];
  if (members.length === 0) warnings.push("还没录成员：收入与额度都是 0，先录一个人");
  if (family.monthlyNet <= 0) warnings.push("家庭月收入为 0，额度会被审批口径压到 0");
  if (family.bonusAnnual > 0) {
    warnings.push(
      "奖金 " + (family.bonusAnnual / 10000).toFixed(1) + " 万/年按 12 个月摊成月均 " + Math.round(family.bonusAnnual / 12) + " 元：审批看近 12 个月流水，发放不满一年的奖金未必全额认",
    );
  }
  if (family.contributors === 0) warnings.push("没有计入额度的缴存人：公积金共同借款人只认夫妻，且要在京正常缴存");
  if (family.contributors === 1) warnings.push("只有 1 人缴存：每年 20 万、首套上限 120 万；夫妻双方都缴存才是每年 40 万、首套 240 万");
  if (couple) warnings.push("双方都缴存：年限按较长一方（" + longestYears + " 年）× 每年 40 万核算，两人年限不叠加");
  if (rawWan > 0 && rawWan < capWan) {
    warnings.push("缴存 " + longestYears + " 年 × " + perYearWan + " 万 = " + rawWan + " 万；吃满 " + capWan + " 万上限还需 " + yearsToCap + " 年");
  }
  if (rawWan > capWan) {
    warnings.push("年限折算 " + rawWan + " 万已超上限，按 " + capWan + " 万计（基准 " + baseCapWan + " 万 + 上浮 " + upliftWan + " 万）");
  }
  if (property.outerSix && second) warnings.push("「城六区外首套 +20 万」只适用首套，二套不计入上浮");
  if (property.outerSix && !familyFlags.hukouBeijing) warnings.push("城六区外 +20 万要求城六区户籍；没勾北京户籍，这 20 万不计入");
  if (upliftRaw > upliftWan) {
    warnings.push("上浮条件合计 " + upliftRaw + " 万，" + (couple ? "夫妻双方" : "1 人") + "缴存家庭上浮上限 " + upliftCapWan + " 万，已截断");
  }
  if (limitedByApproval) warnings.push("年限够但收入不够：审批口径把额度压到 " + approvalQuotaWan.toFixed(1) + " 万（月还款 ≤ 家庭月入 " + Math.round(policy.approvalRatio * 100) + "%）");
  for (const quota of quotas) {
    if (quota.reason) warnings.push((quota.name || RELATION_LABEL[quota.relation]) + "：" + quota.reason);
  }
  if (family.hfBalance > 0) warnings.push("北京额度按缴存年限算、不按余额倍数；账户余额留给首付提取 / 按月冲还贷");

  return {
    policy,
    second,
    years,
    rate,
    couple,
    perYearWan,
    baseCapWan,
    upliftWan,
    family: familyFlags,
    property,
    capWan,
    members: quotas,
    countedYears: longestYears,
    rawWan,
    quotaWan,
    yearsToCap,
    quotaYuan,
    quotaMonthly,
    approvalMonthly,
    approvalQuotaWan,
    limitedByApproval,
    finalQuotaWan,
    finalQuotaYuan,
    finalMonthly,
    cashMonthly,
    warnings: Array.from(new Set(warnings)),
  };
}

export interface LoanInput extends HfAssessmentInput {
  /** 目标总价（万元） */
  dealWan: number;
  /** 首付比例（0.35 = 三成五） */
  downRatio: number;
}

export type LoanVerdict = "green" | "amber" | "red";

export const VERDICT_LABEL: Record<LoanVerdict, string> = {
  green: "安全区",
  amber: "压线",
  red: "越线",
};

export interface LoanPlan {
  dealWan: number;
  priceYuan: number;
  downRatio: number;
  /** 政策最低首付比例（首套 20% / 二套 25%） */
  minDownRatio: number;
  /** 当前首付比例低于政策下限 */
  downRatioTooLow: boolean;
  downPaymentYuan: number;
  needLoanYuan: number;
  /** 组合贷里公积金出多少（不超过总贷款需求） */
  hfQuotaYuan: number;
  hfMonthly: number;
  commercialYuan: number;
  commercialMonthly: number;
  monthly: number;
  /** 家庭月均入（含奖金摊入） × 40% */
  safetyMonthly: number;
  /** 用于占比与审批的家庭月均收入（含奖金摊入，元/月） */
  incomeMonthlyAvg: number;
  /** 公积金中心审批线：家庭月入 × 60% */
  approvalMonthly: number;
  /** 月供 / 家庭月均入（含奖金摊入） */
  ratio: number | null;
  verdict: LoanVerdict;
  /** 12 个月断流缓冲（元） */
  bufferYuan: number;
  /** 公积金按月冲抵后的现金月供（元/月） */
  cashMonthly: number;
  /** 公积金贷款部分被收入审批线压缩到多少（万元） */
  hfUsedWan: number;
}

export interface LoanResult {
  family: FamilyIncome;
  hf: HfAssessment;
  plan: LoanPlan;
}

/** 组合贷测算：总价 → 首付 → 公积金可贷 → 商贷差额 → 月供 → 收入占比。 */
export function planLoan(members: IncomeMember[], input: LoanInput): LoanResult {
  const family = familyIncome(members);
  const hf = assessHf(members, family, input);
  const priceYuan = Math.round(Math.max(0, input.dealWan) * 10000);
  const downRatio = clamp(input.downRatio, 0, 0.9);
  const minDownRatio = hf.second ? hf.policy.minDownSecond : hf.policy.minDownFirst;
  const downPaymentYuan = Math.round(priceYuan * downRatio);
  const needLoanYuan = Math.max(0, priceYuan - downPaymentYuan);
  const hfQuotaYuan = Math.min(hf.finalQuotaYuan, needLoanYuan);
  const commercialYuan = Math.max(0, needLoanYuan - hfQuotaYuan);
  const hfMonthly = Math.round(monthlyPayment(hfQuotaYuan, hf.rate, hf.years));
  const commercialMonthly = Math.round(monthlyPayment(commercialYuan, hf.policy.commercialRate, hf.years));
  const monthly = hfMonthly + commercialMonthly;
  const safetyMonthly = Math.round(family.monthlyAvg * hf.policy.safetyRatio);
  const ratio = family.monthlyAvg > 0 ? monthly / family.monthlyAvg : null;
  const verdict: LoanVerdict = ratio == null ? "amber" : ratio <= hf.policy.safetyRatio ? "green" : ratio <= hf.policy.approvalRatio ? "amber" : "red";

  return {
    family,
    hf,
    plan: {
      dealWan: input.dealWan,
      priceYuan,
      downRatio,
      minDownRatio,
      downRatioTooLow: downRatio + 1e-9 < minDownRatio,
      downPaymentYuan,
      needLoanYuan,
      hfQuotaYuan,
      hfMonthly,
      commercialYuan,
      commercialMonthly,
      monthly,
      safetyMonthly,
      incomeMonthlyAvg: Math.round(family.monthlyAvg),
      approvalMonthly: hf.approvalMonthly,
      ratio,
      verdict,
      bufferYuan: Math.round(monthly * hf.policy.bufferMonths),
      cashMonthly: Math.max(0, Math.round(hfMonthly - family.hfMonthly)),
      hfUsedWan: hfQuotaYuan / 10000,
    },
  };
}
