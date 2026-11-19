import { useEffect, useState } from "react";
import { fetchNewProjects } from "@/lib/newhouseApi";
import { GlassMultiSelect } from "@/components/GlassSelect";
import { ModeSwitch, type ModeTab } from "@/components/ModeSwitch";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { getServerBase } from "@/lib/serverClient";
import { fmtArea, fmtAvg, statusClass } from "@/lib/newhouseFormat";
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
import { NewProjectDetail, closePickDetail, hashPickUid, openPickDetail } from "@/views/shared/NewProjectDetail";
import type { NewProjectDto, NewProjectListResponse } from "@/lib/newhouseApi";

/**
 * 移动端选房：和桌面同一套进入方式——点楼盘进同一个详情页（#/picks/<uid>），
 * 同一个返回按钮，同一组图标（导轨 🏘️ + 行尾 ›），布局只是收成单列。
 */
type PickMode = "new" | "used";
type SortKey = "default" | "total" | "price" | "open";

const PICK_MODES: [ModeTab<PickMode>, ModeTab<PickMode>] = [
  { value: "new", label: "新房" },
  { value: "used", label: "二手房", badge: "待接入" },
];

const DISTRICTS = [
  { key: "", label: "不限" },
  { key: "大兴", label: "大兴" },
  { key: "通州", label: "通州" },
];

const STATUS = [
  { key: "", label: "全部" },
  { key: "在售", label: "在售" },
  { key: "待售", label: "待售" },
];

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "default", label: "默认" },
  { key: "total", label: "总价低" },
  { key: "price", label: "单价低" },
  { key: "open", label: "新开盘" },
];

export function PkScreen() {
  const [mode, setMode] = useState<PickMode>("new");
  return (
    <>
      <div className="m-nav-header">
        <h1 className="m-nav-title">
          <span className="m-nav-ico" aria-hidden="true">
            🏘️
          </span>
          选房
        </h1>
        <div className="m-nav-actions">
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>大兴 + 通州</span>
        </div>
      </div>

      <ModeSwitch value={mode} onChange={setMode} tabs={PICK_MODES} ariaLabel="选房类型" mobile />

      {mode === "new" ? <MobileNewHouse /> : <MobileUsedHouse onBack={() => setMode("new")} />}
    </>
  );
}

function MobileNewHouse() {
  const [district, setDistrict] = useState("");
  // 商圈用"区域|商圈"存，和大兴/通州的同名商圈区分开
  // 商圈用"区域|商圈"存，避免"亦庄"在大兴和通州重名时选错；可多选
  const [bizKeys, setBizKeys] = useState<string[]>([]);
  const [deliveryBefore, setDeliveryBefore] = useState("");
  // 总价预算是多档并集
  const [priceBands, setPriceBands] = useState<string[]>([]);
  const [saleStatus, setSaleStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [keyword, setKeyword] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<NewProjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 进阶筛选默认收着：手机屏窄，先把区域和一屏楼盘亮出来
  const [adv, setAdv] = useState(false);
  // 详情页由地址栏驱动，和桌面同一个 hash 口径：刷新、返回键、分享都一样
  const [detailUid, setDetailUid] = useState<string | null>(() => hashPickUid());
  useEffect(() => {
    const sync = () => setDetailUid(hashPickUid());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(keyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const bizcircle = bizcircleQuery(bizKeys);
  const bizLabel = bizcircleTrigger(bizKeys, "不限商圈");
  const ranges = totalRanges(priceBands);
  const bizOptions = bizcircleOptions(data?.bizcircles, district);

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

  // 预算多选：空 key 等于"不限预算"
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
      limit: 120,
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

  if (detailUid) {
    return <NewProjectDetail uid={detailUid} onBack={closePickDetail} />;
  }

  const items = data?.items ?? [];

  return (
    <>
      <div className="m-card glass">
        <div className={"g-input-wrap pick-search" + (keyword ? " has-value" : "")}>
          <span className="input-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            className="g-input"
            type="search"
            placeholder="搜楼盘 / 板块 / 开发商"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {keyword ? (
            <button type="button" className="pick-search-clear" aria-label="清空搜索" onClick={() => setKeyword("")}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
        <div className="pick-chipbar" style={{ marginTop: 10 }}>
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
              清空
            </button>
          ) : null}
        </div>
        {adv ? (
          <div className="pick-advbox" id="pick-adv">
            <div className="pick-chipbar" style={{ marginTop: 8 }}>
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
            <div className="pick-bizsel">
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
            <div className="pick-chipbar" style={{ marginTop: 8 }}>
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
            <div className="pick-chipbar" style={{ marginTop: 8 }}>
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
        ) : (
          <div className="pick-foldsum">
            <span className="pick-foldsum-lb">{advCount ? "已筛 " + advCount + " 项" : "未设条件"}</span>
            <span className="pick-foldsum-txt">{advSummary || "状态 / 商圈 / 交房 / 预算点「筛选」"}</span>
          </div>
        )}
        <div className="pick-chipbar" style={{ marginTop: 8 }}>
          {SORTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={"pick-chip" + (sort === item.key ? " is-active" : "")}
              onClick={() => setSort(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11.5, color: "var(--text-dim)" }}>
          <span>{loading ? "查询中…" : "命中 " + (data?.total ?? 0) + " 个盘"}</span>
          <span>在售 {data?.stats.onSale ?? "—"} · 最低总价 {data?.stats.minTotal ? data.stats.minTotal + " 万" : "—"}</span>
        </div>
        {error ? (
          <div className="pick-error">
            接口没通：{error}
            <br />
            服务端 {getServerBase() || "同源 /house-api"}　（真机请用局域网地址打开本页，别写 127.0.0.1）
          </div>
        ) : null}
      </div>

      {items.length === 0 && !loading ? (
        <div className="m-card glass">
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>这组筛选没有楼盘，换个区域或状态看看。</div>
        </div>
      ) : null}

      <div className="pick-mlist">
        {items.map((item) => (
          <ProjectCard key={item.uid} item={item} />
        ))}
      </div>
    </>
  );
}

/** 手机列表卡：整卡可点，进入与桌面完全相同的详情地址。 */
function ProjectCard({ item }: { item: NewProjectDto }) {
  return (
    <button type="button" className="m-card glass pick-mcard" onClick={() => openPickDetail(item.uid)}>
      <div className="pick-mrow">
        <div style={{ minWidth: 0 }}>
          <div className="pick-mname">{item.name}</div>
          <div className="pick-msub">
            {item.district}
            {item.bizcircle ? " · " + item.bizcircle : ""}
            {item.ring ? " · " + item.ring : ""}
          </div>
          <div className="pick-msub">
            {item.layouts || "户型待补"}
            {fmtArea(item.areaText)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="n pick-mprice">{fmtAvg(item.priceAvg)}</div>
          <div className="amber" style={{ fontSize: 12, fontWeight: 700 }}>
            {item.totalPriceFrom ? item.totalPriceFrom + " 万起" : "总价待定"}
          </div>
          <div className="pick-msub">{item.openDate ? item.openDate : "开盘待定"}</div>
        </div>
        <span className="pick-chevron" aria-hidden="true">
          ›
        </span>
      </div>

      <div className="pick-mfoot">
        <span className={"tag-pill pick-status" + statusClass(item.saleStatus)}>{item.saleStatus || "未知"}</span>
        {item.deliveryDate ? <span className="tag-pill">{item.deliveryDate} 交房</span> : null}
        <span className="pick-gap" />
        <span className="pick-mhint">查看详情</span>
      </div>
    </button>
  );
}

function MobileUsedHouse({ onBack }: { onBack: () => void }) {
  return (
    <div className="m-card glass">
      <div style={{ fontSize: 15, fontWeight: 800 }}>二手房选房 · 下一期</div>
      <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 6, lineHeight: 1.7 }}>
        小区维度的底子已经有了（建成年份、物业类型、成交价、议价空间、成交周期、通勤耗时），
        缺的是「户型面积段 × 成交明细」这一层，补齐后这里换成按预算和通勤筛成交盘。
      </p>
      <div className="pick-facts" style={{ marginTop: 10 }}>
        <div className="pick-fact">
          <span>数据表</span>
          <b>community / transactions</b>
        </div>
        <div className="pick-fact">
          <span>接口</span>
          <b>GET /communities</b>
        </div>
        <div className="pick-fact">
          <span>当前状态</span>
          <b>成交明细待抓</b>
        </div>
      </div>
      <div className="pick-actions" style={{ marginTop: 10 }}>
        <button type="button" className="pick-btn is-primary" onClick={onBack}>
          先看新房
        </button>
      </div>
    </div>
  );
}

function countOf(data: NewProjectListResponse | null, district: string): string {
  const hit = data?.districts?.find((row) => row.district === district);
  return hit ? String(hit.n) : "0";
}
