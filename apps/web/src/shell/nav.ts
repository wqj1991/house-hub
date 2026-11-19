export type DesktopView = "picks" | "guide" | "commute" | "components" | "profile";

export interface DesktopNavItem {
  /** 导轨项自身的 key，同时用于高亮判断 */
  key: string;
  /** 点击后切换到的视图容器 */
  view: DesktopView;
  icon: string;
  label: string;
  badge?: string;
}

/** 左侧导轨 7 项：短链项（待选/算钱/品质/对比）统一落到通勤工作台，与 v1 行为一致；
 *  通勤档案收在「我的」里，不再单列「通勤选房」菜单。 */
export const DESKTOP_NAV: DesktopNavItem[] = [
  // 选房是入口：先挑盘（新房 / 二手房），挑中了再进待选池算通勤
  { key: "picks", view: "picks", icon: "🏘️", label: "选房", badge: "新房" },
  { key: "guide", view: "guide", icon: "📖", label: "买房指南" },
  { key: "shortlist", view: "commute", icon: "⭐", label: "待选池", badge: "3" },
  { key: "money", view: "commute", icon: "🧮", label: "算钱计算器" },
  { key: "quality", view: "commute", icon: "⚖️", label: "品质打分", badge: "25项" },
  { key: "compare", view: "commute", icon: "📊", label: "小区三维对比" },
  { key: "components", view: "components", icon: "🧩", label: "组件库规范", badge: "6模块" },
  { key: "profile", view: "profile", icon: "⚙️", label: "我的与主题" },
];

export const VIEW_TITLE: Record<DesktopView, string> = {
  picks: "选房 · 新房（大兴 / 通州）/ 二手房",
  guide: "买房避坑知识库 · 体系化精读指南",
  commute: "通勤选房工作台",
  components: "交互组件库规范 · 液态玻璃全景",
  profile: "我的 · 主题 / 账号 / 收入与公积金",
};

export interface MobileTabItem {
  key: string;
  label: string;
  /** 移动端屏 key，必须与 registry 的 MOBILE_SCREENS key 一一对应 */
  screen: string;
}

/** 底部 tab 6 项：选房与桌面同一入口（新房 / 二手房），通勤榜在「概览」里看。 */
export const MOBILE_TABS: MobileTabItem[] = [
  { key: "pk", label: "选房", screen: "pk" },
  { key: "gd", label: "指南", screen: "gd" },
  { key: "ov", label: "概览", screen: "ov" },
  { key: "my", label: "算钱", screen: "my" },
  { key: "cp", label: "组件", screen: "cp" },
  { key: "me", label: "我的", screen: "me" },
];
