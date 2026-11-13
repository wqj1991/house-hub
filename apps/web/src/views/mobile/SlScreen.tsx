import { useDatasetCtx } from "@/lib/dataset";
import { VERDICT_LABEL, verdictOf, wan } from "@/lib/demo";
import type { Row } from "@/lib/demo";

const BORDER: Record<string, string> = {
  ok: "4px solid var(--accent-cyan)",
  warn: "4px solid var(--accent-amber)",
  bad: "4px solid var(--accent-coral)",
  unknown: "4px solid rgba(120,120,120,0.4)",
};

const PILL: Record<string, string> = {
  ok: "rgba(2,132,199,0.2)",
  warn: "rgba(217,119,6,0.2)",
  bad: "rgba(220,38,38,0.2)",
  unknown: "rgba(120,120,120,0.2)",
};

function commuteText(row: Row): string {
  const a = row.commuteA == null ? "待录" : row.commuteA + "′ " + row.modeA;
  const b = row.commuteB == null ? "待录" : row.commuteB + "′ " + row.modeB;
  return "老公 " + a + " · 老婆 " + b;
}

/** 待选池：数据来自 HouseRepo（库空时回落示例口径，顶部有来源胶囊提示）。 */
export function SlScreen() {
  const { shortRows, rows, demo, loading, add, remove } = useDatasetCtx();
  const empty = !loading && shortRows.length === 0;

  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">待选池</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="批量导出">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
        </div>
      </div>

      <div className="m-card glass">
        <div className="lb">待选池状态</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>留一 · 看一 · 弃一</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          {loading ? "读取中…" : "候选 " + rows.length + " 个 · 已选 " + shortRows.length + " 个"}
          {demo && !loading ? "（示例口径）" : ""}
        </div>
      </div>

      {empty ? (
        <div className="m-card glass">
          <div style={{ fontSize: 14, fontWeight: 700 }}>还没有待选的房子</div>
          <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 6 }}>
            从候选里挑一个进来，后续对比与算钱都以这张清单为准。
          </p>
          <button
            type="button"
            className="m-nav-circle-btn"
            style={{ width: "auto", padding: "8px 14px", marginTop: 10, fontSize: 13 }}
            onClick={() => rows[0] && add(rows[0])}
          >
            加入候选第一条
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shortRows.map((row) => {
          const verdict = verdictOf(row);
          const price = wan(row.tx ?? row.listed, row.area);
          return (
            <div
              key={row.key}
              className="m-card glass"
              style={{ borderLeft: BORDER[verdict], opacity: verdict === "bad" ? 0.65 : 1 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{row.name}</div>
                <span className="tag-pill" style={{ background: PILL[verdict], color: "var(--accent-cyan)" }}>
                  {VERDICT_LABEL[verdict]}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>
                {row.district} · {row.bizcircle ?? "—"} · {price == null ? "总价待补" : price + " 万"}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{commuteText(row)}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="m-nav-circle-btn"
                  style={{ width: "auto", padding: "4px 12px", fontSize: 12 }}
                  aria-label={"从待选池移除 " + row.name}
                  onClick={() => remove(row)}
                >
                  移除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
