import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../../stores/taskStore';
import type { Task } from '../../types/task';
import { pushTaskFromIsland } from '../../lib/islandBridge';

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

    const task: Task = {
      id: uuidv4(),
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
      title: task.title,
      duration_minutes: task.plannedDuration,
      mode: task.mode,
      subtasks: []
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
      className="flex h-full flex-col rounded-xl bg-white/10 p-4 backdrop-blur-md"
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
        className="mb-3 w-full rounded-lg bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
        autoFocus
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
              className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                !useCustom && duration === preset
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
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
              className="w-20 rounded-lg bg-blue-500 px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 transition-all hover:bg-white/20"
            >
              自定义
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={handleStart}
          disabled={!title.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 py-2.5 font-medium text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:from-blue-600 hover:to-purple-600"
        >
          开始学习 🦀
        </button>
      </div>
    </motion.div>
  );
}
