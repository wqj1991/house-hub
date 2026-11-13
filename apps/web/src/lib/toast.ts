export interface ToastPayload {
  title: string;
  desc?: string;
}

const EVENT = "house-hub:toast";

/** 全局轻提示：任意组件（含 DOM 事件回调）都能调用。 */
export function showToast(title: string, desc?: string): void {
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT, { detail: { title, desc } }));
}

export function onToast(handler: (payload: ToastPayload) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<ToastPayload>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
