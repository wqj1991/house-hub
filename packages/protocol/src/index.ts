/**
 * 前后端唯一的路由与信封真相。零依赖、零逻辑，只放常量与类型。
 * 纪律（TECH-STACK §3）：路径字符串不允许手写第二遍。
 */

export const API_PREFIX = "/house-api";
export const PROTOCOL_VERSION = 1;

/** 同步集合：只含摘要与本人的写表；成交明细不进同步（ARCHITECTURE §6.6）。 */
export const SYNC_TABLES = [
  "person",
  "anchor",
  "mode",
  "line",
  "stop",
  "community",
  "community_quality",
  "score_rule",
  "route",
  "shortlist",
  "jifen",
  "check_state",
  "app_setting",
  "house",
  "house_score",
  "house_redline",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** 只能在服务端写的表：客户端上送视为非法（ARCHITECTURE §6.5）。 */
export const SERVER_ONLY_TABLES = ["route", "line", "stop", "score_rule"] as const;

export const ApiRoutes = {
  health: "/health",
  /** 账号密码登录：进应用先过这一关，回来的是设备令牌 */
  authLogin: "/auth/login",
  /** 当前这枚设备令牌属于谁：卡片上显示的名字从这里来 */
  authMe: "/auth/me",
  /** 账号头像：data URL 存账号上，手机和 web 看到的是同一张 */
  accountAvatar: "/account/avatar",
  authPair: "/auth/pair",
  authRefresh: "/auth/refresh",
  authRevoke: "/auth/revoke",
  syncPull: "/sync/pull",
  syncPush: "/sync/push",
  communities: "/communities",
  community: "/communities/:uid",
  transactions: "/communities/:uid/transactions",
  /** 新房楼盘（只读事实表）：大兴 / 通州新盘快照，服务端启动时从 core 灌进 new_project */
  newProjects: "/new-projects",
  newProject: "/new-projects/:uid",
  income: "/income",
  incomeMembers: "/income/members",
  incomeMember: "/income/members/:uid",
  incomeSettings: "/income/settings",
  /** 通勤画像：公司地点 + 多条通勤习惯（班车 / 地铁 / 自驾） */
  commute: "/commute",
  commuteOffices: "/commute/offices",
  commuteOffice: "/commute/offices/:uid",
  commuteHabits: "/commute/habits",
  commuteHabit: "/commute/habits/:uid",
  /** 班车线路归属：线路号挂到哪处公司地点 */
  commuteShuttles: "/commute/shuttle-links",
  /** 公司班车线路库（只读）：9 条线 + 54 个上客点，服务端启动时从 core 灌进 line / stop */
  shuttleLines: "/shuttle/lines",
  shuttleLine: "/shuttle/lines/:code",
  shuttleStops: "/shuttle/lines/:code/stops",
  /** 班车通勤整条走法：家→（骑行）→最近上客点→（班车）→公司，含倒推的出门时刻 */
  shuttlePlan: "/shuttle/plan",
  /** 高德地点检索：Key 只在服务端，客户端问这三个口 */
  geoStatus: "/geo/status",
  geoSearch: "/geo/search",
  geoGeocode: "/geo/geocode",
  /** 浏览器画地图必须自己带 Key（JSAPI 就是这么设计的），由这一层下发，前端仓库里不留 Key */
  geoMapConfig: "/geo/map-config",
  /** 路线折线（mode=drive/transit/walk/bike）：服务端算好点串下发，浏览器不碰 restapi（JSAPI 插件会带 s=rsv3 被拒） */
  geoRoute: "/geo/route",
  rules: "/rules",
  communityFill: "/community/fill",
  routeCompute: "/route/compute",
  job: "/jobs/:id",
  internalClaim: "/internal/jobs/claim",
  internalFinish: "/internal/jobs/:id/finish",
} as const;

export type ApiRoute = (typeof ApiRoutes)[keyof typeof ApiRoutes];

export const INTERNAL_TOKEN_HEADER = "x-internal-token";

/** 客户端与服务端共用的错误码；页面据此决定提示文案。 */
export const ErrorCodes = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  badRequest: "bad_request",
  conflict: "conflict",
  clockSkew: "clock_skew",
  ruleVersionMismatch: "rule_version_mismatch",
  internal: "internal",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError {
  code: ErrorCode;
  message: string;
  detail?: unknown;
}

// ── 同步信封（ARCHITECTURE §6.4）────────────────────────────────────

export type RowOp = "upsert" | "delete";

export interface PushItem {
  table: SyncTable;
  uid: string;
  op: RowOp;
  fields: Record<string, unknown>;
  baseRev: number;
  clientTs: string;
}

export interface PullRequest {
  since: number;
  tables?: SyncTable[];
}

export interface PullResponse {
  rev: number;
  rows: Partial<Record<SyncTable, Record<string, unknown>[]>>;
  deleted: Partial<Record<SyncTable, string[]>>;
  more: boolean;
}

export interface PushRequest {
  deviceId: string;
  items: PushItem[];
}

export interface PushApplied {
  uid: string;
  rev: number;
}

export interface PushConflict {
  uid: string;
  winner: "client" | "server";
  rev: number;
  reason: string;
}

export interface PushResponse {
  applied: PushApplied[];
  conflicts: PushConflict[];
  rev: number;
  clockSkewMs?: number;
}

/** 字段所有权表（ARCHITECTURE §6.5）。冲突裁决的实现必须按这张表，不许临时判断。 */
export const FIELD_OWNER = {
  "community.fetched": "server",
  "community.manual": "client",
  "community_quality.manual": "client",
  "community_quality.fetched": "server",
  person: "client",
  anchor: "client",
  mode: "client",
  shortlist: "client",
  check_state: "client",
  app_setting: "client",
  jifen: "client",
  house: "client",
  house_score: "client",
  house_redline: "client",
  route: "server",
  line: "server",
  stop: "server",
  score_rule: "server",
} as const;

export type Owner = (typeof FIELD_OWNER)[keyof typeof FIELD_OWNER];

/** 抓取字段：客户端写这些字段一律丢弃（读写分离）。 */
export const SERVER_OWNED_COMMUNITY_FIELDS = [
  "price",
  "price_tx",
  "price_src_n",
  "tx_n",
  "bargain",
  "cycle_days",
  "lng",
  "lat",
  "build_year",
] as const;