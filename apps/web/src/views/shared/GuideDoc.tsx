import type { CSSProperties, ReactNode } from "react";
import { guideDoc, type GuideMode } from "@/lib/guideContent";

/** 把文案里的 **加粗** 转成 <strong>，其余内容按文本渲染。 */
export function Rich({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

const HERO_BADGE_DESKTOP: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--accent-cyan)",
  textTransform: "uppercase",
  marginBottom: 6,
};
const HERO_BADGE_MOBILE: CSSProperties = { ...HERO_BADGE_DESKTOP, textTransform: "none", letterSpacing: "0.06em" };

/** 桌面端（宽屏）指南正文。 */
export function GuideDocDesktop({ mode }: { mode: GuideMode }) {
  const doc = guideDoc(mode);
  return (
    <>
      <div className="guide-card hero-card">
        <div style={HERO_BADGE_DESKTOP}>{doc.hero.badge}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)", marginBottom: 8 }}>{doc.hero.title}</div>
        <p className="guide-p">
          <Rich text={doc.hero.intro} />
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--glass-border-subtle)",
          }}
        >
          {doc.hero.facts.map((fact) => (
            <div key={fact.label}>
              <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 700 }}>{fact.label}</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{fact.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card" style={{ borderLeft: "4px solid var(--accent-coral)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="guide-title coral" style={{ marginBottom: 0 }}>
            {doc.redline.title}
          </div>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 10,
              background: "rgba(255,90,82,0.18)",
              color: "#FF5A52",
              fontWeight: 600,
            }}
          >
            {doc.redline.badge}
          </span>
        </div>
        <p className="guide-p">{doc.redline.note}</p>
        <div className="guide-redline-grid">
          {doc.redline.items.map((item) => (
            <div className="guide-redline-item" key={item.title}>
              <b>{item.title}</b>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.power.title}</div>
        <p className="guide-p">
          <Rich text={doc.power.intro} />
        </p>
        <div className="guide-vs-grid">
          <div className="guide-vs-box trap">
            <h4>{doc.power.trapTitle}</h4>
            <ul>
              {doc.power.trapItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="guide-vs-box rule">
            <h4>{doc.power.ruleTitle}</h4>
            <ul>
              {doc.power.ruleItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.pricing.title}</div>
        <p className="guide-p">{doc.pricing.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
          {doc.pricing.cards.map((card) => (
            <div className="guide-tactic-card" key={card.title}>
              <b>{card.title}</b>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.onsite.title}</div>
        <p className="guide-p">{doc.onsite.intro}</p>
        {doc.onsite.items.map((item, index) => (
          <details className="guide-accordion" key={item.q} open={index < 2}>
            <summary>{item.q}</summary>
            <div className="guide-accordion-body">{item.body}</div>
          </details>
        ))}
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.negotiation.title}</div>
        <p className="guide-p">
          <Rich text={doc.negotiation.intro} />
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderLeft: "3px solid var(--accent-cyan)",
            padding: "10px 14px",
            borderRadius: "0 12px 12px 0",
            margin: "10px 0",
            fontSize: 12.5,
            lineHeight: 1.7,
            color: "var(--text-main)",
          }}
        >
          <strong>{doc.negotiation.quote.title}</strong>
          <br />
          {doc.negotiation.quote.text}
          <br />
          <span style={{ color: "var(--text-dim)" }}>{doc.negotiation.quote.note}</span>
        </div>
        <div className="guide-tactics-grid">
          {doc.negotiation.cards.map((card) => (
            <div className="guide-tactic-card" key={card.title}>
              <b>{card.title}</b>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.contract.title}</div>
        <p className="guide-p">{doc.contract.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 8 }}>
          {doc.contract.items.map((item) => (
            <div className="guide-vs-box rule" key={item.title}>
              <h4>{item.title}</h4>
              <p style={{ fontSize: 12, color: "var(--text-sub)", lineHeight: 1.6 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.closing.title}</div>
        {doc.closing.paragraphs.map((paragraph) => (
          <p className="guide-p" key={paragraph}>
            <Rich text={paragraph} />
          </p>
        ))}
      </div>
    </>
  );
}

/** 移动端（< 1024px）指南正文：同一份数据，更紧凑的字号与单列排布。 */
export function GuideDocMobile({ mode }: { mode: GuideMode }) {
  const doc = guideDoc(mode);
  return (
    <>
      <div className="guide-card hero-card">
        <div style={HERO_BADGE_MOBILE}>{doc.hero.badge}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: "var(--text-main)" }}>{doc.hero.title}</div>
        <div className="guide-p" style={{ marginTop: 6 }}>
          <Rich text={doc.hero.intro} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--glass-border-subtle)",
          }}
        >
          {doc.hero.facts.map((fact) => (
            <div key={fact.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 700 }}>{fact.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-main)" }}>{fact.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card" style={{ borderLeft: "3px solid var(--accent-coral)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="guide-title coral" style={{ marginBottom: 0 }}>
            {doc.redline.title}
          </div>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(255,90,82,0.2)",
              color: "#FF5A52",
            }}
          >
            {doc.redline.badge}
          </span>
        </div>
        <p className="guide-p" style={{ marginBottom: 8 }}>
          {doc.redline.note}
        </p>
        <div className="guide-redline-grid">
          {doc.redline.items.map((item) => (
            <div className="guide-redline-item" key={item.title}>
              <b>{item.title}</b>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.power.title}</div>
        <p className="guide-p">
          <Rich text={doc.power.intro} />
        </p>
        <div className="guide-vs-grid">
          <div className="guide-vs-box trap">
            <h4>{doc.power.trapTitle}</h4>
            <ul>
              {doc.power.trapItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="guide-vs-box rule">
            <h4>{doc.power.ruleTitle}</h4>
            <ul>
              {doc.power.ruleItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.pricing.title}</div>
        <p className="guide-p">{doc.pricing.intro}</p>
        <div className="guide-tactics-grid">
          {doc.pricing.cards.map((card) => (
            <div className="guide-tactic-card" key={card.title}>
              <b>{card.title}</b>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.onsite.title}</div>
        <p className="guide-p">{doc.onsite.intro}</p>
        {doc.onsite.items.map((item, index) => (
          <details className="guide-accordion" key={item.q} open={index < 2}>
            <summary>{item.q}</summary>
            <div className="guide-accordion-body">{item.body}</div>
          </details>
        ))}
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.negotiation.title}</div>
        <div className="guide-p">
          <Rich text={doc.negotiation.intro} />
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderLeft: "3px solid var(--accent-cyan)",
            padding: "8px 12px",
            borderRadius: "0 10px 10px 0",
            margin: "8px 0",
            fontSize: 11.5,
            lineHeight: 1.6,
            color: "var(--text-main)",
          }}
        >
          <strong>{doc.negotiation.quote.title}</strong>
          <br />
          {doc.negotiation.quote.text}
          <br />
          <span style={{ color: "var(--text-dim)" }}>{doc.negotiation.quote.note}</span>
        </div>
        <div className="guide-tactics-grid">
          {doc.negotiation.cards.map((card) => (
            <div className="guide-tactic-card" key={card.title}>
              <b>{card.title}</b>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.contract.title}</div>
        <p className="guide-p">{doc.contract.intro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {doc.contract.items.map((item) => (
            <div className="guide-vs-box rule" style={{ padding: "10px 12px" }} key={item.title}>
              <h4 style={{ fontSize: 12 }}>{item.title}</h4>
              <p style={{ fontSize: 11.5, color: "var(--text-sub)", lineHeight: 1.55 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-title">{doc.closing.title}</div>
        {doc.closing.paragraphs.map((paragraph) => (
          <div className="guide-p" key={paragraph}>
            <Rich text={paragraph} />
          </div>
        ))}
      </div>

      <div className="small-note" style={{ margin: "14px 0 10px", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
        DOCS 权威知识库精编 · {doc.label}篇 · 响应式双端 1:1 对齐
      </div>
    </>
  );
}
