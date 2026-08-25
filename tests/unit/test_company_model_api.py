from api.routers.mt import openai_backend as mt_backend
from api.routers.stt import openai_backend as stt_backend


def test_stt_endpoint_uses_configured_base_url(monkeypatch):
    monkeypatch.setenv("MODEL_API_BASE_URL", "https://models.example.com/v1/")
    monkeypatch.delenv("MODEL_API_STT_URL", raising=False)

    assert (
        stt_backend._api_endpoint()
        == "https://models.example.com/v1/audio/transcriptions"
    )


def test_stt_endpoint_supports_direct_override(monkeypatch):
    monkeypatch.setenv(
        "MODEL_API_STT_URL", "https://speech.example.com/custom/transcribe"
    )

    assert (
        stt_backend._api_endpoint()
        == "https://speech.example.com/custom/transcribe"
    )


def test_translation_endpoint_uses_configured_base_url(monkeypatch):
    monkeypatch.setenv("MODEL_API_BASE_URL", "https://models.example.com/v1")
    monkeypatch.delenv("MODEL_API_CHAT_URL", raising=False)

    assert (
        mt_backend._api_endpoint()
        == "https://models.example.com/v1/chat/completions"
    )


def test_company_credentials_and_models_take_precedence(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "company-key")
    monkeypatch.setenv("OPENAI_API_KEY", "legacy-key")
    monkeypatch.setenv("STT_MODEL", "gpt-4o-mini-transcribe")
    monkeypatch.setenv("OPENAI_STT_MODEL", "whisper-1")
    monkeypatch.setenv("TRANSLATION_MODEL", "gpt-5.6-luna")
    monkeypatch.setenv("OPENAI_MT_MODEL", "gpt-4o-mini")

    assert stt_backend._api_key() == "company-key"
    assert stt_backend._model_name() == "gpt-4o-mini-transcribe"
    assert mt_backend._api_key() == "company-key"
    assert mt_backend._model_name() == "gpt-5.6-luna"


def test_translation_defaults_to_verified_gateway_model(monkeypatch):
    monkeypatch.delenv("TRANSLATION_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_MT_MODEL", raising=False)

    assert mt_backend._model_name() == "gpt-5.2"


def test_stt_response_format_matches_model_capabilities(monkeypatch):
    monkeypatch.delenv("STT_RESPONSE_FORMAT", raising=False)
    monkeypatch.setenv("STT_MODEL", "gpt-4o-mini-transcribe")
    assert stt_backend._response_format() == "json"

    monkeypatch.setenv("STT_MODEL", "whisper-1")
    assert stt_backend._response_format() == "verbose_json"


def test_translation_prompt_supports_chinese_to_english():
    messages = mt_backend._build_translation_messages(
        "我们下周开始测试。", "zh", "en"
    )

    assert "Chinese" in messages[-1]["content"]
    assert "English" in messages[-1]["content"]
    assert "我们下周开始测试。" in messages[-1]["content"]


def test_translation_prompt_supports_english_to_chinese():
    messages = mt_backend._build_translation_messages(
        "We will start testing next week.", "en", "zh"
    )

    assert "English" in messages[-1]["content"]
    assert "Chinese" in messages[-1]["content"]
    assert "We will start testing next week." in messages[-1]["content"]
