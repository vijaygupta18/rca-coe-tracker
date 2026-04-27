from fastapi import APIRouter, Depends

from app.auth import UserCtx, get_current_user
from app.schemas.user import MeOut

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me", response_model=MeOut)
async def me(user: UserCtx = Depends(get_current_user)) -> MeOut:
    return MeOut(email=user.email, name=user.name, is_admin=user.is_admin)
