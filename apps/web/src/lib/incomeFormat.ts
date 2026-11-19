/** 展示层换算：内核一律「元」，页面上按需转万元 / 百分比。 */

export function formatYuan(yuan: number): string {
  if (!Number.isFinite(yuan)) return "0";
  return Math.round(yuan).toLocaleString("en-US");
}

export function formatWan(yuan: number, digits = 1): string {
  const wan = (Number.isFinite(yuan) ? yuan : 0) / 10000;
  return wan.toFixed(digits);
}

export function formatRatio(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return (ratio * 100).toFixed(1) + "%";
}

export function formatYears(years: number): string {
  const value = Math.round(years * 10) / 10;
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + " 年";
}

export function formatRate(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}
