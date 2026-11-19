import { existsSync, readFileSync } from "node:fs";

/** 仓库根的 package.json 是版本唯一真值（scripts/version.mjs 往下同步）；读不到就返回空串。 */
function pkgVersion(): string {
  try {
    const url = new URL("../../../package.json", import.meta.url);
    const j = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
    return j.version ?? "";
  } catch {
    return "";
  }
}

/** 服务端配置：路径从环境来，不写死进代码（ARCHITECTURE §2 硬边界）。 */
export interface Config {
  host: string;
  port: number;
  dbPath: string;
  internalToken: string;
  /** 长期配对密钥：手机端填这一条就能换设备令牌，省掉每 10 分钟出一次的 6 位码。空＝只能用配对码。 */
  pairKey: string;
  /** 默认账号：库里没这个用户名时启动即建；已存在则不动（改密码不会被启动覆盖）。 */
  adminUser: string;
  adminPass: string;
  /** 高德 Web 服务 Key：只在服务端用，客户端永远拿不到；留空＝地点检索不可用 */
  amapKey: string;
  /** 高德默认城市：地点检索的 city 缺省值，请求里可以覆盖 */
  amapCity: string;
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
    pairKey: process.env.HOUSE_PAIR_KEY ?? "",
    // 默认账号 admin / Wynnyo@19910102：HOUSE_ADMIN_USER、HOUSE_ADMIN_PASS 可覆盖
    adminUser: (process.env.HOUSE_ADMIN_USER ?? "admin").trim() || "admin",
    adminPass: process.env.HOUSE_ADMIN_PASS ?? "Wynnyo@19910102",
    // 沿用 house / luohu 两个老项目的变量名 AMAP_KEY，同一台机器不必写两份
    amapKey: (process.env.HOUSE_AMAP_KEY ?? process.env.AMAP_KEY ?? "").trim(),
    amapCity: (process.env.HOUSE_AMAP_CITY ?? "北京").trim() || "北京",
    logLevel: process.env.HOUSE_LOG_LEVEL ?? "info",
    // systemd 直跑 tsx 时没有 npm_package_version，读仓库根 package.json（version.mjs 的唯一真值），
    // 否则 /health 会一直报旧版本号。
    version: process.env.HOUSE_VERSION ?? process.env.npm_package_version ?? pkgVersion(),
  };
}
