import { useEffect, useState } from "react";
import { fetchNewProjects } from "@/lib/newhouseApi";
import { fmtArea, fmtAvg, fmtAvgRange, fmtStamp, statusClass } from "@/lib/newhouseFormat";
import { NewProjectDetail, closePickDetail, hashPickUid, openPickDetail } from "@/views/shared/NewProjectDetail";
import {
  DELIVERY_CUTOFFS,
  PRICE_BANDS,
  bizcircleOptions,
  bizcircleQuery,
  bizcircleSummary,
  bizcircleTrigger,
  labelOf,
  priceSummary,
  totalRanges,
} from "@/lib/newhouseFilters";
import { GlassMultiSelect } from "@/components/GlassSelect";
import { ModeSwitch, type ModeTab } from "@/components/ModeSwitch";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { getServerBase } from "@/lib/serverClient";
import type { NewProjectListResponse } from "@/lib/newhouseApi";

/** 选房口径：一二手切换，新房先上（数据来自抓数快照），二手房接 community 成交库。 */
type PickMode = "new" | "used";

const PICK_MODES: [ModeTab<PickMode>, ModeTab<PickMode>] = [
  { value: "new", label: "新房" },
  { value: "used", label: "二手房", badge: "待接入" },
];

const DISTRICTS = [
  { key: "", label: "不限区域" },
  { key: "大兴", label: "大兴" },
  { key: "通州", label: "通州" },
];

const STATUS = [
  { key: "", label: "全部状态" },
  { key: "在售", label: "在售" },
  { key: "待售", label: "待售" },
];

const SORTS: Array<{ key: "default" | "price" | "priceDesc" | "total" | "open"; label: string }> = [
  { key: "default", label: "默认（在售优先）" },
  { key: "price", label: "单价从低到高" },
  { key: "priceDesc", label: "单价从高到低" },
  { key: "total", label: "总价门槛最低" },
  { key: "open", label: "开盘时间最近" },
];

export function PicksView() {
  const [mode, setMode] = useState<PickMode>("new");
  return (
    <>
      <ModeSwitch
        value={mode}
        onChange={setMode}
        tabs={PICK_MODES}
        ariaLabel="选房类型"
        note={mode === "new" ? "大兴 / 通州 · 房天下新盘快照" : "成交明细入仓中 · 目前只做新房"}
      />
      {mode === "new" ? <NewHousePanel /> : <UsedHousePanel onBack={() => setMode("new")} />}
    </>
  );
}

function NewHousePanel() {
  const [district, setDistrict] = useState("");
  // 商圈用"区域|商圈"存，避免"亦庄"在大兴和通州重名时选错；可多选
  const [bizKeys, setBizKeys] = useState<string[]>([]);
  const [deliveryBefore, setDeliveryBefore] = useState("");
  // 总价预算是多档并集：可以同时要"300 万以下"和"500–800 万"
  const [priceBands, setPriceBands] = useState<string[]>([]);
  const [saleStatus, setSaleStatus] = useState("");
  const [sort, setSort] = useState<"default" | "price" | "priceDesc" | "total" | "open">("default");
  const [keyword, setKeyword] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<NewProjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 进阶筛选（状态/商圈/交房/预算）可折叠：桌面默认展开，手机上默认收着
  const [adv, setAdv] = useState(true);
  // 详情是独立页：地址栏 /picks/<uid> 就是状态，刷新、分享、浏览器返回键都成立
  const [detailUid, setDetailUid] = useState<string | null>(() => hashPickUid());
  useEffect(() => {
    const sync = () => setDetailUid(hashPickUid());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // 输入 250ms 才打请求，敲字的时候不要每一下都问服务端
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(keyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const bizcircle = bizcircleQuery(bizKeys);
  const bizLabel = bizcircleTrigger(bizKeys, "不限商圈");
  const ranges = totalRanges(priceBands);
  const bizOptions = bizcircleOptions(data?.bizcircles, district);

  // 换区域时清掉不属于该区域的商圈，别留下一个永远命不中的筛选
  const pickDistrict = (key: string) => {
    setDistrict(key);
    if (key) setBizKeys((prev) => prev.filter((item) => item.startsWith(key + "|")));
  };

  // 多选：点一次选中，再点取消；跨区域可以一起选，不再自动改写区域
  const toggleBizcircle = (key: string) => {
    if (!key) {
      setBizKeys([]);
      return;
    }
    setBizKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  // 预算同样是多选：空 key 等于"不限预算"
  const togglePriceBand = (key: string) => {
    if (!key) {
      setPriceBands([]);
      return;
    }
    setPriceBands((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const resetFilters = () => {
    setDistrict("");
    setBizKeys([]);
    setDeliveryBefore("");
    setPriceBands([]);
    setSaleStatus("");
    setSort("default");
    setKeyword("");
  };

  const filtered = Boolean(district || bizKeys.length || deliveryBefore || priceBands.length || saleStatus || q);

  // 折叠区里生效了几条，以及折叠后那一行摘要
  const advCount = [saleStatus, bizKeys.length ? "biz" : "", deliveryBefore, priceBands.length ? "price" : ""].filter(Boolean).length;
  const advSummary = [
    labelOf(STATUS, saleStatus),
    bizcircleSummary(bizKeys),
    labelOf(DELIVERY_CUTOFFS, deliveryBefore),
    priceSummary(priceBands),
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchNewProjects({
      district,
      bizcircle,
      saleStatus,
      sort,
      q,
      deliveryBefore,
      totalRanges: ranges,
    })
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [district, bizcircle, saleStatus, sort, q, deliveryBefore, ranges]);

  const items = data?.items ?? [];

  if (detailUid) {
    return (
      <NewProjectDetail uid={detailUid} onBack={closePickDetail} />
    );
  }

  return (
    <>
      {/* 概览指标：一行四个，原来 3+1 换行的四张大卡既高又空 */}
      <div className="card-inset pick-stats">
        <div className="pick-stats-row">
          <div className="pick-stat" title={"数据源 房天下新盘 · " + fmtStamp(data?.stats.fetchedAt)}>
            <span className="pick-stat-lb">在库新盘</span>
            <span className="pick-stat-v">
              <b>{data?.all ?? "—"}</b>
              <em className="pick-stat-u">大兴 + 通州</em>
            </span>
          </div>
          <div className="pick-stat" title="待售＝已亮相未取证，可先锁关注">
            <span className="pick-stat-lb">在售 / 待售</span>
            <span className="pick-stat-v is-emerald">
              <b>{data?.stats.onSale ?? "—"}</b>
              <em className="pick-stat-u">待售 {data?.stats.waiting ?? "—"}</em>
            </span>
          </div>
          <div className="pick-stat" title="备案 / 报价均价，未含优惠">
            <span className="pick-stat-lb">单价区间</span>
            <span className="pick-stat-v">
              <b>{fmtAvgRange(data?.stats.minPrice, data?.stats.maxPrice)}</b>
            </span>
          </div>
          <div className="pick-stat" title="按最小面积段 × 均价估算，只作筛人用">
            <span className="pick-stat-lb">最低总价门槛</span>
            <span className="pick-stat-v is-amber">
              <b>{data?.stats.minTotal ? data.stats.minTotal + " 万" : "—"}</b>
              <em className="pick-stat-u">起步</em>
            </span>
          </div>
        </div>
        <div className="pick-stats-meta">
          房天下新盘 · 更新于 {fmtStamp(data?.stats.fetchedAt)} · 单价为备案/报价均价，总价按最小面积段 × 均价估算
        </div>
      </div>

      <div className="card-inset pick-filters">
        <div className={"g-input-wrap pick-search" + (keyword ? " has-value" : "")}>
          <span className="input-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            className="g-input"
            type="search"
            placeholder="搜楼盘 / 板块 / 地址 / 开发商（如：亦庄、招商、地铁）"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {keyword ? (
            <button type="button" className="pick-search-clear" aria-label="清空搜索" onClick={() => setKeyword("")}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
        <div className="pick-chipbar">
          {DISTRICTS.map((item) => (
            <button
              key={"d" + item.key}
              type="button"
              className={"pick-chip" + (district === item.key ? " is-active" : "")}
              onClick={() => pickDistrict(item.key)}
            >
              {item.label}
              {item.key ? <span className="pick-chip-n">{countOf(data, item.key)}</span> : null}
            </button>
          ))}
          <span className="pick-gap" />
          <button
            type="button"
            className={"pick-fold" + (adv ? " is-open" : "")}
            aria-expanded={adv}
            aria-controls="pick-adv"
            onClick={() => setAdv(!adv)}
          >
            <span className="pick-fold-ico" aria-hidden="true">
              {adv ? "▾" : "▸"}
            </span>
            筛选
            {advCount ? <span className="pick-fold-n">{advCount}</span> : null}
          </button>
          {filtered ? (
            <button type="button" className="pick-reset" onClick={resetFilters}>
              清空筛选
            </button>
          ) : null}
        </div>
        {adv ? (
          <div className="pick-advbox" id="pick-adv">
            <div className="pick-chipbar">
              {STATUS.map((item) => (
                <button
                  key={"s" + item.key}
                  type="button"
                  className={"pick-chip" + (saleStatus === item.key ? " is-active" : "")}
                  onClick={() => setSaleStatus(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="pick-adv">
              <div className="pick-field pick-field-biz">
                <span className="pick-field-lb">商圈</span>
                <GlassMultiSelect
                  values={bizKeys}
                  options={bizOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
                  onToggle={toggleBizcircle}
                  onClear={() => setBizKeys([])}
                  label={bizLabel}
                  allLabel="不限商圈"
                  ariaLabel="商圈（可多选）"
                />
              </div>
              <div className="pick-field">
                <span className="pick-field-lb">交房截止</span>
                <div className="pick-chipbar">
                  {DELIVERY_CUTOFFS.map((item) => (
                    <button
                      key={"dl" + item.key}
                      type="button"
                      className={"pick-chip" + (deliveryBefore === item.key ? " is-active" : "")}
                      onClick={() => setDeliveryBefore(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pick-field">
                <span className="pick-field-lb">总价预算</span>
                <div className="pick-chipbar">
                  {PRICE_BANDS.map((item) => (
                    <button
                      key={"pb" + item.key}
                      type="button"
                      aria-pressed={item.key ? priceBands.includes(item.key) : priceBands.length === 0}
                      className={
                        "pick-chip" +
                        (item.key
                          ? priceBands.includes(item.key)
                            ? " is-active"
                            : ""
                          : priceBands.length === 0
                            ? " is-active"
                            : "")
                      }
                      onClick={() => togglePriceBand(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pick-foldsum">
            <span className="pick-foldsum-lb">{advCount ? "已筛 " + advCount + " 项" : "未设条件"}</span>
            <span className="pick-foldsum-txt">
              {advSummary || "状态 / 商圈 / 交房截止 / 总价预算都在「筛选」里"}
            </span>
          </div>
        )}
        <div className="pick-chipbar">
          {SORTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={"pick-chip pick-chip-sort" + (sort === item.key ? " is-active" : "")}
              onClick={() => setSort(item.key)}
            >
              {item.label}
            </button>
          ))}
          <span className="pick-gap" />
          <span className="pick-count">
            {loading ? "查询中…" : "命中 " + (data?.total ?? 0) + " 个盘"}
          </span>
        </div>
        {error ? (
          <div className="pick-error">
            接口没通：{error}
            <br />
            服务端 {getServerBase() || "同源 /house-api"}
          </div>
        ) : null}
      </div>

      <div className="pick-split">
        <div className="card-inset pick-list pick-list-wide">
          <div className="table-header pick-row">
            <span>楼盘 / 板块</span>
            <span>户型 · 面积</span>
            <span>均价</span>
            <span>总价门槛</span>
            <span style={{ textAlign: "right" }}>状态 · 开盘 · 交房</span>
            <span aria-hidden="true" />
          </div>
          {items.length === 0 && !loading ? (
            <div className="pick-empty">这组筛选没有楼盘，换个区域或状态看看。</div>
          ) : null}
          {items.map((item) => (
            <button
              key={item.uid}
              type="button"
              className="table-row pick-row pick-item"
              onClick={() => openPickDetail(item.uid)}
            >
              <div className="pick-name">
                <strong>{item.name}</strong>
                <span>
                  {item.district}
                  {item.bizcircle ? " · " + item.bizcircle : ""}
                  {item.ring ? " · " + item.ring : ""}
                </span>
              </div>
              <div className="pick-cell">
                {item.layouts || "—"}
                <span>{fmtArea(item.areaText)}</span>
              </div>
              <div className="pick-cell">
                <b className="n">{fmtAvg(item.priceAvg)}</b>
              </div>
              <div className="pick-cell">
                <b className="n amber">{item.totalPriceFrom ? item.totalPriceFrom + " 万" : "待定"}</b>
              </div>
              <div className="pick-cell pick-tail">
                <span className={"tag-pill pick-status" + statusClass(item.saleStatus)}>{item.saleStatus || "未知"}</span>
                <span>{item.openDate || "开盘待定"}</span>
                <span>{item.deliveryDate ? item.deliveryDate + " 交房" : "交房待定"}</span>
              </div>
              <span className="pick-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function UsedHousePanel({ onBack }: { onBack: () => void }) {
  const todo = [
    { k: "1", t: "成交价库", d: "小区 × 面积段 × 成交总价，链家/贝壳匿名页 + 成交记录" },
    { k: "2", t: "挂牌在售", d: "同小区挂牌价、议价空间、成交周期" },
    { k: "3", t: "通勤与品质", d: "接到现有社区库：通勤耗时 / 品质 25 项 / 购房资格红线" },
  ];
  return (
    <div className="board-split pick-split">
      <div className="card-inset pick-card">
        <div className="pick-title">二手房选房 · 下一期</div>
        <div className="pick-sub">
          现在这一栏只做入口占位：二手房的数据口径（建成小区 + 成交价 + 通勤）已经在社区库里，
          选房页要的是「按预算和通勤筛成交盘」的视图，等成交明细入仓后再开。
        </div>
        <div className="pick-facts" style={{ marginTop: 14 }}>
          {todo.map((row) => (
            <div key={row.k} className="pick-fact">
              <span>{row.k}. {row.t}</span>
              <b>{row.d}</b>
            </div>
          ))}
        </div>
        <div className="pick-actions">
          <button type="button" className="pick-btn is-primary" onClick={onBack}>
            先看新房
          </button>
        </div>
      </div>
      <div className="card-inset pick-card">
        <div className="pick-title">已有底子</div>
        <div className="pick-sub">
          community 表已有小区维度数据：建成年份、物业类型、成交价、议价、成交周期、通勤耗时。
          二手房视图不需要新建表，缺的是「户型面积段 × 成交明细」这一层。
        </div>
        <div className="pick-facts" style={{ marginTop: 14 }}>
          <div className="pick-fact">
            <span>数据表</span>
            <b>community / transactions</b>
          </div>
          <div className="pick-fact">
            <span>接口</span>
            <b>GET /communities · GET /communities/:uid/transactions</b>
          </div>
          <div className="pick-fact">
            <span>当前状态</span>
            <b>成交明细为空（P3 抓数后填）</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function countOf(data: NewProjectListResponse | null, district: string): string {
  const hit = data?.districts?.find((row) => row.district === district);
  return hit ? String(hit.n) : "0";
}
