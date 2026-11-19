export type ToneKey = "dawn" | "glacier" | "twilight" | "obsidian";

export interface Tone {
  key: ToneKey;
  name: string;
  desc: string;
  dots: [string, string, string];
}

export const TONES: Tone[] = [
  { key: "dawn", name: "晨曦暖白", desc: "浅色柔光 · 清透折射（默认）", dots: ["#EEF3F8", "#FFAE9E", "#0284C7"] },
  { key: "glacier", name: "极光冰川", desc: "冷青蓝绿 · 深邃极光", dots: ["#030B12", "#12B5A0", "#227AB5"] },
  { key: "twilight", name: "暮色暗紫", desc: "深空紫蓝 · 霓虹暗色", dots: ["#080410", "#8338EC", "#3A86FF"] },
  { key: "obsidian", name: "黑曜纯深", desc: "石墨碳黑 · 纯粹克制", dots: ["#050608", "#3D4A62", "#E2E8F0"] },
];

const STORAGE_KEY = "house-hub:tone";

export function loadTone(): ToneKey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && TONES.some((t) => t.key === raw)) return raw as ToneKey;
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略 */
  }
  return "dawn";
}

export function saveTone(tone: ToneKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, tone);
  } catch {
    /* 同上 */
  }
}

/* =====================================================================
   自定义背景图：底膜之上可以再叠一张本机图片（不上传服务器）
   ===================================================================== */

export interface ToneBg {
  /** 压缩后的 dataURL（长边 ≤ 1920 的 JPEG），直接给背景层当 url() */
  url: string;
  /** 遮罩强度 0–0.85：越大图片越淡，玻璃卡片上的文字越清楚 */
  dim: number;
}

const BG_KEY = "house-hub:tone-bg";
const BG_EVENT = "house-hub:tone-bg";

/** 默认遮罩：既保住图片观感，也能让卡片正文读得清 */
export const DEFAULT_BG_DIM = 0.3;
/** 压缩目标长边；再大对屏幕没有收益，只会撑爆 localStorage */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
/** 原图上限：更大的文件先让用户在本地压一遍，避免低端机解码卡死 */
export const MAX_BG_FILE_BYTES = 16 * 1024 * 1024;

function clampDim(dim: number): number {
  if (!Number.isFinite(dim)) return DEFAULT_BG_DIM;
  return Math.min(0.85, Math.max(0, dim));
}

export function loadToneBg(): ToneBg | null {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ToneBg> | null;
    if (!parsed || typeof parsed.url !== "string" || !parsed.url) return null;
    return { url: parsed.url, dim: clampDim(Number(parsed.dim)) };
  } catch {
    return null;
  }
}

function emitToneBg(bg: ToneBg | null): void {
  window.dispatchEvent(new CustomEvent<ToneBg | null>(BG_EVENT, { detail: bg }));
}

/** 只广播不落盘：拖遮罩滑块时让背景层实时跟着变，松手再 saveToneBg。 */
export function publishToneBg(bg: ToneBg): void {
  emitToneBg({ url: bg.url, dim: clampDim(bg.dim) });
}

/** 落盘 + 广播；返回 false 表示本机存储写不进去（配额满/隐私模式），本次会话仍生效。 */
export function saveToneBg(bg: ToneBg): boolean {
  const next: ToneBg = { url: bg.url, dim: clampDim(bg.dim) };
  let persisted = true;
  try {
    localStorage.setItem(BG_KEY, JSON.stringify(next));
  } catch {
    persisted = false;
  }
  emitToneBg(next);
  return persisted;
}

/** 移除自定义背景图，回到内置底膜。 */
export function clearToneBg(): void {
  try {
    localStorage.removeItem(BG_KEY);
  } catch {
    /* 隐私模式下删不掉也不影响当前会话 */
  }
  emitToneBg(null);
}

/** 订阅背景图变化（图层与「我的」里的设置卡共用一份来源）。 */
export function onToneBgChange(handler: (bg: ToneBg | null) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<ToneBg | null>).detail);
  window.addEventListener(BG_EVENT, listener);
  return () => window.removeEventListener(BG_EVENT, listener);
}

/** 本地读图 → canvas 等比缩放 → JPEG dataURL；透明 PNG 先铺白底，避免转 JPEG 发黑。 */
export async function fileToToneBg(file: File): Promise<string> {
  if (file.size > MAX_BG_FILE_BYTES) throw new Error("图片超过 16MB，先压缩一下再上传");
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("这张图片无法解码，换一张 JPG / PNG / WebP 试试"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持 canvas，无法处理图片");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
