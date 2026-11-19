import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { ZodError } from "zod";
import { API_PREFIX, ErrorCodes } from "@house/protocol";
import { loadConfig, loadDotEnv } from "./config";
import { createLogger } from "./logger";
import { openDb } from "./db";
import { ensureDefaultAccount } from "./account";
import type { AppEnv } from "./auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { commuteRoutes, ensureDefaultShuttleBindings } from "./routes/commute";
import { geoRoutes } from "./routes/geo";
import { shuttleRoutes } from "./routes/shuttle";
import { ensureShuttleSeed } from "./shuttleSeed";
import { ensureNewProjectSeed } from "./newProjectSeed";
import { incomeRoutes } from "./routes/income";
import { communityRoutes } from "./routes/communities";
import { newProjectRoutes } from "./routes/newProjects";
import { ruleRoutes } from "./routes/rules";
import { jobRoutes } from "./routes/jobs";

loadDotEnv();
const cfg = loadConfig();
const log = createLogger(cfg.logLevel);
const db = openDb(cfg.dbPath);
// 班车线路库是事实数据：每次启动按 core 快照对齐，改了数据重启即生效
const shuttleSeed = ensureShuttleSeed(db);
// 默认 9 条线挂到「施耐德」那处公司地点下；只补从没归属过的线路
const shuttleBind = ensureDefaultShuttleBindings(db);
// 新房快照同理：抓数产物入仓，重抓一次重启即生效
const projectSeed = ensureNewProjectSeed(db);
// 默认账号：库里没有就建（admin / Wynnyo@19910102），有就不动密码
const adminSeed = ensureDefaultAccount(db, cfg.adminUser, cfg.adminPass);

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const started = Date.now();
  await next();
  log.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - started }, "http");
});

// 同源部署走 openresty，不经过 CORS；这里只给本机直连调试留门。
app.use("*", cors({ origin: (origin) => origin ?? "*", credentials: true }));

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ code: ErrorCodes.badRequest, message: "参数不合法", detail: err.issues }, 400);
  }
  log.error({ err }, "unhandled");
  return c.json({ code: ErrorCodes.internal, message: err.message }, 500);
});

/** 业务路由只挂一次，下面按两种前缀各挂一遍。 */
const routes = new Hono<AppEnv>();
routes.route("/", healthRoutes(db, cfg.version));
routes.route("/", authRoutes(db, cfg.internalToken, cfg.pairKey, cfg.adminUser));
routes.route("/", syncRoutes(db));
routes.route("/", incomeRoutes(db));
routes.route("/", commuteRoutes(db));
routes.route("/", geoRoutes(db, { key: cfg.amapKey, city: cfg.amapCity }));
routes.route("/", shuttleRoutes(db));
routes.route("/", communityRoutes(db));
routes.route("/", newProjectRoutes(db));
routes.route("/", ruleRoutes(db));
routes.route("/", jobRoutes(db, cfg.internalToken));

/**
 * 户型图 / 封面图（48MB 级快照）：只放服务端，前端包里不再带（APK 因此回到个位数 MB）。
 * 文件名带楼盘 uid，内容一改就换名，故一周长缓存；图片不敏感，不挂令牌（<img> 也带不了 Authorization）。
 * serveStatic 的 root 只认相对 cwd 的路径，cwd 可能是仓库根也可能是 services/api，这里算一次。
 */
const MEDIA_ROOT = relative(process.cwd(), fileURLToPath(new URL("../assets", import.meta.url)));
const media = serveStatic({ root: MEDIA_ROOT, rewriteRequestPath: (p) => p.replace(API_PREFIX, "") });
for (const prefix of ["", API_PREFIX]) {
  for (const dir of ["huxing", "covers"]) {
    app.use(`${prefix}/${dir}/*`, async (c, next) => {
      c.header("cache-control", "public, max-age=604800");
      await next();
    }, media);
  }
}

app.route("/", routes);
// 客户端把反代前缀写进 base 时请求会带 /house-api，线上 openresty 会 rewrite 掉，
// 直连 api 端口没这层，这里同名再挂一份，两种前缀都通。
app.route(API_PREFIX, routes);

const server = serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port }, (info) => {
  log.info(
    {
      host: cfg.host,
      port: info.port,
      db: cfg.dbPath,
      amap: cfg.amapKey ? "on" : "off",
      shuttle: shuttleSeed.lines + " 条线 / " + shuttleSeed.stops + " 站",
      shuttleChanged: shuttleSeed.changed,
      shuttleBound: shuttleBind.bound,
      shuttleOffice: shuttleBind.office || "none",
      newProjects: projectSeed.total + " 个盘 / 变更 " + projectSeed.changed + " / 下架 " + projectSeed.removed,
      admin: adminSeed.username + (adminSeed.created ? "（新建）" : "（已存在）"),
    },
    "house-api listening",
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info({ signal }, "shutting down");
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}