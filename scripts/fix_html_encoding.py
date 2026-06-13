#!/usr/bin/env python3
"""Repair UTF-8 mojibake in HTML files (UTF-8 mis-decoded as Windows-1251)."""
from __future__ import annotations

import pathlib
import sys

try:
    import ftfy
except ImportError:
    print("Install ftfy: pip install ftfy", file=sys.stderr)
    raise

MOJIBAKE_MARKERS = (
    "\u0420\u045f",  # Рџ
    "\u0420\u0455",  # Рѕ
    "\u0432\u0402",  # вЂ
    "\u0420\u0454",  # Рј start of мин
    "\u0420\u0458",  # Рј (alternative)
    "\u0420\u0451",  # Рё
)


def try_decode_line(line: str) -> str:
    for enc in ("cp1251", "cp1252", "latin-1"):
        try:
            return line.encode(enc).decode("utf-8")
        except UnicodeError:
            continue
    return line


def fix_text(text: str) -> str:
    text = ftfy.fix_text(text)
    out: list[str] = []
    for line in text.split("\n"):
        if any(m in line for m in MOJIBAKE_MARKERS):
            line = try_decode_line(line)
        out.append(line)
    return "\n".join(out)


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[1]
    for path in sorted(root.rglob("*.html")):
        if path.name.startswith("_test"):
            continue
        raw = path.read_text(encoding="utf-8-sig")
        if not any(m in raw for m in MOJIBAKE_MARKERS):
            print(f"skip ok: {path.relative_to(root)}")
            continue
        fixed = fix_text(raw)
        path.write_text(fixed, encoding="utf-8", newline="\n")
        bad = sum(fixed.count(m) for m in MOJIBAKE_MARKERS)
        print(f"fixed: {path.relative_to(root)} (markers left: {bad})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
