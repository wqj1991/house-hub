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
              className={"m-tab-btn" + (tab.screen === active ? " is-active" : "")}
              data-mtab={tab.key}
              aria-current={tab.screen === active ? "page" : undefined}
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
