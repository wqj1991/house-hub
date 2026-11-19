/**
 * 把新盘封面抓成本地文件：房天下图片域名本机直连不通（必须走代理），
 * 浏览器里 <img> 没法带代理，所以统一下载到 services/api/assets/covers/<uid>.jpg（由 api 直出），
 * 页面只引用 /covers/xxx.jpg，离线、Tauri 打包、换网络都不会白图。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "packages/core/src/content/newhouse.ts");
const OUT = join(root, "services/api/assets/covers");
const SIZE = process.argv.includes("--size") ? process.argv[process.argv.indexOf("--size") + 1] : "800x600";
const FORCE = process.argv.includes("--force");

const text = readFileSync(SRC, "utf8");
const start = text.indexOf("NewProjectFact[] = [");
const body = text.slice(start);
const rows = [];
for (const m of body.matchAll(/"uid": "([^"]+)"[\s\S]*?"image": (null|"[^"]*")/g)) {
  rows.push({ uid: m[1], image: m[2] === "null" ? null : JSON.parse(m[2]) });
}
mkdirSync(OUT, { recursive: true });

let ok = 0, skip = 0, fail = 0, bytes = 0;
const failures = [];
for (const row of rows) {
  if (!row.image) continue;
  const target = join(OUT, row.uid + ".jpg");
  if (!FORCE && existsSync(target) && statSync(target).size > 2000) { skip++; bytes += statSync(target).size; continue; }
  const url = row.image.replace(/\/\d+x\d+\.jpg/, "/" + SIZE + ".jpg");
  try {
    execFileSync("curl", ["-sSfL", "--max-time", "30", "--retry", "3", "--retry-delay", "2",
      "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      "-e", "https://newhouse.fang.com/", "-o", target, url], { stdio: "pipe" });
    const size = statSync(target).size;
    if (size < 2000) throw new Error("too small " + size);
    ok++; bytes += size;
  } catch (err) {
    fail++;
    failures.push(row.uid + " " + url + " :: " + String(err.message || err).slice(0, 80));
  }
  if ((ok + fail) % 20 === 0) console.log("progress", ok, fail, skip);
}
console.log("done", { total: rows.length, ok, skip, fail, mb: (bytes / 1048576).toFixed(2), out: OUT });
if (failures.length) console.log(failures.slice(0, 12).join("\n"));
