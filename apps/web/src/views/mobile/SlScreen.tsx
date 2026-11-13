export function SlScreen() {
  return (
    <>

      <div className="m-nav-header">
        <h1 className="m-nav-title">待选池</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="批量导出">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div className="lb">待选池状态</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>留一 · 看一 · 弃一</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="m-card glass" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>德茂佳苑</div>
            <span className="tag-pill" style={{ background: 'rgba(2,132,199,0.2)', color: 'var(--accent-cyan)' }}>留</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>老婆 88′ 未越 90′ 硬筛，议价 −14 万，品质 61 分。</p>
        </div>
        <div className="m-card glass" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>熙悦林语</div>
            <span className="tag-pill" style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--accent-amber)' }}>看</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>两人通勤均在 80′ 黄金圈内，面积略小需现场看采光。</p>
        </div>
        <div className="m-card glass" style={{ borderLeft: '4px solid rgba(120,120,120,0.4)', opacity: 0.65 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>芳源里</div>
            <span className="tag-pill" style={{ background: 'rgba(120,120,120,0.2)', color: 'var(--text-dim)' }}>弃</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>老婆单程 96′ 突破 90′ 硬筛红线，单价低也坚决弃用。</p>
        </div>
      </div>
    
    </>
  );
}
