import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!f.name.toLowerCase().endsWith(".csv")) {
        // Surface a friendly inline error via the parent.
        onFile(f); // let the parent decide; backend will also reject if not CSV.
        return;
      }
      onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-3xl border-2 border-dashed transition-all duration-200",
        "px-8 py-16 lg:py-24 text-center cursor-pointer overflow-hidden",
        dragOver
          ? "border-accent bg-accent/5 shadow-glow"
          : "border-line hover:border-line-strong bg-surface-1",
        disabled && "opacity-60 cursor-not-allowed",
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label="Upload a CSV file"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="relative z-10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-surface-2 border border-line flex items-center justify-center mb-6">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 3v12m0-12l-4 4m4-4l4 4M4 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink-400"
            />
          </svg>
        </div>
        <div className="display-serif text-3xl text-ink-50 mb-2">
          {dragOver ? "Drop it" : "Drop your CSV here"}
        </div>
        <div className="text-ink-400 text-sm">
          or click to browse. Up to 5 MB, columns: id, from, to, cc, subject, date, body.
        </div>
        <div className="mt-6 text-[10px] uppercase tracking-[0.25em] text-ink-600">
          Sample CSV is at /data/sample_emails.csv
        </div>
      </div>

      {/* Soft inner glow when dragging over */}
      {dragOver ? (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent" />
        </div>
      ) : null}
    </div>
  );
}
