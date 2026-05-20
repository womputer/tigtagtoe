import { motion } from "framer-motion";
import { getToolMeta } from "@/lib/tools";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

interface ToolResultProps {
  toolName: string;
  result: Record<string, unknown> | null;
  loading?: boolean;
  error?: string | null;
}

export function ToolResult({ toolName, result, loading, error }: ToolResultProps) {
  const meta = getToolMeta(toolName);

  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-line bg-surface-1 p-4 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
        {error}
      </div>
    );
  }

  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "mt-3 rounded-xl border bg-surface-1 p-4",
        meta?.borderClass ?? "border-line",
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-3">
        Mocked result
      </div>

      {renderForTool(toolName, result)}

      <details className="mt-4 group">
        <summary className="text-[10px] uppercase tracking-wider text-ink-600 cursor-pointer hover:text-ink-200 select-none">
          Raw JSON
        </summary>
        <pre className="mt-2 font-mono text-[11px] text-ink-200 leading-relaxed bg-bg/40 p-3 rounded-lg overflow-x-auto border border-line">
{JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm py-1">
      <div className="text-ink-600 uppercase text-[10px] tracking-wider mt-1">
        {label}
      </div>
      <div className="text-ink-50 break-words">{children}</div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-ink-200 text-xs">{children}</span>;
}

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}

function renderForTool(toolName: string, r: Record<string, unknown>) {
  switch (toolName) {
    case "schedule_meeting":
      return (
        <div>
          <div className="display-serif text-2xl text-ink-50 mb-2">
            {asString(r.subject) || "Meeting"}
          </div>
          <Field label="Meeting ID"><Mono>{asString(r.meeting_id)}</Mono></Field>
          <Field label="When">{asString(r.proposed_time) || "TBD"}</Field>
          <Field label="Duration">{asString(r.duration_minutes)} minutes</Field>
          <Field label="Attendees">
            {Array.isArray(r.attendees) ? (r.attendees as string[]).join(", ") : asString(r.attendees)}
          </Field>
          <Field label="Calendar"><Mono>{asString(r.calendar_link)}</Mono></Field>
        </div>
      );
    case "draft_response":
      return (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-600 mb-1">
            Draft · {asString(r.tone)}
          </div>
          <div className="display-serif text-xl text-ink-50 mb-2">
            {asString(r.subject)}
          </div>
          <div className="text-ink-200 whitespace-pre-wrap text-sm leading-relaxed">
            {asString(r.body)}
          </div>
          <Field label="To">{asString(r.to)}</Field>
          <Field label="Words">{asString(r.word_count)}</Field>
        </div>
      );
    case "escalate_to_manager":
      return (
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <div className="display-serif text-2xl text-ink-50">Escalation opened</div>
            <PriorityChip p={asString(r.priority)} />
          </div>
          <Field label="Ticket"><Mono>{asString(r.ticket_id)}</Mono></Field>
          <Field label="Assigned to">{asString(r.assigned_to)}</Field>
          <Field label="Reason">{asString(r.reason)}</Field>
          <Field label="SLA">{asString(r.sla_response_hours)} hours to first response</Field>
        </div>
      );
    case "create_task":
      return (
        <div>
          <div className="display-serif text-2xl text-ink-50 mb-2">
            {asString(r.title)}
          </div>
          <Field label="Task ID"><Mono>{asString(r.task_id)}</Mono></Field>
          <Field label="Assignee">{asString(r.assignee)}</Field>
          <Field label="Due">{asString(r.due_date) || "Not set"}</Field>
          {asString(r.notes) ? <Field label="Notes">{asString(r.notes)}</Field> : null}
        </div>
      );
    case "flag_urgent":
      return (
        <div>
          <div className="display-serif text-2xl text-ink-50 mb-2">Pinned to inbox</div>
          <Field label="Reason">{asString(r.reason)}</Field>
          <Field label="Deadline">{asString(r.deadline) || "Not specified"}</Field>
          <Field label="Expires"><Mono>{asString(r.expires_at)}</Mono></Field>
        </div>
      );
    case "archive_no_action":
      return (
        <div>
          <div className="display-serif text-2xl text-ink-50 mb-2">Archived</div>
          <Field label="Category">{asString(r.category)}</Field>
          <Field label="Folder">{asString(r.folder)}</Field>
          <Field label="Reason">{asString(r.reason)}</Field>
        </div>
      );
    default:
      return null;
  }
}

function PriorityChip({ p }: { p: string }) {
  const map: Record<string, string> = {
    low: "text-ink-400 border-line bg-surface-2",
    medium: "text-warn border-warn/30 bg-warn/10",
    high: "text-bad border-bad/30 bg-bad/10",
    critical: "text-bad border-bad/50 bg-bad/15",
  };
  const cls = map[p] ?? map.medium;
  return (
    <span className={`px-2 h-5 inline-flex items-center rounded-full text-[10px] uppercase tracking-wider border ${cls}`}>
      {p || "medium"}
    </span>
  );
}
