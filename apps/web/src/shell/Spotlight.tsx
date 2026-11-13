import { useEffect } from "react";
import { SpotlightModal } from "./SpotlightModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onJump: (target: string) => void;
}

/** 跨端检索中枢：输入实时过滤 + 分类胶囊 + 结果穿透直达。 */
export function Spotlight({ open, onClose, onJump }: Props) {
  useEffect(() => {
    if (!open) return;
    const input = document.getElementById("spotlightInput") as HTMLInputElement | null;
    const chips = Array.from(document.querySelectorAll<HTMLElement>(".spotlight-chip"));
    const items = Array.from(document.querySelectorAll<HTMLElement>(".spotlight-item"));
    const cancel = document.getElementById("spotlightCancel");
    let filter = "all";

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
    const chipHandlers = chips.map((chip) => {
      const handler = () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filter = chip.dataset.filter ?? "all";
        apply();
      };
      chip.addEventListener("click", handler);
      return () => chip.removeEventListener("click", handler);
    });
    const itemHandlers = items.map((item) => {
      const handler = () => {
        const jump = item.dataset.jump;
        if (jump) {
          onJump(jump);
          onClose();
        }
      };
      item.addEventListener("click", handler);
      return () => item.removeEventListener("click", handler);
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
    };
  }, [open, onClose, onJump]);

  return <SpotlightModal open={open} />;
}
