#!/usr/bin/env python3
"""Parse three 八股文 MD files into JSON for Supabase import."""
import json
import re
import sys
from pathlib import Path

DOCS_DIR = Path("/Users/xkkk/Documents/FIRST CC")
OUTPUT = DOCS_DIR / "scripts" / "questions.json"

# Map filenames to source names
SOURCES = {
    "八股（上）（C、C++、STL与容器、操作系统）.md": "八股文（上）",
    "八股（中）（计算机网络、STM32、FreeRTOS、通讯协议).md": "八股文（中）",
    "八股（下）（Linux应用、驱动、Bootloader、Rootfs）.md": "八股文（下）",
}

def parse_doc(path, source_name):
    questions = []
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    current_topic = ""
    current_q = None
    in_code = False
    code_blocks = []
    answer_lines = []
    display_order = 0

    for line in lines:
        stripped = line.strip()
        # Skip title line
        if stripped.startswith("<title>"):
            continue
        # Code block toggle
        if stripped.startswith("```"):
            in_code = not in_code
            if in_code:
                code_blocks.append("")
            continue
        if in_code:
            code_blocks[-1] += line
            continue

        # Skip images and separators
        if "![](" in stripped or stripped == "---":
            continue

        # Topic header (#)
        if stripped.startswith("# ") and "持续更新" not in stripped:
            current_topic = stripped.lstrip("# ").strip()
            continue

        # Question header (##)
        if stripped.startswith("## "):
            # Flush previous question
            if current_q:
                current_q["answer"] = "".join(answer_lines).strip()
                current_q["code_blocks"] = [b for b in code_blocks if b.strip()]
                questions.append(current_q)
            # Start new question
            answer_lines = []
            code_blocks = []
            question_text = stripped.lstrip("## ").strip()
            # Remove bold markers from question text
            question_text = re.sub(r"\*\*(.*?)\*\*", r"\1", question_text)
            current_q = {
                "source": source_name,
                "topic": current_topic,
                "subtopic": question_text,
                "display_order": display_order,
                "question": question_text,
                "answer": "",
                "code_blocks": [],
                "difficulty": 3,
                "tags": [],
                "choices": None,
                "correct_idx": None,
            }
            display_order += 1
            continue

        # Answer content
        if current_q:
            answer_lines.append(line)

    # Flush last question
    if current_q:
        current_q["answer"] = "".join(answer_lines).strip()
        current_q["code_blocks"] = [b for b in code_blocks if b.strip()]
        questions.append(current_q)

    return questions

all_questions = []
for filename, source_name in SOURCES.items():
    path = DOCS_DIR / filename
    if path.exists():
        qs = parse_doc(path, source_name)
        all_questions.extend(qs)
        print(f"{filename}: {len(qs)} questions parsed")
    else:
        print(f"WARNING: {filename} not found", file=sys.stderr)

with open(OUTPUT, "w") as f:
    json.dump(all_questions, f, ensure_ascii=False, indent=2)

print(f"\nTotal: {len(all_questions)} questions → {OUTPUT}")
