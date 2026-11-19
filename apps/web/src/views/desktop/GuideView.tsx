import { GUIDE_TABS, useGuideMode } from "@/lib/guideMode";
import { ModeSwitch } from "@/components/ModeSwitch";
import { GuideDocDesktop } from "@/views/shared/GuideDoc";

/** 买房指南：新房 / 二手房两套并列文档，默认新房，切换结果跨端持久化。 */
export function GuideView() {
  const [mode, setMode] = useGuideMode();
  return (
    <>
      <ModeSwitch value={mode} onChange={setMode} tabs={GUIDE_TABS} ariaLabel="指南类别" />
      <GuideDocDesktop mode={mode} />
    </>
  );
}
