import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleMode } from './SimpleMode';
import { StructuredMode } from './StructuredMode';
import type { Task } from '../../types/task';

interface TaskInputProps {
  onTaskStart: (task: Task) => void;
  keepCurrentActiveTask?: boolean;
}

export function TaskInput({ onTaskStart, keepCurrentActiveTask = false }: TaskInputProps) {
  const [mode, setMode] = useState<'simple' | 'structured'>('simple');

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode('simple')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mode === 'simple'
              ? 'bg-white/20 text-white shadow-md'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          极简模式
        </button>
        <button
          onClick={() => setMode('structured')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mode === 'structured'
              ? 'bg-white/20 text-white shadow-md'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          结构模式
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'simple' ? (
          <motion.div
            key="simple"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1"
          >
            <SimpleMode onStart={onTaskStart} activateOnStart={!keepCurrentActiveTask} />
          </motion.div>
        ) : (
          <motion.div
            key="structured"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1"
          >
            <StructuredMode onStart={onTaskStart} activateOnStart={!keepCurrentActiveTask} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
