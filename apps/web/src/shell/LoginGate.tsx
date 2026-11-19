import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { loadTone } from "@/lib/theme";
import { ToneBackdropLayer } from "@/shell/ToneBackdrop";
import { showToast } from "@/lib/toast";
import { loadCommute } from "@/lib/commuteState";
import { loadIncome } from "@/lib/incomeState";
import { getServerBase, humanError, login, saveServerBase } from "@/lib/serverClient";

/**
 * 进应用的第一道门：账号密码。
 * 服务器地址不占位，收在下面的折叠条里（换机器 / 换服务器时才用得上）。
 */
const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg)",
  color: "inherit",
  fontSize: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  letterSpacing: ".06em",
  color: "var(--text-dim)",
  marginBottom: 6,
};

export function LoginGate() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [base, setBase] = useState(getServerBase);
  const [serverOpen, setServerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone] = useState(loadTone);

  // 登录页也走用户选过的底膜，进去之后不会先白一下再变
  useEffect(() => {
    document.body.dataset.tone = tone;
  }, [tone]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError("账号和密码都要填");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username, password, { base });
      setPassword("");
      // 令牌刚落地，把服务端的数据拉齐；界面会被 token 订阅切走
      void loadIncome();
      void loadCommute();
      showToast("已登录", getServerBase() || "同源 /house-api");
    } catch (err) {
      setError(humanError(err, "登录没成功"));
    } finally {
      setBusy(false);
    }
  };

  const applyBase = () => {
    saveServerBase(base);
    setBase(getServerBase());
    setError(null);
    showToast("地址已保存", getServerBase() || "同源 /house-api");
  };

  return (
    <>
      <ToneBackdropLayer />
      <div
        className="login-gate"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "48px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <form
          onSubmit={submit}
          className="glass"
          style={{ width: "min(380px, 100%)", padding: "26px 24px 20px", borderRadius: 22, display: "grid", gap: 14 }}
        >
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".18em", color: "var(--text-dim)" }}>HOUSE HUB</div>
            <div style={{ fontSize: 21, fontWeight: 750, marginTop: 6 }}>登录决策库</div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.6 }}>
              账号密码验过才进得来；收入和测算都存在服务器上。
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="login-username">
              账号
            </label>
            <input
              id="login-username"
              style={fieldStyle}
              value={username}
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              placeholder="账号"
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="login-password">
              密码
            </label>
            <input
              id="login-password"
              style={fieldStyle}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密码"
            />
          </div>

          {error ? (
            <div style={{ fontSize: 12.5, color: "#DC2626", lineHeight: 1.6 }} role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" className="g-btn g-btn-primary" style={{ padding: "10px 16px", fontSize: 13.5 }} disabled={busy}>
            {busy ? "登录中…" : "登录"}
          </button>

          <div style={{ borderTop: "1px solid var(--card-inset-border)", paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => setServerOpen((prev) => !prev)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: "none",
                border: "none",
                padding: "8px 0 2px",
                color: "var(--text-dim)",
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-expanded={serverOpen}
            >
              <span>服务器地址</span>
              <svg
                viewBox="0 0 24 24"
                style={{
                  width: 16,
                  height: 16,
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  transform: serverOpen ? "rotate(180deg)" : "none",
                  transition: "transform .18s ease",
                }}
              >
                <path d="M7 10l5 5 5-5" />
              </svg>
            </button>
            {serverOpen ? (
              <div style={{ display: "grid", gap: 8, paddingTop: 10 }}>
                <input
                  style={fieldStyle}
                  value={base}
                  onChange={(event) => setBase(event.target.value)}
                  placeholder={getServerBase() || "http://127.0.0.1:18878"}
                  aria-label="服务器地址"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="g-btn" style={{ flex: 1, padding: "8px 12px", fontSize: 12.5 }} onClick={applyBase}>
                    应用这个地址
                  </button>
                  <button
                    type="button"
                    className="g-btn"
                    style={{ padding: "8px 12px", fontSize: 12.5 }}
                    onClick={() => {
                      saveServerBase("");
                      setBase(getServerBase());
                      showToast("已恢复默认地址", getServerBase() || "同源 /house-api");
                    }}
                  >
                    恢复默认
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  留空＝同源部署（走 /house-api 反代）；桌面端 / App 默认 https://47.95.238.28:18766（只填到端口，/house-api 由程序自己补），本机直连填 http://127.0.0.1:18878。
                </div>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}
