import { useEffect, useRef, useState } from "react";

export type GlassSelectOption = { value: string; label: string };

type GlassMultiSelectProps = {
  /** 已选中的值（可为空数组） */
  values: string[];
  options: GlassSelectOption[];
  /** 点一项切一次：选中↔取消，菜单保持展开 */
  onToggle: (value: string) => void;
  /** 清空全部 */
  onClear: () => void;
  /** 触发器文案，由调用方按已选内容算好（占位 / 名字 / "N 个商圈"） */
  label: string;
  /** 列表首项文案，点它等于清空 */
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * 多选版下拉：同一套 .custom-select 结构，多选态用 .dropdown-check 打勾，
 * 点选不关菜单（商圈经常要连选两三个），点空白处或 Esc 才收起。
 */
export function GlassMultiSelect({
  values,
  options,
  onToggle,
  onClear,
  label,
  allLabel = "全部",
  ariaLabel,
  className,
}: GlassMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

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

  const isOn = (value: string) => values.includes(value);

  return (
    <div
      ref={hostRef}
      className={"custom-select" + (open ? " is-open" : "") + (values.length ? " has-value" : "") + (className ? " " + className : "")}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="custom-select-trigger"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
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
        <span className="selected-text">{label}</span>
        {values.length ? <span className="custom-select-count">{values.length}</span> : null}
        <span className="custom-select-arrow">▼</span>
      </div>
      <div className="glass-dropdown-menu" role="listbox" aria-multiselectable="true" aria-label={ariaLabel}>
        <div
          role="option"
          aria-selected={values.length === 0}
          className={"dropdown-item" + (values.length === 0 ? " is-selected" : "")}
          onClick={onClear}
        >
          <span>{allLabel}</span>
          <span className="dropdown-check">✓</span>
        </div>
        {options.map((option) => (
          <div
            key={"multi-" + option.value}
            role="option"
            aria-selected={isOn(option.value)}
            className={"dropdown-item" + (isOn(option.value) ? " is-selected" : "")}
            onClick={() => onToggle(option.value)}
          >
            <span>{option.label}</span>
            <span className="dropdown-check">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type GlassSelectProps = {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * 液态玻璃下拉，严格复用「组件库规范 · 常用输入控件」的 .custom-select 结构
 * （glass.css:1255-1321、移动端 640px 以下自动升为底部 sheet）。
 * 交互由 React 状态驱动：根节点吃掉点击事件，避免 glassWidgets 的 document 委托重复接管。
 */
export function GlassSelect({ value, options, onChange, placeholder = "请选择", ariaLabel, className }: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

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

  return (
    <div
      ref={hostRef}
      className={"custom-select" + (open ? " is-open" : "") + (className ? " " + className : "")}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="custom-select-trigger"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
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
        <span className="selected-text">{current ? current.label : placeholder}</span>
        <span className="custom-select-arrow">▼</span>
      </div>
      <div className="glass-dropdown-menu" role="listbox" aria-label={ariaLabel}>
        {options.map((option) => (
          <div
            key={"opt-" + option.value}
            role="option"
            aria-selected={option.value === value}
            className={"dropdown-item" + (option.value === value ? " is-selected" : "")}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <span>{option.label}</span>
            <span className="dropdown-check">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}
