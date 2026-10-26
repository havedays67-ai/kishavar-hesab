#!/usr/bin/env bash
# ادغام LoRA + کوانتیزه + ساخت فایل موبایل
# اجرا پس از train_qlora.py روی سرور GPU
set -euo pipefail
MODEL="${1:-Qwen/Qwen3-1.7B}"
ADAPTER="${2:-out/kishavar-lora}"
OUT="${3:-out/kishavar-merged}"

echo "▶ ادغام LoRA در مدل پایه (bf16)…"
python3 - <<'PY'
import os
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
base_id = os.environ.get("BASE_MODEL", "Qwen/Qwen3-1.7B")
adapter = os.environ.get("ADAPTER", "out/kishavar-lora")
out = os.environ.get("OUT", "out/kishavar-merged")
model = AutoModelForCausalLM.from_pretrained(adapter, device_map="cpu", torch_dtype="auto")
tokenizer = AutoTokenizer.from_pretrained(adapter)
model.save_pretrained(out, safe_serialization=True)
tokenizer.save_pretrained(out)
print("merged →", out)
PY

echo "▶ ساخت GGUF Q4_K_M برای llama.cpp / Android…"
if [ ! -d llama.cpp ]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp.git
  pip install -r llama.cpp/requirements.txt
fi
python3 llama.cpp/convert_hf_to_gguf.py "$OUT" --outfile "$OUT/kishavar-f16.gguf" --outtype f16
./llama.cpp/build/bin/llama-quantize "$OUT/kishavar-f16.gguf" "$OUT/kishavar-q4_k_m.gguf" Q4_K_M 2>/dev/null \
  || (cmake -B llama.cpp/build llama.cpp && cmake --build llama.cpp/build -j --target llama-quantize && \
      ./llama.cpp/build/bin/llama-quantize "$OUT/kishavar-f16.gguf" "$OUT/kishavar-q4_k_m.gguf" Q4_K_M)

echo "▶ محاسبه SHA-256 برای اعتبارسنجی دانلود در اپ…"
sha256sum "$OUT/kishavar-q4_k_m.gguf" | tee "$OUT/kishavar-q4_k_m.gguf.sha256"
ls -lh "$OUT"/*.gguf
