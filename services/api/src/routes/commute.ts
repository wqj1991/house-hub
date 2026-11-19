import { Hono } from "hono";
import { SHUTTLE_ROUTES, schema } from "@house/core";
import { ApiRoutes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

/**
 * 通勤画像：公司地点 + 多条通勤习惯（班车 / 地铁 / 自驾）。
 * 与收入同构——数据直接住服务端，客户端没有本地副本，每次增删改都是一次请求，
 * 返回值就是最新整份文档，两台设备天然一致。
 */

const ROW_ID = 1;

type Doc = ReturnType<typeof schema.commuteDocSchema.parse>;
type Office = ReturnType<typeof schema.officeLocationSchema.parse>;
type Habit = ReturnType<typeof schema.commuteHabitSchema.parse>;
type Binding = ReturnType<typeof schema.shuttleBindingSchema.parse>;

export const EMPTY_COMMUTE_DOC: Doc = { offices: [], habits: [], shuttles: [] };

/** 默认线路（core 快照里那 9 条）默认挂到名字含这个字样的公司地点下。 */
const DEFAULT_SHUTTLE_OFFICE = "施耐德";
const DEFAULT_SHUTTLE_CODES = SHUTTLE_ROUTES.map((route) => route.code);

function officeMatchText(office: Office): string {
  return office.name + " " + office.poiName + " " + office.address;
}

/**
 * 默认归属：core 里那 9 条线路，凡是「从来没有归属记录」的，一律挂到施耐德那处公司下。
 * 记录一旦存在就是用户的决定（哪怕 officeUid 是空串＝故意未分配），这里绝不覆盖。
 * 找不到名字含「施耐德」的公司地点时原样返回——公司还没录，没法挂。
 */
function withDefaultShuttleBindings(doc: Doc): { doc: Doc; bound: number } {
  const office = doc.offices.find((row: Office) => officeMatchText(row).includes(DEFAULT_SHUTTLE_OFFICE));
  if (!office) return { doc, bound: 0 };
  const known = new Set(doc.shuttles.map((row: Binding) => row.code));
  const missing = DEFAULT_SHUTTLE_CODES.filter((code) => !known.has(code));
  if (!missing.length) return { doc, bound: 0 };
  const shuttles: Binding[] = [...doc.shuttles, ...missing.map((code) => ({ code, officeUid: office.uid }))];
  return { doc: { ...doc, shuttles }, bound: missing.length };
}

interface StoredRow {
  doc: string;
  updated_at: string;
}

/** 主用方案全局唯一：写进来的这条标了 primary，就把别的摘掉。 */
function withPrimary(doc: Doc, habit: Habit): Doc {
  const habits = doc.habits.map((row: Habit) => (row.uid === habit.uid ? habit : { ...row, primary: habit.primary ? false : row.primary }));
  return { ...doc, habits };
}

/**
 * 地点必须来自高德：poiId + 坐标是唯一凭据，手填地址一律拒掉，
 * 否则后面按坐标算通勤时长时根本定位不了。
 */
function geoProblem(office: Office): string | null {
  if (!office.poiId) return "请从高德搜索结果里选中一处地点";
  if (!Number.isFinite(office.lng) || !Number.isFinite(office.lat)) return "地点坐标不合法，请重新选择";
  if (office.lng === 0 && office.lat === 0) return "地点缺少坐标，请重新选择";
  return null;
}

export function commuteRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  const readRow = (): StoredRow | undefined =>
    db.prepare("select doc, updated_at from commute_doc where id = ?").get(ROW_ID) as StoredRow | undefined;

  /** 坏行不至于把接口打挂：解析失败就退回空文档。 */
  const readDoc = (): { doc: Doc; updatedAt: string } => {
    const row = readRow();
    if (!row) return { doc: EMPTY_COMMUTE_DOC, updatedAt: "" };
    try {
      const parsed = schema.commuteDocSchema.safeParse(JSON.parse(row.doc));
      return { doc: parsed.success ? parsed.data : EMPTY_COMMUTE_DOC, updatedAt: row.updated_at };
    } catch {
      return { doc: EMPTY_COMMUTE_DOC, updatedAt: row.updated_at };
    }
  };

  const writeDoc = (doc: Doc): string => {
    const at = new Date().toISOString();
    db.prepare(
      "insert into commute_doc (id, doc, updated_at) values (?, ?, ?)" +
        " on conflict(id) do update set doc = excluded.doc, updated_at = excluded.updated_at",
    ).run(ROW_ID, JSON.stringify(doc), at);
    return at;
  };

  const reply = (doc: Doc) => ({ doc, updatedAt: writeDoc(doc) });

  // 整份读 / 整份写：首次接入、导出导入都用这两个
  app.get(ApiRoutes.commute, auth, (c) => c.json(readDoc()));

  app.put(ApiRoutes.commute, auth, async (c) => {
    const doc = schema.commuteDocSchema.parse(await c.req.json());
    // 整份写（导入 / 迁移）同样不能带进没有高德凭据的地点
    for (const office of doc.offices) {
      const problem = geoProblem(office);
      if (problem) return c.json({ code: "geo_required", message: "公司地点「" + office.name + "」：" + problem }, 400);
    }
    // 归属指向了不存在的公司就落成「未分配」，别把脏 uid 存进库
    const known = new Set(doc.offices.map((office: Office) => office.uid));
    const shuttles = doc.shuttles.map((row: Binding) => (row.officeUid && !known.has(row.officeUid) ? { ...row, officeUid: "" } : row));
    return c.json(reply({ ...doc, shuttles }));
  });

  // 公司地点：按 uid 覆盖写（新增与编辑同一个口）
  app.post(ApiRoutes.commuteOffices, auth, async (c) => {
    const office = schema.officeLocationSchema.parse(await c.req.json());
    const problem = geoProblem(office);
    if (problem) return c.json({ code: "geo_required", message: problem }, 400);
    const { doc } = readDoc();
    const rest = doc.offices.filter((row: Office) => row.uid !== office.uid);
    // 首次录入「施耐德」这处公司地点时，默认线路顺手归位
    const { doc: next } = withDefaultShuttleBindings({ ...doc, offices: [...rest, office] });
    return c.json(reply(next));
  });

  app.patch(ApiRoutes.commuteOffice, auth, async (c) => {
    const uid = c.req.param("uid");
    const raw = (await c.req.json()) as Record<string, unknown>;
    // 同收入：partial() 会把没传的字段补成默认值，只保留请求里真正出现的键
    const parsed = schema.officeLocationSchema.partial().parse(raw) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(raw ?? {})) {
      if (key in parsed) patch[key] = parsed[key];
    }
    const { doc } = readDoc();
    if (!doc.offices.some((row: Office) => row.uid === uid)) {
      return c.json({ code: "not_found", message: "公司地点不存在" }, 404);
    }
    const offices = doc.offices.map((row: Office) => (row.uid === uid ? { ...row, ...patch, uid } : row));
    const merged = offices.find((row: Office) => row.uid === uid);
    const problem = merged ? geoProblem(merged) : null;
    if (problem) return c.json({ code: "geo_required", message: problem }, 400);
    return c.json(reply({ ...doc, offices }));
  });

  app.delete(ApiRoutes.commuteOffice, auth, (c) => {
    const uid = c.req.param("uid");
    const { doc } = readDoc();
    if (!doc.offices.some((row: Office) => row.uid === uid)) {
      return c.json({ code: "not_found", message: "公司地点不存在" }, 404);
    }
    // 删公司时把只指向它的习惯恢复成「通用」，别让习惯指向一个不存在的 uid
    const habits = doc.habits.map((row: Habit) => (row.officeUid === uid ? { ...row, officeUid: "" } : row));
    // 班车归属同理：线路本身留着（车和站点还是真实资产），只把归属摘成「未分配」
    const shuttles = doc.shuttles.map((row: Binding) => (row.officeUid === uid ? { ...row, officeUid: "" } : row));
    return c.json(reply({ offices: doc.offices.filter((row: Office) => row.uid !== uid), habits, shuttles }));
  });

  // 通勤习惯：同样按 uid 覆盖写；primary 全局唯一
  app.post(ApiRoutes.commuteHabits, auth, async (c) => {
    const habit = schema.commuteHabitSchema.parse(await c.req.json());
    const { doc } = readDoc();
    const rest = doc.habits.filter((row: Habit) => row.uid !== habit.uid);
    return c.json(reply(withPrimary({ ...doc, habits: [...rest, habit] }, habit)));
  });

  app.patch(ApiRoutes.commuteHabit, auth, async (c) => {
    const uid = c.req.param("uid");
    const raw = (await c.req.json()) as Record<string, unknown>;
    const parsed = schema.commuteHabitSchema.partial().parse(raw) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(raw ?? {})) {
      if (key in parsed) patch[key] = parsed[key];
    }
    const { doc } = readDoc();
    const current = doc.habits.find((row: Habit) => row.uid === uid);
    if (!current) {
      return c.json({ code: "not_found", message: "通勤习惯不存在" }, 404);
    }
    const merged = { ...current, ...patch, uid } as Habit;
    return c.json(reply(withPrimary(doc, merged)));
  });

  app.delete(ApiRoutes.commuteHabit, auth, (c) => {
    const uid = c.req.param("uid");
    const { doc } = readDoc();
    if (!doc.habits.some((row: Habit) => row.uid === uid)) {
      return c.json({ code: "not_found", message: "通勤习惯不存在" }, 404);
    }
    return c.json(reply({ ...doc, habits: doc.habits.filter((row: Habit) => row.uid !== uid) }));
  });

  // 班车归属：一条线路挂到某处公司（officeUid 传空串＝取消归属）
  app.post(ApiRoutes.commuteShuttles, auth, async (c) => {
    const link = schema.shuttleBindingSchema.parse(await c.req.json());
    const { doc } = readDoc();
    if (link.officeUid && !doc.offices.some((row: Office) => row.uid === link.officeUid)) {
      return c.json({ code: "not_found", message: "公司地点不存在，先录公司地点再挂班车" }, 404);
    }
    const shuttles: Binding[] = [];
    let done = false;
    for (const row of doc.shuttles) {
      if (row.code !== link.code) {
        shuttles.push(row);
        continue;
      }
      if (!done) {
        shuttles.push(link);
        done = true;
      }
    }
    if (!done) shuttles.push(link);
    return c.json(reply({ ...doc, shuttles }));
  });

  return app;
}

/**
 * 线路被删掉时顺手清掉它的归属：直接操作 commute_doc 那一行，
 * 免得班车路由还要 import 通勤路由的闭包状态。
 */
export function unbindShuttle(db: Db, code: string): void {
  const row = db.prepare("select doc from commute_doc where id = ?").get(ROW_ID) as { doc: string } | undefined;
  if (!row) return;
  let doc: Doc;
  try {
    const parsed = schema.commuteDocSchema.safeParse(JSON.parse(row.doc));
    if (!parsed.success) return;
    doc = parsed.data;
  } catch {
    return;
  }
  const upper = code.toUpperCase();
  if (!doc.shuttles.some((item) => item.code === upper)) return;
  const next = { ...doc, shuttles: doc.shuttles.filter((item) => item.code !== upper) };
  db.prepare("update commute_doc set doc = ?, updated_at = ? where id = ?").run(JSON.stringify(next), new Date().toISOString(), ROW_ID);
}

/**
 * 启动时把默认线路的归属补齐（老库升级 / 首次接入都走这里）。
 * 返回补了几条、挂到了哪处公司，日志里能看出是不是已经归位。
 */
export function ensureDefaultShuttleBindings(db: Db): { bound: number; office: string } {
  const row = db.prepare("select doc from commute_doc where id = ?").get(ROW_ID) as { doc: string } | undefined;
  if (!row) return { bound: 0, office: "" };
  let doc: Doc;
  try {
    const parsed = schema.commuteDocSchema.safeParse(JSON.parse(row.doc));
    if (!parsed.success) return { bound: 0, office: "" };
    doc = parsed.data;
  } catch {
    return { bound: 0, office: "" };
  }
  const { doc: next, bound } = withDefaultShuttleBindings(doc);
  if (!bound) return { bound: 0, office: "" };
  const officeUid = next.shuttles.find((item) => item.code === DEFAULT_SHUTTLE_CODES[0])?.officeUid ?? "";
  const office = next.offices.find((item: Office) => item.uid === officeUid);
  db.prepare("update commute_doc set doc = ?, updated_at = ? where id = ?").run(JSON.stringify(next), new Date().toISOString(), ROW_ID);
  return { bound, office: office ? office.name : "" };
}
