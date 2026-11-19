/** 选房筛选口径：交房截止、商圈、总价预算。桌面和手机共用这一份，别各写一套。 */

export const DELIVERY_CUTOFFS: Array<{ key: string; label: string }> = [
  { key: "", label: "不限交房" },
  { key: "2026-12-31", label: "2026 年底前" },
  { key: "2027-12-31", label: "2027 年底前" },
  { key: "2028-12-31", label: "2028 年底前" },
  { key: "2029-12-31", label: "2029 年底前" },
];

export interface PriceBand {
  key: string;
  label: string;
  minTotal?: number;
  maxTotal?: number;
}

export const PRICE_BANDS: PriceBand[] = [
  { key: "", label: "不限预算" },
  { key: "u300", label: "300 万以下", maxTotal: 300 },
  { key: "b300500", label: "300–500 万", minTotal: 300, maxTotal: 500 },
  { key: "b500800", label: "500–800 万", minTotal: 500, maxTotal: 800 },
  { key: "a800", label: "800 万以上", minTotal: 800 },
];

/** 选项表里按 key 取 label；空 key（不限/全部）返回空串，不进摘要 */
export function labelOf(rows: Array<{ key: string; label: string }>, key: string): string {
  if (!key) return "";
  const hit = rows.find((row) => row.key === key);
  return hit ? hit.label : "";
}

/** 多选商圈（"区域|商圈" 数组）→ 接口参数：逗号分隔的商圈名 */
export function bizcircleQuery(keys: string[]): string {
  return keys
    .map((key) => key.split("|")[1] ?? "")
    .filter(Boolean)
    .join(",");
}

/** 多选项 → 折叠摘要：一个给名字，两个用顿号，三个以上前两个 + 等 N 个 X */
export function multiSummary(names: string[], noun = "项"): string {
  const list = names.filter(Boolean);
  if (!list.length) return "";
  if (list.length <= 2) return list.join("、");
  return list.slice(0, 2).join("、") + " 等 " + list.length + " 个" + noun;
}

/** 多选商圈 → 折叠摘要 */
export function bizcircleSummary(keys: string[]): string {
  return multiSummary(
    keys.map((key) => key.split("|")[1] ?? ""),
    "商圈",
  );
}

/** 多选预算档 → 折叠摘要（"300–500 万、800 万以上"） */
export function priceSummary(keys: string[]): string {
  return multiSummary(
    keys.map((key) => labelOf(PRICE_BANDS, key)),
    "档",
  );
}

/** 多选预算档 → 接口的 totalRanges：逗号分隔区间，两端可空（-300 / 500-800 / 800-） */
export function totalRanges(keys: string[]): string {
  return keys
    .map((key) => PRICE_BANDS.find((band) => band.key === key))
    .filter((band): band is PriceBand => Boolean(band))
    .map((band) => (band.minTotal ?? "") + "-" + (band.maxTotal ?? ""))
    .join(",");
}

/** 多选商圈 → 触发器文案：0 个给占位，1 个给名字，多个给"N 个商圈" */
export function bizcircleTrigger(keys: string[], placeholder: string): string {
  const names = keys
    .map((key) => key.split("|")[1] ?? "")
    .filter(Boolean);
  if (!names.length) return placeholder;
  if (names.length === 1) return names[0] as string;
  return names.length + " 个商圈";
}

export interface BizcircleOption {
  /** 区域 + 商圈，避免"亦庄"在大兴和通州重名时选错 */
  key: string;
  district: string;
  bizcircle: string;
  label: string;
}

/** 商圈下拉：选了区域就只列该区域的商圈，没选就按"区域·商圈"列全量 */
export function bizcircleOptions(
  rows: Array<{ district: string; bizcircle: string; n: number }> | undefined,
  district: string,
): BizcircleOption[] {
  return (rows ?? [])
    .filter((row) => row.bizcircle && (!district || row.district === district))
    .map((row) => ({
      key: row.district + "|" + row.bizcircle,
      district: row.district,
      bizcircle: row.bizcircle,
      label: (district ? "" : row.district + "·") + row.bizcircle + "（" + row.n + "）",
    }));
}
