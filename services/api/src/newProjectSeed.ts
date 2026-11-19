import { NEW_PROJECT_DETAILS, NEW_PROJECTS } from "@house/core";
import type { NewProjectDetailFact, NewProjectFact } from "@house/core";
import { nextRev } from "./db";
import type { Db } from "./db";

/**
 * 新房快照按 uid 幂等入库，跟 shuttleSeed 一个套路：
 * 快照是唯一真相，库里多出来的（这次没抓到的）标 deleted_at，不物理删。
 * 只动 source='fang' 的行，别人灌的种子不归这里管。
 */
export function ensureNewProjectSeed(db: Db): { total: number; changed: number; removed: number } {
  const rows = db
    .prepare("select uid, fetched_at, lng, lat, floor_plans from new_project where deleted_at is null")
    .all() as {
    uid: string;
    fetched_at: string | null;
    lng: number | null;
    lat: number | null;
    floor_plans: string | null;
  }[];
  const seen = new Set(rows.map((r) => r.uid));
  const stored = new Map(rows.map((r) => [r.uid, r]));

  const insert = db.prepare(
    "insert into new_project (" + COLUMNS.join(", ") + ") values (" + COLUMNS.map((c) => "@" + c).join(", ") + ")",
  );
  const update = db.prepare(
    "update new_project set " +
      COLUMNS.filter((c) => c !== "uid")
        .map((c) => c + " = @" + c)
        .join(", ") +
      ", deleted_at = null where uid = @uid",
  );
  const tombstone = db.prepare("update new_project set deleted_at = datetime('now') where uid = ? and deleted_at is null");

  let changed = 0;
  let removed = 0;
  const keep = new Set<string>();

  db.transaction(() => {
    for (const fact of NEW_PROJECTS) {
      keep.add(fact.uid);
      const params = seedRow(fact);
      if (seen.has(fact.uid)) {
        // 列表快照没变、详情（坐标/户型）也没变，才是真的没变，不白抬版本号；
        // 详情是另一份快照（newhouseDetail.ts），单跑抽取脚本时 fetchedAt 不会动
        const row = stored.get(fact.uid);
        if (
          row &&
          row.fetched_at === fact.fetchedAt &&
          row.lng === params.lng &&
          row.lat === params.lat &&
          (row.floor_plans ?? null) === (params.floor_plans ?? null)
        ) {
          continue;
        }
        update.run({ ...params, rev: nextRev(db) });
      } else {
        insert.run({ ...params, rev: nextRev(db) });
      }
      changed++;
    }
    for (const uid of seen) {
      if (keep.has(uid)) continue;
      tombstone.run(uid);
      removed++;
    }
  })();

  return { total: NEW_PROJECTS.length, changed, removed };
}

const COLUMNS = [
  "uid",
  "name",
  "district",
  "bizcircle",
  "address",
  "ring",
  "price_avg",
  "price_text",
  "total_price_from",
  "sale_status",
  "property_type",
  "tags",
  "layouts",
  "area_text",
  "phone",
  "image",
  "open_date",
  "delivery_date",
  "developer",
  "decoration",
  "building_type",
  "ownership",
  "sales_address",
  "source_url",
  "fetched_at",
  "lng",
  "lat",
  "floor_plans",
  "rev",
] as const;

function seedRow(f: NewProjectFact): Record<string, unknown> {
  // 详情快照单独一份（户型/坐标），列表快照里没有它们
  const detail: NewProjectDetailFact | undefined = NEW_PROJECT_DETAILS[f.uid];
  return {
    uid: f.uid,
    name: f.name,
    district: f.district,
    bizcircle: f.bizcircle || null,
    address: f.address || null,
    ring: f.ring || null,
    price_avg: f.priceAvg,
    price_text: f.priceText || null,
    total_price_from: f.totalPriceFrom,
    sale_status: f.saleStatus || null,
    property_type: f.propertyType || null,
    tags: JSON.stringify(f.tags ?? []),
    layouts: f.layouts || null,
    area_text: f.areaText || null,
    phone: f.phone || null,
    image: f.image || null,
    open_date: f.openDate || null,
    delivery_date: f.deliveryDate || null,
    developer: f.developer || null,
    decoration: f.decoration || null,
    building_type: f.buildingType || null,
    ownership: f.ownership || null,
    sales_address: f.salesAddress || null,
    source_url: f.sourceUrl || null,
    fetched_at: f.fetchedAt || null,
    lng: detail?.lng ?? null,
    lat: detail?.lat ?? null,
    floor_plans: detail?.floorPlans?.length ? JSON.stringify(detail.floorPlans) : null,
  };
}
