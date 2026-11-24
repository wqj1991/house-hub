import { FlowInfoButtons, FlowMobile } from "@/views/shared/FlowDoc";

/** 移动端购房流程：与桌面端同一份正文与同一份打钩进度；口径 / 政策收进右上角按钮区。 */
export function FlScreen() {
  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">流程 · 9 步手册</h1>
        <div className="m-nav-actions">
          <FlowInfoButtons />
        </div>
      </div>
      <FlowMobile />
    </>
  );
}
