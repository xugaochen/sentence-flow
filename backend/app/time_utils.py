from datetime import datetime, time, timedelta, timezone


def as_utc(value: datetime) -> datetime:
    """SQLite returns naive timestamps; application timestamps are stored in UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def local_day_utc_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return this system-local day's half-open UTC interval, including DST days.

    Convert each naive local midnight separately: astimezone() consults the
    operating system's time-zone rules for that date, unlike reusing today's
    fixed UTC offset for both boundaries.
    """
    current = as_utc(now) if now is not None else datetime.now(timezone.utc)
    local_date = current.astimezone().date()
    start = datetime.combine(local_date, time.min).astimezone(timezone.utc)
    end = datetime.combine(local_date + timedelta(days=1), time.min).astimezone(timezone.utc)
    return start, end
