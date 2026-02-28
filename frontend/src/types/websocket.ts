import type { GamePhase } from "@/types/game";

// クライアント → サーバー イベント

export type ClientEvent =
  | { type: "create_room"; payload: { nickname: string; max_players: number } }
  | { type: "join_room"; payload: { room_id: string; nickname: string } }
  | { type: "start_game"; payload: Record<string, never> }
  | { type: "score_cards"; payload: Record<string, never> }
  | { type: "draw_card"; payload: Record<string, never> }
  | { type: "steal_card"; payload: Record<string, never> }
  | { type: "skip_steal"; payload: Record<string, never> }
  | { type: "confirm_burst"; payload: Record<string, never> }
  | { type: "end_turn"; payload: Record<string, never> }
  | { type: "leave_room"; payload: Record<string, never> };

// サーバー → クライアント イベント

export type ServerEvent =
  | { type: "room_created"; payload: { room_id: string } }
  | {
      type: "player_joined";
      payload: {
        room_id: string;
        nickname: string;
        player_count: number;
        max_players: number;
        host_nickname: string;
        players: string[];
      };
    }
  | {
      type: "game_started";
      payload: {
        players: string[];
        deck_count: number;
        first_player: string;
      };
    }
  | {
      type: "card_drawn";
      payload: {
        player: string;
        card: number;
        field: number[];
      };
    }
  | {
      type: "cards_scored";
      payload: {
        player: string;
        cards: number[];
        score: number;
      };
    }
  | {
      type: "burst";
      payload: {
        player: string;
        lost_cards: number[];
      };
    }
  | {
      type: "card_stolen";
      payload: {
        from_player: string;
        to_player: string;
        card: number;
        count: number;
      };
    }
  | {
      type: "turn_changed";
      payload: {
        current_player: string;
      };
    }
  | {
      type: "game_state";
      payload: {
        fields: Record<string, number[]>;
        deck_count: number;
        scores: Record<string, number>;
        current_player: string;
        phase: GamePhase;
      };
    }
  | {
      type: "game_ended";
      payload: {
        winner: string;
        rankings: { player: string; score: number }[];
      };
    }
  | {
      type: "error";
      payload: {
        message: string;
        code: ErrorCode;
      };
    };

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_NOT_STARTED"
  | "NOT_YOUR_TURN"
  | "INVALID_PHASE"
  | "CANNOT_STEAL"
  | "ALREADY_IN_ROOM";
