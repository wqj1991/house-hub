/** 待选 / 清单 / 班车：人的判断与只读下发。 */
export interface ShortlistEntry {
  uid: string;
  communityUid: string;
  addedAt: string;
  note: string | null;
  verdict: string | null;
}

export type CheckKind = "redline" | "due" | "tour" | "ask" | "contract" | "flow";

export interface CheckRow {
  kind: CheckKind;
  itemKey: string;
  checked: boolean;
  note: string | null;
  updatedAt: string | null;
}

export interface ShuttleLine {
  uid: string;
  name: string;
  plate: string | null;
  driver: string | null;
  arriveFactory: string | null;
  direction: "am" | "pm";
  active: boolean;
}

export interface Stop {
  uid: string;
  lineUid: string;
  seq: number;
  name: string;
  lng: number;
  lat: number;
  depart: string | null;
  /** listed = 时刻表给的；inferred = 推定（误差 200–500m） */
  coordSource: "listed" | "inferred";
}
