/** 房屋打分卡：一份房源 = 一行；加权分不落库，改权重不重刷全表。 */
export interface House {
  id: number;
  communityUid: string;
  label: string;
  /** 挂牌总价（万元） */
  listed: number;
  /** 成交 / 预计成交价（万元） */
  deal: number;
  /** 建筑面积（㎡） */
  area: number;
  downRatio: number;
  rate: number;
  years: number;
  /** 家庭税后月收入（元） */
  income: number;
  /** 装修与家电预算（万元） */
  renovation: number;
  /** 预计月租金（元） */
  rent: number;
  /** 物业费（元/㎡·月） */
  feePerSqm: number;
  parking: number;
  /** 楼层朝向修正，0.02 = +2% */
  floorAdj: number;
  decorAdj: number;
  /** 近 3 月成交均价（元/㎡）；空则用本套单价 */
  compUnit: number | null;
}

export type HouseInput = Omit<House, "id"> & { id?: number };

export interface HouseDetail {
  house: House;
  scores: { itemKey: string; score: number }[];
  redlines: string[];
}
