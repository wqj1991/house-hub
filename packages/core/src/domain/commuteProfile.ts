/**
 * 通勤画像：公司地点 + 多条通勤习惯（含班车），纯函数，零 IO。
 * 与收入一样属于「我的」里的个人档案：改一处，通勤口径、班车倒推、到岗风险都跟着变。
 *
 * 口径（写死在类型注释里，页面不许自己再算）：
 * - minutes 一律「门到门单程分钟」，不含返程；每周通勤时长按往返 × 每周天数累加。
 * - 时刻一律 "HH:mm" 24 小时制字符串，空串表示没填；比较前用 parseClock 转分钟。
 * - 班车只在 vehicle === "shuttle" 时才看 shuttle 里的线路 / 站点 / 发车 / 末班。
 */

export type CommuteVehicle = "transit" | "shuttle" | "drive" | "walk" | "ebike";

export const COMMUTE_VEHICLE_LABEL: Record<CommuteVehicle, string> = {
  transit: "公共交通",
  shuttle: "公司班车",
  drive: "自驾",
  walk: "步行",
  ebike: "电动自行车",
};

/** 录入界面的排列顺序：先公共交通，再班车、自驾，最后两条腿解决。 */
export const COMMUTE_VEHICLE_ORDER: CommuteVehicle[] = ["transit", "shuttle", "drive", "walk", "ebike"];

/** 接驳腿的走法：家→公交/地铁站、出站→公司、家→班车上车点，都只有这两种。 */
export type CommuteAccess = "walk" | "ebike";

export const COMMUTE_ACCESS_LABEL: Record<CommuteAccess, string> = {
  walk: "步行",
  ebike: "电动自行车",
};

export const COMMUTE_ACCESS_ORDER: CommuteAccess[] = ["walk", "ebike"];

export type ShuttleSeat = "reserved" | "firstCome" | "unknown";

export const SHUTTLE_SEAT_LABEL: Record<ShuttleSeat, string> = {
  reserved: "需预约 / 实名",
  firstCome: "先到先上",
  unknown: "座位未确认",
};

/** 班车这一条腿的专属信息：只有 vehicle === "shuttle" 时才有意义。 */
export interface ShuttlePlan {
  /** 线路名，如「快专3路 / 望京线」 */
  line: string;
  /** 上车站点，如「天通苑北 B 口」 */
  stop: string;
  /** 发车时刻 "HH:mm" */
  depart: string;
  /** 到公司时刻 "HH:mm" */
  arrive: string;
  seat: ShuttleSeat;
  /** 返程末班车 "HH:mm"，空串＝没填或没有返程班车 */
  lastReturn: string;
  /** 班车是否直接停公司门口（false＝还要走一段） */
  toGate: boolean;
  note: string;
}

/** 一处办公地点：公司 / 园区。到岗时刻是硬约束，习惯按它校验迟到。 */
export interface OfficeLocation {
  uid: string;
  /** 用户自己的叫法，默认是高德 POI 名 */
  name: string;
  address: string;
  /** 高德 POI / 提示 id：地点「确实来自高德」的凭据 */
  poiId: string;
  /** 高德原始名称：改名后仍看得出选的是哪栋楼 */
  poiName: string;
  /** 高德坐标（GCJ-02）；以后算通勤时长 / 直线距离的基础 */
  lng: number;
  lat: number;
  city: string;
  district: string;
  adcode: string;
  /** 到岗不晚于 "HH:mm" */
  beIn: string;
  /** 每周去几天（0–7，混合办公用） */
  daysPerWeek: number;
  note: string;
}

/** 一种通勤习惯：同一处公司可能同时有「早班车」和「地铁备选」。 */
export interface CommuteHabit {
  uid: string;
  label: string;
  vehicle: CommuteVehicle;
  /** 单程门到门分钟 */
  minutes: number;
  /** 从家出门时刻 "HH:mm" */
  departHome: string;
  /** 到岗时刻 "HH:mm"（填了就按它校验，没填则用 departHome + minutes 推） */
  arriveWork: string;
  /** 每周用几天 */
  daysPerWeek: number;
  /** 主用方案：全局唯一，保存时会把别的习惯的 primary 清掉 */
  primary: boolean;
  /** 只对某处公司有效时填它的 uid；空串＝通用 */
  officeUid: string;
  /** 谁的通勤习惯：家庭成员 uid；空串＝全家通用 */
  memberUid: string;
  /** 家 → 公交/地铁站（公共交通）或 家 → 班车上车点（公司班车）这一段怎么走 */
  accessHome: CommuteAccess;
  /** 出站 → 公司这一段怎么走；只有公共交通用得上 */
  accessWork: CommuteAccess;
  /** 班车附加信息；非班车习惯为 null */
  shuttle: ShuttlePlan | null;
  note: string;
}

/**
 * 班车线路归属：线路本体（车号、司机、站点时刻）在服务端的 line / stop 表里，
 * 通勤档案这边只记「这条线挂在哪处公司」，这样删公司不用动线路，换公司只改一条绑定。
 */
export interface ShuttleBinding {
  /** 线路号，如 Y06 */
  code: string;
  /** 所属公司地点的 uid；空串＝还没挂 */
  officeUid: string;
}

export interface CommuteProfile {
  offices: OfficeLocation[];
  habits: CommuteHabit[];
  /** 线路号 → 公司地点 的归属表 */
  shuttles: ShuttleBinding[];
}

export const EMPTY_COMMUTE_PROFILE: CommuteProfile = { offices: [], habits: [], shuttles: [] };

/** 这处公司有没有高德坐标：没有就参与不了里程 / 通勤时长计算。 */
export function isOfficeGeocoded(office: OfficeLocation): boolean {
  return Boolean(office.poiId) && Number.isFinite(office.lng) && Number.isFinite(office.lat) && (office.lng !== 0 || office.lat !== 0);
}

/** 坐标文案：116.481234,39.996781（六位小数，跟高德返回同精度）。 */
export function formatCoord(office: OfficeLocation): string {
  if (!isOfficeGeocoded(office)) return "";
  return office.lng.toFixed(6) + "," + office.lat.toFixed(6);
}

/** 把 "HH:mm" 解析成 0–1439 的分钟；空串 / 乱填返回 null。 */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 分钟数还原成 "HH:mm"，跨 24 点按次日算（只用于展示）。 */
export function formatClock(minutes: number): string {
  const day = 24 * 60;
  const wrapped = ((Math.round(minutes) % day) + day) % day;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

/** 时长文案：65 → "1 小时 5 分"；30 → "30 分钟"。 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return total + " 分钟";
  const hour = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? hour + " 小时" : hour + " 小时 " + rest + " 分";
}

export interface CommuteHabitView {
  habit: CommuteHabit;
  /** 习惯指定的公司；通用习惯取第一处公司 */
  office: OfficeLocation | null;
  /** departHome + minutes 推出来的到岗时刻 */
  computedArrive: string | null;
  /** 到岗余量：公司到岗时刻 − 实际到岗（负＝迟到） */
  slackMin: number | null;
  late: boolean;
  /** 这条习惯自己的问题清单，空数组＝没问题 */
  warnings: string[];
}

export interface CommuteOverview {
  views: CommuteHabitView[];
  /** 主用方案：标了 primary 的那条，没有就取第一条 */
  primary: CommuteHabitView | null;
  /** 每周通勤分钟（往返），按每种习惯各自的每周天数累加 */
  weeklyMinutes: number;
  /** 每天最早出门时刻 */
  earliestDepart: string | null;
  /** 每周最晚回家时刻（末班返程的最大值） */
  latestReturn: string | null;
  shuttleCount: number;
  /** 班车之外是否有备选腿 */
  hasNonShuttle: boolean;
  /** 班车是主用方案却没有备选：单点故障 */
  shuttleOnly: boolean;
  /** 全局提醒（缺公司地点、缺习惯、到岗冲突……） */
  warnings: string[];
}

function officeFor(habit: CommuteHabit, offices: OfficeLocation[]): OfficeLocation | null {
  if (habit.officeUid) return offices.find((office) => office.uid === habit.officeUid) ?? null;
  return offices[0] ?? null;
}

function habitWarnings(habit: CommuteHabit, office: OfficeLocation | null, shuttleOnly: boolean): string[] {
  const out: string[] = [];
  if (habit.minutes <= 0) out.push("单程时长与出门时刻按起点小区算：挂到具体小区（楼盘详情 → 通勤路线）之前，这条只当走法模板");
  if (habit.daysPerWeek <= 0) out.push("每周 0 天：这条习惯不会进周统计");

  const depart = parseClock(habit.departHome);
  const declared = parseClock(habit.arriveWork);
  const computed = depart !== null && habit.minutes > 0 ? depart + habit.minutes : null;
  if (depart !== null && declared !== null && computed !== null && Math.abs(declared - computed) > 5) {
    out.push("出门 " + habit.departHome + " + 时长 " + habit.minutes + " 分 = " + formatClock(computed) + "，和填的到岗 " + habit.arriveWork + " 对不上");
  }

  const beIn = office ? parseClock(office.beIn) : null;
  const actual = declared ?? computed;
  if (beIn !== null && actual !== null && actual > beIn) {
    out.push("到岗 " + formatClock(actual) + " 晚于公司到岗 " + (office as OfficeLocation).beIn + "，这条会迟到");
  }

  if (habit.vehicle === "shuttle") {
    const shuttle = habit.shuttle;
    if (!shuttle) {
      out.push("选了班车但没填班车信息");
    } else {
      if (!shuttle.line.trim()) out.push("班车线路没填");
      if (!shuttle.stop.trim()) out.push("上车站点没填");
      if (parseClock(shuttle.depart) === null) out.push("班车发车时刻没填");
      if (parseClock(shuttle.arrive) === null) out.push("班车到公司时刻没填");
      if (shuttle.depart && parseClock(shuttle.depart) === null) out.push("班车发车时刻不是 HH:mm");
      if (shuttle.arrive && parseClock(shuttle.arrive) === null) out.push("班车到公司时刻不是 HH:mm");
      const shipDepart = parseClock(shuttle.depart);
      const shipArrive = parseClock(shuttle.arrive);
      if (shipDepart !== null && shipArrive !== null && shipArrive <= shipDepart) out.push("班车到公司时刻不晚于发车时刻");
      if (depart !== null && shipDepart !== null && shipDepart < depart) out.push("班车 " + shuttle.depart + " 发车早于你出门的 " + habit.departHome);
      if (shuttle.lastReturn && parseClock(shuttle.lastReturn) === null) out.push("末班返程不是 HH:mm");
      if (shuttleOnly) out.push("班车是主用方案但没留备选：末班走了、临时停运就没法上班");
    }
  }
  return out;
}

/** 通勤画像的整份视图：界面只渲染这里算好的数，不再自己推时刻。 */
export function commuteOverview(profile: CommuteProfile): CommuteOverview {
  const offices = profile.offices;
  const habits = profile.habits;
  const warnings: string[] = [];

  if (!offices.length) warnings.push("还没录公司地点：先填公司 / 园区和到岗时刻，才能判断哪种通勤来得及");
  if (!habits.length) warnings.push("还没录通勤习惯：点「添加通勤习惯」，班车、地铁、自驾各记一条");

  const shuttleHabits = habits.filter((habit) => habit.vehicle === "shuttle");
  const hasNonShuttle = habits.some((habit) => habit.vehicle !== "shuttle");
  const primaryHabit = habits.find((habit) => habit.primary) ?? habits[0] ?? null;
  const shuttlePrimary = primaryHabit?.vehicle === "shuttle";
  const shuttleOnly = shuttlePrimary && !hasNonShuttle;

  const views: CommuteHabitView[] = habits.map((habit) => {
    const office = officeFor(habit, offices);
    const depart = parseClock(habit.departHome);
    const computed = depart !== null && habit.minutes > 0 ? depart + habit.minutes : null;
    const declared = parseClock(habit.arriveWork);
    const actual = declared ?? computed;
    const beIn = office ? parseClock(office.beIn) : null;
    const slackMin = beIn !== null && actual !== null ? beIn - actual : null;
    return {
      habit,
      office,
      computedArrive: computed === null ? null : formatClock(computed),
      slackMin,
      late: slackMin !== null ? slackMin < 0 : false,
      warnings: habitWarnings(habit, office, shuttleOnly && habit.vehicle === "shuttle"),
    };
  });

  const primary = views.find((view) => view.habit.uid === primaryHabit?.uid) ?? null;

  let weeklyMinutes = 0;
  let earliest: number | null = null;
  let latestReturn: number | null = null;
  for (const habit of habits) {
    if (habit.minutes > 0 && habit.daysPerWeek > 0) weeklyMinutes += habit.minutes * 2 * Math.min(7, habit.daysPerWeek);
    const depart = parseClock(habit.departHome);
    if (depart !== null && (earliest === null || depart < earliest)) earliest = depart;
    const back = habit.shuttle ? parseClock(habit.shuttle.lastReturn) : null;
    if (back !== null && (latestReturn === null || back > latestReturn)) latestReturn = back;
  }

  // 同一处公司被多条习惯覆盖但到岗时刻不同，最常见的坑：班车到达晚于到岗
  const lateCount = views.filter((view) => view.late).length;
  if (lateCount > 0) warnings.push(lateCount + " 条习惯到岗会晚于公司到岗时刻");

  return {
    views,
    primary,
    weeklyMinutes,
    earliestDepart: earliest === null ? null : formatClock(earliest),
    latestReturn: latestReturn === null ? null : formatClock(latestReturn),
    shuttleCount: shuttleHabits.length,
    hasNonShuttle,
    shuttleOnly,
    warnings,
  };
}

/** 概要一行字：「我的」首页用，桌面和手机同一句。 */
export function commuteLine(profile: CommuteProfile): string {
  const overview = commuteOverview(profile);
  if (!profile.habits.length && !profile.offices.length) return "还没录公司地点与通勤习惯 · 点开维护班车、地铁、自驾";
  if (!profile.habits.length) return "公司 " + profile.offices.length + " 处 · 还没录通勤习惯";
  const primary = overview.primary;
  const parts: string[] = [];
  if (profile.offices.length) parts.push("公司 " + profile.offices.length + " 处");
  parts.push(profile.habits.length + " 种通勤");
  if (primary) {
    parts.push(
      "主用 " +
        COMMUTE_VEHICLE_LABEL[primary.habit.vehicle] +
        (primary.habit.minutes > 0 ? " " + primary.habit.minutes + "′" : " · 时长待挂小区"),
    );
  }
  if (overview.shuttleCount) parts.push("班车 " + overview.shuttleCount + " 条");
  if (profile.shuttles?.length) parts.push("线路 " + profile.shuttles.length + " 条");
  if (overview.weeklyMinutes) parts.push("每周 " + formatDuration(overview.weeklyMinutes));
  return parts.join(" · ");
}

/** 这条线路当前挂在哪处公司：没挂过返回空串。 */
export function shuttleOfficeUid(profile: CommuteProfile, code: string): string {
  return (profile.shuttles ?? []).find((item) => item.code === code)?.officeUid ?? "";
}

/** 写一条归属（不改原数组）：code 已存在就换公司，不存在就追加。 */
export function bindShuttle(shuttles: ShuttleBinding[], code: string, officeUid: string): ShuttleBinding[] {
  const next: ShuttleBinding[] = [];
  let done = false;
  for (const item of shuttles ?? []) {
    if (item.code !== code) {
      next.push(item);
      continue;
    }
    if (!done) {
      next.push({ code, officeUid });
      done = true;
    }
  }
  if (!done) next.push({ code, officeUid });
  return next;
}

/** 挂在这处公司的线路号；officeUid 为空串时取所有还没挂的线路。 */
export function shuttlesForOffice(profile: CommuteProfile, officeUid: string): string[] {
  return (profile.shuttles ?? []).filter((item) => item.officeUid === officeUid).map((item) => item.code);
}
