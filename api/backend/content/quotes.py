from __future__ import annotations

import json
import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import CompanionQuotePool


def validate_quotes(value: object) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        raise ValueError("Quotes must be an action-to-quotes object.")
    for action, quotes in value.items():
        if not isinstance(action, str) or len(action) > 255 or not re.fullmatch(
            r"[a-z][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*){0,2}", action
        ):
            raise ValueError("Quote action keys must be lowercase identifiers separated by colons.")
        if not isinstance(quotes, list) or any(
            not isinstance(quote, str) or not quote.strip() for quote in quotes
        ):
            raise ValueError("Each quote pool must be an array of nonblank strings.")
    return value


def read_quotes(session: Session) -> dict[str, list[str]]:
    return {
        row.action: json.loads(row.quotes_json)
        for row in session.scalars(select(CompanionQuotePool).order_by(CompanionQuotePool.action))
    }


def replace_quotes(session: Session, value: object) -> None:
    pools = validate_quotes(value)
    with session.begin():
        session.execute(delete(CompanionQuotePool))
        session.add_all(
            CompanionQuotePool(action=action, quotes_json=json.dumps(quotes, ensure_ascii=False))
            for action, quotes in pools.items()
        )
