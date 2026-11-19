import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/lib/toast";
import { loadCommute } from "@/lib/commuteState";
import { getIncomeState, loadIncome } from "@/lib/incomeState";
import type { IncomePhase } from "@/lib/incomeState";
import { useAccount } from "@/lib/account";
import { bootServer, forgetLocalToken, getServerBase, humanError, isPaired, loadAccount, login, revokeDevice, saveAvatar, saveServerBase } from "@/lib/serverClient";
import { subscribeToken } from "@/lib/session";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg)",
  color: "inherit",
  fontSize: 14,
};

/**
 * 头像上传：本机先裁成正方形、缩到 256×256 的 jpeg 再发（一张 20~40KB），
 * 服务器只存这串 data URL，手机和 web 拉的是同一张。
 */
async function shrinkToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画布不可用");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

/** 一套「点开文件选择 → 上传 → 刷新身份」的胶水，头像按钮和弹层里的「换头像」共用。 */
function useAvatarPicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const open = () => inputRef.current?.click();
  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("这不是图片", "换一张 png / jpg / webp");
      return;
    }
    setSaving(true);
    try {
      await saveAvatar(await shrinkToDataUrl(file));
      showToast("头像已更新", "两台设备看到的是同一张");
    } catch (err) {
      showToast("头像没换成功", humanError(err, "这张图读不出来"));
    } finally {
      setSaving(false);
    }
  };
  const node = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      style={{ display: "none" }}
      onChange={onPick}
    />
  );
  return { open, saving, node };
}

const PHASE_LABEL: Record<IncomePhase, string> = {
  unpaired: "未登录",
  loading: "读取中",
  ready: "已登录",
  error: "同步出错",
};

/** 折叠块：服务器地址、换登录码这些"用不到就不该占地方"的设置收在这里，点标题才展开。 */
function Collapse({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--card-inset-border)", paddingTop: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: 8,
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          color: "var(--text-dim)",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        <span>{label}</span>
        <svg
          viewBox="0 0 24 24"
          style={{
            width: 14,
            height: 14,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.2,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .18s ease",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>{children}</div> : null}
    </div>
  );
}

/**
 * 「我的」里的登录入口：手机渲染成一行设置项，桌面渲染成一条细玻璃条。
 * 只露「登录 / 已登录」这一行，服务器地址之类的配置都折在弹层里。
 */
/** 头像用账号首字母，颜色跟着主题走，不再画一张写死的卡通头像。 */
const avatarTint: React.CSSProperties = {
  background: "linear-gradient(135deg, #BFDBFE 0%, #A5B4FC 100%)",
  color: "#1E293B",
  fontWeight: 800,
  letterSpacing: "0.02em",
  fontSize: 22,
};

/**
 * 「我的」最上面那块用户信息：显示的是当前登录的账号本身，换人登录这里就换人。
 * 名字来自 /auth/me，角色由服务端判定（默认账号＝管理员）。
 */
export function AccountIdentity({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const account = useAccount();
  const paired = useSyncExternalStore(subscribeToken, isPaired, isPaired);
  const username = account?.username?.trim() ?? "";
  const name = username || (paired ? "读取账号…" : "未登录");
  const initial = (Array.from(username)[0] ?? "?").toUpperCase();
  const host = getServerBase().replace(/^https?:\/\//, "") || "同源部署";
  const role = account?.role === "admin" ? "管理员" : username ? "成员" : "未登录";
  const status = paired ? `${role} · ${host}` : "还没登录";
  const picker = useAvatarPicker();
  const avatarUrl = account?.avatar ?? "";
  // 两端同一个头像：圆环、渐变底、右下角登录角标都照抄移动端，别各做一套。
  // 已登录时点头像就能换图（选了图立刻上传，成功后两台设备一起变）。
  const avatar = (
    <div
      className="me-avatar-wrap"
      onClick={paired ? picker.open : undefined}
      title={paired ? (picker.saving ? "头像上传中…" : "点一下换头像") : undefined}
      style={paired ? { cursor: "pointer" } : undefined}
    >
      <div
        className="me-avatar-img"
        style={
          avatarUrl
            ? {
                ...avatarTint,
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "transparent",
              }
            : avatarTint
        }
      >
        {avatarUrl ? null : initial}
      </div>
      {paired ? <div className="me-avatar-badge">✓</div> : null}
      {picker.node}
    </div>
  );

  if (variant === "mobile") {
    return (
      <>
        {avatar}
        <div className="me-user-meta" style={{ minWidth: 0, flex: 1 }}>
          <div className="me-username">{name}</div>
          <div className="me-vip-tag" style={{ maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: paired ? "#0284C7" : "#94A3B8",
                flexShrink: 0,
              }}
            ></span>
            {status}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {avatar}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          {paired ? `${role} · 已登录 · 数据在你的服务器 ${host}` : "还没登录"}
        </div>
      </div>
    </>
  );
}

/**
 * 「我的」最上面那块用户信息就是账号入口：这里只给一个胶囊／小按钮，弹层才放登录和服务器设置。
 * 已登录状态由头像那块自己承担，不再另起一行账号卡片。
 */
export function AccountEntry({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const paired = useSyncExternalStore(subscribeToken, isPaired, isPaired);
  const label = paired ? "账号" : "登录";
  // 角色（管理员 / 成员）只有服务端说了算，进页面就问一次「这枚令牌是谁」
  useEffect(() => {
    if (paired) void loadAccount();
  }, [paired]);

  if (variant === "mobile") {
    return (
      <>
        <button
          type="button"
          className="me-setting-pill"
          onClick={() => setOpen(true)}
          aria-label={label}
          style={{ marginLeft: "auto", border: "none", fontFamily: "inherit" }}
        >
          <span>{label}</span>
          <svg viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
        {open ? <LoginSheet variant="mobile" onClose={() => setOpen(false)} /> : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="g-btn"
        onClick={() => setOpen(true)}
        style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 12.5 }}
      >
        {label}
      </button>
      {open ? <LoginSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** 登录弹层：登录码一栏是主入口，服务器地址与换码都折叠在下面。 */
export function LoginSheet({ onClose, variant = "desktop" }: { onClose: () => void; variant?: "desktop" | "mobile" }) {
  const paired = useSyncExternalStore(subscribeToken, isPaired, isPaired);
  const [base, setBase] = useState(getServerBase);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverOpen, setServerOpen] = useState(() => !paired && getIncomeState().phase === "error");
  const [codeOpen, setCodeOpen] = useState(false);
  /** 退出登录走组件库的 g-modal，不用浏览器原生 confirm（原生弹窗会挡住整页，也跟玻璃底膜不搭）。 */
  const [confirmLogout, setConfirmLogout] = useState(false);
  const picker = useAvatarPicker();

  const doLogin = async () => {
    if (!username.trim() || !password) {
      showToast("账号和密码都要填", "服务器上的账号密码，不是登录码");
      return;
    }
    setBusy(true);
    try {
      await login(username, password, { base, platform: variant === "mobile" ? "android" : "web" });
      setPassword("");
      await loadIncome();
      await loadCommute();
      showToast("登录成功", "成员与测算都存在服务器上，两台设备共用一份");
      onClose();
    } catch (err) {
      showToast("登录没成功", humanError(err, "账号或密码不对"));
    } finally {
      setBusy(false);
    }
  };

  const doRefresh = async () => {
    setBusy(true);
    try {
      await loadIncome();
      await loadCommute();
      const after = getIncomeState();
      showToast(after.phase === "ready" ? "已刷新" : "刷新没完成", after.error ?? PHASE_LABEL[after.phase]);
    } catch (err) {
      showToast("刷新没成功", humanError(err));
    } finally {
      setBusy(false);
    }
  };

  /** 已登录时也能换地址：先存地址再重连一次，避免地址写错就彻底没入口改。 */
  const applyBase = async (next: string) => {
    setBusy(true);
    try {
      saveServerBase(next);
      setBase(next.trim());
      await bootServer();
      await loadIncome();
      await loadCommute();
      const after = getIncomeState();
      showToast(
        after.phase === "ready" ? "地址已切换" : "地址没通",
        after.phase === "ready" ? getServerBase() || "同源 /house-api" : after.error ?? after.phase,
      );
    } catch (err) {
      showToast("地址没通", humanError(err));
    } finally {
      setBusy(false);
    }
  };

  /** 令牌失效时服务器那边已经不认它了，只清本机就能回到「未登录」，不必先断开成功。 */
  const doForget = () => {
    forgetLocalToken();
    setPassword("");
    showToast("已清除本机登录", "贴一个登录码就能重新登录，服务器上的数据不动");
  };

  const doRevoke = async () => {
    setBusy(true);
    try {
      await revokeDevice();
      await loadIncome();
      await loadCommute();
      setConfirmLogout(false);
      showToast("已退出登录", "重新登录需要一个登录码");
      onClose();
    } catch (err) {
      showToast("退出失败", humanError(err));
    } finally {
      setBusy(false);
    }
  };

  const serverBlock = (
    <>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
        <span style={{ color: "var(--text-dim)" }}>服务器地址（同源部署留空）</span>
        <input
          style={inputStyle}
          value={base}
          onChange={(event) => setBase(event.target.value)}
          placeholder="http://127.0.0.1:18878"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="g-btn" onClick={() => applyBase(base)} disabled={busy} style={{ flex: 1 }}>
          应用这个地址
        </button>
        <button type="button" className="g-btn" onClick={() => applyBase("")} disabled={busy}>
          恢复默认
        </button>
      </div>
    </>
  );

  /** 账号密码：只在没登录 / 主动切换账号时出现。 */
  const credentialBlock = (
    <>
      <input
        style={inputStyle}
        value={username}
        onChange={(event) => setUsername(event.target.value.slice(0, 60))}
        placeholder="账号"
        autoComplete="username"
        autoCapitalize="off"
        spellCheck={false}
      />
      <input
        style={inputStyle}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value.slice(0, 200))}
        placeholder="密码"
        autoComplete="current-password"
      />
      <button type="button" className="g-btn g-btn-primary" onClick={doLogin} disabled={busy}>
        {busy ? "登录中…" : "登录"}
      </button>
    </>
  );

  // 挂到 body 上：卡片里有 backdrop-filter，会把 fixed 子元素关进自己的层叠上下文，
  // 留在卡片里就永远压不过后面的内容（表现为弹层被遮）。
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 160, display: "grid", placeItems: "center", background: "rgba(0,0,0,.45)", padding: 16 }}
    >
      <div
        className="glass"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(440px, 100%)", borderRadius: 22, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12, maxHeight: "86vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{paired ? "账号" : "登录"}</div>
          <button type="button" className="g-btn" onClick={onClose}>
            关闭
          </button>
        </div>

        {/* 已登录的信息只留在「我的」那一行卡片上，弹层里不再重复。 */}
        {paired ? null : (
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
            {paired
              ? "这台设备已经登上了：这里录的每一位成员、每一次改首付都是一次真实请求，两台设备看到同一份数据。"
              : "用服务器上的账号密码登录一次即可：收入与公积金直接存在服务器上，换台设备用同一个账号连上，看到的就是同一份数据。"}
          </div>
        )}

        {paired ? (
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="g-btn g-btn-primary" onClick={doRefresh} disabled={busy} style={{ flex: 1 }}>
                {busy ? "读取中…" : "立即刷新"}
              </button>
              <button type="button" className="g-btn" onClick={picker.open} disabled={busy || picker.saving}>
                {picker.saving ? "上传中…" : "换头像"}
              </button>
              <button type="button" className="g-btn" onClick={() => setConfirmLogout(true)} disabled={busy}>
                退出登录
              </button>
            </div>
            {picker.node}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <span style={{ color: "var(--text-dim)" }}>账号 / 密码</span>
              {credentialBlock}
            </label>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
              账号密码在服务器上验，本机只存登录后的设备令牌，密码不落盘。
            </div>
          </div>
        )}

        <Collapse label="服务器地址" open={serverOpen} onToggle={() => setServerOpen((v) => !v)}>
          {serverBlock}
        </Collapse>

        {paired ? (
          <Collapse label="切换账号" open={codeOpen} onToggle={() => setCodeOpen((v) => !v)}>
            {credentialBlock}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6, flex: 1 }}>
                换账号直接在这里登；服务器重启换库后旧登录会失效，重登一次就恢复，本机数据不用动。
              </div>
            </div>
            <button type="button" className="g-btn" onClick={doForget} disabled={busy}>
              清除本机登录
            </button>
          </Collapse>
        ) : null}
      </div>

      {confirmLogout ? (
        <div
          onClick={(event) => {
            event.stopPropagation();
            setConfirmLogout(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 180,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,.5)",
            padding: 16,
          }}
        >
          <div
            className="g-modal"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(360px, 100%)" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              <h4>退出登录？</h4>
              <span style={{ fontSize: 11, color: "var(--cyan)" }}>{getServerBase() || "同源部署"}</span>
            </div>
            <div className="modal-body">
              服务器上的成员、收入与测算都不会删；退出后这台设备要重新贴登录码才能再连。
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="g-btn"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => setConfirmLogout(false)}
                disabled={busy}
              >
                取消
              </button>
              <button
                type="button"
                className="g-btn g-btn-danger"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={doRevoke}
                disabled={busy}
              >
                {busy ? "退出中…" : "退出登录"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
