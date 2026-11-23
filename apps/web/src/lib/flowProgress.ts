import { useSyncExternalStore } from "react";

/**
 * 购房流程的打钩进度：步骤勾选项 + 「夫妻双方上产证」模式。
 * 只存本机（localStorage），不进服务器：这是个人办理清单，不是共享数据。
 */

export interface FlowProgress {
  /** 已勾选的 check id → true；未勾选的不存，体积最小 */
  checks: Record<string, true>;
  /** 夫妻双方共同署名模式：打开后显示 coupleOnly 的勾选项与决策卡片 */
  couple: boolean;
  /** 开头的 8 个决策：decision id → 选中的 option id（见 purchaseFlow 的 DECISIONS） */
  decisions: Record<string, string>;
}

const KEY = "house-hub:purchase-flow";
const listeners = new Set<() => void>();

function read(): FlowProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { checks: {}, couple: false, decisions: {} };
    const parsed = JSON.parse(raw) as { checks?: Record<string, unknown>; couple?: unknown; decisions?: Record<string, unknown> };
    const checks: Record<string, true> = {};
    if (parsed.checks && typeof parsed.checks === "object") {
      for (const [id, value] of Object.entries(parsed.checks)) {
        if (value === true) checks[id] = true;
      }
    }
    const decisions: Record<string, string> = {};
    if (parsed.decisions && typeof parsed.decisions === "object") {
      for (const [id, value] of Object.entries(parsed.decisions)) {
        if (typeof value === "string") decisions[id] = value;
      }
    }
    return { checks, couple: parsed.couple === true, decisions };
  } catch {
    /* 隐私模式 / 脏数据：退回空进度 */
    return { checks: {}, couple: false, decisions: {} };
  }
}

let current: FlowProgress = read();

function commit(next: FlowProgress): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式下忽略 */
  }
  listeners.forEach((notify) => notify());
}

export function toggleCheck(id: string): void {
  const checks = { ...current.checks };
  if (checks[id]) delete checks[id];
  else checks[id] = true;
  commit({ ...current, checks });
}

export function setCoupleMode(couple: boolean): void {
  if (couple === current.couple) return;
  commit({ ...current, couple });
}

/**
 * 记一个开头决策。选到「夫妻双方都上产证」时自动打开 couple 模式，
 * 免得用户在两处分别设一遍；反过来选「只写一人」时自动关掉。
 */
export function setDecision(decisionId: string, optionId: string): void {
  const decisions = { ...current.decisions };
  if (decisions[decisionId] === optionId) delete decisions[decisionId];
  else decisions[decisionId] = optionId;
  const couple =
    decisionId === "title_mode" && decisions[decisionId]
      ? decisions[decisionId] === "couple"
      : current.couple;
  commit({ ...current, decisions, couple });
}

/** 清空开头的全部决策（不影响打钩与夫妻模式）。 */
export function resetDecisions(): void {
  if (Object.keys(current.decisions).length === 0) return;
  commit({ ...current, decisions: {} });
}

/** 清空打钩，但保留「夫妻双方」模式与开头决策——模式是身份设定，不是进度。 */
export function resetChecks(): void {
  if (Object.keys(current.checks).length === 0) return;
  commit({ checks: {}, couple: current.couple, decisions: current.decisions });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function snapshot(): FlowProgress {
  return current;
}

/** 桌面端与移动端共享同一份进度：任一端打钩，另一端立刻同步。 */
export function useFlowProgress(): FlowProgress {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
