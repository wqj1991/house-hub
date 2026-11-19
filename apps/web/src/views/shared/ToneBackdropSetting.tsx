import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BG_DIM,
  clearToneBg,
  fileToToneBg,
  loadToneBg,
  onToneBgChange,
  publishToneBg,
  saveToneBg,
  type ToneBg,
} from "@/lib/theme";
import { showToast } from "@/lib/toast";

/**
 * 「我的 → 视觉主题」里的自定义背景图：选图 → 本机压缩 → 存 localStorage。
 * 图片不出本机，服务器端没有对应接口，也不参与配对同步。
 */
export function ToneBackdropSetting({ variant = "mobile" }: { variant?: "desktop" | "mobile" }) {
  const [bg, setBg] = useState<ToneBg | null>(loadToneBg);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onToneBgChange(setBg), []);

  async function take(file: File | null | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      showToast("只能选图片文件", "JPG / PNG / WebP 都可以");
      return;
    }
    setBusy(true);
    try {
      const url = await fileToToneBg(file);
      const persisted = saveToneBg({ url, dim: bg?.dim ?? DEFAULT_BG_DIM });
      showToast(
        "背景图已生效",
        persisted ? "已压缩并保存在本机，可与底膜叠用" : "本机存储空间不足，刷新后需要重新上传",
      );
    } catch (error) {
      showToast("图片处理失败", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function commitDim(raw: string) {
    if (!bg) return;
    const dim = Math.min(0.85, Math.max(0, Number(raw) / 100));
    saveToneBg({ url: bg.url, dim });
  }

  function remove() {
    clearToneBg();
    showToast("已移除自定义背景图", "回到当前底膜的默认观感");
  }

  return (
    <div
      className="tone-bg-setting"
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void take(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="tone-bg-head">
        <div>
          <strong>自定义背景图</strong>
          <span>
            {bg ? "已启用 · 仅存本机" : "JPG / PNG / WebP · 仅存本机，不上传服务器"}
            {variant === "desktop" ? " · 与底膜叠加" : ""}
          </span>
        </div>
        <div className="tone-bg-actions">
          <button
            type="button"
            className="tone-bg-btn"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "处理中…" : bg ? "更换" : "上传图片"}
          </button>
          {bg ? (
            <button type="button" className="tone-bg-btn is-ghost" onClick={remove}>
              移除
            </button>
          ) : null}
        </div>
      </div>

      {bg ? (
        <>
          <div className="tone-bg-thumb">
            <img src={bg.url} alt="自定义背景图预览" />
            <div className="tone-bg-thumb-veil" style={{ opacity: bg.dim }} />
          </div>
          <label className="tone-bg-range">
            <span>压暗 {Math.round(bg.dim * 100)}%</span>
            <input
              type="range"
              min={0}
              max={85}
              step={1}
              value={Math.round(bg.dim * 100)}
              onChange={(event) => publishToneBg({ ...bg, dim: Number(event.target.value) / 100 })}
              onPointerUp={(event) => commitDim(event.currentTarget.value)}
              onKeyUp={(event) => commitDim(event.currentTarget.value)}
              onBlur={(event) => commitDim(event.currentTarget.value)}
            />
          </label>
        </>
      ) : (
        <div
          className={"tone-bg-drop" + (dragging ? " is-dragging" : "")}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span>{dragging ? "松手即可设为背景" : "点击或拖拽图片到这里"}</span>
          <span style={{ fontSize: 10 }}>长边自动压到 1920，转 JPEG 后存本机</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void take(event.target.files?.[0])}
      />
    </div>
  );
}
