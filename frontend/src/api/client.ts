import type {
  AgentRunResponse,
  EmailDetail,
  EmailListResponse,
  ToolExecuteResponse,
  UploadCreateResponse,
  UploadStatus,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "")
  || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function networkErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Browsers typically surface offline / CORS / DNS failures as TypeError: Failed to fetch.
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return (
      "Can't reach the API. If the backend is on Render free tier it may be waking up " +
      "(30–60s). Confirm VITE_API_BASE_URL on Vercel points at the live API, and that " +
      "CORS_ORIGINS includes https://tigtagtoe.vercel.app."
    );
  }
  return raw;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiError(networkErrorMessage(err), 0);
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore body parsing errors
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  uploadCsv(file: File): Promise<UploadCreateResponse> {
    const form = new FormData();
    form.append("file", file);
    return request<UploadCreateResponse>("/api/uploads", {
      method: "POST",
      body: form,
    });
  },

  uploadStatus(uploadId: string): Promise<UploadStatus> {
    return request<UploadStatus>(`/api/uploads/${uploadId}/status`);
  },

  listUploads(): Promise<UploadStatus[]> {
    return request<UploadStatus[]>("/api/uploads");
  },

  runAgent(uploadId: string): Promise<AgentRunResponse> {
    return request<AgentRunResponse>("/api/agent/run", {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId }),
    });
  },

  listEmails(params: {
    uploadId?: string;
    tool?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<EmailListResponse> {
    const qs = new URLSearchParams();
    if (params.uploadId) qs.set("upload_id", params.uploadId);
    if (params.tool) qs.set("tool", params.tool);
    if (params.q) qs.set("q", params.q);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<EmailListResponse>(`/api/emails${suffix}`);
  },

  getEmail(id: string): Promise<EmailDetail> {
    return request<EmailDetail>(`/api/emails/${id}`);
  },

  executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecuteResponse> {
    return request<ToolExecuteResponse>(`/api/tools/${name}/execute`, {
      method: "POST",
      body: JSON.stringify({ arguments: args }),
    });
  },

  listTools(): Promise<{ tools: { name: string; description: string; required_arguments: string[] }[] }> {
    return request("/api/tools");
  },

  /** Lightweight probe used by the upload page to distinguish cold-start vs offline. */
  healthz(): Promise<{ status: string }> {
    return request<{ status: string }>("/healthz");
  },
};

export { ApiError, BASE as API_BASE_URL };
