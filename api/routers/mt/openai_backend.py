import os
import httpx


LANGUAGE_NAMES = {
    "en": "English",
    "zh": "Chinese",
    "zh-cn": "Chinese",
    "zh-tw": "Traditional Chinese",
}


def _api_endpoint() -> str:
    direct_url = os.getenv("MODEL_API_CHAT_URL", "").strip()
    if direct_url:
        return direct_url

    base_url = os.getenv(
        "MODEL_API_BASE_URL", "https://api.openai.com/v1"
    ).rstrip("/")
    return f"{base_url}/chat/completions"


def _api_key() -> str:
    return os.getenv("MODEL_API_KEY") or os.getenv("OPENAI_API_KEY", "")


def _model_name() -> str:
    return (
        os.getenv("TRANSLATION_MODEL")
        or os.getenv("OPENAI_MT_MODEL")
        or "gpt-5.2"
    )


def _language_name(language: str) -> str:
    normalized = (language or "auto").lower()
    return LANGUAGE_NAMES.get(normalized, language or "auto")


def _build_translation_messages(text: str, src_lang: str, tgt_lang: str) -> list:
    translating_to_arabic = tgt_lang == "ar"
    translating_from_arabic = src_lang == "ar"

    target_language = (
        "Egyptian Arabic (colloquial/spoken dialect)"
        if translating_to_arabic
        else _language_name(tgt_lang)
    )
    source_language = (
        "Egyptian Arabic (colloquial/spoken dialect)"
        if translating_from_arabic
        else _language_name(src_lang)
    )

    messages = []
    if translating_to_arabic:
        messages.append({
            'role': 'system',
            'content': (
                'You are a professional translator specializing in Egyptian Arabic. '
                'Translate the following text into natural, colloquial Egyptian Arabic '
                'as it would be spoken in everyday conversation. '
                'Use the Egyptian dialect (Masri), not formal Modern Standard Arabic. '
                'Return ONLY the translated text with no explanations, notes, or additional commentary.'
            )
        })
    elif translating_from_arabic:
        messages.append({
            'role': 'system',
            'content': (
                'You are a professional translator specializing in Egyptian Arabic. '
                'The source text is in colloquial Egyptian Arabic (Masri dialect). '
                'Translate it naturally to the target language. '
                'Return ONLY the translated text with no explanations, notes, or additional commentary.'
            )
        })

    messages.append({
        'role': 'user',
        'content': (
            f"Translate this {source_language} text to {target_language}. "
            "Preserve names, numbers, product terms, and conversational tone. "
            f"Return only the translation:\n\n{text}"
        )
    })
    return messages


async def translate_text(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate text using OpenAI GPT with optimized settings for Arabic

    Returns:
        dict: {
            "text": translated text,
            "model": configured translation model name
        }
    """
    api_key = _api_key()
    if not api_key:
        raise Exception("MODEL_API_KEY or OPENAI_API_KEY not set")

    model = _model_name()
    messages = _build_translation_messages(text, src_lang, tgt_lang)

    # Use optimized settings: temperature 0.1-0.2 for faithful output
    request_params = {
        'model': model,
        'messages': messages,
    }

    if model.startswith("gpt-5"):
        request_params['reasoning_effort'] = os.getenv(
            "TRANSLATION_REASONING_EFFORT", "none"
        )
        request_params['max_completion_tokens'] = 1000
    else:
        request_params['temperature'] = 0.15
        request_params['max_tokens'] = 1000

    if 'gpt-4o' in model:
        request_params['seed'] = 42

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            _api_endpoint(),
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json=request_params
        )
        response.raise_for_status()
        result = response.json()

        translated = result['choices'][0]['message']['content'].strip()
        return {
            "text": translated,
            "model": model
        }
