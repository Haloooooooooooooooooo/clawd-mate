/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getLocalDateKey } from '../lib/date';
import { getDailyReportEligibility } from '../lib/dailyReportGeneration';
import { normalizeHistorySubtasks } from '../lib/history';
import { getTaskActualDurationSeconds } from '../lib/taskTime';
import { Plus, Play, Pause, CheckCircle2, X, ChevronRight, SkipForward, Menu } from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { motion } from 'motion/react';
import { PetSprite, type PetStatus } from '@pet';

type DashboardSubtask = {
  id: string;
  title: string;
  status: 'pending' | 'done' | 'skipped';
};

function normalizeSubtasks(input: unknown): DashboardSubtask[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (typeof item === 'string') {
        const title = item.trim();
        if (!title) return null;
        return {
          id: `legacy-subtask-${index}`,
          title,
          status: 'pending' as const
        };
      }
      if (item && typeof item === 'object') {
        const maybe = item as { id?: unknown; title?: unknown; status?: unknown };
        const title = typeof maybe.title === 'string' ? maybe.title.trim() : '';
        if (!title) return null;
        const status =
          maybe.status === 'done' || maybe.status === 'skipped' || maybe.status === 'pending'
            ? maybe.status
            : 'pending';
        const id = typeof maybe.id === 'string' && maybe.id.trim().length > 0 ? maybe.id : `legacy-subtask-${index}`;
        return { id, title, status };
      }
      return null;
    })
    .filter((item): item is DashboardSubtask => Boolean(item));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    tasks,
    activeTaskId,
    addTask,
    completeTask,
    cancelTask,
    toggleSubtask,
    skipSubtask,
    history,
    addTimeToTask,
    setActiveTask,
    isLoggedIn,
    user,
    getDailyReportGenerationCount,
    openLoginModal,
    showToast,
    recentCelebrationAt
  } = useStore();
  const [taskTitle, setTaskTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<'minimal' | 'structured'>('minimal');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [celebrateTrigger, setCelebrateTrigger] = useState(false);
  const parallelTasksRef = useRef<HTMLDivElement>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const celebrateTimeoutRef = useRef<number | null>(null);

  const getTaskRemaining = (task: { status: string; startTime: number; remainingTime: number }) => {
    if (task.status !== 'running') return Math.max(0, task.remainingTime);
    const elapsedSinceResume = Math.max(0, Math.floor((nowTick - task.startTime) / 1000));
    return Math.max(0, task.remainingTime - elapsedSinceResume);
  };

  const getTaskElapsed = (task: { totalDuration: number; status: string; startTime: number; remainingTime: number }) =>
    Math.max(0, task.totalDuration - getTaskRemaining(task));

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'paused');
  const focusedTaskIndex = activeTasks.findIndex((task) => task.id === activeTaskId);
  const currentTask = focusedTaskIndex >= 0 ? activeTasks[focusedTaskIndex] : activeTasks[0];
  const currentTaskSubtasks = normalizeSubtasks(currentTask?.subtasks);
  const currentTaskId = currentTask?.id ?? null;
  const currentTaskRemaining = currentTask ? getTaskRemaining(currentTask) : 0;
  const currentTaskElapsed = currentTask ? getTaskElapsed(currentTask) : 0;
  const isFinished = Boolean(currentTask) && currentTaskRemaining <= 0;
  const currentTaskProgressRatio = currentTask ? Math.min(1, Math.max(0, currentTaskElapsed / Math.max(1, currentTask.totalDuration))) : 0;
  const progressSegmentCount = 12;
  const completedProgressSegments = Math.min(progressSegmentCount, Math.floor(currentTaskProgressRatio * progressSegmentCount));
  const tipProgressIndex = currentTask && !isFinished
    ? Math.min(progressSegmentCount - 1, completedProgressSegments)
    : -1;
  const hasAnyOvertime = activeTasks.some((task) => getTaskRemaining(task) <= 0);
  const hasAnyRunning = activeTasks.some((task) => task.status === 'running');
  const dashboardPetStatus: PetStatus =
    celebrateTrigger
      ? 'celebrate'
      : activeTasks.length === 0
        ? 'idle'
        : hasAnyOvertime
          ? 'alert'
          : hasAnyRunning
            ? 'working'
            : 'idle';
  const dashboardPetScaleMultiplier = dashboardPetStatus === 'working' ? 2.45 : 1.95;
  const currentHour = new Date(nowTick).getHours();
  const greeting = currentHour < 12 ? '早上好' : currentHour < 18 ? '下午好' : '晚上好';
  const greetingText = user?.name?.trim() ? `${greeting}，${user.name.trim()}` : greeting;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recentCelebrationAt) return;

    setCelebrateTrigger(true);
    if (celebrateTimeoutRef.current) {
      window.clearTimeout(celebrateTimeoutRef.current);
    }
    celebrateTimeoutRef.current = window.setTimeout(() => {
      setCelebrateTrigger(false);
      celebrateTimeoutRef.current = null;
    }, 3200);

    return () => {
      if (celebrateTimeoutRef.current) {
        window.clearTimeout(celebrateTimeoutRef.current);
      }
    };
  }, [recentCelebrationAt]);

  // Auto-scroll to finished task
  useEffect(() => {
    const finishedTask = activeTasks.find((task) => getTaskRemaining(task) <= 0 && task.id !== currentTaskId);
    if (finishedTask) {
      const element = document.getElementById(`task-preview-${finishedTask.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeTasks, currentTaskId, nowTick]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Create a ghost image if needed, or just let default handle
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) {
      setDragOverIndex(null);
      return;
    }
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSubtasks = [...subtasks];
    const item = newSubtasks.splice(draggedIndex, 1)[0];
    newSubtasks.splice(index, 0, item);

    setSubtasks(newSubtasks);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleAddTask = () => {
    if (!taskTitle.trim()) return;
    addTask(taskTitle, duration, mode === 'structured' ? subtasks : []);
    setTaskTitle('');
    setSubtasks([]);
    setSubtaskInput('');
  };

  const addSubtask = () => {
    if (subtaskInput.trim() && subtasks.length < 5) {
      setSubtasks([...subtasks, subtaskInput.trim()]);
      setSubtaskInput('');
    }
  };

  // Today's Stats
  const today = getLocalDateKey(new Date());
  const todayHistory = history.find(h => h.date === today)?.tasks || [];

  // Auto-scroll to newly added history
  useEffect(() => {
    if (todayHistory.length > 0 && highlightTaskId) {
      const element = document.getElementById(`history-item-${highlightTaskId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [todayHistory.length, highlightTaskId]);
  const completedCount = todayHistory.filter(t => t.status === 'done').length;
  const cancelledCount = todayHistory.filter(t => t.status === 'cancelled').length;
  const totalFocusTime = todayHistory.reduce((acc, t) => acc + (t.status === 'done' ? getTaskActualDurationSeconds(t) : 0), 0);
  const todayRecord = history.find(h => h.date === today);

  const handleOpenDailyReport = () => {
    const eligibility = getDailyReportEligibility({
      record: todayRecord,
      isLoggedIn,
      userId: user?.id,
      generationCount: getDailyReportGenerationCount(today, user?.id)
    });

    if (!eligibility.ok) {
      showToast(eligibility.message);
      if (eligibility.reason === 'login_required') {
        openLoginModal();
      }
      return;
    }

    navigate(`/app/report?date=${today}&autogen=1`);
  };

  return (
    <div className="flex min-h-screen bg-main-bg">
      <div className="flex min-h-screen w-full">
        <div className="flex min-h-screen w-full">
          <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8 xl:px-14 xl:py-10">
            <div className="mx-auto w-full max-w-[1120px]">
              <section className="min-w-0 pr-8 xl:pr-12">
              <div className="space-y-10 xl:space-y-12">
          <header className="mb-2 flex items-start gap-2 xl:gap-4">
            <div className="-ml-4 -mt-3 flex h-[212px] w-[212px] shrink-0 items-center justify-center">
              <PetSprite status={dashboardPetStatus} size="lg" scaleMultiplier={3.05} />
            </div>
            <div className="min-w-0 flex-1 pt-4">
              <h2 className="font-display text-[54px] font-bold leading-[0.95] tracking-[0.02em] text-ink xl:text-[66px]">
                {greetingText}
              </h2>
              <div className="mt-6 flex items-center">
                <div className="flex gap-[6px]">
                  <span className="block h-[4px] w-[64px] bg-primary" />
                  <span className="block h-[4px] w-[32px] bg-[color:var(--color-o2)]" />
                  <span className="block h-[4px] w-[96px] bg-border-main" />
                  <span className="block h-[4px] w-[48px] bg-warm-paper" />
                </div>
              </div>
              <p className="mt-5 text-[18px] font-medium italic tracking-[0.01em] text-muted-text xl:text-[20px]">
                Clawd已经准备就绪，开始今天的任务吧!
              </p>
            </div>
          </header>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-8 2xl:gap-10 items-start">
            {/* New Task Section */}
            <section className="bg-white border border-border-main rounded-[4px] shadow-sm relative overflow-hidden paper-texture">
              <div className="flex items-center justify-between border-b border-border-main/60 bg-warm-paper/40 px-8 py-4">
                <div className="space-y-0.5">
                  <h4 className="font-display text-lg font-bold text-ink tracking-tight text-stone-500">添加新任务</h4>
                </div>
                <div className="flex bg-warm-paper/50 p-1.5 rounded-[4px]">
                  <button
                    onClick={() => setMode('minimal')}
                    className={cn("px-5 py-2 text-xs font-bold rounded-lg transition-all", mode === 'minimal' ? "bg-primary text-white shadow-sm" : "text-muted-text hover:text-ink")}
                  >极简</button>
                  <button
                    onClick={() => setMode('structured')}
                    className={cn("px-5 py-2 text-xs font-bold rounded-lg transition-all", mode === 'structured' ? "bg-primary text-white shadow-sm" : "text-muted-text hover:text-ink")}
                  >结构</button>
                </div>
              </div>

              <div className="space-y-5 px-8 py-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">任务名称</p>
                  <div className="relative rounded-[4px] border border-border-main/70 bg-white/65 px-5 py-2.5 shadow-[inset_1px_1px_0_rgba(251,233,218,0.8)]">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-border-main py-2 pl-3 text-3xl font-display outline-none placeholder-stone-200 focus:border-primary transition-colors font-bold"
                    placeholder="现在想做什么？"
                    type="text"
                  />
                </div>
                </div>

                {mode === 'structured' && (
                  <div className="max-w-[540px] space-y-3 rounded-[4px] border border-border-main/50 bg-white/50 p-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <label className="font-display text-base font-bold text-ink">子任务清单</label>
                      </div>
                      {subtasks.length >= 5 && <span className="text-[10px] text-red-500 font-bold uppercase">已达上限 5 项</span>}
                    </div>
                    <div className="flex gap-3">
                      <input
                        value={subtaskInput}
                        onChange={(e) => setSubtaskInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
                        className="flex-1 bg-stone-50 border border-border-main rounded-[4px] px-5 py-4 text-sm outline-none focus:border-primary"
                        placeholder="添加具体步骤..."
                      />
                      <button
                        onClick={addSubtask}
                        disabled={subtasks.length >= 5}
                        className="px-5 bg-warm-paper rounded-[4px] text-stone-600 hover:bg-stone-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <Plus size={24} />
                      </button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto pt-2">
                      {subtasks.map((st, i) => (
                        <li
                          key={i}
                          draggable
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDrop={(e) => handleDrop(e, i)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center gap-3 bg-warm-paper/10 px-4 py-3 rounded-[4px] border transition-all group/item relative",
                            draggedIndex === i ? "opacity-30 border-dashed border-stone-300" : "border-border-main/30",
                            dragOverIndex === i && "border-t-[3px] border-t-[#526D4E] rounded-t-none"
                          )}
                        >
                          <Menu size={16} className="text-stone-300 cursor-grab active:cursor-grabbing shrink-0" />
                          <span className="font-mono text-xs font-bold text-stone-300 shrink-0 bg-stone-50 w-6 h-6 flex items-center justify-center rounded-lg">{i + 1}</span>
                          <span className="flex-1 font-medium text-stone-600 truncate">{st}</span>

                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSubtasks(subtasks.filter((_, index) => index !== i))}
                              className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-md text-stone-300 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-5 border-t border-border-main/50 pt-5">
                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <label className="font-display text-base font-bold text-ink">预期专注时长</label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {[15, 30, 45, 60, 90].map((t) => (
                        <button
                          key={t}
                          onClick={() => setDuration(t)}
                          className={cn(
                            "px-6 py-3 rounded-[4px] border text-sm font-bold transition-all",
                            duration === t
                              ? "border-primary bg-primary text-white shadow-lg shadow-primary/25"
                              : "border-border-main bg-white/50 hover:border-primary hover:bg-stone-50"
                          )}
                        >
                          {t} 分钟
                        </button>
                      ))}
                      <div className="flex items-center gap-2 px-4 py-3 rounded-[4px] border border-border-main bg-white/50">
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          className="w-12 bg-transparent outline-none text-sm font-bold text-center"
                        />
                        <span className="text-xs font-bold text-stone-300">min</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAddTask}
                    className="w-full bg-primary text-white py-3.5 rounded-[4px] font-bold text-base shadow-xl shadow-primary/30 flex items-center justify-center gap-2 hover:opacity-95 hover:translate-y-[-1px] active:translate-y-[1px] active:scale-[0.99] transition-all"
                  >
                    <span>开始任务</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </section>

            {/* Task in Progress Section - Always Visible */}
            <motion.section
              animate={isFinished ? { y: [0, -3, 0] } : {}}
              transition={isFinished ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
              className="bg-white border-2 border-border-main shadow-sm relative overflow-hidden paper-texture min-h-[400px] flex flex-col"
            >
              {activeTasks.length > 0 && currentTask ? (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between border-b-2 border-ink bg-primary px-7 py-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 bg-white animate-pulse" />
                      <span className="text-[12px] font-semibold tracking-[0.16em]">
                        进行中 · {activeTasks.length}
                      </span>
                      <div className="flex gap-1.5">
                        {activeTasks.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const nextTask = activeTasks[i];
                              if (nextTask) {
                                setActiveTask(nextTask.id);
                              }
                            }}
                            className={cn(
                              "h-8 w-8 border text-[11px] font-bold shadow-none",
                              activeTasks[i]?.id === currentTaskId
                                ? "border-white bg-white text-primary"
                                : "border-white/45 bg-primary text-white"
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border border-[color:var(--color-o3)] bg-white px-4 py-1 text-[11px] font-bold tracking-[0.08em] text-primary shadow-[1px_1px_0_var(--color-o3)]">
                      当前聚焦
                    </div>
                  </div>

                  <div className="flex flex-col gap-6 px-8 py-8">
                    <div className="space-y-1">
                      <h3 className="font-display text-[34px] font-bold leading-tight text-ink">
                        {currentTask.title}
                      </h3>
                      <p className="text-[15px] font-medium italic text-muted-text">
                        {currentTaskSubtasks.find(s => s.status === 'pending')?.title || "正在稳步推进中..."}
                      </p>
                    </div>

                    <div className="flex gap-[6px]">
                      {Array.from({ length: progressSegmentCount }).map((_, index) => {
                        const isTip = index === tipProgressIndex;
                        const isFilled = index < completedProgressSegments;
                        return (
                          <span
                            key={index}
                            className={cn(
                              "block h-[10px] flex-1 border border-border-main bg-bg2",
                              isFilled && "border-primary bg-primary",
                              isTip && "border-[color:var(--color-o2)] bg-[color:var(--color-o2)]"
                            )}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-end justify-between border-2 border-ink bg-bg px-7 py-6 shadow-[inset_0_2px_0_var(--color-o4)]">
                      <div className="space-y-1">
                        <span className="font-mono text-[64px] font-bold leading-none tracking-[-0.06em] text-ink">
                          {formatTime(currentTaskRemaining)}
                        </span>
                        <p className="text-[11px] font-bold tracking-[0.12em] text-muted-text">
                          剩余时长
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <span className="font-mono text-[24px] font-bold leading-none text-ink">
                          {Math.floor(currentTaskElapsed / 60)}/{currentTask.totalDuration / 60}min
                        </span>
                        <p className="text-[11px] font-bold tracking-[0.12em] text-muted-text">
                          进度比例
                        </p>
                      </div>
                    </div>

                    {currentTaskSubtasks.length > 0 && (
                      <div className="space-y-2 border border-border-main/50 bg-white/55 p-4">
                        {currentTaskSubtasks.map((st, sIdx) => {
                          const isActive = sIdx === currentTaskSubtasks.findIndex(s => s.status === 'pending');
                          return (
                            <div
                              key={st.id}
                              className={cn(
                                "flex items-center justify-between gap-3 border px-3 py-2",
                                isActive ? "border-primary/25 bg-[#fff8f2]" : "border-transparent bg-transparent"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <button
                                  onClick={() => toggleSubtask(currentTask.id, st.id)}
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center border shadow-none",
                                    st.status === 'done'
                                      ? "border-muted-leaf bg-[#e8f4de] text-muted-leaf"
                                      : st.status === 'skipped'
                                        ? "border-stone-300 bg-stone-100 text-stone-400"
                                        : "border-border-main bg-white text-transparent"
                                  )}
                                >
                                  {st.status === 'done' && <CheckCircle2 size={12} />}
                                  {st.status === 'skipped' && <SkipForward size={10} />}
                                </button>
                                <span className={cn(
                                  "truncate text-[14px] font-medium",
                                  st.status === 'done' ? "text-muted-leaf" : st.status === 'skipped' ? "text-stone-400" : "text-ink",
                                  isActive && "font-semibold"
                                )}>
                                  {st.title}
                                </span>
                              </div>

                              {st.status === 'pending' && (
                                <button
                                  onClick={() => skipSubtask(currentTask.id, st.id)}
                                  className="border border-border-main bg-warm-paper px-3 py-1 text-[11px] font-bold text-stone-500 shadow-none hover:bg-stone-200"
                                >
                                  跳过
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                    {isFinished ? (
                      <>
                        <button
                          onClick={() => {
                            completeTask(currentTask.id);
                            setHighlightTaskId(currentTask.id);
                            setTimeout(() => setHighlightTaskId(null), 3000);
                          }}
                          className="col-span-1 min-h-[64px] bg-[#3E8A45] text-white font-bold flex items-center justify-center gap-2 text-base hover:opacity-90 transition-all"
                        >
                          <CheckCircle2 size={20} />
                          <span>结束</span>
                        </button>
                        <button
                          onClick={() => addTimeToTask(currentTask.id, 5)}
                          className="min-h-[64px] bg-white border-2 border-border-main font-bold flex flex-col items-center justify-center leading-none hover:bg-stone-50 transition-all"
                        >
                          <span className="text-lg">+5</span>
                          <span className="text-[10px] uppercase font-black text-stone-400">min</span>
                        </button>
                        <button
                          onClick={() => addTimeToTask(currentTask.id, 10)}
                          className="min-h-[64px] bg-white border-2 border-border-main font-bold flex flex-col items-center justify-center leading-none hover:bg-stone-50 transition-all"
                        >
                          <span className="text-lg">+10</span>
                          <span className="text-[10px] uppercase font-black text-stone-400">min</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => useStore.getState().updateTaskStatus(currentTask.id, currentTask.status === 'running' ? 'paused' : 'running')}
                          className="min-h-[64px] bg-white border-2 border-border-main font-bold flex items-center justify-center gap-2 text-base hover:bg-stone-50 transition-colors text-ink"
                        >
                          {currentTask.status === 'running' ? <Pause size={18} className="text-primary" /> : <Play size={18} className="text-primary" />}
                          <span>{currentTask.status === 'running' ? '暂停' : '继续'}</span>
                        </button>
                        <button
                          onClick={() => completeTask(currentTask.id)}
                          className="min-h-[64px] bg-[#e8f4de] border-2 border-[#6B9E7A] font-bold flex items-center justify-center gap-2 text-base hover:opacity-90 transition-colors text-[#6B9E7A]"
                        >
                          <CheckCircle2 size={18} className="text-[#3E8A45]" />
                          <span>完成</span>
                        </button>
                        <button
                          onClick={() => cancelTask(currentTask.id)}
                          className="min-h-[64px] bg-[#eceaf7] border-2 border-[#8A7FBB] text-[#8A7FBB] font-bold flex items-center justify-center gap-2 text-base hover:opacity-90 transition-colors"
                        >
                          <X size={18} />
                          <span>取消</span>
                        </button>
                      </>
                    )}
                    </div>

                  {/* Parallel Tasks - Embedded inside the same card */}
                  {activeTasks.length > 1 && (
                    <div className="pt-6 border-t border-stone-100 space-y-3">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">其他并行任务</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-hide snap-y" ref={parallelTasksRef}>
                        {activeTasks.map((task) => {
                          if (task.id === currentTaskId) return null;
                          const taskRemaining = getTaskRemaining(task);
                          const taskElapsed = getTaskElapsed(task);
                          const isTaskFinished = taskRemaining <= 0;
                          return (
                            <motion.div
                              key={task.id}
                              id={`task-preview-${task.id}`}
                              animate={isTaskFinished ? { y: [0, -4, 0] } : {}}
                              transition={isTaskFinished ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
                              className={cn(
                                "group relative snap-start",
                                isTaskFinished && "shadow-xl ring-2 ring-primary/20 rounded-[4px]"
                              )}
                            >
                              <button
                                onClick={() => {
                                  setActiveTask(task.id);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 border transition-all text-left overflow-hidden",
                                  isTaskFinished
                                    ? "bg-primary/5 border-primary/20"
                                    : "bg-[#F9F9F8] border-border-main/50 hover:bg-stone-100"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-sm font-bold text-ink truncate group-hover:text-primary transition-colors">{task.title}</p>
                                    {isTaskFinished && <div className="w-2 h-2 rounded-[4px] bg-primary animate-ping" />}
                                  </div>
                                  <div className="w-full h-1.5 bg-white rounded-[4px] overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{
                                        width: `${(taskElapsed / task.totalDuration) * 100}%`
                                      }}
                                      className={cn("h-full", isTaskFinished ? "bg-primary" : "bg-primary/30")}
                                    />
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-3 relative min-w-[40px]">
                                  <div className={cn("transition-all duration-300 flex items-center gap-2", "group-hover:opacity-20 group-hover:scale-90")}>
                                    <p className={cn("text-xs font-mono font-bold", isTaskFinished ? "text-primary" : "text-stone-400")}>
                                      {formatTime(taskRemaining)}
                                    </p>
                                    <ChevronRight size={12} className="text-stone-300" />
                                  </div>

                                  {/* Hover Actions - Appearing next to/over the time but not fully replacing */}
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all z-10 flex items-center gap-1">
                                    {isTaskFinished ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            completeTask(task.id);
                                            setHighlightTaskId(task.id);
                                            setTimeout(() => setHighlightTaskId(null), 3000);
                                          }}
                                          className="p-2 bg-[#3E8A45] text-white rounded-lg hover:opacity-90 transition-all flex items-center gap-1 shadow-sm"
                                        >
                                          <CheckCircle2 size={14} />
                                          <span className="text-[9px] font-bold">结束</span>
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); addTimeToTask(task.id, 5); }}
                                          className="p-1.5 bg-white text-ink border border-border-main rounded-lg hover:bg-stone-50 transition-all flex flex-col items-center justify-center leading-none min-w-[28px]"
                                        >
                                          <span className="text-[10px] font-black">+5</span>
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); addTimeToTask(task.id, 10); }}
                                          className="p-1.5 bg-white text-ink border border-border-main rounded-lg hover:bg-stone-50 transition-all flex flex-col items-center justify-center leading-none min-w-[28px]"
                                        >
                                          <span className="text-[10px] font-black">+10</span>
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); useStore.getState().updateTaskStatus(task.id, task.status === 'running' ? 'paused' : 'running'); }}
                                          className="p-2 bg-stone-100 text-ink rounded-lg hover:bg-stone-200 transition-all"
                                        >
                                          {task.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                                          className="p-2 bg-[#3E8A45]/10 text-[#3E8A45] rounded-lg hover:bg-[#3E8A45]/20 transition-all"
                                        >
                                          <CheckCircle2 size={14} />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); cancelTask(task.id); }}
                                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                                        >
                                          <X size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 py-8 opacity-40">
                  <div className="w-16 h-16 bg-paper-mist rounded-[4px] flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-muted-text">timer_off</span>
                  </div>
                  <div className="text-center">
                    <h3 className="font-display text-lg font-bold text-ink">暂无活跃任务</h3>
                    <p className="text-xs text-muted-text font-medium">在上方的表单中添加任务以开始专注</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-[4px] bg-border-main" />
                    <div className="w-1.5 h-1.5 rounded-[4px] bg-border-main" />
                    <div className="w-1.5 h-1.5 rounded-[4px] bg-border-main" />
                  </div>
                </div>
              )}
            </motion.section>

                </div>
              </div>
              </section>
            </div>
          </div>

          <aside className="flex h-screen w-[300px] shrink-0 flex-col border-l-2 border-border-sidebar bg-sidebar-bg px-5 py-8 xl:w-[320px] xl:px-7">
            <section className="space-y-4">
              <h4 className="font-display text-[18px] font-bold text-ink">今日统计</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border-main bg-bg px-4 py-5 text-center shadow-[2px_2px_0_var(--color-o3)] rounded-[22px]">
                  <p className="font-mono text-[24px] font-bold leading-none text-olive">{completedCount}</p>
                  <p className="mt-3 text-[10px] font-bold tracking-[0.08em] text-muted-text">已完成</p>
                </div>
                <div className="border border-border-main bg-bg px-4 py-5 text-center shadow-[2px_2px_0_var(--color-o3)] rounded-[22px]">
                  <p className="font-mono text-[24px] font-bold leading-none text-primary">{cancelledCount}</p>
                  <p className="mt-3 text-[10px] font-bold tracking-[0.08em] text-muted-text">已取消</p>
                </div>
                <div className="col-span-2 flex items-center justify-between border border-border-main bg-bg px-5 py-5 shadow-[2px_2px_0_var(--color-o3)] rounded-[22px]">
                  <div>
                    <p className="font-mono text-[20px] font-bold leading-none text-ink">
                      {Math.floor(totalFocusTime / 3600)}h {Math.floor((totalFocusTime % 3600) / 60)}m
                    </p>
                    <p className="mt-2 text-[10px] font-bold tracking-[0.08em] text-muted-text">总专注时长</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#f6e2d2] bg-[#fff7f1] text-[#f2c7a6]">
                    <span className="material-symbols-outlined text-[20px] leading-none">bolt</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 flex min-h-0 flex-1 flex-col">
              <div className="mb-4 border-b border-border-main/40 pb-3">
                <h4 className="font-display text-[18px] font-bold text-ink">今日记录</h4>
              </div>
              <div className="flex-1 overflow-hidden border border-dashed border-border-main bg-bg/70 px-3 py-3">
                <div className="flex h-full flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-hide" ref={historyListRef}>
                  {todayHistory.length === 0 && (
                    <p className="pt-4 text-[12px] font-medium italic text-stone-300">暂无今日记录</p>
                  )}
                  {todayHistory.map((h) => {
                    const timeSpent = getTaskActualDurationSeconds(h);
                    const isHighlighted = highlightTaskId === h.id;
                    const historySubtasks = normalizeHistorySubtasks(h);

                    return (
                      <motion.div
                        key={h.id}
                        id={`history-item-${h.id}`}
                        initial={isHighlighted ? { scale: 0.95, opacity: 0 } : false}
                        animate={isHighlighted ? {
                          scale: [1, 1.02, 1],
                          backgroundColor: ["rgba(255,255,255,1)", "rgba(82,109,78,0.15)", "rgba(255,255,255,1)"],
                          opacity: 1
                        } : { opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className={cn(
                          "border border-border-main bg-white px-3 py-3 shadow-[2px_2px_0_var(--color-o3)]",
                          isHighlighted ? "border-[#3E8A45]" : ""
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center border",
                            h.status === 'done' ? "border-[#B9D7B7] bg-[#E8F4DE] text-[#3E8A45]" : "border-[#F1BAAA] bg-[#FFE7DE] text-[#D84A30]"
                          )}>
                            {h.status === 'done' ? <CheckCircle2 size={16} /> : <X size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <p className={cn(
                                "truncate text-[13px] font-bold text-ink",
                                h.status === 'cancelled' && "text-stone-500"
                              )}>
                                {h.title}
                              </p>
                              <span className="shrink-0 font-mono text-[10px] font-bold text-stone-400">
                                {h.endTime ? new Date(h.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-[#f7f1ea] px-2 py-0.5 text-[10px] font-bold text-stone-500">
                                {Math.floor(timeSpent / 60)}m
                              </span>
                              <span className={cn(
                                "text-[10px] font-black tracking-[0.08em]",
                                h.status === 'done' ? "text-[#3E8A45]" : "text-[#D84A30]"
                              )}>
                                {h.status === 'done' ? 'DONE' : 'CANCELLED'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {historySubtasks.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-l border-border-main/40 pl-3 ml-4">
                            {historySubtasks.slice(0, 3).map((st, idx) => (
                              <li key={st.id} className="flex items-center gap-2 text-[10px] font-medium text-stone-500">
                                <span className="font-mono text-stone-300">{idx + 1}.</span>
                                <span className="truncate flex-1">{st.title}</span>
                                {st.displayLabel && (
                                  <span className={cn(
                                    "shrink-0 font-bold",
                                    st.displayStatus === 'done' ? 'text-[#3E8A45]' : 'text-[#D84A30]'
                                  )}>
                                    {st.displayLabel}
                                  </span>
                                )}
                              </li>
                            ))}
                            {historySubtasks.length > 3 && (
                              <li className="text-[10px] italic text-stone-300">还有 {historySubtasks.length - 3} 个子任务...</li>
                            )}
                          </ul>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <button
                type="button"
                onClick={handleOpenDailyReport}
                className="flex min-h-[72px] w-full items-center justify-center gap-3 bg-soft-apricot text-ink text-[16px] font-bold transition-all"
              >
                <span className="material-symbols-outlined text-[22px] leading-none">description</span>
                <span>生成日报</span>
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
