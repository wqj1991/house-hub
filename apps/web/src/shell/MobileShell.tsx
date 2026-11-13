import type { ReactNode } from "react";
import { MobileStatusBar } from "./MobileStatusBar";
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

/** 手机骨架：状态栏 + 单屏视口 + 悬浮药丸 TabBar。 */
export function MobileShell({ active, onSelect, screens }: Props) {
  return (
    <div className="mobile-shell" id="mobileShell">
      <MobileStatusBar />
      <div className="m-viewport">
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
        <nav className="m-tabbar">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={"m-tab-btn" + (tab.screen === active && tab.key === activeTabKey(active) ? " is-active" : "")}
              data-mtab={tab.key}
              onClick={() => onSelect(tab.screen)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** 高亮“我的”时同时对应 me / cp 两个入口，取第一个匹配项。 */
function activeTabKey(screen: string): string {
  const hit = MOBILE_TABS.find((tab) => tab.screen === screen);
  return hit ? hit.key : screen;
}
