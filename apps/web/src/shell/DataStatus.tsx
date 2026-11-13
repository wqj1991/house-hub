import { useDatasetCtx } from "@/lib/dataset";

type State = "loading" | "error" | "demo" | "live";

/** 数据来源胶囊：让「示例口径」不再冒充真实数据，点一下即可重读。 */
export function DataStatus({ compact = false }: { compact?: boolean }) {
  const { loading, error, demo, rows, refresh } = useDatasetCtx();
  const state: State = loading ? "loading" : error ? "error" : demo ? "demo" : "live";
  const label =
    state === "loading"
      ? "读取中…"
      : state === "error"
        ? "连接失败 · 示例口径"
        : state === "demo"
          ? "示例口径 · " + rows.length + " 条"
          : "本地库 · " + rows.length + " 条";
  const hint =
    state === "error"
      ? error ?? "API 不可达"
      : state === "demo"
        ? "库里没有小区，当前展示 apps/web/src/lib/demo.ts 的示例口径；点此重读"
        : "点此重读本地库";

  return (
    <button
      type="button"
      className={"data-status is-" + state + (compact ? " is-compact" : "")}
      title={hint}
      aria-label={"数据来源：" + label + "，点击刷新"}
      onClick={refresh}
    >
      <span className="dot" aria-hidden="true" />
      {label}
    </button>
  );
}
