# 打磨记录

## 第 1 轮（2026-11-16 13:41）六候选
- 生成：Pillow + numpy，3× 超采样，LANCZOS 降采样，1024 母版；输出 6 张 + 48px + 对比板
- modlens 自检（对比板 / 1a / 2a / 3a）：结构比例正常，无溢出

## 第 2 轮（13:43）闸门间距
- 问题：通勤条右端与闸线重叠 26px，视觉上粘连成一体（modlens 读作 "settings gear/menu" 而非"被挡住"）
- 修：条端退到 598，闸线 624–652，留 22px 净空；闸线上下延到 300–728，长于条＝有"拦"的意味

## 第 3 轮（14:00）定稿 2b 的工程化
- Pillow 12 的 ImageDraw.arc(width=) 只吃 int → 全部宽度 round 成 int
- 自适应图标：108dp 画布，前景关键图形压到 66dp 安全圈内（缩放系数 0.9146，外环外缘直径 600/1024）
- 三套图层齐备：background（径向渐变 PNG）、foreground（环路 PNG，透明底）、monochrome（纯白单色，供 Android 13 主题图标取色）
- 密度：mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi → legacy 48/72/96/144/192，图层 108/162/216/324/432
- 小尺寸校验：foreground 在 mdpi(108px) 下描边 4.2px，可辨认
