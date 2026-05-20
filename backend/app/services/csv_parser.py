"""Parse and validate the uploaded emails CSV."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from dateutil import parser as date_parser

REQUIRED_COLUMNS = {"id", "from", "to", "subject", "date", "body"}
OPTIONAL_COLUMNS = {"cc"}
ALL_COLUMNS = REQUIRED_COLUMNS | OPTIONAL_COLUMNS


@dataclass
class ParsedRow:
    source_id: str
    sender: str
    recipients: str
    cc: str
    subject: str
    sent_at: Optional[datetime]
    body: str


@dataclass
class ParseResult:
    rows: list[ParsedRow]
    warnings: list[str]


class CsvValidationError(Exception):
    """Raised when the CSV cannot be processed."""


def _parse_date(value: str) -> Optional[datetime]:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return date_parser.parse(value)
    except (ValueError, TypeError):
        return None


def parse_emails_csv(content: bytes, *, max_rows: int = 1000) -> ParseResult:
    """Parse raw CSV bytes into rows. Raises CsvValidationError on hard failures."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except Exception as exc:
            raise CsvValidationError(f"File is not valid text: {exc}") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise CsvValidationError("CSV is empty or has no header row.")

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = REQUIRED_COLUMNS - headers
    if missing:
        raise CsvValidationError(
            f"CSV is missing required columns: {sorted(missing)}. "
            f"Expected at minimum: {sorted(REQUIRED_COLUMNS)}."
        )

    rows: list[ParsedRow] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()

    for line_num, raw in enumerate(reader, start=2):  # line 1 is the header
        if len(rows) >= max_rows:
            warnings.append(
                f"Stopped at {max_rows} rows. The rest of the file was ignored."
            )
            break

        # Normalize keys to lower case so the column names are case-insensitive.
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}

        source_id = row.get("id", "")
        sender = row.get("from", "")
        subject = row.get("subject", "")
        body = row.get("body", "")

        if not source_id or not sender:
            warnings.append(f"Row {line_num}: missing id or from, skipped.")
            continue
        if not body:
            warnings.append(f"Row {line_num}: empty body, skipped.")
            continue
        if source_id in seen_ids:
            warnings.append(f"Row {line_num}: duplicate id {source_id}, skipped.")
            continue
        seen_ids.add(source_id)

        rows.append(
            ParsedRow(
                source_id=source_id,
                sender=sender,
                recipients=row.get("to", ""),
                cc=row.get("cc", ""),
                subject=subject,
                sent_at=_parse_date(row.get("date", "")),
                body=body,
            )
        )

    if not rows:
        raise CsvValidationError("No valid email rows found in the CSV.")

    return ParseResult(rows=rows, warnings=warnings)
