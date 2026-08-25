from fastapi.testclient import TestClient

from smoke.server import create_app, detect_source_language


def _client():
    app = create_app()

    async def transcribe_audio(*, audio, filename, content_type, language):
        return "Hello, we will start testing next week."

    async def translate_text(text, source_language, target_language):
        assert source_language == "en"
        assert target_language == "zh"
        return "你好，我们下周开始测试。"

    app.state.transcribe_audio = transcribe_audio
    app.state.translate_text = translate_text
    return TestClient(app)


def test_create_room_and_render_qr_code():
    client = _client()

    response = client.post("/api/rooms", json={"title": "Bilingual workshop"})

    assert response.status_code == 201
    room = response.json()
    assert len(room["code"]) == 6
    assert room["join_url"].endswith(f'/room/{room["code"]}')

    qr_response = client.get(f'/api/rooms/{room["code"]}/qr.svg')
    assert qr_response.status_code == 200
    assert qr_response.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in qr_response.content


def test_utterance_is_transcribed_translated_and_broadcast():
    client = _client()
    room = client.post("/api/rooms", json={"title": "Workshop"}).json()

    with client.websocket_connect(f'/ws/rooms/{room["code"]}') as websocket:
        snapshot = websocket.receive_json()
        assert snapshot["type"] == "snapshot"

        response = client.post(
            f'/api/rooms/{room["code"]}/utterances',
            data={
                "participant_id": "emma-device",
                "speaker_name": "Emma",
                "source_language": "en",
            },
            files={"audio": ("speech.webm", b"test-audio", "audio/webm")},
        )

        assert response.status_code == 201
        message = response.json()
        assert message["speaker_name"] == "Emma"
        assert message["source_language"] == "en"
        assert message["target_language"] == "zh"
        assert message["source_text"].startswith("Hello")
        assert message["translated_text"].startswith("你好")

        event = websocket.receive_json()
        while event["type"] != "message":
            event = websocket.receive_json()
        assert event["message"]["id"] == message["id"]


def test_room_page_is_available_for_qr_join_flow():
    client = _client()
    room = client.post("/api/rooms", json={"title": "Workshop"}).json()

    response = client.get(f'/room/{room["code"]}')

    assert response.status_code == 200
    assert "LiveTranslator Lab" in response.text
    assert "开始发言" in response.text
    assert 'id="audioFileInput"' in response.text
    assert 'capture' in response.text


def test_transcript_script_can_correct_the_preferred_language():
    assert detect_source_language("我们下周开始测试。", "en") == "zh"
    assert detect_source_language("We will start testing next week.", "zh") == "en"
    assert detect_source_language("OK", "zh") == "zh"
