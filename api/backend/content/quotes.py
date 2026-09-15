from __future__ import annotations

import json
import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import CompanionQuotePool


def validate_quotes(value: object) -> dict[str, list[str | dict[str, str | None]]]:
    if not isinstance(value, dict):
        raise ValueError("Quotes must be an action-to-quotes object.")
    for action, quotes in value.items():
        if not isinstance(action, str) or len(action) > 255 or not re.fullmatch(
            r"[a-z][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*){0,2}", action
        ):
            raise ValueError("Quote action keys must be lowercase identifiers separated by colons.")
        if not isinstance(quotes, list):
            raise ValueError("Each quote pool must be an array.")
        for quote in quotes:
            if isinstance(quote, str) and quote.strip():
                continue
            if not isinstance(quote, dict) or set(quote) - {"quote", "inGameQuote", "timestamp", "videoSource"}:
                raise ValueError("Quotes must be text or quote records.")
            if not isinstance(quote.get("quote"), str) or any(
                field is not None and not isinstance(field, str) for field in quote.values()
            ):
                raise ValueError("Quote text is required; source fields must be text or null.")
            if not quote["quote"].strip() and any(field and field.strip() for field in quote.values()):
                raise ValueError("A populated quote record must include its verbatim quote.")
    return value


def read_quotes(session: Session) -> dict[str, list[str]]:
    return {
        row.action: [text for quote in json.loads(row.quotes_json) if (text := display_quote(quote))]
        for row in session.scalars(select(CompanionQuotePool).order_by(CompanionQuotePool.action))
    }


def display_quote(quote: str | dict[str, str | None]) -> str:
    if isinstance(quote, str):
        return quote
    edited = quote.get("inGameQuote")
    return edited if edited and edited.strip() else (quote["quote"] if quote["quote"].strip() else "")


def replace_quotes(session: Session, value: object) -> None:
    pools = validate_quotes(value)
    with session.begin():
        session.execute(delete(CompanionQuotePool))
        session.add_all(
            CompanionQuotePool(action=action, quotes_json=json.dumps(quotes, ensure_ascii=False))
            for action, quotes in pools.items()
        )
