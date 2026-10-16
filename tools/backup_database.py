from __future__ import annotations

import argparse
import sqlite3
from contextlib import closing
from pathlib import Path


def backup(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Database does not exist: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() == destination.resolve():
        raise ValueError("Backup destination must differ from the source database.")
    with closing(sqlite3.connect(source)) as original, closing(sqlite3.connect(destination)) as copy:
        original.backup(copy)
        integrity = copy.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise sqlite3.DatabaseError(f"Backup integrity check failed: {integrity}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create and integrity-check a SQLite ClearBeacon backup.")
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    backup(args.source, args.destination)
    print(f"Verified database backup written to {args.destination}")


if __name__ == "__main__":
    main()
