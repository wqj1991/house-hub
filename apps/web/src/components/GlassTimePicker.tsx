import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * 液态玻璃「时间选择」：严格照组件库规范的标记写
 * （.custom-select > .custom-select-trigger + .glass-dropdown-menu > .time-picker-panel，
 * 时 / 分两列 .time-scroll-col + .time-opt.is-active，底部 .time-quick-pills）。
 * 样式全在 glass.css:1277-1321，桌面与 640px 以下的手机共用同一份。
 *
 * 交互由 React 状态驱动：根节点和菜单都吃掉点击，不让 glassWidgets 的 document 委托
 * 再按 #colHours / #selectedTimeText 那套去改 is-active、写死文案。
 */

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
/** 分钟 5 分钟一档；当前值不在档上（06:52）时补一档，免得选中项高亮不到。 */
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

export interface GlassTimePickerQuickTime {
  /** "HH:mm" */
  time: string;
  /** 药丸上的字，如「08:00 到岗」 */
  text: string;
}

export interface GlassTimePickerProps {
  /** "HH:mm"；空串＝还没定（模板里本来就不知道） */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** 常见时刻：一点就填 */
  quickTimes?: GlassTimePickerQuickTime[];
  /** 面板表头右侧小字：这列时刻拿来干什么 */
  hint?: string;
  /** 允许清空：不知道就先空着 */
  allowClear?: boolean;
  className?: string;
  style?: CSSProperties;
}

function splitClock(value: string): { hour: string; minute: string } | null {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return { hour: String(hour).padStart(2, "0"), minute: String(minute).padStart(2, "0") };
}

/** 时刻输入组件：值一律 "HH:mm"，空串表示「还没定」。 */
export function GlassTimePicker({
  value,
  onChange,
  placeholder = "选择时刻",
  ariaLabel,
  quickTimes,
  hint = "时分选择",
  allowClear = false,
  className,
  style,
}: GlassTimePickerProps) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  const parts = splitClock(value);
  const hour = parts?.hour ?? "08";
  const minute = parts?.minute ?? "00";
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => Number(a) - Number(b));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pickHour = (next: string) => onChange(next + ":" + minute);
  const pickMinute = (next: string) => onChange(hour + ":" + next);
  const hasQuick = Boolean(quickTimes?.length) || allowClear;

  return (
    <div
      ref={hostRef}
      className={"custom-select" + (open ? " is-open" : "") + (parts ? " has-value" : "") + (className ? " " + className : "")}
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="custom-select-trigger"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel ?? placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((prev) => !prev);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14 }}>⏱️</span>
          <span
            className="selected-text"
            style={{ fontFamily: "var(--mono)", fontWeight: 700, color: parts ? undefined : "var(--text-dim)" }}
          >
            {parts ? hour + " : " + minute : placeholder}
          </span>
        </span>
        <span className="custom-select-arrow">▼</span>
      </div>
      {/* stopPropagation：面板由 React 状态驱动，屏蔽 glassWidgets 的桌面级日历 / 时间委托 */}
      <div
        className="glass-dropdown-menu"
        role="listbox"
        aria-label={ariaLabel ?? placeholder}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="time-picker-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-sub)" }}>时分选择 (时 / 分)</span>
            <span style={{ fontSize: 11, color: "var(--cyan)" }}>{hint}</span>
          </div>
          <div className="time-wheel-group">
            <div className="time-col-wrap">
              <div className="time-col-label">时 (HH)</div>
              <div className="time-scroll-col">
                {HOURS.map((h) => (
                  <div
                    key={"hour-" + h}
                    role="option"
                    aria-selected={h === hour}
                    className={"time-opt" + (h === hour ? " is-active" : "")}
                    onClick={() => pickHour(h)}
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
                {minuteOptions.map((m) => (
                  <div
                    key={"min-" + m}
                    role="option"
                    aria-selected={m === minute}
                    className={"time-opt" + (m === minute ? " is-active" : "")}
                    onClick={() => pickMinute(m)}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {hasQuick ? (
            <div className="time-quick-pills">
              {(quickTimes ?? []).map((spec) => (
                <span
                  key={"quick-" + spec.time}
                  className="time-pill"
                  onClick={() => {
                    onChange(spec.time);
                    setOpen(false);
                  }}
                >
                  {spec.text}
                </span>
              ))}
              {allowClear ? (
                <span
                  className="time-pill"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  清空
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
