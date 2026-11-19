import { z } from "zod";

/** 前后端共用 DTO 校验（TECH-STACK §7 数据类型约定：时间 ISO 字符串、金额元整数、布尔 0/1）。 */

const iso = z.string().min(1);

export const communitySchema = z.object({
  uid: z.string().min(1),
  id: z.number().int().optional(),
  name: z.string().min(1),
  district: z.string(),
  bizcircle: z.string().nullable(),
  lng: z.number(),
  lat: z.number(),
  buildYear: z.number().int().nullable(),
  buildType: z.string().nullable(),
  propertyType: z.string().nullable(),
  price: z.number().nullable(),
  priceTx: z.number().nullable(),
  priceSrcN: z.number().int().nullable(),
  bargain: z.number().nullable(),
  cycleDays: z.number().int().nullable(),
  txN: z.number().int().nullable(),
  online: z.boolean().nullable(),
  address: z.string().nullable(),
  tags: z.array(z.string()),
  source: z.string().nullable(),
  fetchedAt: iso.nullable(),
  rev: z.number().int(),
});

export const qualityRowSchema = z.object({
  itemKey: z.string().min(1),
  valueNum: z.number().nullable(),
  valueText: z.string().nullable(),
  source: z.string().nullable(),
  fetchedAt: iso.nullable(),
});

export const houseInputSchema = z.object({
  id: z.number().int().optional(),
  communityUid: z.string().min(1),
  label: z.string().min(1),
  listed: z.number(),
  deal: z.number(),
  area: z.number(),
  downRatio: z.number(),
  rate: z.number(),
  years: z.number(),
  income: z.number(),
  renovation: z.number(),
  rent: z.number(),
  feePerSqm: z.number(),
  parking: z.number(),
  floorAdj: z.number(),
  decorAdj: z.number(),
  compUnit: z.number().nullable(),
});

/** 一个家庭成员的收支画像；金额一律元，年限可带小数。 */
export const incomeMemberSchema = z.object({
  uid: z.string().min(1).max(64),
  name: z.string().max(40).default(""),
  relation: z.enum(["self", "spouse", "child", "parent", "other"]),
  monthlyNet: z.number().min(0).max(10000000),
  bonusAnnual: z.number().min(0).max(100000000).default(0),
  hfMonthly: z.number().min(0).max(1000000).default(0),
  hfBalance: z.number().min(0).max(100000000).default(0),
  hfYears: z.number().min(0).max(60).default(0),
  hfState: z.enum(["active", "paused", "none"]).default("active"),
  hfInBeijing: z.boolean().default(true),
});

/** 收入与公积金整份文档：成员 + 组合贷测算参数（服务端一行存一份）。 */
export const incomeDocSchema = z.object({
  members: z.array(incomeMemberSchema).max(20),
  dealWan: z.number().min(0).max(100000),
  downRatio: z.number().min(0).max(0.9),
  years: z.number().int().min(1).max(30),
  second: z.boolean(),
  /** 家庭条件（北京户籍 / 二孩及以上）；房子的条件等算房贷时再填。缺省全 false，兼容旧数据 */
  family: z
    .object({
      hukouBeijing: z.boolean().default(false),
      child: z.boolean().default(false),
    })
    .default({ hukouBeijing: false, child: false }),
});

/** 只改测算参数的那半边（成员走 /income/members）。 */
export const incomeSettingsSchema = incomeDocSchema.omit({ members: true }).partial();

export type IncomeDocDto = z.infer<typeof incomeDocSchema>;
export type IncomeMemberDto = z.infer<typeof incomeMemberSchema>;

/** 班车那一条腿：线路 / 站点 / 发车 / 末班，全部可选，空串表示没填。 */
export const shuttlePlanSchema = z.object({
  line: z.string().max(40).default(""),
  stop: z.string().max(40).default(""),
  depart: z.string().max(5).default(""),
  arrive: z.string().max(5).default(""),
  seat: z.enum(["reserved", "firstCome", "unknown"]).default("unknown"),
  lastReturn: z.string().max(5).default(""),
  toGate: z.boolean().default(true),
  note: z.string().max(200).default(""),
});

/** 一处公司 / 园区：到岗时刻是硬约束。 */
export const officeLocationSchema = z.object({
  uid: z.string().min(1).max(64),
  /** 用户自己的叫法，默认填高德返回的 POI 名 */
  name: z.string().min(1).max(60),
  address: z.string().max(160).default(""),
  /** 高德 POI / 提示 id：地点「确实来自高德」的凭据，手填地址给不出它 */
  poiId: z.string().max(64).default(""),
  /** 高德原始名称：用户改名后仍能看出选的是哪栋楼 */
  poiName: z.string().max(80).default(""),
  /** 高德坐标（GCJ-02，六位小数）；以后算通勤时长、直线距离都靠它 */
  lng: z.number().min(-180).max(180).default(0),
  lat: z.number().min(-90).max(90).default(0),
  city: z.string().max(40).default(""),
  district: z.string().max(40).default(""),
  adcode: z.string().max(12).default(""),
  beIn: z.string().max(5).default("09:00"),
  daysPerWeek: z.number().min(0).max(7).default(5),
  note: z.string().max(200).default(""),
});

/** 一条通勤习惯：同一处公司可以有多条（班车 / 地铁 / 自驾各一条）。 */
export const commuteHabitSchema = z.object({
  uid: z.string().min(1).max(64),
  label: z.string().max(40).default(""),
  /** 走法：公共交通 / 公司班车 / 步行 / 电动自行车；老数据的 metro·bus·drive·bike 统一收拢 */
  vehicle: z
    .preprocess(
      (value) => {
        const legacy: Record<string, string> = { metro: "transit", bus: "transit", drive: "transit", bike: "ebike" };
        return typeof value === "string" && legacy[value] ? legacy[value] : value;
      },
      z.enum(["transit", "shuttle", "walk", "ebike"]),
    )
    .default("transit"),
  minutes: z.number().min(0).max(600),
  departHome: z.string().max(5).default(""),
  arriveWork: z.string().max(5).default(""),
  daysPerWeek: z.number().min(0).max(7).default(5),
  primary: z.boolean().default(false),
  officeUid: z.string().max(64).default(""),
  /** 这条习惯是谁的：对应家庭成员 uid；空串＝全家通用 */
  memberUid: z.string().max(64).default(""),
  /** 家 → 公交/地铁站（公共交通）或 家 → 班车上车点（公司班车） */
  accessHome: z.enum(["walk", "ebike"]).default("walk"),
  /** 出站 → 公司；只有公共交通用得上 */
  accessWork: z.enum(["walk", "ebike"]).default("walk"),
  shuttle: shuttlePlanSchema.nullable().default(null),
  note: z.string().max(200).default(""),
});

/** 班车线路归属：线路号 → 公司地点 uid（线路本体在 line / stop 表，这里只存归属）。 */
export const shuttleBindingSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[A-Za-z][0-9]{1,3}$/, "线路号形如 Y06")
    .transform((value) => value.toUpperCase()),
  officeUid: z.string().max(64).default(""),
});

export type ShuttleBindingDto = z.infer<typeof shuttleBindingSchema>;

/** 通勤画像整份文档：公司地点 + 通勤习惯 + 班车归属（服务端一行存一份）。 */
export const commuteDocSchema = z.object({
  offices: z.array(officeLocationSchema).max(10),
  habits: z.array(commuteHabitSchema).max(20),
  shuttles: z.array(shuttleBindingSchema).max(40).default([]),
});

export type CommuteDocDto = z.infer<typeof commuteDocSchema>;
export type OfficeLocationDto = z.infer<typeof officeLocationSchema>;
export type CommuteHabitDto = z.infer<typeof commuteHabitSchema>;

/** 班车维护：一条线路（uid 就是线路号，如 Y06；line 表没有独立 code 列）。 */
export const shuttleLineInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[A-Za-z][0-9]{1,3}$/, "线路号形如 Y06")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(40),
  /** 司机姓名；电话单列，入库时拼成「姓名 电话」塞 line.driver */
  driver: z.string().trim().max(20).default(""),
  phone: z.string().trim().max(20).default(""),
  plate: z.string().trim().max(16).default(""),
  /** 到公司（工厂）时刻 */
  arrive: z.string().trim().max(5).default(""),
  active: z.boolean().default(true),
});

/** 线路部分更新：只改传上来的字段（partial 会把没传的补成默认值，路由层按 raw 键挑）。 */
export const shuttleLinePatchSchema = shuttleLineInputSchema.omit({ code: true }).partial();

/** 一个上客点。坐标留空表示还没定位（0,0），不挡保存。 */
export const shuttleStopInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  depart: z.string().trim().max(5).default(""),
  lng: z.number().min(-180).max(180).default(0),
  lat: z.number().min(-90).max(90).default(0),
});

/** 站点整条替换：增删、排序都是一次提交，服务端按顺序重排 seq。 */
export const shuttleStopsInputSchema = z.object({
  stops: z.array(shuttleStopInputSchema).max(40),
});

export type ShuttleLineInputDto = z.infer<typeof shuttleLineInputSchema>;
export type ShuttleStopInputDto = z.infer<typeof shuttleStopInputSchema>;


export const pullQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  tables: z.string().optional(),
});

export const pushBodySchema = z.object({
  deviceId: z.string().min(1),
  items: z
    .array(
      z.object({
        table: z.string().min(1),
        uid: z.string().min(1),
        op: z.enum(["upsert", "delete"]),
        fields: z.record(z.string(), z.unknown()),
        baseRev: z.number().int().min(0).default(0),
        clientTs: z.string().min(1),
      }),
    )
    .max(500),
});

export type CommunityDTO = z.infer<typeof communitySchema>;
export type HouseInputDTO = z.infer<typeof houseInputSchema>;