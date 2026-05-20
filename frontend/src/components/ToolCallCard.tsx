import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import { getToolMeta } from "@/lib/tools";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { ToolResult } from "./ToolResult";
import type { ToolCallOut } from "@/api/types";

interface ToolCallCardProps {
  toolCall: ToolCallOut;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const meta = getToolMeta(toolCall.tool_name);
  const [showArgs, setShowArgs] = useState(false);

  const execute = useMutation({
    mutationFn: () => api.executeTool(toolCall.tool_name, toolCall.arguments),
  });

  const label = meta?.label ?? toolCall.tool_name;
  const colorClass = meta?.colorClass ?? "text-ink-200";
  const borderClass = meta?.borderClass ?? "border-line";
  const bgClass = meta?.bgClass ?? "bg-surface-1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-2xl border bg-surface-1 p-4 md:p-5 transition-colors",
        borderClass,
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg border flex items-center justify-center font-bold shrink-0",
            borderClass,
            bgClass,
            colorClass,
          )}
        >
          {meta?.glyph ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={cn("font-medium", colorClass)}>{label}</div>
            <span className="font-mono text-[10px] text-ink-600">
              #{toolCall.order_idx + 1}
            </span>
          </div>
          {toolCall.rationale ? (
            <div className="text-ink-400 text-sm mt-1 leading-relaxed">
              {toolCall.rationale}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => execute.mutate()}
          disabled={execute.isPending}
        >
          {execute.isPending ? "Running…" : execute.data ? "Run again" : "Run mock"}
        </Button>
        <button
          onClick={() => setShowArgs((s) => !s)}
          className="text-[11px] uppercase tracking-wider text-ink-600 hover:text-ink-200 transition-colors"
        >
          {showArgs ? "Hide arguments" : "Show arguments"}
        </button>
      </div>

      {showArgs ? (
        <pre className="mt-3 font-mono text-[11px] text-ink-200 leading-relaxed bg-bg/40 p-3 rounded-lg overflow-x-auto border border-line">
{JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      ) : null}

      <ToolResult
        toolName={toolCall.tool_name}
        result={execute.data?.result ?? null}
        loading={execute.isPending}
        error={
          execute.error
            ? execute.error instanceof ApiError
              ? execute.error.message
              : String(execute.error)
            : null
        }
      />
    </motion.div>
  );
}
