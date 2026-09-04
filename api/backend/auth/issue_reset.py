from __future__ import annotations

import argparse
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .schemas import normalized_username
from .service import AuthProblem, AuthService


def main() -> None:
    parser = argparse.ArgumentParser(description="Issue a one-time password reset URL.")
    parser.add_argument("username")
    parser.add_argument("--issued-by", required=True)
    args = parser.parse_args()
    database_url = os.environ.get("DATABASE_URL")
    app_base_url = os.environ.get("APP_BASE_URL")
    if not database_url or not app_base_url:
        parser.error("DATABASE_URL and APP_BASE_URL must be configured")
    with Session(create_engine(database_url)) as db:
        try:
            token = AuthService(db).issue_reset(normalized_username(args.username), args.issued_by[:200])
        except AuthProblem as error:
            parser.error(error.message)
    print(f"{app_base_url.rstrip('/')}/login#reset-token={token}")


if __name__ == "__main__":
    main()
