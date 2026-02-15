// ゲーム状態の型定義

export type GamePhase = "score" | "draw" | "drawn" | "steal" | "waiting" | "finished";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface PlayerState {
  nickname: string;
  field: number[];
  score: number;
}

export interface GameState {
  roomId: string | null;
  roomStatus: RoomStatus;
  players: Record<string, PlayerState>;
  playerOrder: string[];
  currentPlayer: string | null;
  phase: GamePhase;
  deckCount: number;
  myPlayerId: string;
  myNickname: string;
  // steal フェーズ: 自分が引いたカードの数字（横取り可否の判定に使用）
  lastDrawnCard: number | null;
  // 横取り可能なプレイヤー（player_id → card_number のマップ）
  stealableTargets: Record<string, number>;
  winner: string | null;
  rankings: { player: string; score: number }[];
}

export interface RoomInfo {
  room_id: string;
  host_nickname: string;
  player_count: number;
  max_players: number;
  status: RoomStatus;
}

export const initialGameState = (
  playerId: string,
  nickname: string
): GameState => ({
  roomId: null,
  roomStatus: "waiting",
  players: {},
  playerOrder: [],
  currentPlayer: null,
  phase: "waiting",
  deckCount: 110,
  myPlayerId: playerId,
  myNickname: nickname,
  lastDrawnCard: null,
  stealableTargets: {},
  winner: null,
  rankings: [],
});
