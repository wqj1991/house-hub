/**
 * 两级视图切换（新房 / 二手房）：选房与买房指南共用。
 * 等宽分段 + 滑动滑块；每段可带一行灰色小注（hint）或一个状态徽标（badge）。
 */
import type { KeyboardEvent } from "react";

export type ModeTab<T extends string> = {
  value: T;
  label: string;
  /** 标签后面跟的一行灰色小注，例如「现房 · 产权与议价」 */
  hint?: string;
  /** 标签后面跟的小徽标，例如「待接入」 */
  badge?: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  /** 固定两段：滑块宽度按 50% 算 */
  tabs: readonly [ModeTab<T>, ModeTab<T>];
  ariaLabel: string;
  /** 滑块右侧的一行口径说明，窄屏自动隐藏 */
  note?: string;
  mobile?: boolean;
};

export function ModeSwitch<T extends string>({ value, onChange, tabs, ariaLabel, note, mobile = false }: Props<T>) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tabs[index === 0 ? 1 : 0];
    onChange(next.value);
    event.currentTarget.querySelector<HTMLButtonElement>('[data-tab="' + next.value + '"]')?.focus();
  };

  return (
    <div className={"mode-switchbar" + (mobile ? " is-mobile" : "")}>
      <div className="mode-switch" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        <span
          className="mode-switch-thumb"
          aria-hidden="true"
          style={{ transform: "translateX(" + index * 100 + "%" }}
        />
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              data-tab={tab.value}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={"mode-switch-tab" + (active ? " is-active" : "")}
              onClick={() => onChange(tab.value)}
            >
              <span className="mode-switch-lb">{tab.label}</span>
              {tab.hint ? <span className="mode-switch-hint">{tab.hint}</span> : null}
              {tab.badge ? <span className="mode-switch-badge">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {note ? <span className="mode-switch-note">{note}</span> : null}
    </div>
  );
}
