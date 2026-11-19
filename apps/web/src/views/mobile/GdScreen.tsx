import { guideDoc } from "@/lib/guideContent";
import { GUIDE_TABS, useGuideMode } from "@/lib/guideMode";
import { ModeSwitch } from "@/components/ModeSwitch";
import { GuideDocMobile } from "@/views/shared/GuideDoc";

/** 移动端指南：新房 / 二手房切换，与桌面端共享同一份选择。 */
export function GdScreen() {
  const [mode, setMode] = useGuideMode();
  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">指南 · {guideDoc(mode).label}</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="红线说明">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
        </div>
      </div>
      <ModeSwitch value={mode} onChange={setMode} tabs={GUIDE_TABS} ariaLabel="指南类别" mobile />
      <GuideDocMobile mode={mode} />
    </>
  );
}
