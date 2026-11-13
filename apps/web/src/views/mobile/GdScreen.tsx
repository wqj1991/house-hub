export function GdScreen() {
  return (
    <>

      <div className="m-nav-header">
        <h1 className="m-nav-title">指南</h1>
        <div className="m-nav-actions">
          <div className="m-nav-circle-btn" title="红线说明">
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
        </div>
      </div>
      <div className="guide-card hero-card">
        <div className="lb" style={{ color: 'var(--accent-cyan)' }}>DOCS 权威知识库精编 · 纯知识精读</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: 'var(--text-main)' }}>买房避坑指南体系</div>
        <div className="guide-p" style={{ marginTop: 6 }}>核心原则：不是挑选美好，而是排除隐患。建立<strong>底层财务安全边界</strong>、执行<strong>现场 40 分钟静默勘验</strong>、拆解<strong>签约车轮战心理防线</strong>。</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>财务铁律</span><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-main)' }}>月供 ≤ 家庭税后月入 40%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>应急冗余</span><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-main)' }}>强行冻结 12 个月月供备用金</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>博弈防线</span><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-main)' }}>签约谈判中场一分不加</span></div>
        </div>
      </div>
      <div className="guide-card" style={{ borderLeft: '3px solid var(--accent-coral)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div className="guide-title coral" style={{ marginBottom: 0 }}>§00 一票否决红线库</div>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,90,82,0.2)', color: '#FF5A52' }}>触碰即终止</span>
        </div>
        <p className="guide-p" style={{ marginBottom: 8 }}>红线不是用来压价的筹码，踩雷损失的是全部本金：</p>
        <div className="guide-redline-grid">
          <div className="guide-redline-item">
            <b>01. 查封 / 抵押权人拒配合解押</b>
            <p>房屋司法查封，或民间二抵抵押权人拒绝配合注销解押，首付直接面临被抵债风险。</p>
          </div>
          <div className="guide-redline-item">
            <b>02. 拒资金监管 / 首付进私户</b>
            <p>卖方或中介要求首付绕过政府监管专户打入私人账户，随时面临资金卷款跑路风险。</p>
          </div>
          <div className="guide-redline-item">
            <b>03. 设有民法典不可撤销居住权</b>
            <p>已在不动产中心设立居住权且签前未注销，买方即便过户也无法进入居住。</p>
          </div>
          <div className="guide-redline-item">
            <b>04. 承重结构严重破坏 / 危房</b>
            <p>承重墙大面积拆除无法恢复，或房屋被评定为危房不合格，存在坍塌安全隐患。</p>
          </div>
          <div className="guide-redline-item">
            <b>05. 规划垃圾焚烧 / 特高压</b>
            <p>红线内批建垃圾中转站、高压变电站或污水厂，严重损害居住健康且流动性归零。</p>
          </div>
          <div className="guide-redline-item">
            <b>06. 学位占用拒约定全额解约</b>
            <p>对口学校实行六年一学位且原业主子女在读，卖方拒绝在合同约定全额赔偿或解约权。</p>
          </div>
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-title">§01 真实购买力：总价 vs 总成本</div>
        <p className="guide-p">月供上限：<strong>家庭税后月入 × 40% − 现有负债</strong>。超过 40% 极易断供：</p>
        <div className="guide-vs-grid">
          <div className="guide-vs-box trap">
            <h4>❌ 危险的总价思维</h4>
            <ul>
              <li>• “手头有 150 万，三成首付就按 500 万买”</li>
              <li>• 把最后一分存款凑进首付，账户流动性归零</li>
              <li>• 忽视 2%~3% 契税增值税与 2% 中介费硬支出</li>
              <li>• 认为收入永远递增，按 60% 负债月供强行上车</li>
            </ul>
          </div>
          <div className="guide-vs-box rule">
            <h4>✔ 成熟的总成本思维</h4>
            <ul>
              <li>• 纯首付 = 现金 − 12 个月月供备用金 − 10% 交易杂费</li>
              <li>• 严格按照家庭税后月入 40% 锁定贷款上限</li>
              <li>• 预留至少 15 万元硬装与刚性入住置办金</li>
              <li>• 假定家庭面临 6 个月收入断流，压力测试通过才签</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-title">§02 挂牌价虚胖：如何挤出成交水分</div>
        <p className="guide-p">挂牌价非真实估值，通常有 5%~10% 的试探溢价：</p>
        <div className="guide-tactics-grid">
          <div className="guide-tactic-card">
            <b>参考 90 天内真实网签</b>
            <p>看近 3 个月同户型同楼层真实网签价中位数，不听口头宣传。</p>
          </div>
          <div className="guide-tactic-card">
            <b>结合在架天数试探</b>
            <p>挂牌超 120 天且带看稀少的房源，房东心理防线脆弱，可果断压价。</p>
          </div>
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-title">§03 现场勘验 40 分钟静默动作</div>
        <p className="guide-p">中介进门会开全屋暖灯分散注意力。进屋必须执行下列四步静默动作：</p>
        <details className="guide-accordion" open>
          <summary>动作一：进门先关灯，看真实自然采光</summary>
          <div className="guide-accordion-body">精装房常用高色温射灯遮掩暗厅死角。关灯观察白天客餐厅阴影，若正午仍需开灯，说明有遮挡硬伤。</div>
        </details>
        <details className="guide-accordion" open>
          <summary>动作二：静立 30 秒，闭眼测高架路噪与振动</summary>
          <div className="guide-accordion-body">关窗不代表安静。体会重型货车经过时的低频轰鸣与玻璃共振。低频噪音无法通过双层玻璃消除，易致长期失眠。</div>
        </details>
        <details className="guide-accordion">
          <summary>动作三：手摸外墙阴角、窗框与厨卫天花板</summary>
          <div className="guide-accordion-body">排查窗框下沿是否有泛黄水印或重新刷漆掩盖痕迹；卫生间排污管检修口是否有水渍；顶楼四周是否有修补沥青。</div>
        </details>
        <details className="guide-accordion">
          <summary>动作四：同时开水测试水压与下水管反味</summary>
          <div className="guide-accordion-body">同时打开厨房龙头、花洒并冲马桶，看水压是否骤降；凑近地漏闻是否有刺鼻下水道反味，排查存水弯缺陷。</div>
        </details>
      </div>
      <div className="guide-card">
        <div className="guide-title">§05 谈判桌上的真实机制：车轮战</div>
        <div className="guide-p">
          <strong>中介分室隔离传话：</strong>签约中心把买卖双方安排在两个独立房间，中介两头跑着传话。每谈一轮，中介必定回来说：<em>“差不多到底了，你在原价上加个 3 万行不行？”</em><br />
          <strong>记住：这是既定逼单话术，不是市场信号！</strong>你加了 3 万，中介会立刻去诱惑卖方，并在下一轮用同样方式再要一次。
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid var(--accent-cyan)', padding: '8px 12px', borderRadius: '0 10px 10px 0', margin: '8px 0', fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-main)' }}>
          <strong>探底四问（一次性问出）：</strong><br />
          “我们看了一圈，觉得和您家房子确实有缘。请问您当时出于什么考虑买的这套房？现在又是怎么考虑要卖了呢？”<br />
          <span style={{ color: 'var(--text-dim)' }}>↳ 一问四得：转手次数、急售动因、心理底价空间、潜在纠纷。</span>
        </div>
        <div className="guide-tactics-grid">
          <div className="guide-tactic-card">
            <b>底价留足 10 万空间</b>
            <p>报给中介的底价比心理极限再低 10 万，留足后续被动让步空间。</p>
          </div>
          <div className="guide-tactic-card">
            <b>中场一分不加</b>
            <p>平静合上本子说回去商量，中介担心业绩泡汤会自己回去死压卖方。</p>
          </div>
          <div className="guide-tactic-card">
            <b>约在晚上谈</b>
            <p>夜间人体力耗尽且急于达成协议收工，卖方心理防线极易松动。</p>
          </div>
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-title">§06 合同补充条款核心防线</div>
        <p className="guide-p">格式合同往往免除中介自身责任，下列防线必须逐字写入补充协议：</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div className="guide-vs-box rule" style={{ padding: '10px 12px' }}>
            <h4 style={{ fontSize: 12 }}>01. 贷款不批无条件全退定金</h4>
            <p style={{ fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.55 }}>因非买方恶意原因导致批贷不足或不予批贷的，买方有权单方解约，卖方 3 日内全额退款。绝不用“协商解决”。</p>
          </div>
          <div className="guide-vs-box rule" style={{ padding: '10px 12px' }}>
            <h4 style={{ fontSize: 12 }}>02. 权属瑕疵与隐蔽瑕疵担保</h4>
            <p style={{ fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.55 }}>卖方保证无抵押、查封、租赁及居住权占用，承担不少于 6 个月隐蔽渗漏担保期；若无法过户，卖方双倍返还定金。</p>
          </div>
          <div className="guide-vs-box rule" style={{ padding: '10px 12px' }}>
            <h4 style={{ fontSize: 12 }}>03. 户口学位迁出与尾款约束</h4>
            <p style={{ fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.55 }}>约定最晚迁出日及每日万分之五违约金；留存 5~10 万元交房尾款，户口全部迁出且对口学位无占用后再结清。</p>
          </div>
          <div className="guide-vs-box rule" style={{ padding: '10px 12px' }}>
            <h4 style={{ fontSize: 12 }}>04. 中介费延后至交房结清</h4>
            <p style={{ fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.55 }}>签约仅付 30%，过户交房且水电气结清后付清余款；若中介隐瞒抵押、查封或重大瑕疵，全额退还中介费。</p>
          </div>
        </div>
      </div>
      <div className="guide-card">
        <div className="guide-title">§07 税费精算与交房验房终极红线</div>
        <div className="guide-p">
          • <strong>满五唯一省税法门</strong>：契税 1%~1.5%，证满 2 年免增值税（约 5.3%）；<strong>满五唯一完全免征个人所得税（差额 20% 或全额 1%）</strong>，未满五产生数十万高额税费。<br />
          • <strong>交房终极红线</strong>：<strong>在水电燃气未结清、房屋隐蔽渗漏整改单未签署前，坚决不签《物业交接单》，不给付交房尾款！</strong>一旦签字放款，遗留漏水与欠费全部由买方承担。
        </div>
      </div>
      <div className="sm" style={{ margin: '14px 0 10px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>DOCS 权威知识库精编 · 响应式双端 1:1 对齐</div>
    
    </>
  );
}
