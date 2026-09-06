"""Publish the JSON-authored runtime bundle with the configured SQL session."""

from __future__ import annotations

import argparse
from pathlib import Path

from backend.database import get_session_factory
from backend.content.service import current_content

from .bundle import load_bundle
from .publisher import publish


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository-root", type=Path, default=Path.cwd())
    parser.add_argument("--if-empty", action="store_true", help="Bootstrap without replacing published content.")
    args = parser.parse_args()
    bundle = load_bundle(args.repository_root)
    with get_session_factory()() as session:
        if args.if_empty:
            current = current_content(session)
            if current is not None:
                print(f"Runtime content is already published: {current.version}")
                return
            session.rollback()
        print(publish(session, bundle))


if __name__ == "__main__":
    main()
