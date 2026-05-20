import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { useUploadStore } from "@/store/upload";
import { useFilters } from "@/store/filters";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmailRow } from "@/components/EmailRow";
import { EmailDetailPanel } from "@/components/EmailDetailPanel";
import { ToolBadge } from "@/components/ToolBadge";
import { TOOL_ORDER, getToolMeta } from "@/lib/tools";
import { cn } from "@/lib/cn";

export function Inbox() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeUploadId } = useUploadStore();
  const { tool, query, setTool, setQuery, clear } = useFilters();
  const [localQuery, setLocalQuery] = useState(query);

  // Sync filters into the URL so the back button works and deep links are possible.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tool) next.set("tool", tool);
    else next.delete("tool");
    if (query) next.set("q", query);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }, [tool, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate from URL on first load.
  useEffect(() => {
    const t = searchParams.get("tool");
    const q = searchParams.get("q");
    if (t) setTool(t);
    if (q) {
      setQuery(q);
      setLocalQuery(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the search input.
  useEffect(() => {
    const h = setTimeout(() => setQuery(localQuery.trim()), 200);
    return () => clearTimeout(h);
  }, [localQuery, setQuery]);

  const { data, isFetching } = useQuery({
    queryKey: ["emails", { activeUploadId, tool, query }],
    queryFn: () => api.listEmails({ uploadId: activeUploadId ?? undefined, tool: tool ?? undefined, q: query || undefined }),
    enabled: true,
    refetchInterval: (q) => {
      // Refresh while the agent is still working.
      const anyPending = q.state.data?.items.some((e) => e.agent_status === "pending");
      return anyPending ? 2000 : false;
    },
  });

  const toolCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.items ?? []).forEach((e) => {
      e.tools.forEach((t) => {
        m[t] = (m[t] ?? 0) + 1;
      });
    });
    return m;
  }, [data]);

  const showEmpty = !isFetching && (data?.items.length ?? 0) === 0;

  return (
    <div className="px-6 lg:px-12 py-10 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-6 flex-wrap mb-8"
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-2">
            Inbox
          </div>
          <h1 className="display-serif text-5xl text-ink-50">
            {data?.total ?? "..."} <span className="text-ink-400">triaged</span>
          </h1>
        </div>

        <div className="flex gap-2">
          <Link to="/upload">
            <Button variant="secondary">Upload new CSV</Button>
          </Link>
        </div>
      </motion.div>

      <div className="glass rounded-2xl p-2 mb-4 flex flex-wrap items-center gap-1">
        <FilterChip
          active={!tool}
          label="All"
          count={data?.total}
          onClick={() => setTool(null)}
        />
        {TOOL_ORDER.map((t) => {
          const meta = getToolMeta(t)!;
          return (
            <FilterChip
              key={t}
              active={tool === t}
              label={meta.shortLabel}
              count={toolCounts[t]}
              tone={meta.colorClass}
              icon={<ToolBadge name={t} size="sm" />}
              onClick={() => setTool(tool === t ? null : t)}
            />
          );
        })}

        <div className="ml-auto flex items-center gap-2 w-full sm:w-auto sm:min-w-[280px]">
          <SearchInput value={localQuery} onChange={setLocalQuery} />
          {(tool || query) && (
            <button
              onClick={() => {
                clear();
                setLocalQuery("");
              }}
              className="text-xs text-ink-400 hover:text-ink-50 px-3 h-9 rounded-lg border border-line"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isFetching && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : showEmpty ? (
        <EmptyState
          title="No emails yet"
          description={
            activeUploadId
              ? "No emails match the current filters. Try clearing them."
              : "Upload a CSV to start. There's a sample file at /data/sample_emails.csv."
          }
          action={
            <Link to="/upload">
              <Button>Go to upload</Button>
            </Link>
          }
        />
      ) : (
        <div className="glass rounded-2xl divide-y divide-line">
          {data?.items.map((e) => (
            <EmailRow
              key={e.id}
              email={e}
              active={params.id === e.id}
              onClick={() => navigate(`/inbox/${e.id}${window.location.search}`)}
            />
          ))}
        </div>
      )}

      <EmailDetailPanel
        emailId={params.id ?? null}
        onClose={() => navigate(`/inbox${window.location.search}`)}
      />
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  tone,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | undefined;
  tone?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-3 inline-flex items-center gap-2 rounded-xl text-sm transition-colors border",
        active
          ? cn("bg-surface-2 border-line-strong text-ink-50", tone)
          : "border-transparent text-ink-400 hover:text-ink-50 hover:bg-surface-1",
      )}
    >
      {icon}
      <span>{label}</span>
      {count != null ? (
        <span className="font-mono text-[10px] text-ink-600">{count}</span>
      ) : null}
    </button>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600"
      >
        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search sender or subject…"
        className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-1 border border-line text-sm text-ink-50 placeholder:text-ink-600 focus:outline-none focus:border-accent/60 transition-colors"
      />
    </div>
  );
}
