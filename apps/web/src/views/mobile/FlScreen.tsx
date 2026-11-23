import { FlowMobile } from "@/views/shared/FlowDoc";

/** 移动端购房流程：与桌面端同一份正文与同一份打钩进度。 */
export function FlScreen() {
  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">流程 · 8 步手册</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="勾选进度只存本机">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
        </div>
      </div>
      <FlowMobile />
    </>
  );
}
