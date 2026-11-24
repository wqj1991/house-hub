import { useSyncExternalStore } from "react";

/** 移动端把「你这一单的口径」「政策口径」收进顶部右上角按钮区：点按钮开弹层。 */
export type FlowInfoPanel = "verdict" | "policy" | null;

let current: FlowInfoPanel = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setFlowInfo(panel: FlowInfoPanel) {
  if (current === panel) return;
  current = panel;
  emit();
}

export function toggleFlowInfo(panel: Exclude<FlowInfoPanel, null>) {
  setFlowInfo(current === panel ? null : panel);
}

export function useFlowInfo(): FlowInfoPanel {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => current,
    () => null,
  );
}
