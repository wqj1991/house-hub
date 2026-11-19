export function SpotlightModal({ open }: { open: boolean }) {
  return (
    <>
<div
  className={`spotlight-modal${open ? " is-open" : ""}`}
  id="spotlightModal"
  role="dialog"
  aria-modal="true"
  aria-label="穿透检索"
  aria-hidden={!open}
>
  <div className="spotlight-input-box">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    <input
      id="spotlightInput"
      type="search"
      aria-label="检索小区、班车站、规则或预算"
      placeholder="输入小区 / 班车站 / 品质指标 / 预算进行穿透检索..."
    />
    <button className="spotlight-cancel" id="spotlightCancel" type="button">完成</button>
  </div>
  <div className="spotlight-chips">
    <span className="spotlight-chip is-active" data-filter="all">全部 (13)</span>
    <span className="spotlight-chip" data-filter="house">候选房源 (5)</span>
    <span className="spotlight-chip" data-filter="station">班车站 (3)</span>
    <span className="spotlight-chip" data-filter="rule">硬筛规则 (2)</span>
    <span className="spotlight-chip" data-filter="budget">资金盘 (3)</span>
  </div>
  <div className="spotlight-list">
    <div className="spotlight-item" data-type="house" data-jump="det">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>德茂佳苑 (大兴 旧宫)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>老公 62′ · 老婆 88′ · 成交价 381 万 · 议价 −14 万</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--accent-amber)' }}>榜首黄标</span>
    </div>
    <div className="spotlight-item" data-type="house" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>熙悦林语 (大兴 亦庄)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>老公 48′ · 老婆 78′ · 两人均在 80′ 黄金圈内</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(5,150,105,0.2)', color: 'var(--accent-emerald)' }}>绿标优先</span>
    </div>
    <div className="spotlight-item" data-type="house" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>融创中心 (通州 梨园)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>双人通勤均 ≤75′ · 通州双限资格前置核验</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--accent-coral)' }}>资格待核</span>
    </div>
    <div className="spotlight-item" data-type="house" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>芳源里 (大兴 瀛海)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>老婆 96′ 超出 90′ 硬筛 · 坚决出榜</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--accent-coral)' }}>超筛出榜</span>
    </div>
    <div className="spotlight-item" data-type="house" data-jump="det">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>金地中央格林 (昌平 回龙观)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>老婆 45′ 直达 · 老公 82′ 班车直达点接驳</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(2,132,199,0.2)', color: 'var(--accent-cyan)' }}>昌平直达</span>
    </div>
    <div className="spotlight-item" data-type="station" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>施耐德直达班车点 (大兴 凉水河二街2号)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>德茂站 06:58 发车 · 08:00 到岗 · 车程 51 分钟</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(2,132,199,0.2)', color: 'var(--accent-cyan)' }}>班车站</span>
    </div>
    <div className="spotlight-item" data-type="station" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>旧宫地铁站接驳专线</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>亦庄T1有轨电车接驳 · 07:15 发车 · 07:50 达厂</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(2,132,199,0.2)', color: 'var(--accent-cyan)' }}>接驳专线</span>
    </div>
    <div className="spotlight-item" data-type="station" data-jump="cm">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>环贸D座通勤快线 (北三环东路)</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>地铁 8 号线安德里北街直达 · 09:00 前无缝打卡</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(5,150,105,0.2)', color: 'var(--accent-emerald)' }}>地铁直达</span>
    </div>
    <div className="spotlight-item" data-type="rule" data-jump="gd">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>通州双限购房资格前置核验</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>近 3 年纳税/社保未核实前严禁交定金 · 一票否决</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--accent-coral)' }}>一票否决</span>
    </div>
    <div className="spotlight-item" data-type="rule" data-jump="gd">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>单程 ≤90min 硬筛与 80min 预警</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>单程超 90 分钟坚决不出主榜 · 80-90 分钟亮黄标</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--accent-amber)' }}>通勤红线</span>
    </div>
    <div className="spotlight-item" data-type="budget" data-jump="my">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>40% 月供极限负债沙盘</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>家庭税后月入 × 40% − 现有负债 · 严防收入断流</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(2,132,199,0.2)', color: 'var(--accent-cyan)' }}>财务红线</span>
    </div>
    <div className="spotlight-item" data-type="budget" data-jump="my">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>12 个月月供缓冲安全储备金</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>按月供 11,799 元储备 14.16 万元强冻结备用金</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(5,150,105,0.2)', color: 'var(--accent-emerald)' }}>安全垫</span>
    </div>
    <div className="spotlight-item" data-type="budget" data-jump="me">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>收入与公积金 · 家庭可贷录入</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>成员收入 / 缴存年限合并 → 家庭收入与公积金可贷额度实时测算</div>
      </div>
      <span className="tag-pill" style={{ background: 'rgba(5,150,105,0.2)', color: 'var(--accent-emerald)' }}>收入录入</span>
    </div>
  </div>
</div>
    </>
  );
}
