import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { resetChecks, setCoupleMode, toggleCheck, useFlowProgress } from "@/lib/flowProgress";
import {
  ALL_CHECKS,
  CHECK_GUIDES,
  DECISIONS,
  FLOW_FACTS,
  FLOW_STEPS,
  FLOW_TIMELINE,
  MATERIAL_GROUPS,
  ONLINE_OVERVIEW,
  ONLINE_PRINCIPLE,
  POLICY_NOTES,
  decisionImpacts,
  decisionVerdicts,
  STEP_ONLINE,
  type CheckGuide,
  type FlowStep,
  type OnlineMode,
  type StepOnline,
} from "@/lib/purchaseFlow";
import { Rich } from "@/views/shared/GuideDoc";

/** 双端共用一套内容：桌面吃 .guide-card，移动吃 .m-card.glass，其余结构完全一致。 */
function cardClass(mobile: boolean): string {
  return mobile ? "m-card glass flow-card" : "guide-card flow-card";
}

const META_LABEL: CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--accent-cyan)", letterSpacing: "0.04em" };
const META_VALUE: CSSProperties = { fontSize: 12, color: "var(--text-main)", marginTop: 2, lineHeight: 1.5 };

function CheckRow({ id, text, done, onGuide }: { id: string; text: string; done: boolean; onGuide: (id: string) => void }) {
  const guide = CHECK_GUIDES[id];
  return (
    <div className={"flow-check" + (done ? " is-done" : "")}>
      <label className="flow-check-main">
        <input type="checkbox" checked={done} onChange={() => toggleCheck(id)} />
        <span>{text}</span>
      </label>
      {guide ? (
        <button type="button" className="flow-guide-btn" onClick={() => onGuide(id)} aria-label={"怎么办理：" + text}>
          <span aria-hidden="true">ⓘ</span> 怎么办
        </button>
      ) : null}
    </div>
  );
}

/** 「怎么办」弹层：外部门办的事给出入口与步骤，链接直接跳官方站点。 */
function GuideDialog({ guideId, onClose }: { guideId: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!guideId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [guideId, onClose]);

  if (!guideId) return null;
  const guide: CheckGuide | undefined = CHECK_GUIDES[guideId];
  if (!guide) return null;

  return createPortal(
    <div className="flow-dialog-mask" role="presentation" onClick={onClose}>
      <div
        className="flow-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flow-dialog-head">
          <div>
            <div className="flow-dialog-kicker">去哪里办</div>
            <h3 className="flow-dialog-title" id="flow-dialog-title">
              {guide.title}
            </h3>
          </div>
          <button type="button" className="flow-dialog-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="flow-dialog-where">{guide.where}</div>
        <ol className="flow-dialog-steps">
          {guide.steps.map((line) => (
            <li key={line}>
              <Rich text={line} />
            </li>
          ))}
        </ol>
        {guide.note ? (
          <div className="flow-dialog-note">
            <Rich text={guide.note} />
          </div>
        ) : null}
        {guide.links && guide.links.length > 0 ? (
          <div className="flow-dialog-links">
            {guide.links.map((link) => (
              <a className="flow-dialog-link" key={link.url} href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label} ↗
              </a>
            ))}
          </div>
        ) : null}
        <div className="flow-dialog-foot">入口名称与路径以官方站点当期页面为准；链接只指到官方首页 / 办事大厅。</div>
      </div>
    </div>,
    document.body,
  );
}

/** 决策结论卡：把 8 项选择压成「你这一单怎么办」的几条硬结论。 */
function VerdictsCard({ decisions, mobile }: { decisions: Record<string, string>; mobile: boolean }) {
  const impacts = decisionImpacts(decisions);
  const verdicts = decisionVerdicts(decisions);
  return (
    <div className={cardClass(mobile) + " flow-verdicts"}>
      <div className="flow-block-title" style={{ marginTop: 0 }}>
        你这一单的口径（来自「我的」→ 开局先定这 8 件事）
      </div>
      {impacts.length === 0 ? (
        <>
          <p className="guide-p">
            8 项开局决策已经挪到「我的」页面配置。配好后回到这里，会自动生成一张「你这一单怎么办」的结论卡。
          </p>
          <div className="flow-progress-actions">
            <button
              type="button"
              className="flow-reset"
              onClick={() => {
                window.location.hash = mobile ? "/me" : "/profile";
              }}
            >
              去「我的」配这 8 项 →
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="flow-verdict-list">
            {verdicts.map((line) => (
              <li key={line}>
                <Rich text={line} />
              </li>
            ))}
          </ul>
          <div className="flow-verdict-tags">
            {impacts.map((item) => (
              <span className="flow-verdict-tag" key={item.decision.id}>
                <b>{item.decision.no}</b> {item.option.label}
              </span>
            ))}
          </div>
          <div className="flow-mat-hint">
            已定 {impacts.length} / {DECISIONS.length} 项；没定的项去「我的」里补，补完回来自动更新。
          </div>
        </>
      )}
    </div>
  );
}

/** 网办口径的徽标色：全线上=青，线上+到场=琥珀，必须到场=红。 */
function onlineClass(mode: OnlineMode): string {
  return "flow-online is-" + mode;
}

function OnlineBlock({ online }: { online: StepOnline }) {
  return (
    <div className={onlineClass(online.mode)}>
      <div className="flow-online-head">
        <span className="flow-online-badge">{online.label}</span>
        <span className="flow-online-title">{online.title}</span>
      </div>
      <div className="flow-online-sub">网上入口</div>
      <div className="flow-online-entry">
        {online.entry.map((item) => (
          <span className="flow-online-chip" key={item}>
            {item}
          </span>
        ))}
      </div>
      <ul className="flow-online-notes">
        {online.notes.map((line) => (
          <li key={line}>
            <Rich text={line} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepCard({
  step,
  mobile,
  checks,
  onGuide,
}: {
  step: FlowStep;
  mobile: boolean;
  checks: Record<string, true>;
  onGuide: (id: string) => void;
}) {
  return (
    <div className={cardClass(mobile) + " flow-step"} data-step={step.id}>
      <div className="flow-step-head">
        <span className="flow-step-no">{step.no}</span>
        <div>
          <div className="flow-step-title">{step.title}</div>
          <div className="flow-step-sub">{step.sub}</div>
        </div>
      </div>

      <div className="flow-meta">
        <div>
          <div style={META_LABEL}>什么时候</div>
          <div style={META_VALUE}>{step.when}</div>
        </div>
        <div>
          <div style={META_LABEL}>要多久</div>
          <div style={META_VALUE}>{step.duration}</div>
        </div>
        <div>
          <div style={META_LABEL}>花多少钱</div>
          <div style={META_VALUE}>{step.cost}</div>
        </div>
        <div>
          <div style={META_LABEL}>拿到什么</div>
          <div style={META_VALUE}>{step.output}</div>
        </div>
      </div>

      {STEP_ONLINE[step.id] ? <OnlineBlock online={STEP_ONLINE[step.id]} /> : null}

      <div className="flow-block-title">做什么</div>
      <ul className="flow-list">
        {step.todo.map((line) => (
          <li key={line}>
            <Rich text={line} />
          </li>
        ))}
      </ul>

      <div className="flow-block-title">带什么</div>
      <div className="flow-chips">
        {step.bring.map((item) => (
          <span className="flow-chip" key={item}>
            {item}
          </span>
        ))}
      </div>

      <div className="flow-block-title coral">这一步的坑</div>
      <ul className="flow-risks">
        {step.risks.map((line) => (
          <li key={line}>
            <Rich text={line} />
          </li>
        ))}
      </ul>

      <div className="flow-block-title">打钩清单</div>
      <div className="flow-checks">
        {step.checks.map((item) => (
          <CheckRow key={item.id} id={item.id} text={item.text} done={Boolean(checks[item.id])} onGuide={onGuide} />
        ))}
      </div>
    </div>
  );
}

function FlowBoard({ mobile }: { mobile: boolean }) {
  const progress = useFlowProgress();
  const [guideId, setGuideId] = useState<string | null>(null);
  const visible = ALL_CHECKS.filter((item) => !item.coupleOnly || progress.couple);
  const doneCount = visible.filter((item) => progress.checks[item.id]).length;
  const total = visible.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className={mobile ? "flow-doc is-mobile" : "flow-doc"}>
      <div className={cardClass(mobile) + " flow-hero"}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--accent-cyan)", marginBottom: 6 }}>
          北京新房 · 大兴 / 五环外口径 · 夫妻共同署名
        </div>
        <div className="flow-hero-title">从核资格到拿红本，8 步走完</div>
        <p className="guide-p">
          每一步只回答四件事：<strong>什么时候做、要多久、花多少钱、拿到什么</strong>。清单可以直接打钩，
          进度存在本机，桌面端和手机端同步。
        </p>

        <div className="flow-progress">
          <div className="flow-progress-top">
            <span>
              已勾 <b className="n">{doneCount}</b> / {total} 项
            </span>
            <span className="n">{percent}%</span>
          </div>
          <div className="flow-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: percent + "%" }} />
          </div>
          <div className="flow-progress-actions">
            <button
              type="button"
              className={"flow-toggle" + (progress.couple ? " is-on" : "")}
              aria-pressed={progress.couple}
              onClick={() => setCoupleMode(!progress.couple)}
            >
              <i aria-hidden="true" />
              夫妻双方上产证
            </button>
            <button type="button" className="flow-reset" onClick={() => window.print()}>
              打印清单
            </button>
            <button type="button" className="flow-reset" onClick={resetChecks} disabled={doneCount === 0 && Object.keys(progress.checks).length === 0}>
              清空打钩
            </button>
          </div>
        </div>

        <div className="flow-facts">
          {FLOW_FACTS.map((fact) => (
            <div key={fact.label}>
              <div style={META_LABEL}>{fact.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>{fact.value}</div>
            </div>
          ))}
        </div>
      </div>


      <VerdictsCard decisions={progress.decisions} mobile={mobile} />

      <div className={cardClass(mobile)}>
        <div className="flow-block-title" style={{ marginTop: 0 }}>
          政策口径（2025-08-08 后 · 五环外）
        </div>
        <ul className="flow-list">
          {POLICY_NOTES.map((line) => (
            <li key={line}>
              <Rich text={line} />
            </li>
          ))}
        </ul>
      </div>

      <div className={cardClass(mobile) + " flow-online-board"}>
        <div className="flow-block-title" style={{ marginTop: 0 }}>
          能网办的都网办（8 步的线上/线下分界）
        </div>
        <p className="guide-p">
          <Rich text={ONLINE_PRINCIPLE} />
        </p>
        <div className="flow-online-grid">
          {ONLINE_OVERVIEW.map((bucket) => (
            <div className={"flow-online-bucket is-" + bucket.mode} key={bucket.mode}>
              <div className="flow-online-bucket-head">
                <span className="flow-online-badge">{bucket.label}</span>
                <span className="n">{bucket.steps.length} 步</span>
              </div>
              <div className="flow-online-sub">{bucket.hint}</div>
              <ol>
                {bucket.steps.map((id) => {
                  const step = FLOW_STEPS.find((item) => item.id === id);
                  return step ? <li key={id}>{step.no + ". " + step.title}</li> : null;
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {FLOW_STEPS.map((step) => (
        <StepCard key={step.id} step={step} mobile={mobile} checks={progress.checks} onGuide={setGuideId} />
      ))}

      <div className={cardClass(mobile)}>
        <div className="flow-block-title" style={{ marginTop: 0 }}>
          材料包（按环节分组）
        </div>
        <div className="flow-mat-grid">
          {MATERIAL_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.coupleOnly || progress.couple);
            if (items.length === 0) return null;
            return (
              <div className="flow-mat-group" key={group.title}>
                <b>{group.title}</b>
                <span className="flow-mat-hint">{group.hint}</span>
                <ul>
                  {items.map((item) => (
                    <li key={item.text}>{item.text}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cardClass(mobile)}>
        <div className="flow-block-title" style={{ marginTop: 0 }}>
          五周排期
        </div>
        <div className="flow-timeline">
          {FLOW_TIMELINE.map((row) => (
            <div className="flow-timeline-row" key={row.when}>
              <span className="flow-timeline-when">{row.when}</span>
              <span className="flow-timeline-what">{row.what}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="small-note" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
        口径：北京五环外新房 · 2025-08-08 新政 · 勾选进度只存本机
      </div>

      <GuideDialog guideId={guideId} onClose={() => setGuideId(null)} />
    </div>
  );
}

/** 桌面端（宽屏）流程手册。 */
export function FlowDesktop(): ReactNode {
  return <FlowBoard mobile={false} />;
}

/** 移动端流程手册：与桌面共用同一份数据与同一份进度。 */
export function FlowMobile(): ReactNode {
  return <FlowBoard mobile />;
}