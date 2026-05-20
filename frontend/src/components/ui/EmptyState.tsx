import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-8 py-16 rounded-3xl glass",
        className,
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-line flex items-center justify-center mb-6">
        <span className="text-3xl text-ink-400 logo-mark">T</span>
      </div>
      <h3 className="display-serif text-2xl text-ink-50 mb-2">{title}</h3>
      {description ? (
        <p className="text-ink-400 max-w-md mb-6">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
