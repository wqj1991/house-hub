import { Hono } from "hono";
import { schema } from "@house/core";
import { ApiRoutes } from "@house/protocol";
import { deviceAuth } from "../auth";
import type { AppEnv } from "../auth";
import type { Db } from "../db";

/**
 * 收入与公积金：数据直接住在服务端。
 * 客户端没有本地副本，界面上的每次增删改都是一次请求，返回值就是最新整份文档 —— 两台设备天然一致。
 */

const ROW_ID = 1;

type Doc = ReturnType<typeof schema.incomeDocSchema.parse>;
type Member = ReturnType<typeof schema.incomeMemberSchema.parse>;

export const EMPTY_INCOME_DOC: Doc = {
  members: [],
  dealWan: 381,
  downRatio: 0.35,
  years: 25,
  second: false,
  family: { hukouBeijing: false, child: false },
};

interface StoredRow {
  doc: string;
  updated_at: string;
}

export function incomeRoutes(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const auth = deviceAuth(db);

  const readRow = (): StoredRow | undefined =>
    db.prepare("select doc, updated_at from income_doc where id = ?").get(ROW_ID) as StoredRow | undefined;

  /** 坏行不至于把接口打挂：解析失败就退回空文档。 */
  const readDoc = (): { doc: Doc; updatedAt: string } => {
    const row = readRow();
    if (!row) return { doc: EMPTY_INCOME_DOC, updatedAt: "" };
    try {
      const parsed = schema.incomeDocSchema.safeParse(JSON.parse(row.doc));
      return { doc: parsed.success ? parsed.data : EMPTY_INCOME_DOC, updatedAt: row.updated_at };
    } catch {
      return { doc: EMPTY_INCOME_DOC, updatedAt: row.updated_at };
    }
  };

  const writeDoc = (doc: Doc): string => {
    const at = new Date().toISOString();
    db.prepare(
      "insert into income_doc (id, doc, updated_at) values (?, ?, ?)" +
        " on conflict(id) do update set doc = excluded.doc, updated_at = excluded.updated_at",
    ).run(ROW_ID, JSON.stringify(doc), at);
    return at;
  };

  const reply = (doc: Doc) => ({ doc, updatedAt: writeDoc(doc) });

  // 整份读 / 整份写：首次接入、导出导入都用这两个
  app.get(ApiRoutes.income, auth, (c) => c.json(readDoc()));

  app.put(ApiRoutes.income, auth, async (c) => {
    const doc = schema.incomeDocSchema.parse(await c.req.json());
    return c.json(reply(doc));
  });

  // 成员：按 uid 覆盖写（新增与编辑同一个口，uid 就是身份）
  app.post(ApiRoutes.incomeMembers, auth, async (c) => {
    const member = schema.incomeMemberSchema.parse(await c.req.json());
    const { doc } = readDoc();
    const rest = doc.members.filter((row: Member) => row.uid !== member.uid);
    return c.json(reply({ ...doc, members: [...rest, member] }));
  });

  app.patch(ApiRoutes.incomeMember, auth, async (c) => {
    const uid = c.req.param("uid");
    const raw = (await c.req.json()) as Record<string, unknown>;
    // partial() 会让带 default 的字段在缺省时回落成默认值，把没传的字段一起改掉；
    // 只保留请求里真正出现的键，才是「改一项就只改一项」。
    const parsed = schema.incomeMemberSchema.partial().parse(raw) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(raw ?? {})) {
      if (key in parsed) patch[key] = parsed[key];
    }
    const { doc } = readDoc();
    if (!doc.members.some((row: Member) => row.uid === uid)) {
      return c.json({ code: "not_found", message: "成员不存在" }, 404);
    }
    const members = doc.members.map((row: Member) => (row.uid === uid ? { ...row, ...patch, uid } : row));
    return c.json(reply({ ...doc, members }));
  });

  app.delete(ApiRoutes.incomeMember, auth, (c) => {
    const uid = c.req.param("uid");
    const { doc } = readDoc();
    if (!doc.members.some((row: Member) => row.uid === uid)) {
      return c.json({ code: "not_found", message: "成员不存在" }, 404);
    }
    return c.json(reply({ ...doc, members: doc.members.filter((row: Member) => row.uid !== uid) }));
  });

  // 测算参数：总价、首付比例、年限、首套/二套，来一项改一项
  app.patch(ApiRoutes.incomeSettings, auth, async (c) => {
    const patch = schema.incomeSettingsSchema.parse(await c.req.json());
    const { doc } = readDoc();
    return c.json(reply({ ...doc, ...patch }));
  });

  return app;
}
