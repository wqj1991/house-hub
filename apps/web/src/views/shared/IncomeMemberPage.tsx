import type { IncomeMember } from "@house/core";
import { IncomeMemberEditor } from "./IncomeMemberEditor";

export interface IncomeMemberPageProps {
  /** 录入目标：新增时是 createMember() 出来的空壳，编辑时是已有成员 */
  member: IncomeMember;
  isNew: boolean;
  variant?: "desktop" | "mobile";
  onSubmit: (member: IncomeMember) => void;
  onBack: () => void;
  /** 编辑已有成员时给：删除按钮显示在录入页底部 */
  onRemove?: () => void;
}

/**
 * 家庭成员录入子页面：整页接管收入页（桌面导轨 / 手机屏内同构），
 * 返回即回到列表，不再在列表里内联展开表单。
 */
export function IncomeMemberPage({ member, isNew, variant = "desktop", onSubmit, onBack, onRemove }: IncomeMemberPageProps) {
  const title = isNew ? "添加家庭成员" : "编辑家庭成员";

  return (
    <>
      {variant === "mobile" ? (
        <div className="m-nav-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="m-nav-circle-btn"
              onClick={onBack}
              title="返回"
              style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}
            >
              ‹
            </button>
            <h1 className="m-nav-title" style={{ fontSize: 20 }}>
              {title}
            </h1>
          </div>
          <div className="m-nav-actions" />
        </div>
      ) : (
        <div
          className="glass"
          style={{ padding: "18px 22px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}
        >
          <button type="button" className="g-btn" onClick={onBack} style={{ padding: "6px 12px", fontSize: 13 }}>
            ‹ 返回
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              录完点「保存成员」回到列表，家庭收入与可贷额度随即重算。
            </div>
          </div>
        </div>
      )}

      <IncomeMemberEditor
        key={member.uid}
        value={member}
        variant={variant}
        onSubmit={onSubmit}
        onCancel={onBack}
      />
      {isNew || !onRemove ? null : (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="g-btn g-btn-danger"
            style={{ width: "100%", padding: "11px 14px", fontSize: 13 }}
            onClick={onRemove}
          >
            删除这个家庭成员
          </button>
        </div>
      )}
    </>
  );
}
