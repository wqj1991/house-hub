import { showToast } from "./toast";

/**
 * v1 交互引擎（下拉 / 时分轮 / 玻璃日历 / 按钮水波纹 / 开关）的 React 版委托实现。
 * 标记层保持与 v1 完全一致，交互挂载在 document 上，随组件装卸自动解绑。
 */

const DOTS = new Set(["2026-11-15", "2026-12-31"]);

const calendar = { year: 2026, month: 10, iso: "2026-11-15" };

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function renderCalendar(): void {
  const grid = document.getElementById("calendarDaysGrid");
  if (!grid) return;
  const title = document.getElementById("currentMonthYearText");
  if (title) title.textContent = calendar.year + " 年 " + (calendar.month + 1) + " 月";

  const firstDay = new Date(calendar.year, calendar.month, 1).getDay();
  const totalDays = new Date(calendar.year, calendar.month + 1, 0).getDate();
  const prevDays = new Date(calendar.year, calendar.month, 0).getDate();
  const cells: string[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push('<div class="date-cell is-muted">' + (prevDays - i) + "</div>");
  }
  for (let d = 1; d <= totalDays; d++) {
    const iso = calendar.year + "-" + pad(calendar.month + 1) + "-" + pad(d);
    const cls = ["date-cell"];
    if (iso === calendar.iso) cls.push("is-selected");
    if (DOTS.has(iso)) cls.push("has-dot");
    cells.push('<div class="' + cls.join(" ") + '" data-iso="' + iso + '" data-day="' + d + '">' + d + "</div>");
  }
  grid.innerHTML = cells.join("");
}

function closeSelects(): void {
  document.querySelectorAll(".custom-select").forEach((el) => el.classList.remove("is-open"));
}

function selectDate(iso: string, label?: string): void {
  const parts = iso.split("-");
  calendar.iso = iso;
  calendar.year = Number(parts[0]);
  calendar.month = Number(parts[1]) - 1;
  renderCalendar();
  const text = document.getElementById("selectedDateText");
  if (text) text.textContent = iso;
  const badge = document.getElementById("dateDisplayBadge");
  if (badge) badge.textContent = label ?? "已定 " + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  closeSelects();
  showToast("选房日程已更新", iso);
}

function setTimePart(col: string, value: string, opt: HTMLElement): void {
  const parent = opt.parentElement;
  parent?.querySelectorAll(".time-opt").forEach((o) => o.classList.remove("is-active"));
  opt.classList.add("is-active");
  const current = (document.getElementById("selectedTimeText")?.textContent ?? "08 : 00").split(":");
  const hour = col === "hour" ? value : current[0].trim();
  const min = col === "min" ? value : current[1].trim();
  const text = document.getElementById("selectedTimeText");
  if (text) text.textContent = hour + " : " + min;
  const badge = document.getElementById("timeDisplayBadge");
  if (badge) badge.textContent = hour + ":" + min + " 设定时刻";
  showToast("时钟锚点已更新", hour + ":" + min);
}

function setQuickTime(time: string, label: string): void {
  const [hour, min] = time.split(":");
  document.querySelectorAll("#colHours .time-opt").forEach((o) => {
    o.classList.toggle("is-active", (o.textContent ?? "").trim() === hour);
  });
  document.querySelectorAll("#colMinutes .time-opt").forEach((o) => {
    o.classList.toggle("is-active", (o.textContent ?? "").trim() === min);
  });
  const text = document.getElementById("selectedTimeText");
  if (text) text.textContent = hour + " : " + min;
  const badge = document.getElementById("timeDisplayBadge");
  if (badge) badge.textContent = label;
  closeSelects();
  showToast("时钟锚点已更新", time + " (" + label + ")");
}

const QUICK_DATE: Array<[string, string]> = [
  ["2026-11-15", "本周六·德茂看房"],
  ["2026-12-31", "落户积分核算截点"],
  ["2027-01-01", "积分兑现申报"],
];

const QUICK_TIME: Array<[string, string]> = [
  ["06:52", "快专3路班车"],
  ["08:00", "老公施耐德"],
  ["09:00", "老婆环贸D座"],
];

function setMonth(delta: number): void {
  calendar.month += delta;
  if (calendar.month < 0) {
    calendar.month = 11;
    calendar.year--;
  } else if (calendar.month > 11) {
    calendar.month = 0;
    calendar.year++;
  }
  renderCalendar();
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  const navBtn = target.closest<HTMLElement>(".date-nav-btn");
  if (navBtn) {
    const group = Array.from(document.querySelectorAll(".date-nav-btn"));
    setMonth(group.indexOf(navBtn) === 0 ? -1 : 1);
    return;
  }

  const dayCell = target.closest<HTMLElement>(".date-cell[data-iso]");
  if (dayCell) {
    selectDate(dayCell.dataset.iso ?? "", undefined);
    return;
  }

  const datePill = target.closest<HTMLElement>(".date-pill");
  if (datePill) {
    const pills = Array.from(document.querySelectorAll(".date-pill"));
    const spec = QUICK_DATE[pills.indexOf(datePill)];
    if (spec) selectDate(spec[0], spec[1]);
    return;
  }

  const timeOpt = target.closest<HTMLElement>(".time-opt");
  if (timeOpt) {
    const col = timeOpt.closest("#colHours") ? "hour" : "min";
    setTimePart(col, (timeOpt.textContent ?? "").trim(), timeOpt);
    return;
  }

  const timePill = target.closest<HTMLElement>(".time-pill");
  if (timePill) {
    const pills = Array.from(document.querySelectorAll(".time-pill"));
    const spec = QUICK_TIME[pills.indexOf(timePill)];
    if (spec) setQuickTime(spec[0], spec[1]);
    return;
  }

  const trigger = target.closest<HTMLElement>(".custom-select-trigger");
  if (trigger) {
    const host = trigger.closest<HTMLElement>(".custom-select");
    const wasOpen = host?.classList.contains("is-open") ?? false;
    closeSelects();
    if (host && !wasOpen) host.classList.add("is-open");
    return;
  }

  const option = target.closest<HTMLElement>(".dropdown-item");
  if (option) {
    const host = option.closest<HTMLElement>(".custom-select");
    const text = host?.querySelector(".selected-text");
    if (text) text.textContent = option.textContent ?? "";
    host?.querySelectorAll(".dropdown-item").forEach((el) => el.classList.remove("is-selected"));
    option.classList.add("is-selected");
    closeSelects();
    showToast("户型偏好已更新", (option.textContent ?? "").trim());
    return;
  }

  if (!target.closest(".custom-select")) closeSelects();

  const sw = target.closest<HTMLElement>(".g-switch");
  if (sw) sw.classList.toggle("is-on");

  const btn = target.closest<HTMLElement>(".g-btn");
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = event.clientX - rect.left + "px";
    ripple.style.top = event.clientY - rect.top + "px";
    btn.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 500);
  }
}

export function installGlassWidgets(): () => void {
  document.addEventListener("click", onClick);
  renderCalendar();
  return () => document.removeEventListener("click", onClick);
}
