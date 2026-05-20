export interface UploadCreateResponse {
  upload_id: string;
  email_count: number;
  warnings: string[];
}

export interface UploadStatus {
  upload_id: string;
  filename: string;
  email_count: number;
  agent_status: "idle" | "running" | "done" | "error";
  agent_progress: number;
  agent_total: number;
  agent_error_count: number;
  agent_started_at: string | null;
  agent_finished_at: string | null;
}

export interface ToolCallOut {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  rationale: string;
  order_idx: number;
}

export interface EmailListItem {
  id: string;
  source_id: string;
  sender: string;
  subject: string;
  sent_at: string | null;
  agent_status: "pending" | "done" | "error";
  tools: string[];
}

export interface EmailListResponse {
  items: EmailListItem[];
  total: number;
}

export interface EmailDetail {
  id: string;
  upload_id: string;
  source_id: string;
  sender: string;
  recipients: string;
  cc: string;
  subject: string;
  sent_at: string | null;
  body: string;
  agent_status: "pending" | "done" | "error";
  agent_error: string | null;
  tool_calls: ToolCallOut[];
}

export interface ToolExecuteResponse {
  tool: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AgentRunResponse {
  upload_id: string;
  status: string;
  total: number;
}
