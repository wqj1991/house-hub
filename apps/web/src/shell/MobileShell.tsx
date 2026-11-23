import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Blocks,
  BookOpenText,
  Building2,
  Calculator,
  LayoutDashboard,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { MOBILE_TABS } from "./nav";

interface ScreenSpec {
  key: string;
  node: ReactNode;
}

interface Props {
  active: string;
  onSelect: (screen: string) => void;
  screens: ScreenSpec[];
}

/** tab key → 线性图标；20px、默认 1.75 描边，与 10.5px 标签共用一条竖向中轴。 */
const TAB_ICONS: Record<string, LucideIcon> = {
  pk: Building2,
  gd: BookOpenText,
  fl: ListChecks,
  ov: LayoutDashboard,
  my: Calculator,
  cp: Blocks,
  me: UserRound,
};

/** 手机骨架：数据来源条 + 单屏视口 + 悬浮药丸 TabBar（图标 + 文字）。 */
export function MobileShell({ active, onSelect, screens }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // 滚动容器是 .m-viewport 而非页面，切屏时手动回到顶部，避免沿用上一屏的滚动位置
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [active]);

  return (
    <div className="mobile-shell" id="mobileShell">
      <div className="m-viewport" ref={viewportRef}>
        {screens.map((screen) => (
          <div
            key={screen.key}
            className={"m-screen" + (screen.key === active ? " is-active" : "")}
            data-mscr={screen.key}
          >
            {screen.node}
          </div>
        ))}
      </div>

      <div className="m-tabbar-wrap">
        <nav
          className="m-tabbar"
          data-tabs={MOBILE_TABS.length}
          style={{ "--m-tabs": MOBILE_TABS.length } as CSSProperties}
          aria-label="主导航"
        >
          {MOBILE_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab.key] ?? LayoutDashboard;
            const current = tab.screen === active;
            return (
              <button
                key={tab.key}
                type="button"
                className={"m-tab-btn" + (current ? " is-active" : "")}
                data-mtab={tab.key}
                aria-current={current ? "page" : undefined}
                onClick={() => onSelect(tab.screen)}
              >
                <span className="m-tab-ico" aria-hidden="true">
                  <Icon size={20} strokeWidth={current ? 2.1 : 1.75} />
                </span>
                <span className="m-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
