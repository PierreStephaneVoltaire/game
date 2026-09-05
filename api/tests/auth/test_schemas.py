import pytest
from pydantic import ValidationError

from backend.auth.schemas import RegisterRequest, PasswordRequest, ResetRequest


@pytest.mark.parametrize("model,extra,field", [
    (RegisterRequest, {"username": "player_1"}, "password"),
    (PasswordRequest, {}, "new_password"),
    (ResetRequest, {"token": "x" * 24}, "new_password"),
])
def test_password_minimum_is_eight(model, extra, field):
    assert getattr(model(**extra, **{field: "abcdefgh"}), field) == "abcdefgh"
    with pytest.raises(ValidationError):
        model(**extra, **{field: "abcdefg"})


def test_registration_no_longer_collects_a_contact():
    with pytest.raises(ValidationError):
        RegisterRequest(username="player_1", password="abcdefgh", contactHandle="unused")
