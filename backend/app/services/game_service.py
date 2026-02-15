from __future__ import annotations

import logging
import uuid

from fastapi import WebSocket

from app.models.game import (
    BurstPayload,
    CardDrawnPayload,
    CardStolenPayload,
    CardsScoredPayload,
    GameEndedPayload,
    GameError,
    GamePhase,
    GameStartedPayload,
    GameStatePayload,
    PlayerJoinedPayload,
    PlayerRanking,
    RoomCreatedPayload,
    RoomStatus,
    TurnChangedPayload,
)
from app.redis.client import RedisClient

logger = logging.getLogger(__name__)


class GameService:
    """ゲームロジックを担当するサービスクラス。"""

    def __init__(self, redis: RedisClient, manager) -> None:  # type: ignore[type-arg]
        self.redis = redis
        self.manager = manager

    # ---------------------------------------------------------------------------
    # ルーム管理
    # ---------------------------------------------------------------------------

    async def create_room(
        self,
        ws: WebSocket,
        player_id: str,
        nickname: str,
        max_players: int,
    ) -> str:
        room_id = uuid.uuid4().hex[:8]
        await self.redis.create_room(room_id, player_id, max_players)
        await self.redis.add_player(room_id, player_id, nickname)

        # ConnectionManagerのlobbyから実ルームへ移動
        await self.manager.move_player("lobby", room_id, player_id, ws)

        # room_created を送信元のみに送信
        await self.manager.send_personal(
            ws,
            {"type": "room_created", "payload": RoomCreatedPayload(room_id=room_id).model_dump()},
        )

        # player_joined を全員にブロードキャスト（現時点では自分だけ）
        nicknames = await self.redis.get_all_nicknames(room_id)
        await self.manager.broadcast(
            room_id,
            {
                "type": "player_joined",
                "payload": PlayerJoinedPayload(
                    room_id=room_id,
                    nickname=nickname,
                    player_count=len(nicknames),
                    players=nicknames,
                ).model_dump(),
            },
        )

        logger.info("Room created: room=%s player=%s", room_id, player_id)
        return room_id

    async def join_room(
        self,
        ws: WebSocket,
        player_id: str,
        room_id: str,
        nickname: str,
    ) -> None:
        room = await self.redis.get_room(room_id)
        if room is None:
            raise GameError("ROOM_NOT_FOUND", f"ルーム '{room_id}' が見つかりません")

        # 再接続: 同じplayer_idが既にルームに存在する場合はスキップして再参加
        existing_nickname = await self.redis.get_nickname(room_id, player_id)
        if existing_nickname:
            await self.manager.move_player("lobby", room_id, player_id, ws)
            nicknames = await self.redis.get_all_nicknames(room_id)
            await self.manager.broadcast(
                room_id,
                {
                    "type": "player_joined",
                    "payload": PlayerJoinedPayload(
                        room_id=room_id,
                        nickname=existing_nickname,
                        player_count=len(nicknames),
                        players=nicknames,
                    ).model_dump(),
                },
            )
            logger.info("Player reconnected: room=%s player=%s", room_id, player_id)
            return

        if room.status != RoomStatus.WAITING:
            raise GameError("GAME_NOT_STARTED", "ゲームはすでに開始されています")

        player_count = await self.redis.get_player_count(room_id)
        if player_count >= room.max_players:
            raise GameError("ROOM_FULL", "ルームが満員です")

        if await self.redis.is_nickname_taken(room_id, nickname):
            raise GameError("NICKNAME_TAKEN", f"ニックネーム '{nickname}' はすでに使用されています")

        await self.redis.add_player(room_id, player_id, nickname)
        await self.manager.move_player("lobby", room_id, player_id, ws)

        nicknames = await self.redis.get_all_nicknames(room_id)
        await self.manager.broadcast(
            room_id,
            {
                "type": "player_joined",
                "payload": PlayerJoinedPayload(
                    room_id=room_id,
                    nickname=nickname,
                    player_count=len(nicknames),
                    players=nicknames,
                ).model_dump(),
            },
        )
        logger.info("Player joined: room=%s player=%s", room_id, player_id)

    async def start_game(
        self, ws: WebSocket, player_id: str, room_id: str
    ) -> None:
        room = await self.redis.get_room(room_id)
        if room is None:
            raise GameError("ROOM_NOT_FOUND", f"ルーム '{room_id}' が見つかりません")
        if room.status != RoomStatus.WAITING:
            raise GameError("INVALID_PHASE", "ゲームはすでに開始されています")
        if room.host_player_id != player_id:
            raise GameError("NOT_YOUR_TURN", "ゲームを開始できるのはホストのみです")

        player_count = await self.redis.get_player_count(room_id)
        if player_count < 2:
            raise GameError("INVALID_PHASE", "ゲーム開始には2人以上必要です")

        await self.redis.set_room_status(room_id, RoomStatus.PLAYING)
        await self.redis.initialize_deck(room_id)

        nicknames = await self.redis.get_all_nicknames(room_id)
        await self.redis.initialize_scores(room_id, nicknames)

        deck_count = await self.redis.get_deck_count(room_id)
        first_player = nicknames[0]

        await self.manager.broadcast(
            room_id,
            {
                "type": "game_started",
                "payload": GameStartedPayload(
                    players=nicknames,
                    deck_count=deck_count,
                    first_player=first_player,
                ).model_dump(),
            },
        )
        logger.info("Game started: room=%s first_player=%s", room_id, first_player)
        await self._start_turn(room_id, first_player)

    async def handle_disconnect(self, player_id: str, room_id: str) -> None:
        nickname = await self.redis.get_nickname(room_id, player_id)
        await self.redis.remove_player(room_id, player_id)
        player_count = await self.redis.get_player_count(room_id)
        room = await self.redis.get_room(room_id)
        if player_count == 0 and room and room.status == RoomStatus.PLAYING:
            await self.redis.delete_room(room_id)
            logger.info("Room deleted (empty, was playing): room=%s", room_id)
        else:
            logger.info(
                "Player disconnected: room=%s player=%s nickname=%s",
                room_id, player_id, nickname,
            )

    # ---------------------------------------------------------------------------
    # ゲームアクション
    # ---------------------------------------------------------------------------

    async def score_cards(self, player_id: str, room_id: str) -> None:
        nickname, turn = await self._validate_turn(
            room_id, player_id, GamePhase.SCORE
        )

        field = await self.redis.get_field(room_id, nickname)
        if not field:
            raise GameError("INVALID_PHASE", "場にカードがありません")

        cards = await self.redis.clear_field(room_id, nickname)
        points = sum(cards)
        total_score = await self.redis.add_score(room_id, nickname, points)

        await self.manager.broadcast(
            room_id,
            {
                "type": "cards_scored",
                "payload": CardsScoredPayload(
                    player=nickname,
                    cards=cards,
                    score=total_score,
                ).model_dump(),
            },
        )
        await self.redis.set_phase(room_id, GamePhase.DRAW)
        await self._broadcast_game_state(room_id)

    async def draw_card(self, player_id: str, room_id: str) -> None:
        # DRAW（ターン開始時）とDRAWN（もう1枚引く）どちらのフェーズでも許可
        nickname, turn = await self._validate_turn(room_id, player_id, expected_phase=None)
        if turn.phase not in (GamePhase.DRAW, GamePhase.DRAWN):
            raise GameError("INVALID_PHASE", f"現在のフェーズは '{turn.phase.value}' です")

        card = await self.redis.draw_card(room_id)
        if card is None:
            # 山札が空: ゲーム終了
            await self._end_game(room_id)
            return

        await self.redis.add_to_field(room_id, nickname, card)
        field_after = await self.redis.get_field(room_id, nickname)

        await self.manager.broadcast(
            room_id,
            {
                "type": "card_drawn",
                "payload": CardDrawnPayload(
                    player=nickname,
                    card=card,
                    field=field_after,
                ).model_dump(),
            },
        )

        # バースト判定
        if self._is_burst(field_after, card):
            await self._handle_burst(room_id, nickname)
            return

        # 山札0枚チェック（最後の1枚を引いた場合）
        deck_count = await self.redis.get_deck_count(room_id)
        if deck_count == 0:
            await self._end_game(room_id)
            return

        # 横取りチェック
        steal_targets = await self._find_steal_targets(room_id, nickname, card)
        if steal_targets:
            await self.redis.set_turn(room_id, nickname, GamePhase.STEAL, drawn_card=card)
        else:
            # 通常ドロー: ターン継続（プレイヤーがもう1枚引くかターン終了を選択）
            await self.redis.set_turn(room_id, nickname, GamePhase.DRAWN)
        await self._broadcast_game_state(room_id)

    async def steal_card(
        self,
        player_id: str,
        room_id: str,
        target_nickname: str,
        card_number: int,
    ) -> None:
        nickname, turn = await self._validate_turn(
            room_id, player_id, GamePhase.STEAL
        )

        # 引いたカードとの一致確認
        if turn.drawn_card != card_number:
            raise GameError(
                "CANNOT_STEAL",
                f"横取りできるのは引いたカード({turn.drawn_card})のみです",
            )

        # 対象プレイヤーの場に該当カードがあるか確認
        target_field = await self.redis.get_field(room_id, target_nickname)
        if card_number not in target_field:
            raise GameError(
                "CANNOT_STEAL",
                f"プレイヤー '{target_nickname}' の場にカード {card_number} がありません",
            )

        await self.redis.remove_card_from_field(room_id, target_nickname, card_number)
        await self.redis.add_score(room_id, nickname, card_number)

        await self.manager.broadcast(
            room_id,
            {
                "type": "card_stolen",
                "payload": CardStolenPayload(
                    from_player=target_nickname,
                    to_player=nickname,
                    card=card_number,
                ).model_dump(),
            },
        )
        # 横取り後: ターン継続（プレイヤーがもう1枚引くかターン終了を選択）
        await self.redis.set_turn(room_id, nickname, GamePhase.DRAWN)
        await self._broadcast_game_state(room_id)

    async def skip_steal(self, player_id: str, room_id: str) -> None:
        nickname, turn = await self._validate_turn(
            room_id, player_id, GamePhase.STEAL
        )
        # スキップ後: ターン継続（プレイヤーがもう1枚引くかターン終了を選択）
        await self.redis.set_turn(room_id, nickname, GamePhase.DRAWN)
        await self._broadcast_game_state(room_id)

    async def end_turn(self, player_id: str, room_id: str) -> None:
        nickname, _ = await self._validate_turn(room_id, player_id, GamePhase.DRAWN)
        await self._advance_turn(room_id, nickname)

    # ---------------------------------------------------------------------------
    # 内部ヘルパー
    # ---------------------------------------------------------------------------

    @staticmethod
    def _is_burst(field: list[int], drawn_card: int) -> bool:
        """バースト条件: 場が3枚以上 かつ 引いたカードと同じ数字が2枚以上（自分を含む）。"""
        return len(field) >= 3 and field.count(drawn_card) >= 2

    async def _handle_burst(self, room_id: str, nickname: str) -> None:
        lost_cards = await self.redis.clear_field(room_id, nickname)
        await self.manager.broadcast(
            room_id,
            {
                "type": "burst",
                "payload": BurstPayload(
                    player=nickname,
                    lost_cards=lost_cards,
                ).model_dump(),
            },
        )
        logger.info("Burst: room=%s player=%s lost=%s", room_id, nickname, lost_cards)

        deck_count = await self.redis.get_deck_count(room_id)
        if deck_count == 0:
            await self._end_game(room_id)
            return
        await self._advance_turn(room_id, nickname)

    async def _find_steal_targets(
        self, room_id: str, current_nickname: str, drawn_card: int
    ) -> list[str]:
        """横取り可能な対象ニックネームのリストを返す。"""
        nicknames = await self.redis.get_all_nicknames(room_id)
        targets = []
        for nickname in nicknames:
            if nickname == current_nickname:
                continue
            field = await self.redis.get_field(room_id, nickname)
            if drawn_card in field:
                targets.append(nickname)
        return targets

    async def _start_turn(self, room_id: str, nickname: str) -> None:
        field = await self.redis.get_field(room_id, nickname)
        phase = GamePhase.SCORE if field else GamePhase.DRAW
        await self.redis.set_turn(room_id, nickname, phase)

        await self.manager.broadcast(
            room_id,
            {
                "type": "turn_changed",
                "payload": TurnChangedPayload(current_player=nickname).model_dump(),
            },
        )
        await self._broadcast_game_state(room_id)

    async def _advance_turn(self, room_id: str, current_nickname: str) -> None:
        next_nickname = await self.redis.get_next_player_nickname(
            room_id, current_nickname
        )
        await self._start_turn(room_id, next_nickname)

    async def _end_game(self, room_id: str) -> None:
        await self.redis.set_room_status(room_id, RoomStatus.FINISHED)
        scores = await self.redis.get_all_scores(room_id)
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        rankings = [
            PlayerRanking(player=nick, score=score)
            for nick, score in sorted_scores
        ]
        winner = rankings[0].player if rankings else ""

        await self.manager.broadcast(
            room_id,
            {
                "type": "game_ended",
                "payload": GameEndedPayload(
                    winner=winner,
                    rankings=rankings,
                ).model_dump(),
            },
        )
        logger.info(
            "Game ended: room=%s winner=%s rankings=%s",
            room_id, winner, rankings,
        )

    async def _broadcast_game_state(self, room_id: str) -> None:
        turn = await self.redis.get_turn(room_id)
        if turn is None:
            return
        fields = await self.redis.get_all_fields(room_id)
        scores = await self.redis.get_all_scores(room_id)
        deck_count = await self.redis.get_deck_count(room_id)

        await self.manager.broadcast(
            room_id,
            {
                "type": "game_state",
                "payload": GameStatePayload(
                    fields=fields,
                    deck_count=deck_count,
                    scores=scores,
                    current_player=turn.current_nickname,
                    phase=turn.phase,
                ).model_dump(),
            },
        )

    async def _validate_turn(
        self,
        room_id: str,
        player_id: str,
        expected_phase: GamePhase | None = None,
    ) -> tuple[str, "TurnInfo"]:  # type: ignore[name-defined]
        from app.models.game import TurnInfo  # noqa: PLC0415

        room = await self.redis.get_room(room_id)
        if room is None or room.status != RoomStatus.PLAYING:
            raise GameError("GAME_NOT_STARTED", "ゲームが開始されていません")

        nickname = await self.redis.get_nickname(room_id, player_id)
        if nickname is None:
            raise GameError("NOT_YOUR_TURN", "このルームに参加していません")

        turn = await self.redis.get_turn(room_id)
        if turn is None:
            raise GameError("GAME_NOT_STARTED", "ターン情報がありません")

        if turn.current_nickname != nickname:
            raise GameError("NOT_YOUR_TURN", "あなたのターンではありません")

        if expected_phase is not None and turn.phase != expected_phase:
            raise GameError(
                "INVALID_PHASE",
                f"現在のフェーズは '{turn.phase.value}' です",
            )

        return nickname, turn
