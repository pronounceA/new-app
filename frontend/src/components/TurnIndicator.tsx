import { motion, AnimatePresence } from "framer-motion";
import { type GamePhase } from "@/types/game";

interface TurnIndicatorProps {
  currentPlayer: string | null;
  phase: GamePhase;
  isMyTurn: boolean;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  score: "得点化してください",
  draw: "カードを引いてください",
  steal: "横取りを選択（任意）",
  waiting: "相手のターン",
  finished: "ゲーム終了",
};

const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  currentPlayer,
  phase,
  isMyTurn,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${currentPlayer}-${phase}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.25 }}
        className="text-center"
      >
        <p className="text-sm text-muted-foreground">
          {currentPlayer ? `${currentPlayer} のターン` : "待機中..."}
        </p>
        <p
          className={
            isMyTurn
              ? "text-base font-semibold text-green-400"
              : "text-base font-semibold text-slate-400"
          }
        >
          {PHASE_LABELS[phase]}
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default TurnIndicator;
