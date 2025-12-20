import os, time, json, hashlib
import requests
from typing import Dict, Any, Optional, Tuple

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-small-24b-instruct-2501").strip()
OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"

def sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8", errors="ignore")).hexdigest()

def call_openrouter_json(
    system: str,
    user: str,
    schema_hint: str,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY missing in environment")

    used_model = model or OPENROUTER_MODEL
    payload = {
        "model": used_model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user + "\n\nReturn JSON only.\n\nJSON_SCHEMA_HINT:\n" + schema_hint},
        ],
    }

    t0 = time.time()
    r = requests.post(
        OPENROUTER_BASE,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload),
        timeout=120,
    )
    latency_ms = int((time.time() - t0) * 1000)
    if r.status_code >= 400:
        raise RuntimeError(f"OpenRouter error {r.status_code}: {r.text[:800]}")

    data = r.json()
    content = data["choices"][0]["message"]["content"]

    parsed = json.loads(content)

    meta = {
        "raw_response": content,
        "model": used_model,
        "latency_ms": latency_ms,
        "input_hash": sha256(user),
    }
    return parsed, meta
