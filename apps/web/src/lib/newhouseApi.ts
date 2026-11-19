import { api } from "@house/data";
import { ApiRoutes } from "@house/protocol";
import { bootServer } from "./serverClient";

/**
 * 新房选房的只读接口：楼盘来自抓数快照（services/api/src/newProjectSeed.ts），
 * 前端只做筛选和排序参数，筛选口径留一份在服务端，客户端不复制业务规则。
 */

export interface NewProjectDto {
  uid: string;
  name: string;
  district: string;
  bizcircle: string | null;
  address: string | null;
  ring: string | null;
  priceAvg: number | null;
  priceText: string | null;
  totalPriceFrom: number | null;
  saleStatus: string | null;
  propertyType: string | null;
  tags: string[];
  layouts: string | null;
  areaText: string | null;
  phone: string | null;
  image: string | null;
  openDate: string | null;
  deliveryDate: string | null;
  developer: string | null;
  decoration: string | null;
  buildingType: string | null;
  ownership: string | null;
  salesAddress: string | null;
  sourceUrl: string | null;
  /** 地图落点（GCJ-02，高德坐标系）；没匹配到就是 null，页面不出地图卡 */
  lng: number | null;
  lat: number | null;
  /** 户型清单，抓不到就是空数组 */
  floorPlans: NewProjectFloorPlanDto[];
  fetchedAt: string | null;
  rev: number;
}

/** 一张户型：名称、建面、卖点、本地图 + 远程兜底。 */
export interface NewProjectFloorPlanDto {
  name: string;
  layout: string;
  area: number | null;
  tags: string[];
  image: string;
  imageRemote: string;
  /** 本地户型测评图；源页没有就是空串 */
  reviewImage: string;
  sourceUrl: string;
}

export interface NewProjectListResponse {
  items: NewProjectDto[];
  /** 命中筛选的条数 */
  total: number;
  /** 全库条数（不受筛选影响） */
  all: number;
  stats: {
    onSale: number;
    waiting: number;
    avgPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    minTotal: number | null;
    fetchedAt: string | null;
  };
  districts: Array<{ district: string; n: number }>;
  /** 商圈清单（区域 + 商圈 + 盘数），全量返回，前端按区域筛 */
  bizcircles: Array<{ district: string; bizcircle: string; n: number }>;
}

export interface NewProjectQuery {
  district?: string;
  /** 商圈（板块），如"亦庄""黄村""运河" */
  bizcircle?: string;
  saleStatus?: string;
  q?: string;
  sort?: "default" | "price" | "priceDesc" | "total" | "open";
  /** 交房截止：YYYY-MM-DD，"不晚于这一天交房" */
  deliveryBefore?: string;
  /** 总价门槛区间（万）——单区间，保留兼容 */
  minTotal?: number;
  maxTotal?: number;
  /** 总价多档（万）：逗号分隔区间，两端可空（-300 / 500-800 / 800-），多档取并集 */
  totalRanges?: string;
  /** 单价区间（元/㎡） */
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export async function fetchNewProjects(query: NewProjectQuery = {}): Promise<NewProjectListResponse> {
  await bootServer();
  const qs = new URLSearchParams();
  if (query.district) qs.set("district", query.district);
  if (query.bizcircle) qs.set("bizcircle", query.bizcircle);
  if (query.saleStatus) qs.set("saleStatus", query.saleStatus);
  if (query.q) qs.set("q", query.q);
  if (query.sort) qs.set("sort", query.sort);
  if (query.deliveryBefore) qs.set("deliveryBefore", query.deliveryBefore);
  if (query.minTotal !== undefined) qs.set("minTotal", String(query.minTotal));
  if (query.maxTotal !== undefined) qs.set("maxTotal", String(query.maxTotal));
  if (query.totalRanges) qs.set("totalRanges", query.totalRanges);
  if (query.minPrice !== undefined) qs.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) qs.set("maxPrice", String(query.maxPrice));
  if (query.limit) qs.set("limit", String(query.limit));
  const tail = qs.toString();
  return api<NewProjectListResponse>(ApiRoutes.newProjects + (tail ? "?" + tail : ""));
}

export function fetchNewProject(uid: string): Promise<NewProjectDto> {
  return api<NewProjectDto>(ApiRoutes.newProject.replace(":uid", encodeURIComponent(uid)));
}
