#!/usr/bin/env python3
"""Repair UTF-8 mojibake in HTML/JS (UTF-8 mis-decoded as Windows-1251)."""
from __future__ import annotations

import pathlib
import sys

try:
    import ftfy
except ImportError:
    print("Install ftfy: pip install ftfy", file=sys.stderr)
    raise

# Typical broken UTF-8 fragments (after incomplete ftfy or mixed encodings).
KNOWN_REPLACEMENTS = (
    ("\u0432'\u0405", "\u20bd"),  # в'Ѕ -> ₽
    ("\u0432\u201a\u0405", "\u20bd"),  # в‚Ѕ -> ₽
    ("\u0432\u20ac'", "\u2212"),  # в€' -> −
    ("\u0432\u0402\u201c", "\u2014"),  # вЂ" -> —
    ("\u0432\u0402\u00a6", "\u2026"),  # вЂ¦ -> …
    ("\u0432\u2030\u0406", "\u2265"),  # в‰Ґ -> ≥
    ("\u0413\u2014", "\u00d7"),  # Г— -> ×
    ("\u0412\u00b7", "\u00b7"),  # В· -> · (middle dot misread as cp1251)
)

MOJIBAKE_MARKERS = (
    "\u0420\u045f",  # Рџ
    "\u0420\u0455",  # Рѕ
    "\u0432\u0402",  # вЂ
    "\u0420\u0454",  # Рј
    "\u0420\u0458",
    "\u0420\u0451",  # Рё
    "\u0432'\u0405",
    "\u0432\u201a\u0405",
    "\u0432\u20ac'",
    "\u0432\u2030",
    "\u0413\u2014",
    "\u0412\u00b7",
)


def try_decode_line(line: str) -> str:
    for enc in ("cp1251", "cp1252", "latin-1"):
        try:
            return line.encode(enc).decode("utf-8")
        except UnicodeError:
            continue
    return line


def apply_known_replacements(text: str) -> str:
    for bad, good in KNOWN_REPLACEMENTS:
        text = text.replace(bad, good)
    return text


def needs_fix(text: str) -> bool:
    return any(m in text for m in MOJIBAKE_MARKERS)


def fix_text(text: str) -> str:
    text = ftfy.fix_text(text)
    out: list[str] = []
    for line in text.split("\n"):
        if any(m in line for m in MOJIBAKE_MARKERS):
            line = try_decode_line(line)
        line = apply_known_replacements(line)
        out.append(line)
    return apply_known_replacements("\n".join(out))


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[1]
    patterns = ("*.html", "*.js")
    changed = 0
    for pattern in patterns:
        for path in sorted(root.rglob(pattern)):
            if path.name.startswith("_test") or "node_modules" in path.parts:
                continue
            raw = path.read_text(encoding="utf-8-sig")
            if not needs_fix(raw):
                continue
            fixed = fix_text(raw)
            if fixed == raw:
                print(f"unchanged (still suspicious): {path.relative_to(root)}")
                continue
            path.write_text(fixed, encoding="utf-8", newline="\n")
            bad = sum(fixed.count(m) for m in MOJIBAKE_MARKERS)
            print(f"fixed: {path.relative_to(root)} (markers left: {bad})")
            changed += 1
    if not changed:
        print("No files needed fixing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
