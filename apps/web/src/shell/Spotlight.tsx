import { useEffect } from "react";
import { SpotlightModal } from "./SpotlightModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onJump: (target: string) => void;
}

/** 跨端检索中枢：输入实时过滤 + 分类胶囊 + 结果穿透直达（鼠标与键盘同权）。 */
export function Spotlight({ open, onClose, onJump }: Props) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const input = document.getElementById("spotlightInput") as HTMLInputElement | null;
    const chips = Array.from(document.querySelectorAll<HTMLElement>(".spotlight-chip"));
    const items = Array.from(document.querySelectorAll<HTMLElement>(".spotlight-item"));
    const cancel = document.getElementById("spotlightCancel");
    let filter = "all";

    // 可点的胶囊与结果都要能被 Tab 到、被 Enter 触发
    const activatable = [...chips, ...items];
    activatable.forEach((node) => {
      node.tabIndex = 0;
      node.setAttribute("role", "button");
    });

    const apply = () => {
      const q = (input?.value ?? "").trim().toLowerCase();
      items.forEach((item) => {
        const okType = filter === "all" || item.dataset.type === filter;
        const okText = !q || (item.textContent ?? "").toLowerCase().includes(q);
        item.style.display = okType && okText ? "flex" : "none";
      });
    };
    const onInput = () => apply();
    const onCancel = () => onClose();

    const activate = (item: HTMLElement) => {
      const jump = item.dataset.jump;
      if (!jump) return;
      onJump(jump);
      onClose();
    };
    const onEnter = (handler: () => void) => (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler();
      }
    };

    const chipHandlers = chips.map((chip) => {
      const pick = () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filter = chip.dataset.filter ?? "all";
        apply();
      };
      const key = onEnter(pick);
      chip.addEventListener("click", pick);
      chip.addEventListener("keydown", key);
      return () => {
        chip.removeEventListener("click", pick);
        chip.removeEventListener("keydown", key);
      };
    });
    const itemHandlers = items.map((item) => {
      const hit = () => activate(item);
      const key = onEnter(hit);
      item.addEventListener("click", hit);
      item.addEventListener("keydown", key);
      return () => {
        item.removeEventListener("click", hit);
        item.removeEventListener("keydown", key);
      };
    });

    input?.addEventListener("input", onInput);
    cancel?.addEventListener("click", onCancel);
    if (input) {
      input.value = "";
      window.setTimeout(() => input.focus(), 60);
    }
    apply();

    return () => {
      input?.removeEventListener("input", onInput);
      cancel?.removeEventListener("click", onCancel);
      chipHandlers.forEach((off) => off());
      itemHandlers.forEach((off) => off());
      previous?.focus?.();
    };
  }, [open, onClose, onJump]);

  return <SpotlightModal open={open} />;
}
