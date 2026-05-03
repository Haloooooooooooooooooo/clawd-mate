import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../../stores/taskStore';
import type { Task, SubTask } from '../../types/task';
import { pushTaskFromIsland } from '../../lib/islandBridge';
import { StartButton } from './StartButton';

interface StructuredModeProps {
  onStart: (task: Task) => void;
  activateOnStart?: boolean;
  switchToTaskOnStart?: boolean;
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90];

export function StructuredMode({
  onStart,
  activateOnStart = true,
  switchToTaskOnStart = true
}: StructuredModeProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [useCustom, setUseCustom] = useState(false);
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>(['']);
  const subTaskInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const addTask = useTaskStore((state) => state.addTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const addSubTaskInput = () => {
    setSubTaskInputs([...subTaskInputs, '']);
  };

  const removeSubTaskInput = (index: number) => {
    if (subTaskInputs.length <= 1) return;
    setSubTaskInputs(subTaskInputs.filter((_, i) => i !== index));
    subTaskInputRefs.current = subTaskInputRefs.current.filter((_, i) => i !== index);
  };

  const updateSubTaskInput = (index: number, value: string) => {
    const nextInputs = [...subTaskInputs];
    nextInputs[index] = value;
    setSubTaskInputs(nextInputs);
  };

  const focusSubTaskInput = (index: number) => {
    window.requestAnimationFrame(() => {
      subTaskInputRefs.current[index]?.focus();
    });
  };

  const handleSubTaskEnter = (index: number) => {
    if (!subTaskInputs[index]?.trim()) return;

    const nextIndex = index + 1;
    if (nextIndex < subTaskInputs.length) {
      focusSubTaskInput(nextIndex);
      return;
    }

    setSubTaskInputs((prev) => [...prev, '']);
    focusSubTaskInput(nextIndex);
  };

  const handleStart = () => {
    if (!title.trim()) return;
    const syncId = uuidv4();

    const validSubTasks = subTaskInputs
      .filter((text) => text.trim())
      .map((text, index): SubTask => ({
        id: uuidv4(),
        title: text.trim(),
        order: index,
        status: activateOnStart && index === 0 ? 'active' : 'pending',
        duration: 0,
        startedAt: activateOnStart && index === 0 ? new Date() : null,
        completedAt: null
      }));

    const task: Task = {
      id: uuidv4(),
      syncId,
      title: title.trim(),
      mode: 'structured',
      status: activateOnStart ? 'active' : 'paused',
      plannedDuration: duration,
      actualDuration: 0,
      startedAt: activateOnStart ? new Date() : null,
      completedAt: null,
      subTasks: validSubTasks,
      createdAt: new Date()
    };

    addTask(task);
    void pushTaskFromIsland({
      sync_id: syncId,
      title: task.title,
      duration_minutes: task.plannedDuration,
      mode: task.mode,
      subtasks: validSubTasks.map((subTask) => ({
        title: subTask.title,
        status: subTask.status
      })),
      status: activateOnStart ? 'active' : 'paused',
      elapsed_seconds: task.actualDuration,
      updated_at_ms: Date.now()
    });
    if (switchToTaskOnStart) {
      setActiveTask(task.id);
    }
    onStart(task);
    setTitle('');
    setDuration(60);
    setUseCustom(false);
    setSubTaskInputs(['']);
    subTaskInputRefs.current = [];
  };

  return (
    <motion.div
      className="flex w-full flex-col rounded-xl bg-white/10 p-4 backdrop-blur-md"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="mb-3 text-white font-medium">新建结构化任务</h3>

      <div className="pr-1">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="任务名称..."
          className="island-input mb-3"
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
              <button type="button" onClick={() => setUseCustom(true)} className="preset-btn">
                自定义
              </button>
            )}
          </div>
        </div>

        <div className="mb-3">
          <span className="mb-2 block text-sm text-white/60">子任务</span>
          <div className="space-y-2 pr-1">
            {subTaskInputs.map((input, index) => (
              <div key={index} className="flex gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md border border-white/25 bg-white/10 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <input
                  ref={(element) => {
                    subTaskInputRefs.current[index] = element;
                  }}
                  type="text"
                  value={input}
                  onChange={(event) => updateSubTaskInput(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    handleSubTaskEnter(index);
                  }}
                  placeholder={`子任务 ${index + 1}...`}
                  className="island-input flex-1 !py-1.5 text-sm"
                />
                {subTaskInputs.length > 1 && (
                  <button
                    onClick={() => removeSubTaskInput(index)}
                    className="text-sm text-white/40 transition-colors hover:text-red-400"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addSubTaskInput} className="mt-2 text-sm text-white/50 transition-colors hover:text-white">
            + 添加子任务
          </button>
        </div>
      </div>

      <div className="mt-2 flex justify-center border-t border-white/10 pt-3">
        <StartButton onClick={handleStart} disabled={!title.trim() || !subTaskInputs.some((s) => s.trim())}>
          开始学习
        </StartButton>
      </div>
    </motion.div>
  );
}

