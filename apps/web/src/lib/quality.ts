/** 品质 25 项与权重，合计 78（docs/01-quality.md）。 */
export interface QualityItem {
  key: string;
  label: string;
  weight: number;
}

export const QUALITY_ITEMS: QualityItem[] = [
  { key: "build_year", label: "建成年代", weight: 8 },
  { key: "property_service", label: "物业服务", weight: 7 },
  { key: "school", label: "学区划片", weight: 6 },
  { key: "far", label: "容积率", weight: 5 },
  { key: "parking_ratio", label: "车位比", weight: 5 },
  { key: "spacing", label: "楼间距", weight: 3 },
  { key: "green", label: "绿化率", weight: 3 },
  { key: "elevator", label: "电梯配置", weight: 3 },
  { key: "orientation", label: "塔板结构与朝向", weight: 3 },
  { key: "floor", label: "楼层位置", weight: 3 },
  { key: "layout", label: "户型方正", weight: 3 },
  { key: "efficiency", label: "得房率", weight: 3 },
  { key: "height", label: "层高", weight: 3 },
  { key: "decor", label: "精装交付", weight: 3 },
  { key: "noise", label: "噪音与临街", weight: 3 },
  { key: "metro", label: "地铁距离", weight: 2 },
  { key: "mall", label: "商业配套", weight: 2 },
  { key: "hospital", label: "医疗配套", weight: 2 },
  { key: "park", label: "公园绿地", weight: 2 },
  { key: "safety", label: "治安与人口结构", weight: 2 },
  { key: "liquidity", label: "挂牌流动性", weight: 2 },
  { key: "scale", label: "楼栋户数规模", weight: 2 },
  { key: "storage", label: "收纳与阳台", weight: 1 },
  { key: "leak", label: "渗漏与维修史", weight: 1 },
  { key: "fee", label: "物业费合理性", weight: 1 },
];

export const QUALITY_TOTAL = QUALITY_ITEMS.reduce((s, i) => s + i.weight, 0);
