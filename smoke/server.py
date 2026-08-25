import io
import os
import secrets
import string
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Set

import qrcode
import qrcode.image.svg
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api.routers.mt.openai_backend import translate_text as gateway_translate_text
from api.routers.stt.openai_backend import transcribe_audio_file


STATIC_DIR = Path(__file__).parent / "static"
ROOM_ALPHABET = string.ascii_uppercase + string.digits


class RoomCreate(BaseModel):
    title: str = Field(default="Bilingual discussion", min_length=1, max_length=80)


@dataclass
class TranscriptMessage:
    id: str
    participant_id: str
    speaker_name: str
    source_language: str
    target_language: str
    source_text: str
    translated_text: str
    created_at: str


@dataclass
class Room:
    code: str
    title: str
    created_at: str
    messages: List[TranscriptMessage] = field(default_factory=list)
    sockets: Set[WebSocket] = field(default_factory=set)


class RoomStore:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def create(self, title: str) -> Room:
        while True:
            code = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(6))
            if code not in self.rooms:
                break
        room = Room(
            code=code,
            title=title.strip(),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.rooms[code] = room
        return room

    def get(self, code: str) -> Room:
        room = self.rooms.get(code.upper())
        if not room:
            raise KeyError(code)
        return room

    async def broadcast(self, room: Room, event: dict):
        disconnected = []
        for socket in list(room.sockets):
            try:
                await socket.send_json(event)
            except Exception:
                disconnected.append(socket)
        for socket in disconnected:
            room.sockets.discard(socket)


def target_language(source_language: str) -> str:
    normalized = source_language.lower()
    if normalized == "zh":
        return "en"
    if normalized == "en":
        return "zh"
    raise ValueError("Only Chinese and English are supported in smoke mode")


def detect_source_language(text: str, preferred_language: str) -> str:
    """Correct an obvious Chinese/English mismatch while keeping short replies stable."""
    chinese_characters = sum("\u4e00" <= char <= "\u9fff" for char in text)
    latin_characters = sum(char.isascii() and char.isalpha() for char in text)
    if chinese_characters >= 2 and chinese_characters >= latin_characters:
        return "zh"
    if latin_characters >= 3 and latin_characters > chinese_characters * 2:
        return "en"
    return preferred_language


async def _default_transcribe_audio(*, audio, filename, content_type, language):
    result = await transcribe_audio_file(
        audio,
        filename=filename,
        content_type=content_type,
        language=language,
    )
    return result.get("text", "").strip()


async def _default_translate_text(text, source_language, target_language):
    result = await gateway_translate_text(text, source_language, target_language)
    return result.get("text", "").strip()


def _public_base_url(request: Request) -> str:
    configured = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


def create_app() -> FastAPI:
    app = FastAPI(title="LiveTranslator Lab", version="1.0-smoke")
    app.state.rooms = RoomStore()
    app.state.transcribe_audio = _default_transcribe_audio
    app.state.translate_text = _default_translate_text
    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")

    @app.get("/")
    async def home():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/room/{room_code}")
    async def room_page(room_code: str):
        return FileResponse(STATIC_DIR / "index.html")

    @app.post("/api/rooms", status_code=201)
    async def create_room(payload: RoomCreate, request: Request):
        room = app.state.rooms.create(payload.title)
        join_url = f"{_public_base_url(request)}/room/{room.code}"
        return {
            "code": room.code,
            "title": room.title,
            "join_url": join_url,
            "qr_url": f"/api/rooms/{room.code}/qr.svg",
        }

    @app.get("/api/rooms/{room_code}")
    async def get_room(room_code: str):
        try:
            room = app.state.rooms.get(room_code)
        except KeyError:
            raise HTTPException(status_code=404, detail="Room not found")
        return {
            "code": room.code,
            "title": room.title,
            "created_at": room.created_at,
            "messages": [asdict(message) for message in room.messages],
            "online": len(room.sockets),
        }

    @app.get("/api/rooms/{room_code}/qr.svg")
    async def room_qr(room_code: str, request: Request):
        try:
            room = app.state.rooms.get(room_code)
        except KeyError:
            raise HTTPException(status_code=404, detail="Room not found")
        join_url = f"{_public_base_url(request)}/room/{room.code}"
        image = qrcode.make(join_url, image_factory=qrcode.image.svg.SvgPathImage)
        buffer = io.BytesIO()
        image.save(buffer)
        return Response(buffer.getvalue(), media_type="image/svg+xml")

    async def process_utterance(
        room: Room,
        *,
        participant_id: str,
        speaker_name: str,
        source_language: str,
        audio: bytes,
        filename: str,
        content_type: str,
    ) -> TranscriptMessage:
        try:
            target_language(source_language)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        try:
            source_text = await app.state.transcribe_audio(
                audio=audio,
                filename=filename,
                content_type=content_type,
                language=source_language,
            )
            if not source_text:
                raise RuntimeError("No speech was detected")
            detected_language = detect_source_language(source_text, source_language)
            target = target_language(detected_language)
            translated_text = await app.state.translate_text(
                source_text, detected_language, target
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Model gateway request failed: {exc}"
            )

        message = TranscriptMessage(
            id=secrets.token_hex(8),
            participant_id=participant_id,
            speaker_name=speaker_name.strip() or "Guest",
            source_language=detected_language,
            target_language=target,
            source_text=source_text,
            translated_text=translated_text,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        room.messages.append(message)
        room.messages[:] = room.messages[-200:]
        await app.state.rooms.broadcast(
            room, {"type": "message", "message": asdict(message)}
        )
        return message

    @app.post("/api/rooms/{room_code}/utterances", status_code=201)
    async def create_utterance(
        room_code: str,
        participant_id: str = Form(...),
        speaker_name: str = Form(...),
        source_language: str = Form(...),
        audio: UploadFile = File(...),
    ):
        try:
            room = app.state.rooms.get(room_code)
        except KeyError:
            raise HTTPException(status_code=404, detail="Room not found")
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=422, detail="Audio file is empty")
        return asdict(
            await process_utterance(
                room,
                participant_id=participant_id,
                speaker_name=speaker_name,
                source_language=source_language,
                audio=audio_bytes,
                filename=audio.filename or "speech.webm",
                content_type=audio.content_type or "audio/webm",
            )
        )

    @app.post("/api/rooms/{room_code}/demo", status_code=201)
    async def create_demo_utterance(
        room_code: str,
        participant_id: str = Form("demo-device"),
        speaker_name: str = Form("Demo speaker"),
    ):
        try:
            room = app.state.rooms.get(room_code)
        except KeyError:
            raise HTTPException(status_code=404, detail="Room not found")
        sample = Path(__file__).parents[1] / "tests/samples/common_voice_en_43193780.mp3"
        return asdict(
            await process_utterance(
                room,
                participant_id=participant_id,
                speaker_name=speaker_name,
                source_language="en",
                audio=sample.read_bytes(),
                filename=sample.name,
                content_type="audio/mpeg",
            )
        )

    @app.websocket("/ws/rooms/{room_code}")
    async def room_socket(websocket: WebSocket, room_code: str):
        try:
            room = app.state.rooms.get(room_code)
        except KeyError:
            await websocket.close(code=4404)
            return
        await websocket.accept()
        room.sockets.add(websocket)
        await websocket.send_json({
            "type": "snapshot",
            "room": {"code": room.code, "title": room.title},
            "messages": [asdict(message) for message in room.messages],
            "online": len(room.sockets),
        })
        await app.state.rooms.broadcast(
            room, {"type": "presence", "online": len(room.sockets)}
        )
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            room.sockets.discard(websocket)
            await app.state.rooms.broadcast(
                room, {"type": "presence", "online": len(room.sockets)}
            )

    return app


app = create_app()
