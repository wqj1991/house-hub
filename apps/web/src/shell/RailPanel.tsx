export function RailPanel() {
  return (
    <>
  <aside className="desktop-rail glass">
    <div className="rail-search" id="dRailSearchBtn" style={{ cursor: 'pointer' }}>
      <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--accent-cyan)', fill: 'none', strokeWidth: 2.2, flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input readOnly placeholder="全局搜索小区 / 班车站 / 规则 (⌘K)..." style={{ cursor: 'pointer' }} />
      <span className="m-search-k" style={{ fontSize: 10, padding: '2px 6px' }}>⌘K</span>
    </div>
    <div className="card-inset">
      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span>📏</span> 硬筛口径规则 (一票否决)
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>先过硬筛门槛，再进正交打分</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>单程上限硬筛</span><b className="n" style={{ color: 'var(--accent-coral)' }}>≤ 90 min</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>标黄预警线</span><b className="n" style={{ color: 'var(--accent-amber)' }}>80 - 90 min</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>候选区收敛</span><b>通州 / 大兴 / 昌平</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>城外直达班车</span><b className="n cyan">22 个直达点</b></div>
      </div>
    </div>
    <div className="card-inset">
      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span>🎯</span> 积分落户核验 (前置校验)
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>城六区外积分平坦，不进房源排序</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>老公申报 (3分/年)</span><b className="n" style={{ color: 'var(--accent-cyan)' }}>Cap 12 分</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>老婆申报 (2分/年)</span><b className="n" style={{ color: 'var(--accent-emerald)' }}>Cap 6 分</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>自有住所加分</span><b className="n">+0.5 分/年</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>资格前置门槛</span><span className="tag-pill" style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--accent-coral)' }}>通州双限红标</span></div>
      </div>
    </div>
    <div className="card-inset">
      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span>💰</span> 资金盘核算 (真实成交基准)
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>挂牌 ≠ 成交 · 德茂佳苑 381 万标定</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>首付现款 (35%)</span><b className="n">133.4 万</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>组合贷月供 (40%线内)</span><b className="n cyan">11,799 元</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>上车刚需金 (含税费)</span><b className="n amber">147.5 万</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-sub)' }}>12个月月供缓冲池</span><b className="n" style={{ color: 'var(--accent-emerald)' }}>14.2 万</b></div>
      </div>
    </div>
  </aside>
    </>
  );
}
