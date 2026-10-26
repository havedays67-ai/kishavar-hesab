#!/usr/bin/env python3
"""
آموزش QLoRA + ارزیابی سخت‌گیرانه روی تست مستقل.

معیار قبولی (روی hard-test، نه test قالب‌محور):
  JSON معتبر = ۱۰۰٪ ، intent ≥ ۹۸٪ ، فیلدها ≥ ۹۸٪

نمونه:
  python3 training/train_qlora.py \
      --model Qwen/Qwen3.5-2B \
      --data training/data \
      --out out/qwen35-2b \
      --epochs 3

فقط ارزیابی یک آداپتر موجود:
  python3 training/train_qlora.py --model Qwen/Qwen3.5-2B --out out/qwen35-2b \
      --eval-only --adapter out/qwen35-2b

هیچ عددی از مدل به‌عنوان حقیقت پذیرفته نمی‌شود؛ این اسکریپت فقط NLU را می‌سنجد.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
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


def expected_of(row: dict[str, Any]) -> dict[str, Any]:
    return json.loads(next(m["content"] for m in row["messages"] if m["role"] == "assistant"))


def score_predictions(rows: list[dict[str, Any]], predictions: list[str]) -> dict[str, Any]:
    intent_ok = 0
    field_ok = 0
    field_total = 0
    extra_slots = 0
    action_ok = 0
    json_ok = 0
    exact = 0
    errors: list[dict[str, Any]] = []
    per_intent: dict[str, dict[str, int]] = defaultdict(lambda: {"n": 0, "intent_ok": 0, "field_ok": 0, "field_total": 0})

    for row, raw in zip(rows, predictions):
        expected = expected_of(row)
        intent = str(expected.get("intent"))
        stat = per_intent[intent]
        stat["n"] += 1

        predicted = extract_json(raw)
        if predicted is None:
            errors.append({"id": row.get("id"), "intent": intent, "reason": "invalid-json", "raw": raw[:300]})
            continue
        json_ok += 1
        if predicted.get("intent") == expected.get("intent"):
            intent_ok += 1
            stat["intent_ok"] += 1
        else:
            errors.append({"id": row.get("id"), "reason": "intent", "expected": expected.get("intent"), "got": predicted.get("intent")})
        if predicted.get("action") == expected.get("action"):
            action_ok += 1
        else:
            errors.append({"id": row.get("id"), "reason": "action", "expected": expected.get("action"), "got": predicted.get("action")})

        exp_slots = expected.get("slots", {}) or {}
        got_slots = predicted.get("slots", {}) or {}
        for key, value in exp_slots.items():
            field_total += 1
            stat["field_total"] += 1
            if str(got_slots.get(key, "")).strip() == str(value).strip():
                field_ok += 1
                stat["field_ok"] += 1
            elif len(errors) < 200:
                errors.append({"id": row.get("id"), "reason": f"field:{key}", "expected": value, "got": got_slots.get(key)})
        for key in set(got_slots) - set(exp_slots):
            extra_slots += 1
            field_total += 1
            stat["field_total"] += 1
            if len(errors) < 200:
                errors.append({"id": row.get("id"), "reason": f"extra-slot:{key}", "got": got_slots.get(key)})

        if (
            predicted.get("intent") == expected.get("intent")
            and (predicted.get("slots") or {}) == exp_slots
            and predicted.get("action") == expected.get("action")
        ):
            exact += 1

    total = max(1, len(rows))
    report = {
        "n": len(rows),
        "json_validity": json_ok / total,
        "intent_accuracy": intent_ok / total,
        "field_accuracy": (field_ok / field_total) if field_total else 1.0,
        "action_accuracy": action_ok / total,
        "exact_match": exact / total,
        "extra_slots": extra_slots,
        "thresholds": THRESHOLDS,
        "per_intent": {
            intent: {
                "n": stat["n"],
                "intent_recall": (stat["intent_ok"] / stat["n"]) if stat["n"] else 0.0,
                "field_accuracy": (stat["field_ok"] / stat["field_total"]) if stat["field_total"] else 1.0,
            }
            for intent, stat in sorted(per_intent.items())
        },
        "errors": errors[:80],
    }
    report["passed"] = (
        report["json_validity"] >= THRESHOLDS["json"]
        and report["intent_accuracy"] >= THRESHOLDS["intent"]
        and report["field_accuracy"] >= THRESHOLDS["fields"]
    )
    return report


def apply_template(tokenizer: Any, messages: list[dict[str, str]], add_generation_prompt: bool) -> str:
    """سازگار با مدل‌هایی که enable_thinking دارند و مدل‌هایی که ندارند."""
    base: dict[str, Any] = {"tokenize": False, "add_generation_prompt": add_generation_prompt}
    for extra in ({"enable_thinking": False}, {}):
        try:
            return tokenizer.apply_chat_template(messages, **base, **extra)
        except Exception:
            continue
    return tokenizer.apply_chat_template(messages, **base)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--data", default="training/data")
    parser.add_argument("--out", default="out/kishavar-lora")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=16)
    parser.add_argument("--max-len", type=int, default=1024)
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--eval-only", action="store_true")
    parser.add_argument("--adapter", default=None)
    parser.add_argument("--hard-test", default=None)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments

    data_dir = Path(args.data)
    train_rows = load_jsonl(data_dir / "train.jsonl")
    val_rows = load_jsonl(data_dir / "val.jsonl")
    hard_path = Path(args.hard_test) if args.hard_test else data_dir / "hard-test.jsonl"
    hard_rows = load_jsonl(hard_path)
    test_rows = load_jsonl(data_dir / "test.jsonl")
    if args.limit:
        train_rows = train_rows[: args.limit]
        hard_rows = hard_rows[: args.limit]

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def encode(row: dict[str, Any]) -> dict[str, Any]:
        messages = row["messages"]
        answer = next(m["content"] for m in messages if m["role"] == "assistant")
        prompt_text = apply_template(tokenizer, [m for m in messages if m["role"] != "assistant"], add_generation_prompt=True)
        answer_text = answer + (tokenizer.eos_token or "")
        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        answer_ids = tokenizer(answer_text, add_special_tokens=False)["input_ids"]
        input_ids = (prompt_ids + answer_ids)[: args.max_len]
        labels = ([-100] * len(prompt_ids) + answer_ids)[: args.max_len]
        return {"input_ids": input_ids, "labels": labels, "attention_mask": [1] * len(input_ids)}

    train_ds = Dataset.from_list([encode(row) for row in train_rows])
    val_ds = Dataset.from_list([encode(row) for row in val_rows])

    class Collator:
        def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
            max_len = max(len(f["input_ids"]) for f in features)
            input_ids, labels, attention = [], [], []
            for f in features:
                pad = max_len - len(f["input_ids"])
                input_ids.append(f["input_ids"] + [tokenizer.pad_token_id] * pad)
                labels.append(f["labels"] + [-100] * pad)
                attention.append(f["attention_mask"] + [0] * pad)
            return {
                "input_ids": torch.tensor(input_ids, dtype=torch.long),
                "labels": torch.tensor(labels, dtype=torch.long),
                "attention_mask": torch.tensor(attention, dtype=torch.long),
            }

    bf16 = torch.cuda.is_bf16_supported() if torch.cuda.is_available() else False
    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if bf16 else torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    # روی T4 x2، device_map="auto" مدل ۴بیتی را بین دو GPU پخش می‌کند و
    # Trainer نمی‌تواند روی دستگاه متفاوت آموزش دهد. همه‌چیز را روی GPU 0 قفل می‌کنیم.
    device_map = {"": torch.cuda.current_device()} if torch.cuda.is_available() else "cpu"
    base = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=bnb,
        device_map=device_map,
        trust_remote_code=True,
        # روی T4 با fp16، مسیر SDPA گاهی illegal memory access می‌دهد؛ eager پایدارتر است.
        attn_implementation="eager",
    )
    base = prepare_model_for_kbit_training(base)

    if args.adapter:
        model = PeftModel.from_pretrained(base, args.adapter, is_trainable=not args.eval_only)
    else:
        module_names = {name.split(".")[-1] for name, _ in base.named_modules()}
        candidates = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
        targets: list[str] | str = [name for name in candidates if name in module_names] or "all-linear"
        model = get_peft_model(
            base,
            LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM", target_modules=targets),
        )

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
            save_strategy="no",
            eval_strategy="no",
            bf16=bf16,
            fp16=not bf16,
            optim="paged_adamw_8bit",
            gradient_checkpointing=True,
            gradient_checkpointing_kwargs={"use_reentrant": False},
            max_grad_norm=1.0,
            report_to=[],
            remove_unused_columns=False,
        )
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_ds,
            eval_dataset=val_ds,
            data_collator=Collator(),
        )
        trainer.train()
        model.save_pretrained(args.out)
        tokenizer.save_pretrained(args.out)

    model.eval()

    def predict(rows: list[dict[str, Any]]) -> list[str]:
        outputs: list[str] = []
        for row in rows:
            messages = [m for m in row["messages"] if m["role"] != "assistant"]
            prompt = apply_template(tokenizer, messages, add_generation_prompt=True)
            inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(model.device)
            with torch.no_grad():
                generated = model.generate(
                    **inputs,
                    max_new_tokens=args.max_new_tokens,
                    do_sample=False,
                    pad_token_id=tokenizer.pad_token_id,
                )
            outputs.append(tokenizer.decode(generated[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True))
        return outputs

    hard_report = score_predictions(hard_rows, predict(hard_rows))
    test_report = score_predictions(test_rows, predict(test_rows))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {
        "model": args.model,
        "adapter": args.adapter or args.out,
        "hard_test": str(hard_path),
        "hard": hard_report,
        "template_test": {k: test_report[k] for k in ("n", "json_validity", "intent_accuracy", "field_accuracy", "passed")},
        "passed": hard_report["passed"],
        "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
    }
    (out / "eval_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "model": args.model,
                "n_hard": hard_report["n"],
                "json_validity": hard_report["json_validity"],
                "intent_accuracy": hard_report["intent_accuracy"],
                "field_accuracy": hard_report["field_accuracy"],
                "action_accuracy": hard_report["action_accuracy"],
                "exact_match": hard_report["exact_match"],
                "passed": hard_report["passed"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if hard_report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
