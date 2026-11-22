"""Timestamps as they leave the API.

SQLite's CURRENT_TIMESTAMP / datetime('now') store UTC as "YYYY-MM-DD HH:MM:SS"
with no zone marker, which clients would read as local time. Responses carry
ISO 8601 with an explicit "Z" instead, e.g. "2026-11-22T18:46:25Z".
"""

from typing import Annotated

from pydantic import AfterValidator


def to_iso_utc(value: str) -> str:
    if value.endswith("Z"):
        return value
    return value.replace(" ", "T", 1) + "Z"


UtcTimestamp = Annotated[str, AfterValidator(to_iso_utc)]
