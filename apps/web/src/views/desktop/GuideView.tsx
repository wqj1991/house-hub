export function GuideView() {
  return (
    <>

        <div className="guide-card hero-card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: 6 }}>DOCS 权威知识库精编 · 纯知识精读学习平台</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>买房的核心：不是挑选美好，而是排除隐患</div>
          <p className="guide-p">
            买房是多数家庭一生中最大的一笔高杠杆决策。中介与售楼处依靠绝对的信息不对称引导冲动决策。本指南沉淀自真实避坑实战经验：建立<strong>底层财务安全边界</strong>、执行<strong>现场勘验静默动作</strong>、拆解<strong>签约谈判车轮战心理</strong>，将模糊直觉转化为确定性防线。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--glass-border-subtle)' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>财务铁律</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>月供 ≤ 家庭税后月入 40%</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>应急冗余</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>强行冻结 12 个月月供备用金</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>博弈防线</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>签约谈判中场一分不加</div>
            </div>
          </div>
        </div>
        <div className="guide-card" style={{ borderLeft: '4px solid var(--accent-coral)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="guide-title coral" style={{ marginBottom: 0 }}>§00 一票否决红线库：触碰任意一条即刻终止</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,90,82,0.18)', color: '#FF5A52', fontWeight: 600 }}>触碰即终止</span>
          </div>
          <p className="guide-p">红线不是用来压价的筹码，因为一旦踩雷损失的是全部本金。下列不可触碰之线触发任意一项，立即退出交易：</p>
          <div className="guide-redline-grid">
            <div className="guide-redline-item">
              <b>01. 查封 / 抵押权人拒配合解押</b>
              <p>房屋司法查封，或民间二抵抵押权人拒绝配合出具注销解押声明，首付款直接面临被抵债吞没风险。</p>
            </div>
            <div className="guide-redline-item">
              <b>02. 拒资金监管 / 首付要求进私户</b>
              <p>卖方或中介要求首付绕过住建委监管专户打入私人账户，随时面临资金挪用甚至卷款跑路风险。</p>
            </div>
            <div className="guide-redline-item">
              <b>03. 设有《民法典》不可撤销居住权</b>
              <p>房屋已在不动产中心设立居住权且签前未注销，买方即便过户拿到产证也无法进入居住或出租。</p>
            </div>
            <div className="guide-redline-item">
              <b>04. 承重结构严重破坏 / D级危房</b>
              <p>承重墙大面积违规拆除无法恢复原状，或房屋被评定为危房不合格，存在坍塌安全与清退风险。</p>
            </div>
            <div className="guide-redline-item">
              <b>05. 红线规划垃圾焚烧 / 特高压</b>
              <p>红线周边规划批建垃圾中转站、高压变电站或污水处理厂，严重损害身体健康且二级市场流动性归零。</p>
            </div>
            <div className="guide-redline-item">
              <b>06. 学位占用拒约定全额解约赔偿</b>
              <p>对口学校实行六年一学位且原业主子女在读，卖方拒绝在合同中约定全额无条件退款赔偿与解约权。</p>
            </div>
          </div>
        </div>
        <div className="guide-card">
          <div className="guide-title">§01 真实购买力：总价思维 vs 总成本思维</div>
          <p className="guide-p">
            可承受月供上限硬公式：<strong>家庭税后月入 × 40% − 现有负债（车贷/分期）</strong>。超过 40% 的月供会让家庭在面临失业、减薪或突发支出时陷入极端被动。
          </p>
          <div className="guide-vs-grid">
            <div className="guide-vs-box trap">
              <h4>❌ 危险的总价思维</h4>
              <ul>
                <li>• “手头有 150 万，三成首付就按 500 万买”</li>
                <li>• 把最后一分存款凑进首付，账户流动性瞬间归零</li>
                <li>• 忽视 2%~3% 契税增值税与 2.7% 中介费硬支出</li>
                <li>• 盲目假设未来收入永远递增，按 60% 负债强行上车</li>
              </ul>
            </div>
            <div className="guide-vs-box rule">
              <h4>✔ 成熟的总成本思维</h4>
              <ul>
                <li>• 纯首付 = 现金 − 12 个月月供备用金 − 10% 交易杂费</li>
                <li>• 严格按照家庭税后月入 40% 锁定贷款总额上限</li>
                <li>• 预留至少 15 万元硬装与刚性入住置办备用金</li>
                <li>• 假定家庭面临 6 个月收入断流，压力测试通过才签</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="guide-card">
          <div className="guide-title">§02 挂牌价虚胖：如何挤出真实成交水分</div>
          <p className="guide-p">
            挂牌价往往掺杂业主的试探心理与中介的推波助澜，绝非真实估值：
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
            <div className="guide-tactic-card">
              <b>参考 90 天内真实网签</b>
              <p>过滤近 3 个月同户型同楼层真实网签价，剔除最高一套和最低一套取中位数。</p>
            </div>
            <div className="guide-tactic-card">
              <b>计算真实溢价率区间</b>
              <p>当前市场下挂牌价通常存在 5%~10% 的挤水空间，急售/置换换房业主议价空间可达 8%~12%。</p>
            </div>
            <div className="guide-tactic-card">
              <b>以带看量与在架天数施压</b>
              <p>在架超 120 天且近 30 天带看低于 5 次的房源，心理防线极脆弱，切忌盲目追高报价。</p>
            </div>
          </div>
        </div>
        <div className="guide-card">
          <div className="guide-title">§03 现场勘验 40 分钟动作清单：避开中介引导</div>
          <p className="guide-p">中介进门会开全屋暖灯、拉开窗帘分散注意力。进屋必须执行下列四步静默动作：</p>
          <details className="guide-accordion" open>
            <summary>动作一：进门第一件事，关掉所有灯，看真实自然采光</summary>
            <div className="guide-accordion-body">精装房常用高色温大功率射灯遮掩暗厅和低楼层采光死角。关灯观察白天客餐厅与卧室内侧阴影，若正午仍需开灯补光，说明存在遮挡硬伤。</div>
          </details>
          <details className="guide-accordion" open>
            <summary>动作二：静立 30 秒，闭眼测高架路噪与次声波振动</summary>
            <div className="guide-accordion-body">临近主干道、高架桥的房源，关窗并不代表安静。体会重型货车经过时的低频轰鸣与玻璃共振。低频噪音无法通过双层玻璃消除，极易造成长期失眠。</div>
          </details>
          <details className="guide-accordion">
            <summary>动作三：手摸外墙阴角、窗框四周与厨卫天花板</summary>
            <div className="guide-accordion-body">排查窗框下沿是否有泛黄水印或重新刷漆掩盖痕迹；卫生间排污管检修口周围是否有水渍滴漏；顶楼天花板四周是否存在修补沥青与空鼓脱落。</div>
          </details>
          <details className="guide-accordion">
            <summary>动作四：同时开水测试水压与下水管反味</summary>
            <div className="guide-accordion-body">同时打开厨房龙头、淋浴花洒并按马桶冲水，看水压是否骤降；凑近地漏闻是否有刺鼻下水道反味，排查排污主管道是否缺乏存水弯或通气立管缺陷。</div>
          </details>
        </div>
        <div className="guide-card">
          <div className="guide-title">§05 谈判桌上的真实机制：签约中心的车轮战</div>
          <p className="guide-p">
            <strong>中介的分室隔离传话机制：</strong>签约中心把买卖双方安排在两个独立房间，中介两头跑着传话。每谈一轮，中介必定回来说：<em>“差不多到底了，你在原价上加个 3 万行不行？”</em><br />
            <strong>请记住：这是既定逼单话术，不是市场信号！</strong>你加了 3 万，中介会立刻去诱惑卖方，并在下一轮用同样方式再要一次。
          </p>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid var(--accent-cyan)', padding: '10px 14px', borderRadius: '0 12px 12px 0', margin: '10px 0', fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-main)' }}>
            <strong>探卖方真实底牌的经典四问（一次性问出）：</strong><br />
            “我们看了很多套，觉得和您家房子确实有缘。请问您当时是出于什么考虑买的这套房？现在又是怎么考虑要卖了呢？”<br />
            <span style={{ color: 'var(--text-dim)' }}>↳ 价值剖析：一问四得——弄清转手次数、急售真实动因（置换有节点/离婚分割/资金链）、心理底价空间、是否有潜在纠纷。</span>
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
          <div className="guide-title">§06 合同与补充协议核心法务防线</div>
          <p className="guide-p">中介格式合同往往免除自身责任，下列法务防线必须逐字写入补充条款：</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 8 }}>
            <div className="guide-vs-box rule">
              <h4>01. 贷款不批无条件全退定金</h4>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>明确写明：因非买方恶意原因导致批贷不足或不予批贷的，买方有权单方解约，卖方 3 日内全额退款。绝不用“协商解决”。</p>
            </div>
            <div className="guide-vs-box rule">
              <h4>02. 权属瑕疵与隐蔽瑕疵担保</h4>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>卖方保证无抵押、查封、租赁及居住权占用，承担不少于 6 个月隐蔽渗漏担保期；若无法过户，卖方双倍返还定金。</p>
            </div>
            <div className="guide-vs-box rule">
              <h4>03. 户口学位迁出与尾款约束</h4>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>约定最晚迁出日及每日万分之五违约金；留存 5~10 万元交房尾款，户口全部迁出且对口学位无占用后再结清。</p>
            </div>
            <div className="guide-vs-box rule">
              <h4>04. 中介费延后至交房结清</h4>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>签约仅付 30%，过户交房且水电气结清后付清余款；若中介隐瞒抵押、查封或重大瑕疵，全额退还中介费。</p>
            </div>
          </div>
        </div>
        <div className="guide-card">
          <div className="guide-title">§07 税费精算与交房验房终极红线</div>
          <p className="guide-p">
            • <strong>满五唯一省税法门</strong>：契税 1%~1.5%，证满 2 年免增值税（约 5.3%）；<strong>满五唯一完全免征个人所得税（差额 20% 或全额 1%）</strong>，未满五产生数十万高额税费。<br />
            • <strong>交房终极红线</strong>：<strong>在水电燃气未结清、房屋隐蔽渗漏整改单未签署前，坚决不签《物业交接单》，不给付交房尾款！</strong>一旦签字放款，遗留漏水与欠费全部由买方承担。
          </p>
        </div>
      
    </>
  );
}
