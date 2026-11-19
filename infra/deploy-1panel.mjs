#!/usr/bin/env node
/**
 * house-hub 服务器发布（走 1Panel HTTP API —— 这台机器 SSH 22 外网不可达）。
 *
 *   node infra/deploy-1panel.mjs                # 构建 → 打包 → 上传 → 补数据 → 切链 → 重启 → 自检
 *   node infra/deploy-1panel.mjs --skip-build   # 用现有 apps/web/dist
 *   node infra/deploy-1panel.mjs --no-data      # 只发代码，不动线上库
 *   node infra/deploy-1panel.mjs --restart      # 只重启服务
 *   node infra/deploy-1panel.mjs --with-web     # 顺带把 dist 同步到 nginx 静态目录（默认不碰反代/静态）
 *
 * 服务器侧布局（沿用 20261116-0820 那次）：
 *   /opt/house-hub/{current,releases,incoming,logs,api.env}
 *   /var/lib/house/house.db                     house-api 的唯一库
 *   /opt/1panel/apps/openresty/openresty/www/house/   前端静态（nginx root /www，base=/house/）
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NODE, api, shell, upload } from "./1panel.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = new Set(process.argv.slice(2));

const BASE = process.env.HOUSE_BASE ?? "/opt/house-hub";
const WEB_ROOT = process.env.HOUSE_WEB_ROOT ?? "/opt/1panel/apps/openresty/openresty/www/house";
const SERVICE = process.env.HOUSE_API_SERVICE ?? "house-hub-api";
const REMOTE_DB = process.env.HOUSE_REMOTE_DB ?? "/var/lib/house/house.db";
// 端口以远端 api.env 为准（现网 8766），脚本里不再写死
const HEALTH = "H=$(curl -s -m 3 http://127.0.0.1:$(grep -E '^PORT=' /opt/house-hub/api.env | cut -d= -f2)/health || true)";
const LOCAL_DB = process.env.HOUSE_DB_PATH ?? "D:/dsh/cache/house/house.db";
const KEEP = Number(process.env.HOUSE_KEEP ?? 4);
const CRON_ID = Number(process.env.HOUSE_CRON_ID ?? 2);

const stamp = new Date(Date.now() + 8 * 3600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14).replace(/^(\d{8})(\d{6})$/, "$1-$2");
const TARBALL = "house-hub-" + stamp + ".tgz";
const DBFILE = "house-" + stamp + ".db";

const log = (...a) => console.log(...a);
const posix = (p) => p.replace(/\\/g, "/");
const step = (n, s) => console.log("\n== " + n + " " + s);

function sh(cmd) {
  const r = spawnSync("bash", ["-c", cmd], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error("命令失败（" + r.status + "）：" + cmd);
}

function healthLocal(base) {
  const r = spawnSync("bash", ["-c", "curl -s -m 5 " + base + "/house-api/health"], { encoding: "utf8" });
  return r.stdout?.trim() || "";
}

async function main() {
  if (argv.has("--restart")) {
    step(1, "只重启 " + SERVICE);
    log(await shell(["systemctl restart " + SERVICE, "sleep 1", HEALTH, "echo $H"].join("\n"), { cronId: CRON_ID }));
    return;
  }

  if (!argv.has("--skip-build")) {
    step(1, "本地构建（服务器不装构建链）");
    sh("pnpm install --frozen-lockfile");
    sh("pnpm build");
  }
  const dist = path.join(ROOT, "apps/web/dist/index.html");
  if (!fs.existsSync(dist)) throw new Error("缺 apps/web/dist，先跑 pnpm build");

  // GitHub Actions 只发代码与页面，绝不导入数据库：数据同步一律本机手动执行。
  // 需要破例时显式设 HOUSE_ALLOW_DATA_IN_CI=1（正常发版不要设）。
  const ciNoData = process.env.GITHUB_ACTIONS === "true" && process.env.HOUSE_ALLOW_DATA_IN_CI !== "1";

  let snapshot = null;
  if (ciNoData) {
    log("CI 环境：跳过数据库导入（不读本地库、不上传 .db、不覆盖线上库）");
  } else if (!argv.has("--no-data")) {
    step(2, "本地库一致性快照（VACUUM INTO，WAL 下也稳）");
    snapshot = path.join(os.tmpdir(), DBFILE);
    const code = [
      "const { DatabaseSync } = require('node:sqlite');",
      "const fs = require('node:fs');",
      "try { fs.unlinkSync(process.argv[1]); } catch {}",
      "const db = new DatabaseSync(process.argv[2]);",
      "db.exec(\"VACUUM INTO '\" + process.argv[1] + \"'\");",
      "db.close();",
      "const c = new DatabaseSync(process.argv[1]);",
      "const ok = c.prepare('pragma integrity_check').get().integrity_check;",
      "const n = c.prepare('select count(*) c from new_project').get().c;",
      "const rev = c.prepare('select rev from sync_counter').get().rev;",
      "console.log('snapshot ok=' + ok + ' new_project=' + n + ' rev=' + rev + ' bytes=' + fs.statSync(process.argv[1]).size);",
      "if (ok !== 'ok') process.exit(1);",
    ].join(" ");
    sh("node -e " + JSON.stringify(code) + " " + JSON.stringify(posix(snapshot)) + " " + JSON.stringify(posix(LOCAL_DB)));
  }

  step(3, "打包 " + TARBALL);
  const tar = path.join(os.tmpdir(), TARBALL);
  fs.rmSync(tar, { force: true });
  const excludes = ["node_modules", ".git", ".env", "var", "target", "apps/shell/src-tauri/target", ".vite", "coverage", "apps/web/dist/.vite"];
  sh([
    "tar czf", JSON.stringify(posix(tar)),
    ...excludes.map((e) => "--exclude=" + JSON.stringify("./" + e)),
    "./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml",
    "./apps/web ./packages ./services ./infra ./scripts ./docs",
    "./README.md ./CONTRIBUTING.md ./tsconfig.base.json",
  ].join(" "));
  log("tarball " + (fs.statSync(tar).size / 1024 / 1024).toFixed(2) + " MB");

  step(4, "上传到 " + BASE + "/incoming/");
  await shell("mkdir -p " + BASE + "/incoming && df -h /opt | tail -1", { cronId: CRON_ID });
  await upload(tar, BASE + "/incoming");
  if (snapshot) await upload(snapshot, BASE + "/incoming");
  // 1Panel 的任务日志偶发串台（回读到别的任务的 nginx 输出），单次回读会误判成"没落地"，
  // 所以按 3 次重试 + 只认文件名出现来判定；真没落地时三次都不会出现。
  const listCmd = "ls -l " + BASE + "/incoming/" + TARBALL + (snapshot ? " " + BASE + "/incoming/" + DBFILE : "");
  let check = "";
  for (let i = 1; i <= 3; i++) {
    check = await shell(listCmd, { cronId: CRON_ID });
    if (check.includes(TARBALL)) break;
    log("回读第 " + i + " 次未见 " + TARBALL + "，重试……");
    await new Promise((r) => setTimeout(r, 3000));
  }
  log(check.trim());
  if (!check.includes(TARBALL)) throw new Error("上传没落地，见上：1Panel upload 对部分目录会静默失败");

  step(5, "服务器发布");
  const release = [
    "set -e",
    "BASE=" + BASE,
    "REL=$BASE/releases/" + stamp,
    "PREV=$(readlink -f $BASE/current 2>/dev/null || true)",
    "echo prev=$PREV",
    "mkdir -p $REL",
    "tar xzf $BASE/incoming/" + TARBALL + " -C $REL",
    // 依赖：pnpm 只往 root node_modules 里建 .pnpm，各 package 的 node_modules 是相对软链，
    // 所以不能靠硬链上一版 node_modules 省事；服务器 store 已经有货，离线装最快也最稳。
    "( cd $REL && PATH=" + path.posix.dirname(NODE) + ":$PATH pnpm install --frozen-lockfile --offline --reporter=silent || pnpm install --frozen-lockfile --reporter=silent )",
    "echo deps=installed",
    "ln -sfn $REL $BASE/current.new && mv -Tf $BASE/current.new $BASE/current",
    "echo switched=$(readlink -f $BASE/current)",
    (argv.has("--with-web") ? [
      "mkdir -p " + WEB_ROOT,
      "rm -rf " + WEB_ROOT + "/assets",
      "( cd $REL/apps/web/dist && tar cf - . ) | ( cd " + WEB_ROOT + " && tar xf - )",
      "echo web=" + WEB_ROOT,
    ] : []).join("\n") + "\n",
    // 数据：停服 → 现库留底 → 覆盖 → 起服
    "if [ -f $BASE/incoming/" + DBFILE + " ]; then",
    "  systemctl stop " + SERVICE,
    "  [ -f " + REMOTE_DB + " ] && cp -a " + REMOTE_DB + " " + REMOTE_DB + ".bak-" + stamp,
    "  install -m 644 -o root -g root $BASE/incoming/" + DBFILE + " " + REMOTE_DB,
    // 设备行跟着服务器走：快照里没有线上签发的令牌，整库覆盖会把已配对设备全打成 401
    "  " + NODE + " $BASE/current/infra/keep-devices.mjs " + REMOTE_DB + ".bak-" + stamp + " " + REMOTE_DB + " || echo device=keep-failed",
    "  rm -f " + REMOTE_DB + "-wal " + REMOTE_DB + "-shm",
    "  echo db=imported",
    "  systemctl start " + SERVICE,
    "else",
    "  systemctl restart " + SERVICE,
    "  echo db=kept",
    "fi",
    // 自检
    "for i in $(seq 1 30); do",
    "  " + HEALTH,
    "  case \"$H\" in *'\"ok\":true'*) echo health=$H; break;; esac",
    "  sleep 1",
    "done",
    "case \"$H\" in *'\"ok\":true'*) ;; *) echo '自检失败'; journalctl -u " + SERVICE + " -n 40 --no-pager; exit 1;; esac",
    // 清理：包 + 老版本
    "rm -f $BASE/incoming/" + TARBALL + " $BASE/incoming/" + DBFILE,
    "ls -1dt $BASE/releases/*/ | tail -n +" + (KEEP + 1) + " | xargs -r rm -rf",
    "echo releases=$(ls -1 $BASE/releases | tr '\\n' ' ')",
  ].join("\n");

  const out = await shell(release, { cronId: CRON_ID, timeout: 900000 });
  log(out);

  step(6, "外网自检");
  const h = healthLocal("http://47.95.238.28");
  log(h || "（外网自检没拿到响应）");
  if (!h.includes('"ok":true')) throw new Error("外网 /house-api/health 不健康");
  console.log("\nOK → http://47.95.238.28/house/  ·  rev/communities 见上");
}

main().catch((e) => {
  console.error("\n!! " + e.message);
  process.exit(1);
});