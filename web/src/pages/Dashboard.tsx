/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Play, Pause, CheckCircle2, X, ChevronRight, SkipForward, Menu } from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { motion } from 'motion/react';

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
  const { tasks, activeTaskId, addTask, completeTask, cancelTask, toggleSubtask, skipSubtask, history, addTimeToTask, setActiveTask } = useStore();
  const [taskTitle, setTaskTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<'minimal' | 'structured'>('minimal');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const parallelTasksRef = useRef<HTMLDivElement>(null);
  const historyListRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

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
  const today = new Date().toISOString().split('T')[0];
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
  const totalFocusTime = todayHistory.reduce((acc, t) => acc + (t.status === 'done' ? t.totalDuration : 0), 0);

  return (
    <div className="flex-1 flex overflow-hidden h-screen bg-main-bg">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center py-10 overflow-y-auto px-8">
        <div className="w-full max-w-4xl space-y-16">
          <header className="flex items-center gap-8 mb-4">
            <div className="w-24 h-24 bg-soft-apricot/20 rounded-[4px] flex items-center justify-center border border-border-main shadow-inner">
              <img 
                alt="Crab Mascot" 
                className="w-14 h-14 object-contain" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpqjQixAlv4oSgwcgFRtZctVTqAjzvUyz7suFamjBKGWhHT25b-sTjZa2vI-T2NBclHRWUnOLYbqrPo0FQryCrpH3L6jCtxUvJ6nZZc8edBVX9Quez9idH7nSuNkf4OqybEODl58qE3S6Uuk-kVzUe3RGb8yoyfR0c5AgMiQsx6H1MlRsWa6-9CPC77jz8rrj1b5FVR8R7HMfnDcgieNBigKxNCld_vB5kUwUOdL_urWj9DNxvnagMIDMlf9ITLgsMwJ221S2D8wZX"
              />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-5xl font-bold text-ink tracking-tight">早上好，Alex</h2>
              <p className="text-lg text-muted-text opacity-80 italic font-medium">Clawd已经准备就绪，开始今天的任务吧！</p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* New Task Section */}
            <section className="bg-white border border-border-main rounded-[4px] p-8 shadow-sm relative overflow-hidden paper-texture">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-display text-lg font-bold text-ink tracking-tight uppercase tracking-widest text-stone-400">添加新任务</h4>
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

              <div className="space-y-8">
                <div className="relative">
                  <input 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-border-main py-2 text-3xl font-display outline-none placeholder-stone-200 focus:border-primary transition-colors font-bold" 
                    placeholder="现在想做什么？"
                    type="text"
                  />
                </div>

                {mode === 'structured' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="font-display text-base font-bold text-ink">子任务清单</label>
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

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="font-display text-base font-bold text-ink">预期专注时长</label>
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
              className="bg-white border border-border-main rounded-[4px] p-8 shadow-sm relative overflow-hidden paper-texture min-h-[400px] flex flex-col justify-center"
            >
              {activeTasks.length > 0 && currentTask ? (
                <div className="flex flex-col space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-ink">
                        进行中 {activeTasks.length} 个
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
                              "w-6 h-6 rounded-md text-[10px] font-bold transition-all border",
                              activeTasks[i]?.id === currentTaskId
                                ? "bg-primary text-white border-primary" 
                                : "bg-white text-muted-text border-border-main hover:border-primary/50"
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-[#FFF5EE] text-primary-accent text-[10px] font-bold rounded-[4px] border border-[#FFE4D1]">
                      当前聚焦
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl font-bold text-ink leading-tight">
                      {currentTask.title}
                    </h3>
                    <p className="text-muted-text text-sm italic">
                      {currentTaskSubtasks.find(s => s.status === 'pending')?.title || "正在稳步推进中..."}
                    </p>
                  </div>

                  {/* Subtasks Box */}
                  {currentTaskSubtasks.length > 0 && (
                    <div className="bg-[#F9F9F8] rounded-[16px] p-2 space-y-1 border border-border-main/50 max-h-48 overflow-y-auto">
                      {currentTaskSubtasks.map((st, sIdx) => {
                        const isActive = sIdx === currentTaskSubtasks.findIndex(s => s.status === 'pending');
                        return (
                          <div key={st.id} className={cn(
                            "flex items-center justify-between p-3 rounded-[4px] transition-all",
                            isActive ? "bg-white border border-primary/20 shadow-sm" : "bg-transparent border border-transparent"
                          )}>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => toggleSubtask(currentTask.id, st.id)}
                                className={cn(
                                  "w-5 h-5 rounded-[4px] border transition-all flex items-center justify-center shrink-0",
                                  st.status === 'done' 
                                    ? "bg-muted-leaf/10 border-muted-leaf text-muted-leaf" 
                                    : st.status === 'skipped'
                                    ? "bg-stone-100 border-stone-300 text-stone-400"
                                    : "border-muted-leaf/30 bg-white"
                                )}
                              >
                                {st.status === 'done' && <CheckCircle2 size={12} />}
                                {st.status === 'skipped' && <SkipForward size={10} />}
                              </button>
                              <span className={cn(
                                "text-base font-medium transition-all",
                                st.status === 'done' ? "text-muted-leaf" : st.status === 'skipped' ? "text-stone-400" : "text-ink",
                                isActive && "font-bold"
                              )}>
                                {st.title}
                              </span>
                              {isActive && <div className="w-1.5 h-1.5 rounded-[4px] bg-primary animate-pulse ml-1" />}
                            </div>
                            
                            {st.status === 'pending' && (
                              <button 
                                onClick={() => skipSubtask(currentTask.id, st.id)}
                                className="flex items-center gap-1 px-3 py-1 bg-warm-paper hover:bg-stone-200 text-stone-500 rounded-lg text-[10px] font-bold transition-all shadow-subtle"
                              >
                                <span>跳过</span>
                                <SkipForward size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <div className="w-full h-1.5 bg-paper-mist rounded-[4px] overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentTaskElapsed / currentTask.totalDuration) * 100}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>

                  {/* Time Stats */}
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <span className="font-display text-4xl font-bold text-ink leading-none">
                        {formatTime(currentTaskRemaining)}
                      </span>
                      <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest leading-none">
                        剩余时长
                      </p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="font-display text-xl font-bold text-ink leading-none">
                        {Math.floor(currentTaskElapsed / 60)}/{currentTask.totalDuration / 60}min
                      </span>
                      <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest leading-none">
                        进度比例
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    {isFinished ? (
                      <>
                        <button 
                          onClick={() => {
                            completeTask(currentTask.id);
                            setHighlightTaskId(currentTask.id);
                            setTimeout(() => setHighlightTaskId(null), 3000);
                          }}
                          className="flex-[2] py-4 bg-[#3E8A45] text-white rounded-[4px] font-bold flex items-center justify-center gap-2 text-base hover:opacity-90 transition-all shadow-lg shadow-[#3E8A45]/25"
                        >
                          <CheckCircle2 size={20} />
                          <span>结束任务</span>
                        </button>
                        <button 
                          onClick={() => addTimeToTask(currentTask.id, 5)}
                          className="flex-1 py-4 bg-white border-2 border-border-main rounded-[4px] font-bold flex flex-col items-center justify-center leading-none hover:bg-stone-50 transition-all shadow-sm"
                        >
                          <span className="text-lg">+5</span>
                          <span className="text-[10px] uppercase font-black text-stone-400">min</span>
                        </button>
                        <button 
                          onClick={() => addTimeToTask(currentTask.id, 10)}
                          className="flex-1 py-4 bg-white border-2 border-border-main rounded-[4px] font-bold flex flex-col items-center justify-center leading-none hover:bg-stone-50 transition-all shadow-sm"
                        >
                          <span className="text-lg">+10</span>
                          <span className="text-[10px] uppercase font-black text-stone-400">min</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => useStore.getState().updateTaskStatus(currentTask.id, currentTask.status === 'running' ? 'paused' : 'running')}
                          className="flex-1 py-3 bg-white border border-border-main rounded-[16px] font-bold flex items-center justify-center gap-2 text-base hover:bg-stone-50 transition-colors text-ink shadow-sm"
                        >
                          {currentTask.status === 'running' ? <Pause size={18} className="text-primary" /> : <Play size={18} className="text-primary" />}
                          <span>{currentTask.status === 'running' ? '暂停' : '继续'}</span>
                        </button>
                        <button 
                          onClick={() => completeTask(currentTask.id)}
                          className="flex-1 py-3 bg-white border border-border-main rounded-[16px] font-bold flex items-center justify-center gap-2 text-base hover:bg-stone-50 transition-colors text-ink shadow-sm"
                        >
                          <CheckCircle2 size={18} className="text-[#3E8A45]" />
                          <span>完成</span>
                        </button>
                        <button 
                          onClick={() => cancelTask(currentTask.id)}
                          className="flex-1 py-3 bg-white border border-[#FFF0F0] text-red-600 rounded-[16px] font-bold flex items-center justify-center gap-2 text-base hover:bg-red-50 transition-colors shadow-sm"
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
                                  "w-full flex items-center gap-4 p-4 border rounded-[4px] transition-all text-left overflow-hidden",
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
      </div>

      <aside className="w-80 border-l-2 border-border-sidebar bg-sidebar-bg p-6 flex flex-col space-y-6 overflow-hidden">
        <section className="space-y-4">
          <h4 className="font-display text-base font-bold text-ink">今日统计</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-3 rounded-[18px] border border-border-main shadow-sm text-center">
              <p className="text-xl font-display font-bold text-olive">{completedCount}</p>
              <p className="text-[7px] uppercase font-bold text-muted-text tracking-widest">已完成</p>
            </div>
            <div className="bg-white p-3 rounded-[18px] border border-border-main shadow-sm text-center">
              <p className="text-xl font-display font-bold text-primary">{cancelledCount}</p>
              <p className="text-[7px] uppercase font-bold text-muted-text tracking-widest">已取消</p>
            </div>
            <div className="bg-white p-4 rounded-[18px] border border-border-main shadow-sm col-span-2 flex items-center justify-between">
              <div>
                <p className="text-lg font-display font-bold text-ink leading-tight">
                  {Math.floor(totalFocusTime / 3600)}h {Math.floor((totalFocusTime % 3600) / 60)}m
                </p>
                <p className="text-[7px] uppercase font-bold text-muted-text tracking-widest">总专注时长</p>
              </div>
              <div className="bg-soft-apricot/20 text-soft-apricot rounded-[4px] w-8 h-8 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg leading-none">bolt</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="flex justify-between items-center border-b border-warm-paper pb-2">
            <h4 className="font-display text-base font-bold text-ink">今日记录</h4>
            <button className="text-primary text-[9px] font-bold hover:underline">详情</button>
          </div>
          <div className="space-y-2.5 overflow-y-auto pr-1 scrollbar-hide" ref={historyListRef}>
            {todayHistory.length === 0 && <p className="text-stone-400 text-[10px] italic opacity-60">暂无今日记录</p>}
            {todayHistory.map((h) => {
              const timeSpent = h.totalDuration - h.remainingTime;
              const isHighlighted = highlightTaskId === h.id;
              const historySubtasks = normalizeSubtasks(h.subtasks);
              
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
                    "p-4 bg-white rounded-[4px] border transition-all flex flex-col gap-3 shadow-sm",
                    isHighlighted ? "border-[#3E8A45] ring-2 ring-[#3E8A45]/10" : "border-border-main"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0 shadow-sm",
                      h.status === 'done' ? "bg-[#F0F7F0] text-[#3E8A45]" : "bg-red-50 text-red-500"
                    )}>
                      {h.status === 'done' ? <CheckCircle2 size={20} /> : <X size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className={cn(
                          "text-sm font-bold text-stone-800 truncate",
                          h.status === 'cancelled' && "text-stone-400 font-medium"
                        )}>{h.title}</p>
                        <span className="text-[10px] font-mono font-black text-stone-400 shrink-0 ml-2">
                          {h.endTime ? new Date(h.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                          <span className="material-symbols-outlined text-[10px]">schedule</span>
                          {Math.floor(timeSpent / 60)}m
                        </div>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          h.status === 'done' ? "text-[#3E8A45]" : "text-red-400"
                        )}>
                          {h.status === 'done' ? 'DONE' : 'CANCELLED'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {historySubtasks.length > 0 && (
                    <ul className="pl-4 space-y-1.5 border-l-2 border-stone-100 ml-5">
                      {historySubtasks.slice(0, 3).map((st, idx) => (
                        <li key={st.id} className="flex items-center gap-2 text-[11px] font-medium text-stone-500">
                          <span className="text-stone-300 font-mono text-[10px]">{idx + 1}.</span>
                          <span className={cn(
                            "truncate",
                            st.status === 'done' ? "text-[#3E8A45]" : st.status === 'skipped' && "text-stone-300 italic"
                          )}>
                            {st.title}
                          </span>
                        </li>
                      ))}
                      {historySubtasks.length > 3 && (
                        <li className="text-[10px] text-stone-300 italic pl-5">还有 {historySubtasks.length - 3} 个子任务...</li>
                      )}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-auto">
          <button className="w-full bg-soft-apricot text-ink py-4 rounded-[18px] font-bold text-sm shadow-sm hover:opacity-90 transition-all font-display flex items-center justify-center gap-2 border border-soft-apricot/20">
            <span className="material-symbols-outlined text-lg">description</span>
            生成日报
          </button>
        </section>
      </aside>
    </div>
  );
}


