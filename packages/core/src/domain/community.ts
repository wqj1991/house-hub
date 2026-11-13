/** 小区：抓取字段与人工字段分开（ARCHITECTURE §6.5）。金额单位元/㎡，时间 ISO 8601 UTC。 */
export interface Community {
  uid: string;
  /** 本地句柄；跨端只认 uid。 */
  id?: number;
  name: string;
  district: string;
  bizcircle: string | null;
  lng: number;
  lat: number;
  buildYear: number | null;
  buildType: string | null;
  propertyType: string | null;
  /** 挂牌单价（元/㎡） */
  price: number | null;
  /** 成交单价（元/㎡） */
  priceTx: number | null;
  priceSrcN: number | null;
  /** 议价空间（比例） */
  bargain: number | null;
  cycleDays: number | null;
  txN: number | null;
  online: boolean | null;
  address: string | null;
  tags: string[];
  source: string | null;
  fetchedAt: string | null;
  rev: number;
}

/** 品质分项：存原始值 + 来源 + 抓取时间，1–5 分由 scoring 现算（ADR-0004）。 */
export interface QualityRow {
  itemKey: string;
  valueNum: number | null;
  valueText: string | null;
  source: string | null;
  fetchedAt: string | null;
}
