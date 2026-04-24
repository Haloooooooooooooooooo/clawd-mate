import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../../stores/taskStore';
import type { Task, SubTask } from '../../types/task';
import { pushTaskFromIsland } from '../../lib/islandBridge';

interface StructuredModeProps {
  onStart: (task: Task) => void;
  activateOnStart?: boolean;
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90];

export function StructuredMode({ onStart, activateOnStart = true }: StructuredModeProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [useCustom, setUseCustom] = useState(false);
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>(['']);

  const addTask = useTaskStore((state) => state.addTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const addSubTaskInput = () => {
    setSubTaskInputs([...subTaskInputs, '']);
  };

  const removeSubTaskInput = (index: number) => {
    if (subTaskInputs.length <= 1) return;
    setSubTaskInputs(subTaskInputs.filter((_, i) => i !== index));
  };

  const updateSubTaskInput = (index: number, value: string) => {
    const nextInputs = [...subTaskInputs];
    nextInputs[index] = value;
    setSubTaskInputs(nextInputs);
  };

  const handleStart = () => {
    if (!title.trim()) return;

    const validSubTasks = subTaskInputs
      .filter((text) => text.trim())
      .map((text, index): SubTask => ({
        id: uuidv4(),
        title: text.trim(),
        order: index,
        status: index === 0 ? 'active' : 'pending',
        duration: 0,
        startedAt: index === 0 ? new Date() : null,
        completedAt: null
      }));

    const task: Task = {
      id: uuidv4(),
      title: title.trim(),
      mode: 'structured',
      status: 'active',
      plannedDuration: duration,
      actualDuration: 0,
      startedAt: new Date(),
      completedAt: null,
      subTasks: validSubTasks,
      createdAt: new Date()
    };

    addTask(task);
    void pushTaskFromIsland({
      title: task.title,
      duration_minutes: task.plannedDuration,
      mode: task.mode,
      subtasks: validSubTasks.map((subTask) => subTask.title)
    });
    if (activateOnStart) {
      setActiveTask(task.id);
    }
    onStart(task);
    setTitle('');
    setDuration(60);
    setUseCustom(false);
    setSubTaskInputs(['']);
  };

  return (
    <motion.div
      className="flex h-full flex-col rounded-xl bg-white/10 p-4 backdrop-blur-md"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="mb-3 text-white font-medium">新建结构化任务</h3>

      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="任务名称..."
        className="mb-3 w-full rounded-lg bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
        autoFocus
      />

      <div className="mb-3">
        <span className="mb-2 block text-sm text-white/60">预设时间</span>
        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
              useCustom
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            自定义
          </button>

          {useCustom && (
            <input
              type="number"
              value={duration}
              onChange={(event) => setDuration(Math.max(1, Math.min(180, Number(event.target.value))))}
              min={1}
              max={180}
              className="w-20 rounded-lg bg-white/10 px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          )}
        </div>
      </div>

      <div className="mb-3">
        <span className="mb-2 block text-sm text-white/60">子任务</span>
        <div className="space-y-2">
          {subTaskInputs.map((input, index) => (
            <div key={index} className="flex gap-2">
              <span className="w-5 self-center text-sm text-white/40">{index + 1}.</span>
              <input
                type="text"
                value={input}
                onChange={(event) => updateSubTaskInput(index, event.target.value)}
                placeholder={`子任务 ${index + 1}...`}
                className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              {subTaskInputs.length > 1 && (
                <button
                  onClick={() => removeSubTaskInput(index)}
                  className="text-sm text-white/40 transition-colors hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addSubTaskInput}
          className="mt-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          + 添加子任务
        </button>
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
