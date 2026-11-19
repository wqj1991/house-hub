import { useState } from "react";
import type { IncomeMember } from "@house/core";
import { assessHf, familyIncome } from "@house/core";
import { formatRatio, formatWan, formatYuan } from "@/lib/incomeFormat";
import { createMember, patchIncomeState, removeMember, upsertMember, useIncomeState } from "@/lib/incomeState";
import type { IncomeSnapshot } from "@/lib/incomeState";
import { showToast } from "@/lib/toast";
import { FamilyFlagsCard, FamilyKpis, HfPanel, LoanPanel, MemberList } from "./IncomePanels";

export interface IncomeEditorPage {
  member: IncomeMember;
  isNew: boolean;
}

export interface IncomeEditor {
  state: IncomeSnapshot;
  /** 收入详情页是否展开：我的首页只给概要，点开才是完整界面 */
  open: boolean;
  openDetail: () => void;
  closeDetail: () => void;
  /** 非空即进入成员录入子页面，由外层页面整页接管 */
  page: IncomeEditorPage | null;
  saving: boolean;
  startAdd: () => void;
  startEdit: (member: IncomeMember) => void;
  submit: (member: IncomeMember) => Promise<void>;
  remove: (member: IncomeMember) => Promise<void>;
  close: () => void;
}

/** 收入录入状态机：桌面「我的」与手机「我的」共用，数据存服务器。 */
export function useIncomeEditor(): IncomeEditor {
  const state = useIncomeState();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<IncomeEditorPage | null>(null);
  const [saving, setSaving] = useState(false);

  const startAdd = () => {
    const hasSelf = state.members.some((member) => member.relation === "self");
    setPage({ member: createMember(hasSelf ? "spouse" : "self"), isNew: true });
  };

  const startEdit = (member: IncomeMember) => setPage({ member, isNew: false });

  const submit = async (member: IncomeMember) => {
    if (saving) return;
    setSaving(true);
    try {
      await upsertMember(member);
      setPage(null);
      showToast("已保存到服务器", (member.name || "家庭成员") + " 已计入家庭收入");
    } catch (err) {
      showToast("没存到服务器", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (member: IncomeMember) => {
    const label = member.name || "该成员";
    if (!window.confirm("删除「" + label + "」的收入记录？")) return;
    try {
      await removeMember(member.uid);
      if (page && page.member.uid === member.uid) setPage(null);
      showToast("已删除", label);
    } catch (err) {
      showToast("删除没成功", (err as Error).message);
    }
  };

  return {
    state,
    open,
    openDetail: () => setOpen(true),
    closeDetail: () => setOpen(false),
    page,
    saving,
    startAdd,
    startEdit,
    submit,
    remove,
    close: () => setPage(null),
  };
}

/** 概要一行文字：家庭月入 · 公积金 · 可贷。 */
function summaryText(state: IncomeSnapshot): string {
  const family = familyIncome(state.members);
  if (state.members.length === 0) return "还没录成员 · 点开添加本人、配偶或父母";
  const hf = assessHf(state.members, family, { years: state.years, second: state.second });
  return (
    "家庭月均入 " +
    formatYuan(Math.round(family.monthlyAvg)) +
    " 元/月 · 公积金 " +
    formatYuan(family.hfMonthly) +
    "/月 · 可贷 " +
    hf.finalQuotaWan.toFixed(1) +
    " 万"
  );
}

export interface IncomeSummaryRowProps {
  variant?: "desktop" | "mobile";
  state: IncomeSnapshot;
  onOpen: () => void;
}

/** 「我的」首页上的收入概要：只露一行数，点开才进完整界面。 */
export function IncomeSummaryRow({ variant = "desktop", state, onOpen }: IncomeSummaryRowProps) {
  if (variant === "mobile") {
    return (
      <div className="me-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen()} style={{ cursor: "pointer" }}>
        <div className="me-row-left">
          <div className="me-row-icon" style={{ color: "#0284C7" }}>
            <svg viewBox="0 0 24 24" style={{ fill: "none", stroke: "currentColor" }}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></svg>
          </div>
          <div>
            <div className="me-row-title">收入与公积金</div>
            <div className="me-row-desc">{summaryText(state)}</div>
          </div>
        </div>
        <div className="me-row-right">
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "var(--text-dim)", strokeWidth: 2, fill: "none" }}><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass"
      style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>收入与公积金</div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{summaryText(state)}</div>
      </div>
      <button type="button" className="g-btn g-btn-primary" onClick={onOpen}>
        查看完整测算 ›
      </button>
    </div>
  );
}

export interface IncomeDetailPageProps {
  variant?: "desktop" | "mobile";
  editor: IncomeEditor;
}

/** 收入详情整页：返回头 + 完整的成员录入 / 汇总 / 可贷 / 月供压力。 */
export function IncomeDetailPage({ variant = "desktop", editor }: IncomeDetailPageProps) {
  return (
    <>
      {variant === "mobile" ? (
        <div className="m-nav-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="m-nav-circle-btn"
              onClick={editor.closeDetail}
              title="返回"
              style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}
            >
              ‹
            </button>
            <h1 className="m-nav-title" style={{ fontSize: 20 }}>
              收入与公积金
            </h1>
          </div>
          <div className="m-nav-actions">
            <button type="button" className="m-nav-circle-btn" onClick={editor.startAdd} title="添加家庭成员">
              ＋
            </button>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" className="g-btn" onClick={editor.closeDetail} style={{ padding: "6px 12px", fontSize: 13 }}>
            ‹ 返回「我的」
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>收入与公积金 · 家庭可贷测算</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              先录本人，再录配偶 / 父母；家庭收入、缴存年限与可贷额度随录入实时重算，数据存服务器，两台设备共用一份。
            </div>
          </div>
        </div>
      )}

      <IncomeSection
        variant={variant}
        state={editor.state}
        onAdd={editor.startAdd}
        onEdit={editor.startEdit}
        onRemove={editor.remove}
        hideHeader={variant === "desktop"}
      />
    </>
  );
}

export interface IncomeSectionProps {
  variant?: "desktop" | "mobile";
  state: IncomeSnapshot;
  onAdd: () => void;
  onEdit: (member: IncomeMember) => void;
  onRemove: (member: IncomeMember) => void;
  /** 详情页已自带标题与添加按钮时，隐藏板块内的桌面头卡 / 手机添加按钮 */
  hideHeader?: boolean;
}

/** 收入与公积金完整内容：成员录入 + 家庭收入汇总 + 公积金可贷 + 组合贷压力。 */
export function IncomeSection({ variant = "desktop", state, onAdd, onEdit, onRemove, hideHeader = false }: IncomeSectionProps) {
  if (variant === "mobile") {
    return <MobileIncome state={state} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove} hideAdd={hideHeader} />;
  }

  return (
    <>
      {hideHeader ? null : (
        <div
          className="glass"
          style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>收入与公积金 · 家庭可贷测算</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              先录本人，再录配偶 / 父母；家庭收入、缴存年限与可贷额度随录入实时重算，数据存服务器，两台设备共用一份。
            </div>
          </div>
          <button type="button" className="g-btn g-btn-primary" onClick={onAdd}>
            ＋ 添加家庭成员
          </button>
        </div>
      )}

      <PhaseHint phase={state.phase} error={state.error} where="右上角「账号 → 服务器地址」" />

      <MemberList members={state.members} editingUid={null} onEdit={onEdit} onRemove={onRemove} />

      <FamilyFlagsCard state={state} onPatch={patchIncomeState} />

      <FamilyKpis members={state.members} />

      <div className="board-split">
        <HfPanel state={state} />
        <LoanPanel state={state} onPatch={patchIncomeState} />
      </div>
    </>
  );
}

/** 服务器未就绪时的提示条；ready 时不渲染。 */
function PhaseHint({ phase, error, where }: { phase: string; error?: string | null; where: string }) {
  if (phase === "ready") return null;
  const text =
    phase === "unpaired"
      ? "还没有连服务器：去「" + where + "」填地址和配对码。成员与测算都存在服务器上，两台设备共用一份。"
      : phase === "loading"
        ? "正在从服务器读取…"
        : "服务器读取失败：" + (error ?? "未知错误") + "（去「" + where + "」重试）";
  return (
    <div className="glass" style={{ padding: "14px 18px", borderRadius: 16, fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
      {text}
    </div>
  );
}

/** 手机版：大数卡 + 成员卡 + 汇总卡 + 两块测算卡。 */
function MobileIncome({
  state,
  onAdd,
  onEdit,
  onRemove,
  hideAdd,
}: Omit<IncomeSectionProps, "variant" | "hideHeader"> & { hideAdd: boolean }) {
  const family = familyIncome(state.members);
  return (
    <>
      <PhaseHint phase={state.phase} error={state.error} where="我的 → 数据与服务器" />

      <div className="m-card glass">
        <div className="lb">{family.bonusAnnual > 0 ? "家庭月均入（含奖金）" : "家庭税后月入"}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span className="n" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
            {formatYuan(Math.round(family.monthlyAvg))}
          </span>
          <span style={{ fontSize: 14, color: "var(--text-sub)" }}>元/月</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          {state.members.length} 位成员 · 工资 {formatYuan(family.monthlyNet)}/月
          {family.bonusAnnual > 0 ? " · 奖金 " + formatWan(family.bonusAnnual) + " 万/年" : ""} · 年入 {formatWan(family.annualNet)} 万
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
          公积金 {formatYuan(family.hfMonthly)}/月 · 账户余额 {formatWan(family.hfBalance)} 万
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
          月供占比上限 {formatRatio(0.4)} 是硬线，越线先降总价再看贷款结构
        </div>
      </div>

      <div className="m-card glass" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="lb">家庭成员</div>
          {hideAdd ? null : (
            <button
              type="button"
              className="g-btn"
              style={{ padding: "6px 14px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={onAdd}
            >
              ＋ 添加
            </button>
          )}
        </div>
        <MemberList variant="mobile" members={state.members} editingUid={null} onEdit={onEdit} onRemove={onRemove} />
      </div>

      <div className="m-card glass" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="lb">家庭收入汇总</div>
        <FamilyKpis members={state.members} variant="mobile" />
      </div>

      <FamilyFlagsCard state={state} onPatch={patchIncomeState} />

      <HfPanel state={state} />
      <LoanPanel state={state} onPatch={patchIncomeState} />
    </>
  );
}
