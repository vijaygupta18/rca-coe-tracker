from pydantic import BaseModel


class UserOut(BaseModel):
    email: str
    name: str

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    is_admin: bool
