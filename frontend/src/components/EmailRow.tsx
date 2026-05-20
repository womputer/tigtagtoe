import { cn } from "@/lib/cn";
import { formatDate, senderName, senderEmail, truncate } from "@/lib/format";
import { ToolBadge } from "./ToolBadge";
import type { EmailListItem } from "@/api/types";

interface EmailRowProps {
  email: EmailListItem;
  active?: boolean;
  onClick?: () => void;
}

export function EmailRow({ email, active, onClick }: EmailRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left grid items-center gap-3 px-4 py-3.5 rounded-xl transition-colors border",
        "grid-cols-[minmax(160px,1fr)_minmax(0,2fr)_auto_auto]",
        active
          ? "bg-surface-2 border-line-strong"
          : "border-transparent hover:bg-surface-1 hover:border-line",
      )}
    >
      <div className="min-w-0">
        <div className="text-ink-50 text-sm truncate">{senderName(email.sender)}</div>
        <div className="text-ink-600 text-xs font-mono truncate">
          {senderEmail(email.sender)}
        </div>
      </div>

      <div className="min-w-0">
        <div className={cn("text-sm truncate", active ? "text-ink-50" : "text-ink-200")}>
          {email.subject || "(no subject)"}
        </div>
        <div className="text-ink-600 text-xs truncate">{truncate(email.source_id, 40)}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {email.agent_status === "pending" ? (
          <span className="text-[10px] uppercase tracking-wider text-ink-600">
            queued
          </span>
        ) : email.agent_status === "error" ? (
          <span className="text-[10px] uppercase tracking-wider text-bad">
            error
          </span>
        ) : (
          email.tools.map((t) => <ToolBadge key={t} name={t} size="sm" />)
        )}
      </div>

      <div className="text-ink-600 text-xs font-mono shrink-0 w-20 text-right">
        {formatDate(email.sent_at)}
      </div>
    </button>
  );
}
