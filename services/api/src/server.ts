import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { ErrorCodes } from "@house/protocol";
import { loadConfig, loadDotEnv } from "./config";
import { createLogger } from "./logger";
import { openDb } from "./db";
import type { AppEnv } from "./auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { communityRoutes } from "./routes/communities";
import { ruleRoutes } from "./routes/rules";
import { jobRoutes } from "./routes/jobs";

loadDotEnv();
const cfg = loadConfig();
const log = createLogger(cfg.logLevel);
const db = openDb(cfg.dbPath);

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

app.route("/", healthRoutes(db, cfg.version));
app.route("/", authRoutes(db, cfg.internalToken));
app.route("/", syncRoutes(db));
app.route("/", communityRoutes(db));
app.route("/", ruleRoutes(db));
app.route("/", jobRoutes(db, cfg.internalToken));

const server = serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port }, (info) => {
  log.info({ host: cfg.host, port: info.port, db: cfg.dbPath }, "house-api listening");
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
