import { parseClock, type ShuttlePlan } from "./commuteProfile";

/**
 * 公司班车线路库（灵境行 App「线路详情」截图 y01–y09 整理，2026-11-09 抓的一次快照）。
 *
 * 口径：
 * - 一条线路 = 一个方向（全部是早班 am）+ 一串上客点，末端统一到 SHUTTLE_TERMINAL。
 * - stop.depart 是该站发车时刻，route.arrive 是到公司时刻；中间不插停靠时长，差值就是车上时间。
 * - 坐标一律 GCJ-02（高德口径），以后算「家 → 站点」步行/骑行距离直接用。
 * - 这里是「录入后的事实」：服务端启动时会被塞进 line / stop 两张表，前端只读。
 */

export interface ShuttleRouteStop {
  /** 该线路内的上客顺序，从 1 开始 */
  seq: number;
  name: string;
  /** 本站发车时刻 HH:mm */
  depart: string;
  lng: number;
  lat: number;
}

export interface ShuttleRoute {
  /** 线路号，也是 uid：Y01…Y09 */
  code: string;
  /** 走向名，如「东北四环线」 */
  name: string;
  driver: string;
  phone: string;
  plate: string;
  /** 到公司时刻 HH:mm */
  arrive: string;
  stops: ShuttleRouteStop[];
}

export interface ShuttleTerminal {
  name: string;
  lng: number;
  lat: number;
}

/** 9 条线的共同终点：施耐德（北京）中低压电器。 */
export const SHUTTLE_TERMINAL: ShuttleTerminal = {
  name: "施耐德（北京）中低压电器",
  lng: 116.521,
  lat: 39.76,
};

export const SHUTTLE_ROUTES: ShuttleRoute[] = [
  {
    code: "Y01",
    name: "东北四环线",
    driver: "宁五强",
    phone: "15225577088",
    plate: "京B10708D",
    arrive: "07:50",
    stops: [
      { seq: 1, name: "林萃桥地铁", depart: "06:40", lng: 116.3726, lat: 40.022 },
      { seq: 2, name: "北沙滩", depart: "06:50", lng: 116.369, lat: 40.0016 },
      { seq: 3, name: "安徽大厦", depart: "07:00", lng: 116.4162, lat: 39.9881 },
      { seq: 4, name: "居然之家", depart: "07:02", lng: 116.4361, lat: 39.9908 },
      { seq: 5, name: "红领巾桥", depart: "07:14", lng: 116.4875, lat: 39.9228 },
      { seq: 6, name: "窑洼湖", depart: "07:20", lng: 116.4919, lat: 39.8811 },
    ],
  },
  {
    code: "Y02",
    name: "东三环线",
    driver: "赵炬博",
    phone: "17731313397",
    plate: "京B11828D",
    arrive: "08:00",
    stops: [
      { seq: 1, name: "双安", depart: "06:50", lng: 116.3259, lat: 39.9663 },
      { seq: 2, name: "蓟门桥", depart: "06:56", lng: 116.3571, lat: 39.9678 },
      { seq: 3, name: "北太平庄", depart: "07:00", lng: 116.3701, lat: 39.9684 },
      { seq: 4, name: "农展馆", depart: "07:15", lng: 116.4652, lat: 39.9402 },
      { seq: 5, name: "白家庄", depart: "07:18", lng: 116.4619, lat: 39.9266 },
      { seq: 6, name: "双井", depart: "07:25", lng: 116.4625, lat: 39.8935 },
    ],
  },
  {
    code: "Y03",
    name: "六里桥线",
    driver: "冀永山",
    phone: "18310987268",
    plate: "京B12108D",
    arrive: "08:00",
    stops: [
      { seq: 1, name: "石景山华联", depart: "06:35", lng: 116.2181, lat: 39.9061 },
      { seq: 2, name: "莲房桥东", depart: "06:40", lng: 116.2344, lat: 39.8969 },
      { seq: 3, name: "六里桥桥东", depart: "07:05", lng: 116.3153, lat: 39.8873 },
      { seq: 4, name: "甘石桥", depart: "07:10", lng: 116.3355, lat: 39.8892 },
      { seq: 5, name: "马家楼", depart: "07:23", lng: 116.3462, lat: 39.8282 },
      { seq: 6, name: "西马厂", depart: "07:25", lng: 116.3867, lat: 39.8403 },
      { seq: 7, name: "大红门", depart: "07:28", lng: 116.4001, lat: 39.8447 },
    ],
  },
  {
    code: "Y04",
    name: "新朝阳路线",
    driver: "张之欣",
    phone: "15611869982",
    plate: "京B08259D",
    arrive: "07:53",
    stops: [
      { seq: 1, name: "青年路南口", depart: "06:38", lng: 116.5178, lat: 39.9215 },
      { seq: 2, name: "二外", depart: "06:47", lng: 116.5634, lat: 39.9128 },
      { seq: 3, name: "管庄", depart: "06:55", lng: 116.5993, lat: 39.9091 },
      { seq: 4, name: "北苑", depart: "07:02", lng: 116.6372, lat: 39.9037 },
      { seq: 5, name: "梨园", depart: "07:10", lng: 116.6687, lat: 39.8837 },
      { seq: 6, name: "云景里", depart: "07:12", lng: 116.6654, lat: 39.8771 },
      { seq: 7, name: "小稿村", depart: "07:16", lng: 116.6433, lat: 39.8698 },
    ],
  },
  {
    code: "Y05",
    name: "大兴线",
    driver: "倪崇林",
    phone: "13901024589",
    plate: "京B05509D",
    arrive: "08:00",
    stops: [
      { seq: 1, name: "枣园", depart: "07:00", lng: 116.3323, lat: 39.7534 },
      { seq: 2, name: "大兴医院", depart: "07:05", lng: 116.3344, lat: 39.7309 },
      { seq: 3, name: "大兴环岛", depart: "07:15", lng: 116.345, lat: 39.7404 },
      { seq: 4, name: "兴达中学", depart: "07:17", lng: 116.3565, lat: 39.7196 },
      { seq: 5, name: "磁各庄", depart: "07:28", lng: 116.409, lat: 39.7208 },
    ],
  },
  {
    code: "Y06",
    name: "北五环线",
    driver: "张亮善",
    phone: "13811047163",
    plate: "京B17835D",
    arrive: "07:45",
    stops: [
      { seq: 1, name: "天通苑", depart: "06:20", lng: 116.4138, lat: 40.0747 },
      { seq: 2, name: "立水桥", depart: "06:25", lng: 116.4119, lat: 40.053 },
      { seq: 3, name: "仰山桥", depart: "06:30", lng: 116.4035, lat: 40.0222 },
      { seq: 4, name: "望京地铁站", depart: "06:50", lng: 116.4687, lat: 39.9988 },
      { seq: 5, name: "叶青大厦", depart: "06:55", lng: 116.4688, lat: 40.0125 },
      { seq: 6, name: "七棵树", depart: "07:05", lng: 116.534, lat: 39.9699 },
    ],
  },
  {
    code: "Y07",
    name: "定慧桥线",
    driver: "刘鸣",
    phone: "13011803750",
    plate: "京B12825D",
    arrive: "07:45",
    stops: [
      { seq: 1, name: "定慧桥", depart: "06:45", lng: 116.275, lat: 39.9242 },
      { seq: 2, name: "花园桥西南口", depart: "06:50", lng: 116.3101, lat: 39.9292 },
      { seq: 3, name: "右安门", depart: "07:02", lng: 116.3643, lat: 39.8677 },
      { seq: 4, name: "洋桥", depart: "07:09", lng: 116.3853, lat: 39.8572 },
      { seq: 5, name: "刘家窑", depart: "07:12", lng: 116.4221, lat: 39.8576 },
      { seq: 6, name: "方庄", depart: "07:15", lng: 116.4401, lat: 39.8659 },
    ],
  },
  {
    code: "Y08",
    name: "马桥线",
    driver: "李月鹏",
    phone: "13611226658",
    plate: "京B18589D",
    arrive: "07:55",
    stops: [
      { seq: 1, name: "国风美仑南门", depart: "07:30", lng: 116.5848, lat: 39.768 },
      { seq: 2, name: "商业街", depart: "07:40", lng: 116.5552, lat: 39.758 },
      { seq: 3, name: "神龙", depart: "07:42", lng: 116.547, lat: 39.7496 },
      { seq: 4, name: "马驹桥一号桥", depart: "07:50", lng: 116.5455, lat: 39.7482 },
    ],
  },
  {
    code: "Y09",
    name: "瀛海线",
    driver: "张立元",
    phone: "15801496316",
    plate: "京B13766D",
    arrive: "08:00",
    stops: [
      { seq: 1, name: "德茂地铁站", depart: "07:10", lng: 116.4417, lat: 39.7727 },
      { seq: 2, name: "德茂东", depart: "07:14", lng: 116.4443, lat: 39.783 },
      { seq: 3, name: "旧宫", depart: "07:20", lng: 116.4496, lat: 39.8061 },
      { seq: 4, name: "旧宫东口", depart: "07:25", lng: 116.4551, lat: 39.807 },
      { seq: 5, name: "贵园东里", depart: "07:35", lng: 116.484, lat: 39.8 },
      { seq: 6, name: "大雄", depart: "07:40", lng: 116.4945, lat: 39.8016 },
      { seq: 7, name: "上海沙龙", depart: "07:45", lng: 116.4978, lat: 39.7892 },
    ],
  },
];

/** 54 个上客点，加起来对不上就是数据录入漏了站点。 */
export const SHUTTLE_STOP_TOTAL = SHUTTLE_ROUTES.reduce((sum, route) => sum + route.stops.length, 0);

export function findShuttleRoute(code: string): ShuttleRoute | null {
  const key = code.trim().toUpperCase();
  return SHUTTLE_ROUTES.find((route) => route.code === key) ?? null;
}

/** 「Y06 北五环线」——写进习惯里的线路名就是这个格式，前端靠它回认线路。 */
export function shuttleRouteLabel(route: ShuttleRoute): string {
  return route.code + " " + route.name;
}

/** 「Y06 天通苑」——一条微信位置描述就够同事认出来。 */
export function shuttleStopLabel(route: ShuttleRoute, stop: ShuttleRouteStop): string {
  return route.code + " " + stop.name;
}

/** 站点发车到公司的车上时间（分钟）；时刻坏了返 0，不猜。 */
export function shuttleRideMinutes(route: ShuttleRoute, stop: ShuttleRouteStop): number {
  const gone = parseClock(stop.depart);
  const here = parseClock(route.arrive);
  if (gone === null || here === null) return 0;
  return Math.max(0, here - gone);
}

export function shuttleFirstDepart(route: ShuttleRoute): string {
  return route.stops.length > 0 ? route.stops[0].depart : route.arrive;
}

/** 选了「哪条线的哪一站」就得到一条完整的班车腿：线路 / 站点 / 发车 / 到公司 / 司机。 */
export function shuttlePlanFor(route: ShuttleRoute, stop: ShuttleRouteStop): ShuttlePlan {
  return {
    line: shuttleRouteLabel(route),
    stop: stop.name,
    depart: stop.depart,
    arrive: route.arrive,
    seat: "unknown",
    lastReturn: "",
    toGate: true,
    note: "司机 " + route.driver + " " + route.phone + " · " + route.plate,
  };
}

/** 从已保存的习惯反查它落在哪条线上、哪一站；反查不到（自己手填的线路）返 null。 */
export function matchShuttleStop(
  line: string,
  stopName: string,
): { route: ShuttleRoute; stop: ShuttleRouteStop } | null {
  const route = SHUTTLE_ROUTES.find((row) => line.trim().startsWith(row.code)) ?? null;
  if (!route) return null;
  const name = stopName.trim();
  const stop = route.stops.find((row) => row.name === name) ?? null;
  return stop ? { route, stop } : null;
}
