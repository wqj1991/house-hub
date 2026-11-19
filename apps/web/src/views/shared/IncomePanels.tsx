import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { RowChevron } from "@/components/RowChevron";
import {
  CONTRIBUTION_LABEL,
  RELATION_LABEL,
  FAMILY_FLAG_LABEL,
  VERDICT_LABEL,
  assessHf,
  familyIncome,
  planLoan,
  type IncomeMember,
  type LoanVerdict,
} from "@house/core";
import { formatRatio, formatRate, formatWan, formatYuan } from "@/lib/incomeFormat";
import type { IncomeState } from "@/lib/incomeState";

const VERDICT_COLOR: Record<LoanVerdict, string> = {
  green: "var(--accent-emerald)",
  amber: "var(--accent-amber)",
  red: "var(--accent-coral)",
};

function Row({ label, value, color, bold }: { label: string; value: ReactNode; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{label}</span>
      <span className="n" style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 700 : 600, color }}>
        {value}
      </span>
    </div>
  );
}

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid " + (active ? "var(--accent-cyan)" : "var(--glass-border-subtle)"),
    background: active ? "rgba(2,132,199,0.16)" : "transparent",
    color: active ? "var(--accent-cyan)" : "var(--text-sub)",
  };
}

const inputStyle: CSSProperties = {
  width: 110,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--glass-border-subtle)",
  background: "var(--card-inset-bg)",
  color: "var(--text-main)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  textAlign: "right",
  boxSizing: "border-box",
};

export interface MemberListProps {
  members: IncomeMember[];
  editingUid: string | null;
  onEdit: (member: IncomeMember) => void;
  onRemove: (member: IncomeMember) => void;
  /** 手机端没有「编辑」按钮：整行点击直接进入编辑页 */
  variant?: "desktop" | "mobile";
}

/** 家庭成员名单：一行一人，带关系、缴存状态与该成员折算额度。 */
export function MemberList({ members, editingUid, onEdit, onRemove, variant = "desktop" }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="card-inset" style={{ fontSize: 13, color: "var(--text-dim)", padding: 18 }}>
        还没有家庭成员。先添加老公，再添加老婆 / 父母，家庭收入与公积金额度会随录入立刻汇总。
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {members.map((member) => {
        const card = (
        <div
          className="card-inset"
          role={variant === "mobile" ? "button" : undefined}
          tabIndex={variant === "mobile" ? 0 : undefined}
          onClick={variant === "mobile" ? () => onEdit(member) : undefined}
          onKeyDown={variant === "mobile" ? (event) => (event.key === "Enter" || event.key === " ") && onEdit(member) : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderColor: member.uid === editingUid ? "var(--accent-cyan)" : undefined,
            cursor: variant === "mobile" ? "pointer" : undefined,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {member.name || RELATION_LABEL[member.relation]}
              <span className="tag-pill" style={{ marginLeft: 8, fontSize: 11 }}>
                {RELATION_LABEL[member.relation]}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              月入 {formatYuan(member.monthlyNet)}
              {member.bonusAnnual > 0 ? " · 奖金 " + formatYuan(member.bonusAnnual) + "/年" : ""} · 公积金{" "}
              {formatYuan(member.hfMonthly)}/月 · {CONTRIBUTION_LABEL[member.hfState]}
              {member.hfInBeijing ? "" : " · 异地"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flex: "0 0 auto", alignItems: "center" }}>
            {variant === "mobile" ? (
              <RowChevron />
            ) : (
              <>
                <button type="button" className="g-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onEdit(member)}>
                  编辑
                </button>
                <button type="button" className="g-btn g-btn-danger" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onRemove(member)}>
                  删除
                </button>
              </>
            )}
          </div>
        </div>
        );
        return <Fragment key={member.uid}>{card}</Fragment>;
      })}
    </div>
  );
}

/** 家庭收入汇总：月入 / 年入 / 公积金缴存 / 缴存人数。 */
export function FamilyKpis({ members, variant = "desktop" }: { members: IncomeMember[]; variant?: "desktop" | "mobile" }) {
  const family = familyIncome(members);
  const cells = [
    {
      label: family.bonusAnnual > 0 ? "家庭月均入（含奖金）" : "家庭税后月入",
      value: formatYuan(Math.round(family.monthlyAvg)) + " 元/月",
      color: "var(--accent-cyan)",
    },
    { label: "家庭税后年入", value: formatWan(family.annualNet) + " 万元", color: undefined },
    { label: "公积金月缴存", value: formatYuan(family.hfMonthly) + " 元/月", color: "var(--accent-emerald)" },
    { label: "计入额度人数", value: family.contributors + " 人", color: family.contributors > 0 ? undefined : "var(--accent-coral)" },
  ];
  return (
    <div style={variant === "desktop" ? { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 } : { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {cells.map((cell) => (
        <div key={cell.label} className="card-inset">
          <div className="lb">{cell.label}</div>
          <div className="n" style={{ fontSize: variant === "desktop" ? 20 : 17, fontWeight: 700, marginTop: 6, color: cell.color }}>
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 家庭条件卡：收入页只问与房子无关的两项（北京户籍 / 二孩及以上）。 */
export function FamilyFlagsCard({ state, onPatch }: { state: IncomeState; onPatch: (patch: Partial<IncomeState>) => void }) {
  return (
    <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>家庭条件（额度上浮用）</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>房子的事算房贷时再问</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["hukouBeijing", "child"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onPatch({ family: { ...state.family, [key]: !state.family[key] } })}
            style={chipStyle(state.family[key])}
            title={
              key === "hukouBeijing"
                ? "城六区户籍家庭在城六区外买首套，额度上限 +20 万（只算首套）"
                : "本市户籍二孩及以上多子女家庭：额度上限 +40 万"
            }
          >
            {FAMILY_FLAG_LABEL[key]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.55 }}>
        北京户籍只影响「城六区外首套 +20 万」这一条，要等房子定下来才算；二孩及以上直接 +40 万。
      </div>
    </div>
  );
}

/** 公积金可贷评估：年限口径 vs 审批口径，取小，附警告。 */
export function HfPanel({ state }: { state: IncomeState }) {
  const family = familyIncome(state.members);
  const hf = assessHf(state.members, family, { years: state.years, second: state.second, family: state.family });
  return (
    <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>公积金可贷</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {state.second ? "二套" : "首套"} · {formatRate(hf.rate)} · {state.years} 年
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="n cyan" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
          {hf.finalQuotaWan.toFixed(1)}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-sub)" }}>万元 · 月供 {formatYuan(hf.finalMonthly)} 元</span>
      </div>

      <Row
        label={"计入额度年限（" + (hf.couple ? "双方缴存 · 较长一方" : "1 人缴存") + " · 每年 " + hf.perYearWan + " 万）"}
        value={hf.countedYears + " 年"}
      />
      <Row
        label={"额度上限（基准 " + hf.baseCapWan + " 万" + (hf.upliftWan > 0 ? " + 上浮 " + hf.upliftWan + " 万" : "") + "）"}
        value={hf.capWan + " 万元"}
      />
      <Row
        label={family.bonusAnnual > 0 ? "家庭月均入（奖金摊入）" : "家庭税后月入"}
        value={formatYuan(Math.round(family.monthlyAvg)) + " 元/月"}
      />
      <Row
        label="年限口径额度"
        value={hf.quotaWan.toFixed(1) + " 万" + (hf.yearsToCap > 0 ? "（还差 " + hf.yearsToCap + " 年吃满 " + hf.capWan + " 万）" : "（已到顶）")}
      />
      <Row
        label="审批口径额度"
        value={hf.approvalQuotaWan.toFixed(1) + " 万（月还款 ≤ " + formatYuan(hf.approvalMonthly) + "）"}
        color={hf.limitedByApproval ? "var(--accent-amber)" : undefined}
      />
      <Row label="公积金冲抵后现金月供" value={formatYuan(hf.cashMonthly) + " 元/月"} />
      <Row label="可提取余额（首付用）" value={formatWan(family.hfBalance) + " 万元"} />

      {hf.warnings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
          {hf.warnings.map((warning) => (
            <div key={warning} style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)" }}>
              · {warning}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface LoanPanelProps {
  state: IncomeState;
  onPatch: (patch: Partial<IncomeState>) => void;
}

/** 组合贷测算：总价 / 首付比例 / 年限 / 首二套，输出月供与收入占比。 */
export function LoanPanel({ state, onPatch }: LoanPanelProps) {
  const result = planLoan(state.members, {
    dealWan: state.dealWan,
    downRatio: state.downRatio,
    years: state.years,
    second: state.second,
    family: state.family,
  });
  const { plan, family } = result;

  return (
    <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>组合贷与月供压力</div>
        <span className="tag-pill" style={{ color: VERDICT_COLOR[plan.verdict], background: "transparent", border: "1px solid " + VERDICT_COLOR[plan.verdict] }}>
          {VERDICT_LABEL[plan.verdict]}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-sub)" }}>目标总价</span>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={String(state.dealWan)}
            onChange={(event) => {
              const next = Number(event.target.value.replace(/[^0-9.]/g, ""));
              onPatch({ dealWan: Number.isFinite(next) && next >= 0 ? next : 0 });
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>万元</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0.2, 0.3, 0.35, 0.4].map((ratio) => (
            <button key={ratio} type="button" onClick={() => onPatch({ downRatio: ratio })} style={chipStyle(Math.abs(state.downRatio - ratio) < 0.001)}>
              {(ratio * 100).toFixed(0)}%
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[20, 25, 30].map((years) => (
            <button key={years} type="button" onClick={() => onPatch({ years })} style={chipStyle(state.years === years)}>
              {years} 年
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onPatch({ second: false })} style={chipStyle(!state.second)}>
            首套
          </button>
          <button type="button" onClick={() => onPatch({ second: true })} style={chipStyle(state.second)}>
            二套
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.55 }}>
        房子的条件（是否城六区外、是否绿色建筑）等选完房算房贷时再填，届时最多再上浮 20 / 40 万；这里只按家庭条件（北京户籍、二孩及以上）计。
      </div>
      <div style={{ height: 1, background: "var(--glass-border-subtle)" }} />
      <Row label="首付" value={formatWan(plan.downPaymentYuan) + " 万元（" + (plan.downRatio * 100).toFixed(0) + "%）"} />
      <Row
        label={"政策最低首付（" + (state.second ? "二套" : "首套") + "）"}
        value={(plan.minDownRatio * 100).toFixed(0) + "%" + (plan.downRatioTooLow ? " · 当前低于下限" : "")}
        color={plan.downRatioTooLow ? "var(--accent-coral)" : undefined}
      />
      <Row
        label={"公积金贷 " + plan.hfUsedWan.toFixed(1) + " 万 · " + (result.hf.rate * 100).toFixed(2) + "%"}
        value={formatYuan(plan.hfMonthly) + " 元/月"}
      />
      <Row
        label={"商贷 " + formatWan(plan.commercialYuan) + " 万 · " + (result.hf.policy.commercialRate * 100).toFixed(2) + "%"}
        value={formatYuan(plan.commercialMonthly) + " 元/月"}
      />
      <div style={{ height: 1, background: "var(--glass-border-subtle)" }} />
      <Row label="月供合计" value={formatYuan(plan.monthly) + " 元/月"} color="var(--accent-cyan)" bold />
      <Row
        label={family.bonusAnnual > 0 ? "家庭月均入（含奖金）" : "家庭税后月入"}
        value={formatYuan(plan.incomeMonthlyAvg) + " 元/月"}
      />
      <Row
        label="月供 / 家庭月均入"
        value={formatRatio(plan.ratio) + "（上限 " + (result.hf.policy.safetyRatio * 100).toFixed(0) + "%）"}
        color={VERDICT_COLOR[plan.verdict]}
      />
      <Row label="40% 月供硬上限" value={formatYuan(plan.safetyMonthly) + " 元/月"} />
      <Row label="公积金冲抵后现金月供" value={formatYuan(plan.cashMonthly) + " 元/月"} />
      <Row label={result.hf.policy.bufferMonths + " 个月断流缓冲"} value={formatWan(plan.bufferYuan) + " 万元"} color="var(--accent-amber)" />
      <Row label="家庭可用公积金余额" value={formatWan(family.hfBalance) + " 万元"} />
    </div>
  );
}
