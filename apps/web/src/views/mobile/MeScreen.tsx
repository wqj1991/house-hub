import { useEffect } from "react";
import { RELATION_LABEL } from "@house/core";
import { CommuteDetailPage, CommuteSummaryRow, useCommuteEditor } from "@/views/shared/CommuteSection";
import { IncomeMemberPage } from "@/views/shared/IncomeMemberPage";
import { IncomeDetailPage, IncomeSummaryRow, useIncomeEditor } from "@/views/shared/IncomeSection";
import { AccountEntry, AccountIdentity } from "@/views/shared/AccountPanel";
import { ToneBackdropSetting } from "@/views/shared/ToneBackdropSetting";

const THEMES = [
  { key: "dawn", name: "晨曦暖白 (Dawn)", desc: "浅色柔光 · 清透折射 (默认)", dots: ["#EEF3F8", "#FFAE9E", "#0284C7"] },
  { key: "glacier", name: "极光冰川 (Glacier)", desc: "冷青蓝绿 · 深邃极光", dots: ["#030B12", "#12B5A0", "#227AB5"] },
  { key: "twilight", name: "暮色暗紫 (Twilight)", desc: "深空紫蓝 · 霓虹暗色", dots: ["#080410", "#8338EC", "#3A86FF"] },
  { key: "obsidian", name: "黑曜纯深 (Obsidian)", desc: "石墨碳黑 · 纯粹克制", dots: ["#050608", "#3D4A62", "#E2E8F0"] },
];

/** 我的：主题 → 数据与服务器 → 通勤习惯 → 收入与公积金 → 决策口径。录入走整页子页面。 */
export function MeScreen() {
  const income = useIncomeEditor();
  const commute = useCommuteEditor();

  // 进入 / 退出录入子页面时把滚动容器拉回顶部，避免沿用列表的滚动位置
  useEffect(() => {
    document.querySelector<HTMLElement>(".m-viewport")?.scrollTo({ top: 0 });
  }, [income.page, income.open, commute.page, commute.open]);

  if (income.page) {
    return (
      <IncomeMemberPage
        member={income.page.member}
        isNew={income.page.isNew}
        variant="mobile"
        onSubmit={income.submit}
        onBack={income.close}
        onRemove={() => void income.remove(income.page!.member)}
      />
    );
  }

  if (income.open) {
    return <IncomeDetailPage variant="mobile" editor={income} />;
  }

  if (commute.open || commute.page) {
    return (
      <CommuteDetailPage
        variant="mobile"
        editor={commute}
        members={income.state.members.map((member) => ({ uid: member.uid, name: member.name || RELATION_LABEL[member.relation] }))}
      />
    );
  }

  return (
    <>
      <div className="m-nav-header" style={{ paddingBottom: 14 }}>
        <h1 className="m-nav-title">我的</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="AI 智能助手">
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><defs><linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38BDF8" /><stop offset="50%" stopColor="#A855F7" /><stop offset="100%" stopColor="#EC4899" /></linearGradient></defs><circle cx="12" cy="12" r="8" fill="none" stroke="url(#aiGrad)" strokeWidth="2.5" strokeDasharray="3 2" /><circle cx="12" cy="12" r="3" fill="url(#aiGrad)" /><circle cx="6" cy="6" r="1.5" fill="#38BDF8" /><circle cx="18" cy="18" r="1.5" fill="#EC4899" /></svg>
          </div>
          <div className="me-circle-btn" title="扫码对齐">
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'var(--text-main)', strokeWidth: 2 }}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3M16 20h3a1 1 0 0 0 1-1v-3" /><line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" /></svg>
          </div>
        </div>
      </div>
      <div className="me-user-card">
        <AccountIdentity />
        <AccountEntry />
      </div>
      <div className="me-group-card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>视觉主题底膜 (点击即时生效)</div>
        <div className="theme-selector-grid">
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
        <ToneBackdropSetting variant="mobile" />
      </div>
      <div className="me-group-card">
        <CommuteSummaryRow variant="mobile" state={commute.state} onOpen={commute.openDetail} />
      </div>
      <div className="me-group-card">
        <IncomeSummaryRow variant="mobile" state={income.state} onOpen={income.openDetail} />
      </div>
      <div className="me-section-title">决策口径与隐私</div>
      <div className="me-group-card">
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon">
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <div className="me-row-title">通勤时长口径</div>
          </div>
          <div className="me-row-right">
            <div className="me-setting-pill">
              <span>小区门到工位门 ▼</span>
            </div>
          </div>
        </div>
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon">
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <div className="me-row-title">默认选房范围</div>
          </div>
          <div className="me-row-right">
            <div className="me-setting-pill">
              <span>城六区外 3区 ▼</span>
            </div>
          </div>
        </div>
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon">
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <div>
              <div className="me-row-title">收入数据存服务器</div>
              <div className="me-row-desc">成员收入与缴存只在你自己的服务器，两台设备共用一份</div>
            </div>
          </div>
          <div className="me-row-right">
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>已启用</span>
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--text-dim)', strokeWidth: 2, fill: 'none' }}><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </div>
      </div>
    </>
  );
}