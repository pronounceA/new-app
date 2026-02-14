import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DraggableCardProps {
  number: number;
  dragId: string;
}

// steal フェーズ時に自分の引いたカードをドラッグ可能にするコンポーネント
const DraggableCard: React.FC<DraggableCardProps> = ({ number, dragId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dragId, data: { cardNumber: number } });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: isDragging ? 1.15 : 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "flex items-center justify-center",
        "w-12 h-16 rounded-lg border-2 font-bold text-xl select-none cursor-grab",
        "bg-yellow-900 border-yellow-400 text-yellow-100",
        "ring-2 ring-yellow-400 ring-offset-1 ring-offset-background",
        isDragging && "z-50 cursor-grabbing opacity-80"
      )}
    >
      {number}
    </motion.div>
  );
};

export default DraggableCard;
