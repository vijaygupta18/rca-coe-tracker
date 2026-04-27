from sqlalchemy import BigInteger, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RCAAssignee(Base):
    __tablename__ = "rca_assignees"

    rca_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rcas.id", ondelete="CASCADE"), primary_key=True
    )
    user_email: Mapped[str] = mapped_column(
        String, ForeignKey("users.email"), primary_key=True
    )
