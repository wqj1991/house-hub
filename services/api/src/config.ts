import { existsSync } from "node:fs";

/** 服务端配置：路径从环境来，不写死进代码（ARCHITECTURE §2 硬边界）。 */
export interface Config {
  host: string;
  port: number;
  dbPath: string;
  internalToken: string;
  logLevel: string;
  version: string;
}

/** Node 24 的 loadEnvFile：有 .env 就加载，没有就当全用默认值。 */
export function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  try {
    process.loadEnvFile(path);
  } catch {
    // .env 写坏了不该拦住启动，缺的值走默认
  }
}

export function loadConfig(): Config {
  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 8787),
    // 线上 /var/lib/house/house.db；本地默认落缓存盘，不写进仓库
    dbPath: process.env.HOUSE_DB_PATH ?? "D:/dsh/cache/house/house.db",
    internalToken: process.env.HOUSE_INTERNAL_TOKEN ?? "dev-internal-token",
    logLevel: process.env.HOUSE_LOG_LEVEL ?? "info",
    version: process.env.npm_package_version ?? "0.1.0",
  };
}
