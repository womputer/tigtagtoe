export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return d.toLocaleDateString(undefined, {
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function senderName(from: string): string {
  if (!from) return "Unknown";
  const m = from.match(/^([^<]+)</);
  if (m) return m[1].trim();
  const email = from.split(",")[0]?.trim() ?? from;
  const local = email.split("@")[0] ?? email;
  // Convert "first.last" or "first_last" to a friendly display.
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function senderEmail(from: string): string {
  if (!from) return "";
  const m = from.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return from.split(",")[0]?.trim() ?? from;
}

export function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trimEnd() + "..." : s;
}
