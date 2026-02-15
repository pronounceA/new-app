import { useEffect, useRef, useCallback, useState, useReducer } from "react";
import { toast } from "sonner";
import { WebSocketService } from "@/services/websocketService";
import { type ClientEvent, type ServerEvent } from "@/types/websocket";
import {
  type GameState,
  initialGameState,
} from "@/types/game";

type GameAction =
  | { type: "ROOM_CREATED"; roomId: string }
  | { type: "PLAYER_JOINED"; roomId: string; players: string[] }
  | {
      type: "GAME_STARTED";
      players: string[];
      deckCount: number;
      firstPlayer: string;
    }
  | { type: "CARD_DRAWN"; player: string; card: number; field: number[] }
  | { type: "CARDS_SCORED"; player: string; score: number }
  | { type: "BURST"; player: string }
  | { type: "CARD_STOLEN"; fromPlayer: string; toPlayer: string; card: number }
  | { type: "TURN_CHANGED"; currentPlayer: string }
  | {
      type: "GAME_STATE";
      fields: Record<string, number[]>;
      deckCount: number;
      scores: Record<string, number>;
      currentPlayer: string;
    }
  | {
      type: "GAME_ENDED";
      winner: string;
      rankings: { player: string; score: number }[];
    };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "ROOM_CREATED":
      return { ...state, roomId: action.roomId, roomStatus: "waiting" };

    case "PLAYER_JOINED": {
      const players: Record<string, { nickname: string; field: number[]; score: number }> = {};
      action.players.forEach((nickname) => {
        players[nickname] = {
          nickname,
          field: state.players[nickname]?.field ?? [],
          score: state.players[nickname]?.score ?? 0,
        };
      });
      return { ...state, roomId: action.roomId, roomStatus: "waiting", players, playerOrder: action.players };
    }

    case "GAME_STARTED": {
      const players: Record<string, { nickname: string; field: number[]; score: number }> = {};
      action.players.forEach((nickname) => {
        players[nickname] = { nickname, field: [], score: 0 };
      });
      return {
        ...state,
        players,
        playerOrder: action.players,
        currentPlayer: action.firstPlayer,
        deckCount: action.deckCount,
        roomStatus: "playing",
        phase: action.firstPlayer === state.myNickname ? "score" : "waiting",
      };
    }

    case "CARD_DRAWN": {
      const updatedPlayers = {
        ...state.players,
        [action.player]: {
          ...state.players[action.player],
          field: action.field,
        },
      };
      // 横取り可能かチェック（自分のターンの場合）
      let stealableTargets: Record<string, number> = {};
      let phase = state.phase;
      if (action.player === state.myNickname) {
        Object.entries(updatedPlayers).forEach(([nickname, playerState]) => {
          if (
            nickname !== state.myNickname &&
            playerState.field.includes(action.card)
          ) {
            stealableTargets[nickname] = action.card;
          }
        });
        phase =
          Object.keys(stealableTargets).length > 0 ? "steal" : "waiting";
      }
      return {
        ...state,
        players: updatedPlayers,
        lastDrawnCard: action.player === state.myNickname ? action.card : state.lastDrawnCard,
        stealableTargets,
        phase,
      };
    }

    case "CARDS_SCORED": {
      return {
        ...state,
        players: {
          ...state.players,
          [action.player]: {
            ...state.players[action.player],
            field: [],
            score: (state.players[action.player]?.score ?? 0) + action.score,
          },
        },
        phase:
          action.player === state.myNickname && state.currentPlayer === state.myNickname
            ? "draw"
            : state.phase,
      };
    }

    case "BURST":
      return {
        ...state,
        players: {
          ...state.players,
          [action.player]: {
            ...state.players[action.player],
            field: [],
          },
        },
      };

    case "CARD_STOLEN": {
      const fromField = (state.players[action.fromPlayer]?.field ?? []).filter(
        (c) => c !== action.card
      );
      return {
        ...state,
        players: {
          ...state.players,
          [action.fromPlayer]: {
            ...state.players[action.fromPlayer],
            field: fromField,
          },
          [action.toPlayer]: {
            ...state.players[action.toPlayer],
            score:
              (state.players[action.toPlayer]?.score ?? 0) + action.card,
          },
        },
        stealableTargets: {},
        phase: state.phase === "steal" ? "waiting" : state.phase,
      };
    }

    case "TURN_CHANGED":
      return {
        ...state,
        currentPlayer: action.currentPlayer,
        lastDrawnCard: null,
        stealableTargets: {},
        phase:
          action.currentPlayer === state.myNickname
            ? state.players[state.myNickname]?.field.length ?? 0 > 0
              ? "score"
              : "draw"
            : "waiting",
      };

    case "GAME_STATE": {
      const updatedPlayers = { ...state.players };
      Object.entries(action.fields).forEach(([nickname, field]) => {
        updatedPlayers[nickname] = {
          ...updatedPlayers[nickname],
          nickname,
          field,
          score: action.scores[nickname] ?? 0,
        };
      });
      return {
        ...state,
        players: updatedPlayers,
        deckCount: action.deckCount,
        currentPlayer: action.currentPlayer,
      };
    }

    case "GAME_ENDED":
      return {
        ...state,
        roomStatus: "finished",
        phase: "finished",
        winner: action.winner,
        rankings: action.rankings,
      };

    default:
      return state;
  }
};

interface UseWebSocketReturn {
  gameState: GameState;
  isConnected: boolean;
  sendEvent: (event: ClientEvent) => void;
}

export const useWebSocket = (
  playerId: string,
  nickname: string
): UseWebSocketReturn => {
  const wsUrl = `${import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws"}/${playerId}`;
  const serviceRef = useRef<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, dispatch] = useReducer(
    gameReducer,
    initialGameState(playerId, nickname)
  );

  useEffect(() => {
    const service = new WebSocketService(wsUrl);
    serviceRef.current = service;

    const unsubConnect = service.onConnect(() => setIsConnected(true));
    const unsubDisconnect = service.onDisconnect(() => setIsConnected(false));

    const unsubEvent = service.onEvent((event: ServerEvent) => {
      switch (event.type) {
        case "room_created":
          dispatch({ type: "ROOM_CREATED", roomId: event.payload.room_id });
          toast.success(`ルーム ${event.payload.room_id} を作成しました`);
          break;

        case "player_joined":
          dispatch({ type: "PLAYER_JOINED", roomId: event.payload.room_id, players: event.payload.players });
          if (event.payload.nickname !== nickname) {
            toast.info(`${event.payload.nickname} が参加しました`);
          }
          break;

        case "game_started":
          dispatch({
            type: "GAME_STARTED",
            players: event.payload.players,
            deckCount: event.payload.deck_count,
            firstPlayer: event.payload.first_player,
          });
          toast.success("ゲーム開始！");
          break;

        case "card_drawn":
          dispatch({
            type: "CARD_DRAWN",
            player: event.payload.player,
            card: event.payload.card,
            field: event.payload.field,
          });
          break;

        case "cards_scored":
          dispatch({
            type: "CARDS_SCORED",
            player: event.payload.player,
            score: event.payload.score,
          });
          if (event.payload.player !== nickname) {
            toast.info(
              `${event.payload.player} が ${event.payload.score}点 獲得！`
            );
          }
          break;

        case "burst":
          dispatch({ type: "BURST", player: event.payload.player });
          toast.error(`${event.payload.player} がバースト！`);
          break;

        case "card_stolen":
          dispatch({
            type: "CARD_STOLEN",
            fromPlayer: event.payload.from_player,
            toPlayer: event.payload.to_player,
            card: event.payload.card,
          });
          toast.warning(
            `${event.payload.to_player} が ${event.payload.from_player} から ${event.payload.card} を横取り！`
          );
          break;

        case "turn_changed":
          dispatch({
            type: "TURN_CHANGED",
            currentPlayer: event.payload.current_player,
          });
          if (event.payload.current_player === nickname) {
            toast.info("あなたのターンです");
          }
          break;

        case "game_state":
          dispatch({
            type: "GAME_STATE",
            fields: event.payload.fields,
            deckCount: event.payload.deck_count,
            scores: event.payload.scores,
            currentPlayer: event.payload.current_player,
          });
          break;

        case "game_ended":
          dispatch({
            type: "GAME_ENDED",
            winner: event.payload.winner,
            rankings: event.payload.rankings,
          });
          toast.success(`ゲーム終了！優勝: ${event.payload.winner}`);
          break;

        case "error":
          toast.error(event.payload.message);
          break;
      }
    });

    service.connect();

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubEvent();
      service.disconnect();
    };
  }, [wsUrl, nickname]);

  const sendEvent = useCallback((event: ClientEvent) => {
    serviceRef.current?.send(event);
  }, []);

  return { gameState, isConnected, sendEvent };
};
