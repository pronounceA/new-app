import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { type ClientEvent } from "@/types/websocket";

type Mode = "create" | "join" | null;

interface RoomLobbyProps {
  nickname: string;
  sendEvent: (event: ClientEvent) => void;
}

const RoomLobby: React.FC<RoomLobbyProps> = ({ nickname, sendEvent }) => {
  const [mode, setMode] = useState<Mode>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomId, setRoomId] = useState("");

  const handleCreate = (): void => {
    if (!nickname.trim()) return;
    sendEvent({
      type: "create_room",
      payload: { nickname: nickname.trim(), max_players: maxPlayers },
    });
    setMode(null);
  };

  const handleJoin = (): void => {
    if (!nickname.trim() || !roomId.trim()) return;
    sendEvent({
      type: "join_room",
      payload: { room_id: roomId.trim(), nickname: nickname.trim() },
    });
    setMode(null);
  };

  return (
    <>
      <div className="flex gap-3">
        <Button onClick={() => setMode("create")}>ルームを作成</Button>
        <Button variant="outline" onClick={() => setMode("join")}>
          ルームに参加
        </Button>
      </div>

      {/* ルーム作成ダイアログ */}
      <Dialog open={mode === "create"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ルームを作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ニックネーム</Label>
              <Input value={nickname} disabled className="opacity-70" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-players">最大人数（2〜6人）</Label>
              <Input
                id="max-players"
                type="number"
                min={2}
                max={6}
                value={maxPlayers}
                onChange={(e) =>
                  setMaxPlayers(Math.min(6, Math.max(2, Number(e.target.value))))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={!nickname.trim()}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ルーム参加ダイアログ */}
      <Dialog open={mode === "join"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ルームに参加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ニックネーム</Label>
              <Input value={nickname} disabled className="opacity-70" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-id">ルームID</Label>
              <Input
                id="room-id"
                placeholder="ルームIDを入力"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              キャンセル
            </Button>
            <Button onClick={handleJoin} disabled={!nickname.trim() || !roomId.trim()}>
              参加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RoomLobby;
