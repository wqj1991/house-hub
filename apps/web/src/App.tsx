import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { installGlassWidgets, renderCalendar } from "@/lib/glassWidgets";
import { loadTone, saveTone, TONES, type ToneKey } from "@/lib/theme";
import { DesktopShell } from "@/shell/DesktopShell";
import { MobileShell } from "@/shell/MobileShell";
import { Spotlight } from "@/shell/Spotlight";
import { ToneBackdropLayer } from "@/shell/ToneBackdrop";
import { ToastHost } from "@/shell/ToastHost";
import { DESKTOP_NAV, VIEW_TITLE, type DesktopView } from "@/shell/nav";
import { DESKTOP_VIEWS, MOBILE_SCREENS } from "@/views/registry";

function hashKey(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

/** 深链可能是「视图/子资源」（如 picks/fs-1010130563），取第一段当视图 key。 */
function viewKey(raw: string): string {
  return raw.split("/")[0] ?? raw;
}

function initialKey(keys: string[], fallback: string): string {
  const raw = viewKey(hashKey());
  return keys.includes(raw) ? raw : fallback;
}

/** 桌面导轨 key ↔ 手机屏 key：深链只给一个 key 时两边都能落到对应内容。 */
const NAV_TO_SCREEN: Record<string, string> = {
  // 选房两端共用一份数据：桌面双列挑盘，手机单列卡片
  picks: "pk",
  guide: "gd",
  shortlist: "sl",
  money: "my",
  quality: "det",
  compare: "cm",
  components: "cp",
  profile: "me",
};

function initialScreen(): string {
  const raw = viewKey(hashKey());
  const screens = MOBILE_SCREENS.map((s) => s.key);
  if (screens.includes(raw)) return raw;
  return NAV_TO_SCREEN[raw] ?? "ov";
}

/** 反向表：手机屏 key → 桌面导轨 key（me 被「组件库 / 我的」共用，取「我的与主题」）。 */
const SCREEN_TO_NAV: Record<string, string> = {
  pk: "picks",
  gd: "guide",
  sl: "shortlist",
  my: "money",
  det: "quality",
  cm: "compare",
  me: "profile",
};

export function App() {
  const [tone, setTone] = useState<ToneKey>(loadTone);
  const [navKey, setNavKey] = useState(() => initialKey(DESKTOP_NAV.map((i) => i.key), "shortlist"));
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

  // 底膜卡片的高亮必须跟当前底膜一致：桌面「我的」视图按需挂载，切换视图后要重新同步一次
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-tone-pick]").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.tonePick === tone);
    });
  }, [tone, view]);

  // 地址栏 ↔ 视图双向同步：刷新、前进后退、外链深链都落到同一个 key
  useEffect(() => {
    const apply = () => {
      const raw = viewKey(hashKey());
      if (DESKTOP_NAV.some((item) => item.key === raw)) {
        setNavKey(raw);
        const next = NAV_TO_SCREEN[raw];
        if (next) setScreen(next);
        return;
      }
      if (MOBILE_SCREENS.some((s) => s.key === raw)) {
        setScreen(raw);
        const nav = SCREEN_TO_NAV[raw];
        if (nav) setNavKey(nav);
      }
    };
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

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
    const screenKey = target;
    setScreen(screenKey);
    setNavKey(SCREEN_TO_NAV[screenKey] ?? "shortlist");
    if (window.location.hash !== "#/" + screenKey) window.location.hash = "/" + screenKey;
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
    if (window.location.hash !== "#/" + key) window.location.hash = "/" + key;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      <ToneBackdropLayer />
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
