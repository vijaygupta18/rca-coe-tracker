import enum
from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RCAStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RCA_DONE = "rca_done"
    CLOSED = "closed"


class RCASeverity(str, enum.Enum):
    SEV1 = "sev1"
    SEV2 = "sev2"
    SEV3 = "sev3"


class RCA(Base):
    __tablename__ = "rcas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    status: Mapped[RCAStatus] = mapped_column(
        SAEnum(RCAStatus, name="rca_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=RCAStatus.OPEN,
    )
    severity: Mapped[RCASeverity | None] = mapped_column(
        SAEnum(RCASeverity, name="rca_severity", values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    environment: Mapped[str | None] = mapped_column(Text, nullable=True)
    services_affected: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    incident_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    incident_detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    incident_mitigated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    incident_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creator_email: Mapped[str] = mapped_column(String, ForeignKey("users.email"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_summary_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_summary_model: Mapped[str | None] = mapped_column(String, nullable=True)

    assignees: Mapped[list["RCAAssignee"]] = relationship(  # noqa: F821
        "RCAAssignee",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
