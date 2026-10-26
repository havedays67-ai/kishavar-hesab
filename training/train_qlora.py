#!/usr/bin/env python3
"""
آموزش QLoRA روی سرور GPU شما + ارزیابی با آستانه‌های پذیرش.

معیار قبولی: دقت intent و فیلدها روی test ≥ ۹۸٪ و نرخ JSON معتبر = ۱۰۰٪
(چون خروجی نهایی با Constrained Decoding محدود می‌شود، آستانه JSON در ارزیابی
هم روی «خروجی خام مدل» سنجیده می‌شود؛ اگر پایین بود، دیتای هدفمند اضافه کنید.)

نمونه اجرا:
  python3 training/train_qlora.py \
      --model Qwen/Qwen3-1.7B \
      --data training/data/teachers \
      --out out/qwen3-1.7b-kishavar \
      --epochs 3

پیش‌نیاز: pip install "transformers>=4.45" "peft>=0.13" "bitsandbytes>=0.44" datasets accelerate torch
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

THRESHOLDS = {"intent": 0.98, "fields": 0.98, "json": 1.00}


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def score_predictions(rows: list[dict[str, Any]], predictions: list[str]) -> dict[str, Any]:
    intent_ok = 0
    field_ok = 0
    field_total = 0
    json_ok = 0
    errors: list[dict[str, Any]] = []

    for row, raw in zip(rows, predictions):
        expected = json.loads(next(m["content"] for m in row["messages"] if m["role"] == "assistant"))
        predicted = extract_json(raw)
        if predicted is None:
            errors.append({"id": row.get("id"), "reason": "invalid-json", "raw": raw[:200]})
            continue
        json_ok += 1
        if predicted.get("intent") == expected.get("intent"):
            intent_ok += 1
        else:
            errors.append({"id": row.get("id"), "reason": "intent", "expected": expected.get("intent"), "got": predicted.get("intent")})

        exp_slots = expected.get("slots", {}) or {}
        got_slots = predicted.get("slots", {}) or {}
        for key, value in exp_slots.items():
            field_total += 1
            if str(got_slots.get(key, "")).strip() == str(value).strip():
                field_ok += 1
            elif len(errors) < 60:
                errors.append({"id": row.get("id"), "reason": f"field:{key}", "expected": value, "got": got_slots.get(key)})
        # هالوسینیشن: اسلات اضافه‌ای که در انتظار نبوده
        for key in set(got_slots) - set(exp_slots):
            field_total += 1
            errors.append({"id": row.get("id"), "reason": f"extra-slot:{key}", "got": got_slots.get(key)})

    total = max(1, len(rows))
    report = {
        "n": len(rows),
        "json_validity": json_ok / total,
        "intent_accuracy": intent_ok / total,
        "field_accuracy": (field_ok / field_total) if field_total else 1.0,
        "thresholds": THRESHOLDS,
        "errors": errors[:60],
    }
    report["passed"] = (
        report["json_validity"] >= THRESHOLDS["json"]
        and report["intent_accuracy"] >= THRESHOLDS["intent"]
        and report["field_accuracy"] >= THRESHOLDS["fields"]
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="Qwen/Qwen3-1.7B")
    parser.add_argument("--data", default="training/data")
    parser.add_argument("--out", default="out/kishavar-lora")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--max-len", type=int, default=1024)
    parser.add_argument("--eval-only", action="store_true")
    parser.add_argument("--adapter", default=None)
    args = parser.parse_args()

    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )

    data_dir = Path(args.data)
    train_rows = load_jsonl(data_dir / "train.jsonl")
    val_rows = load_jsonl(data_dir / "val.jsonl")
    test_rows = load_jsonl(data_dir / "test.jsonl")

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def to_text(row: dict[str, Any]) -> str:
        messages = row["messages"]
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)

    def encode(batch: dict[str, list[Any]]) -> dict[str, Any]:
        texts = [to_text({"messages": [{"role": "system", "content": s}, {"role": "user", "content": u}, {"role": "assistant", "content": a}]})
                 for s, u, a in zip(batch["system"], batch["user"], batch["assistant"])]
        encoded = tokenizer(texts, truncation=True, max_length=args.max_len, padding="max_length")
        encoded["labels"] = [ids.copy() for ids in encoded["input_ids"]]
        return encoded

    def build(rows: list[dict[str, Any]]) -> Dataset:
        return Dataset.from_dict({
            "system": [next(m["content"] for m in r["messages"] if m["role"] == "system") for r in rows],
            "user": [next(m["content"] for m in r["messages"] if m["role"] == "user") for r in rows],
            "assistant": [next(m["content"] for m in r["messages"] if m["role"] == "assistant") for r in rows],
        })

    train_ds = build(train_rows).map(encode, batched=True, remove_columns=["system", "user", "assistant"])
    val_ds = build(val_rows).map(encode, batched=True, remove_columns=["system", "user", "assistant"])

    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    base = AutoModelForCausalLM.from_pretrained(args.model, quantization_config=bnb, device_map="auto", trust_remote_code=True)
    base = prepare_model_for_kbit_training(base)

    if args.adapter:
        model = PeftModel.from_pretrained(base, args.adapter, is_trainable=not args.eval_only)
    else:
        lora = LoraConfig(
            r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )
        model = get_peft_model(base, lora)

    if not args.eval_only:
        training_args = TrainingArguments(
            output_dir=args.out,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch,
            gradient_accumulation_steps=args.grad_accum,
            learning_rate=args.lr,
            lr_scheduler_type="cosine",
            warmup_ratio=0.03,
            logging_steps=10,
            save_strategy="epoch",
            eval_strategy="epoch",
            bf16=torch.cuda.is_bf16_supported(),
            gradient_checkpointing=True,
            report_to=[],
        )
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_ds,
            eval_dataset=val_ds,
            data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
        )
        trainer.train()
        trainer.save_model(args.out)
        tokenizer.save_pretrained(args.out)

    # ارزیابی روی test با تولید آزاد
    model.eval()
    predictions: list[str] = []
    for row in test_rows:
        messages = [m for m in row["messages"] if m["role"] != "assistant"]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            output = model.generate(**inputs, max_new_tokens=320, do_sample=False, temperature=0.0)
        predictions.append(tokenizer.decode(output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True))

    report = score_predictions(test_rows, predictions)
    Path(args.out).mkdir(parents=True, exist_ok=True)
    (Path(args.out) / "eval_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("n", "json_validity", "intent_accuracy", "field_accuracy", "passed")}, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
