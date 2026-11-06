"""Local-time helpers. The family's *local* day defines 'today' and weekly charts."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def local_tz():
    return datetime.now().astimezone().tzinfo


def parse_ts(value: str | None, naive_is_utc: bool = True) -> datetime | None:
    """Parse a stored timestamp to an aware local datetime.

    Tables written by SQLite CURRENT_TIMESTAMP store naive UTC; infant care stores
    naive *local* time typed by the parent (``naive_is_utc=False``).
    """

    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc) if naive_is_utc else dt.replace(tzinfo=local_tz())
    return dt.astimezone(local_tz())


def local_today() -> date:
    return datetime.now().astimezone().date()


def day_range(days: int, today: date | None = None) -> list[date]:
    today = today or local_today()
    return [today - timedelta(days=i) for i in range(days - 1, -1, -1)]


def utc_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def local_day_start_utc(d: date) -> str:
    start = datetime(d.year, d.month, d.day, tzinfo=local_tz())
    return utc_iso(start)
