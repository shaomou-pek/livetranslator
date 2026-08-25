import os
import base64
import io
import wave
import httpx
from datetime import datetime


def _api_endpoint() -> str:
    direct_url = os.getenv("MODEL_API_STT_URL", "").strip()
    if direct_url:
        return direct_url

    base_url = os.getenv(
        "MODEL_API_BASE_URL", "https://api.openai.com/v1"
    ).rstrip("/")
    return f"{base_url}/audio/transcriptions"


def _api_key() -> str:
    return os.getenv("MODEL_API_KEY") or os.getenv("OPENAI_API_KEY", "")


def _model_name() -> str:
    return (
        os.getenv("STT_MODEL")
        or os.getenv("OPENAI_STT_MODEL")
        or "gpt-4o-mini-transcribe"
    )


def _response_format() -> str:
    configured = os.getenv("STT_RESPONSE_FORMAT", "").strip()
    if configured:
        return configured
    return "verbose_json" if _model_name() == "whisper-1" else "json"

def pcm16_to_wav(pcm16_base64: str, sample_rate=16000, channels=1) -> bytes:
    """Convert PCM16 base64 to WAV bytes"""
    pcm_data = base64.b64decode(pcm16_base64)
    
    # Create WAV file in memory
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)  # 16-bit = 2 bytes
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    
    return wav_buffer.getvalue()

async def transcribe_audio_chunk(audio_base64: str, language: str = None, prompt: str = None) -> dict:
    """
    Send audio chunk to OpenAI Whisper API
    Returns: {"text": "...", "language": "en"}

    prompt: Optional context from previous transcription to improve continuity
    """
    wav_bytes = pcm16_to_wav(audio_base64)
    return await transcribe_audio_file(
        wav_bytes,
        filename="audio.wav",
        content_type="audio/wav",
        language=language,
        prompt=prompt,
    )


async def transcribe_audio_file(
    audio: bytes,
    *,
    filename: str,
    content_type: str,
    language: str = None,
    prompt: str = None,
) -> dict:
    """Transcribe a browser recording or an in-memory audio file."""
    api_key = _api_key()
    if not api_key:
        raise Exception("MODEL_API_KEY or OPENAI_API_KEY not set")

    files = {
        'file': (filename or 'audio.webm', audio, content_type or 'audio/webm'),
    }

    data = {
        'model': _model_name(),
        'response_format': _response_format(),
    }

    if language and language != 'auto':
        data['language'] = language

    if prompt:
        data['prompt'] = prompt[-224:]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            _api_endpoint(),
            headers={'Authorization': f'Bearer {api_key}'},
            files=files,
            data=data
        )
        response.raise_for_status()
        result = response.json()

        detected_lang = result.get("language", "auto")
        text = result.get("text", "")
        words = result.get("words", [])

        print(f"[OpenAI STT] Detected language: {detected_lang}, text: {text[:50]}, words: {len(words)}")

        return {
            "text": text,
            "language": detected_lang,
            "words": words  # Array of {word, start, end} for timestamp-based deduplication
        }
