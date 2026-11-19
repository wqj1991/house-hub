import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { geoErrorMessage, searchGeo, type GeoPlace } from "@/lib/geoApi";
import {
  blankShuttleLine,
  blankShuttleStop,
  loadShuttleLib,
  runShuttleWrite,
  saveShuttleLine,
  saveShuttleStops,
  removeShuttleLine,
  useShuttleLib,
  type ShuttleLineInput,
  type ShuttleLineView,
  type ShuttleStopInput,
} from "@/lib/shuttleLib";
import { SHUTTLE_TERMINAL } from "@house/core";
import { showToast } from "@/lib/toast";
import { AmapRouteMap } from "../../components/AmapRouteMap";
import { RowChevron } from "../../components/RowChevron";
import { GlassTimePicker } from "../../components/GlassTimePicker";

/**
 * 班车维护：通勤档案里的一块，管的是「每个公司地点下面挂哪几条班车线」。
 *
 * 线路本体（车号、司机、站点时刻）住服务端 line / stop 表；「挂在哪处公司」记在
 * 通勤档案的 shuttles 里，所以换公司只改一条归属，删公司也只是退回「未分配」。
 * 一行＝一条线路，点进去能改线路号、所属公司、司机电话车牌、到公司时刻与全部上客点。
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="lb">{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{hint}</div> : null}
    </div>
  );
}

function coordText(stop: ShuttleStopInput): string {
  const has = Number.isFinite(stop.lng) && Number.isFinite(stop.lat) && (stop.lng !== 0 || stop.lat !== 0);
  return has ? stop.lng.toFixed(6) + "," + stop.lat.toFixed(6) : "未定位";
}

function hasCoord(stop: ShuttleStopInput): boolean {
  return Number.isFinite(stop.lng) && Number.isFinite(stop.lat) && (stop.lng !== 0 || stop.lat !== 0);
}

/* ────────────────── 整页外壳 ────────────────── */

function PageShell({
  title,
  subtitle,
  variant,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  variant: "desktop" | "mobile";
  onBack: () => void;
  children: ReactNode;
}) {
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
        <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}>
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
    </>
  );
}

/* ────────────────── 线路列表 ────────────────── */

function LineRow({
  line,
  variant,
  onEdit,
  onRemove,
}: {
  line: ShuttleLineView;
  variant: "desktop" | "mobile";
  onEdit: () => void;
  onRemove: () => void;
}) {
  const first = line.stops[0];
  const card = (
    <div
      className="card-inset"
      role={variant === "mobile" ? "button" : undefined}
      tabIndex={variant === "mobile" ? 0 : undefined}
      onClick={variant === "mobile" ? onEdit : undefined}
      onKeyDown={variant === "mobile" ? (event) => (event.key === "Enter" || event.key === " ") && onEdit() : undefined}
      style={{
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: variant === "mobile" ? "pointer" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div
              onClick={onEdit}
              style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, opacity: line.active ? 1 : 0.55, minWidth: 0 }}
            >
              {line.code} {line.name}
              {line.active ? null : <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>（停用）</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", flexShrink: 0 }}>
              {first?.depart || "—"} → {line.arrive || "—"} · {line.stops.length} 站
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            司机 {line.driver || "—"} {line.phone} · {line.plate || "无车牌"}
          </div>
        </div>
        {variant === "mobile" ? <RowChevron /> : null}
      </div>
      {variant === "mobile" ? null : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="g-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={onEdit}>
            编辑
          </button>
          <button
            type="button"
            className="g-btn"
            style={{ padding: "4px 12px", fontSize: 12, color: "#dc2626" }}
            onClick={() => onRemove()}
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
  return card;
}

export interface ShuttleOfficeOption {
  uid: string;
  name: string;
}

/**
 * 通勤详情页里的「班车线路」板块：按公司地点分组陈列，
 * 每组下面就是这个公司能坐的线路；没挂公司的线路单独一组提醒。
 */
export function ShuttleBoard({
  variant = "desktop",
  offices,
  bindings,
  onEdit,
  onAdd,
}: {
  variant?: "desktop" | "mobile";
  offices: ShuttleOfficeOption[];
  bindings: { code: string; officeUid: string }[];
  onEdit: (code: string, officeUid: string) => void;
  onAdd: (officeUid: string) => void;
}) {
  const { lib, phase, error } = useShuttleLib();
  const lines = lib?.lines ?? [];
  const known = new Set(offices.map((office) => office.uid));

  /** 线路归属于哪处公司；指向已删公司的 uid 一律当「未分配」，跟服务端一致。 */
  const officeOf = (code: string): string => {
    const uid = bindings.find((row) => row.code === code)?.officeUid ?? "";
    return uid && known.has(uid) ? uid : "";
  };

  const drop = async (line: ShuttleLineView) => {
    if (!window.confirm("删掉 " + line.code + " " + line.name + " 以及它的 " + line.stops.length + " 个站点？")) return;
    try {
      await runShuttleWrite(() => removeShuttleLine(line.code));
      showToast("已删除 " + line.code);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const renderLines = (codes: string[]) =>
    codes.map((code) => {
      const line = lines.find((row) => row.code === code);
      if (!line) return null;
      const officeUid = officeOf(code);
      return (
        <LineRow
          key={code}
          line={line}
          variant={variant}
          onEdit={() => onEdit(code, officeUid)}
          onRemove={() => void drop(line)}
        />
      );
    });

  const unassigned = lines.filter((line) => officeOf(line.code) === "").map((line) => line.code);

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className={variant === "mobile" ? "lb" : undefined} style={variant === "mobile" ? { margin: 0 } : { fontSize: 15, fontWeight: 800 }}>班车线路</div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>
            {lib
              ? lib.lines.length + " 条线 · " + lib.stopCount + " 个上客点 · 终点 " + lib.terminal.name
              : error ?? (phase === "loading" ? "正在读线路库…" : "还没读到线路")}
          </div>
        </div>
        {offices.length > 0 ? (
          <button
            type="button"
            className="g-btn"
            style={{ padding: "6px 14px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => onAdd("")}
          >
            ＋ 新增
          </button>
        ) : null}
      </div>

      {error && !lib ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "#dc2626" }}>{error}</span>
          <button type="button" className="g-btn" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => void loadShuttleLib()}>
            重试
          </button>
        </div>
      ) : null}

      {offices.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
          还没有公司地点：先在上面「公司地点」卡片加一处，班车线路要挂在公司下面。
        </div>
      ) : null}

      {offices.map((office) => {
        const codes = lines.filter((line) => officeOf(line.code) === office.uid).map((line) => line.code);
        return (
          <div key={office.uid} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="lb" style={{ margin: 0 }}>
              {office.name || "未命名公司"} · {codes.length} 条
            </div>
            {codes.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>这处公司还没有班车线路</div>
            ) : (
              renderLines(codes)
            )}
          </div>
        );
      })}

      {unassigned.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="lb" style={{ margin: 0, color: "#dc2626" }}>
            未分配公司 · {unassigned.length} 条
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>点开线路，在「所属公司地点」里选一处挂上。</div>
          {renderLines(unassigned)}
        </div>
      ) : null}
    </div>
  );

  return variant === "mobile" ? (
    <div className="m-card glass">{body}</div>
  ) : (
    <div className="glass" style={{ padding: "18px 22px", borderRadius: 18 }}>
      {body}
    </div>
  );
}

/* ────────────────── 站点高德定位 ────────────────── */

function StopGeoPicker({ onPick, onClose }: { onPick: (place: GeoPlace) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeoPlace[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setError(null);
      return;
    }
    const ctl = new AbortController();
    timer.current = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      searchGeo(q, { limit: 8, signal: ctl.signal })
        .then((rows) => setItems(rows))
        .catch((err) => {
          if (ctl.signal.aborted) return;
          setItems([]);
          setError(geoErrorMessage(err));
        })
        .finally(() => setBusy(false));
    }, 320);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      ctl.abort();
    };
  }, [query]);

  return (
    <div className="card-inset" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          autoFocus
          value={query}
          placeholder="搜站点（≥2 字，如 天通苑）"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="g-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onClose}>
          取消
        </button>
      </div>
      {busy ? <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>搜索中…</div> : null}
      {error ? <div style={{ fontSize: 11.5, color: "#dc2626" }}>{error}</div> : null}
      {!busy && !error && query.trim().length >= 2 && items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>没有命中，换个说法试试</div>
      ) : null}
      {items.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => onPick(place)}
          style={{
            textAlign: "left",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--glass-border-subtle)",
            background: "transparent",
            color: "inherit",
            fontFamily: "inherit",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{place.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {place.district}
            {place.address ? " · " + place.address : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ────────────────── 线路 + 站点编辑 ────────────────── */

export function ShuttleLinePage({
  variant,
  code,
  offices,
  officeUid: initialOfficeUid,
  onBack,
  onSaved,
}: {
  variant: "desktop" | "mobile";
  code: string | null;
  /** 可选的公司地点：线路必须挂在其中一处 */
  offices: ShuttleOfficeOption[];
  /** 进来时已经挂着的公司；空串＝还没挂 */
  officeUid: string;
  onBack: () => void;
  /** 保存成功后把「线路号 + 选中的公司」交回去，由通勤档案写归属 */
  onSaved: (code: string, officeUid: string) => void;
}) {
  const { lib } = useShuttleLib();
  const isNew = code === null;
  const source = isNew ? null : (lib?.lines.find((line) => line.code === code) ?? null);
  /** 新建时默认预选一处公司：优先名字含「施耐德」的那处（默认线路都挂它），否则第一处。 */
  const [officeUid, setOfficeUid] = useState(() => {
    if (offices.some((office) => office.uid === initialOfficeUid)) return initialOfficeUid;
    const preferred = offices.find((office) => office.name.includes("施耐德")) ?? offices[0];
    return preferred ? preferred.uid : "";
  });

  const [form, setForm] = useState<ShuttleLineInput>(() =>
    source
      ? {
          code: source.code,
          name: source.name,
          driver: source.driver,
          phone: source.phone,
          plate: source.plate,
          arrive: source.arrive,
          active: source.active,
        }
      : blankShuttleLine(),
  );
  const [stops, setStops] = useState<ShuttleStopInput[]>(() =>
    source ? source.stops.map((stop) => ({ name: stop.name, depart: stop.depart, lng: stop.lng, lat: stop.lat })) : [],
  );
  const [geoIndex, setGeoIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const patch = (next: Partial<ShuttleLineInput>) => setForm((prev) => ({ ...prev, ...next }));

  const patchStop = (index: number, next: Partial<ShuttleStopInput>) =>
    setStops((prev) => prev.map((stop, at) => (at === index ? { ...stop, ...next } : stop)));

  const moveStop = (index: number, delta: number) =>
    setStops((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = prev.slice();
      const [row] = copy.splice(index, 1);
      copy.splice(target, 0, row);
      return copy;
    });

  const submit = async () => {
    if (!form.name.trim()) {
      showToast("线路名不能为空");
      return;
    }
    if (isNew && !/^[A-Za-z][0-9]{1,3}$/.test(form.code.trim())) {
      showToast("线路号形如 Y06");
      return;
    }
    if (!officeUid) {
      showToast(offices.length === 0 ? "先回通勤页加一处公司地点，班车要挂在公司下面" : "选一处所属公司地点");
      return;
    }
    const withName = stops.filter((stop) => stop.name.trim().length > 0);
    let savedCode = form.code.trim().toUpperCase();
    setBusy(true);
    try {
      await runShuttleWrite(async () => {
        const saved = await saveShuttleLine({ ...form, code: (isNew ? form.code : form.code).trim().toUpperCase() }, isNew);
        savedCode = saved.code;
        if (withName.length > 0 || !isNew) await saveShuttleStops(saved.code, withName);
      });
      showToast(isNew ? "线路已新增" : "线路已保存");
      onSaved(savedCode, officeUid);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy;

  const formBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field
        label="所属公司地点"
        hint={offices.length === 0 ? "还没有公司地点：先回通勤页录一处" : "班车挂在公司下面；公司删了，线路会退回「未分配」"}
      >
        {offices.length === 0 ? (
          <div style={{ fontSize: 12, color: "#dc2626" }}>还没有公司地点</div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {offices.map((office) => (
              <button
                key={office.uid}
                type="button"
                onClick={() => setOfficeUid(office.uid)}
                style={chipStyle(officeUid === office.uid)}
              >
                {office.name || "未命名公司"}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: variant === "mobile" ? "1fr" : "1fr 2fr", gap: 12 }}>
        <Field label="线路号" hint={isNew ? "形如 Y06，保存后不可改" : "线路号建好后不能改"}>
          <input
            style={{ ...inputStyle, ...(isNew ? {} : { opacity: 0.6 }) }}
            value={form.code}
            disabled={!isNew}
            placeholder="Y06"
            onChange={(event) => patch({ code: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="线路名">
          <input style={inputStyle} value={form.name} placeholder="北五环线" onChange={(event) => patch({ name: event.target.value })} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: variant === "mobile" ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        <Field label="到公司时刻">
          <GlassTimePicker
            value={form.arrive}
            onChange={(next) => patch({ arrive: next })}
            placeholder="07:45"
            ariaLabel="到公司时刻"
            hint="班车时刻倒推"
            allowClear
          />
        </Field>
        <Field label="司机">
          <input style={inputStyle} value={form.driver} placeholder="张亮善" onChange={(event) => patch({ driver: event.target.value })} />
        </Field>
        <Field label="电话">
          <input style={inputStyle} value={form.phone} placeholder="138…" onChange={(event) => patch({ phone: event.target.value })} />
        </Field>
        <Field label="车牌">
          <input style={inputStyle} value={form.plate} placeholder="京B17835D" onChange={(event) => patch({ plate: event.target.value })} />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="lb" style={{ margin: 0 }}>
          跑不跑
        </div>
        <button type="button" onClick={() => patch({ active: true })} style={chipStyle(form.active)}>
          在跑
        </button>
        <button type="button" onClick={() => patch({ active: false })} style={chipStyle(!form.active)}>
          停用
        </button>
      </div>
    </div>
  );

  const stopsBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div className="lb" style={{ margin: 0 }}>
          上客点（按发车顺序）
        </div>
        <button
          type="button"
          className="g-btn"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => setStops((prev) => [...prev, blankShuttleStop()])}
        >
          ＋ 加站点
        </button>
      </div>

      {stops.length === 0 ? <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>还没有站点，点「＋ 加站点」开始。</div> : null}

      {stops.map((stop, index) => (
        <div key={index} className="card-inset" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", width: 18, textAlign: "center" }}>{index + 1}</div>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={stop.name}
              placeholder="站点名（如 天通苑）"
              onChange={(event) => patchStop(index, { name: event.target.value })}
            />
            <div style={{ width: 118 }}>
              <GlassTimePicker
                value={stop.depart}
                onChange={(next) => patchStop(index, { depart: next })}
                placeholder="06:20"
                ariaLabel="站点发车时刻"
                hint="站点发车"
                allowClear
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: hasCoord(stop) ? "var(--text-sub)" : "#dc2626" }}>
              {hasCoord(stop) ? "坐标 " + coordText(stop) : "还没定位坐标"}
            </span>
            <button
              type="button"
              className="g-btn"
              style={{ padding: "3px 10px", fontSize: 11.5 }}
              onClick={() => setGeoIndex(geoIndex === index ? null : index)}
            >
              高德定位
            </button>
            <button type="button" className="g-btn" style={{ padding: "3px 8px", fontSize: 11.5 }} onClick={() => moveStop(index, -1)}>
              ↑
            </button>
            <button type="button" className="g-btn" style={{ padding: "3px 8px", fontSize: 11.5 }} onClick={() => moveStop(index, 1)}>
              ↓
            </button>
            <button
              type="button"
              className="g-btn"
              style={{ padding: "3px 8px", fontSize: 11.5, color: "#dc2626" }}
              onClick={() => setStops((prev) => prev.filter((_, at) => at !== index))}
            >
              删
            </button>
          </div>
          {geoIndex === index ? (
            <StopGeoPicker
              onClose={() => setGeoIndex(null)}
              onPick={(place) => {
                patchStop(index, {
                  name: stop.name.trim() ? stop.name : place.name,
                  lng: place.lng,
                  lat: place.lat,
                });
                setGeoIndex(null);
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );

  /** 地图只认有坐标的站，且把真实站序写进名字里，免得和「跳过没定位的站」后的编号打岔。 */
  const mapStops = stops
    .map((stop, index) => ({ stop, index }))
    .filter((row) => hasCoord(row.stop))
    .map((row) => ({
      name: row.index + 1 + " " + (row.stop.name.trim() || "未命名"),
      depart: row.stop.depart,
      lng: row.stop.lng,
      lat: row.stop.lat,
    }));
  const terminalPoint = lib?.terminal ?? SHUTTLE_TERMINAL;

  const mapBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div className="lb" style={{ margin: 0 }}>
          这条线怎么走
        </div>
        <button
          type="button"
          className="g-btn"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => setShowMap((prev) => !prev)}
        >
          {showMap ? "收起地图" : "看路线图"}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
        按上面的站点顺序由服务端逐段问高德驾车规划，拼出能照着开的真实路径；改了坐标再点开就是新的。
      </div>
      {showMap ? (
        <AmapRouteMap
          stops={mapStops}
          terminal={terminalPoint}
          height={variant === "mobile" ? 300 : 420}
          title={(form.code || "新线路") + " " + (form.name || "班车路线")}
        />
      ) : null}
    </div>
  );

  const drop = async () => {
    if (!source) return;
    if (!window.confirm("删掉 " + source.code + " " + source.name + " 以及它的 " + source.stops.length + " 个站点？")) return;
    try {
      await runShuttleWrite(() => removeShuttleLine(source.code));
      showToast("已删除 " + source.code);
      onBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const footer = (
    <div style={{ display: "flex", gap: 10 }}>
      <button
        type="button"
        className="g-btn"
        style={{ padding: "8px 18px", fontSize: 13, opacity: disabled ? 0.6 : 1 }}
        onClick={() => void submit()}
        disabled={disabled}
      >
        {disabled ? "保存中…" : isNew ? "保存新线路" : "保存"}
      </button>
      <button type="button" className="g-btn" style={{ padding: "8px 18px", fontSize: 13 }} onClick={onBack}>
        取消
      </button>
      {isNew ? null : (
        <button
          type="button"
          className="g-btn g-btn-danger"
          style={{ padding: "8px 18px", fontSize: 13, marginLeft: "auto" }}
          onClick={() => void drop()}
        >
          删除这条线路
        </button>
      )}
    </div>
  );

  return (
    <PageShell
      title={isNew ? "新增班车线路" : form.code + " " + (form.name || "班车线路")}
      subtitle="司机电话与车牌写在这里，站点按发车顺序排列；坐标用高德定位，以后算通勤时长要用。"
      variant={variant}
      onBack={onBack}
    >
      {variant === "mobile" ? (
        <div className="m-card glass" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {formBlock}
          {stopsBlock}
          {mapBlock}
          {footer}
        </div>
      ) : (
        <div className="glass" style={{ padding: "18px 22px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {formBlock}
          {stopsBlock}
          {mapBlock}
          {footer}
        </div>
      )}
    </PageShell>
  );
}
