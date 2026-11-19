import { Hono } from "hono";
import { ApiRoutes, ErrorCodes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";
import { newProjectDto } from "../wire";

const MAX_LIMIT = 300;
const SORTS: Record<string, string> = {
  // 默认：在售优先，其次总价门槛低的在前，没价格的兜底到最后
  default:
    "case sale_status when '在售' then 0 when '待售' then 1 else 2 end," +
    " case when total_price_from is null then 1 else 0 end, total_price_from asc, name collate nocase",
  price: "case when price_avg is null then 1 else 0 end, price_avg asc, name collate nocase",
  priceDesc: "case when price_avg is null then 1 else 0 end, price_avg desc, name collate nocase",
  total: "case when total_price_from is null then 1 else 0 end, total_price_from asc, name collate nocase",
  open: "case when ifnull(open_date,'') = '' then 1 else 0 end, open_date asc, name collate nocase",
};

/** 数字型查询参数：空串和非法值一律当"没传"，别让 NaN 进 SQL */
function num(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * 新房选房只读接口。数据来自抓数快照（newProjectSeed），这里不做写命令：
 * 选房是"看盘 + 挑盘"，用户的选择留在 shortlist，不落在楼盘表上。
 *
 * 筛选口径（区域 / 商圈 / 状态 / 交房截止 / 总价区间 / 单价区间 / 关键词）
 * 只在这里实现一份，前端传参、不复制判断逻辑。
 */
export function newProjectRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  app.get(ApiRoutes.newProjects, auth, (c) => {
    const district = (c.req.query("district") ?? "").trim();
    // 商圈支持多选：逗号分隔（bizcircle=亦庄,运河），去空去重
    const bizcircles = Array.from(
      new Set(
        (c.req.query("bizcircle") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    );
    const saleStatus = (c.req.query("saleStatus") ?? "").trim();
    const q = (c.req.query("q") ?? "").trim();
    // 交房截止：传 YYYY-MM-DD（如 2026-12-31），意思是"不晚于这一天交房"
    const deliveryBefore = (c.req.query("deliveryBefore") ?? "").trim();
    const minTotal = num(c.req.query("minTotal"));
    const maxTotal = num(c.req.query("maxTotal"));
    // 总价多档：逗号分隔区间，两端可空（-300、500-800、800-），多档取并集
    const totalRanges = (c.req.query("totalRanges") ?? "")
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const [lo, hi] = raw.split("-");
        return { lo: num(lo ?? ""), hi: num(hi ?? "") };
      })
      .filter((range) => range.lo !== null || range.hi !== null);
    const minPrice = num(c.req.query("minPrice"));
    const maxPrice = num(c.req.query("maxPrice"));
    const sort = SORTS[c.req.query("sort") ?? ""] ?? SORTS.default;
    const rawLimit = Number(c.req.query("limit") ?? MAX_LIMIT);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : MAX_LIMIT, 1), MAX_LIMIT);

    const conditions: string[] = ["deleted_at is null"];
    const args: Array<string | number> = [];

    if (q) {
      const like = "%" + q + "%";
      conditions.push(
        "(name like ? or ifnull(bizcircle,'') like ? or ifnull(address,'') like ? or ifnull(developer,'') like ?)",
      );
      args.push(like, like, like, like);
    }
    if (district) {
      conditions.push("district = ?");
      args.push(district);
    }
    if (bizcircles.length) {
      conditions.push("ifnull(bizcircle,'') in (" + bizcircles.map(() => "?").join(",") + ")");
      args.push(...bizcircles);
    }
    if (saleStatus) {
      conditions.push("sale_status = ?");
      args.push(saleStatus);
    }
    if (deliveryBefore) {
      // "待定" 和空值没有可比性，明确排除，别让它们混进"截止 2027"里
      conditions.push("ifnull(delivery_date,'') not in ('', '待定') and delivery_date <= ?");
      args.push(deliveryBefore);
    }
    if (minTotal !== null) {
      conditions.push("total_price_from is not null and total_price_from >= ?");
      args.push(minTotal);
    }
    if (maxTotal !== null) {
      conditions.push("total_price_from is not null and total_price_from <= ?");
      args.push(maxTotal);
    }
    if (totalRanges.length) {
      const clauses: string[] = [];
      for (const range of totalRanges) {
        const bits: string[] = ["total_price_from is not null"];
        if (range.lo !== null) {
          bits.push("total_price_from >= ?");
          args.push(range.lo);
        }
        if (range.hi !== null) {
          bits.push("total_price_from <= ?");
          args.push(range.hi);
        }
        clauses.push("(" + bits.join(" and ") + ")");
      }
      conditions.push("(" + clauses.join(" or ") + ")");
    }
    if (minPrice !== null) {
      conditions.push("price_avg is not null and price_avg >= ?");
      args.push(minPrice);
    }
    if (maxPrice !== null) {
      conditions.push("price_avg is not null and price_avg <= ?");
      args.push(maxPrice);
    }

    const where = " from new_project where " + conditions.join(" and ");

    const rows = db
      .prepare("select *" + where + " order by " + sort + " limit ?")
      .all(...args, limit) as Record<string, unknown>[];

    // 命中集合的统计（不受 limit 影响），前端 KPI 直接用，别在浏览器里再算一遍
    const agg = db
      .prepare(
        "select count(*) as n," +
          " sum(case when sale_status = '在售' then 1 else 0 end) as on_sale," +
          " sum(case when sale_status = '待售' then 1 else 0 end) as waiting," +
          " cast(avg(case when price_avg > 0 then price_avg end) as integer) as avg_price," +
          " min(case when price_avg > 0 then price_avg end) as min_price," +
          " max(price_avg) as max_price," +
          " min(case when total_price_from > 0 then total_price_from end) as min_total," +
          " max(fetched_at) as fetched_at" +
          where,
      )
      .get(...args) as Record<string, unknown>;

    const districts = db
      .prepare(
        "select district, count(*) as n from new_project where deleted_at is null group by district order by n desc",
      )
      .all() as { district: string; n: number }[];

    // 商圈清单：全量给前端，选了区域时前端自己筛，切区域不用再打一次请求
    const bizcircleRows = db
      .prepare(
        "select district, ifnull(bizcircle,'') as bizcircle, count(*) as n from new_project" +
          " where deleted_at is null group by district, bizcircle order by n desc",
      )
      .all() as { district: string; bizcircle: string; n: number }[];

    const all = db.prepare("select count(*) as n from new_project where deleted_at is null").get() as { n: number };

    return c.json({
      items: rows.map(newProjectDto),
      total: Number(agg?.n ?? 0),
      all: Number(all?.n ?? 0),
      stats: {
        onSale: Number(agg?.on_sale ?? 0),
        waiting: Number(agg?.waiting ?? 0),
        avgPrice: agg?.avg_price === null || agg?.avg_price === undefined ? null : Number(agg.avg_price),
        minPrice: agg?.min_price === null || agg?.min_price === undefined ? null : Number(agg.min_price),
        maxPrice: agg?.max_price === null || agg?.max_price === undefined ? null : Number(agg.max_price),
        minTotal: agg?.min_total === null || agg?.min_total === undefined ? null : Number(agg.min_total),
        fetchedAt: agg?.fetched_at ?? null,
      },
      districts,
      bizcircles: bizcircleRows,
    });
  });

  app.get(ApiRoutes.newProject, auth, (c) => {
    const uid = c.req.param("uid");
    const row = db
      .prepare("select * from new_project where (uid = ? or cast(id as text) = ?) and deleted_at is null")
      .get(uid, uid);
    if (!row) return c.json({ code: ErrorCodes.notFound, message: "楼盘不存在" }, 404);
    return c.json(newProjectDto(row as Record<string, unknown>));
  });

  return app;
}
