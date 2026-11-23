import { useState } from "react";
import { DECISIONS, decisionCount, decisionImpacts, decisionVerdicts } from "@/lib/purchaseFlow";
import { resetDecisions, setDecision, useFlowProgress } from "@/lib/flowProgress";
import { Rich } from "@/views/shared/GuideDoc";

/**
 * 「我的」里的开局 8 项配置卡：把流程页开头的 8 个决策单独提出来，不进流程页也能设。
 * 与流程页共用同一份 localStorage 状态，改完两边立刻同步。
 * 默认收起：卡片只占一行摘要 + 已选项药丸，点「展开配置」才铺开 8 行。
 */
export function FlowSettingsCard({ mobile }: { mobile: boolean }) {
  const progress = useFlowProgress();
  const decisions = progress.decisions;
  const done = decisionCount(decisions);
  const impacts = decisionImpacts(decisions);
  const verdicts = decisionVerdicts(decisions);
  const [open, setOpen] = useState(false);
  const goFlow = () => {
    window.location.hash = mobile ? "/fl" : "/flow";
  };

  return (
    <div className={(mobile ? "m-card glass" : "guide-card") + " flow-settings" + (open ? " is-open" : "")}>
      <div className="flow-decisions-head">
        <div className="flow-settings-head-main">
          <div className="flow-block-title" style={{ marginTop: 0 }}>
            开局先定这 8 件事
          </div>
          <p className="guide-p">
            {done === 0
              ? "上产证写谁、共有方式、谁做借款人、购房资格、看哪个盘、首付从哪来、怎么贷款、怎么办 —— 8 项决定材料份数、到场次数和总周期。"
              : "已配好的口径会同步到购房流程，决定材料份数、到场次数和总周期。"}
          </p>
        </div>
        <div className="flow-settings-head-side">
          <span className="flow-decisions-count">
            <b className="n">{done}</b> / {DECISIONS.length} 已定
          </span>
          <button
            type="button"
            className="flow-settings-toggle"
            aria-expanded={open}
            aria-controls="flow-settings-body"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "收起" : "展开配置"}
          </button>
        </div>
      </div>

      {impacts.length > 0 ? (
        <div className="flow-verdict-tags flow-settings-tags">
          {impacts.map((item) => (
            <span className="flow-verdict-tag" key={item.decision.id}>
              <b>{item.decision.no}</b> {item.option.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="flow-mat-hint">还没定任何一项。点「展开配置」逐项点选，或直接按推荐口径往下走。</div>
      )}

      <div id="flow-settings-body" hidden={!open}>
        {DECISIONS.map((decision) => {
          const picked = decisions[decision.id];
          const option = decision.options.find((item) => item.id === picked);
          return (
            <div className={"flow-decision-row" + (picked ? " is-picked" : "")} key={decision.id}>
              <div className="flow-decision-top">
                <span className="flow-decision-no">{decision.no}</span>
                <span className="flow-decision-title">{decision.title}</span>
                {picked ? <span className="flow-decision-flag">已定</span> : null}
              </div>
              <div className="flow-decision-why">
                <Rich text={decision.why} />
              </div>
              <div className="flow-decision-opts">
                {decision.options.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={"flow-opt" + (picked === item.id ? " is-on" : "") + (item.recommended ? " is-rec" : "")}
                    aria-pressed={picked === item.id}
                    onClick={() => setDecision(decision.id, item.id)}
                  >
                    {item.label}
                    {item.recommended ? <i className="flow-opt-rec" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
              {option ? (
                <div className="flow-decision-effect">
                  <span className="flow-decision-effect-k">选了它 →</span>
                  <Rich text={option.effect} />
                </div>
              ) : null}
            </div>
          );
        })}

        {done > 0 ? (
          <>
            <div className="flow-block-title" style={{ marginTop: 14 }}>
              你这一单的口径
            </div>
            <ul className="flow-verdict-list">
              {verdicts.map((line) => (
                <li key={line}>
                  <Rich text={line} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="flow-progress-actions flow-settings-actions">
        {open && done > 0 ? (
          <button type="button" className="flow-reset" onClick={resetDecisions}>
            清空决策
          </button>
        ) : null}
        <button type="button" className="flow-reset" onClick={goFlow}>
          打开购房流程 →
        </button>
      </div>
    </div>
  );
}
