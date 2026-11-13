export function CmScreen() {
  return (
    <>

      <div className="m-nav-header">
        <h1 className="m-nav-title">通勤</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="班车站筛选">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div className="lb">单程通勤主榜 · 严格硬筛 ≤ 90′</div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>德茂佳苑</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 旧宫 · 381万</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="n amber" style={{ fontSize: 14, fontWeight: 700 }}>88′</div>
              <div style={{ fontSize: 10, color: 'var(--accent-amber)' }}>余 2′ 黄标</div>
            </div>
          </div>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>熙悦林语</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 亦庄 · 352万</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="n emerald" style={{ fontSize: 14, fontWeight: 700 }}>78′</div>
              <div style={{ fontSize: 10, color: 'var(--accent-emerald)' }}>两人均在80′内</div>
            </div>
          </div>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>芳源里 (超筛出榜)</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 瀛海 · 356万</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="n coral" style={{ fontSize: 14, fontWeight: 700 }}>96′</div>
              <div style={{ fontSize: 10, color: 'var(--accent-coral)' }}>超硬筛 6′</div>
            </div>
          </div>
        </div>
      </div>
    
    </>
  );
}
