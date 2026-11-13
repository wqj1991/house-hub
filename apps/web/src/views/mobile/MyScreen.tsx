export function MyScreen() {
  return (
    <>

      <div className="m-nav-header">
        <h1 className="m-nav-title">算钱</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="利率配置">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div className="lb">预算核算 · 锁定真实成交 381 万</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span className="n" style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>133.4</span>
          <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>万首付款 (35%)</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>组合贷款 247.6 万 · 25 年等额本息</div>
      </div>
      <div className="m-card glass">
        <div className="lb">月供与上车总现金</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-sub)' }}>公积金贷 (60万 @ 2.85%)</span>
            <span className="n">2,842 元/月</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-sub)' }}>商业贷款 (187.6万 @ 3.10%)</span>
            <span className="n">8,957 元/月</span>
          </div>
          <div style={{ height: 1, background: 'var(--glass-border-subtle)', margin: '4px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>月供合计</span>
            <span className="n cyan" style={{ fontSize: 16 }}>11,799 元/月</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>所需现金合计 (含税费中介费)</span>
            <span className="n amber" style={{ fontSize: 16 }}>147.5 万</span>
          </div>
        </div>
      </div>
    
    </>
  );
}
