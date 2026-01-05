import os
from typing import Optional

from google import genai

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def _build_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client()


def generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is not set")
    client = _build_client()
    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=full_prompt,
    )
    return getattr(response, "text", "") or ""
