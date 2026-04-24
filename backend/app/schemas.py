from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    phone: str

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True

class MessageBase(BaseModel):
    receiver_id: int
    content: str

class MessageCreate(MessageBase):
    pass

class MessageRead(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    phone: Optional[str] = None

class GroupBase(BaseModel):
    name: str

class GroupCreate(GroupBase):
    pass

class GroupRead(GroupBase):
    id: int
    created_at: datetime
    created_by: int

    class Config:
        orm_mode = True

class GroupMemberBase(BaseModel):
    group_id: int
    user_id: int

class GroupMemberRead(GroupMemberBase):
    id: int
    joined_at: datetime

    class Config:
        orm_mode = True
