import { useEffect, useRef, useState } from "react";
import { onToast } from "@/lib/toast";

interface Item {
  id: number;
  title: string;
  desc?: string;
  leaving: boolean;
}

const TTL = 3000;
const FADE = 260;
let seq = 0;

/** 右下角玻璃化轻提示堆栈（对应 v1 showToast）：3s 自动淡出，可手动关闭。 */
export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const track = (id: number): void => {
      timers.current.push(id);
    };

    const dropLater = (id: number): void => {
      track(window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), FADE));
    };

    const leave = (id: number): void => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
      dropLater(id);
    };

    const off = onToast(({ title, desc }) => {
      const id = ++seq;
      setItems((prev) => [{ id, title, desc, leaving: false }, ...prev].slice(0, 4));
      track(window.setTimeout(() => leave(id), TTL));
    });

    return () => {
      off();
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const dismiss = (id: number): void => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    timers.current.push(window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), FADE));
  };

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <div className={"g-toast" + (item.leaving ? " is-out" : "")} key={item.id}>
          <div className="toast-icon" aria-hidden="true">
            ✨
          </div>
          <div className="toast-content">
            <div className="toast-title">{item.title}</div>
            {item.desc ? <div className="toast-desc">{item.desc}</div> : null}
          </div>
          <button type="button" className="toast-close" aria-label="关闭提示" onClick={() => dismiss(item.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
