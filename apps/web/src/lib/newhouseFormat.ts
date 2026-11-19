/** 新房列表/详情共用的展示口径：桌面与移动端必须是同一套写法，别各写一份。 */

export function statusClass(status: string | null): string {
  if (status === "在售") return " is-onsale";
  if (status === "待售") return " is-waiting";
  return "";
}

export function fmtAvg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "待定";
  if (value >= 10000) return (value / 10000).toFixed(1).replace(/\.0$/, "") + " 万/㎡";
  return Math.round(value) + " 元/㎡";
}

/** 单价区间压成一段："1.8–9 万/㎡"；端点缺失或同价时退化成单值，别写两次单位 */
export function fmtAvgRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = fmtAvg(min);
  const hi = fmtAvg(max);
  if (lo === "待定") return hi;
  if (hi === "待定") return lo;
  const cut = (text: string) => text.replace(/\s*(万|元)\/㎡$/, "");
  const hit = lo.match(/\s*(万|元)\/㎡$/);
  const unit = hit ? hit[1] + "/㎡" : "";
  const a = cut(lo);
  const b = cut(hi);
  return a === b ? a + " " + unit : a + "–" + b + " " + unit;
}

export function fmtArea(text: string | null | undefined): string {
  if (!text) return " 面积待补";
  return " " + text.replace(/平米/g, "㎡");
}

export function fmtPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  return phone;
}

export function fmtStamp(stamp: string | null | undefined): string {
  if (!stamp) return "抓取时间未知";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return stamp;
  const pad = (n: number) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
