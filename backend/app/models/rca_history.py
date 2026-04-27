from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RCAHistory(Base):
    __tablename__ = "rca_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    rca_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rcas.id", ondelete="CASCADE"), nullable=False
    )
    actor_email: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    from_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    to_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
