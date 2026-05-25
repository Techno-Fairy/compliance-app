"""
Filing History / Audit Trail helpers.

These helpers are called from endpoint handlers whenever a state-changing
action occurs on a deadline or document. Keeping the logging logic here
avoids duplication across routers.
"""
from sqlalchemy.orm import Session

from app.models.history import FilingHistoryEntry


def log_entry(
    db: Session,
    *,
    business_id: int,
    action: str,
    description: str,
    deadline_id: int | None = None,
    performed_by: str | None = None,
) -> FilingHistoryEntry:
    """
    Persist a single audit log entry.

    Args:
        db:           SQLAlchemy session (caller commits).
        business_id:  ID of the business this entry belongs to.
        action:       Machine-readable action code, e.g. 'deadline_completed'.
        description:  Human-readable description shown in the audit trail UI.
        deadline_id:  Optional FK to the related deadline.
        performed_by: Email of the user who triggered the action.

    Returns:
        The newly created FilingHistoryEntry (not yet committed).
    """
    entry = FilingHistoryEntry(
        business_id=business_id,
        deadline_id=deadline_id,
        action=action,
        description=description,
        performed_by=performed_by,
    )
    db.add(entry)
    return entry