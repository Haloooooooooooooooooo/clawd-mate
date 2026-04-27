import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const COLLAPSED_WIDTH = 320;
const COLLAPSED_HEIGHT = 120;
const EXPANDED_WIDTH = 460;
const EXPANDED_ISLAND_HEIGHT = 460;
const COMPOSER_WINDOW_HEIGHT = 700;

function App() {
  const [showInput, setShowInput] = useState(false);
  const [expandOnTaskStartKey, setExpandOnTaskStartKey] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'idle' | 'collapsed' | 'expanded'>('idle');
  const lastTaskSyncAtRef = useRef<Record<string, number>>({});
  const lastFocusSyncAtRef = useRef(0);
  const islandShellRef = useRef<HTMLDivElement>(null);
  
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

  const composerOpen = showInput;
  const isIslandExpanded = layoutMode === 'expanded';
  const useExpandedWindow = composerOpen || isIslandExpanded;

  useLayoutEffect(() => {
    let frameId = 0;
    
    const syncWindowSize = async () => {
      try {
        const [windowApi, dpiApi] = await Promise.all([
          import('@tauri-apps/api/window'),
          import('@tauri-apps/api/dpi')
        ]);
        const currentWindow = windowApi.getCurrentWindow();
        if (currentWindow.label !== 'main') {
          console.warn(
            '[island-window] skip-non-main',
            JSON.stringify({ label: currentWindow.label })
          );
          return;
        }

        const monitor = await windowApi.currentMonitor();
        if (!monitor) {
          console.warn('[island-window] no-monitor');
          return;
        }

        const nextWidth = useExpandedWindow ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
        const nextHeight = composerOpen
          ? COMPOSER_WINDOW_HEIGHT
          : isIslandExpanded
            ? EXPANDED_ISLAND_HEIGHT
            : COLLAPSED_HEIGHT;

        await currentWindow.setIgnoreCursorEvents(false);
        await currentWindow.setSize(new dpiApi.LogicalSize(nextWidth, nextHeight));

        const centeredX = monitor.position.x + Math.round((monitor.size.width - nextWidth) / 2);
        const nextY = monitor.position.y + 12;
        await currentWindow.setPosition(new dpiApi.LogicalPosition(centeredX, nextY));

        const actualSize = await currentWindow.outerSize();
        console.log(
          '[island-window]',
          JSON.stringify({
            layoutMode,
            composerOpen,
            useExpandedWindow,
            targetWidth: nextWidth,
            targetHeight: nextHeight,
            actualWidth: actualSize.width,
            actualHeight: actualSize.height
          })
        );

        if (useExpandedWindow) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const debugResult = await invoke<string>('debug_resize_main_window', {
              width: nextWidth,
              height: nextHeight
            });
            console.log('[island-window] debug-invoke', debugResult);
          } catch (invokeError) {
            console.warn('[island-window] debug-invoke-failed', invokeError);
          }
        }
      } catch (error) {
        console.error('[island-window] sync-failed', error);
      }
    };

    frameId = window.requestAnimationFrame(() => {
      void syncWindowSize();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [useExpandedWindow]);

  const handleTaskStart = () => {
    setShowInput(false);
    setExpandOnTaskStartKey((prev) => prev + 1);
  };

  return (
    <div className="bg-transparent overflow-visible pointer-events-none min-h-screen">
      <div
        ref={islandShellRef}
        className="relative mx-auto flex w-full flex-col items-center pt-3 px-4"
      >
        <div className="pointer-events-auto w-full flex flex-col items-center gap-4">
          <DynamicIsland
            onRequestCreate={() => setShowInput(true)}
            onLayoutModeChange={setLayoutMode}
            composerOpen={composerOpen}
            expandOnTaskStartKey={expandOnTaskStartKey}
            onRequestClose={() => setShowInput(false)}
          />

          <AnimatePresence>
            {composerOpen && (
              <motion.div
                key="task-composer"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-[460px] overflow-visible"
              >
                <div className="flex h-[500px] flex-col rounded-[24px] border border-white/10 bg-black/80 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
                  <div className="mb-4 flex items-center justify-between px-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">ClawdMate</div>
                      <div className="text-base font-semibold text-white/80">New Focus Session</div>
                    </div>
                    <button
                      onClick={() => setShowInput(false)}
                      className="group flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all hover:bg-white/10"
                    >
                      <span className="text-white/40 group-hover:text-white/80">×</span>
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    <TaskInput onTaskStart={handleTaskStart} keepCurrentActiveTask={hasActiveTask} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;
