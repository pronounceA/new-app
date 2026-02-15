import os
import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

logging.basicConfig(level=os.getenv("LOG_LEVEL", "info").upper())
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Redis 接続
# ---------------------------------------------------------------------------

redis_client: aioredis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global redis_client
    redis_url = (
        f"redis://:{os.getenv('REDIS_PASSWORD', '')}@"
        f"{os.getenv('REDIS_HOST', 'redis')}:{os.getenv('REDIS_PORT', '6379')}/0"
    )
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    logger.info("Redis connected")
    yield
    await redis_client.aclose()
    logger.info("Redis disconnected")


# ---------------------------------------------------------------------------
# アプリケーション設定
# ---------------------------------------------------------------------------

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(title="Card Game API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket 接続管理
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self) -> None:
        # room_id -> {player_id -> WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, player_id: str, ws: WebSocket) -> None:
        await ws.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][player_id] = ws
        logger.info("Connected: player=%s room=%s", player_id, room_id)

    def disconnect(self, room_id: str, player_id: str) -> None:
        if room_id in self.rooms:
            self.rooms[room_id].pop(player_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
        logger.info("Disconnected: player=%s room=%s", player_id, room_id)

    async def broadcast(self, room_id: str, message: dict) -> None:
        if room_id not in self.rooms:
            return
        data = json.dumps(message, ensure_ascii=False)
        for ws in list(self.rooms[room_id].values()):
            try:
                await ws.send_text(data)
            except Exception:
                pass

    async def send_personal(self, ws: WebSocket, message: dict) -> None:
        await ws.send_text(json.dumps(message, ensure_ascii=False))


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# REST エンドポイント
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/rooms")
async def list_rooms() -> list[dict]:
    """公開ルーム一覧（今後実装予定）"""
    return []


# ---------------------------------------------------------------------------
# WebSocket エンドポイント
# ---------------------------------------------------------------------------

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(ws: WebSocket, player_id: str) -> None:
    # 暫定: player_id をルームIDとして扱わず、接続確認のみ行うスケルトン
    # ゲームロジックは今後 app/services/ に実装する
    room_id = "lobby"
    await manager.connect(room_id, player_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal(
                    ws,
                    {"type": "error", "payload": {"message": "Invalid JSON", "code": "INVALID_JSON"}},
                )
                continue

            event_type: str = event.get("type", "")
            logger.debug("Received event: type=%s player=%s", event_type, player_id)

            # TODO: ゲームロジックの実装
            # 現時点ではエコーバックのみ
            await manager.send_personal(
                ws,
                {
                    "type": "error",
                    "payload": {
                        "message": f"イベント '{event_type}' は未実装です",
                        "code": "NOT_IMPLEMENTED",
                    },
                },
            )

    except WebSocketDisconnect:
        manager.disconnect(room_id, player_id)
