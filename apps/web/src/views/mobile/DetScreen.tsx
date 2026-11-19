export function DetScreen() {
  return (
    <>

      <div className="m-nav-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="m-nav-circle-btn" style={{ width: 34, height: 34, fontSize: 18, fontWeight: 700 }} title="返回">‹</div>
          <h1 className="m-nav-title" style={{ fontSize: 20 }}>小区详情</h1>
        </div>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="加入待选">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="lb">焦点小区透视</span>
          <span className="tag-pill" style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--accent-amber)' }}>榜首黄标</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>德茂佳苑</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>大兴区 旧宫镇 · 2004 年 · 89㎡ 两室</div>
      </div>
      <div className="m-card glass">
        <div className="lb">口径差切换检验</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>德茂地铁站</div>
            <div className="n" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>74′</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>站到站口径</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 12, padding: 10, textAlign: 'center' }}>
            <div className="amber" style={{ fontSize: 11 }}>东门 (决策基准)</div>
            <div className="n coral" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>88′</div>
            <div style={{ fontSize: 10, color: 'var(--accent-amber)', marginTop: 2 }}>真实门到门</div>
          </div>
        </div>
      </div>
      <div className="m-card glass">
        <div className="lb">议价空间与成交总价</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>挂牌 395 万 → 成交</div>
            <div className="n" style={{ fontSize: 26, fontWeight: 700 }}>381<span style={{ fontSize: 14 }}> 万</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>实际议价空间</div>
            <div className="n amber" style={{ fontSize: 18, fontWeight: 700 }}>−14 万 (3.5%)</div>
          </div>
        </div>
      </div>
    
    </>
  );
}
