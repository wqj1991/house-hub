import * as React from "react";
import { cn } from "../cn";

/** 一张「悬浮纸」：页面里的主要容器，宽度由父级断点决定。 */
export function Sheet({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sheet)] bg-[var(--paper-2)] text-[var(--ink)] shadow-[var(--shadow-sheet)] ring-1 ring-[var(--paper-edge)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
