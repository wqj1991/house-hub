import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepo } from "@house/data";
import type { DbStatus } from "@house/core";
import { DEMO_ROWS, toRow, type Row } from "./demo";

export interface Dataset {
  loading: boolean;
  error: string | null;
  status: DbStatus | null;
  rows: Row[];
  /** true = 库里没有村子，正在用示例口径 */
  demo: boolean;
  shortKeys: string[];
  shortRows: Row[];
  refresh: () => void;
  add: (row: Row) => void;
  remove: (row: Row) => void;
}

export function useDataset(): Dataset {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [shortKeys, setShortKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const repo = getRepo();
    Promise.all([repo.status(), repo.searchCommunities("", 100), repo.listShortlist()])
      .then(([st, list, short]) => {
        if (!alive) return;
        setStatus(st);
        setError(null);
        const mapped = list.map(toRow);
        setRows(mapped.length > 0 ? mapped : DEMO_ROWS);
        setShortKeys(short.map((c) => c.uid));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setRows(DEMO_ROWS);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const demo = useMemo(() => rows.length > 0 && rows.every((r) => r.id == null), [rows]);

  const add = useCallback(
    (row: Row) => {
      setShortKeys((keys) => (keys.includes(row.key) ? keys : [...keys, row.key]));
      if (row.id != null) void getRepo().addShortlist(row.id);
    },
    [],
  );

  const remove = useCallback((row: Row) => {
    setShortKeys((keys) => keys.filter((k) => k !== row.key));
    if (row.id != null) void getRepo().removeShortlist(row.id);
  }, []);

  const shortRows = useMemo(() => {
    if (shortKeys.length === 0) return rows.slice(0, 2);
    return rows.filter((r) => shortKeys.includes(r.key));
  }, [rows, shortKeys]);

  return { loading, error, status, rows, demo, shortKeys, shortRows, refresh, add, remove };
}
