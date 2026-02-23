import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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

          {/* ルールボタン */}
          <div className="flex justify-center mt-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  ルール
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>だるまあつめ - ルール</DialogTitle>
                  <DialogDescription>
                    2〜6人でプレイできるリアルタイムカードゲーム
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                  {/* カード構成 */}
                  <section>
                    <h3 className="font-semibold text-base mb-2">カード構成</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>数字: 1〜10</li>
                      <li>1〜5: 各13枚</li>
                      <li>6〜10: 各9枚</li>
                      <li>合計110枚</li>
                    </ul>
                  </section>

                  {/* ターン構造 */}
                  <section>
                    <h3 className="font-semibold text-base mb-2">ターンの流れ</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>
                        <strong className="text-foreground">得点化フェーズ</strong>
                        <p className="ml-5 mt-1">場にカードがある場合は必須。場のカードを得点に変換して場を空にします。</p>
                      </li>
                      <li>
                        <strong className="text-foreground">ドローフェーズ</strong>
                        <p className="ml-5 mt-1">山札から1枚引き、自分の場に置きます。</p>
                      </li>
                      <li>
                        <strong className="text-foreground">通常/バーストフェーズ</strong>
                        <div className="ml-5 mt-1 space-y-1">
                          <p><strong className="text-foreground">通常:</strong> もう1枚引くか、ターン終了するかを選択できます（横取り解決後も同様）</p>
                          <p><strong className="text-foreground">バースト:</strong> 場に4枚以上ある状態で、引いたカードの数字が場の既存カードと一致した場合、場のカードをすべて失います（得点化不可）。強制的にターン終了となります。</p>
                        </div>
                      </li>
                    </ol>
                  </section>

                  {/* 横取りシステム */}
                  <section>
                    <h3 className="font-semibold text-base mb-2">横取り</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>引いたカードの数字が別プレイヤーの場にあるカードと一致する場合、任意でそのカードを横取りできます</li>
                      <li>横取りしたカードは自分の得点に加算されます</li>
                    </ul>
                  </section>

                  {/* 勝利条件 */}
                  <section>
                    <h3 className="font-semibold text-base mb-2">勝利条件</h3>
                    <p className="text-muted-foreground">
                      山札がなくなった時点で最も得点が高いプレイヤーが勝利です。
                    </p>
                  </section>
                </div>
              </DialogContent>
            </Dialog>
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
