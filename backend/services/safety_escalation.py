"""Trusted-adult notification state for child-safety incidents.

The parent dashboard is a review surface, not an outbound notification provider.
When no provider is configured, the incident remains visible with a
``dashboard_only`` status instead of being reported as delivered.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from database.db import Database

logger = logging.getLogger(__name__)

STATUS_NOT_REQUIRED = "not_required"
STATUS_PENDING = "pending"
STATUS_ATTEMPTED = "attempted"
STATUS_DELIVERED = "delivered"
STATUS_FAILED = "failed"
STATUS_NOT_ATTEMPTED = "not_attempted"
STATUS_DASHBOARD_ONLY = "dashboard_only"

CHANNEL_PARENT_DASHBOARD = "parent_dashboard"
RECIPIENT_AUTHORISED_PARENT = "authorised parent"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass(frozen=True)
class NotificationResult:
    delivered: bool
    channel: str = CHANNEL_PARENT_DASHBOARD
    recipient: str = RECIPIENT_AUTHORISED_PARENT
    error: str = ""
    status: str = ""


@dataclass(frozen=True)
class EscalationResult:
    incident_id: int
    notification_status: str
    notification_channel: str = ""
    notification_recipient: str = ""
    notification_attempted_at: str | None = None
    notification_delivered_at: str | None = None
    notification_error: str = ""


class TrustedAdultNotifier(Protocol):
    def notify(
        self,
        *,
        incident_id: int,
        child_id: int,
        severity: str,
        category: str,
        language: str,
    ) -> NotificationResult: ...


class ParentDashboardNotifier:
    """Identify the dashboard as the review location, not a notification channel."""

    channel = CHANNEL_PARENT_DASHBOARD
    recipient = RECIPIENT_AUTHORISED_PARENT

    def __init__(self, db: Database) -> None:
        self.db = db

    def notify(
        self,
        *,
        incident_id: int,
        child_id: int,
        severity: str,
        category: str,
        language: str,
    ) -> NotificationResult:
        return NotificationResult(
            delivered=False,
            channel=self.channel,
            recipient=self.recipient,
            status=STATUS_DASHBOARD_ONLY,
        )


class SafetyEscalationService:
    """Create a reviewable incident and record the trusted-adult alert state."""

    def __init__(
        self,
        db: Database,
        notifier: TrustedAdultNotifier | None = None,
    ) -> None:
        self.db = db
        self.notifier = notifier or ParentDashboardNotifier(db)

    def raise_incident(
        self,
        *,
        child_id: int,
        session_id: int | None,
        category: str,
        severity: str,
        detail: str,
        language: str,
        message_id: int | None = None,
    ) -> EscalationResult:
        should_notify = severity == "high"
        if category == "serious_disclosure" and session_id is not None:
            existing = self.db.query_one(
                "SELECT id, notification_status, notification_channel, notification_recipient, "
                "notification_attempted_at, notification_delivered_at, notification_error "
                "FROM safety_incidents WHERE child_id = ? AND session_id = ? "
                "AND category = ? AND reviewed_at IS NULL ORDER BY id DESC LIMIT 1",
                (child_id, session_id, category),
            )
            if existing:
                return EscalationResult(
                    incident_id=int(existing["id"]),
                    notification_status=existing["notification_status"],
                    notification_channel=existing["notification_channel"],
                    notification_recipient=existing["notification_recipient"],
                    notification_attempted_at=existing["notification_attempted_at"],
                    notification_delivered_at=existing["notification_delivered_at"],
                    notification_error=existing["notification_error"],
                )
        initial_status = STATUS_PENDING if should_notify else STATUS_NOT_REQUIRED
        incident_id = self.db.execute(
            "INSERT INTO safety_incidents "
            "(child_id, session_id, category, detail, severity, message_id, language, "
            "notification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                child_id,
                session_id,
                category,
                detail,
                severity,
                message_id,
                language,
                initial_status,
            ),
        )
        if not should_notify:
            return EscalationResult(
                incident_id=incident_id,
                notification_status=initial_status,
            )

        attempted_at = _now()
        try:
            result = self.notifier.notify(
                incident_id=incident_id,
                child_id=child_id,
                severity=severity,
                category=category,
                language=language,
            )
        except Exception as exc:  # noqa: BLE001 - a failed alert must not hide the incident
            logger.exception("Trusted-adult notification failed for incident %s", incident_id)
            result = NotificationResult(
                delivered=False,
                error=f"{type(exc).__name__}: {str(exc)[:240]}",
            )

        delivered_at = _now() if result.delivered and result.status != STATUS_DASHBOARD_ONLY else None
        if result.status == STATUS_DASHBOARD_ONLY:
            status = STATUS_DASHBOARD_ONLY
            attempted_at = None
            error = "No external trusted-adult notification provider is configured."
        elif result.delivered:
            status = STATUS_DELIVERED
            error = ""
        elif result.status == STATUS_ATTEMPTED:
            status = STATUS_ATTEMPTED
            error = result.error[:300]
        else:
            status = STATUS_FAILED
            error = (result.error or "Notification was not delivered.")[:300]
        try:
            self.db.execute(
                "UPDATE safety_incidents SET notification_status = ?, notification_channel = ?, "
                "notification_recipient = ?, notification_attempted_at = ?, "
                "notification_delivered_at = ?, notification_error = ? WHERE id = ?",
                (
                    status,
                    result.channel,
                    result.recipient,
                    attempted_at,
                    delivered_at,
                    error,
                    incident_id,
                ),
            )
        except Exception:  # noqa: BLE001 - keep the pending state rather than claim delivery
            logger.exception("Could not record notification status for incident %s", incident_id)
            return EscalationResult(
                incident_id=incident_id,
                notification_status=STATUS_PENDING,
                notification_channel=result.channel,
                notification_recipient=result.recipient,
                notification_attempted_at=attempted_at,
                notification_error=error,
            )

        return EscalationResult(
            incident_id=incident_id,
            notification_status=status,
            notification_channel=result.channel,
            notification_recipient=result.recipient,
            notification_attempted_at=attempted_at,
            notification_delivered_at=delivered_at,
            notification_error=error,
        )
