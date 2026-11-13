export function MeScreen() {
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
        <div className="me-avatar-wrap">
          <div className="me-avatar-img">
            <svg viewBox="0 0 64 64" style={{ width: 44, height: 44 }}><circle cx="32" cy="32" r="30" fill="#E2E8F0" /><path d="M18 22 C18 14, 46 14, 46 22 C48 30, 42 40, 32 40 C22 40, 16 30, 18 22 Z" fill="#64748B" /><circle cx="32" cy="30" r="14" fill="#FDE68A" /><path d="M22 24 C26 18, 38 18, 42 24 C40 28, 38 29, 32 29 C26 29, 24 28, 22 24 Z" fill="#475569" /><circle cx="28" cy="28" r="2.2" fill="#1E293B" /><circle cx="36" cy="28" r="2.2" fill="#1E293B" /><path d="M20 54 C22 44, 42 44, 44 54 Z" fill="#3B82F6" /></svg>
          </div>
          <div className="me-avatar-badge">✓</div>
        </div>
        <div className="me-user-meta">
          <div className="me-username">allen</div>
          <div className="me-vip-tag">
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0284C7' }}></span>
            家庭决策席 · 本地私有
          </div>
        </div>
      </div>
      <div className="me-group-card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: '0.04em' }}>视觉主题底膜 (点击即时生效)</div>
        <div className="theme-selector-grid">
          <div className="theme-card is-active" data-tone-pick="dawn">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="theme-info">
                <strong>晨曦暖白 (Dawn)</strong>
                <span>浅色柔光 · 清透折射 (默认)</span>
              </div>
              <div className="theme-preview-dots">
                <div className="theme-dot" style={{ background: '#EEF3F8' }}></div>
                <div className="theme-dot" style={{ background: '#FFAE9E' }}></div>
                <div className="theme-dot" style={{ background: '#0284C7' }}></div>
              </div>
            </div>
          </div>
          <div className="theme-card" data-tone-pick="glacier">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="theme-info">
                <strong>极光冰川 (Glacier)</strong>
                <span>冷青蓝绿 · 深邃极光</span>
              </div>
              <div className="theme-preview-dots">
                <div className="theme-dot" style={{ background: '#030B12' }}></div>
                <div className="theme-dot" style={{ background: '#12B5A0' }}></div>
                <div className="theme-dot" style={{ background: '#227AB5' }}></div>
              </div>
            </div>
          </div>
          <div className="theme-card" data-tone-pick="twilight">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="theme-info">
                <strong>暮色暗紫 (Twilight)</strong>
                <span>深空紫蓝 · 霓虹暗色</span>
              </div>
              <div className="theme-preview-dots">
                <div className="theme-dot" style={{ background: '#080410' }}></div>
                <div className="theme-dot" style={{ background: '#8338EC' }}></div>
                <div className="theme-dot" style={{ background: '#3A86FF' }}></div>
              </div>
            </div>
          </div>
          <div className="theme-card" data-tone-pick="obsidian">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="theme-info">
                <strong>黑曜纯深 (Obsidian)</strong>
                <span>石墨碳黑 · 纯粹克制</span>
              </div>
              <div className="theme-preview-dots">
                <div className="theme-dot" style={{ background: '#050608' }}></div>
                <div className="theme-dot" style={{ background: '#3D4A62' }}></div>
                <div className="theme-dot" style={{ background: '#E2E8F0' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="me-section-title">财务与买房盘子设定</div>
      <div className="me-group-card">
        <div className="me-row" id="rowFamilyIncome">
          <div className="me-row-left">
            <div className="me-row-icon" style={{ color: '#0284C7' }}>
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </div>
            <div>
              <div className="me-row-title">家庭税后月入</div>
              <div className="me-row-desc">夫妻双方合算 · 锁定月供安全上限</div>
            </div>
          </div>
          <div className="me-row-right">
            <div className="me-setting-pill">
              <span>32,000 元/月</span>
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
            </div>
          </div>
        </div>
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon" style={{ color: '#10B981' }}>
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div>
              <div className="me-row-title">备用金留存</div>
              <div className="me-row-desc">不可动用的6个月生活保障垫</div>
            </div>
          </div>
          <div className="me-row-right">
            <div className="me-setting-pill">
              <span>20.0 万元</span>
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
            </div>
          </div>
        </div>
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon" style={{ color: '#F59E0B' }}>
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <div>
              <div className="me-row-title">负债月供上限率</div>
              <div className="me-row-desc">月供 / 月入，默认严格控制在40%内</div>
            </div>
          </div>
          <div className="me-row-right">
            <div className="me-setting-pill">
              <span>40% (安全)</span>
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
            </div>
          </div>
        </div>
        <div className="me-row">
          <div className="me-row-left">
            <div className="me-row-icon" style={{ color: '#6366F1' }}>
              <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor' }}><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>
            </div>
            <div>
              <div className="me-row-title">双人公积金冲还贷</div>
              <div className="me-row-desc">北京国管/市管满额 120万/人</div>
            </div>
          </div>
          <div className="me-row-right">
            <div className="me-toggle is-on" title="切换公积金冲抵"></div>
          </div>
        </div>
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
              <div className="me-row-title">全本地离线存储</div>
              <div className="me-row-desc">敏感薪资与资产不出手机</div>
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
