import { useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GameBoard from "@/components/GameBoard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { type ClientEvent } from "@/types/websocket";

interface LocationState {
  playerId: string;
  nickname: string;
}

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const playerId = state?.playerId ?? localStorage.getItem("player_id") ?? "";
  const nickname = state?.nickname ?? localStorage.getItem("nickname") ?? "";

  const { gameState, isConnected, sendEvent } = useWebSocket(playerId, nickname);

  const handleSkipSteal = useCallback(() => {
    // steal フェーズをスキップ（turn_changed を待つ）
    // サーバー実装によってはタイムアウトで自動スキップされる場合もある
  }, []);

  const handleLeave = useCallback(() => {
    sendEvent({ type: "leave_room", payload: {} });
    navigate("/");
  }, [sendEvent, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900/60"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            カードゲーム
          </span>
          <Badge variant="outline" className="text-xs">
            ルーム: {roomId}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {nickname}
          </div>
          {gameState.roomStatus === "waiting" && (
            <Button
              size="sm"
              onClick={() =>
                sendEvent({ type: "create_room", payload: { nickname, max_players: 4 } })
              }
              disabled={gameState.playerOrder.length < 2}
            >
              ゲーム開始
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleLeave}>
            退出
          </Button>
        </div>
      </motion.header>

      {/* ゲームボード */}
      <main className="flex-1 p-4 overflow-hidden">
        {gameState.roomStatus === "waiting" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4"
          >
            <h2 className="text-xl font-semibold">参加待ち</h2>
            <p className="text-muted-foreground text-sm">
              {gameState.playerOrder.length} / 全員が揃ったらゲーム開始
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {gameState.playerOrder.map((player) => (
                <Badge key={player} variant="secondary">
                  {player}
                  {player === nickname && " （あなた）"}
                </Badge>
              ))}
            </div>
          </motion.div>
        ) : (
          <GameBoard
            gameState={gameState}
            sendEvent={sendEvent as (event: ClientEvent) => void}
            onSkipSteal={handleSkipSteal}
          />
        )}
      </main>
    </div>
  );
};

export default GamePage;
