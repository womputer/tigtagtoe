import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatDateFull, senderEmail, senderName } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToolCallCard } from "./ToolCallCard";

interface EmailDetailPanelProps {
  emailId: string | null;
  onClose: () => void;
}

export function EmailDetailPanel({ emailId, onClose }: EmailDetailPanelProps) {
  const { data, isFetching, error } = useQuery({
    queryKey: ["email", emailId],
    queryFn: () => api.getEmail(emailId!),
    enabled: !!emailId,
  });

  useEffect(() => {
    if (!emailId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emailId, onClose]);

  return (
    <AnimatePresence>
      {emailId ? (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
            aria-hidden
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 bottom-0 z-40 w-full lg:w-[min(900px,92vw)] bg-bg/80 backdrop-blur-2xl border-l border-line shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] overflow-y-auto"
            role="dialog"
            aria-label="Email detail"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 lg:px-8 py-4 border-b border-line bg-bg/80 backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600">
                Email detail
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-line bg-surface-1 hover:bg-surface-2 text-ink-400 hover:text-ink-50 transition-colors flex items-center justify-center"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 lg:px-10 py-8">
              {isFetching && !data ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : error ? (
                <div className="text-bad text-sm">Failed to load the email.</div>
              ) : data ? (
                <div className="grid lg:grid-cols-[1fr_440px] gap-8">
                  <div>
                    <h2 className="display-serif text-3xl lg:text-4xl text-ink-50 leading-tight mb-3">
                      {data.subject || "(no subject)"}
                    </h2>
                    <div className="text-ink-200 mb-1">
                      {senderName(data.sender)}
                      <span className="text-ink-600"> · </span>
                      <span className="font-mono text-xs text-ink-400">
                        {senderEmail(data.sender)}
                      </span>
                    </div>
                    <div className="text-ink-600 text-xs mb-6">
                      {formatDateFull(data.sent_at)}
                    </div>

                    <div className="rounded-2xl border border-line bg-surface-1 p-4 mb-4 text-xs text-ink-400 font-mono">
                      <Row label="From" value={data.sender} />
                      <Row label="To" value={data.recipients || "(none)"} />
                      {data.cc ? <Row label="Cc" value={data.cc} /> : null}
                      <Row label="Source ID" value={data.source_id} />
                    </div>

                    <div className="text-ink-200 whitespace-pre-wrap leading-relaxed text-[15px]">
                      {data.body}
                    </div>
                  </div>

                  <div className="lg:border-l lg:border-line lg:pl-8">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-4">
                      Suggested tools
                      <span className="text-ink-400 ml-2">
                        {data.tool_calls.length}
                      </span>
                    </div>

                    {data.agent_status === "error" ? (
                      <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
                        The agent hit an error on this email.
                        {data.agent_error ? (
                          <div className="mt-1 text-xs opacity-80">{data.agent_error}</div>
                        ) : null}
                      </div>
                    ) : data.tool_calls.length === 0 ? (
                      <div className="text-ink-400 text-sm">
                        No tool calls produced for this email.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.tool_calls.map((tc) => (
                          <ToolCallCard key={tc.id} toolCall={tc} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 py-0.5">
      <div className="text-ink-600 uppercase text-[10px] tracking-wider">{label}</div>
      <div className="text-ink-200 break-all">{value}</div>
    </div>
  );
}
