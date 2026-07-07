import json
from pathlib import Path
from typing import Any


DEMO_MODEL_PATH = Path(__file__).parent / "demo" / "public_demo_model.json"


def load_demo_model() -> dict[str, Any]:
    return json.loads(DEMO_MODEL_PATH.read_text(encoding="utf-8"))


DEMO_MODEL = load_demo_model()
