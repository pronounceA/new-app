import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { type GamePhase } from "@/types/game";
import { type ClientEvent } from "@/types/websocket";

interface ActionButtonsProps {
  phase: GamePhase;
  isMyTurn: boolean;
  hasFieldCards: boolean;
  sendEvent: (event: ClientEvent) => void;
  onSkipSteal?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  phase,
  isMyTurn,
  sendEvent,
  onSkipSteal,
}) => {
  if (!isMyTurn || phase === "waiting" || phase === "finished") {
    return null;
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex gap-3 justify-center"
    >
      {phase === "score" && (
        <Button
          onClick={() => sendEvent({ type: "score_cards", payload: {} })}
          className="bg-green-600 hover:bg-green-500"
        >
          得点化する
        </Button>
      )}

      {phase === "draw" && (
        <Button
          onClick={() => sendEvent({ type: "draw_card", payload: {} })}
          className="bg-blue-600 hover:bg-blue-500"
        >
          カードを引く
        </Button>
      )}

      {phase === "drawn" && (
        <>
          <Button
            onClick={() => sendEvent({ type: "draw_card", payload: {} })}
            className="bg-blue-600 hover:bg-blue-500"
          >
            もう1枚引く
          </Button>
          <Button
            variant="outline"
            onClick={() => sendEvent({ type: "end_turn", payload: {} })}
          >
            ターン終了
          </Button>
        </>
      )}

      {phase === "steal" && (
        <>
          <p className="text-sm text-yellow-400 self-center">
            カードをドラッグして横取り、またはスキップ
          </p>
          <Button
            variant="outline"
            onClick={onSkipSteal}
          >
            スキップ
          </Button>
        </>
      )}
    </motion.div>
  );
};

export default ActionButtons;
