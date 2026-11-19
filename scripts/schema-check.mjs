#!/usr/bin/env node
/**
 * 本地 SQLite schema 与服务器迁移的一致性检查（C 段）。
 * 两端各有一套建表语句，字段漂移不会报错，只会让同步悄悄丢列——所以用脚本盯住。
 *
 * 用法：node scripts/schema-check.mjs [--strict]
 *   默认：缺表/缺列 → 退出码 1；多出来的列只提示。
 *   --strict：多出来的列也算失败。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

function readDir(rel) {
  const dir = join(root, rel);
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
  } catch {
    return [];
  }
  return names.map((n) => readFileSync(join(dir, n), "utf8"));
}

/** 抽出 create table 的 (…) 主体：逐字符数括号，字符串里的括号不算。 */
function tableBodies(sql) {
  const out = new Map();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?(\w+)["`]?\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    let depth = 1;
    let i = re.lastIndex;
    let quote = null;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
      } else if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    out.set(m[1], sql.slice(re.lastIndex, i - 1));
  }
  return out;
}

const RESERVED = new Set(["primary", "unique", "foreign", "constraint", "check"]);

/**
 * 只存在于服务器、不进客户端 schema 的表。加表前先问：客户端同步它吗？
 * 不同步就别往这里塞——它是白名单，不是垃圾桶。
 */
const SERVER_ONLY = new Map([
  ["sync_counter", "全局 rev 自增器，本地用自己的 sync_meta"],
  ["pairing_code", "配对码，服务器一次性凭证"],
  ["device", "设备注册表，服务器台账"],
  ["job", "抓数任务队列，只有 worker 领活"],
  ["rule_set", "规则集版本快照，客户端拿 list_rules 的结果"],
  ["geo_cache", "地理编码缓存，避免重复买配额"],
  ["income_doc", "收入与公积金单行文档，只住服务器，客户端按需读整份"],
  ["commute_doc", "通勤画像单行文档，跟收入一样只住服务器"],
]);

function columnsOf(body) {
  const cols = new Set();
  let depth = 0;
  let cur = "";
  const parts = [];
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  for (const raw of parts) {
    const line = raw.trim().replace(/--[^\n]*/g, "").trim();
    if (!line) continue;
    const first = line.split(/\s+/)[0].replace(/["`]/g, "").toLowerCase();
    if (!first || RESERVED.has(first)) continue;
    cols.add(first);
  }
  return cols;
}

function collect(files) {
  const tables = new Map();
  for (const sql of files) {
    for (const [name, body] of tableBodies(sql)) {
      const cols = tables.get(name) ?? new Set();
      for (const c of columnsOf(body)) cols.add(c);
      tables.set(name, cols);
    }
    const re = /alter\s+table\s+["`]?(\w+)["`]?\s+add\s+(?:column\s+)?["`]?(\w+)["`]?/gi;
    let m;
    while ((m = re.exec(sql))) {
      const cols = tables.get(m[1]) ?? new Set();
      cols.add(m[2].toLowerCase());
      tables.set(m[1], cols);
    }
  }
  return tables;
}

const localFiles = [
  readFileSync(join(root, "apps/shell/src-tauri/src/schema.sql"), "utf8"),
  ...readDir("apps/shell/src-tauri/migrations"),
];
const local = collect(localFiles);
const server = collect(readDir("services/api/src/migrations"));

const problems = [];
const notes = [];

for (const [table, cols] of server) {
  if (SERVER_ONLY.has(table)) continue;
  const mine = local.get(table);
  if (!mine) {
    problems.push("本地缺表: " + table);
    continue;
  }
  for (const c of cols) {
    if (!mine.has(c)) problems.push("本地缺列: " + table + "." + c);
  }
  for (const c of mine) {
    if (!cols.has(c)) notes.push("本地多列: " + table + "." + c);
  }
}
for (const table of local.keys()) {
  if (!server.has(table)) notes.push("仅本地有表: " + table);
}

if (notes.length) {
  console.log("提示（不影响退出码）：");
  for (const n of notes) console.log("  - " + n);
}
if (problems.length) {
  console.error("不一致：" + problems.length + " 处");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
if (strict && notes.length) {
  console.error("--strict：多出来的列也算漂移");
  process.exit(1);
}
console.log("schema 一致：" + server.size + " 张同步表");