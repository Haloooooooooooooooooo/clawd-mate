import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../../stores/taskStore';
import type { Task } from '../../types/task';
import { pushTaskFromIsland } from '../../lib/islandBridge';
import { StartButton } from './StartButton';

interface SimpleModeProps {
  onStart: (task: Task) => void;
  activateOnStart?: boolean;
  switchToTaskOnStart?: boolean;
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90];

export function SimpleMode({
  onStart,
  activateOnStart = true,
  switchToTaskOnStart = true
}: SimpleModeProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [useCustom, setUseCustom] = useState(false);

  const addTask = useTaskStore((state) => state.addTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const handleStart = () => {
    if (!title.trim()) return;
    const syncId = uuidv4();

    const task: Task = {
      id: uuidv4(),
      syncId,
      title: title.trim(),
      mode: 'simple',
      status: activateOnStart ? 'active' : 'paused',
      plannedDuration: duration,
      actualDuration: 0,
      startedAt: activateOnStart ? new Date() : null,
      completedAt: null,
      subTasks: [],
      createdAt: new Date()
    };

    addTask(task);
    void pushTaskFromIsland({
      sync_id: syncId,
      title: task.title,
      duration_minutes: task.plannedDuration,
      mode: task.mode,
      subtasks: [],
      status: activateOnStart ? 'active' : 'paused',
      elapsed_seconds: task.actualDuration,
      updated_at_ms: Date.now()
    });
    if (switchToTaskOnStart) {
      setActiveTask(task.id);
    }
    onStart(task);
    setTitle('');
    setDuration(30);
    setUseCustom(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && title.trim()) {
      handleStart();
    }
  };

  return (
    <motion.div
      className="flex w-full flex-col rounded-xl bg-white/10 p-4 backdrop-blur-md"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="mb-3 text-white font-medium">新建任务</h3>

      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="任务名称..."
        className="island-input mb-3"
      />

      <div className="mb-4">
        <span className="mb-2 block text-sm text-white/60">预设时间</span>
        <div className="flex flex-wrap gap-2">
          {PRESET_DURATIONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setDuration(preset);
                setUseCustom(false);
              }}
              className={`preset-btn ${!useCustom && duration === preset ? 'preset-btn-active' : ''}`}
            >
              {preset}分钟
            </button>
          ))}

          {useCustom ? (
            <input
              type="number"
              value={duration}
              onChange={(event) => setDuration(Math.max(1, Math.min(180, Number(event.target.value))))}
              min={1}
              max={180}
              className="preset-input"
            />
          ) : (
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className="preset-btn"
            >
              自定义
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto flex justify-center">
        <StartButton onClick={handleStart} disabled={!title.trim()}>开始学习</StartButton>
      </div>
    </motion.div>
  );
}
