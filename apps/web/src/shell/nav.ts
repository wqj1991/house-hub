export type DesktopView = "guide" | "commute" | "components" | "profile";

export interface DesktopNavItem {
  /** 导轨项自身的 key，同时用于高亮判断 */
  key: string;
  /** 点击后切换到的视图容器 */
  view: DesktopView;
  icon: string;
  label: string;
  badge?: string;
}

/** 左侧导轨 8 项：短链项（待选/算钱/品质/对比）统一落到通勤主台，与 v1 行为一致。 */
export const DESKTOP_NAV: DesktopNavItem[] = [
  { key: "guide", view: "guide", icon: "📖", label: "买房指南" },
  { key: "commute", view: "commute", icon: "🚇", label: "通勤选房", badge: "7片区" },
  { key: "shortlist", view: "commute", icon: "⭐", label: "待选池", badge: "3" },
  { key: "money", view: "commute", icon: "🧮", label: "算钱计算器" },
  { key: "quality", view: "commute", icon: "⚖️", label: "品质打分", badge: "25项" },
  { key: "compare", view: "commute", icon: "📊", label: "小区三维对比" },
  { key: "components", view: "components", icon: "🧩", label: "组件库规范", badge: "6模块" },
  { key: "profile", view: "profile", icon: "⚙️", label: "我的与主题" },
];

export const VIEW_TITLE: Record<DesktopView, string> = {
  guide: "买房避坑知识库 · 体系化精读指南",
  commute: "通勤选房工作台",
  components: "交互组件库规范 · 液态玻璃全景",
  profile: "决策者偏好与视觉主题底膜",
};

export interface MobileTabItem {
  key: string;
  label: string;
  /** 移动端屏 key，必须与 registry 的 MOBILE_SCREENS key 一一对应 */
  screen: string;
}

export const MOBILE_TABS: MobileTabItem[] = [
  { key: "gd", label: "指南", screen: "gd" },
  { key: "ov", label: "概览", screen: "ov" },
  { key: "cm", label: "通勤", screen: "cm" },
  { key: "det", label: "小区", screen: "det" },
  { key: "sl", label: "待选", screen: "sl" },
  { key: "my", label: "算钱", screen: "my" },
  { key: "cp", label: "组件", screen: "cp" },
  { key: "me", label: "我的", screen: "me" },
];
