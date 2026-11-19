/**
 * 新房楼盘（在售 / 待售的新盘）——与二手房小区 community 是两套口径：
 * 新房是"期房+备案均价+开盘时间"，二手房是"建成小区+成交价+通勤"。
 * 字段来自抓数，服务端是唯一写者（同 community.fetched 的归属约定）。
 */
export interface NewProjectFact {
  /** 稳定主键：`fs-<房天下数据 id>`，跨次抓取不变，入库幂等靠它 */
  uid: string;
  name: string;
  /** 大兴 / 通州 */
  district: string;
  /** 商圈或板块，如"亦庄""瀛海" */
  bizcircle: string;
  address: string;
  /** 环线位置，如"五至六环" */
  ring: string;
  /** 备案/报价均价（元/㎡）；价格待定的新盘为 null */
  priceAvg: number | null;
  /** 抓到的原始价格文案，如"51000元/㎡(单价)"、"价格待定" */
  priceText: string;
  /** 总价门槛（万元/套起），没有就是 null */
  totalPriceFrom: number | null;
  /** 在售 / 待售 / 售罄 */
  saleStatus: string;
  /** 物业类别，如"普通住宅""别墅" */
  propertyType: string;
  /** 营销标签：品牌地产 / 低密居所 / 地铁沿线… */
  tags: string[];
  /** 户型，如"三居 / 四居" */
  layouts: string;
  /** 面积段，如"77~125平米" */
  areaText: string;
  phone: string;
  image: string;
  /** 最新开盘时间（YYYY-MM-DD，可能为空） */
  openDate: string;
  /** 预计交房时间 */
  deliveryDate: string;
  developer: string;
  decoration: string;
  buildingType: string;
  ownership: string;
  salesAddress: string;
  /** 原文详情页，方便点回源核对 */
  sourceUrl: string;
  /** 抓取时间（ISO） */
  fetchedAt: string;
}

/** 单张户型：源页户型卡上的那一格。 */
export interface NewProjectFloorPlan {
  /** 户型标题：房天下相册的图片 alt，如"111平户型（偶数层）"；详情页那条给的是"3室2厅1厨2卫" */
  name: string;
  /** 几室几厅几厨几卫，如"4室2厅1厨2卫"；取不到就是空串 */
  layout: string;
  /** 建筑面积（㎡），源页没标就是 null */
  area: number | null;
  /** 卖点标签：户型方正 / 动静分离 / 南北通透… */
  tags: string[];
  /** 户型图路径（/huxing/<uid>-<n>.jpg）：文件在服务端 assets/huxing，前端用 mediaUrl 拼地址 */
  image: string;
  /** 房天下户型图直链（640px），本地图缺失时兜底 */
  imageRemote: string;
  /** 户型测评图（/huxing/<uid>-d<户型id>-cp.jpg）：带房间面积与空间评价的彩图；源页没有就是空串 */
  reviewImage: string;
  /** 源站户型详情页，点回去核对 */
  sourceUrl: string;
}

/**
 * 详情页才需要的事实：地图落点 + 户型清单。
 * 由 scripts/extract-newhouse-detail.mjs 从房天下详情页抽出来单独成快照（newhouseDetail.ts），
 * 免得每次重抓列表都把这两块大字段覆盖掉。
 */
export interface NewProjectDetailFact {
  /** 经度，GCJ-02（高德坐标系）；房天下给的是 BD-09，脚本已换算 */
  lng: number | null;
  /** 纬度，GCJ-02 */
  lat: number | null;
  /** 户型清单，抓不到就空数组 */
  floorPlans: NewProjectFloorPlan[];
}

/** 新房列表的筛选口径：区域 + 在售状态 + 关键词。 */
export interface NewProjectFilter {
  district?: string;
  saleStatus?: string;
  q?: string;
}
