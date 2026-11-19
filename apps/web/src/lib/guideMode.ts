import { useSyncExternalStore } from "react";
import type { ModeTab } from "@/components/ModeSwitch";

export type GuideMode = "new" | "second";

export const DEFAULT_GUIDE_MODE: GuideMode = "new";

/** 指南页与选房页共用同一套切换控件（@/components/ModeSwitch），标签 + 小注在这里定义一次。 */
export const GUIDE_TABS: readonly [ModeTab<GuideMode>, ModeTab<GuideMode>] = [
  { value: "new", label: "新房", hint: "预售 · 交付确定性" },
  { value: "second", label: "二手房", hint: "现房 · 产权与议价" },
];

const KEY = "house-hub:guide-mode";
const listeners = new Set<() => void>();

function isMode(value: unknown): value is GuideMode {
  return value === "new" || value === "second";
}

function readMode(): GuideMode {
  try {
    const raw = localStorage.getItem(KEY);
    return isMode(raw) ? raw : DEFAULT_GUIDE_MODE;
  } catch {
    return DEFAULT_GUIDE_MODE;
  }
}

let current: GuideMode = readMode();

export function getGuideMode(): GuideMode {
  return current;
}

export function setGuideMode(mode: GuideMode): void {
  if (!isMode(mode) || mode === current) return;
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* 隐私模式下忽略 */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** 桌面端与移动端共享同一份选择：任一端切换，另一端同步，并写入 localStorage。 */
export function useGuideMode(): [GuideMode, (mode: GuideMode) => void] {
  const mode = useSyncExternalStore(subscribe, getGuideMode, getGuideMode);
  return [mode, setGuideMode];
}
