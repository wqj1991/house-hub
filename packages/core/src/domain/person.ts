/** 人：一切属性都是行，不是列。 */
export interface Person {
  uid: string;
  name: string;
  role: "member" | "child" | "elder";
  createdAt?: string;
}

/** 锚点：到岗/到厂时刻，不是上班时间。 */
export interface Anchor {
  uid: string;
  personUid: string;
  label: string;
  lng: number;
  lat: number;
  beIn: string | null;
  daysPerWeek: number;
  kind: "work" | "school" | "other";
}

export type CommuteMode = "shuttle" | "bike" | "drive" | "transit";

export interface Mode {
  uid: string;
  personUid: string;
  kind: CommuteMode;
}

export interface JifenRow {
  personUid: string;
  year: number;
  itemKey: string;
  value: number | null;
  note: string | null;
}
