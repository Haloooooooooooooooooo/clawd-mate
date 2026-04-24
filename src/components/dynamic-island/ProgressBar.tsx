import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0 to 1
  className?: string;
}

export function ProgressBar({ progress, className = '' }: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div className={`h-2 rounded-full bg-white/20 overflow-hidden ${className}`}>
      <motion.div
        className="h-full rounded-full bg-[#6E9FFF]"
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress * 100}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}
