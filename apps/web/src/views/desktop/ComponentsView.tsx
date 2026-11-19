import { SearchIcon } from "@/components/icons";

export function ComponentsView() {
  return (
    <>

        <div className="card-hero" style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>DESIGN SYSTEM & SPEC · 统一交互组件库</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>液态玻璃 (Liquid Glass) 交互规范与实战组件</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>规范包含：微交互按钮 / 全局通知 Toast / 半透模糊滚动条 / 常用输入控件 (日期·时间·下拉) / 模态弹窗 / 质感加载</div>
          </div>
          <button className="btn btn-primary">
            <span>✨ 演示微动效</span>
          </button>
        </div>
        <div className="comp-wrapper">
          <div className="comp-grid">
    <div className="section-box">
      <div className="sec-title">
        <span>按钮体系与触控微动效</span>
        <span className="sec-sub">Hover 位移浮起 + Active 缩放涟漪</span>
      </div>
      <div className="btn-group">
        <button className="g-btn g-btn-primary">
          <span>✨ 确认加入决策</span>
        </button>
        <button className="g-btn">
          <span>次要操作</span>
        </button>
        <button className="g-btn g-btn-danger">
          <span>一票否决</span>
        </button>
        <button className="g-btn" style={{ borderRadius: 14, padding: '8px 12px', fontSize: 12 }}>
          <span>小号紧凑键</span>
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        动效原则：鼠标悬停触发 1px 浮起及外高光增强；按下时 scale(0.96) 弹性内陷并触发微光水波涟漪；触屏端无 hover 滞留。
      </div>
    </div>
    <div className="section-box">
      <div className="sec-title">
        <span>全局通知 Toast 消息条</span>
        <span className="sec-sub">悬浮半透胶囊 · 自动淡入淡出</span>
      </div>
      <div className="toast-stack">
        <div className="g-toast">
          <div className="toast-icon" style={{ background: 'rgba(24,192,168,0.25)', color: 'var(--cyan)' }}>✓</div>
          <div className="toast-content">
            <div className="toast-title">房源实测完成</div>
            <div className="toast-desc">望京西园三区噪音实测 42 dB，已归档至避坑报告</div>
          </div>
          <button className="toast-close">×</button>
        </div>
        <div className="g-toast">
          <div className="toast-icon" style={{ background: 'rgba(255,184,77,0.25)', color: 'var(--amber)' }}>⚠</div>
          <div className="toast-content">
            <div className="toast-title">通勤标黄警示</div>
            <div className="toast-desc">老婆晚高峰单程耗时 58 分钟，接近 60′ 黄金圈上限</div>
          </div>
          <button className="toast-close">×</button>
        </div>
      </div>
    </div>
    <div className="section-box">
      <div className="sec-title">
        <span>玻璃化滚动条 (Scrollbar)</span>
        <span className="sec-sub">极细 6px · 隐形轨道 · 胶囊滑块</span>
      </div>
      <div className="scroll-demo-box">
        <p><b>[滚动条体验测试区]</b> 现代玻璃态滚动条严禁使用操作系统原生的粗硬滑块。采用 6px 隐形导轨，滑块为圆头半透白胶囊（深色模式 rgba(255,255,255,0.22)，浅色模式 rgba(0,0,0,0.18)）。</p>
        <p style={{ marginTop: 6 }}>鼠标 Hover 或拖动滑块时，白晶胶囊高光提升至 0.45，不阻挡文字可读性，在不产生视觉杂乱的同时保留平滑滚动的空间位置感知。</p>
        <p style={{ marginTop: 6 }}>移动端 WebView 默认隐藏滚动轨道（scrollbar-width: none），手势滑动时由 iOS 弹性边界动效承接。</p>
      </div>
    </div>
    <div className="section-box">
      <div className="sec-title">
        <span>常用表单输入组件</span>
        <span className="sec-sub">内嵌半透玻璃底 · Focus 柔光聚焦环</span>
      </div>
      <div className="input-stack">
        <div className="input-field">
          <div className="input-label"><span>搜索房源或商圈</span><span style={{ fontSize: 11, color: 'var(--cyan)' }}>实时过滤</span></div>
          <div className="g-input-wrap">
            <span className="input-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input className="g-input" placeholder="输入小区名（如：望京西园）..." defaultValue="望京西园三区" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-field">
            <div className="input-label">
              <span>户型结构要求 (下拉选择)</span>
              <span style={{ fontSize: 11, color: 'var(--cyan)' }}>支持跨端</span>
            </div>
            <div className="custom-select" id="selectHouseType">
              <div className="custom-select-trigger">
                <span className="selected-text" id="selectedHouseTypeText">南北通透 · 2室1厅</span>
                <span className="custom-select-arrow">▼</span>
              </div>
              <div className="glass-dropdown-menu">
                <div className="dropdown-item is-selected">
                  <span>南北通透 · 2室1厅</span><span className="dropdown-check">✓</span>
                </div>
                <div className="dropdown-item">
                  <span>全南向两居 · 采光优先</span><span className="dropdown-check">✓</span>
                </div>
                <div className="dropdown-item">
                  <span>全明三居 · 双卫格局</span><span className="dropdown-check">✓</span>
                </div>
                <div className="dropdown-item">
                  <span>一层带花园 / 顶层复式</span><span className="dropdown-check">✓</span>
                </div>
              </div>
            </div>
          </div>
          <div className="input-field">
            <div className="input-label">
              <span>到岗 / 班车时刻选择 (时间选择)</span>
              <span style={{ fontSize: 11, color: 'var(--amber)' }} id="timeDisplayBadge">08:00 到岗</span>
            </div>
            <div className="custom-select" id="selectTimePicker">
              <div className="custom-select-trigger">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⏱️</span>
                  <span className="selected-text" id="selectedTimeText" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>08 : 00</span>
                </div>
                <span className="custom-select-arrow">▼</span>
              </div>
              <div className="glass-dropdown-menu">
                <div className="time-picker-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)' }}>时分选择 (时 / 分)</span>
                    <span style={{ fontSize: 11, color: 'var(--cyan)' }}>班车时刻倒推</span>
                  </div>
                  <div className="time-wheel-group">
                    <div className="time-col-wrap">
                      <div className="time-col-label">时 (HH)</div>
                      <div className="time-scroll-col" id="colHours">
                        <div className="time-opt">06</div>
                        <div className="time-opt">07</div>
                        <div className="time-opt is-active">08</div>
                        <div className="time-opt">09</div>
                        <div className="time-opt">10</div>
                      </div>
                    </div>
                    <div className="time-sep">:</div>
                    <div className="time-col-wrap">
                      <div className="time-col-label">分 (MM)</div>
                      <div className="time-scroll-col" id="colMinutes">
                        <div className="time-opt is-active">00</div>
                        <div className="time-opt">15</div>
                        <div className="time-opt">30</div>
                        <div className="time-opt">45</div>
                        <div className="time-opt">52</div>
                      </div>
                    </div>
                  </div>
                  <div className="time-quick-pills">
                    <span className="time-pill">06:52 班车发车</span>
                    <span className="time-pill">08:00 施耐德到岗</span>
                    <span className="time-pill">09:00 环贸到岗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-field">
            <div className="input-label">
              <span>实地看房 / 积分起算日 (日期选择)</span>
              <span style={{ fontSize: 11, color: 'var(--cyan)' }} id="dateDisplayBadge">周六实测</span>
            </div>
            <div className="custom-select" id="selectDatePicker">
              <div className="custom-select-trigger">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <span className="selected-text" id="selectedDateText" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>2026-11-15</span>
                </div>
                <span className="custom-select-arrow">▼</span>
              </div>
              <div className="glass-dropdown-menu" style={{ minWidth: 300 }}>
                <div className="date-picker-panel">
                  <div className="date-header">
                    <button className="date-nav-btn">‹</button>
                    <div className="date-month-title" id="currentMonthYearText">2026 年 11 月</div>
                    <button className="date-nav-btn">›</button>
                  </div>
                  <div className="date-weekdays">
                    <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                  </div>
                  <div className="date-grid" id="calendarDaysGrid">
                  </div>
                  <div className="date-quick-pills">
                    <span className="date-pill">本周六实地看房</span>
                    <span className="date-pill">2026-12-31 年限截点</span>
                    <span className="date-pill">2027 元旦申报</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="input-field">
            <div className="input-label"><span>预算上限设定</span></div>
            <div className="g-input-wrap">
              <span className="input-icon">￥</span>
              <input className="g-input" defaultValue="420 万元" />
            </div>
          </div>
        </div>
        <div className="switch-row">
          <div>
            <div style={{ fontWeight: 600 }}>严格开启一票否决</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>命中临铁临高架等 4 条硬伤房直接隐藏</div>
          </div>
          <div className="g-switch is-on"></div>
        </div>
      </div>
    </div>
    <div className="section-box">
      <div className="sec-title">
        <span>模态弹窗组件 (Modal)</span>
        <span className="sec-sub">高透玻璃悬浮卡 · 30px 高斯深度虚化</span>
      </div>
      <div className="modal-preview-box">
        <div className="g-modal">
          <div className="modal-head">
            <h4>确认核定此房源成交目标价？</h4>
            <span style={{ fontSize: 11, color: 'var(--cyan)' }}>望京西园三区</span>
          </div>
          <div className="modal-body">
            锁定目标价为 <b>392 万元</b>（挂牌砍价空间估算 −18 万）。系统将同步重新核算首付 117.6 万与现金清盘沙盘。
          </div>
          <div className="modal-foot">
            <button className="g-btn" style={{ padding: '6px 14px', fontSize: 12 }}>取消</button>
            <button className="g-btn g-btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>确认锁定</button>
          </div>
        </div>
      </div>
    </div>
    <div className="section-box">
      <div className="sec-title">
        <span>加载与骨架屏组件 (Loading)</span>
        <span className="sec-sub">液态微光转圈 · 骨架流光 · 呼吸点</span>
      </div>
      <div className="loading-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="g-spinner"></div>
          <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>正在同步周边成交真实底价...</span>
        </div>
        <div className="dots-pulse">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 6 }}>数据加载骨架屏 (Skeleton Shimmer):</div>
      <div className="skeleton-box">
        <div className="skeleton-line" style={{ width: '40%' }}></div>
        <div className="skeleton-line" style={{ width: '85%' }}></div>
        <div className="skeleton-line" style={{ width: '65%' }}></div>
      </div>
    </div>
  </div>
</div>
    </>
  );
}
