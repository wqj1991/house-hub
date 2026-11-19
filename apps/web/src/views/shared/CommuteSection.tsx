import { Fragment, useState } from "react";
import { RowChevron } from "../../components/RowChevron";
import {
  COMMUTE_ACCESS_LABEL,
  COMMUTE_VEHICLE_LABEL,
  SHUTTLE_SEAT_LABEL,
  commuteLine,
  commuteOverview,
  formatCoord,
  formatDuration,
  isOfficeGeocoded,
  type CommuteHabit,
  type CommuteVehicle,
  type OfficeLocation,
} from "@house/core";
import {
  createHabit,
  createOffice,
  removeHabit,
  removeOffice,
  saveHabit,
  saveOffice,
  saveShuttleBinding,
  useCommuteState,
} from "@/lib/commuteState";
import type { CommuteSnapshot } from "@/lib/commuteState";
import { showToast } from "@/lib/toast";
import { CommuteHabitPage, CommuteOfficePage } from "./CommuteEditors";
import { ShuttleBoard, ShuttleLinePage } from "./ShuttleSection";

/** 录入子页面：公司地点、某一条通勤习惯，或某条班车线路。 */
export type CommuteEditorPage =
  | { kind: "office"; office: OfficeLocation; isNew: boolean }
  | { kind: "habit"; habit: CommuteHabit; isNew: boolean }
  /** code=null 表示新增；officeUid 是进来时挂着的公司 */
  | { kind: "shuttle"; code: string | null; officeUid: string };

export interface CommuteEditor {
  state: CommuteSnapshot;
  /** 通勤详情页是否展开：我的首页只给一行概要 */
  open: boolean;
  openDetail: () => void;
  closeDetail: () => void;
  page: CommuteEditorPage | null;
  saving: boolean;
  startAddOffice: () => void;
  startEditOffice: (office: OfficeLocation) => void;
  startAddHabit: (vehicle?: CommuteVehicle) => void;
  startEditHabit: (habit: CommuteHabit) => void;
  startAddShuttle: (officeUid?: string) => void;
  startEditShuttle: (code: string, officeUid: string) => void;
  submitOffice: (office: OfficeLocation) => Promise<void>;
  submitHabit: (habit: CommuteHabit) => Promise<void>;
  /** 班车线路保存后写归属：线路本体已经存好，这里只把这行挂到公司 */
  submitShuttle: (code: string, officeUid: string) => Promise<void>;
  removeOffice: (office: OfficeLocation) => Promise<void>;
  removeHabit: (habit: CommuteHabit) => Promise<void>;
  close: () => void;
}

/** 通勤维护状态机：桌面「我的」与手机「我的」共用，档案存服务器。 */
export function useCommuteEditor(): CommuteEditor {
  const state = useCommuteState();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<CommuteEditorPage | null>(null);
  const [saving, setSaving] = useState(false);

  const startAddOffice = () => setPage({ kind: "office", office: createOffice(), isNew: true });
  const startEditOffice = (office: OfficeLocation) => setPage({ kind: "office", office, isNew: false });
  const startAddHabit = (vehicle: CommuteVehicle = "transit") =>
    setPage({ kind: "habit", habit: createHabit(vehicle), isNew: true });
  const startEditHabit = (habit: CommuteHabit) => setPage({ kind: "habit", habit, isNew: false });
  const startAddShuttle = (officeUid = "") => setPage({ kind: "shuttle", code: null, officeUid });
  const startEditShuttle = (code: string, officeUid: string) => setPage({ kind: "shuttle", code, officeUid });

  async function run(task: () => Promise<void>, okTitle: string, okBody: string, errTitle: string) {
    if (saving) return;
    setSaving(true);
    try {
      await task();
      setPage(null);
      showToast(okTitle, okBody);
    } catch (err) {
      showToast(errTitle, (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const submitOffice = (office: OfficeLocation) =>
    run(() => saveOffice(office), "已保存到服务器", "公司地点「" + (office.name || "未命名") + "」已更新", "没存到服务器");

  const submitHabit = (habit: CommuteHabit) =>
    run(
      () => saveHabit(habit),
      "已保存到服务器",
      COMMUTE_VEHICLE_LABEL[habit.vehicle] + " " + (habit.label || "通勤") + " 已更新",
      "没存到服务器",
    );

  /** 班车线路已存好，只差归属：没变就不发请求，变了才写。 */
  const submitShuttle = async (code: string, officeUid: string) => {
    const upper = code.trim().toUpperCase();
    const before = state.shuttles.find((row) => row.code === upper)?.officeUid ?? "";
    if (before === officeUid) {
      setPage(null);
      return;
    }
    const office = state.offices.find((row) => row.uid === officeUid);
    await run(
      () => saveShuttleBinding(upper, officeUid),
      "班车已挂到公司",
      upper + " → " + (office?.name || "未分配"),
      "归属没存到服务器",
    );
  };

  const dropOffice = async (office: OfficeLocation) => {
    const label = office.name || "该地点";
    const linked = state.habits.filter((habit) => habit.officeUid === office.uid).length;
    const lines = state.shuttles.filter((row) => row.officeUid === office.uid).length;
    const extra =
      (linked > 0 ? "\n有 " + linked + " 条通勤习惯指向它，会退回「通用」。" : "") +
      (lines > 0 ? "\n有 " + lines + " 条班车线路挂着它，会退回「未分配」。" : "");
    if (!window.confirm("删除公司地点「" + label + "」？" + extra)) return;
    try {
      await removeOffice(office.uid);
      if (page && page.kind === "office" && page.office.uid === office.uid) setPage(null);
      showToast("已删除", label);
    } catch (err) {
      showToast("删除没成功", (err as Error).message);
    }
  };

  const dropHabit = async (habit: CommuteHabit) => {
    const label = (habit.label || COMMUTE_VEHICLE_LABEL[habit.vehicle]) + " 通勤";
    if (!window.confirm("删除「" + label + "」？")) return;
    try {
      await removeHabit(habit.uid);
      if (page && page.kind === "habit" && page.habit.uid === habit.uid) setPage(null);
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
    startAddOffice,
    startEditOffice,
    startAddHabit,
    startEditHabit,
    startAddShuttle,
    startEditShuttle,
    submitOffice,
    submitHabit,
    submitShuttle,
    removeOffice: dropOffice,
    removeHabit: dropHabit,
    close: () => setPage(null),
  };
}

/* ────────────────── 概要 ────────────────── */

export interface CommuteSummaryRowProps {
  variant?: "desktop" | "mobile";
  state: CommuteSnapshot;
  onOpen: () => void;
}

/** 「我的」首页上的通勤概要：一行字，点开才进完整维护界面。 */
export function CommuteSummaryRow({ variant = "desktop", state, onOpen }: CommuteSummaryRowProps) {
  const text = commuteLine(state);

  if (variant === "mobile") {
    return (
      <div
        className="me-row"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen()}
        style={{ cursor: "pointer" }}
      >
        <div className="me-row-left">
          <div className="me-row-icon" style={{ color: "#0284C7" }}>
            <svg viewBox="0 0 24 24" style={{ fill: "none", stroke: "currentColor" }}>
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="7.5" cy="19.5" r="1.5" />
              <circle cx="16.5" cy="19.5" r="1.5" />
            </svg>
          </div>
          <div>
            <div className="me-row-title">通勤习惯</div>
            <div className="me-row-desc">{text}</div>
          </div>
        </div>
        <div className="me-row-right">
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "var(--text-dim)", strokeWidth: 2, fill: "none" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
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
        <div style={{ fontSize: 16, fontWeight: 800 }}>通勤习惯</div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{text}</div>
      </div>
      <button type="button" className="g-btn g-btn-primary" onClick={onOpen}>
        维护通勤档案 ›
      </button>
    </div>
  );
}

/* ────────────────── 详情页 ────────────────── */

export interface CommuteDetailPageProps {
  variant?: "desktop" | "mobile";
  editor: CommuteEditor;
  /** 家庭成员：通勤习惯第二步要选这条习惯是谁的 */
  members?: Array<{ uid: string; name: string }>;
}

/** 通勤档案整页：返回头 + 公司地点 + 多条通勤习惯 + 班车倒推与告警。 */
export function CommuteDetailPage({ variant = "desktop", editor, members = [] }: CommuteDetailPageProps) {
  const { page } = editor;

  if (page && page.kind === "office") {
    return (
      <CommuteOfficePage
        office={page.office}
        isNew={page.isNew}
        variant={variant}
        onSubmit={editor.submitOffice}
        onBack={editor.close}
        onRemove={() => void editor.removeOffice(page.office)}
      />
    );
  }

  if (page && page.kind === "habit") {
    return (
      <CommuteHabitPage
        habit={page.habit}
        offices={editor.state.offices}
        members={members}
        isNew={page.isNew}
        variant={variant}
        onSubmit={editor.submitHabit}
        onBack={editor.close}
        onRemove={() => void editor.removeHabit(page.habit)}
      />
    );
  }

  if (page && page.kind === "shuttle") {
    return (
      <ShuttleLinePage
        key={page.code ?? "new"}
        variant={variant}
        code={page.code}
        offices={editor.state.offices.map((office) => ({ uid: office.uid, name: office.name }))}
        officeUid={page.officeUid}
        onBack={editor.close}
        onSaved={(code, officeUid) => void editor.submitShuttle(code, officeUid)}
      />
    );
  }

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
              通勤习惯
            </h1>
          </div>
          <div className="m-nav-actions">
            <button type="button" className="m-nav-circle-btn" onClick={() => editor.startAddHabit("shuttle")} title="添加班车通勤">
              ＋
            </button>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" className="g-btn" onClick={editor.closeDetail} style={{ padding: "6px 12px", fontSize: 13, flexShrink: 0 }}>
            ‹ 返回「我的」
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>通勤习惯</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              先录公司地点和到岗时刻，再把班车、地铁、自驾各记一条；同一处公司可以有多条习惯互为备选，数据存服务器。起点（家）等选房时按所选小区定，这里存的是模板。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" className="g-btn" style={{ whiteSpace: "nowrap" }} onClick={editor.startAddOffice}>
              ＋ 公司地点
            </button>
            <button type="button" className="g-btn g-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => editor.startAddHabit("shuttle")}>
              ＋ 通勤习惯
            </button>
          </div>
        </div>
      )}

      <CommuteSection variant={variant} editor={editor} hideHeader={variant === "desktop"} />
    </>
  );
}

/* ────────────────── 主体 ────────────────── */

export interface CommuteSectionProps {
  variant?: "desktop" | "mobile";
  editor: CommuteEditor;
  hideHeader?: boolean;
}

export function CommuteSection({ variant = "desktop", editor, hideHeader = false }: CommuteSectionProps) {
  const { state } = editor;
  const overview = commuteOverview(state);

  if (variant === "mobile") {
    return (
      <>
        <PhaseHint phase={state.phase} error={state.error} where="我的 → 数据与服务器" />

        <div className="m-card glass">
          <div className="lb">每周通勤（往返）</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="n" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
              {weeklyText(overview.weeklyMinutes)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            {overview.views.length} 种走法 · 公司 {state.offices.length} 处
            {overview.weeklyMinutes > 0 ? "" : " · 时长挂小区后才有"}
            {overview.earliestDepart ? " · 最早 " + overview.earliestDepart + " 出门" : ""}
            {overview.latestReturn ? " · 末班返程 " + overview.latestReturn : ""}
          </div>
          {overview.shuttleCount > 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              班车 {overview.shuttleCount} 条{overview.shuttleOnly ? " · 没有备选，注意停运" : " · 有备选"}
            </div>
          ) : null}
        </div>

        <WarningList warnings={overview.warnings} />

        <div className="m-card glass" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div className="lb">公司地点</div>
            <button
              type="button"
              className="g-btn"
              style={{ padding: "6px 14px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={editor.startAddOffice}
            >
              ＋ 新增
            </button>
          </div>
          <OfficeList variant="mobile" state={state} onEdit={editor.startEditOffice} onRemove={editor.removeOffice} />
        </div>

        <div className="m-card glass" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div className="lb">通勤习惯</div>
            <button
              type="button"
              className="g-btn"
              style={{ padding: "6px 14px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => editor.startAddHabit("shuttle")}
            >
              ＋ 新增
            </button>
          </div>
          <HabitList variant="mobile" state={state} onEdit={editor.startEditHabit} onRemove={editor.removeHabit} />
        </div>

        <ShuttleBoard
          variant="mobile"
          offices={state.offices.map((office) => ({ uid: office.uid, name: office.name }))}
          bindings={state.shuttles}
          onEdit={editor.startEditShuttle}
          onAdd={editor.startAddShuttle}
        />
      </>
    );
  }

  return (
    <>
      {hideHeader ? null : (
        <div
          className="glass"
          style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>通勤习惯</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              一种走法一条习惯：班车记线路与发车，地铁记时长，自驾记路况；主用方案全局只有一条。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="g-btn" onClick={editor.startAddOffice}>
              ＋ 公司地点
            </button>
            <button type="button" className="g-btn g-btn-primary" onClick={() => editor.startAddHabit("shuttle")}>
              ＋ 通勤习惯
            </button>
          </div>
        </div>
      )}

      <PhaseHint phase={state.phase} error={state.error} where="右上角「账号 → 服务器地址」" />

      <div className="board-split">
        <div className="glass" style={{ padding: "16px 18px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="lb">每周通勤（往返）</div>
          <div className="n" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
            {weeklyText(overview.weeklyMinutes)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {overview.views.length} 种走法 · 公司 {state.offices.length} 处
            {overview.weeklyMinutes > 0 ? "" : " · 时长挂小区后才有"}
            {overview.earliestDepart ? " · 最早 " + overview.earliestDepart + " 出门" : ""}
            {overview.latestReturn ? " · 末班返程 " + overview.latestReturn : ""}
          </div>
        </div>

        <div className="glass" style={{ padding: "16px 18px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="lb">主用方案</div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
            {overview.primary ? COMMUTE_VEHICLE_LABEL[overview.primary.habit.vehicle] : "还没录"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {overview.primary
              ? oneWayText(overview.primary.habit.minutes) +
                (overview.primary.office ? " · " + (overview.primary.office.name || "公司") : "") +
                (overview.primary.slackMin !== null
                  ? overview.primary.slackMin >= 0
                    ? " · 到岗早 " + overview.primary.slackMin + " 分"
                    : " · 迟到 " + Math.abs(overview.primary.slackMin) + " 分"
                  : "")
              : "点右上「＋ 通勤习惯」开始录"}
          </div>
        </div>
      </div>

      <WarningList warnings={overview.warnings} />

      <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>公司地点</div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>到岗时刻用于判断每种习惯会不会迟到</div>
        </div>
        <OfficeList state={state} onEdit={editor.startEditOffice} onRemove={editor.removeOffice} />
      </div>

      <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>通勤习惯</div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>班车、地铁、自驾各记一条，互相兜底</div>
        </div>
        <HabitList state={state} onEdit={editor.startEditHabit} onRemove={editor.removeHabit} />
      </div>

      <ShuttleBoard
        offices={state.offices.map((office) => ({ uid: office.uid, name: office.name }))}
        bindings={state.shuttles}
        onEdit={editor.startEditShuttle}
        onAdd={editor.startAddShuttle}
      />
    </>
  );
}

function PhaseHint({ phase, error, where }: { phase: string; error?: string | null; where: string }) {
  if (phase === "ready") return null;
  const text =
    phase === "unpaired"
      ? "还没有连服务器：去「" + where + "」填地址和配对码。公司地点与通勤习惯都存在服务器上，两台设备共用一份。"
      : phase === "loading"
        ? "正在从服务器读取通勤档案…"
        : "服务器读取失败：" + (error ?? "未知错误") + "（去「" + where + "」重试）";
  return (
    <div className="glass" style={{ padding: "14px 18px", borderRadius: 16, fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
      {text}
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div
      className="glass"
      style={{ padding: "14px 18px", borderRadius: 16, fontSize: 12.5, color: "var(--text-sub)", lineHeight: 1.7 }}
    >
      <div className="lb" style={{ marginBottom: 4 }}>
        提醒
      </div>
      {warnings.map((warning) => (
        <div key={warning}>· {warning}</div>
      ))}
    </div>
  );
}

function OfficeList({
  state,
  onEdit,
  onRemove,
  variant = "desktop",
}: {
  state: CommuteSnapshot;
  onEdit: (office: OfficeLocation) => void;
  onRemove: (office: OfficeLocation) => void;
  /** 手机端没有「编辑」按钮：整行点击直接进入编辑页 */
  variant?: "desktop" | "mobile";
}) {
  if (!state.offices.length) {
    return <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>还没录公司地点：点上面的「公司地点」进入录入，填公司和到岗时刻。</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {state.offices.map((office) => {
        const linked = state.habits.filter((habit) => habit.officeUid === office.uid).length;
        const card = (
          <div
            className="card-inset"
            role={variant === "mobile" ? "button" : undefined}
            tabIndex={variant === "mobile" ? 0 : undefined}
            onClick={variant === "mobile" ? () => onEdit(office) : undefined}
            onKeyDown={
              variant === "mobile"
                ? (event) => (event.key === "Enter" || event.key === " ") && onEdit(office)
                : undefined
            }
            style={{
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              cursor: variant === "mobile" ? "pointer" : undefined,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{office.name || "未命名公司"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>
                到岗 {office.beIn} · 每周 {office.daysPerWeek} 天
                {linked ? " · " + linked + " 条习惯" : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
                {office.address || office.poiName || "—"}
                {isOfficeGeocoded(office) ? <span style={{ color: "var(--accent-cyan)" }}>{" · 高德 " + formatCoord(office)}</span> : null}
              </div>
              {office.note ? <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>{office.note}</div> : null}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {variant === "mobile" ? (
                <RowChevron />
              ) : (
                <>
                  <button type="button" className="g-btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onEdit(office)}>
                    编辑
                  </button>
                  <button type="button" className="g-btn g-btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onRemove(office)}>
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        );
        return <Fragment key={office.uid}>{card}</Fragment>;
      })}
    </div>
  );
}

function HabitList({
  state,
  onEdit,
  onRemove,
  variant = "desktop",
}: {
  state: CommuteSnapshot;
  onEdit: (habit: CommuteHabit) => void;
  onRemove: (habit: CommuteHabit) => void;
  /** 手机端没有「编辑」按钮：整行点击直接进入编辑页 */
  variant?: "desktop" | "mobile";
}) {
  const overview = commuteOverview(state);
  if (!overview.views.length) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
        还没录通勤习惯：点上面的「通勤习惯」进入录入，班车填线路和发车时刻，地铁填单程时长。
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {overview.views.map((view) => {
        const habit = view.habit;
        const title = habit.label || COMMUTE_VEHICLE_LABEL[habit.vehicle];
        const shuttle = habit.vehicle === "shuttle" ? habit.shuttle : null;
        const card = (
          <div
            className="card-inset"
            role={variant === "mobile" ? "button" : undefined}
            tabIndex={variant === "mobile" ? 0 : undefined}
            onClick={variant === "mobile" ? () => onEdit(habit) : undefined}
            onKeyDown={
              variant === "mobile"
                ? (event) => (event.key === "Enter" || event.key === " ") && onEdit(habit)
                : undefined
            }
            style={{
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              cursor: variant === "mobile" ? "pointer" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
                {habit.primary ? (
                  <span className="me-setting-pill" style={{ fontSize: 11 }}>
                    主用
                  </span>
                ) : null}
                <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                  {COMMUTE_VEHICLE_LABEL[habit.vehicle]} · 每周 {habit.daysPerWeek} 天
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                {variant === "mobile" ? (
                  <RowChevron />
                ) : (
                  <>
                    <button type="button" className="g-btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onEdit(habit)}>
                      编辑
                    </button>
                    <button type="button" className="g-btn g-btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onRemove(habit)}>
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>

            {accessSummary(habit) ? (
              <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{accessSummary(habit)}</div>
            ) : null}

            <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
              {oneWayText(habit.minutes)}
              {habit.departHome ? " · " + habit.departHome + " 出门" : ""}
              {(habit.arriveWork || view.computedArrive) ? " · " + (habit.arriveWork || view.computedArrive) + " 到岗" : ""}
              {view.office && view.office.name ? " · " + view.office.name : ""}
            </div>

            {shuttle ? (
              <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                班车 {shuttle.line || "未填线路"}
                {shuttle.stop ? " · " + shuttle.stop + " 上车" : ""}
                {shuttle.depart ? " · " + shuttle.depart + " 发车" : ""}
                {shuttle.arrive ? " · " + shuttle.arrive + " 到公司" : ""}
                {shuttle.lastReturn ? " · 末班 " + shuttle.lastReturn : ""}
                {" · " + SHUTTLE_SEAT_LABEL[shuttle.seat]}
                {shuttle.toGate ? " · 到门口" : " · 还要走一段"}
              </div>
            ) : null}

            {habit.note ? <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{habit.note}</div> : null}

            {view.warnings.length > 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--text-sub)", lineHeight: 1.6 }}>
                {view.warnings.map((warning) => (
                  <div key={warning}>· {warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        );
        return <Fragment key={habit.uid}>{card}</Fragment>;
      })}
    </div>
  );
}

/** 单程时长要挂到具体小区才算得出来：0 不是「零分钟通勤」，是还没算。 */
function oneWayText(minutes: number): string {
  return minutes > 0 ? formatDuration(minutes) + " 单程" : "单程时长待挂小区";
}

/** 每周通勤按时长累加，没时长就别显示 0 分钟（大号数字位放「—」，说明写在小字里）。 */
function weeklyText(minutes: number): string {
  return minutes > 0 ? formatDuration(minutes) : "—";
}

/** 接驳腿摘要：公共交通两头、班车到家门口的上车点，其余走法没有接驳。 */
function accessSummary(habit: CommuteHabit): string {
  const home = COMMUTE_ACCESS_LABEL[habit.accessHome];
  if (habit.vehicle === "shuttle") return "家 → 上车站点：" + home;
  if (habit.vehicle === "transit") return "家 → 站：" + home + " · 出站 → 公司：" + COMMUTE_ACCESS_LABEL[habit.accessWork];
  return "";
}
