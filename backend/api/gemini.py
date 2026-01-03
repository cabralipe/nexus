import os
from typing import Optional

import google.generativeai as genai

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def _build_model(system_instruction: Optional[str] = None) -> genai.GenerativeModel:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    genai.configure(api_key=api_key)
    if system_instruction:
        return genai.GenerativeModel(
            model_name=DEFAULT_MODEL,
            system_instruction=system_instruction,
        )
    return genai.GenerativeModel(model_name=DEFAULT_MODEL)


def generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
    model = _build_model(system_instruction=system_instruction)
    response = model.generate_content(prompt)
    return getattr(response, "text", "") or ""
