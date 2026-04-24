/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { Play, Pause, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

export default function TasksIsland() {
  const { isIslandVisible, tasks, activeTaskId, completeTask, updateTaskStatus } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeTask = tasks.find(t => t.id === activeTaskId) || tasks[0];

  if (!isIslandVisible) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center">
      <motion.div
        layout
        initial={{ scale: 0.8, opacity: 0, y: -20 }}
        animate={{ 
          scale: 1, 
          opacity: 1, 
          y: 0,
          width: isExpanded ? 320 : 180,
          height: isExpanded ? 'auto' : 36,
          borderRadius: isExpanded ? 24 : 18,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "bg-ink text-white shadow-2xl flex flex-col items-center justify-center pointer-events-auto cursor-pointer overflow-hidden relative",
          !isExpanded && "hover:scale-105 active:scale-95 transition-transform"
        )}
      >
        <div className="flex items-center justify-between w-full h-full px-4">
          {!isExpanded ? (
            <>
              {activeTask ? (
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold truncate max-w-[80px]">{activeTask.title}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-indigo-400" />
                  <span className="text-[11px] font-bold">空闲中</span>
                </div>
              )}
              
              {activeTask && (
                <span className="text-[10px] font-mono font-bold text-stone-400">
                  {formatTime(activeTask.remainingTime)}
                </span>
              )}
            </>
          ) : (
            <div className="w-full p-2 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-400 tracking-widest uppercase">当前任务</h4>
                  <p className="text-base font-display font-bold leading-tight">{activeTask?.title || '暂无任务'}</p>
                </div>
                <div className="p-2 bg-white/10 rounded-xl">
                  <Zap size={16} className="text-indigo-400" />
                </div>
              </div>

              {activeTask && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-stone-500">
                      <span>进度</span>
                      <span>{Math.floor(((activeTask.totalDuration - activeTask.remainingTime) / activeTask.totalDuration) * 100)}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((activeTask.totalDuration - activeTask.remainingTime) / activeTask.totalDuration) * 100}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(activeTask.id, activeTask.status === 'running' ? 'paused' : 'running');
                      }}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {activeTask.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                      <span className="text-[11px] font-bold">{activeTask.status === 'running' ? '暂停' : '继续'}</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTask(activeTask.id);
                        setIsExpanded(false);
                      }}
                      className="flex-1 py-2 bg-primary text-white rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
                    >
                      <CheckCircle2 size={14} />
                      <span className="text-[11px] font-bold">完成</span>
                    </button>
                  </div>
                </>
              )}

              {!activeTask && (
                <div className="py-4 text-center">
                  <p className="text-[10px] text-stone-500 font-medium">去主页开启一个新任务吧</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
