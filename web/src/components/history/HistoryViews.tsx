/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { CheckCircle2, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DailyRecord } from '../../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { normalizeHistorySubtasks } from '../../lib/history';
import { formatDurationMinutes, getTaskActualDurationSeconds } from '../../lib/taskTime';

interface DetailModalProps {
  record: DailyRecord | null;
  onClose: () => void;
}

export function DetailModal({ record, onClose }: DetailModalProps) {
  if (!record) return null;

  const completedTasks = record.tasks.filter(t => t.status === 'done');
  const cancelledTasks = record.tasks.filter(t => t.status === 'cancelled');
  const totalDuration = record.tasks.reduce((acc, t) => acc + (t.status === 'done' ? getTaskActualDurationSeconds(t) : 0), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-ink/40" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-[#FFFDF7] rounded-[4px] border-2 border-border-main overflow-hidden paper-texture shadow-[5px_5px_0_#C9B69D]"
        >
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-2xl font-bold text-ink">{record.date}</h3>
                <p className="text-muted-text text-sm font-medium">任务详情回顾</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#FFF0DF] rounded-[4px] transition-colors"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="pixel-card-sm p-4">
                <p className="text-xl font-display font-bold text-olive">{completedTasks.length}</p>
                <p className="text-[8px] uppercase font-bold text-muted-text">已完成</p>
              </div>
              <div className="pixel-card-sm p-4">
                <p className="text-xl font-display font-bold text-primary">{cancelledTasks.length}</p>
                <p className="text-[8px] uppercase font-bold text-muted-text">已取消</p>
              </div>
              <div className="pixel-card-sm p-4">
                <p className="text-xl font-display font-bold text-ink">{Math.floor(totalDuration / 3600)}h {Math.floor((totalDuration % 3600) / 60)}m</p>
                <p className="text-[8px] uppercase font-bold text-muted-text">总用时</p>
              </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {record.tasks.map((task) => (
                <div key={task.id} className="pixel-card-sm p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 border-2', task.status === 'done' ? 'bg-[#E8F4DE] border-[#B9D7B7] text-[#3E8A45]' : 'bg-[#FFE7DE] border-[#F1BAAA] text-[#D84A30]')}>
                        {task.status === 'done' ? <CheckCircle2 size={14} /> : <X size={14} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-ink text-sm">{task.title}</h4>
                        <p className="text-[9px] font-bold text-stone-500">{formatDurationMinutes(task)} min - {new Date(task.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                  {task.subtasks.length > 0 && (
                    <div className="pl-10 space-y-1">
                      {normalizeHistorySubtasks(task).map((s) => (
                        <div key={s.id} className="flex items-center gap-3 text-xs">
                          <div
                            className={cn(
                              'w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0',
                              s.displayStatus === 'done' && 'border-[#B9D7B7] bg-[#E8F4DE]',
                              s.displayStatus === 'skipped' && 'border-[#F1BAAA] bg-[#FFE7DE]',
                              s.displayStatus === 'pending' && 'border-stone-300 bg-transparent'
                            )}
                          >
                            {s.displayStatus === 'done' && <Check size={10} className="text-[#3E8A45]" />}
                            {s.displayStatus === 'skipped' && <X size={10} className="text-[#D84A30]" />}
                          </div>
                          <span className={cn('flex-1', s.displayStatus === 'done' ? 'text-stone-500' : s.displayStatus === 'skipped' ? 'text-stone-500' : 'text-stone-700 font-medium')}>{s.title}</span>
                          {s.displayLabel && (
                            <span
                              className={cn(
                                'shrink-0 text-[10px] font-bold',
                                s.displayStatus === 'done' ? 'text-[#3E8A45]' : 'text-[#D84A30]'
                              )}
                            >
                              {s.displayLabel}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CalendarView({ onSelectDate }: { onSelectDate: (record: DailyRecord) => void }) {
  const { history } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getRecordForDate = (day: Date) => history.find(h => h.date === format(day, 'yyyy-MM-dd'));

  return (
    <div className="bg-[#FFFDF7] border-2 border-border-main rounded-[4px] overflow-hidden shadow-[5px_5px_0_#C9B69D] paper-texture max-w-5xl mx-auto">
      <div className="flex items-center justify-between p-6 border-b-2 border-border-main bg-[#FFF8EC]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-10 h-10 flex items-center justify-center rounded-[4px] border-2 border-border-main hover:bg-stone-50"><ChevronLeft size={18} /></button>
          <h3 className="font-display text-xl font-bold text-ink">{format(currentDate, 'yyyy年MM月')}</h3>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-10 h-10 flex items-center justify-center rounded-[4px] border-2 border-border-main hover:bg-stone-50"><ChevronRight size={18} /></button>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 border-2 border-border-main rounded-[4px] text-xs font-bold hover:bg-soft-apricot">回到今日</button>
      </div>

      <div className="grid grid-cols-7 bg-[#FFF4E4] border-b-2 border-border-main">
        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-bold text-muted-text">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border-main">
        {calendarDays.map((day, idx) => {
          const record = getRecordForDate(day);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div key={idx} className={cn('bg-[#FFFDF7] min-h-[140px] p-3 flex flex-col gap-2 relative group border border-[#E6D8C3]', !isCurrentMonth && 'bg-stone-50/50')}>
              <div className="flex justify-end mb-1">
                <span className={cn('text-[12px] font-bold', isToday ? 'text-white bg-primary w-7 h-7 flex items-center justify-center rounded-[4px] border border-primary-accent' : isCurrentMonth ? 'text-ink' : 'text-stone-300')}>
                  {format(day, 'd')}
                </span>
              </div>

              {record && (
                <div className="mt-1 space-y-2">
                  <p className="text-[10px] text-muted-leaf font-bold">● 完成 {record.tasks.filter(t => t.status === 'done').length}</p>
                  <div className="flex flex-col gap-1.5 overflow-hidden">
                    {record.tasks.slice(0, 2).map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-muted-text truncate bg-[#FFF8EC] px-2 py-1 rounded-[4px] border border-border-main">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', t.status === 'done' ? 'bg-muted-leaf' : 'bg-primary')} />
                        <span className={cn('truncate font-medium', t.status === 'done' && 'opacity-60')}>{t.title}</span>
                      </div>
                    ))}
                    {record.tasks.length > 2 && <p className="text-[9px] text-stone-500 pl-2 font-bold italic">...+{record.tasks.length - 2} 更多</p>}
                  </div>
                  <button onClick={() => onSelectDate(record)} className="mt-2 w-full py-2 text-[10px] text-primary-accent font-bold border-2 border-primary-accent rounded-[4px] hover:bg-soft-apricot opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <span>详细回顾</span>
                    <ChevronRight size={10} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-8 py-4 border-t-2 border-border-main bg-[#FFF8EC]">
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink"><span className="w-2 h-2 rounded-full bg-[#3E8A45]" /><span>完成任务</span></div>
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink"><span className="w-2 h-2 rounded-full bg-[#D84A30]" /><span>取消任务</span></div>
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink"><span className="font-mono">...</span><span>表示更多</span></div>
      </div>
    </div>
  );
}

export function HistoryCardView() {
  const { history } = useStore();
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [view, setView] = useState<'card' | 'calendar'>('card');

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end border-b-2 border-border-main pb-6">
        <div className="space-y-1">
          <span className="text-[18px] tracking-wide text-olive font-bold">往期日志回顾</span>
          <h3 className="font-display text-[64px] text-ink font-black leading-tight">历史记录</h3>
        </div>

        <div className="flex bg-[#FFF8EC] p-1 border-2 border-border-main rounded-[4px] relative overflow-hidden">
          <button onClick={() => setView('card')} className={cn('relative z-10 px-6 py-2 text-[16px] font-bold transition-all rounded-[4px] duration-300', view === 'card' ? 'text-white bg-primary border-2 border-primary-accent' : 'text-ink bg-[#FFFDF7]')}>
            卡片视图
          </button>
          <button onClick={() => setView('calendar')} className={cn('relative z-10 px-6 py-2 text-[16px] font-bold transition-all rounded-[4px] duration-300', view === 'calendar' ? 'text-white bg-primary border-2 border-primary-accent' : 'text-ink bg-[#FFFDF7]')}>
            日历视图
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'card' ? (
          <motion.div key="card-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((record) => (
              <motion.div key={record.date} whileHover={{ y: -4 }} className="bg-[#FFFDF7] border-2 border-border-main rounded-[4px] p-4 shadow-[5px_5px_0_#C9B69D] group transition-all paper-texture flex flex-col min-h-[220px]">
                <div className="mb-3"><h4 className="font-display text-lg font-bold text-ink">{record.date}</h4></div>

                <div className="grid grid-cols-3 gap-2 mb-4 bg-[#FFF8EC] p-2.5 rounded-[4px] border-2 border-border-main">
                  <div className="text-center border-r border-border-main/50"><p className="text-[7px] uppercase font-bold text-muted-text">已完成</p><p className="text-[34px] leading-none font-display font-bold text-olive">{record.tasks.filter(t => t.status === 'done').length}</p></div>
                  <div className="text-center border-r border-border-main/50"><p className="text-[7px] uppercase font-bold text-muted-text">已取消</p><p className="text-[34px] leading-none font-display font-bold text-primary">{record.tasks.filter(t => t.status === 'cancelled').length}</p></div>
                  <div className="text-center"><p className="text-[7px] uppercase font-bold text-muted-text">时长</p><p className="text-[34px] leading-none font-display font-bold text-ink">{Math.floor(record.tasks.reduce((a, t) => a + (t.status === 'done' ? getTaskActualDurationSeconds(t) : 0), 0) / 3600)}h</p></div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ul className="space-y-2">
                    {record.tasks.slice(0, 3).map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-3 text-[11px]">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {task.status === 'done' ? <CheckCircle2 size={14} className="text-muted-leaf shrink-0" /> : <X size={14} className="text-red-500 shrink-0" />}
                          <span className={cn('font-medium truncate', task.status === 'done' && 'text-stone-400 font-normal')}>{task.title}</span>
                        </div>
                        <span className="text-[8px] font-bold text-stone-500 shrink-0">{formatDurationMinutes(task)}m</span>
                      </li>
                    ))}
                    {record.tasks.length > 3 && <li className="text-stone-500 text-center italic text-[9px] pt-1 leading-none">... 还有 {record.tasks.length - 3} 个任务</li>}
                  </ul>
                </div>

                <div className="mt-4">
                  <button onClick={() => setSelectedRecord(record)} className="w-full py-2 text-[16px] font-bold text-primary border-2 border-primary rounded-[4px] hover:bg-soft-apricot transition-colors">查看详情</button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="calendar-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CalendarView onSelectDate={setSelectedRecord} />
          </motion.div>
        )}
      </AnimatePresence>

      <DetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
