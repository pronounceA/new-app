import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps {
  number: number;
  isNew?: boolean;       // 引いたばかりのカード（スライドインアニメーション）
  isBursting?: boolean;  // バーストするカード（消滅アニメーション）
  isStealable?: boolean; // 横取り可能なカード（pulse アニメーション）
  isHighlighted?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  number,
  isNew = false,
  isBursting = false,
  isStealable = false,
  isHighlighted = false,
  className,
}) => {
  const cardColor = number <= 5
    ? "bg-blue-900 border-blue-400 text-blue-100"
    : "bg-purple-900 border-purple-400 text-purple-100";

  return (
    <AnimatePresence>
      {!isBursting && (
        <motion.div
          layout
          initial={isNew ? { opacity: 0, y: -60, scale: 0.8 } : false}
          animate={
            isStealable
              ? {
                  opacity: 1,
                  y: 0,
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    "0 0 0px rgba(250,204,21,0)",
                    "0 0 16px rgba(250,204,21,0.8)",
                    "0 0 0px rgba(250,204,21,0)",
                  ],
                  transition: { repeat: Infinity, duration: 1.2 },
                }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={{ opacity: 0, scale: 0, rotate: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "relative flex items-center justify-center",
            "w-12 h-16 rounded-lg border-2 font-bold text-xl select-none",
            cardColor,
            isHighlighted && "ring-2 ring-yellow-400 ring-offset-1 ring-offset-background",
            className
          )}
        >
          {number}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Card;
