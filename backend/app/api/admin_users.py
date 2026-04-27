import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import UserCtx, require_admin
from app.config import settings
from app.database import get_db
from app.models.rca import RCA
from app.models.rca_assignee import RCAAssignee
from app.models.user import User

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class AdminUserOut(BaseModel):
    email: str
    name: str
    is_admin: bool
    is_seed_admin: bool
    created_at: datetime
    last_seen_at: datetime
    rca_count: int

    model_config = {"from_attributes": True}


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


class AdminUserPatch(BaseModel):
    is_admin: bool


class AdminUserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=200)
    is_admin: bool = False


def _is_seed_admin(email: str) -> bool:
    return email.lower() in settings.admin_email_list


async def _admin_count(db: AsyncSession) -> int:
    return (
        await db.execute(select(func.count()).select_from(User).where(User.is_admin == True))  # noqa: E712
    ).scalar_one()


@router.get("", response_model=AdminUserListOut)
async def list_users(
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: UserCtx = Depends(require_admin),
) -> AdminUserListOut:
    base = select(User)
    if q:
        like = f"%{q.lower().strip()}%"
        base = base.where(
            or_(func.lower(User.name).like(like), func.lower(User.email).like(like))
        )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(User.is_admin.desc(), User.last_seen_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    ).scalars().all()

    if rows:
        emails = [r.email for r in rows]
        rca_counts_stmt = (
            select(RCA.creator_email, func.count(RCA.id))
            .where(RCA.creator_email.in_(emails))
            .group_by(RCA.creator_email)
        )
        creator_counts = dict((await db.execute(rca_counts_stmt)).all())
        assignee_counts_stmt = (
            select(RCAAssignee.user_email, func.count(RCAAssignee.rca_id))
            .where(RCAAssignee.user_email.in_(emails))
            .group_by(RCAAssignee.user_email)
        )
        assignee_counts = dict((await db.execute(assignee_counts_stmt)).all())
    else:
        creator_counts, assignee_counts = {}, {}

    items = [
        AdminUserOut(
            email=u.email,
            name=u.name,
            is_admin=bool(u.is_admin),
            is_seed_admin=_is_seed_admin(u.email),
            created_at=u.created_at,
            last_seen_at=u.last_seen_at,
            rca_count=int(creator_counts.get(u.email, 0)) + int(assignee_counts.get(u.email, 0)),
        )
        for u in rows
    ]
    return AdminUserListOut(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=AdminUserOut, status_code=201)
async def create_user(
    payload: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _: UserCtx = Depends(require_admin),
) -> AdminUserOut:
    email = payload.email.lower().strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="invalid email")
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="user already exists")
    name = (payload.name or "").strip() or email.split("@")[0]
    user = User(email=email, name=name, is_admin=payload.is_admin)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AdminUserOut(
        email=user.email,
        name=user.name,
        is_admin=bool(user.is_admin),
        is_seed_admin=_is_seed_admin(user.email),
        created_at=user.created_at,
        last_seen_at=user.last_seen_at,
        rca_count=0,
    )


@router.patch("/{email}", response_model=AdminUserOut)
async def patch_user(
    email: str,
    payload: AdminUserPatch,
    db: AsyncSession = Depends(get_db),
    actor: UserCtx = Depends(require_admin),
) -> AdminUserOut:
    target_email = email.lower().strip()
    user = (await db.execute(select(User).where(User.email == target_email))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if _is_seed_admin(target_email) and not payload.is_admin:
        raise HTTPException(
            status_code=400,
            detail="this user is configured as admin in ADMIN_EMAILS and cannot be demoted from the UI",
        )

    if user.is_admin and not payload.is_admin:
        admin_count = await _admin_count(db)
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="cannot demote the last admin")
        if user.email == actor.email:
            raise HTTPException(
                status_code=400,
                detail="cannot demote yourself; ask another admin to do it",
            )

    user.is_admin = payload.is_admin
    await db.commit()
    await db.refresh(user)

    return AdminUserOut(
        email=user.email,
        name=user.name,
        is_admin=bool(user.is_admin),
        is_seed_admin=_is_seed_admin(user.email),
        created_at=user.created_at,
        last_seen_at=user.last_seen_at,
        rca_count=0,
    )


@router.delete("/{email}", status_code=204)
async def delete_user(
    email: str,
    db: AsyncSession = Depends(get_db),
    actor: UserCtx = Depends(require_admin),
) -> None:
    target_email = email.lower().strip()
    if target_email == actor.email:
        raise HTTPException(status_code=400, detail="cannot delete yourself")
    if _is_seed_admin(target_email):
        raise HTTPException(
            status_code=400,
            detail="this user is configured as admin in ADMIN_EMAILS and cannot be removed from the UI",
        )

    user = (await db.execute(select(User).where(User.email == target_email))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if user.is_admin:
        admin_count = await _admin_count(db)
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="cannot delete the last admin")

    creator_count = (
        await db.execute(select(func.count()).select_from(RCA).where(RCA.creator_email == target_email))
    ).scalar_one()
    if creator_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"this user created {creator_count} RCA(s); reassign or delete those first",
        )

    await db.execute(delete(RCAAssignee).where(RCAAssignee.user_email == target_email))
    await db.execute(delete(User).where(User.email == target_email))
    await db.commit()
