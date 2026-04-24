/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useStore } from '../store/useStore';
import { FileText, Download, Share2, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function DailyReportView() {
  const { history } = useStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const todayRecord = history.find(h => h.date === selectedDate);
  const completedTasks = todayRecord?.tasks.filter(t => t.status === 'done') || [];
  const totalDuration = completedTasks.reduce((acc, t) => acc + t.totalDuration, 0);

  return (
    <div className="px-8 py-8 space-y-8 max-w-5xl mx-auto">
      <header className="flex justify-between items-end border-b border-border-main pb-6">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-primary-accent font-bold">智能工作汇报</span>
          <h3 className="font-display text-4xl text-ink font-bold leading-tight">每日复盘</h3>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border-main rounded-xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm">
            <Download size={14} />
            导出 PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
            <Share2 size={14} />
            分享日报
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Report Content */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border-main rounded-[32px] p-8 shadow-sm paper-texture relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <FileText size={120} className="text-primary" />
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-50 rounded-2xl border border-primary/10">
                  <Calendar size={20} className="text-primary-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">REPORT DATE</p>
                  <p className="text-xl font-display font-bold text-ink">{selectedDate}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  今日成就总结
                </h4>
                <div className="space-y-4 text-stone-600 leading-relaxed text-sm font-medium">
                  {completedTasks.length > 0 ? (
                    <>
                      <p>今天你高效完成了 <span className="text-olive font-bold">{completedTasks.length}</span> 个预定任务，累计专注时长达 <span className="text-primary-accent font-bold">{Math.floor(totalDuration / 3600)}小时{Math.floor((totalDuration % 3600) / 60)}分钟</span>。</p>
                      <ul className="space-y-2 list-disc pl-5 text-stone-500">
                        {completedTasks.map(t => (
                          <li key={t.id}>
                            <span className="font-bold text-ink">{t.title}</span> - 耗时 {Math.floor(t.totalDuration / 60)} 分钟
                          </li>
                        ))}
                      </ul>
                      <p className="text-stone-400 italic">“每一份坚持都是通往卓越的阶梯。你今天的表现非常出色，继续保持这种节奏！”</p>
                    </>
                  ) : (
                    <div className="py-12 text-center space-y-3">
                      <p className="text-stone-300">今日暂无已完成的任务记录</p>
                      <p className="text-xs text-stone-400">去主页开始你的第一个挑战吧</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Archives/Dates */}
        <div className="space-y-6">
          <div className="bg-paper-mist/30 border border-border-main rounded-[24px] p-6 space-y-4">
            <h4 className="text-xs font-bold text-ink uppercase tracking-widest px-2">历史日报存档</h4>
            <div className="space-y-2">
              {history.length > 0 ? (
                history.map(record => (
                  <button 
                    key={record.date}
                    onClick={() => setSelectedDate(record.date)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-all border text-sm font-bold",
                      selectedDate === record.date 
                        ? "bg-white border-primary/20 text-primary shadow-sm" 
                        : "bg-transparent border-transparent text-stone-400 hover:bg-white hover:border-border-main hover:text-ink"
                    )}
                  >
                    <span>{record.date}</span>
                    <span className="text-[10px] opacity-60">{record.tasks.filter(t => t.status === 'done').length} 项</span>
                  </button>
                ))
              ) : (
                <p className="text-stone-300 text-center py-8 text-xs italic">暂无历史记录</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
