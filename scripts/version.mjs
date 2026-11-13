// 版本号单一来源 = 根 package.json 的 version；apps/* packages/* services/* 全部跟着它走。
//
//   node scripts/version.mjs           把根版本同步下去
//   node scripts/version.mjs 0.3.0     改根版本再同步
//   node scripts/version.mjs --check   只校验，有漂移退出码 1（CI 用）
//
// 前端界面显示的版本来自 apps/web/package.json（apps/web/vite.config.ts 的 define.__APP_VERSION__），
// Tauri 壳的版本直接读 apps/shell/package.json（tauri.conf.json 的 version 是路径），所以同步一处即可。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const explicit = args.find((a) => !a.startsWith("-"));

const rel = (p) => relative(root, p).replace(/\\/g, "/");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, j) => writeFileSync(p, JSON.stringify(j, null, 2) + "\n");

const rootPkgPath = join(root, "package.json");
if (explicit) {
  if (check) {
    console.error("--check 不接受版本参数");
    process.exit(2);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(explicit)) {
    console.error(`不是合法 semver：${explicit}`);
    process.exit(2);
  }
  const j = readJson(rootPkgPath);
  j.version = explicit;
  writeJson(rootPkgPath, j);
  console.log(`根版本 → ${explicit}`);
}

const version = readJson(rootPkgPath).version;
const targets = [];
for (const group of ["apps", "packages", "services"]) {
  const dir = join(root, group);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name, "package.json");
    if (existsSync(p)) targets.push(p);
  }
}

const drift = [];
for (const p of targets) {
  const j = readJson(p);
  if (j.version === version) continue;
  if (check) {
    drift.push(`${rel(p)}: ${j.version} ≠ ${version}`);
    continue;
  }
  j.version = version;
  writeJson(p, j);
  console.log(`  ${rel(p)} → ${version}`);
}

if (check) {
  if (drift.length) {
    console.error(`版本漂移 ${drift.length} 处（真值 ${version}）：`);
    for (const d of drift) console.error(`  ✗ ${d}`);
    console.error("跑 pnpm version:sync 修掉");
    process.exit(1);
  }
  console.log(`版本一致：${version}（${targets.length} 个包）`);
} else {
  console.log(`版本 ${version}：已同步 ${targets.length} 个包`);
}
