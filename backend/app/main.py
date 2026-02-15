import json
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.redis.client import RedisClient
from app.services.game_service import GameService
from app.websocket.handlers import EventHandler

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

app = FastAPI(title="だるまあつめ API", lifespan=lifespan)

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

    async def move_player(
        self,
        from_room: str,
        to_room: str,
        player_id: str,
        ws: WebSocket,
    ) -> None:
        """プレイヤーをfrom_roomからto_roomに移動する（lobby→実ルームID）。"""
        self.disconnect(from_room, player_id)
        if to_room not in self.rooms:
            self.rooms[to_room] = {}
        self.rooms[to_room][player_id] = ws
        logger.info("Moved: player=%s %s -> %s", player_id, from_room, to_room)

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
    """waitingステータスのルーム一覧を返す。"""
    if redis_client is None:
        return []
    redis_c = RedisClient(redis_client)
    return await redis_c.list_waiting_rooms()


# ---------------------------------------------------------------------------
# WebSocket エンドポイント
# ---------------------------------------------------------------------------

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(ws: WebSocket, player_id: str) -> None:
    room_id = "lobby"
    await manager.connect(room_id, player_id, ws)

    assert redis_client is not None
    redis_c = RedisClient(redis_client)
    game_svc = GameService(redis_c, manager)
    handler = EventHandler(game_svc)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal(
                    ws,
                    {
                        "type": "error",
                        "payload": {
                            "message": "Invalid JSON",
                            "code": "INVALID_JSON",
                        },
                    },
                )
                continue

            event_type: str = event.get("type", "")
            logger.debug(
                "Event: type=%s player=%s room=%s", event_type, player_id, room_id
            )

            new_room_id = await handler.handle(ws, player_id, room_id, event)
            if new_room_id:
                room_id = new_room_id

    except WebSocketDisconnect:
        manager.disconnect(room_id, player_id)
        if room_id != "lobby":
            await game_svc.handle_disconnect(player_id, room_id)
