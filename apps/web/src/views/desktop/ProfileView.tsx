export function ProfileView() {
  return (
    <>

        <div className="glass" style={{ padding: '18px 22px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="profile-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>YG</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>YG 决策席 · 个人自用工作台</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>本地独立配置 · 预算上限与主题底膜存储于本地设备</div>
          </div>
        </div>
        <div className="glass" style={{ padding: '18px 22px', borderRadius: 18 }}>
          <div className="lb" style={{ marginBottom: 12 }}>视觉主题底膜 (点击即时生效)</div>
          <div className="theme-selector-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
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
        <div className="glass" style={{ padding: '18px 22px', borderRadius: 18 }}>
          <div className="lb" style={{ marginBottom: 12 }}>财务安全垫参数配置</div>
          <div className="profile-meta-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="profile-meta-item">
              <div className="lb">家庭税后月入</div>
              <div className="val cyan" style={{ fontSize: 20, marginTop: 4 }}>35,000 元/月</div>
            </div>
            <div className="profile-meta-item">
              <div className="lb">40% 月供硬上限</div>
              <div className="val amber" style={{ fontSize: 20, marginTop: 4 }}>14,000 元/月</div>
            </div>
            <div className="profile-meta-item">
              <div className="lb">家庭可用现金储备</div>
              <div className="val" style={{ fontSize: 20, marginTop: 4 }}>160.0 万元</div>
            </div>
            <div className="profile-meta-item">
              <div className="lb">12 个月极端备用金 (必扣除)</div>
              <div className="val coral" style={{ fontSize: 20, marginTop: 4 }}>14.1 万元</div>
            </div>
          </div>
        </div>
      
    </>
  );
}
