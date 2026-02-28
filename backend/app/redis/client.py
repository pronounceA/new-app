from __future__ import annotations

import random

import redis.asyncio as aioredis

from app.models.game import (
    CARD_DISTRIBUTION,
    ROOM_TTL,
    GamePhase,
    RoomInfo,
    RoomStatus,
    TurnInfo,
)


class RedisClient:
    """Redisへの全読み書き操作を担当するクラス。"""

    def __init__(self, redis: aioredis.Redis) -> None:
        self.redis = redis

    # ---------------------------------------------------------------------------
    # キー生成ヘルパー
    # ---------------------------------------------------------------------------

    @staticmethod
    def _room_key(room_id: str) -> str:
        return f"room:{room_id}"

    @staticmethod
    def _players_key(room_id: str) -> str:
        return f"room:{room_id}:players"

    @staticmethod
    def _nicknames_key(room_id: str) -> str:
        return f"room:{room_id}:nicknames"

    @staticmethod
    def _deck_key(room_id: str) -> str:
        return f"game:{room_id}:deck"

    @staticmethod
    def _field_key(room_id: str, nickname: str) -> str:
        return f"game:{room_id}:field:{nickname}"

    @staticmethod
    def _scores_key(room_id: str) -> str:
        return f"game:{room_id}:scores"

    @staticmethod
    def _turn_key(room_id: str) -> str:
        return f"game:{room_id}:turn"

    # ---------------------------------------------------------------------------
    # ルーム操作
    # ---------------------------------------------------------------------------

    async def create_room(
        self,
        room_id: str,
        host_player_id: str,
        max_players: int,
    ) -> None:
        key = self._room_key(room_id)
        await self.redis.hset(key, mapping={  # type: ignore[arg-type]
            "status": RoomStatus.WAITING.value,
            "max_players": str(max_players),
            "host_player_id": host_player_id,
        })
        await self.redis.expire(key, ROOM_TTL)

    async def get_room(self, room_id: str) -> RoomInfo | None:
        data = await self.redis.hgetall(self._room_key(room_id))
        if not data:
            return None
        return RoomInfo(
            room_id=room_id,
            status=RoomStatus(data["status"]),
            max_players=int(data["max_players"]),
            host_player_id=data["host_player_id"],
        )

    async def set_room_status(self, room_id: str, status: RoomStatus) -> None:
        await self.redis.hset(self._room_key(room_id), "status", status.value)

    async def delete_room(self, room_id: str) -> None:
        nicknames = await self.get_all_nicknames(room_id)
        keys = [
            self._room_key(room_id),
            self._players_key(room_id),
            self._nicknames_key(room_id),
            self._deck_key(room_id),
            self._scores_key(room_id),
            self._turn_key(room_id),
        ]
        for nickname in nicknames:
            keys.append(self._field_key(room_id, nickname))
        if keys:
            await self.redis.delete(*keys)

    async def list_waiting_rooms(self) -> list[dict]:
        """waitingステータスのルーム一覧を返す。"""
        rooms = []
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(cursor, match="room:*", count=100)
            for key in keys:
                # room:{room_id}:players などのサブキーを除外
                parts = key.split(":")
                if len(parts) != 2:
                    continue
                room_id = parts[1]
                data = await self.redis.hgetall(key)
                if data.get("status") == RoomStatus.WAITING.value:
                    player_count = await self.get_player_count(room_id)
                    rooms.append({
                        "room_id": room_id,
                        "player_count": player_count,
                        "max_players": int(data.get("max_players", 0)),
                    })
            if cursor == 0:
                break
        return rooms

    # ---------------------------------------------------------------------------
    # プレイヤー操作
    # ---------------------------------------------------------------------------

    async def add_player(
        self,
        room_id: str,
        player_id: str,
        nickname: str,
    ) -> None:
        await self.redis.rpush(self._players_key(room_id), player_id)  # type: ignore[arg-type]
        await self.redis.hset(self._nicknames_key(room_id), player_id, nickname)
        await self.redis.expire(self._players_key(room_id), ROOM_TTL)
        await self.redis.expire(self._nicknames_key(room_id), ROOM_TTL)

    async def remove_player(self, room_id: str, player_id: str) -> None:
        await self.redis.lrem(self._players_key(room_id), 0, player_id)
        await self.redis.hdel(self._nicknames_key(room_id), player_id)

    async def get_player_ids(self, room_id: str) -> list[str]:
        return await self.redis.lrange(self._players_key(room_id), 0, -1)

    async def get_player_count(self, room_id: str) -> int:
        return await self.redis.llen(self._players_key(room_id))

    async def get_nickname(self, room_id: str, player_id: str) -> str | None:
        return await self.redis.hget(self._nicknames_key(room_id), player_id)

    async def get_player_id_by_nickname(
        self, room_id: str, nickname: str
    ) -> str | None:
        all_nicknames: dict[str, str] = await self.redis.hgetall(
            self._nicknames_key(room_id)
        )
        for pid, nick in all_nicknames.items():
            if nick == nickname:
                return pid
        return None

    async def get_all_nicknames(self, room_id: str) -> list[str]:
        player_ids = await self.get_player_ids(room_id)
        nicknames = []
        for pid in player_ids:
            nick = await self.get_nickname(room_id, pid)
            if nick:
                nicknames.append(nick)
        return nicknames

    async def is_nickname_taken(self, room_id: str, nickname: str) -> bool:
        all_nicks: dict[str, str] = await self.redis.hgetall(
            self._nicknames_key(room_id)
        )
        return nickname in all_nicks.values()

    async def get_next_player_nickname(
        self, room_id: str, current_nickname: str
    ) -> str:
        nicknames = await self.get_all_nicknames(room_id)
        if not nicknames:
            return current_nickname
        try:
            idx = nicknames.index(current_nickname)
        except ValueError:
            return nicknames[0]
        return nicknames[(idx + 1) % len(nicknames)]

    # ---------------------------------------------------------------------------
    # デッキ操作
    # ---------------------------------------------------------------------------

    async def initialize_deck(self, room_id: str, deck_size: int = 110) -> None:
        deck: list[int] = []
        for card, count in CARD_DISTRIBUTION.items():
            deck.extend([card] * count)
        random.shuffle(deck)
        deck = deck[:deck_size]  # 先頭から deck_size 枚に切り出す
        key = self._deck_key(room_id)
        await self.redis.delete(key)
        await self.redis.rpush(key, *[str(c) for c in deck])  # type: ignore[arg-type]
        await self.redis.expire(key, ROOM_TTL)

    async def draw_card(self, room_id: str) -> int | None:
        val = await self.redis.rpop(self._deck_key(room_id))
        if val is None:
            return None
        return int(val)

    async def get_deck_count(self, room_id: str) -> int:
        return await self.redis.llen(self._deck_key(room_id))

    # ---------------------------------------------------------------------------
    # フィールド（場）操作
    # ---------------------------------------------------------------------------

    async def get_field(self, room_id: str, nickname: str) -> list[int]:
        raw = await self.redis.lrange(self._field_key(room_id, nickname), 0, -1)
        return [int(v) for v in raw]

    async def add_to_field(self, room_id: str, nickname: str, card: int) -> None:
        key = self._field_key(room_id, nickname)
        await self.redis.rpush(key, str(card))  # type: ignore[arg-type]
        await self.redis.expire(key, ROOM_TTL)

    async def clear_field(self, room_id: str, nickname: str) -> list[int]:
        key = self._field_key(room_id, nickname)
        cards = await self.get_field(room_id, nickname)
        await self.redis.delete(key)
        return cards

    async def remove_card_from_field(
        self, room_id: str, nickname: str, card: int
    ) -> None:
        await self.redis.lrem(self._field_key(room_id, nickname), 1, str(card))

    async def remove_all_of_card_from_field(
        self, room_id: str, nickname: str, card: int
    ) -> None:
        """指定した数字のカードをすべて場から削除する。"""
        await self.redis.lrem(self._field_key(room_id, nickname), 0, str(card))

    async def get_all_fields(self, room_id: str) -> dict[str, list[int]]:
        nicknames = await self.get_all_nicknames(room_id)
        result: dict[str, list[int]] = {}
        for nickname in nicknames:
            result[nickname] = await self.get_field(room_id, nickname)
        return result

    # ---------------------------------------------------------------------------
    # スコア操作
    # ---------------------------------------------------------------------------

    async def initialize_scores(self, room_id: str, nicknames: list[str]) -> None:
        key = self._scores_key(room_id)
        await self.redis.delete(key)
        if nicknames:
            mapping = {nick: "0" for nick in nicknames}
            await self.redis.hset(key, mapping=mapping)  # type: ignore[arg-type]
        await self.redis.expire(key, ROOM_TTL)

    async def get_score(self, room_id: str, nickname: str) -> int:
        val = await self.redis.hget(self._scores_key(room_id), nickname)
        return int(val) if val is not None else 0

    async def add_score(self, room_id: str, nickname: str, points: int) -> int:
        val = await self.redis.hincrbyfloat(
            self._scores_key(room_id), nickname, points
        )
        return int(float(val))

    async def get_all_scores(self, room_id: str) -> dict[str, int]:
        raw: dict[str, str] = await self.redis.hgetall(self._scores_key(room_id))
        return {nick: int(float(score)) for nick, score in raw.items()}

    # ---------------------------------------------------------------------------
    # ターン操作
    # ---------------------------------------------------------------------------

    async def get_turn(self, room_id: str) -> TurnInfo | None:
        data: dict[str, str] = await self.redis.hgetall(self._turn_key(room_id))
        if not data:
            return None
        drawn_card_val = data.get("drawn_card")
        return TurnInfo(
            current_nickname=data["current_nickname"],
            phase=GamePhase(data["phase"]),
            drawn_card=int(drawn_card_val) if drawn_card_val else None,
        )

    async def set_turn(
        self,
        room_id: str,
        current_nickname: str,
        phase: GamePhase,
        drawn_card: int | None = None,
    ) -> None:
        key = self._turn_key(room_id)
        mapping: dict[str, str] = {
            "current_nickname": current_nickname,
            "phase": phase.value,
        }
        if drawn_card is not None:
            mapping["drawn_card"] = str(drawn_card)
        else:
            # drawn_cardをリセット
            await self.redis.hdel(key, "drawn_card")
        await self.redis.hset(key, mapping=mapping)  # type: ignore[arg-type]
        await self.redis.expire(key, ROOM_TTL)

    async def set_phase(self, room_id: str, phase: GamePhase) -> None:
        await self.redis.hset(self._turn_key(room_id), "phase", phase.value)
