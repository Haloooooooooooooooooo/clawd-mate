import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DynamicIsland } from './components/dynamic-island/DynamicIsland';
import { TaskInput } from './components/task-input/TaskInput';
import { useTaskStore } from './stores/taskStore';

const FRAME_BASE_HEIGHT = 220;
const FRAME_EXPANDED_HEIGHT = FRAME_BASE_HEIGHT * 3; // 660
const FRAME_COMPACT_HEIGHT = 420;

function App() {
  const [showInput, setShowInput] = useState(false);
  const [expandOnTaskStartKey, setExpandOnTaskStartKey] = useState(0);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const hasActiveTask = useTaskStore((state) =>
    state.tasks.some((task) => task.id === activeTaskId && task.status !== 'completed')
  );

  const handleTaskStart = () => {
    setShowInput(false);
    setExpandOnTaskStartKey((value) => value + 1);
  };

  const handleShowInput = () => {
    setShowInput(true);
  };

  const handleCloseInput = () => {
    setShowInput(false);
  };

  const composerOpen = showInput;
  const composerHeight = hasActiveTask ? FRAME_COMPACT_HEIGHT : FRAME_EXPANDED_HEIGHT;

  return (
    <div className="min-h-screen bg-transparent overflow-visible">
      <div className="relative mx-auto flex w-full max-w-[560px] flex-col items-center pt-0 pb-6">
        <DynamicIsland
          onRequestCreate={handleShowInput}
          composerOpen={composerOpen}
          expandOnTaskStartKey={expandOnTaskStartKey}
        />

        <AnimatePresence>
          {composerOpen && (
            <motion.div
              key="task-composer"
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mt-2 w-full max-w-[420px] overflow-hidden"
            >
              <div
                className="rounded-[18px] border border-white/10 bg-black/84 p-3 shadow-[0_18px_52px_rgba(0,0,0,0.44)] backdrop-blur-2xl flex flex-col"
                style={{ height: composerHeight }}
              >
                <div className="mb-2 flex items-center justify-between px-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-white/35">ClawdMate</div>
                    <div className="text-sm text-white/62">Create Focus Task</div>
                  </div>
                  <button
                    onClick={handleCloseInput}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/15"
                  >
                    取消
                  </button>
                </div>

                <div className="flex-1 min-h-0">
                  <TaskInput onTaskStart={handleTaskStart} keepCurrentActiveTask={hasActiveTask} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
