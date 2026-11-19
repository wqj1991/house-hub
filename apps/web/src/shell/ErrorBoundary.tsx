import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string;
}

/** 视图抛错时兜底：不让整个 SPA 白屏，保留报错与两条恢复路径。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 生产环境这里接上报；此刻先留在控制台，方便复制给开发。
    console.error("[house-hub] 视图渲染失败", error, info.componentStack);
    this.setState({ stack: info.componentStack ?? "" });
  }

  private retry = (): void => {
    this.setState({ error: null, stack: "" });
  };

  /** 只清界面偏好，保留「连哪台服务器 + 我是哪台设备」这两个身份键：清了身份就看不到服务器上的数据。 */
  private resetLocal = (): void => {
    try {
      const keep = ["house-hub:token", "house-hub:sync:base", "house-hub:sync:device"];
      const stash = keep.map((key) => [key, localStorage.getItem(key)] as const);
      localStorage.clear();
      stash.forEach(([key, value]) => {
        if (value !== null) localStorage.setItem(key, value);
      });
    } catch {
      /* 隐私模式下没有 localStorage，忽略 */
    }
    window.location.hash = "";
    window.location.reload();
  };

  render(): ReactNode {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <h1>这块视图渲染失败了</h1>
          <p>
            数据层和外壳都还活着，只是当前视图抛了异常。先重试一次；若每次都失败，清掉本地缓存再进。
          </p>
          <div className="crash-pre">
            {error.message || String(error)}
            {stack ? "\n" + stack.split("\n").slice(0, 6).join("\n") : ""}
          </div>
          <div className="crash-actions">
            <button type="button" className="crash-btn is-primary" onClick={this.retry}>
              重试渲染
            </button>
            <button type="button" className="crash-btn" onClick={this.resetLocal}>
              清空本地缓存并刷新
            </button>
          </div>
        </div>
      </div>
    );
  }
}
