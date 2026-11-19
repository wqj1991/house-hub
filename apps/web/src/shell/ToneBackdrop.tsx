import { useEffect, useState } from "react";
import { loadToneBg, onToneBgChange, type ToneBg } from "@/lib/theme";

/**
 * 自定义背景图层：铺在 aura 光斑之上、工作台三栏之下（z-index 1）。
 * 桌面与手机共用同一层，所以挂在 App 顶层而不是某一端骨架里。
 */
export function ToneBackdropLayer() {
  const [bg, setBg] = useState<ToneBg | null>(loadToneBg);

  useEffect(() => onToneBgChange(setBg), []);

  // 有图时内置光斑让位，避免图片和渐变糊成一片
  useEffect(() => {
    if (bg) document.body.dataset.toneBg = "on";
    else delete document.body.dataset.toneBg;
  }, [bg]);

  if (!bg) return null;

  return (
    <div className="tone-bg-layer" style={{ backgroundImage: `url("${bg.url}")` }} aria-hidden="true">
      <div className="tone-bg-veil" style={{ opacity: bg.dim }} />
    </div>
  );
}
