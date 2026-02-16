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
  // steal フェーズ: 横取り対象のカード番号（null の場合は非対象）
  stealableCardNumber?: number | null;
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
  stealableCardNumber = null,
  isBursting = false,
  lastDrawnCard,
}) => {
  const isStealTarget = stealableCardNumber != null;

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border-2 p-3 transition-colors",
        isMyField
          ? "border-blue-500 bg-blue-950/40"
          : "border-slate-600 bg-slate-900/40",
        isCurrentPlayer && "border-green-500",
        isStealTarget && "border-yellow-400 bg-yellow-950/30"
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
                isStealable={stealableCardNumber != null && cardNumber === stealableCardNumber}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PlayerField;
