export function OvScreen() {
  return (
    <>

      <div className="m-nav-header">
        <h1 className="m-nav-title">首页</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="AI 决策建议">
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}><defs><linearGradient id="mAiGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38BDF8" /><stop offset="50%" stopColor="#A855F7" /><stop offset="100%" stopColor="#EC4899" /></linearGradient></defs><circle cx="12" cy="12" r="8" fill="none" stroke="url(#mAiGrad)" strokeWidth="2.2" strokeDasharray="3 2" /><circle cx="12" cy="12" r="2.8" fill="url(#mAiGrad)" /></svg>
          </div>
          <div className="m-nav-circle-btn" title="消息通知">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </div>
        </div>
      </div>
      <div className="m-search-bar" id="mSearchBar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <div className="m-search-text">搜小区 / 班车站 / 品质分 / 预算...</div>
        <div className="m-search-k">⌘K</div>
      </div>
      <div className="m-card glass">
        <div className="lb">城六区外选房 · 候选片区</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span className="n" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>7</span>
          <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>个候选片区入池</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>通州 / 大兴 / 昌平 · 22 个班车站直达点</div>
      </div>
      <div className="m-card glass">
        <div className="lb">双人通勤时间分布 (门到门)</div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>老公 · 施耐德 (大兴凉水河)</span>
              <span className="n cyan" style={{ fontWeight: 700 }}>62′ (班车)</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: '68%', height: '100%', background: 'var(--accent-cyan)', borderRadius: 3 }}></div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>老婆 · 环贸 D 座 (北三环东路)</span>
              <span className="n amber" style={{ fontWeight: 700 }}>88′ (地铁)</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: '97%', height: '100%', background: 'var(--accent-amber)', borderRadius: 3 }}></div>
            </div>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div className="lb">积分前置平坦声明</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginTop: 6 }}>
          城六区外积分平坦，不进排序；两数并列校验：老公 12 分 / 老婆 6 分。
        </div>
      </div>
    
    </>
  );
}
