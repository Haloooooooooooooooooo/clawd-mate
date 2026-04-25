import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { DynamicIsland } from './components/dynamic-island/DynamicIsland';
import { TaskInput } from './components/task-input/TaskInput';
import { useTaskStore } from './stores/taskStore';
import { pullTasksForIsland } from './lib/islandBridge';

function mapBridgeSubtaskStatus(
  status: string | undefined,
  fallback: 'pending' | 'active' = 'pending'
): 'pending' | 'active' | 'completed' | 'skipped' {
  if (status === 'completed' || status === 'done') return 'completed';
  if (status === 'skipped') return 'skipped';
  if (status === 'active') return 'active';
  return fallback;
}

function mapBridgeStatus(status?: string): 'active' | 'paused' | 'completed' | 'cancelled' {
  if (status === 'paused' || status === 'completed' || status === 'cancelled') {
    return status;
  }
  return 'active';
}

function normalizeBridgeSubtasks(
  subtasks: Array<{ title: string; status: 'pending' | 'active' | 'completed' | 'skipped' }>,
  taskStatus: 'active' | 'paused' | 'completed' | 'cancelled'
): Array<{ title: string; status: 'pending' | 'active' | 'completed' | 'skipped' }> {
  if (subtasks.length === 0) return subtasks;

  const hasActive = subtasks.some((subtask) => subtask.status === 'active');
  if (hasActive || (taskStatus !== 'active' && taskStatus !== 'paused')) {
    return subtasks;
  }

  const firstPendingIndex = subtasks.findIndex((subtask) => subtask.status === 'pending');
  if (firstPendingIndex === -1) {
    return subtasks;
  }

  return subtasks.map((subtask, index) =>
    index === firstPendingIndex ? { ...subtask, status: 'active' as const } : subtask
  );
}

const FRAME_BASE_HEIGHT = 220;
const FRAME_EXPANDED_HEIGHT = FRAME_BASE_HEIGHT * 3;
const FRAME_COMPACT_HEIGHT = 420;

function App() {
  const [showInput, setShowInput] = useState(false);
  const [expandOnTaskStartKey, setExpandOnTaskStartKey] = useState(0);
  const lastTaskSyncAtRef = useRef<Record<string, number>>({});
  const lastFocusSyncAtRef = useRef(0);
  const activeTaskId = useTaskStore((state) => state.activeTaskId);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const removeTask = useTaskStore((state) => state.removeTask);
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
        const syncId = item.sync_id?.trim();
        const incomingUpdatedAt = Number.isFinite(item.updated_at_ms)
          ? Number(item.updated_at_ms)
          : Date.now();
        if (syncId) {
          const lastTaskSyncAt = lastTaskSyncAtRef.current[syncId] || 0;
          if (incomingUpdatedAt < lastTaskSyncAt) {
            return;
          }
        }
        const focused = item.focused === true;
        const status = mapBridgeStatus(item.status);
        const elapsedSeconds = Number.isFinite(item.elapsed_seconds)
          ? Math.max(0, Number(item.elapsed_seconds))
          : 0;
        const rawSubtaskPayloads = Array.isArray(item.subtasks)
          ? item.subtasks
              .map((subtask, index) => {
                if (typeof subtask === 'string') {
                  const value = subtask.trim();
                  return value ? { title: value, status: index === 0 ? 'active' : 'pending' } : null;
                }
                if (subtask && typeof subtask === 'object' && typeof subtask.title === 'string') {
                  const value = subtask.title.trim();
                  if (!value) return null;
                  return {
                    title: value,
                    status: mapBridgeSubtaskStatus(
                      typeof subtask.status === 'string' ? subtask.status : undefined,
                      index === 0 ? 'active' : 'pending'
                    )
                  };
                }
                return null;
              })
              .filter(
                (subtask): subtask is { title: string; status: 'pending' | 'active' | 'completed' | 'skipped' } =>
                  Boolean(subtask)
              )
          : [];
        const subtaskPayloads = normalizeBridgeSubtasks(rawSubtaskPayloads, status);

        if (!title || !Number.isFinite(plannedDuration) || plannedDuration <= 0) {
          return;
        }

        const storeState = useTaskStore.getState();
        const existingTask = syncId
          ? storeState.tasks.find((task) => task.syncId === syncId)
          : undefined;

        if (existingTask) {
          if (status === 'cancelled' || status === 'completed') {
            removeTask(existingTask.id);
            const remainingTasks = useTaskStore
              .getState()
              .tasks.filter((task) => task.status === 'active' || task.status === 'paused');
            if (remainingTasks.length > 0) {
              setActiveTask(remainingTasks[0].id);
            } else {
              setActiveTask(null);
            }
            if (syncId) {
              lastTaskSyncAtRef.current[syncId] = incomingUpdatedAt;
            }
            return;
          }

          updateTask(existingTask.id, {
            title,
            plannedDuration,
            actualDuration: elapsedSeconds,
            status,
            completedAt: null,
            subTasks: subtaskPayloads.map((subtask, subtaskIndex) => ({
              id: existingTask.subTasks[subtaskIndex]?.id || uuidv4(),
              title: subtask.title,
              order: subtaskIndex,
              status: subtask.status,
              duration: existingTask.subTasks[subtaskIndex]?.duration ?? 0,
              startedAt:
                subtask.status === 'active'
                  ? (existingTask.subTasks[subtaskIndex]?.startedAt ?? new Date())
                  : null,
              completedAt:
                subtask.status === 'completed' || subtask.status === 'skipped'
                  ? (existingTask.subTasks[subtaskIndex]?.completedAt ?? new Date())
                  : null
            }))
          });

          const hasCurrentActive = storeState.tasks.some(
            (task) => task.id === storeState.activeTaskId && task.status === 'active'
          );
          if (status === 'active' && !hasCurrentActive) {
            setActiveTask(existingTask.id);
          }
          if (focused && incomingUpdatedAt >= lastFocusSyncAtRef.current) {
            lastFocusSyncAtRef.current = incomingUpdatedAt;
            setActiveTask(existingTask.id);
          }
          if (syncId) {
            lastTaskSyncAtRef.current[syncId] = incomingUpdatedAt;
          }
          return;
        }

        if (status === 'cancelled' || status === 'completed') {
          if (syncId) {
            lastTaskSyncAtRef.current[syncId] = incomingUpdatedAt;
          }
          return;
        }

        const taskId = uuidv4();
        const hasCurrentActive = storeState.tasks.some(
          (task) => task.id === storeState.activeTaskId && task.status === 'active'
        );
        const canApplyFocus = focused && incomingUpdatedAt >= lastFocusSyncAtRef.current;
        const shouldSetAsMain = canApplyFocus || (status === 'active' && !hasCurrentActive);

        addTask({
          id: taskId,
          syncId: syncId || `web-${taskId}`,
          title,
          mode: subtaskPayloads.length > 0 ? 'structured' : 'simple',
          status,
          plannedDuration,
          actualDuration: elapsedSeconds,
          startedAt: status === 'active' ? new Date() : null,
          completedAt: null,
          subTasks: subtaskPayloads.map((subtask, subtaskIndex) => ({
            id: uuidv4(),
            title: subtask.title,
            order: subtaskIndex,
            status: subtask.status,
            duration: 0,
            startedAt: subtask.status === 'active' ? new Date() : null,
            completedAt:
              subtask.status === 'completed' || subtask.status === 'skipped' ? new Date() : null
          })),
          createdAt: new Date()
        });

        if (shouldSetAsMain) {
          if (canApplyFocus) {
            lastFocusSyncAtRef.current = incomingUpdatedAt;
          }
          setActiveTask(taskId);
          setExpandOnTaskStartKey((value) => value + 1);
        }
        if (syncId) {
          lastTaskSyncAtRef.current[syncId] = incomingUpdatedAt;
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
  }, [activeTaskId, addTask, removeTask, setActiveTask, updateTask]);

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
