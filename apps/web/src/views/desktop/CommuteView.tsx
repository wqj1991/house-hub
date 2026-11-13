export function CommuteView() {
  return (
    <>

        <div className="kpi-row">
          <div className="card-inset">
            <div className="lb">老公 · 施耐德 (大兴凉水河)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span className="n" style={{ fontSize: 32, fontWeight: 700 }}>62</span>
              <span className="cyan" style={{ fontSize: 13, fontWeight: 600 }}>班车直达 (08:00到岗)</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>发车 06:58 · 德茂站上车 · 耗时 51′+接驳 11′</div>
          </div>
          <div className="card-inset">
            <div className="lb">老婆 · 环贸 D 座 (北三环东路)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span className="n amber" style={{ fontSize: 32, fontWeight: 700 }}>88</span>
              <span className="amber" style={{ fontSize: 13, fontWeight: 600 }}>余 2′ 进黄标</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>8号线接驳 · 门到门实测 · 严格不合并平均</div>
          </div>
          <div className="card-inset" style={{ background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.25)' }}>
            <div className="lb" style={{ color: 'var(--accent-coral)' }}>购房资格核验 · 通州双限</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span className="coral" style={{ fontSize: 24, fontWeight: 700 }}>一票否决</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4 }}>通州候选小区打红标，未核实资格严禁入场</div>
          </div>
        </div>
        <div className="board-split">
          <div className="card-inset" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>单程通勤主榜 (按较差一侧排序)</div>
              <div style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 600 }}>硬筛 ≤ 90 min</div>
            </div>
            <div className="table-header">
              <span>小区名称</span>
              <span>老公通勤</span>
              <span>老婆通勤</span>
              <span>实际成交价</span>
              <span style={{ textAlign: 'right' }}>状态</span>
            </div>
            <div className="table-row" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div>
                <strong style={{ fontSize: 14 }}>德茂佳苑</strong>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 · 旧宫 · 2004</div>
              </div>
              <div><b className="n cyan">62′</b> <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>班车</span></div>
              <div><b className="n amber">88′</b> <span style={{ fontSize: 11 }} className="amber">余2′</span></div>
              <div><b className="n">381 万</b> <span style={{ fontSize: 11 }} className="cyan">−14万</span></div>
              <div style={{ textAlign: 'right' }}><span className="tag-pill" style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--accent-amber)' }}>黄标</span></div>
            </div>
            <div className="table-row">
              <div>
                <strong style={{ fontSize: 14 }}>熙悦林语</strong>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 · 亦庄 · 2018</div>
              </div>
              <div><b className="n cyan">48′</b> <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>电车</span></div>
              <div><b className="n emerald">78′</b> <span style={{ fontSize: 11 }} className="emerald">优</span></div>
              <div><b className="n">352 万</b> <span style={{ fontSize: 11 }} className="cyan">76㎡</span></div>
              <div style={{ textAlign: 'right' }}><span className="tag-pill" style={{ background: 'rgba(5,150,105,0.2)', color: 'var(--accent-emerald)' }}>绿标</span></div>
            </div>
            <div className="table-row" style={{ opacity: 0.55 }}>
              <div>
                <strong style={{ fontSize: 14 }}>芳源里</strong>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>大兴 · 瀛海 · 2008</div>
              </div>
              <div><b className="n">58′</b> <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>自驾</span></div>
              <div><b className="n coral">96′</b> <span style={{ fontSize: 11 }} className="coral">超6′</span></div>
              <div><b className="n">356 万</b> <span style={{ fontSize: 11 }}>89㎡</span></div>
              <div style={{ textAlign: 'right' }}><span className="tag-pill" style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--accent-coral)' }}>超筛</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-inset">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>口径双轨对比</span>
                <span className="amber" style={{ fontWeight: 600 }}>口径差 14 分钟</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>德茂地铁站</div>
                  <div className="n" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>74′</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 12, padding: 8, textAlign: 'center' }}>
                  <div className="amber" style={{ fontSize: 11 }}>东门 (决策基准)</div>
                  <div className="n coral" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>88′</div>
                </div>
              </div>
            </div>
            <div className="card-inset">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>真实成交议价 (德茂佳苑)</span>
                <span className="cyan" style={{ fontWeight: 600 }}>4.28 万/㎡</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>挂牌 395 万 →</span>
                  <span className="n" style={{ fontSize: 22, fontWeight: 700 }}> 381</span><span style={{ fontSize: 12 }}> 万</span>
                </div>
                <div className="amber n" style={{ fontSize: 13, fontWeight: 700 }}>议价 −14 万 (3.5%)</div>
              </div>
            </div>
            <div className="card-inset">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>品质分溯源 (可点查来源)</span>
                <span className="n" style={{ fontWeight: 700 }}>61 / 78</span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                  <span>建成年代: 2004 年</span><span style={{ color: 'var(--text-dim)' }}>链家挂牌库</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                  <span>物业费: 2.8 元/㎡</span><span style={{ color: 'var(--text-dim)' }}>贝壳物业库</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                  <span>对口小学: 大兴一小</span><span style={{ color: 'var(--text-dim)' }}>教委划片公示</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      
    </>
  );
}
