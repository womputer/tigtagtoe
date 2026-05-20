"""
Build a sample of triage-worthy emails from the Enron corpus.

What this does:
  1. Downloads the Enron tarball (~400 MB) if it isn't already on disk.
  2. Streams the tarball, parses each message as RFC 2822.
  3. Scores each email on six triage categories (question, meeting,
     complaint, urgent, action item, FYI/newsletter).
  4. Samples ~150 emails with a balanced spread across the categories,
     so reviewers see the agent doing interesting work.
  5. Writes data/sample_emails.csv with the schema from the spec.

You almost never need to run this. The repo ships with the sampled CSV
already committed. Re-run it only if you want to regenerate.

Usage:
    python data/build_dataset.py                 # default flow
    python data/build_dataset.py --maildir PATH  # use an already-extracted maildir
    python data/build_dataset.py --no-download   # fail if tarball is missing
"""

from __future__ import annotations

import argparse
import csv
import email
import email.policy
import hashlib
import io
import random
import re
import sys
import tarfile
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path
from typing import Iterable

ENRON_URL = "https://www.cs.cmu.edu/~enron/enron_mail_20150507.tar.gz"
HERE = Path(__file__).resolve().parent
DEFAULT_TARBALL = HERE / "enron_mail_20150507.tar.gz"
DEFAULT_MAILDIR = HERE / "maildir"
DEFAULT_OUTPUT = HERE / "sample_emails.csv"

# How many emails we want in the final CSV.
TARGET_SAMPLE_SIZE = 150

# How many raw messages we scan before stopping. 500k total in the corpus;
# we don't need to read them all to find 150 interesting ones.
SCAN_LIMIT = 40_000

# Body length cap in the CSV. Keeps the file readable and the LLM prompt small.
MAX_BODY_CHARS = 2500

# Per-category targets. Must sum to TARGET_SAMPLE_SIZE.
CATEGORY_TARGETS = {
    "question": 30,
    "meeting": 25,
    "complaint": 20,
    "urgent": 20,
    "action": 20,
    "fyi": 25,
    "general": 10,
}
assert sum(CATEGORY_TARGETS.values()) == TARGET_SAMPLE_SIZE


# Heuristic keyword sets. These are cheap and good enough to surface emails
# that will give the agent something to do. The agent makes the real call.
KEYWORDS = {
    "meeting": [
        "let's meet", "schedule a meeting", "set up a call", "available to chat",
        "are you free", "calendar invite", "conference call", "phone call",
        "meet on", "meeting on", "lunch on", "coffee on", "discuss this",
        "30 minutes", "30 min", "an hour to", "block off", "find a time",
    ],
    "complaint": [
        "unacceptable", "disappointed", "frustrated", "not happy",
        "this is ridiculous", "fed up", "complaint", "issue with",
        "switch vendors", "consider other options", "escalate", "very upset",
        "terrible service", "let down",
    ],
    "urgent": [
        "asap", "as soon as possible", "urgent", "by eod", "end of day",
        "by tomorrow", "today if possible", "deadline", "time sensitive",
        "high priority", "before noon", "before the close", "right away",
    ],
    "action": [
        "could you", "can you please", "please send", "follow up", "follow-up",
        "action item", "to do", "to-do", "todo", "remind me", "please prepare",
        "please review", "please confirm", "please advise", "next steps",
    ],
    "fyi": [
        "fyi", "for your information", "newsletter", "no-reply", "noreply",
        "automated", "do not reply", "unsubscribe", "weekly digest",
        "monthly update", "system notification", "no action needed",
    ],
}


@dataclass
class ParsedEmail:
    msg_id: str
    sender: str
    to: str
    cc: str
    subject: str
    date_iso: str
    body: str
    scores: dict[str, int] = field(default_factory=dict)

    def best_category(self) -> str:
        """Return the highest-scoring category, or 'general' if all zero."""
        if not self.scores or max(self.scores.values()) == 0:
            return "general"
        return max(self.scores, key=self.scores.get)


def download_tarball(target: Path) -> None:
    """Stream the Enron tarball to disk with a simple progress print."""
    if target.exists():
        print(f"Tarball already at {target}, skipping download.")
        return

    print(f"Downloading {ENRON_URL}")
    print("This is around 400 MB, expect a few minutes.")
    target.parent.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(ENRON_URL) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 256
        with open(target, "wb") as f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    sys.stdout.write(f"\r  {pct:>3}%  {downloaded // (1024*1024)} MB")
                    sys.stdout.flush()
        sys.stdout.write("\n")
    print("Done.")


def iter_messages_from_tar(tarball: Path) -> Iterable[tuple[str, bytes]]:
    """Yield (member name, raw bytes) for every email file in the tarball."""
    with tarfile.open(tarball, "r:gz") as tar:
        for member in tar:
            if not member.isfile():
                continue
            # The corpus uses paths like maildir/skilling-j/inbox/123.
            # Skip dotfiles and anything that doesn't look like a mail file.
            name = member.name
            if "/." in name or name.endswith(".DS_Store"):
                continue
            f = tar.extractfile(member)
            if f is None:
                continue
            yield name, f.read()


def iter_messages_from_maildir(maildir: Path) -> Iterable[tuple[str, bytes]]:
    """Yield (relative path, raw bytes) from an already-extracted maildir."""
    for path in maildir.rglob("*"):
        if not path.is_file():
            continue
        if path.name.startswith(".") or path.name == ".DS_Store":
            continue
        yield str(path.relative_to(maildir.parent)), path.read_bytes()


def clean_address(raw: str) -> str:
    """Lowercase, strip whitespace, drop empty entries."""
    if not raw:
        return ""
    parts = []
    for name, addr in getaddresses([raw]):
        addr = (addr or "").strip().lower()
        if addr:
            parts.append(addr)
    return ", ".join(parts)


def extract_body(msg: email.message.Message) -> str:
    """Get the plain-text body, falling back through MIME parts."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    payload = part.get_content()
                    if isinstance(payload, str):
                        return payload
                except Exception:
                    pass
        return ""
    try:
        content = msg.get_content()
        return content if isinstance(content, str) else ""
    except Exception:
        # Fall back to raw payload
        try:
            payload = msg.get_payload(decode=True)
            if isinstance(payload, bytes):
                return payload.decode("latin-1", errors="replace")
            return str(payload or "")
        except Exception:
            return ""


def normalize_body(body: str) -> str:
    """Trim quoted replies and excess whitespace. Cap length."""
    # Drop everything from the first quoted reply marker on. This keeps
    # the LLM focused on the actual new content of the email.
    cutoffs = [
        "-----Original Message-----",
        "From:",
        "________________________________",
        "On ", # weak, only used as a last resort below
    ]
    for marker in cutoffs[:3]:
        idx = body.find(marker)
        if idx > 0:
            body = body[:idx]

    # Collapse runs of blank lines.
    body = re.sub(r"\n{3,}", "\n\n", body)
    body = body.strip()

    if len(body) > MAX_BODY_CHARS:
        body = body[:MAX_BODY_CHARS].rstrip() + "..."
    return body


def score_categories(subject: str, body: str) -> dict[str, int]:
    """Cheap keyword scoring per category."""
    blob = (subject + "\n" + body).lower()
    scores: dict[str, int] = {}
    for cat, words in KEYWORDS.items():
        hits = sum(1 for w in words if w in blob)
        if hits:
            scores[cat] = hits
    # Question mark heuristic: emails ending or strongly containing a question.
    q_marks = blob.count("?")
    if q_marks:
        scores["question"] = scores.get("question", 0) + min(q_marks, 3)
    return scores


def parse_message(raw: bytes, source_name: str) -> ParsedEmail | None:
    try:
        msg = email.message_from_bytes(raw, policy=email.policy.default)
    except Exception:
        return None

    sender = clean_address(msg.get("From", ""))
    to = clean_address(msg.get("To", ""))
    cc = clean_address(msg.get("Cc", ""))
    subject = (msg.get("Subject", "") or "").strip()

    date_str = msg.get("Date", "")
    try:
        dt = parsedate_to_datetime(date_str) if date_str else None
        date_iso = dt.isoformat() if dt else ""
    except (TypeError, ValueError):
        date_iso = ""

    body = normalize_body(extract_body(msg))

    if not sender or not body or len(body) < 50:
        return None
    if not subject:
        # The agent can still handle empty subjects, but in a sample we'd
        # rather pick emails with one.
        return None

    # Stable id from source path, so re-runs produce the same ids.
    msg_id = "enron_" + hashlib.sha1(source_name.encode()).hexdigest()[:10]

    scores = score_categories(subject, body)
    return ParsedEmail(
        msg_id=msg_id,
        sender=sender,
        to=to,
        cc=cc,
        subject=subject,
        date_iso=date_iso,
        body=body,
        scores=scores,
    )


def sample_balanced(candidates: list[ParsedEmail]) -> list[ParsedEmail]:
    """Pick TARGET_SAMPLE_SIZE emails biased toward category coverage."""
    buckets: dict[str, list[ParsedEmail]] = {cat: [] for cat in CATEGORY_TARGETS}
    for e in candidates:
        buckets[e.best_category()].append(e)

    # Shuffle each bucket deterministically so re-runs match.
    rng = random.Random(42)
    for cat in buckets:
        rng.shuffle(buckets[cat])

    picked: list[ParsedEmail] = []
    seen_ids: set[str] = set()

    # First pass: fill each bucket to its target, or as close as possible.
    for cat, target in CATEGORY_TARGETS.items():
        for e in buckets[cat][:target]:
            if e.msg_id not in seen_ids:
                picked.append(e)
                seen_ids.add(e.msg_id)

    # If we came up short (rare), top up from any remaining candidates.
    if len(picked) < TARGET_SAMPLE_SIZE:
        leftovers = [e for bucket in buckets.values() for e in bucket
                     if e.msg_id not in seen_ids]
        rng.shuffle(leftovers)
        while len(picked) < TARGET_SAMPLE_SIZE and leftovers:
            picked.append(leftovers.pop())

    # Trim if we somehow overshot.
    return picked[:TARGET_SAMPLE_SIZE]


def write_csv(emails: list[ParsedEmail], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["id", "from", "to", "cc", "subject", "date", "body"])
        for e in emails:
            w.writerow([e.msg_id, e.sender, e.to, e.cc, e.subject, e.date_iso, e.body])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--maildir", type=Path, default=None,
                        help="Use an already-extracted maildir folder instead of the tarball.")
    parser.add_argument("--tarball", type=Path, default=DEFAULT_TARBALL,
                        help="Path to the Enron tarball.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="Where to write the sampled CSV.")
    parser.add_argument("--no-download", action="store_true",
                        help="Fail if the tarball is missing instead of downloading.")
    parser.add_argument("--scan-limit", type=int, default=SCAN_LIMIT,
                        help="Stop after scanning this many messages.")
    args = parser.parse_args()

    if args.maildir:
        if not args.maildir.exists():
            print(f"Maildir not found at {args.maildir}", file=sys.stderr)
            return 1
        print(f"Reading messages from {args.maildir}")
        message_source = iter_messages_from_maildir(args.maildir)
    else:
        if not args.tarball.exists():
            if args.no_download:
                print(f"Tarball missing at {args.tarball} and --no-download set.",
                      file=sys.stderr)
                return 1
            download_tarball(args.tarball)
        print(f"Reading messages from {args.tarball}")
        message_source = iter_messages_from_tar(args.tarball)

    candidates: list[ParsedEmail] = []
    scanned = 0
    kept = 0
    for source_name, raw in message_source:
        scanned += 1
        parsed = parse_message(raw, source_name)
        if parsed is None:
            continue
        # Only keep emails that hit at least one category, plus a small
        # quota of "general" emails so the agent has variety.
        if parsed.scores or (kept % 30 == 0 and parsed.best_category() == "general"):
            candidates.append(parsed)
            kept += 1
        if scanned % 2000 == 0:
            sys.stdout.write(f"\rScanned {scanned}, kept {kept} candidates")
            sys.stdout.flush()
        if scanned >= args.scan_limit:
            break

    sys.stdout.write("\n")
    print(f"Done scanning. {scanned} messages read, {len(candidates)} kept.")

    sampled = sample_balanced(candidates)
    print(f"Sampled {len(sampled)} emails across categories:")
    counts: dict[str, int] = {}
    for e in sampled:
        counts[e.best_category()] = counts.get(e.best_category(), 0) + 1
    for cat in CATEGORY_TARGETS:
        print(f"  {cat:>10}: {counts.get(cat, 0):>3}")

    write_csv(sampled, args.output)
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
