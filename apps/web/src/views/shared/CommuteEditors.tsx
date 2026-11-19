import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  COMMUTE_ACCESS_LABEL,
  COMMUTE_ACCESS_ORDER,
  COMMUTE_VEHICLE_LABEL,
  COMMUTE_VEHICLE_ORDER,
  SHUTTLE_SEAT_LABEL,
  commuteOverview,
  formatCoord,
  isOfficeGeocoded,
  parseClock,
  type CommuteAccess,
  type CommuteHabit,
  type CommuteVehicle,
  type OfficeLocation,
  type ShuttleSeat,
} from "@house/core";
import { geoErrorMessage, searchGeo, type GeoPlace } from "@/lib/geoApi";
import { GlassTimePicker } from "@/components/GlassTimePicker";

/**
 * 通勤录入表单：公司地点一处一张表，通勤习惯一种一张表。
 * 桌面与手机共用同一份表单，字段全部受控，点保存才写服务器。
 */

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--glass-border-subtle)",
  background: "var(--card-inset-bg)",
  color: "var(--text-main)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid " + (active ? "var(--accent-cyan)" : "var(--glass-border-subtle)"),
    background: active ? "rgba(2,132,199,0.16)" : "transparent",
    color: active ? "var(--accent-cyan)" : "var(--text-sub)",
  };
}

function toNumber(raw: string, max: number): number {
  const value = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, Math.round(value));
}

interface ChipsProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

function Chips<T extends string>({ options, value, onChange }: ChipsProps<T>) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={chipStyle(option.value === value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="lb">{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{hint}</div> : null}
    </div>
  );
}

const SEAT_OPTIONS = (Object.keys(SHUTTLE_SEAT_LABEL) as ShuttleSeat[]).map((value) => ({
  value,
  label: SHUTTLE_SEAT_LABEL[value],
}));

const VEHICLE_OPTIONS = COMMUTE_VEHICLE_ORDER.map((value) => ({
  value,
  label: COMMUTE_VEHICLE_LABEL[value],
}));

const ACCESS_OPTIONS = COMMUTE_ACCESS_ORDER.map((value) => ({
  value,
  label: COMMUTE_ACCESS_LABEL[value],
}));

/** 每周天数直接点，省得手机上拉数字键盘。 */
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

/* ────────────────── 公司地点 ────────────────── */

export interface CommuteOfficeEditorProps {
  value: OfficeLocation;
  variant?: "desktop" | "mobile";
  onSubmit: (office: OfficeLocation) => void;
  onCancel: () => void;
}

/**
 * 高德选点：输入 ≥2 个字就搜（防抖 320ms），必须点中一条候选才有 poiId 与坐标。
 * 地址不存在「手填」这条路——手填的地址算不出里程，也校验不出到岗风险。
 */
function OfficeGeoPicker({ value, onPick }: { value: OfficeLocation; onPick: (place: GeoPlace) => void }) {
  const geocoded = isOfficeGeocoded(value);
  const [editing, setEditing] = useState(!geocoded);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!editing || q.length < 2) {
      setItems([]);
      setBusy(false);
      setError(null);
      return;
    }
    const ctl = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      searchGeo(q, { limit: 8, signal: ctl.signal })
        .then((rows) => {
          setItems(rows);
          setBusy(false);
        })
        .catch((err: unknown) => {
          if (ctl.signal.aborted) return;
          setBusy(false);
          setItems([]);
          setError(geoErrorMessage(err));
        });
    }, 320);
    return () => {
      ctl.abort();
      window.clearTimeout(timer);
    };
  }, [query, editing]);

  return (
    <div className="card-inset" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>公司地点（高德）</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>只能从高德结果里选，坐标会一起存下来</div>
      </div>

      {!editing && geocoded ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{value.poiName || value.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>
              {[value.district, value.address].filter(Boolean).join(" · ") || "高德未提供门牌地址"}
            </div>
            <div style={{ fontSize: 11, color: "var(--accent-cyan)", marginTop: 4 }}>已定位 {formatCoord(value)}</div>
          </div>
          <button
            type="button"
            className="g-btn"
            style={{ padding: "5px 10px", fontSize: 12 }}
            onClick={() => setEditing(true)}
          >
            重新选择
          </button>
        </div>
      ) : (
        <>
          <input
            style={inputStyle}
            value={query}
            placeholder="搜公司 / 楼宇 / 园区，如 望京SOHO"
            onChange={(event) => setQuery(event.target.value)}
          />
          {busy ? <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>正在查高德…</div> : null}
          {error ? <div style={{ fontSize: 11.5, color: "#dc2626" }}>{error}</div> : null}
          {!busy && !error && query.trim().length >= 2 && items.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>高德没有这个关键词的命中，换个说法再搜</div>
          ) : null}
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {items.map((place) => (
                <button
                  key={place.id || place.name + place.lng}
                  type="button"
                  onClick={() => {
                    onPick(place);
                    setEditing(false);
                    setQuery("");
                    setItems([]);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border-subtle)",
                    background: "var(--card-inset-bg)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{place.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
                    {[place.district || place.city, place.address].filter(Boolean).join(" · ") || "高德未提供门牌地址"}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function CommuteOfficeEditor({ value, variant = "desktop", onSubmit, onCancel }: CommuteOfficeEditorProps) {
  const [form, setForm] = useState(value);

  function patch(next: Partial<OfficeLocation>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  const geocoded = isOfficeGeocoded(form);

  const draft: OfficeLocation = {
    ...form,
    name: form.name.trim() || form.poiName.trim(),
    address: form.address.trim(),
    beIn: parseClock(form.beIn) === null ? "09:00" : form.beIn,
    note: form.note.trim(),
  };

  return (
    <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{value.name ? "编辑公司地点" : "新增公司地点"}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>到岗时刻是硬约束，通勤习惯按它判断会不会迟到</div>
      </div>

      <OfficeGeoPicker
        value={form}
        onPick={(place) =>
          patch({
            name: form.name.trim() || place.name,
            poiName: place.name,
            poiId: place.id,
            address: place.address,
            city: place.city,
            district: place.district,
            adcode: place.adcode,
            lng: place.lng,
            lat: place.lat,
          })
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: variant === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gap: 12,
        }}
      >
        <Field label="名称" hint="默认取高德 POI 名，可改成自己的叫法（如「望京总部」）">
          <input
            style={inputStyle}
            value={form.name}
            placeholder="选中地点后自动填"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field
          label="高德坐标"
          hint={geocoded ? "GCJ-02 六位小数，以后算通勤时长与里程直接用" : "先在上面的搜索结果里选中一处地点"}
        >
          <div
            style={{
              ...inputStyle,
              color: geocoded ? "var(--text-main)" : "var(--text-dim)",
              display: "flex",
              alignItems: "center",
              minHeight: 40,
            }}
          >
            {geocoded ? formatCoord(form) : "—"}
          </div>
        </Field>

        <Field label="到岗不晚于" hint="迟到判定、班车发车倒推都以它为准">
          <GlassTimePicker
            value={form.beIn}
            onChange={(next) => patch({ beIn: next })}
            placeholder="09:00"
            ariaLabel="到岗不晚于"
            hint="迟到判定基准"
            quickTimes={[{ time: "09:00", text: "09:00 到岗" }]}
          />
        </Field>

        <Field label="每周去几天" hint="混合办公填实际到岗天数，通勤时长按它累加">
          <Chips
            options={DAY_OPTIONS.map((day) => ({ value: String(day), label: day + " 天" }))}
            value={String(form.daysPerWeek)}
            onChange={(next) => patch({ daysPerWeek: Number(next) })}
          />
        </Field>
      </div>

      <Field label="备注">
        <input
          style={inputStyle}
          value={form.note}
          placeholder="如：门禁要提前一天报备"
          onChange={(event) => patch({ note: event.target.value })}
        />
      </Field>

      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="g-btn" onClick={onCancel}>
          取消
        </button>
        {geocoded ? null : (
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginRight: "auto" }}>
            还没选地点：先在「公司地点（高德）」里搜到并选中一处
          </div>
        )}
        <button
          type="button"
          className="g-btn g-btn-primary"
          disabled={!geocoded}
          title={geocoded ? "" : "先在搜索结果里选中一处地点"}
          onClick={() => onSubmit(draft)}
        >
          保存公司地点
        </button>
      </div>
    </div>
  );
}

/* ────────────────── 通勤习惯 ────────────────── */

export interface CommuteHabitEditorProps {
  value: CommuteHabit;
  offices: OfficeLocation[];
  /** 家庭成员：先选公司地点，再选这条习惯是谁的 */
  members?: Array<{ uid: string; name: string }>;
  variant?: "desktop" | "mobile";
  onSubmit: (habit: CommuteHabit) => void;
  onCancel: () => void;
}

export function CommuteHabitEditor({ value, offices, members = [], variant = "desktop", onSubmit, onCancel }: CommuteHabitEditorProps) {
  const [form, setForm] = useState(value);

  function patch(next: Partial<CommuteHabit>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function patchShuttle(next: Partial<NonNullable<CommuteHabit["shuttle"]>>) {
    setForm((prev) => {
      const base = prev.shuttle ?? {
        line: "",
        stop: "",
        depart: "",
        arrive: "",
        seat: "unknown" as ShuttleSeat,
        lastReturn: "",
        toGate: true,
        note: "",
      };
      return { ...prev, shuttle: { ...base, ...next } };
    });
  }

  function changeVehicle(next: CommuteVehicle) {
    setForm((prev) => ({
      ...prev,
      vehicle: next,
      shuttle:
        next === "shuttle"
          ? prev.shuttle ?? { line: "", stop: "", depart: "", arrive: "", seat: "unknown" as ShuttleSeat, lastReturn: "", toGate: true, note: "" }
          : null,
    }));
  }

  const draft: CommuteHabit = {
    ...form,
    label: form.label.trim(),
    // 单程时长不在这里填：挂到具体小区后由路线算出来，保存只带回去，别被空表单抹成 0
    minutes: form.minutes,
    daysPerWeek: toNumber(String(form.daysPerWeek), 7) || 0,
    note: form.note.trim(),
    shuttle:
      form.vehicle === "shuttle" && form.shuttle
        ? {
            ...form.shuttle,
            line: form.shuttle.line.trim(),
            stop: form.shuttle.stop.trim(),
            note: form.shuttle.note.trim(),
          }
        : null,
  };

  // 告警直接用 core 的口径算，页面不自己判迟到
  const preview = commuteOverview({ offices, habits: [draft], shuttles: [] }).views[0];
  return (
    <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{value.label ? "编辑通勤习惯" : "新增通勤习惯"}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {value.primary ? "主用方案 · 全局只有一条" : "可加多条：班车、地铁、自驾各记一条互相兜底"}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
        这是通勤模板：单程时长、几点出门都取决于起点落在哪个小区——挂到具体小区（楼盘详情 → 通勤路线）后按高德驾车规划算。这里只记终点公司、走法、班车时刻和到岗约束。
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: variant === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gap: 12,
        }}
      >
        <Field label="家庭成员" hint={members.length ? "这条习惯算谁的：通勤时长与迟到按他的到岗时刻算" : "先去「收入与公积金」加家庭成员"}>
          {members.length ? (
            <Chips
              options={members.map((member) => ({ value: member.uid, label: member.name }))}
              value={form.memberUid}
              onChange={(next) => patch({ memberUid: next })}
            />
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>暂无家庭成员</div>
          )}
        </Field>

        <Field label="习惯名称" hint="留空就按交通方式叫">
          <input
            style={inputStyle}
            value={form.label}
            placeholder="如：早班车 / 地铁 15 号线"
            onChange={(event) => patch({ label: event.target.value })}
          />
        </Field>

        <Field label="交通方式">
          <Chips options={VEHICLE_OPTIONS} value={form.vehicle} onChange={changeVehicle} />
        </Field>

        <div
          className="card-inset"
          style={{
            gridColumn: variant === "desktop" ? "1 / -1" : undefined,
            padding: "10px 14px",
            fontSize: 11.5,
            lineHeight: 1.6,
            color: "var(--text-dim)",
          }}
        >
          单程时长和出门时刻不在这里填：它们取决于起点落在哪个小区。挂到具体小区后，在「楼盘详情 → 通勤路线」按高德驾车规划算出来，模板先空着。
        </div>

        <Field label="每周用几天">
          <Chips
            options={DAY_OPTIONS.map((day) => ({ value: String(day), label: day + " 天" }))}
            value={String(form.daysPerWeek)}
            onChange={(next) => patch({ daysPerWeek: Number(next) })}
          />
        </Field>

        <Field
          label="到岗时刻"
          hint="留空就按公司地点里的「到岗不晚于」判断迟到；班车、自驾这种有确定到岗时刻的才填"
        >
          <GlassTimePicker
            value={form.arriveWork}
            onChange={(next) => patch({ arriveWork: next })}
            placeholder="留空按公司到岗"
            ariaLabel="到岗时刻"
            hint="迟到判定"
            allowClear
          />
        </Field>

        <Field label="适用公司" hint="终点：去哪处公司。通用就留空，只有一处公司时自动套用；起点等选房后再算">
          <Chips
            options={[{ value: "", label: "通用" }, ...offices.map((office) => ({ value: office.uid, label: office.name || "未命名公司" }))]}
            value={form.officeUid}
            onChange={(next) => patch({ officeUid: next })}
          />
        </Field>

        <Field label="是否主用方案" hint="主用方案用于首页概要；保存时别的习惯会自动取消主用">
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => patch({ primary: true })} style={chipStyle(form.primary)}>
              主用
            </button>
            <button type="button" onClick={() => patch({ primary: false })} style={chipStyle(!form.primary)}>
              备选
            </button>
          </div>
        </Field>
      </div>

      {form.vehicle === "transit" ? (
        <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>接驳方式</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>公共交通两头的短途：骑车还是走过去</div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: variant === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
              gap: 12,
            }}
          >
            <Field label="家 → 公交/地铁站" hint="出门到上车这一段">
              <Chips
                options={ACCESS_OPTIONS}
                value={form.accessHome}
                onChange={(next) => patch({ accessHome: next as CommuteAccess })}
              />
            </Field>
            <Field label="出站 → 公司" hint="下车到坐到工位这一段">
              <Chips
                options={ACCESS_OPTIONS}
                value={form.accessWork}
                onChange={(next) => patch({ accessWork: next as CommuteAccess })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {form.vehicle === "shuttle" ? (
        <Field label="家 → 上车站点" hint="到班车上车点这一段：骑电动自行车还是走过去">
          <Chips
            options={ACCESS_OPTIONS}
            value={form.accessHome}
            onChange={(next) => patch({ accessHome: next as CommuteAccess })}
          />
        </Field>
      ) : null}

      {form.vehicle === "shuttle" ? (
        <div className="card-inset" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>班车信息</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>发车时刻决定你几点必须到站点</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: variant === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
              gap: 12,
            }}
          >
            <Field label="线路">
              <input
                style={inputStyle}
                value={form.shuttle?.line ?? ""}
                placeholder="如：望京线 / 快专 3 路"
                onChange={(event) => patchShuttle({ line: event.target.value })}
              />
            </Field>

            <Field label="上车站点">
              <input
                style={inputStyle}
                value={form.shuttle?.stop ?? ""}
                placeholder="如：天通苑北 B 口"
                onChange={(event) => patchShuttle({ stop: event.target.value })}
              />
            </Field>

            <Field label="发车时刻" hint="错过这班要么打车要么地铁">
              <GlassTimePicker
                value={form.shuttle?.depart ?? ""}
                onChange={(next) => patchShuttle({ depart: next })}
                placeholder="07:30"
                ariaLabel="班车发车时刻"
                hint="班车时刻倒推"
                allowClear
              />
            </Field>

            <Field label="到公司时刻">
              <GlassTimePicker
                value={form.shuttle?.arrive ?? ""}
                onChange={(next) => patchShuttle({ arrive: next })}
                placeholder="08:40"
                ariaLabel="班车到公司时刻"
                hint="到岗时刻"
                allowClear
              />
            </Field>

            <Field label="座位规则">
              <Chips
                options={SEAT_OPTIONS}
                value={form.shuttle?.seat ?? "unknown"}
                onChange={(next) => patchShuttle({ seat: next })}
              />
            </Field>

            <Field label="返程末班" hint="空着表示没有返程班车或还没查">
              <GlassTimePicker
                value={form.shuttle?.lastReturn ?? ""}
                onChange={(next) => patchShuttle({ lastReturn: next })}
                placeholder="19:30"
                ariaLabel="返程末班时刻"
                hint="末班返程"
                allowClear
              />
            </Field>

            <Field label="下车点">
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => patchShuttle({ toGate: true })}
                  style={chipStyle(form.shuttle?.toGate !== false)}
                >
                  直接到公司门口
                </button>
                <button
                  type="button"
                  onClick={() => patchShuttle({ toGate: false })}
                  style={chipStyle(form.shuttle?.toGate === false)}
                >
                  还要走一段
                </button>
              </div>
            </Field>

            <Field label="班车备注">
              <input
                style={inputStyle}
                value={form.shuttle?.note ?? ""}
                placeholder="如：周一发车提前 10 分钟"
                onChange={(event) => patchShuttle({ note: event.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <Field label="备注">
        <input
          style={inputStyle}
          value={form.note}
          placeholder="如：下雨天改成地铁"
          onChange={(event) => patch({ note: event.target.value })}
        />
      </Field>

      {preview && preview.warnings.length > 0 ? (
        <div
          className="card-inset"
          style={{ padding: "10px 14px", fontSize: 12, lineHeight: 1.7, color: "var(--text-sub)" }}
        >
          {preview.warnings.map((warning) => (
            <div key={warning}>· {warning}</div>
          ))}
        </div>
      ) : null}

      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="g-btn" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="g-btn g-btn-primary" onClick={() => onSubmit(draft)}>
          保存通勤习惯
        </button>
      </div>
    </div>
  );
}

/* ────────────────── 整页容器 ────────────────── */

interface EditorPageShellProps {
  title: string;
  subtitle: string;
  variant: "desktop" | "mobile";
  onBack: () => void;
  /** 编辑已有条目时才给：删除动作放在录入页底部，列表里不再放删除按钮 */
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}

/** 录入子页面整页接管通勤页，返回即回列表，不在列表里内联展开表单。 */
function EditorPageShell({ title, subtitle, variant, onBack, onRemove, removeLabel = "删除", children }: EditorPageShellProps) {
  return (
    <>
      {variant === "mobile" ? (
        <div className="m-nav-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="m-nav-circle-btn"
              onClick={onBack}
              title="返回"
              style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}
            >
              ‹
            </button>
            <h1 className="m-nav-title" style={{ fontSize: 20 }}>
              {title}
            </h1>
          </div>
          <div className="m-nav-actions" />
        </div>
      ) : (
        <div
          className="glass"
          style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}
        >
          <button type="button" className="g-btn" onClick={onBack} style={{ padding: "6px 12px", fontSize: 13 }}>
            ‹ 返回
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{subtitle}</div>
          </div>
        </div>
      )}
      {children}
      {onRemove ? (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="g-btn g-btn-danger"
            style={{ width: "100%", padding: "11px 14px", fontSize: 13 }}
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}

export interface CommuteOfficePageProps {
  office: OfficeLocation;
  isNew: boolean;
  variant?: "desktop" | "mobile";
  onSubmit: (office: OfficeLocation) => void;
  onBack: () => void;
  /** 编辑已有地点时给：删除按钮显示在录入页底部 */
  onRemove?: () => void;
}

export function CommuteOfficePage({ office, isNew, variant = "desktop", onSubmit, onBack, onRemove }: CommuteOfficePageProps) {
  return (
    <EditorPageShell
      title={isNew ? "添加公司地点" : "编辑公司地点"}
      subtitle="到岗时刻与每周天数会影响每种通勤是否来得及，保存后概要随即更新。"
      variant={variant}
      onBack={onBack}
      onRemove={isNew ? undefined : onRemove}
      removeLabel="删除这个公司地点"
    >
      <CommuteOfficeEditor key={office.uid} value={office} variant={variant} onSubmit={onSubmit} onCancel={onBack} />
    </EditorPageShell>
  );
}

export interface CommuteHabitPageProps {
  habit: CommuteHabit;
  offices: OfficeLocation[];
  members?: Array<{ uid: string; name: string }>;
  isNew: boolean;
  variant?: "desktop" | "mobile";
  onSubmit: (habit: CommuteHabit) => void;
  onBack: () => void;
  /** 编辑已有习惯时给：删除按钮显示在录入页底部 */
  onRemove?: () => void;
}

export function CommuteHabitPage({ habit, offices, members = [], isNew, variant = "desktop", onSubmit, onBack, onRemove }: CommuteHabitPageProps) {
  const isShuttle = habit.vehicle === "shuttle";
  return (
    <EditorPageShell
      title={isNew ? (isShuttle ? "添加班车通勤" : "添加通勤习惯") : "编辑通勤习惯"}
      subtitle="一条习惯＝一种走法：班车记线路与发车时刻，地铁记时长与备用换乘，自驾记路况。"
      variant={variant}
      onBack={onBack}
      onRemove={isNew ? undefined : onRemove}
      removeLabel="删除这条通勤习惯"
    >
      <CommuteHabitEditor
        key={habit.uid}
        value={habit}
        offices={offices}
        members={members}
        variant={variant}
        onSubmit={onSubmit}
        onCancel={onBack}
      />
    </EditorPageShell>
  );
}
