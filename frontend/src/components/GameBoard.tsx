import { motion, AnimatePresence } from "framer-motion";
import PlayerField from "@/components/PlayerField";
import ScoreBoard from "@/components/ScoreBoard";
import TurnIndicator from "@/components/TurnIndicator";
import ActionButtons from "@/components/ActionButtons";
import { type GameState } from "@/types/game";
import { type ClientEvent } from "@/types/websocket";

interface GameBoardProps {
  gameState: GameState;
  sendEvent: (event: ClientEvent) => void;
  onSkipSteal: () => void;
}

const GameBoard = ({
  gameState,
  sendEvent,
  onSkipSteal,
}: GameBoardProps) => {
  const {
    players,
    playerOrder,
    currentPlayer,
    phase,
    deckCount,
    myNickname,
    stealableTargets,
    lastDrawnCard,
  } = gameState;

  const isMyTurn = currentPlayer === myNickname;

  // ゲーム終了表示
  if (phase === "finished") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full gap-6"
      >
        <h2 className="text-3xl font-bold text-yellow-400">ゲーム終了！</h2>
        <p className="text-xl text-foreground">
          優勝: <span className="text-yellow-300 font-bold">{gameState.winner}</span>
        </p>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 w-80">
          <h3 className="text-sm font-semibold mb-3 text-center">最終結果</h3>
          <ol className="space-y-2">
            {gameState.rankings.map((entry, index) => (
              <li key={entry.player} className="flex justify-between items-center">
                <span className="text-sm">
                  {index + 1}位 {entry.player}
                  {entry.player === myNickname && " （あなた）"}
                </span>
                <span className="font-bold text-yellow-300">{entry.score}点</span>
              </li>
            ))}
          </ol>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* メインフィールド */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* ターン表示 */}
        <TurnIndicator
          currentPlayer={currentPlayer}
          phase={phase}
          isMyTurn={isMyTurn}
        />

        {/* プレイヤーフィールド */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {playerOrder.map((nickname) => {
              const playerState = players[nickname];
              if (!playerState) return null;

              return (
                <motion.div
                  key={nickname}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <PlayerField
                    nickname={nickname}
                    field={playerState.field}
                    score={playerState.score}
                    isCurrentPlayer={nickname === currentPlayer}
                    isMyField={nickname === myNickname}
                    stealableCardNumber={
                      phase === "steal" && nickname !== myNickname && nickname in stealableTargets
                        ? stealableTargets[nickname]
                        : null
                    }
                    lastDrawnCard={lastDrawnCard}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* アクションボタン */}
        <ActionButtons
          phase={phase}
          isMyTurn={isMyTurn}
          hasFieldCards={(players[myNickname]?.field.length ?? 0) > 0}
          sendEvent={sendEvent}
          onSkipSteal={onSkipSteal}
        />
      </div>

      {/* サイドバー（スコアボード） */}
      <div className="w-48 flex-shrink-0">
        <ScoreBoard
          players={players}
          playerOrder={playerOrder}
          currentPlayer={currentPlayer}
          deckCount={deckCount}
          myNickname={myNickname}
        />
      </div>
    </div>
  );
};

export default GameBoard;
