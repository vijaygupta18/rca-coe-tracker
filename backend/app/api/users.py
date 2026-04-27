from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import UserCtx, get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[UserOut])
async def search_users(
    q: str = Query("", max_length=100),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: UserCtx = Depends(get_current_user),
) -> list[UserOut]:
    stmt = select(User)
    needle = q.strip()
    if needle:
        like = f"%{needle.lower()}%"
        stmt = stmt.where(
            or_(func.lower(User.name).like(like), func.lower(User.email).like(like))
        )
    stmt = stmt.order_by(User.name).limit(limit)
    result = await db.execute(stmt)
    return [UserOut.model_validate(u) for u in result.scalars().all()]
