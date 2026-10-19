import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, ApiError, API_BASE_URL } from "@/api/client";
import { useUploadStore } from "@/store/upload";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToolBadge } from "@/components/ToolBadge";
import { TOOL_ORDER } from "@/lib/tools";

export function Upload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeUploadId, setActiveUpload } = useUploadStore();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadCsv(file),
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError(String(err));
    },
    onSuccess: (data) => {
      setError(null);
      setWarnings(data.warnings);
      setActiveUpload(data.upload_id);
      // Kick off the agent right after upload.
      api.runAgent(data.upload_id).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    },
  });

  const { data: status, isFetching } = useQuery({
    queryKey: ["upload", activeUploadId, "status"],
    queryFn: () => api.uploadStatus(activeUploadId!),
    enabled: !!activeUploadId,
    refetchInterval: (q) => {
      const s = q.state.data?.agent_status;
      return s === "running" || s === "idle" ? 1500 : false;
    },
  });

  const { data: byToolCounts } = useQuery({
    queryKey: ["upload", activeUploadId, "tool-summary"],
    queryFn: async () => {
      const result: Record<string, number> = {};
      await Promise.all(
        TOOL_ORDER.map(async (t) => {
          const res = await api.listEmails({
            uploadId: activeUploadId!,
            tool: t,
            limit: 1,
          });
          result[t] = res.total;
        }),
      );
      return result;
    },
    enabled: !!activeUploadId && status?.agent_status === "done",
  });

  const handleFile = (file: File) => {
    setError(null);
    setWarnings([]);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please pick a .csv file.");
      return;
    }
    uploadMutation.mutate(file);
  };

  const isWorking = uploadMutation.isPending ||
    status?.agent_status === "running" ||
    status?.agent_status === "idle";

  const goToInbox = () => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    navigate("/inbox");
  };

  return (
    <div className="px-8 lg:px-16 py-14 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-4">
          Step one
        </div>
        <h1 className="display-serif text-5xl md:text-6xl text-ink-50 mb-3">
          Upload your emails
        </h1>
        <p className="text-ink-400 mb-10 max-w-xl">
          The agent runs as soon as the file is parsed. You'll see live progress,
          then a per-tool breakdown when it's done.
        </p>
      </motion.div>

      <UploadDropzone onFile={handleFile} disabled={isWorking} />

      {error ? (
        <div className="mt-6 glass rounded-2xl border-bad/30 bg-bad/10 px-5 py-4 text-sm text-bad space-y-2">
          <div>{error}</div>
          <div className="text-[11px] text-ink-400 font-mono break-all">
            API: {API_BASE_URL}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-6 glass rounded-2xl px-5 py-4 text-sm text-ink-200">
          <div className="text-[10px] uppercase tracking-[0.25em] text-warn mb-2">
            Parsed with warnings
          </div>
          <ul className="space-y-1 text-ink-400">
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
            {warnings.length > 8 ? (
              <li className="text-ink-600">
                · and {warnings.length - 8} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {status ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-10"
        >
          <div className="glass rounded-3xl p-6 md:p-8">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-2">
                  Current dataset
                </div>
                <div className="display-serif text-3xl text-ink-50 mb-1">
                  {status.filename}
                </div>
                <div className="text-ink-400 text-sm">
                  {status.email_count} emails parsed and stored
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-2">
                  Agent
                </div>
                <StatusPill status={status.agent_status} />
              </div>
            </div>

            <div className="mt-8">
              {status.agent_status === "running" || status.agent_status === "idle" ? (
                <ProgressBlock
                  done={status.agent_progress}
                  total={status.agent_total || status.email_count}
                  errors={status.agent_error_count}
                />
              ) : status.agent_status === "done" ? (
                <DoneBlock
                  total={status.agent_total}
                  errors={status.agent_error_count}
                  byTool={byToolCounts}
                  onOpenInbox={goToInbox}
                />
              ) : status.agent_status === "error" ? (
                <div className="text-bad text-sm">
                  Agent run hit an error. Check the backend logs for details.
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}

      {isFetching && !status ? (
        <div className="mt-10 space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    running: { color: "text-accent border-accent/40 bg-accent/10", label: "Running" },
    idle: { color: "text-ink-400 border-line bg-surface-2", label: "Queued" },
    done: { color: "text-good border-good/40 bg-good/10", label: "Done" },
    error: { color: "text-bad border-bad/40 bg-bad/10", label: "Error" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-2 px-3 h-7 rounded-full text-xs border ${s.color}`}>
      {status === "running" ? <Dot pulsing /> : <Dot />}
      {s.label}
    </span>
  );
}

function Dot({ pulsing }: { pulsing?: boolean }) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full bg-current ${
        pulsing ? "animate-pulse" : ""
      }`}
    />
  );
}

function ProgressBlock({ done, total, errors }: { done: number; total: number; errors: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-ink-50">
          <span className="display-serif text-4xl">{done}</span>
          <span className="text-ink-600 ml-2">of {total} emails processed</span>
        </div>
        <div className="font-mono text-xs text-ink-400">{pct}%</div>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      {errors > 0 ? (
        <div className="mt-3 text-xs text-warn">
          {errors} email{errors === 1 ? "" : "s"} hit an error and will be marked in the inbox.
        </div>
      ) : null}
    </div>
  );
}

function DoneBlock({
  total,
  errors,
  byTool,
  onOpenInbox,
}: {
  total: number;
  errors: number;
  byTool: Record<string, number> | undefined;
  onOpenInbox: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <div className="display-serif text-5xl text-ink-50">{total - errors}</div>
        <div className="text-ink-400">emails triaged</div>
        {errors > 0 ? <div className="text-warn text-sm">· {errors} with errors</div> : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-8">
        {TOOL_ORDER.map((t) => (
          <div
            key={t}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-1 border border-line"
          >
            <ToolBadge name={t} size="sm" showLabel />
            <span className="font-mono text-sm text-ink-200">
              {byTool?.[t] ?? "·"}
            </span>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onOpenInbox} rightIcon={<Arrow />}>
        Open the inbox
      </Button>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
