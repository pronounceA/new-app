from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

CARD_DISTRIBUTION: dict[int, int] = {
    1: 13, 2: 13, 3: 13, 4: 13, 5: 13,
    6: 9,  7: 9,  8: 9,  9: 9, 10: 9,
}  # 合計110枚

MAX_PLAYERS = 6
MIN_PLAYERS = 2
ROOM_TTL = 10800  # 3時間（秒）


# ---------------------------------------------------------------------------
# Enum
# ---------------------------------------------------------------------------

class RoomStatus(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"


class GamePhase(str, Enum):
    SCORE = "score"
    DRAW = "draw"
    DRAWN = "drawn"  # カードを引いた後（もう1枚引くかターン終了を選択）
    STEAL = "steal"


# ---------------------------------------------------------------------------
# カスタム例外
# ---------------------------------------------------------------------------

class GameError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# クライアント → サーバー ペイロード
# ---------------------------------------------------------------------------

class CreateRoomPayload(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    max_players: int = Field(ge=MIN_PLAYERS, le=MAX_PLAYERS)


class JoinRoomPayload(BaseModel):
    room_id: str
    nickname: str = Field(min_length=1, max_length=20)


class StartGamePayload(BaseModel):
    pass


class ScoreCardsPayload(BaseModel):
    pass


class DrawCardPayload(BaseModel):
    pass


class StealCardPayload(BaseModel):
    pass  # ペイロードなし（サーバーがturn.drawn_cardを把握）


class SkipStealPayload(BaseModel):
    pass


class LeaveRoomPayload(BaseModel):
    pass


# ---------------------------------------------------------------------------
# サーバー → クライアント ペイロード
# ---------------------------------------------------------------------------

class RoomCreatedPayload(BaseModel):
    room_id: str


class PlayerJoinedPayload(BaseModel):
    room_id: str
    nickname: str
    player_count: int
    max_players: int
    host_nickname: str
    players: list[str]  # nicknames


class GameStartedPayload(BaseModel):
    players: list[str]  # nicknames（ターン順）
    deck_count: int
    first_player: str   # nickname


class CardDrawnPayload(BaseModel):
    player: str         # nickname
    card: int
    field: list[int]    # 引いた後の場の状態


class CardsScoredPayload(BaseModel):
    player: str         # nickname
    cards: list[int]    # 得点化されたカード
    score: int          # 得点化後の累計スコア


class BurstPayload(BaseModel):
    player: str         # nickname
    lost_cards: list[int]


class CardStolenPayload(BaseModel):
    from_player: str    # nickname（横取りされた側）
    to_player: str      # nickname（横取りした側）
    card: int


class TurnChangedPayload(BaseModel):
    current_player: str  # nickname


class GameStatePayload(BaseModel):
    fields: dict[str, list[int]]  # nickname → カードリスト
    deck_count: int
    scores: dict[str, int]        # nickname → スコア
    current_player: str           # nickname
    phase: GamePhase


class PlayerRanking(BaseModel):
    player: str
    score: int


class GameEndedPayload(BaseModel):
    winner: str
    rankings: list[PlayerRanking]


class ErrorPayload(BaseModel):
    message: str
    code: str


# ---------------------------------------------------------------------------
# 内部型
# ---------------------------------------------------------------------------

class RoomInfo(BaseModel):
    room_id: str
    status: RoomStatus
    max_players: int
    host_player_id: str


class TurnInfo(BaseModel):
    current_nickname: str
    phase: GamePhase
    drawn_card: int | None = None  # stealフェーズ中の引いたカード番号
