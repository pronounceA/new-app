import { useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Card from "@/components/Card";
import { Badge } from "@/components/ui/badge";

interface PlayerFieldProps {
  nickname: string;
  field: number[];
  score: number;
  isCurrentPlayer: boolean;
  isMyField: boolean;
  // steal フェーズ: このプレイヤーのカードが横取り対象かどうか
  isStealTarget?: boolean;
  // バースト発生中（アニメーション用）
  isBursting?: boolean;
  // 直前に引いたカードの数字（新着カードのアニメーション用）
  lastDrawnCard?: number | null;
}

const PlayerField: React.FC<PlayerFieldProps> = ({
  nickname,
  field,
  score,
  isCurrentPlayer,
  isMyField,
  isStealTarget = false,
  isBursting = false,
  lastDrawnCard,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `field-${nickname}`,
    data: { targetNickname: nickname },
    disabled: !isStealTarget,
  });

  return (
    <motion.div
      layout
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 p-3 transition-colors",
        isMyField
          ? "border-blue-500 bg-blue-950/40"
          : "border-slate-600 bg-slate-900/40",
        isCurrentPlayer && "border-green-500",
        isStealTarget && "border-yellow-400 bg-yellow-950/30",
        isOver && "bg-yellow-900/50 border-yellow-300"
      )}
    >
      {/* プレイヤー情報 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {nickname}
            {isMyField && (
              <span className="text-xs text-muted-foreground ml-1">（あなた）</span>
            )}
          </span>
          {isCurrentPlayer && (
            <Badge variant="default" className="text-xs h-5">
              ターン中
            </Badge>
          )}
          {isStealTarget && (
            <Badge variant="secondary" className="text-xs h-5 text-yellow-300 border-yellow-400">
              横取り可
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {score}点
        </Badge>
      </div>

      {/* 場のカード */}
      <div className="flex flex-wrap gap-2 min-h-[72px] items-center">
        <AnimatePresence mode="popLayout">
          {field.length === 0 ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground"
            >
              場は空
            </motion.span>
          ) : (
            field.map((cardNumber, index) => (
              <Card
                key={`${nickname}-${index}-${cardNumber}`}
                number={cardNumber}
                isNew={!isBursting && index === field.length - 1 && cardNumber === lastDrawnCard}
                isBursting={isBursting}
                isStealable={isStealTarget}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ドロップゾーンのヒント */}
      {isStealTarget && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-yellow-400 mt-1"
        >
          カードをここにドロップして横取り
        </motion.p>
      )}
    </motion.div>
  );
};

export default PlayerField;
