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
  authPair: "/auth/pair",
  authRefresh: "/auth/refresh",
  authRevoke: "/auth/revoke",
  syncPull: "/sync/pull",
  syncPush: "/sync/push",
  communities: "/communities",
  community: "/communities/:uid",
  transactions: "/communities/:uid/transactions",
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
