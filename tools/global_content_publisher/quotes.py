from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from backend.content.quotes import replace_quotes
from backend.database import get_session_factory


def unique_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Quote JSON contains a duplicate action key.")
        result[key] = value
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("quotes_file", type=Path)
    args = parser.parse_args()
    try:
        value = json.loads(args.quotes_file.read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
        with get_session_factory()() as session:
            replace_quotes(session, value)
    except (OSError, ValueError, SQLAlchemyError) as error:
        parser.exit(1, f"Quote import failed ({type(error).__name__}); published quotes were retained.\n")
    print(f"Published {len(value)} companion quote pools.")


if __name__ == "__main__":
    main()
