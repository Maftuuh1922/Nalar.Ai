"""Lacak ketidakseimbangan tag JSX di file editor Co-Writer."""
import re
import sys

path = r"C:\Users\Administrator\Documents\project ta\Nalar.ai_fe\app\(workspace)\co-writer\[docId]\page.tsx"
with open(path, encoding="utf-8") as f:
    text = f.read()

# Tokene: hapus string literal dan template (paling kasar tapi cukup)
# Ganti string dulu dengan placeholder
lines = text.split("\n")

OPEN_RE = re.compile(r"<(\w+)[\s>]")
CLOSE_RE = re.compile(r"</(\w+)>")
SELF_RE = re.compile(r"<(\w+)[^>]*/>")

stack: list[tuple[int, str]] = []
for i, line in enumerate(lines, 1):
    # Hapus bagian string '...' dan "..." dan template `...` per baris
    # (pendekatan sederhana: hapus yang di dalam kutip)
    clean = line
    # hapus string ganda
    clean = re.sub(r'"[^"]*"', '""', clean)
    clean = re.sub(r"'[^']*'", "''", clean)
    # hapus self-closing
    for m in SELF_RE.finditer(clean):
        clean = clean.replace(m.group(0), "")
    # hapus komentar // dan /* */
    clean = re.sub(r"//.*", "", clean)
    opens = OPEN_RE.findall(clean)
    closes = CLOSE_RE.findall(clean)
    for tag in opens:
        stack.append((i, tag))
    for tag in closes:
        if not stack:
            print(f"LINE {i}: closing </{tag}> without open! | {line.strip()[:90]}")
            continue
        top_line, top_tag = stack.pop()
        if top_tag != tag:
            print(f"LINE {i}: mismatch </{tag}> closing <{top_tag}> opened at line {top_line} | {line.strip()[:90]}")

print(f"\nUnclosed tags ({len(stack)}):")
for line_no, tag in stack:
    print(f"  line {line_no}: <{tag}>")
