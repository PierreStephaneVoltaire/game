from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME = re.compile(r"^[a-z0-9_]{3,24}$")


def camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


def normalized_username(value: str) -> str:
    value = value.strip().lower()
    if not USERNAME.fullmatch(value):
        raise ValueError("username must use 3-24 lowercase letters, numbers, or underscores")
    return value


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, alias_generator=camel, populate_by_name=True)
    username: str = Field(max_length=24)
    password: str = Field(min_length=8, max_length=128)

    _username = field_validator("username")(normalized_username)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=camel, populate_by_name=True)
    username: str = Field(max_length=24)
    password: str = Field(min_length=1, max_length=128)

    _username = field_validator("username")(normalized_username)


class PasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=camel, populate_by_name=True)
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=camel, populate_by_name=True)
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class DiscordCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=camel, populate_by_name=True)
    onboarding_token: str = Field(min_length=20, max_length=200)
    username: str = Field(max_length=24)

    _username = field_validator("username")(normalized_username)


class SafeUser(BaseModel):
    model_config = ConfigDict(alias_generator=camel, populate_by_name=True)
    user_id: str
    username: str
    providers: list[str]
    has_password: bool
