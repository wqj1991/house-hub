import type { PullResponse, SyncTable } from "@house/protocol";

/**
 * Web 端的本地快照：没有 SQLite，pull 回来的行落 IndexedDB，页面刷新后仍在。
 * 与 outbox 分开两个库：outbox 只放未上送的写，快照只放服务器已确认的行。
 */
const DB_NAME = "house-snapshot";
const DB_VERSION = 1;
const STORE = "rows";

export interface SnapRow {
  k: string;
  table: string;
  row: Record<string, unknown>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "k" });
        store.createIndex("byTable", "table");
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

const keyOf = (table: string, uid: string) => table + ":" + uid;

export const snapshot = {
  /** 一页 pull 落库：upsert 每行 + 删除墓碑对应键。返回写入行数。 */
  async savePage(page: PullResponse): Promise<number> {
    const db = await openDb();
    let n = 0;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      const store = t.objectStore(STORE);
      for (const [table, rows] of Object.entries(page.rows)) {
        for (const row of rows ?? []) {
          const uid = typeof row.uid === "string" ? row.uid : null;
          if (!uid) continue;
          store.put({ k: keyOf(table, uid), table, row } satisfies SnapRow);
          n += 1;
        }
      }
      for (const [table, uids] of Object.entries(page.deleted)) {
        for (const uid of uids ?? []) {
          store.delete(keyOf(table, uid));
          n += 1;
        }
      }
      t.oncomplete = () => {
        db.close();
        resolve();
      };
      t.onerror = () => {
        db.close();
        reject(t.error);
      };
    });
    return n;
  },

  async rows(table: SyncTable): Promise<Record<string, unknown>[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, "readonly");
      const req = t.objectStore(STORE).index("byTable").getAll(table);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as SnapRow[]).map((r) => r.row));
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  },

  async count(): Promise<number> {
    return tx<number>("readonly", (s) => s.count() as IDBRequest<number>);
  },
};
