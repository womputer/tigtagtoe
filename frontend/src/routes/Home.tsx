import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { TOOL_META, TOOL_ORDER } from "@/lib/tools";

export function Home() {
  return (
    <div className="px-8 lg:px-16 py-14 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16"
      >
        <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-6">
          Email triage
        </div>
        <h1 className="display-serif text-6xl md:text-8xl text-ink-50 leading-[0.95] mb-6">
          Read every email.{" "}
          <span className="text-accent italic">Almost.</span>
        </h1>
        <p className="text-ink-400 text-lg md:text-xl max-w-2xl leading-relaxed">
          TigTagToe sends each email in your inbox through an agent that picks the
          right tool to handle it. Meetings get scheduled, replies get drafted,
          complaints get escalated, newsletters get archived. You stay focused on
          the ten percent that needs your judgment.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/upload">
            <Button size="lg" rightIcon={<Arrow />}>
              Upload a CSV
            </Button>
          </Link>
          <Link to="/inbox">
            <Button size="lg" variant="ghost">
              Go to inbox
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16"
      >
        <div className="text-[10px] uppercase tracking-[0.25em] text-ink-600 mb-5">
          Six tools, one decision per email
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TOOL_ORDER.map((t) => {
            const meta = TOOL_META[t];
            return (
              <div
                key={t}
                className="glass rounded-2xl p-5 transition-colors hover:border-line-strong"
              >
                <div
                  className={`w-9 h-9 rounded-lg border ${meta.borderClass} ${meta.bgClass} ${meta.colorClass} flex items-center justify-center font-bold mb-4`}
                >
                  {meta.glyph}
                </div>
                <div className="text-ink-50 font-medium mb-1">{meta.label}</div>
                <div className="text-ink-400 text-sm leading-relaxed">
                  {meta.description}
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="grid md:grid-cols-3 gap-4"
      >
        <Step n="01" title="Upload">
          Drop in a CSV of emails. Validated on arrival, friendly errors if the
          schema is off.
        </Step>
        <Step n="02" title="Run">
          The agent reads each email and proposes one or more tool calls, with a
          short reason for every choice.
        </Step>
        <Step n="03" title="Review">
          Open the inbox, filter by tool, click any suggestion to see what the
          tool would actually do.
        </Step>
      </motion.section>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="font-mono text-xs text-ink-600 mb-3">{n}</div>
      <div className="display-serif text-2xl text-ink-50 mb-2">{title}</div>
      <div className="text-ink-400 text-sm leading-relaxed">{children}</div>
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
