import pytest
from pydantic import ValidationError

from backend.auth.schemas import TestSessionRequest as SessionRequest


def test_test_session_normalizes_username_and_rejects_extra_fields():
    assert SessionRequest(username="Admin", secret="x").username == "admin"
    with pytest.raises(ValidationError):
        SessionRequest(username="admin", secret="x", password="unused")
