/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getLocalDateKey } from '../lib/date';
import { Download, Share2, Calendar, FileImage } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  buildDailyImagePrompt,
  buildDailyImagePromptData,
  buildDailyImagePromptPayload,
  buildDailySummaryForImage
} from '../lib/dailyImageSummary';

const REPORT_IMAGE_STORAGE_PREFIX = 'clawdmate-daily-report-image:';
const REPORT_PROMPT_STORAGE_PREFIX = 'clawdmate-daily-report-prompt:';

function getImageStorageKey(date: string) {
  return `${REPORT_IMAGE_STORAGE_PREFIX}${date}`;
}

function getPromptStorageKey(date: string) {
  return `${REPORT_PROMPT_STORAGE_PREFIX}${date}`;
}

export default function DailyReportView() {
  const { history } = useStore();
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey(new Date()));
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const selectedRecord = history.find((record) => record.date === selectedDate);
  const dailyImageSummary = buildDailySummaryForImage(selectedRecord);
  const dailyImagePromptData = buildDailyImagePromptData(dailyImageSummary);
  const dailyImagePromptPayload = buildDailyImagePromptPayload(dailyImageSummary);
  const dailyImagePrompt = buildDailyImagePrompt(dailyImagePromptData);

  useEffect(() => {
    const storedImage = localStorage.getItem(getImageStorageKey(selectedDate));
    setGeneratedImageUrl(storedImage && storedImage.trim().length > 0 ? storedImage : null);
  }, [selectedDate]);

  const handleGenerateReport = () => {
    localStorage.setItem(getPromptStorageKey(selectedDate), dailyImagePromptPayload);
    window.dispatchEvent(
      new CustomEvent('clawdmate:daily-report-generate-request', {
        detail: {
          date: selectedDate,
          prompt: dailyImagePrompt,
          promptPayload: dailyImagePromptPayload,
          promptData: dailyImagePromptData,
          summary: dailyImageSummary
        }
      })
    );
  };

  const handleDownloadReport = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `clawdmate-report-${selectedDate}.png`;
    link.click();
  };

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end border-b border-border-main pb-6">
        <div className="space-y-1">
          <h3 className="font-display text-4xl text-ink font-bold leading-tight">每日复盘</h3>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={!generatedImageUrl}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border-main rounded-xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            下载日报
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Share2 size={14} />
            分享日报
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border-main rounded-[32px] p-8 shadow-sm paper-texture relative overflow-hidden min-h-[760px]"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <FileImage size={120} className="text-primary" />
            </div>

            <div className="relative z-10 h-full flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-50 rounded-2xl border border-primary/10">
                  <Calendar size={20} className="text-primary-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">REPORT DATE</p>
                  <p className="text-xl font-display font-bold text-ink">{selectedDate}</p>
                </div>
              </div>

              <div className="flex-1 rounded-[28px] border border-dashed border-border-main/60 bg-[#FFFDF9] flex items-center justify-center overflow-hidden">
                {generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt={`Daily report for ${selectedDate}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full min-h-[560px] flex flex-col items-center justify-center gap-6 px-10 text-center">
                    <div className="w-20 h-20 rounded-[20px] border border-border-main bg-white flex items-center justify-center shadow-sm">
                      <FileImage size={32} className="text-primary-accent" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-ink">还没有生成日报图片</p>
                      <p className="text-sm text-stone-400 max-w-md">
                        点击下方按钮后，会把当天记录整理成生图提示词并发出生成请求。等图片写回本地后，这里会自动展示。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateReport}
                      className="px-6 py-3 rounded-[16px] bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                    >
                      一键生成日报
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <div className="bg-paper-mist/30 border border-border-main rounded-[24px] p-6 space-y-4">
            <h4 className="text-xs font-bold text-ink uppercase tracking-widest px-2">历史日报存档</h4>
            <div className="space-y-2">
              {history.length > 0 ? (
                history.map((record) => (
                  <button
                    key={record.date}
                    type="button"
                    onClick={() => setSelectedDate(record.date)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl transition-all border text-sm font-bold',
                      selectedDate === record.date
                        ? 'bg-white border-primary/20 text-primary shadow-sm'
                        : 'bg-transparent border-transparent text-stone-400 hover:bg-white hover:border-border-main hover:text-ink'
                    )}
                  >
                    <span>{record.date}</span>
                    <span className="text-[10px] opacity-60">{record.tasks.length} 项</span>
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
