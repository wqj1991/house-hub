import type { HouseRepo } from "./repo";
import { LocalRepo } from "./local";
import { RemoteRepo } from "./remote";

export type { HouseRepo } from "./repo";
export { LocalRepo } from "./local";
export { RemoteRepo, api, configureApi, setUnauthorizedHandler } from "./remote";
export { outbox } from "./outbox";
export { SyncEngine, getRev, setRev, deviceId } from "./sync";

/** 判定只在这一处：Tauri 里有 IPC 就用本地库，浏览器里就用 HTTP。 */
export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let repo: HouseRepo | null = null;

export function getRepo(): HouseRepo {
  if (!repo) repo = inTauri ? new LocalRepo() : new RemoteRepo();
  return repo;
}

/** 仅供测试与「切换后端」调试用。 */
export function setRepo(next: HouseRepo): void {
  repo = next;
}
