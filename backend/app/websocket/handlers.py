from __future__ import annotations

import logging

from fastapi import WebSocket
from pydantic import ValidationError

from app.models.game import (
    CreateRoomPayload,
    DrawCardPayload,
    GameError,
    JoinRoomPayload,
    LeaveRoomPayload,
    ScoreCardsPayload,
    SkipStealPayload,
    StartGamePayload,
    StealCardPayload,
)
from app.services.game_service import GameService

logger = logging.getLogger(__name__)


class EventHandler:
    """WebSocketイベントのルーティングとGameServiceへの委譲を担当するクラス。"""

    def __init__(self, game_service: GameService) -> None:
        self.service = game_service

    async def handle(
        self,
        ws: WebSocket,
        player_id: str,
        room_id: str,
        event: dict,
    ) -> str | None:
        """
        イベントタイプに応じてハンドラーに委譲する。
        create_room / join_room の場合は新しいroom_idを返す。
        エラー時はerrorイベントをクライアントに送信する。
        """
        event_type: str = event.get("type", "")
        payload: dict = event.get("payload", {})

        try:
            match event_type:
                case "create_room":
                    return await self._handle_create_room(ws, player_id, payload)
                case "join_room":
                    return await self._handle_join_room(ws, player_id, room_id, payload)
                case "start_game":
                    await self._handle_start_game(ws, player_id, room_id, payload)
                case "score_cards":
                    await self._handle_score_cards(player_id, room_id, payload)
                case "draw_card":
                    await self._handle_draw_card(player_id, room_id, payload)
                case "steal_card":
                    await self._handle_steal_card(player_id, room_id, payload)
                case "skip_steal":
                    await self._handle_skip_steal(player_id, room_id, payload)
                case "end_turn":
                    await self._handle_end_turn(player_id, room_id, payload)
                case "leave_room":
                    await self._handle_leave_room(player_id, room_id, payload)
                case _:
                    await self._send_error(
                        ws,
                        f"未知のイベント: {event_type}",
                        "UNKNOWN_EVENT",
                    )
        except GameError as e:
            await self._send_error(ws, e.message, e.code)
        except ValidationError as e:
            await self._send_error(ws, str(e), "VALIDATION_ERROR")
        except Exception:
            logger.exception("Unexpected error: player=%s event=%s", player_id, event_type)
            await self._send_error(ws, "内部エラーが発生しました", "INTERNAL_ERROR")

        return None

    # ---------------------------------------------------------------------------
    # 各イベントハンドラー
    # ---------------------------------------------------------------------------

    async def _handle_create_room(
        self, ws: WebSocket, player_id: str, payload: dict
    ) -> str:
        data = CreateRoomPayload(**payload)
        new_room_id = await self.service.create_room(
            ws=ws,
            player_id=player_id,
            nickname=data.nickname,
            max_players=data.max_players,
        )
        return new_room_id

    async def _handle_join_room(
        self, ws: WebSocket, player_id: str, room_id: str, payload: dict
    ) -> str:
        data = JoinRoomPayload(**payload)
        await self.service.join_room(
            ws=ws,
            player_id=player_id,
            room_id=data.room_id,
            nickname=data.nickname,
        )
        return data.room_id

    async def _handle_start_game(
        self, ws: WebSocket, player_id: str, room_id: str, payload: dict
    ) -> None:
        StartGamePayload(**payload)
        await self.service.start_game(ws=ws, player_id=player_id, room_id=room_id)

    async def _handle_score_cards(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        ScoreCardsPayload(**payload)
        await self.service.score_cards(player_id=player_id, room_id=room_id)

    async def _handle_draw_card(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        DrawCardPayload(**payload)
        await self.service.draw_card(player_id=player_id, room_id=room_id)

    async def _handle_steal_card(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        data = StealCardPayload(**payload)
        await self.service.steal_card(
            player_id=player_id,
            room_id=room_id,
            target_nickname=data.target_player_id,
            card_number=data.card_number,
        )

    async def _handle_skip_steal(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        SkipStealPayload(**payload)
        await self.service.skip_steal(player_id=player_id, room_id=room_id)

    async def _handle_end_turn(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        StartGamePayload(**payload)  # 空ペイロード検証
        await self.service.end_turn(player_id=player_id, room_id=room_id)

    async def _handle_leave_room(
        self, player_id: str, room_id: str, payload: dict
    ) -> None:
        LeaveRoomPayload(**payload)
        await self.service.handle_disconnect(player_id=player_id, room_id=room_id)

    # ---------------------------------------------------------------------------
    # エラー送信
    # ---------------------------------------------------------------------------

    async def _send_error(self, ws: WebSocket, message: str, code: str) -> None:
        try:
            await ws.send_text(
                __import__("json").dumps(
                    {"type": "error", "payload": {"message": message, "code": code}},
                    ensure_ascii=False,
                )
            )
        except Exception:
            pass
