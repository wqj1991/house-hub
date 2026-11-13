import { useCallback, useEffect, useMemo, useState } from "react";
import { installGlassWidgets, renderCalendar } from "@/lib/glassWidgets";
import { loadTone, saveTone, TONES, type ToneKey } from "@/lib/theme";
import { DesktopShell } from "@/shell/DesktopShell";
import { MobileShell } from "@/shell/MobileShell";
import { Spotlight } from "@/shell/Spotlight";
import { ToastHost } from "@/shell/ToastHost";
import { DESKTOP_NAV, VIEW_TITLE, type DesktopView } from "@/shell/nav";
import { DESKTOP_VIEWS, MOBILE_SCREENS } from "@/views/registry";

function hashKey(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

function initialKey(keys: string[], fallback: string): string {
  const raw = hashKey();
  return keys.includes(raw) ? raw : fallback;
}

/** 桌面导轨 key ↔ 手机屏 key：深链只给一个 key 时两边都能落到对应内容。 */
const NAV_TO_SCREEN: Record<string, string> = {
  guide: "gd",
  commute: "ov",
  shortlist: "sl",
  money: "my",
  quality: "det",
  compare: "cm",
  components: "me",
  profile: "me",
};

function initialScreen(): string {
  const raw = hashKey();
  const screens = MOBILE_SCREENS.map((s) => s.key);
  if (screens.includes(raw)) return raw;
  return NAV_TO_SCREEN[raw] ?? "ov";
}

export function App() {
  const [tone, setTone] = useState<ToneKey>(loadTone);
  const [navKey, setNavKey] = useState(() => initialKey(DESKTOP_NAV.map((i) => i.key), "commute"));
  const [screen, setScreen] = useState(initialScreen);
  const [spotlight, setSpotlight] = useState(false);

  const view: DesktopView = useMemo(() => {
    const hit = DESKTOP_NAV.find((item) => item.key === navKey);
    return hit ? hit.view : "commute";
  }, [navKey]);

  useEffect(() => {
    document.body.dataset.tone = tone;
    saveTone(tone);
  }, [tone]);

  // 底膜卡片 / 按钮：data-tone-pick（我的页）与 data-tone-val（顶栏）
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const el = (event.target as HTMLElement).closest<HTMLElement>("[data-tone-pick],[data-tone-val]");
      if (!el) return;
      const next = (el.dataset.tonePick ?? el.dataset.toneVal) as ToneKey | undefined;
      if (next && TONES.some((t) => t.key === next)) setTone(next);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // 下拉 / 日历 / 时分轮 / 水波纹
  useEffect(() => installGlassWidgets(), []);

  // 组件库视图是按需挂载的，进入后需要补画一次日历网格
  useEffect(() => {
    if (view === "components") renderCalendar();
  }, [view]);

  // 检索入口 + ⌘K / Escape
  useEffect(() => {
    const open = (event: MouseEvent) => {
      const el = (event.target as HTMLElement).closest(".open-spotlight-btn,#mSearchBar,#dRailSearchBtn");
      if (el) setSpotlight(true);
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSpotlight((prev) => !prev);
      } else if (event.key === "Escape") {
        setSpotlight(false);
      }
    };
    document.addEventListener("click", open);
    window.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("click", open);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  const closeSpotlight = useCallback(() => setSpotlight(false), []);
  const jump = useCallback((target: string) => {
    const screenKey = target === "cp" ? "me" : target;
    setScreen(screenKey);
    setNavKey(target === "gd" ? "guide" : "commute");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectNav = useCallback((key: string) => {
    setNavKey(key);
    const next = NAV_TO_SCREEN[key];
    if (next) setScreen(next);
    window.location.hash = "/" + key;
  }, []);

  const selectScreen = useCallback((key: string) => {
    setScreen(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      <DesktopShell activeKey={navKey} view={view} onSelect={selectNav}>
        {DESKTOP_VIEWS[view]()}
      </DesktopShell>
      <MobileShell active={screen} onSelect={selectScreen} screens={MOBILE_SCREENS} />
      <Spotlight open={spotlight} onClose={closeSpotlight} onJump={jump} />
      <ToastHost />
      <span hidden>{VIEW_TITLE[view]}</span>
    </>
  );
}
