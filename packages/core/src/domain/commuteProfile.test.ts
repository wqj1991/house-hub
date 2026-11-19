import { describe, expect, it } from "vitest";
import {
  COMMUTE_ROUTE_MODE_ORDER,
  commuteRouteMode,
  defaultHabit,
  habitForOffice,
  habitOffice,
} from "./commuteProfile";
import type { CommuteHabit, OfficeLocation } from "./commuteProfile";

/** 只填测试用得到的字段：其它字段给空值，避免用例被无关默认值牵着走。 */
function habit(patch: Partial<CommuteHabit> = {}): CommuteHabit {
  return {
    uid: "cm-1",
    label: "",
    vehicle: "transit",
    minutes: 0,
    departHome: "",
    arriveWork: "",
    daysPerWeek: 5,
    primary: false,
    officeUid: "",
    memberUid: "",
    accessHome: "walk",
    accessWork: "walk",
    shuttle: null,
    note: "",
    ...patch,
  };
}

function office(patch: Partial<OfficeLocation> = {}): OfficeLocation {
  return {
    uid: "off-1",
    name: "望京总部",
    address: "",
    poiId: "B000A83M61",
    poiName: "望京 SOHO",
    lng: 116.481,
    lat: 39.996,
    city: "北京市",
    district: "朝阳区",
    adcode: "110105",
    beIn: "09:00",
    daysPerWeek: 5,
    note: "",
    ...patch,
  };
}

describe("commuteRouteMode", () => {
  it("把习惯的走法折成地图画得出来的四种", () => {
    expect(commuteRouteMode("transit")).toBe("transit");
    expect(commuteRouteMode("drive")).toBe("drive");
    expect(commuteRouteMode("walk")).toBe("walk");
    expect(commuteRouteMode("ebike")).toBe("bike");
  });

  it("班车没有连续折线，退回驾车给里程参照", () => {
    expect(commuteRouteMode("shuttle")).toBe("drive");
    expect(COMMUTE_ROUTE_MODE_ORDER).toContain(commuteRouteMode("shuttle"));
  });
});

describe("defaultHabit", () => {
  it("优先标了 primary 的那条", () => {
    const first = habit({ uid: "cm-metro" });
    const main = habit({ uid: "cm-shuttle", vehicle: "shuttle", primary: true });
    expect(defaultHabit([first, main])?.uid).toBe("cm-shuttle");
  });

  it("一条都没有时返回 null，多条都没标就用第一条", () => {
    expect(defaultHabit([])).toBeNull();
    expect(defaultHabit([habit({ uid: "cm-a" }), habit({ uid: "cm-b" })])?.uid).toBe("cm-a");
  });
});

describe("habitOffice", () => {
  const offices = [office({ uid: "off-1" }), office({ uid: "off-2", name: "大兴工厂" })];

  it("习惯指定了公司就取那处", () => {
    expect(habitOffice(habit({ officeUid: "off-2" }), offices)?.uid).toBe("off-2");
  });

  it("通用习惯（officeUid 为空）落到第一处", () => {
    expect(habitOffice(habit(), offices)?.uid).toBe("off-1");
  });

  it("指向的公司被删了就返回 null，不偷换成别的公司", () => {
    expect(habitOffice(habit({ officeUid: "off-gone" }), offices)).toBeNull();
    expect(habitOffice(null, offices)).toBeNull();
  });
});

describe("habitForOffice", () => {
  const metro = habit({ uid: "cm-metro", officeUid: "off-1" });
  const shuttle = habit({ uid: "cm-shuttle", vehicle: "shuttle", officeUid: "off-1", primary: true });
  const generic = habit({ uid: "cm-generic", officeUid: "", primary: true });

  it("主用习惯指向这处公司时用它，哪怕公司下还有别的习惯", () => {
    expect(habitForOffice([metro, shuttle], "off-1")?.uid).toBe("cm-shuttle");
  });

  it("主用是通用习惯时，任何公司都用它", () => {
    expect(habitForOffice([habit({ uid: "cm-b", officeUid: "off-2" }), generic], "off-2")?.uid).toBe("cm-generic");
  });

  it("主用指向别处公司时，换成这处公司自己的习惯", () => {
    const other = habit({ uid: "cm-other", officeUid: "off-9", primary: true });
    expect(habitForOffice([other, metro], "off-1")?.uid).toBe("cm-metro");
  });

  it("一处都没挂习惯时返回 null", () => {
    const other = habit({ uid: "cm-other", officeUid: "off-9", primary: true });
    expect(habitForOffice([other], "off-1")).toBeNull();
    expect(habitForOffice([], "off-1")).toBeNull();
  });
});
