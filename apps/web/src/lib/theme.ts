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
