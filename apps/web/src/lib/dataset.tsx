import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useDataset } from "./useDataset";
import type { Dataset } from "./useDataset";

const DatasetContext = createContext<Dataset | null>(null);

/** 全仓只读一次库：Provider 挂在根上，各页共享同一份 rows / 待选池。 */
export function DatasetProvider({ children }: { children: ReactNode }) {
  const value = useDataset();
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDatasetCtx(): Dataset {
  const value = useContext(DatasetContext);
  if (!value) throw new Error("useDatasetCtx 必须在 DatasetProvider 内使用");
  return value;
}
