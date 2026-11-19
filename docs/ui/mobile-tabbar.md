# 移动端底部导航（图标 + 文字）

> 落地位置：`apps/web/src/shell/MobileShell.tsx`（结构）、`apps/web/src/styles/glass.css:463-520`（胶囊与状态）、`:1544-1566`（窄屏断点）
> 验收截图：390×844 / 360×780，四套 tone（dawn / glacier / twilight / obsidian）全部通过。

## 1. 为什么是「图标在上、文字在下」

- 8 个入口（选房 / 指南 / 概览 / 小区 / 待选 / 算钱 / 组件 / 我的），横排文字按钮在 390px 下每格只有 46px，纯文字既挤又难扫。
- 图标给「形状记忆」，文字给「确定性命中」；两者同轴竖排，点击目标合并成一整格，比左右排布更省宽度。
- 图标一律用 lucide-react 线性图标（描边 1.75），不用 emoji：emoji 在安卓 WebView 里各家字体不一致，会破坏等高对齐。

## 2. 几何

| 项 | 390px | 360px | 说明 |
| --- | --- | --- | --- |
| 胶囊宽 | 366px | 352px | `calc(100% - 24px)` / ≤380px 时 `calc(100% - 8px)` |
| 单格宽 | 43.6px | 43px | `grid-template-columns: repeat(var(--m-tabs), minmax(0,1fr))` |
| 单格高 | 50px | 50px | 触控高度 ≥44px 达标 |
| 图标 | 20px（盒 24–26px） | 同 | 选中时描边加粗到 2.1 |
| 标签 | 10px | 9.5px | 2 字标题本身只占 ~20px，不会截断 |
| 内衬 / 间隔 | 4px / 1px | 3px / 0 | 8 格不留冗余缝隙 |

等分用 **grid** 而不是 flex + `space-around`：flex 下 8 个按钮的最小内容宽会把整条撑爆，右侧最后一项直接被视口切掉（这是第一版的真实事故）。

## 3. 状态

- **默认**：`color: var(--text-sub)`，无背景。
- **选中**：accent 12% 的软胶囊底 + 20% 内描边（`inset 0 0 0 1px`），图标外再叠一层 34%→12% 的径向柔光，标签转 accent 且加粗到 700。
  - 不用整块白底：8 格时白块面积过大，会把图标本身的形状压掉；也不止靠颜色，光晕+底色+字重三重信号。
- **按下**：`transform: scale(.94)`，120ms。
- **hover**（仅 `@media (hover:hover)`）：7% 文字色底，触屏不触发。

## 4. 主题与性能

- accent 全部走 `--accent-cyan`，随 tone 变（dawn #0284C7 / glacier #18C0A8 / twilight #C084FC / obsidian #38BDF8），不写死颜色。
- ≤1023px 的性能层会把 `.m-tabbar` 的 `backdrop-filter` 关掉（安卓 WebView 软件渲染的主因），胶囊退化为半透明底膜，视觉几乎无损。

## 5. 可访问性

- `<nav aria-label="主导航">`，当前项 `aria-current="page"`。
- 图标盒 `aria-hidden="true"`，读屏只念标签，不会念成「图片」。
- 焦点可见：沿用 index.css 的 `:focus-visible` 2px accent 外框。

## 6. 已知取舍

- 标签 10–10.5px 低于 `docs/ui/spec.md` 的 12px 下限：8 格 × 2 字在 390px 下如果按 12px，字宽 24px + 内衬会逼到 46px 临界，容易在 360px 机型上换行。等入口收敛到 5–6 个时可以回到 12px。
- 360px 每格 43px，比 44px 少 1px：8×44 = 352 已经等于可用宽度，再要 44 就只能去掉胶囊留白，观感损失更大。
