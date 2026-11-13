import type { RowOp, SyncTable } from "@house/protocol";

/**
 * 写队列。浏览器没有 SQLite，断网时的写操作先入 IndexedDB，联网后按顺序重放
 * （ARCHITECTURE §3、§6.4）。手写 IDB，不引 Dexie（TECH-STACK §7）。
 */
export interface OutboxItem {
  seq?: number;
  table: SyncTable;
  uid: string;
  op: RowOp;
  fields: Record<string, unknown>;
  baseRev: number;
  clientTs: string;
}

const DB_NAME = "house-outbox";
const DB_VERSION = 1;
const STORE = "items";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function all(): Promise<OutboxItem[]> {
  return tx<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
}

export const outbox = {
  async enqueue(item: OutboxItem): Promise<void> {
    await tx("readwrite", (s) => s.add(item) as IDBRequest<IDBValidKey>);
  },

  async peekAll(limit = 200): Promise<OutboxItem[]> {
    const rows = await all();
    return rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)).slice(0, limit);
  },

  async ack(uids: string[]): Promise<void> {
    if (uids.length === 0) return;
    const rows = await all();
    const hit = new Set(uids);
    await Promise.all(
      rows.filter((r) => hit.has(r.uid)).map((r) => tx("readwrite", (s) => s.delete(r.seq as number) as IDBRequest<undefined>)),
    );
  },

  async size(): Promise<number> {
    return tx<number>("readonly", (s) => s.count() as IDBRequest<number>);
  },
};
