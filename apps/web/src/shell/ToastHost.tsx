import { useEffect, useState } from "react";
import { onToast } from "@/lib/toast";

interface Item {
  id: number;
  title: string;
  desc?: string;
}

let seq = 0;

/** 右下角玻璃化轻提示堆栈（对应 v1 showToast）。 */
export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(
    () =>
      onToast(({ title, desc }) => {
        const id = ++seq;
        setItems((prev) => [{ id, title, desc }, ...prev]);
        window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 3000);
      }),
    [],
  );

  return (
    <div className="toast-stack">
      {items.map((item) => (
        <div className="g-toast" key={item.id}>
          <div className="toast-icon" style={{ background: "rgba(24,192,168,0.25)", color: "var(--cyan)" }}>
            ✨
          </div>
          <div className="toast-content">
            <div className="toast-title">{item.title}</div>
            {item.desc ? <div className="toast-desc">{item.desc}</div> : null}
          </div>
          <button className="toast-close" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
