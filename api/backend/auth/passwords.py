from __future__ import annotations

from pwdlib import PasswordHash

class Passwords:
    def __init__(self) -> None:
        self.argon = PasswordHash.recommended()
        self.dummy_hash = self.argon.hash("invalid-password")

    def hash(self, password: str) -> str:
        return self.argon.hash(password)

    def verify(self, password: str, encoded: str | None) -> bool:
        if not encoded:
            return self.argon.verify(password, self.dummy_hash)
        try:
            return self.argon.verify(password, encoded)
        except Exception:
            self.argon.verify(password, self.dummy_hash)
            return False
