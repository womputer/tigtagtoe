import { getToolMeta } from "@/lib/tools";
import { cn } from "@/lib/cn";

interface ToolBadgeProps {
  name: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ToolBadge({ name, size = "sm", showLabel = false, className }: ToolBadgeProps) {
  const meta = getToolMeta(name);
  if (!meta) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-400",
        className,
      )}>
        {name}
      </span>
    );
  }

  const sizeClass = size === "sm" ? "h-5 text-[10px] gap-1" : "h-6 text-xs gap-1.5";

  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex items-center rounded-full border px-2 font-medium uppercase tracking-wider",
        meta.bgClass,
        meta.borderClass,
        meta.colorClass,
        sizeClass,
        className,
      )}
    >
      <span className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold opacity-80">
        {meta.glyph}
      </span>
      {showLabel ? <span>{meta.shortLabel}</span> : null}
    </span>
  );
}
