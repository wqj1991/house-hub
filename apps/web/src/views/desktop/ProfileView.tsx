import { RELATION_LABEL } from "@house/core";
import { CommuteDetailPage, CommuteSummaryRow, useCommuteEditor } from "@/views/shared/CommuteSection";
import { IncomeMemberPage } from "@/views/shared/IncomeMemberPage";
import { IncomeDetailPage, IncomeSummaryRow, useIncomeEditor } from "@/views/shared/IncomeSection";
import { AccountEntry, AccountIdentity } from "@/views/shared/AccountPanel";
import { FlowSettingsCard } from "@/views/shared/FlowSettingsCard";
import { ToneBackdropSetting } from "@/views/shared/ToneBackdropSetting";

const THEMES = [
  {
    key: "dawn",
    name: "晨曦暖白 (Dawn)",
    desc: "浅色柔光 · 清透折射 (默认)",
    dots: ["#EEF3F8", "#FFAE9E", "#0284C7"],
  },
  {
    key: "glacier",
    name: "极光冰川 (Glacier)",
    desc: "冷青蓝绿 · 深邃极光",
    dots: ["#030B12", "#12B5A0", "#227AB5"],
  },
  {
    key: "twilight",
    name: "暮色暗紫 (Twilight)",
    desc: "深空紫蓝 · 霓虹暗色",
    dots: ["#080410", "#8338EC", "#3A86FF"],
  },
  {
    key: "obsidian",
    name: "黑曜纯深 (Obsidian)",
    desc: "石墨碳黑 · 纯粹克制",
    dots: ["#050608", "#3D4A62", "#E2E8F0"],
  },
];

/** 我的：主题 → 服务器 → 通勤档案 → 收入概况；点概况进完整页面，录入再进子页面。 */
export function ProfileView() {
  const income = useIncomeEditor();
  const commute = useCommuteEditor();

  if (income.page) {
    return (
      <IncomeMemberPage
        member={income.page.member}
        isNew={income.page.isNew}
        onSubmit={income.submit}
        onBack={income.close}
        onRemove={() => void income.remove(income.page!.member)}
      />
    );
  }

  if (income.open) {
    return <IncomeDetailPage variant="desktop" editor={income} />;
  }

  // 通勤档案子页面（公司地点 / 通勤习惯）也由详情页整页接管
  if (commute.open || commute.page) {
    return (
      <CommuteDetailPage
        variant="desktop"
        editor={commute}
        members={income.state.members.map((member) => ({ uid: member.uid, name: member.name || RELATION_LABEL[member.relation] }))}
      />
    );
  }

  return (
    <>
      <div className="glass" style={{ padding: '18px 22px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <AccountIdentity variant="desktop" />
        <AccountEntry variant="desktop" />
      </div>

      <FlowSettingsCard mobile={false} />

      <div className="glass" style={{ padding: '18px 22px', borderRadius: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>视觉主题底膜 (点击即时生效)</div>
        <div className="theme-selector-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {THEMES.map((theme) => (
            <div key={theme.key} className="theme-card" data-tone-pick={theme.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="theme-info">
                  <strong>{theme.name}</strong>
                  <span>{theme.desc}</span>
                </div>
                <div className="theme-preview-dots">
                  {theme.dots.map((dot) => (
                    <div key={dot} className="theme-dot" style={{ background: dot }}></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <ToneBackdropSetting variant="desktop" />
      </div>

      <CommuteSummaryRow variant="desktop" state={commute.state} onOpen={commute.openDetail} />

      <IncomeSummaryRow variant="desktop" state={income.state} onOpen={income.openDetail} />
    </>
  );
}