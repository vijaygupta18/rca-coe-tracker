from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User


@dataclass
class UserCtx:
    email: str
    name: str
    is_admin: bool


def _read_pomerium_identity(request: Request) -> tuple[str, str] | None:
    headers = request.headers
    email = (
        headers.get("x-pomerium-claim-email")
        or headers.get("x-pomerium-user-email")
        or headers.get("x-forwarded-email")
    )
    if not email:
        return None
    name = (
        headers.get("x-pomerium-claim-name")
        or headers.get("x-pomerium-user-name")
        or headers.get("x-forwarded-user")
        or email.split("@")[0]
    )
    return email.lower(), name


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserCtx:
    identity = _read_pomerium_identity(request)
    if identity is None and settings.dev_fake_email:
        identity = (
            settings.dev_fake_email.lower(),
            settings.dev_fake_name or settings.dev_fake_email.split("@")[0],
        )
    if identity is None:
        raise HTTPException(status_code=401, detail="missing pomerium identity")

    email, name = identity
    seed_admin = email in settings.admin_email_list

    stmt = (
        pg_insert(User)
        .values(email=email, name=name, is_admin=seed_admin)
        .on_conflict_do_update(
            index_elements=[User.email],
            set_={
                "name": name,
                "last_seen_at": datetime.now(timezone.utc),
            },
        )
    )
    await db.execute(stmt)

    if seed_admin:
        await db.execute(
            User.__table__.update().where(User.email == email).values(is_admin=True)
        )

    user_row = (await db.execute(select(User).where(User.email == email))).scalar_one()
    return UserCtx(email=email, name=name, is_admin=bool(user_row.is_admin))


async def require_admin(user: UserCtx = Depends(get_current_user)) -> UserCtx:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="admin required")
    return user


def can_edit_rca(user: UserCtx, creator_email: str, assignee_emails: set[str]) -> bool:
    if user.is_admin:
        return True
    if user.email == creator_email:
        return True
    return user.email in assignee_emails


def can_delete_rca(user: UserCtx, creator_email: str) -> bool:
    return user.is_admin or user.email == creator_email
