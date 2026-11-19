import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CONTRIBUTION_LABEL,
  DEFAULT_HF_POLICY,
  RELATION_LABEL,
  countedYears,
  type ContributionState,
  type IncomeMember,
  type MemberRelation,
} from "@house/core";
import { formatYuan } from "@/lib/incomeFormat";

interface FormState {
  name: string;
  relation: MemberRelation;
  monthlyNet: string;
  bonusAnnual: string;
  hfMonthly: string;
  hfBalance: string;
  hfYears: string;
  hfState: ContributionState;
  hfInBeijing: boolean;
}

export interface IncomeMemberEditorProps {
  /** 编辑目标：新增时传 createMember() 出来的空壳 */
  value: IncomeMember;
  onSubmit: (member: IncomeMember) => void;
  onCancel: () => void;
  variant?: "desktop" | "mobile";
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--glass-border-subtle)",
  background: "var(--card-inset-bg)",
  color: "var(--text-main)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

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

function toForm(member: IncomeMember): FormState {
  return {
    name: member.name,
    relation: member.relation,
    monthlyNet: member.monthlyNet > 0 ? String(member.monthlyNet) : "",
    bonusAnnual: member.bonusAnnual > 0 ? String(member.bonusAnnual) : "",
    hfMonthly: member.hfMonthly > 0 ? String(member.hfMonthly) : "",
    hfBalance: member.hfBalance > 0 ? String(member.hfBalance) : "",
    hfYears: member.hfYears > 0 ? String(member.hfYears) : "",
    hfState: member.hfState,
    hfInBeijing: member.hfInBeijing,
  };
}

/** 输入框里的空串 / 乱码统一按 0 处理，负数不许进状态。 */
function toNumber(raw: string): number {
  const value = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const RELATION_OPTIONS = (Object.keys(RELATION_LABEL) as MemberRelation[]).map((value) => ({
  value,
  label: RELATION_LABEL[value],
}));

const STATE_OPTIONS = (Object.keys(CONTRIBUTION_LABEL) as ContributionState[]).map((value) => ({
  value,
  label: CONTRIBUTION_LABEL[value],
}));

interface ChipsProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

function Chips<T extends string>({ options, value, onChange }: ChipsProps<T>) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={chipStyle(option.value === value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="lb">{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{hint}</div> : null}
    </div>
  );
}

/** 成员录入 / 编辑表单：桌面与手机共用，字段全部受控，保存时才落库。 */
export function IncomeMemberEditor({ value, onSubmit, onCancel, variant = "desktop" }: IncomeMemberEditorProps) {
  const [form, setForm] = useState<FormState>(() => toForm(value));

  function patch(next: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  const draft: IncomeMember = {
    uid: value.uid,
    name: form.name.trim() || RELATION_LABEL[form.relation],
    relation: form.relation,
    monthlyNet: toNumber(form.monthlyNet),
    bonusAnnual: toNumber(form.bonusAnnual),
    hfMonthly: toNumber(form.hfMonthly),
    hfBalance: toNumber(form.hfBalance),
    hfYears: toNumber(form.hfYears),
    hfState: form.hfState,
    hfInBeijing: form.hfInBeijing,
  };
  const years = countedYears(draft);
  const quotaWan = years * DEFAULT_HF_POLICY.singlePerYearWan;
  const monthlyAvg = draft.monthlyNet + Math.round(draft.bonusAnnual / 12);

  return (
    <div
      className="card-inset"
      style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{value.name ? "编辑成员" : "新增家庭成员"}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>金额单位：元 · 收入填税后</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: variant === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gap: 12,
        }}
      >
        <Field label="姓名">
          <input
            style={inputStyle}
            value={form.name}
            placeholder="如：老公 / 老婆"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field label="家庭关系">
          <Chips options={RELATION_OPTIONS} value={form.relation} onChange={(next) => patch({ relation: next })} />
        </Field>

        <Field label="税后月收入 (元/月)">
          <input
            style={inputStyle}
            inputMode="numeric"
            value={form.monthlyNet}
            placeholder="0"
            onChange={(event) => patch({ monthlyNet: event.target.value })}
          />
        </Field>

        <Field label="奖金 / 年终奖 (元/年)" hint="税后 · 按 12 个月摊入月均">
          <input
            style={inputStyle}
            inputMode="numeric"
            value={form.bonusAnnual}
            placeholder="0"
            onChange={(event) => patch({ bonusAnnual: event.target.value })}
          />
        </Field>

        <Field label="公积金月缴存 (元/月)" hint="个人 + 单位合计">
          <input
            style={inputStyle}
            inputMode="numeric"
            value={form.hfMonthly}
            placeholder="0"
            onChange={(event) => patch({ hfMonthly: event.target.value })}
          />
        </Field>

        <Field label="公积金账户余额 (元)">
          <input
            style={inputStyle}
            inputMode="numeric"
            value={form.hfBalance}
            placeholder="0"
            onChange={(event) => patch({ hfBalance: event.target.value })}
          />
        </Field>

        <Field label="连续缴存年限 (年)" hint="不满 1 年按 1 年计；夫妻都缴存按较长一方核算">
          <input
            style={inputStyle}
            inputMode="decimal"
            value={form.hfYears}
            placeholder="0"
            onChange={(event) => patch({ hfYears: event.target.value })}
          />
        </Field>

        <Field label="缴存状态">
          <Chips options={STATE_OPTIONS} value={form.hfState} onChange={(next) => patch({ hfState: next })} />
        </Field>

        <Field label="缴存城市">
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => patch({ hfInBeijing: true })} style={chipStyle(form.hfInBeijing)}>
              北京缴存
            </button>
            <button type="button" onClick={() => patch({ hfInBeijing: false })} style={chipStyle(!form.hfInBeijing)}>
              异地缴存
            </button>
          </div>
        </Field>
      </div>

      <div
        className="card-inset"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--text-sub)" }}>本条录入折算额度（每年 {DEFAULT_HF_POLICY.singlePerYearWan} 万）</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
            税后月入 {formatYuan(draft.monthlyNet)} + 奖金摊入 {formatYuan(Math.round(draft.bonusAnnual / 12))} = 月均 {formatYuan(monthlyAvg)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
            {draft.relation === "self" || draft.relation === "spouse"
              ? "夫妻都缴存时，家庭额度按两人中年限较长的一方算，年限不叠加"
              : "共同借款人只认夫妻，父母 / 子女的缴存不并入额度"}
          </div>
        </div>
        <div className="n" style={{ fontSize: 16, fontWeight: 700, color: quotaWan > 0 ? "var(--accent-cyan)" : "var(--text-dim)" }}>
          {quotaWan} 万 · {years} 年
        </div>
      </div>

      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="g-btn" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="g-btn g-btn-primary" onClick={() => onSubmit(draft)}>
          保存成员
        </button>
      </div>
    </div>
  );
}
