import { useCallback, useEffect, useState } from "react";
import type { NewProjectFloorPlanDto } from "@/lib/newhouseApi";
import { mediaUrl } from "@/lib/serverClient";

/**
 * 户型清单：卡片看全，点开看大图。
 *
 * 图优先走服务器快照（/huxing/<uid>-<n>.jpg，见 services/api/assets），
 * 服务器缺图才退房天下直链 —— 那个域名在本机常被拦，所以顺序不能反。
 */

function PlanImage({ plan, big }: { plan: NewProjectFloorPlanDto; big?: boolean }) {
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [plan.image, plan.imageRemote]);

  const src = stage === 0 ? mediaUrl(plan.image) : stage === 1 ? plan.imageRemote : "";
  if (!src) {
    return <div className={big ? "pick-fp-empty is-big" : "pick-fp-empty"}>户型图没抓到</div>;
  }
  return (
    <img
      src={src}
      alt={[plan.name, plan.layout, plan.area ? plan.area + "㎡" : ""].filter(Boolean).join(" ")}
      loading="lazy"
      onError={() => setStage((now) => (now < 2 ? now + 1 : 2))}
    />
  );
}

/** 测评图：房天下给部分户型配的彩色图（房间面积 + 空间评价），源页没有就整块不出现。 */
function ReviewImage({ plan, big }: { plan: NewProjectFloorPlanDto; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [plan.reviewImage]);
  if (!plan.reviewImage || broken) {
    return <div className={big ? "pick-fp-empty is-big" : "pick-fp-empty"}>测评图没抓到</div>;
  }
  return (
    <img
      src={mediaUrl(plan.reviewImage)}
      alt={[plan.name, plan.layout, "户型测评图"].filter(Boolean).join(" ")}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

/** 副标题：几室几厅几卫 + 建面；名称本身已经是它时就不重复。 */
function PlanMeta({ plan }: { plan: NewProjectFloorPlanDto }) {
  const bits: string[] = [];
  if (plan.layout && plan.layout !== plan.name) bits.push(plan.layout);
  if (plan.area) bits.push("建面 " + plan.area + "㎡");
  if (!bits.length) return null;
  return <span className="pick-fp-area">{bits.join(" · ")}</span>;
}

export function FloorPlanGallery({ plans }: { plans: NewProjectFloorPlanDto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  /** 浮层里看哪张：户型图 / 测评图；没测评图的户型只有一个选项 */
  const [mode, setMode] = useState<"plan" | "review">("plan");
  const total = plans.length;

  const step = useCallback(
    (delta: number) => {
      setMode("plan");
      setOpen((now) => (now === null ? now : (now + delta + total) % total));
    },
    [total],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (!total) {
    return <div className="card-inset pick-empty">这个盘还没抓到户型图，点「源页核对」去房天下看。</div>;
  }

  const current = open === null ? null : plans[open];

  return (
    <>
      <div className="pick-fp-grid">
        {plans.map((plan, at) => (
          <button
            type="button"
            key={plan.image + at}
            className="pick-fp-card"
            onClick={() => {
              setMode("plan");
              setOpen(at);
            }}
          >
            <div className="pick-fp-img">
              <PlanImage plan={plan} />
              {plan.reviewImage ? <span className="pick-fp-cp">测评图</span> : null}
              <span className="pick-fp-zoom">看大图</span>
            </div>
            <div className="pick-fp-meta">
              <b className="pick-fp-name">{plan.name}</b>
              <PlanMeta plan={plan} />
              {plan.tags.length ? (
                <div className="pick-fp-tags">
                  {plan.tags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      {current ? (
        <div className="fp-viewer" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="fp-viewer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="fp-viewer-bar">
              <b>
                {current.name}
                {current.layout && current.layout !== current.name ? " · " + current.layout : ""}
                {current.area ? " · 建面 " + current.area + "㎡" : ""}
              </b>
              {current.reviewImage ? (
                <div className="fp-viewer-tabs">
                  <button
                    type="button"
                    className={mode === "plan" ? "fp-viewer-tab is-on" : "fp-viewer-tab"}
                    onClick={() => setMode("plan")}
                  >
                    户型图
                  </button>
                  <button
                    type="button"
                    className={mode === "review" ? "fp-viewer-tab is-on" : "fp-viewer-tab"}
                    onClick={() => setMode("review")}
                  >
                    测评图
                  </button>
                </div>
              ) : null}
              <span className="fp-viewer-count">
                {(open ?? 0) + 1}/{total}
              </span>
              {current.sourceUrl ? (
                <a className="fp-viewer-link" href={current.sourceUrl} target="_blank" rel="noreferrer">
                  源页
                </a>
              ) : null}
              <button type="button" className="fp-viewer-btn" onClick={() => setOpen(null)}>
                ✕
              </button>
            </div>
            <div className="fp-viewer-stage">
              {mode === "review" ? <ReviewImage plan={current} big /> : <PlanImage plan={current} big />}
            </div>
            {total > 1 ? (
              <div className="fp-viewer-nav">
                <button type="button" className="fp-viewer-btn" onClick={() => step(-1)}>
                  ← 上一张
                </button>
                <span className="fp-viewer-hint">← → 切换，Esc 关闭</span>
                <button type="button" className="fp-viewer-btn" onClick={() => step(1)}>
                  下一张 →
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
