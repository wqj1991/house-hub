import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 1Panel v1 HTTP API 的最小封装 —— house-hub 的唯一部署通道。
 *
 * 背景（docs/adr/0005、ARCHITECTURE §331）：47.95.238.28 的 SSH 22 从外网不可达，
 * 只能走 1Panel API：文件上传 / 下载 / 读写 + 计划任务跑 shell。
 *
 * Key 读取顺序：ONEPANEL_KEY > ONEPANEL_API_KEY > ~/.1panel_key
 * 服务器没有 node 在 PATH 里，node 固定用 /root/.nvm 下那一份（见 NODE）。
 */
export const BASE = process.env.HOUSE_1PANEL_BASE ?? "http://47.95.238.28:8090";
export const NODE = process.env.HOUSE_NODE ?? "/root/.nvm/versions/node/v24.21.0/bin/node";

function readKey() {
  const fromEnv = process.env.ONEPANEL_KEY ?? process.env.ONEPANEL_API_KEY;
  if (fromEnv) return fromEnv.trim();
  const f = path.join(os.homedir(), ".1panel_key");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  throw new Error("缺少 1Panel API Key：设 ONEPANEL_KEY，或把 key 写到 ~/.1panel_key");
}

const KEY = readKey();

export function auth(extra = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const token = crypto.createHash("md5").update("1panel" + KEY + ts).digest("hex");
  return { "1Panel-Token": token, "1Panel-Timestamp": ts, ...extra };
}

export async function api(p, { method = "GET", body, timeout = 600000 } = {}) {
  const r = await fetch(BASE + p, {
    method,
    headers: auth(body === undefined ? {} : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: r.status, raw: text.slice(0, 400) };
  }
}

const BEGIN = "===DEPLOY-BEGIN===";
const END = "===DEPLOY-END===";

/**
 * 借 1Panel 计划任务（cron id，默认 2 号槽位）跑一段 shell 并返回日志。
 * 1Panel 的任务日志不落盘在固定位置，所以脚本自己把输出写进 LOG，再回读。
 */
export async function shell(cmd, { cronId = 2, log = "/tmp/house-deploy.log", timeout = 600000, name = "house-hub-deploy" } = {}) {
  const script = [
    "#!/bin/bash",
    `LOG=${log}`,
    `echo "${BEGIN}" > $LOG`,
    "{",
    cmd,
    "} >> $LOG 2>&1",
    `echo "${END} rc=$?" >> $LOG`,
    "",
  ].join("\n");

  const upd = await api("/api/v1/cronjobs/update", {
    method: "POST",
    body: { id: cronId, name, type: "shell", spec: "0 0 1 1 *", script, retainCopies: 1 },
  });
  if (upd?.code !== 200) throw new Error("cronjobs/update 失败: " + JSON.stringify(upd).slice(0, 300));
  const run = await api("/api/v1/cronjobs/handle", { method: "POST", body: { id: cronId } });
  if (run?.code !== 200) throw new Error("cronjobs/handle 失败: " + JSON.stringify(run).slice(0, 300));

  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await new Promise((r) => setTimeout(r, 900));
    const res = await api("/api/v1/files/content", { method: "POST", body: { path: log } });
    const content = res?.data?.content ?? "";
    const i = content.indexOf(BEGIN);
    const j = content.indexOf(END);
    if (i >= 0 && j > i) return content.slice(i + BEGIN.length, j).trim();
  }
  throw new Error("远程执行超时（" + Math.round(timeout / 1000) + "s）");
}

/** multipart 上传；1Panel 对部分子目录会静默不落地，所以调用方要自己回读校验。 */
export async function upload(localFile, remoteDir) {
  const buf = fs.readFileSync(localFile);
  const fd = new FormData();
  fd.append("path", remoteDir);
  fd.append("file", new Blob([buf]), path.basename(localFile));
  const r = await fetch(BASE + "/api/v1/files/upload", {
    method: "POST",
    headers: auth(),
    body: fd,
    signal: AbortSignal.timeout(900000),
  });
  const text = await r.text();
  if (!(r.status === 200 && text.includes('"code":200'))) {
    throw new Error(`上传失败 ${localFile} -> ${remoteDir}: ${text.slice(0, 200)}`);
  }
  return buf.length;
}

export async function stat(remotePath) {
  const res = await api("/api/v1/files/search", { method: "POST", body: { path: remotePath, expand: true, page: 1, pageSize: 1 } });
  return res?.data?.items?.[0] ?? null;
}
