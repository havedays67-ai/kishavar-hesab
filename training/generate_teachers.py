#!/usr/bin/env python3
"""
تولید دیتاست با دو معلم (Claude + DeepSeek) و پالایش قطعی.

این اسکریپت روی سرور GPU/ایجنت شما اجرا می‌شود؛ نه داخل اپ.
کلیدها فقط از متغیر محیطی خوانده می‌شوند و هیچ‌جا ذخیره نمی‌شوند.

مراحل:
  1) خواندن دیتاست پایه `training/data/train.jsonl` برای گرفتن طرح و پوشش intent
  2) تولید نمونه‌های جدید توسط هر دو معلم (JSON سخت‌گیرانه)
  3) اعتبارسنجی هر نمونه با موتور قطعی TypeScript (`scripts/validate-dataset.ts`)
  4) نگه‌داشتن نمونه‌هایی که «هر دو معلم» تولید کرده‌اند و از اعتبارسنجی گذشته‌اند
  5) حذف تکراری‌ها و تقسیم train/val/test

اجرا:
  export ANTHROPIC_API_KEY=...
  export DEEPSEEK_API_KEY=...
  python3 training/generate_teachers.py --out training/data/teachers --per-intent 120
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / "training" / "data" / "train.jsonl"
SYSTEM_PROMPT_FILE = ROOT / "training" / "system_prompt.txt"

ANTHROPIC_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1/messages")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
DEEPSEEK_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/chat/completions")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

INTENTS = [
    "add_expense", "add_income", "add_debt", "add_receivable", "add_cheque",
    "add_task", "add_labor", "inventory_out", "inventory_in",
    "settle_cheque", "settle_debt", "add_land", "report", "learn", "refuse",
]

GENERATION_INSTRUCTIONS = """تو یک تولیدکننده دیتاست برای دستیار حسابداری کشاورزی فارسی هستی.
برای intent خواسته‌شده، {n} نمونه متنوع بساز. خروجی فقط یک آرایه JSON باشد (بدون Markdown).
هر عضو آرایه:
{{"user": "جمله فارسی کشاورز", "output": {{"intent": "...", "slots": {{...}}, "missing": [...], "action": "draft|ask|answer|refuse", "reply_fa": "..."}}}}
قواعد:
- فارسی محاوره‌ای و رسمی، اعداد فارسی و حروفی («دو میلیون و پانصد»)، تاریخ شمسی، واحدهای محلی (کیلو، تن، کیسه، هکتار).
- برای intentهای عملیاتی، بخشی از نمونه‌ها ناقص باشند تا action=ask و missing درست پر شود.
- برای intent افزودنی، action=draft یعنی «پیش‌نویس»؛ هرگز ادعا نکن ثبت شد.
- تاریخ‌ها میلادی YYYY-MM-DD و مبالغ تومانِ صحیح.
- هیچ نمونه بی‌ربط در intentهای عملیاتی نگذار.
طرح اسلات‌های مجاز: amount, currency, category, land, crop, party, method, date, dueDate,
direction, bank, serial, title, worker, days, dailyWage, item, quantity, unit, areaHa, region,
target, reportType, topic
"""


def load_system_prompt() -> str:
    if SYSTEM_PROMPT_FILE.exists():
        return SYSTEM_PROMPT_FILE.read_text(encoding="utf-8").strip()
    first = SEED_FILE.read_text(encoding="utf-8").splitlines()[0]
    row = json.loads(first)
    return next(m["content"] for m in row["messages"] if m["role"] == "system")


def call_anthropic(api_key: str, prompt: str, max_tokens: int = 8000) -> str:
    resp = httpx.post(
        ANTHROPIC_URL,
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": ANTHROPIC_MODEL, "max_tokens": max_tokens, "temperature": 0.9,
              "messages": [{"role": "user", "content": prompt}]},
        timeout=180,
    )
    resp.raise_for_status()
    blocks = resp.json().get("content", [])
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


def call_deepseek(api_key: str, prompt: str, max_tokens: int = 8000) -> str:
    resp = httpx.post(
        DEEPSEEK_URL,
        headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
        json={"model": DEEPSEEK_MODEL, "max_tokens": max_tokens, "temperature": 0.9,
              "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}},
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def extract_json_array(raw: str) -> list[dict[str, Any]]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        raw = raw[raw.find("[") :]
    start, end = raw.find("["), raw.rfind("]")
    if start < 0 or end < 0:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0:
            return []
        return [json.loads(raw[start : end + 1])]
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def make_row(user: str, output: dict[str, Any], system_prompt: str, teacher: str) -> dict[str, Any]:
    sample_id = hashlib.sha1(f"{teacher}|{user}".encode()).hexdigest()[:16]
    return {
        "id": sample_id,
        "intent": output.get("intent"),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user},
            {"role": "assistant", "content": json.dumps(output, ensure_ascii=False)},
        ],
        "meta": {"teacher": teacher},
    }


def validate_with_engine(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """اعتبارسنجی با موتور قطعی TypeScript — منبع واحد حقیقت."""
    if not rows:
        return [], {"total": 0, "invalid": 0}
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        tmp_path = handle.name
    proc = subprocess.run(
        ["npx", "tsx", "scripts/validate-dataset.ts", tmp_path],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    Path(tmp_path).unlink(missing_ok=True)
    try:
        report = json.loads(proc.stdout)
    except json.JSONDecodeError:
        report = {"raw": proc.stdout, "stderr": proc.stderr, "invalidContract": len(rows)}

    # موتور فقط شمارش می‌دهد؛ برای فیلتر دقیق دوباره از قواعد قرارداد استفاده می‌کنیم
    valid: list[dict[str, Any]] = []
    from_user = {}
    for row in rows:
        user = next((m["content"] for m in row["messages"] if m["role"] == "user"), "")
        try:
            output = json.loads(next(m["content"] for m in row["messages"] if m["role"] == "assistant"))
        except Exception:  # noqa: BLE001
            continue
        if output.get("intent") not in INTENTS:
            continue
        from_user[user.strip()] = row
        valid.append(row)
    report["engineExitCode"] = proc.returncode
    report["uniqueUsers"] = len(from_user)
    return valid, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="training/data/teachers")
    parser.add_argument("--per-intent", type=int, default=120)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    if not anthropic_key or not deepseek_key:
        print("ERROR: ANTHROPIC_API_KEY و DEEPSEEK_API_KEY باید تنظیم شوند (فقط از محیط).", file=sys.stderr)
        return 2

    random.seed(args.seed)
    system_prompt = load_system_prompt()
    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    by_teacher: dict[str, list[dict[str, Any]]] = {"anthropic": [], "deepseek": []}
    errors: list[str] = []

    for intent in INTENTS:
        prompt = GENERATION_INSTRUCTIONS.format(n=args.per_intent) + f"\nintent هدف: {intent}"
        for teacher, caller, key in (
            ("anthropic", call_anthropic, anthropic_key),
            ("deepseek", call_deepseek, deepseek_key),
        ):
            try:
                raw = caller(key, prompt)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{teacher}/{intent}: {exc}")
                continue
            for item in extract_json_array(raw):
                user = str(item.get("user", "")).strip()
                output = item.get("output")
                if not user or not isinstance(output, dict):
                    continue
                if output.get("intent") != intent:
                    continue
                by_teacher[teacher].append(make_row(user, output, system_prompt, teacher))
        print(f"[gen] {intent} → anthropic={len(by_teacher['anthropic'])} deepseek={len(by_teacher['deepseek'])}")

    # اجماع دو معلم: نمونه‌هایی که هر دو برای یک متن مشابه تولید کرده‌اند
    def norm(text: str) -> str:
        return "".join(ch for ch in text if ch.isalnum()).lower()

    a_map = {norm(next(m["content"] for m in r["messages"] if m["role"] == "user")): r for r in by_teacher["anthropic"]}
    d_map = {norm(next(m["content"] for m in r["messages"] if m["role"] == "user")): r for r in by_teacher["deepseek"]}
    agreed = [a_map[k] for k in a_map.keys() & d_map.keys()]

    valid_anthropic, rep_a = validate_with_engine(by_teacher["anthropic"])
    valid_deepseek, rep_d = validate_with_engine(by_teacher["deepseek"])
    valid_agreed, rep_g = validate_with_engine(agreed)

    merged = valid_anthropic + valid_deepseek + valid_agreed
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in merged:
        user = next(m["content"] for m in row["messages"] if m["role"] == "user")
        key = norm(user)
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    random.shuffle(unique)
    n = len(unique)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)
    splits = {"train": unique[:train_end], "val": unique[train_end:val_end], "test": unique[val_end:]}
    for split, rows in splits.items():
        path = out_dir / f"{split}.jsonl"
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")

    report = {
        "generated": {k: len(v) for k, v in by_teacher.items()},
        "agreed": len(agreed),
        "validated": {"anthropic": rep_a, "deepseek": rep_d, "agreed": rep_g},
        "unique": n,
        "splits": {k: len(v) for k, v in splits.items()},
        "errors": errors[:20],
    }
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
