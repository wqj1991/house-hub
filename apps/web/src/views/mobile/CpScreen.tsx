import { useState } from "react";
import { showToast } from "@/lib/toast";
import { SearchIcon } from "@/components/icons";

const HOURS = ["06", "07", "08", "09", "10"];
const MINUTES = ["00", "15", "30", "45", "52"];

const HOUSE_TYPES = [
  "南北通透 · 2室1厅",
  "全南向两居 · 采光优先",
  "全明三居 · 双卫格局",
  "一层带花园 / 顶层复式",
];

interface QuickTime {
  time: string;
  label: string;
  text: string;
}

interface QuickDate {
  iso: string;
  label: string;
  text: string;
}

const QUICK_TIMES: QuickTime[] = [
  { time: "06:52", label: "快专3路班车", text: "06:52 班车发车" },
  { time: "08:00", label: "施耐德到岗", text: "08:00 施耐德到岗" },
  { time: "09:00", label: "环贸到岗", text: "09:00 环贸到岗" },
];

const QUICK_DATES: QuickDate[] = [
  { iso: "2026-11-15", label: "本周六·德茂看房", text: "本周六实地看房" },
  { iso: "2026-12-31", label: "落户积分核算截点", text: "2026-12-31 年限截点" },
];

const DOTS = new Set(["2026-11-15", "2026-12-31"]);

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

interface DayCell {
  key: string;
  day: number;
  iso?: string;
  muted?: boolean;
}

/** 渲染整月网格：前置补上月末、后置补下月头，凑满整周。 */
function buildMonth(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = firstDay; i > 0; i--) {
    cells.push({ key: "prev-" + i, day: prevTotal - i + 1, muted: true });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ key: "day-" + d, day: d, iso: year + "-" + pad(month + 1) + "-" + pad(d) });
  }
  for (let next = 1; cells.length % 7 !== 0; next++) {
    cells.push({ key: "next-" + next, day: next, muted: true });
  }
  return cells;
}

/** 收起底部 sheet：开合由 glassWidgets 的 document 委托控制，这里只做关闭。 */
function closeSheet(id: string): void {
  document.getElementById(id)?.classList.remove("is-open");
}

/**
 * 移动端「组件」屏：按钮微动效 / Toast / 表单控件（底部 sheet）/ 模态 / 加载态。
 * 说明：卡片刻意不使用 backdrop-filter —— 该属性会成为 position:fixed 后代的
 * 包含块，把 640px 以下的底部弹层锁进卡片内部。
 */
export function CpScreen() {
  const [hour, setHour] = useState("08");
  const [minute, setMinute] = useState("00");
  const [timeBadge, setTimeBadge] = useState("08:00 到岗");

  const [view, setView] = useState({ year: 2026, month: 10 });
  const [pickedDate, setPickedDate] = useState("2026-11-15");
  const [dateBadge, setDateBadge] = useState("周六实测");

  const pickTimePart = (part: "hour" | "min", value: string) => {
    const nextHour = part === "hour" ? value : hour;
    const nextMinute = part === "min" ? value : minute;
    setHour(nextHour);
    setMinute(nextMinute);
    setTimeBadge(nextHour + ":" + nextMinute + " 设定时刻");
  };

  const pickQuickTime = (spec: QuickTime) => {
    const [h, m] = spec.time.split(":");
    setHour(h);
    setMinute(m);
    setTimeBadge(spec.time + " " + spec.label);
    closeSheet("mSelectTimePicker");
    showToast("时钟锚点已更新", spec.time + " · " + spec.label);
  };

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      } else if (month > 11) {
        month = 0;
        year += 1;
      }
      return { year, month };
    });
  };

  const pickDate = (iso: string, label?: string) => {
    const parts = iso.split("-");
    setPickedDate(iso);
    setView({ year: Number(parts[0]), month: Number(parts[1]) - 1 });
    setDateBadge(label ?? Number(parts[1]) + "-" + Number(parts[2]) + " 已选");
    closeSheet("mSelectDatePicker");
    showToast("选房日程已更新", label ? iso + " · " + label : iso);
  };

  const cells = buildMonth(view.year, view.month);

  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">组件</h1>
        <div className="m-nav-actions">
          <div
            className="m-nav-circle-btn"
            title="演示通知 Toast"
            onClick={() => showToast("移动端提示", "Toast 贴在胶囊 TabBar 上方浮出")}
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        </div>
      </div>

      {/* 1. 按钮与微动效 */}
      <div className="m-comp-card">
        <div className="sec-title">
          <span>按钮与触控微动效</span>
          <span className="sec-sub">按下内陷 · 微光涟漪</span>
        </div>
        <div className="btn-group">
          <button className="g-btn g-btn-primary" onClick={() => showToast("主操作", "已加入重点决策池")}>
            <span>✨ 确认加入决策</span>
          </button>
          <button className="g-btn" onClick={() => showToast("次要操作", "房源对比数据已刷新")}>
            <span>次要操作</span>
          </button>
          <button className="g-btn g-btn-danger" onClick={() => showToast("一票否决", "该房源已被剔除出池")}>
            <span>一票否决</span>
          </button>
        </div>
        <div className="m-comp-note">
          触屏端无 hover 滞留：按下时 scale(0.96) 弹性内陷并触发微光水波涟漪，抬手立即回到静息态。
        </div>
      </div>

      {/* 2. Toast 说明 */}
      <div className="m-comp-card">
        <div className="sec-title">
          <span>全局通知 Toast</span>
          <span className="sec-sub">底部浮出 · 3s 自动淡出</span>
        </div>
        <div className="m-comp-note">
          点击上方按钮或右上角圆钮，消息条从胶囊 TabBar 上方浮出；点 × 可立即关闭，切换主题底膜时配色跟随。
        </div>
      </div>

      {/* 3. 表单输入组件（下拉 / 时间 / 日期均以底部 sheet 弹出） */}
      <div className="m-comp-card">
        <div className="sec-title">
          <span>表单输入组件</span>
          <span className="sec-sub">玻璃底膜 · 聚焦柔光</span>
        </div>
        <div className="input-stack">
          <div className="input-field">
            <div className="input-label">
              <span>搜索房源或商圈</span>
              <span style={{ fontSize: 11, color: "var(--cyan)" }}>实时过滤</span>
            </div>
            <div className="g-input-wrap">
              <span className="input-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input className="g-input" placeholder="输入小区名（如：望京西园）..." defaultValue="望京西园三区" />
            </div>
          </div>

          <div className="input-field">
            <div className="input-label">
              <span>户型结构要求 (下拉选择)</span>
              <span style={{ fontSize: 11, color: "var(--cyan)" }}>底部弹出</span>
            </div>
            <div className="custom-select" id="mSelectHouseType">
              <div className="custom-select-trigger">
                <span className="selected-text">{HOUSE_TYPES[0]}</span>
                <span className="custom-select-arrow">▼</span>
              </div>
              <div className="glass-dropdown-menu">
                {HOUSE_TYPES.map((type, index) => (
                  <div key={type} className={"dropdown-item" + (index === 0 ? " is-selected" : "")}>
                    <span>{type}</span>
                    <span className="dropdown-check">✓</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="input-field">
            <div className="input-label">
              <span>到岗 / 班车时刻 (时间选择)</span>
              <span data-badge="time" style={{ fontSize: 11, color: "var(--amber)" }}>
                {timeBadge}
              </span>
            </div>
            <div className="custom-select" id="mSelectTimePicker">
              <div className="custom-select-trigger">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⏱️</span>
                  <span className="selected-text" style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
                    {hour} : {minute}
                  </span>
                </div>
                <span className="custom-select-arrow">▼</span>
              </div>
              {/* stopPropagation：面板由 React 状态驱动，屏蔽 glassWidgets 的桌面级日历/时间委托 */}
              <div className="glass-dropdown-menu" onClick={(event) => event.stopPropagation()}>
                <div className="time-picker-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-sub)" }}>时分选择 (时 / 分)</span>
                    <span style={{ fontSize: 11, color: "var(--cyan)" }}>班车时刻倒推</span>
                  </div>
                  <div className="time-wheel-group">
                    <div className="time-col-wrap">
                      <div className="time-col-label">时 (HH)</div>
                      <div className="time-scroll-col">
                        {HOURS.map((h) => (
                          <div
                            key={h}
                            className={"time-opt" + (h === hour ? " is-active" : "")}
                            onClick={() => pickTimePart("hour", h)}
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="time-sep">:</div>
                    <div className="time-col-wrap">
                      <div className="time-col-label">分 (MM)</div>
                      <div className="time-scroll-col">
                        {MINUTES.map((m) => (
                          <div
                            key={m}
                            className={"time-opt" + (m === minute ? " is-active" : "")}
                            onClick={() => pickTimePart("min", m)}
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="time-quick-pills">
                    {QUICK_TIMES.map((spec) => (
                      <span key={spec.time} className="time-pill" onClick={() => pickQuickTime(spec)}>
                        {spec.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="input-field">
            <div className="input-label">
              <span>实地看房 (日期选择)</span>
              <span data-badge="date" style={{ fontSize: 11, color: "var(--cyan)" }}>
                {dateBadge}
              </span>
            </div>
            <div className="custom-select" id="mSelectDatePicker">
              <div className="custom-select-trigger">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <span className="selected-text" style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
                    {pickedDate}
                  </span>
                </div>
                <span className="custom-select-arrow">▼</span>
              </div>
              <div className="glass-dropdown-menu" onClick={(event) => event.stopPropagation()}>
                <div className="date-picker-panel">
                  <div className="date-header">
                    <button className="date-nav-btn" onClick={() => shiftMonth(-1)}>
                      ‹
                    </button>
                    <div className="date-month-title">
                      {view.year} 年 {view.month + 1} 月
                    </div>
                    <button className="date-nav-btn" onClick={() => shiftMonth(1)}>
                      ›
                    </button>
                  </div>
                  <div className="date-weekdays">
                    <span>日</span>
                    <span>一</span>
                    <span>二</span>
                    <span>三</span>
                    <span>四</span>
                    <span>五</span>
                    <span>六</span>
                  </div>
                  <div className="date-grid">
                    {cells.map((cell) => {
                      const cls = ["date-cell"];
                      if (cell.muted) cls.push("is-muted");
                      if (cell.iso && cell.iso === pickedDate) cls.push("is-selected");
                      if (cell.iso && DOTS.has(cell.iso)) cls.push("has-dot");
                      return (
                        <div
                          key={cell.key}
                          className={cls.join(" ")}
                          onClick={cell.iso ? () => pickDate(cell.iso as string) : undefined}
                        >
                          {cell.day}
                        </div>
                      );
                    })}
                  </div>
                  <div className="date-quick-pills">
                    {QUICK_DATES.map((spec) => (
                      <span key={spec.iso} className="date-pill" onClick={() => pickDate(spec.iso, spec.label)}>
                        {spec.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="switch-row">
            <div>
              <div style={{ fontWeight: 600 }}>严格开启一票否决</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>命中临铁临高架等 4 条硬伤房直接隐藏</div>
            </div>
            <div className="g-switch is-on" />
          </div>
        </div>
      </div>

      {/* 4. 模态弹窗预览 */}
      <div className="m-comp-card">
        <div className="sec-title">
          <span>模态弹窗 (Modal)</span>
          <span className="sec-sub">高透玻璃 · 深度虚化</span>
        </div>
        <div className="modal-preview-box">
          <div className="g-modal">
            <div className="modal-head">
              <h4>确认核定此房源成交目标价？</h4>
              <span style={{ fontSize: 11, color: "var(--cyan)" }}>望京西园三区</span>
            </div>
            <div className="modal-body">
              锁定目标价为 <b>392 万元</b>（挂牌砍价空间估算 −18 万），同步重算首付 117.6 万与现金清盘沙盘。
            </div>
            <div className="modal-foot">
              <button className="g-btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => showToast("已取消", "未锁定目标价")}>
                取消
              </button>
              <button
                className="g-btn g-btn-primary"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => showToast("已锁定", "392 万目标价已写入决策池")}
              >
                确认锁定
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 加载态 */}
      <div className="m-comp-card">
        <div className="sec-title">
          <span>加载与骨架屏</span>
          <span className="sec-sub">液态微光 · 呼吸点</span>
        </div>
        <div className="loading-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="g-spinner" />
            <span style={{ fontSize: 12, color: "var(--text-sub)" }}>正在同步周边成交真实底价...</span>
          </div>
          <div className="dots-pulse">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="skeleton-box">
          <div className="skeleton-line" style={{ width: "40%" }} />
          <div className="skeleton-line" style={{ width: "85%" }} />
          <div className="skeleton-line" style={{ width: "65%" }} />
        </div>
      </div>
    </>
  );
}
