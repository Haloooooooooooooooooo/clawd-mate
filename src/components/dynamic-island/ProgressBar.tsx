import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0 to 1
  className?: string;
}

export function ProgressBar({ progress, className = '' }: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div className={`overflow-hidden rounded-full bg-white/18 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)] ${className}`}>
      <motion.div
        className="h-full rounded-full bg-[linear-gradient(90deg,#29e6c8_0%,#3fffd5_52%,#2fd3aa_100%)] shadow-[0_0_10px_rgba(63,255,213,0.85),0_0_24px_rgba(63,255,213,0.5)]"
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress * 100}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}
