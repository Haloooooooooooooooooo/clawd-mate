import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { DynamicIsland } from './components/dynamic-island/DynamicIsland';
import { TaskInput } from './components/task-input/TaskInput';
import { useTaskStore } from './stores/taskStore';
import { pullTasksForIsland } from './lib/islandBridge';

const FRAME_BASE_HEIGHT = 220;
const FRAME_EXPANDED_HEIGHT = FRAME_BASE_HEIGHT * 3; // 660
const FRAME_COMPACT_HEIGHT = 420;

function App() {
  const [showInput, setShowInput] = useState(false);
  const [expandOnTaskStartKey, setExpandOnTaskStartKey] = useState(0);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const addTask = useTaskStore((state) => state.addTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);
  const hasActiveTask = useTaskStore((state) =>
    state.tasks.some((task) => task.id === activeTaskId && task.status !== 'completed')
  );

  useEffect(() => {
    let cancelled = false;

    const syncTasks = async () => {
      const incoming = await pullTasksForIsland();
      if (cancelled || incoming.length === 0) return;

      incoming.forEach((item) => {
        const title = item.title?.trim();
        const plannedDuration = Number(item.duration_minutes);
        const subtaskTitles = Array.isArray(item.subtasks)
          ? item.subtasks.filter((subtask) => typeof subtask === 'string' && subtask.trim().length > 0)
          : [];

        if (!title || !Number.isFinite(plannedDuration) || plannedDuration <= 0) {
          return;
        }

        const taskId = uuidv4();
        const storeState = useTaskStore.getState();
        const hasCurrentActive = storeState.tasks.some(
          (task) => task.id === storeState.activeTaskId && task.status === 'active'
        );
        const shouldSetAsMain = !hasCurrentActive;

        addTask({
          id: taskId,
          title,
          mode: subtaskTitles.length > 0 ? 'structured' : 'simple',
          status: 'active',
          plannedDuration,
          actualDuration: 0,
          startedAt: new Date(),
          completedAt: null,
          subTasks: subtaskTitles.map((subtaskTitle, subtaskIndex) => ({
            id: uuidv4(),
            title: subtaskTitle,
            order: subtaskIndex,
            status: subtaskIndex === 0 ? 'active' : 'pending',
            duration: 0,
            startedAt: subtaskIndex === 0 ? new Date() : null,
            completedAt: null
          })),
          createdAt: new Date()
        });

        if (shouldSetAsMain) {
          setActiveTask(taskId);
          setExpandOnTaskStartKey((value) => value + 1);
        }
      });
    };

    void syncTasks();
    const timer = window.setInterval(() => {
      void syncTasks();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTaskId, addTask, setActiveTask]);

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

  const handleIslandClose = () => {
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
          onRequestClose={handleIslandClose}
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

                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
