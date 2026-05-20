/** UI metadata for each tool. The backend is the source of truth for the
 * catalog; this file just maps tool names to colors, labels, and icons used
 * across the inbox and detail views. */

export type ToolName =
  | "schedule_meeting"
  | "draft_response"
  | "escalate_to_manager"
  | "create_task"
  | "flag_urgent"
  | "archive_no_action";

export interface ToolMeta {
  name: ToolName;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;        // text color
  bgClass: string;           // soft background
  borderClass: string;       // tint border
  glyph: string;             // single-character glyph for the badge
}

export const TOOL_META: Record<ToolName, ToolMeta> = {
  schedule_meeting: {
    name: "schedule_meeting",
    label: "Schedule meeting",
    shortLabel: "Meeting",
    description: "Book a calendar event for the time the email proposes.",
    colorClass: "text-tool-meeting",
    bgClass: "bg-[rgba(124,92,255,0.10)]",
    borderClass: "border-[rgba(124,92,255,0.32)]",
    glyph: "M",
  },
  draft_response: {
    name: "draft_response",
    label: "Draft response",
    shortLabel: "Reply",
    description: "Draft a reply that the user can review and send.",
    colorClass: "text-tool-response",
    bgClass: "bg-[rgba(96,165,250,0.10)]",
    borderClass: "border-[rgba(96,165,250,0.32)]",
    glyph: "R",
  },
  escalate_to_manager: {
    name: "escalate_to_manager",
    label: "Escalate",
    shortLabel: "Escalate",
    description: "Flag for management attention.",
    colorClass: "text-tool-escalate",
    bgClass: "bg-[rgba(255,107,122,0.10)]",
    borderClass: "border-[rgba(255,107,122,0.32)]",
    glyph: "E",
  },
  create_task: {
    name: "create_task",
    label: "Create task",
    shortLabel: "Task",
    description: "Add a follow-up to the user's task list.",
    colorClass: "text-tool-task",
    bgClass: "bg-[rgba(79,209,199,0.10)]",
    borderClass: "border-[rgba(79,209,199,0.32)]",
    glyph: "T",
  },
  flag_urgent: {
    name: "flag_urgent",
    label: "Flag urgent",
    shortLabel: "Urgent",
    description: "Mark as time-sensitive without replying yet.",
    colorClass: "text-tool-urgent",
    bgClass: "bg-[rgba(245,196,107,0.10)]",
    borderClass: "border-[rgba(245,196,107,0.32)]",
    glyph: "U",
  },
  archive_no_action: {
    name: "archive_no_action",
    label: "Archive",
    shortLabel: "Archive",
    description: "Newsletters, FYIs, or anything that needs no follow-up.",
    colorClass: "text-tool-archive",
    bgClass: "bg-[rgba(156,163,175,0.10)]",
    borderClass: "border-[rgba(156,163,175,0.32)]",
    glyph: "A",
  },
};

export const TOOL_ORDER: ToolName[] = [
  "escalate_to_manager",
  "flag_urgent",
  "schedule_meeting",
  "draft_response",
  "create_task",
  "archive_no_action",
];

export function getToolMeta(name: string): ToolMeta | null {
  if (name in TOOL_META) {
    return TOOL_META[name as ToolName];
  }
  return null;
}
