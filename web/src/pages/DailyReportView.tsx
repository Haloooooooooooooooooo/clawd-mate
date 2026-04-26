/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getLocalDateKey } from '../lib/date';
import { getDailyReportEligibility } from '../lib/dailyReportGeneration';
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

function normalizeGenerateError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');

  if (!rawMessage.trim()) {
    return '生成日报图片失败了，请稍后再试。';
  }

  if (rawMessage.includes('没有读取到图片 API Key')) {
    return '还没有读取到生图密钥。请检查 `.env.local` 里的 `VORTEXAI_API_KEY` 是否已配置，然后重启应用。';
  }

  if (rawMessage.includes('API Key 无效') || rawMessage.includes('已过期')) {
    return '生图密钥不可用。请更换新的 `VORTEXAI_API_KEY` 后再试。';
  }

  if (rawMessage.includes('太频繁') || rawMessage.includes('额度不足')) {
    return '图片服务当前请求过多，或者账户额度不足。可以稍后再试。';
  }

  if (rawMessage.includes('超时')) {
    return '这次生成超时了。可以直接再点一次“一键生成日报”。';
  }

  if (rawMessage.includes('连接图片服务失败')) {
    return '暂时连不上图片服务。请检查网络，或者确认 `VORTEXAI_API_HOST` 是否正确。';
  }

  if (rawMessage.includes('图片服务暂时不可用')) {
    return '图片服务暂时不稳定，等一会儿再试会更稳。';
  }

  if (rawMessage.includes('当前环境不支持桌面端生图调用')) {
    return '当前这个运行环境不能直接调桌面端生图。请在 Tauri 桌面应用里点击生成日报。';
  }

  if (rawMessage.includes('Cannot read properties of undefined') && rawMessage.includes('invoke')) {
    return '当前这个运行环境还没有连上桌面端生图能力。请重启 Tauri 应用后再试。';
  }

  return rawMessage;
}

async function invokeGenerateDailyReportImage(prompt: string) {
  const tauriInvoke =
    (globalThis as { __TAURI__?: { core?: { invoke?: <T>(command: string, args?: unknown) => Promise<T> } } })
      .__TAURI__?.core?.invoke;

  if (typeof tauriInvoke === 'function') {
    return tauriInvoke<string>('generate_daily_report_image', { prompt });
  }

  try {
    const tauriCore = await import('@tauri-apps/api/core');
    if (typeof tauriCore.invoke === 'function') {
      return tauriCore.invoke<string>('generate_daily_report_image', { prompt });
    }
  } catch {
    // Ignore and fall through to the explicit error below.
  }

  throw new Error('当前环境不支持桌面端生图调用，请在 Tauri 桌面应用里使用日报生成。');
}

export default function DailyReportView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    history,
    isLoggedIn,
    user,
    openLoginModal,
    showToast,
    getDailyReportGenerationCount,
    incrementDailyReportGenerationCount
  } = useStore();

  const generationDateKey = getLocalDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || getLocalDateKey(new Date()));
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const selectedRecord = history.find((record) => record.date === selectedDate);
  const dailyImageSummary = buildDailySummaryForImage(selectedRecord);
  const dailyImagePromptData = buildDailyImagePromptData(dailyImageSummary);
  const dailyImagePromptPayload = buildDailyImagePromptPayload(dailyImageSummary);
  const dailyImagePrompt = buildDailyImagePrompt(dailyImagePromptData);

  useEffect(() => {
    const storedImage = localStorage.getItem(getImageStorageKey(selectedDate));
    setGeneratedImageUrl(storedImage && storedImage.trim().length > 0 ? storedImage : null);
    setGenerateError(null);
  }, [selectedDate]);

  useEffect(() => {
    const dateFromQuery = searchParams.get('date');
    if (dateFromQuery && dateFromQuery !== selectedDate) {
      setSelectedDate(dateFromQuery);
    }
  }, [searchParams, selectedDate]);

  const handleGenerateReport = async () => {
    const eligibility = getDailyReportEligibility({
      record: selectedRecord,
      isLoggedIn,
      userId: user?.id,
      generationCount: getDailyReportGenerationCount(generationDateKey, user?.id)
    });

    if (!eligibility.ok) {
      setGenerateError(eligibility.message);
      showToast(eligibility.message);
      if (eligibility.reason === 'login_required') {
        openLoginModal();
      }
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    localStorage.setItem(getPromptStorageKey(selectedDate), dailyImagePromptPayload);

    try {
      const imageDataUrl = await invokeGenerateDailyReportImage(dailyImagePrompt);
      localStorage.setItem(getImageStorageKey(selectedDate), imageDataUrl);
      setGeneratedImageUrl(imageDataUrl);
      incrementDailyReportGenerationCount(generationDateKey, user?.id);
    } catch (error) {
      setGenerateError(normalizeGenerateError(error));
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('autogen') !== '1') return;
    const requestedDate = searchParams.get('date');
    if (requestedDate && requestedDate !== selectedDate) return;

    void handleGenerateReport().finally(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('autogen');
      setSearchParams(nextParams, { replace: true });
    });
  }, [searchParams, setSearchParams, selectedDate]);

  const handleDownloadReport = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `clawdmate-report-${selectedDate}.png`;
    link.click();
  };

  return (
    <div className="h-[100dvh] overflow-hidden px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5">
      <header className="flex justify-between items-end border-b border-border-main pb-4 shrink-0">
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border-main rounded-[32px] p-5 md:p-6 shadow-sm paper-texture relative overflow-hidden h-full"
          >
            <div className="relative z-10 flex flex-col gap-4 h-full min-h-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-50 rounded-2xl border border-primary/10">
                  <Calendar size={20} className="text-primary-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">REPORT DATE</p>
                  <p className="text-xl font-display font-bold text-ink">{selectedDate}</p>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex justify-center items-start">
                <div className="h-full max-h-full max-w-full aspect-[4/5]">
                  <div className="h-full w-full rounded-[24px] border border-dashed border-border-main/60 bg-[#FFFDF9] flex items-center justify-center overflow-hidden">
                    {generatedImageUrl ? (
                      <img
                        src={generatedImageUrl}
                        alt={`Daily report for ${selectedDate}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-8 md:px-12 text-center">
                        <div className="w-20 h-20 rounded-[20px] border border-border-main bg-white flex items-center justify-center shadow-sm">
                          <FileImage size={32} className="text-primary-accent" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-bold text-ink">还没有生成日报图片</p>
                          <p className="text-sm text-stone-400 max-w-md">
                            点击下方按钮后，会把当天记录整理成生图提示词并请求生成。生成成功后，图片会自动显示在这里。
                          </p>
                          {generateError && (
                            <p className="text-sm text-red-500 max-w-md">{generateError}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleGenerateReport();
                          }}
                          disabled={isGenerating}
                          className="px-6 py-3 rounded-[16px] bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isGenerating ? '生成中...' : '一键生成日报'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6 min-h-0">
          <div className="bg-paper-mist/30 border border-border-main rounded-[24px] p-5 space-y-4 max-h-full overflow-auto">
            <h4 className="text-xs font-bold text-ink uppercase tracking-widest px-2">历史日报存档</h4>
            <div className="space-y-2">
              {history.length > 0 ? (
                history.map((record) => (
                  <button
                    key={record.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(record.date);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set('date', record.date);
                      nextParams.delete('autogen');
                      setSearchParams(nextParams, { replace: true });
                    }}
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
