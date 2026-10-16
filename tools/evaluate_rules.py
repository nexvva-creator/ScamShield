from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scamshield.analysis import analyze_message, analyze_url


POSITIVE_LABELS = {"high_risk", "known_malicious"}


def evaluate(dataset: Path) -> dict[str, object]:
    groups: dict[str, dict[str, int]] = defaultdict(
        lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0},
    )
    with dataset.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"type", "input", "locale", "expected"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("CSV must include columns: type,input,locale,expected")
        count = 0
        for row_number, row in enumerate(reader, 2):
            sample_type = row["type"].strip().lower()
            expected = row["expected"].strip().lower()
            if sample_type not in {"url", "message"} or expected not in {"scam", "benign"}:
                raise ValueError(f"Row {row_number}: type must be url/message and expected scam/benign.")
            result = analyze_url(row["input"], row["locale"]) if sample_type == "url" else analyze_message(row["input"], row["locale"])
            actual_positive = result["risk_label"] in POSITIVE_LABELS
            expected_positive = expected == "scam"
            key = f"{sample_type}:{row['locale'].strip().lower()}"
            metric = groups[key]
            metric["tp" if expected_positive and actual_positive else
                   "fn" if expected_positive else
                   "fp" if actual_positive else "tn"] += 1
            count += 1
    if not count:
        raise ValueError("CSV contains no samples.")
    output: dict[str, object] = {"threshold": "high_risk or known_malicious; caution is not a positive prediction",
                                 "sample_count": count, "groups": {}}
    for key, metric in groups.items():
        positives = metric["tp"] + metric["fn"]
        predicted = metric["tp"] + metric["fp"]
        metric["precision"] = metric["tp"] / predicted if predicted else 0.0
        metric["recall"] = metric["tp"] / positives if positives else 0.0
        metric["false_positive_rate"] = metric["fp"] / (metric["fp"] + metric["tn"]) if metric["fp"] + metric["tn"] else 0.0
        output["groups"][key] = metric
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure ClearBeacon rule errors on a labeled CSV.")
    parser.add_argument("dataset", type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(evaluate(args.dataset), indent=2))
    except (OSError, UnicodeError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
