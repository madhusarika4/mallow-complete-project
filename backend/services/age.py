"""Age and age-band helpers. A child's band always follows their date of birth."""

from __future__ import annotations

import calendar
from datetime import date, datetime

INFANT_BAND = "0-3"
CHILD_BANDS = ("4-6", "7-9", "10-12")
MAX_AGE = 12


def parse_dob(value: str | date | None) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)[:10]).date()


def age_in_years(dob: date, today: date | None = None) -> int:
    today = today or date.today()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(0, years)


def age_in_months(dob: date, today: date | None = None) -> int:
    today = today or date.today()
    months = (today.year - dob.year) * 12 + today.month - dob.month
    if today.day < dob.day:
        months -= 1
    return max(0, months)


def band_for_age(age: int) -> str:
    if age < 4:
        return INFANT_BAND
    if age <= 6:
        return "4-6"
    if age <= 9:
        return "7-9"
    return "10-12"


def dob_from_age(age: int, today: date | None = None) -> date:
    """Approximate DOB for a parent who only knows an age (mid-year birthday)."""

    today = today or date.today()
    try:
        return date(today.year - age, today.month, min(today.day, 28))
    except ValueError:
        return date(today.year - age, 1, 1)


def dob_from_age_months(months: int, today: date | None = None) -> date:
    """Approximate DOB from an exact month age, preserving that age today."""
    today = today or date.today()
    month_index = today.year * 12 + (today.month - 1) - months
    year, zero_month = divmod(month_index, 12)
    month = zero_month + 1
    return date(year, month, min(today.day, calendar.monthrange(year, month)[1]))


def developmental_stage(dob: date, today: date | None = None) -> str:
    months = age_in_months(dob, today)
    if months < 36:
        start = (months // 6) * 6
        end = min(start + 5, 35)
        return f"{start}-{end} months"
    years = age_in_years(dob, today)
    if years <= 3:
        return "3 years"
    if years <= 6:
        return "4-6 years"
    if years <= 9:
        return "7-9 years"
    return "10-12 years"


def validate_dob(dob: date, today: date | None = None) -> None:
    today = today or date.today()
    if dob > today:
        raise ValueError("Date of birth cannot be in the future")
    if age_in_years(dob, today) > MAX_AGE:
        raise ValueError("Mallow supports children up to age 12")


def describe_age(dob: date, today: date | None = None) -> str:
    months = age_in_months(dob, today)
    if months < 24:
        return f"{months} month{'s' if months != 1 else ''}"
    return f"{months // 12} years"
