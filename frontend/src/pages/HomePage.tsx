import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RoomLobby from "@/components/RoomLobby";
import { useWebSocket } from "@/hooks/useWebSocket";
import { type ClientEvent } from "@/types/websocket";

// player_id はブラウザセッションで固定（localStorage で永続化）
const getOrCreatePlayerId = (): string => {
  const stored = localStorage.getItem("player_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("player_id", id);
  return id;
};

const PLAYER_ID = getOrCreatePlayerId();

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("nickname") ?? ""
  );

  const handleSendEvent = useCallback(
    (event: ClientEvent) => {
      if (event.type === "create_room" || event.type === "join_room") {
        localStorage.setItem("nickname", event.payload.nickname);
        localStorage.setItem(
          "room_id",
          event.type === "create_room" ? "" : event.payload.room_id
        );
      }
    },
    []
  );

  const { gameState, isConnected, sendEvent } = useWebSocket(PLAYER_ID, nickname);

  // room_id が確定したらゲームページへ遷移
  if (gameState.roomId) {
    navigate(`/game/${gameState.roomId}`, {
      state: { playerId: PLAYER_ID, nickname },
    });
  }

  const wrappedSendEvent = useCallback(
    (event: ClientEvent) => {
      handleSendEvent(event);
      sendEvent(event);
    },
    [handleSendEvent, sendEvent]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            だるまあつめ
          </h1>
          <p className="text-muted-foreground text-sm">
            2〜6人でプレイできるリアルタイムカードゲーム
          </p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground">
              {isConnected ? "サーバー接続済み" : "接続中..."}
            </span>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="nickname">ニックネーム</Label>
            <Input
              id="nickname"
              placeholder="ニックネームを入力"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
          </div>

          <RoomLobby
            nickname={nickname}
            sendEvent={wrappedSendEvent}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
