import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useUploadStore } from "@/store/upload";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { activeUploadId, clear } = useUploadStore();

  const { data: upload } = useQuery({
    queryKey: ["upload", activeUploadId, "status"],
    queryFn: () => api.uploadStatus(activeUploadId!),
    enabled: !!activeUploadId,
    refetchInterval: (q) => {
      const s = q.state.data?.agent_status;
      return s === "running" ? 1500 : false;
    },
  });

  return (
    <div className="relative min-h-screen flex">
      {/* Giant background ornament. Sits behind everything, never grabs attention. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-32 -right-24 w-[640px] h-[640px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-24 w-[560px] h-[560px] rounded-full bg-tool-task/10 blur-[120px]" />
        <div
          className="absolute right-[-180px] bottom-[-220px] text-[640px] leading-none font-serif text-white/[0.025] select-none"
          style={{ fontFamily: '"Instrument Serif", serif' }}
        >
          T
        </div>
      </div>

      <aside className="relative z-10 w-64 shrink-0 hidden md:flex flex-col p-6 border-r border-line bg-bg/40 backdrop-blur-xl">
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 mb-10 text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center logo-mark text-2xl text-accent leading-none">
            T
          </div>
          <div>
            <div className="text-ink-50 font-medium tracking-tight">TigTagToe</div>
            <div className="text-ink-600 text-xs">email triage agent</div>
          </div>
        </button>

        <nav className="flex flex-col gap-1">
          <NavItem to="/" label="Home" exact />
          <NavItem to="/upload" label="Upload" />
          <NavItem to="/inbox" label="Inbox" />
        </nav>

        <div className="mt-auto">
          {upload ? (
            <div className="rounded-xl border border-line bg-surface-1 p-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-600 mb-1">
                Active dataset
              </div>
              <div className="text-sm text-ink-50 truncate">{upload.filename}</div>
              <div className="text-xs text-ink-400 mt-1">
                {upload.email_count} email{upload.email_count === 1 ? "" : "s"}
              </div>
              {upload.agent_status === "running" ? (
                <div className="mt-3">
                  <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{
                        width: upload.agent_total
                          ? `${Math.round((upload.agent_progress / upload.agent_total) * 100)}%`
                          : "5%",
                      }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] text-ink-600 uppercase tracking-wider">
                    Agent running, {upload.agent_progress} of {upload.agent_total}
                  </div>
                </div>
              ) : upload.agent_status === "done" ? (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-good">
                  Agent finished
                </div>
              ) : null}
              <button
                onClick={() => {
                  clear();
                  navigate("/upload");
                }}
                className="mt-3 text-[10px] uppercase tracking-wider text-ink-600 hover:text-ink-200"
              >
                Clear &rarr;
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface-1 p-3 text-xs text-ink-400">
              No active dataset.
              <br />
              <button
                onClick={() => navigate("/upload")}
                className="mt-2 text-accent hover:underline"
              >
                Upload a CSV &rarr;
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0">{children}</main>
    </div>
  );
}

function NavItem({ to, label, exact }: { to: string; label: string; exact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          "px-3 h-10 rounded-xl flex items-center text-sm transition-colors",
          isActive
            ? "bg-surface-2 text-ink-50 border border-line"
            : "text-ink-400 hover:text-ink-50 hover:bg-surface-1 border border-transparent",
        )
      }
    >
      {label}
    </NavLink>
  );
}
