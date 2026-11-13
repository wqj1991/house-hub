import type { ReactNode } from "react";
import { Aura } from "./Aura";
import { DataStatus } from "./DataStatus";
import { RailPanel } from "./RailPanel";
import { DESKTOP_NAV, VIEW_TITLE, type DesktopView } from "./nav";

interface Props {
  activeKey: string;
  view: DesktopView;
  onSelect: (key: string) => void;
  children: ReactNode;
}

/** 桌面骨架：左侧导轨 (250px) + 中央决策区 (1fr) + 右侧 Rail (322px)。 */
export function DesktopShell({ activeKey, view, onSelect, children }: Props) {
  return (
    <>
      <Aura />
      <div className="desktop-shell" id="desktopShell">
        <aside className="desktop-sidebar glass">
          <div className="lb" style={{ marginBottom: 4 }}>
            决策功能区
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {DESKTOP_NAV.map((item) => (
              <div
                key={item.key}
                className={"d-nav-item" + (item.key === activeKey ? " is-active" : "")}
                data-dview={item.key}
                role="button"
                tabIndex={0}
                aria-current={item.key === activeKey ? "page" : undefined}
                onClick={() => onSelect(item.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.key);
                  }
                }}
              >
                <span>{item.icon}</span>
                {item.label}
                {item.badge ? <span className="d-nav-badge">{item.badge}</span> : null}
              </div>
            ))}
          </nav>

          <div className="card-inset" style={{ marginTop: "auto", padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-amber)", marginBottom: 4 }}>
              积分前置平坦声明
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-sub)" }}>
              城六区外积分平坦无级差，仅作前置资格核验；排序全权交由通勤与品质硬指标。
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              YG
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>本地 SQLite 工作台</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>数据不上传云端</div>
            </div>
          </div>
        </aside>

        <main className="desktop-main glass">
          <div className="desktop-topbar">
            <div>
              <h1 id="dPageTitle">{VIEW_TITLE[view]}</h1>
              <p>单程硬筛 ≤ 90 min · 80′~90′ 标黄预警 · 双人独立正交轴</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <DataStatus />
              <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--num)" }}>宽屏决策模式</div>
            </div>
          </div>

          <div className="desktop-content">{children}</div>
        </main>

        <RailPanel />
      </div>
    </>
  );
}
