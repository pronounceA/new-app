import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { type PlayerState } from "@/types/game";

interface ScoreBoardProps {
  players: Record<string, PlayerState>;
  playerOrder: string[];
  currentPlayer: string | null;
  deckCount: number;
  myNickname: string;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({
  players,
  playerOrder,
  currentPlayer,
  deckCount,
  myNickname,
}) => {
  const sorted = [...playerOrder].sort(
    (a, b) => (players[b]?.score ?? 0) - (players[a]?.score ?? 0)
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">スコア</h3>
        <Badge variant="outline" className="text-xs">
          山札: {deckCount}枚
        </Badge>
      </div>

      <ul className="space-y-1.5">
        {sorted.map((nickname, rank) => (
          <motion.li
            key={nickname}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center justify-between rounded-md px-2 py-1 bg-slate-800/60"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">
                {rank + 1}.
              </span>
              <span className="text-sm font-medium">
                {nickname}
              </span>
              {nickname === currentPlayer && (
                <Badge variant="default" className="text-xs h-4 px-1">
                  ▶
                </Badge>
              )}
            </div>
            <motion.span
              key={players[nickname]?.score ?? 0}
              initial={{ scale: 1.3, color: "#fbbf24" }}
              animate={{ scale: 1, color: "#f1f5f9" }}
              transition={{ duration: 0.4 }}
              className="text-sm font-bold"
            >
              {players[nickname]?.score ?? 0}点
            </motion.span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

export default ScoreBoard;
