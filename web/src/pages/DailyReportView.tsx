/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, Share2, Calendar, FileImage } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { getLocalDateKey } from '../lib/date';
import { getDailyReportEligibility } from '../lib/dailyReportGeneration';
import { cn } from '../lib/utils';
import {
  buildDailyImagePrompt,
  buildDailyImagePromptData,
  buildDailyImagePromptPayload,
  buildDailySummaryForImage
} from '../lib/dailyImageSummary';

const REPORT_IMAGE_STORAGE_PREFIX = 'clawdmate-daily-report-image:';
const REPORT_IMAGE_LIST_STORAGE_PREFIX = 'clawdmate-daily-report-images:';
const REPORT_PROMPT_STORAGE_PREFIX = 'clawdmate-daily-report-prompt:';
const REPORT_DEBUG_STORAGE_PREFIX = 'clawdmate-daily-report-debug:';

type GenerateDebugError = Error & {
  debugLogs?: string[];
};

type GenerateDailyReportResult = {
  imageDataUrl: string;
  source: 'cloud-api' | 'tauri-global' | 'tauri-module';
  debugLogs: string[];
};

function triggerDirectDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getImageStorageKey(date: string) {
  return `${REPORT_IMAGE_STORAGE_PREFIX}${date}`;
}

function getImageListStorageKey(date: string) {
  return `${REPORT_IMAGE_LIST_STORAGE_PREFIX}${date}`;
}

function getPromptStorageKey(date: string) {
  return `${REPORT_PROMPT_STORAGE_PREFIX}${date}`;
}

function getDebugStorageKey(date: string) {
  return `${REPORT_DEBUG_STORAGE_PREFIX}${date}`;
}

function debugTimestamp() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function appendDebugLog(logs: string[], message: string) {
  const next = `${debugTimestamp()} ${message}`;
  logs.push(next);
  console.log(`[daily-report] ${next}`);
}

function createGenerateError(message: string, debugLogs: string[]) {
  const error = new Error(message) as GenerateDebugError;
  error.debugLogs = [...debugLogs];
  return error;
}

function normalizeGenerateError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');

  if (!rawMessage.trim()) {
    return '生成日报图片失败了，请稍后再试。';
  }

  if (rawMessage.includes('没有读取到图片 API Key')) {
    return '还没有读取到生图密钥。请检查 `.env.local` 里的 `VORTEXAI_API_KEY`，然后重启应用。';
  }

  if (rawMessage.includes('missing_image_api_key')) {
    return '服务端还没有配置生图密钥，请联系管理员配置 IMAGE_API_KEY。';
  }

  if (rawMessage.includes('API Key 无效') || rawMessage.includes('已过期')) {
    return '生图密钥不可用。请更换新的 `VORTEXAI_API_KEY` 后再试。';
  }

  if (rawMessage.includes('太频繁') || rawMessage.includes('额度不足') || rawMessage.toLowerCase().includes('rate limit')) {
    return '图片服务当前请求过多，或账户额度不足。可以稍后再试。';
  }

  if (rawMessage.includes('524') || rawMessage.includes('bad_response_status_code')) {
    return '图片服务处理超时。这次请求已发到服务端，但没有及时返回，请稍后重试。';
  }

  if (rawMessage.includes('超时')) {
    return '这次生成超时了。图片服务返回较慢，可以稍后再试。';
  }

  if (rawMessage.includes('连接图片服务失败')) {
    return '暂时连不上图片服务。请检查网络，或确认 `VORTEXAI_API_HOST` 是否正确。';
  }

  if (rawMessage.includes('图片服务暂时不可用')) {
    return '图片服务暂时不稳定，等一会再试会更稳。';
  }

  if (rawMessage.includes('当前环境还没有连上桌面端生图能力')) {
    return '当前环境还没有连上桌面端生图能力。请先运行 `npm run dev:island`，再在 5173 页面里生成日报。';
  }

  if (rawMessage.includes('当前环境不支持桌面端生图调用')) {
    return '当前这个运行环境不能直接调桌面端生图。请在 Tauri 桌面应用里点击生成日报。';
  }

  if (rawMessage.includes('Cannot read properties of undefined') && rawMessage.includes('invoke')) {
    return '当前环境还没有连上桌面端生图能力。请先运行 `npm run dev:island`，再在 5173 页面里生成日报。';
  }

  return rawMessage;
}

async function invokeGenerateDailyReportImage(prompt: string): Promise<GenerateDailyReportResult> {
  const debugLogs: string[] = [];
  let cloudErrorMessage = '';
  appendDebugLog(debugLogs, `start promptLength=${prompt.length}`);
  const gatewayUrl = (import.meta.env.VITE_IMAGE_GATEWAY_URL || '/api/daily-report-image').trim();

  appendDebugLog(debugLogs, `try source=cloud-api url=${gatewayUrl}`);
  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (response.ok) {
      const payload = (await response.json()) as { imageDataUrl?: string };
      const imageDataUrl = (payload.imageDataUrl || '').trim();
      if (!imageDataUrl) {
        throw new Error('cloud_api_empty_image');
      }
      appendDebugLog(debugLogs, `success source=cloud-api urlLength=${imageDataUrl.length}`);
      return { imageDataUrl, source: 'cloud-api', debugLogs };
    }

    const errorPayload = (await response.json().catch(() => ({}))) as { error?: string };
    const message = errorPayload.error || `cloud_api_failed_${response.status}`;
    cloudErrorMessage = message;
    appendDebugLog(debugLogs, `fail source=cloud-api message=${message}`);
  } catch (error) {
    cloudErrorMessage = error instanceof Error ? error.message : String(error);
    appendDebugLog(
      debugLogs,
      `fail source=cloud-api message=${cloudErrorMessage}`
    );
  }

  const tauriInvoke =
    (globalThis as { __TAURI__?: { core?: { invoke?: <T>(command: string, args?: unknown) => Promise<T> } } })
      .__TAURI__?.core?.invoke;

  if (typeof tauriInvoke === 'function') {
    appendDebugLog(debugLogs, 'try source=tauri-global');
    try {
      const imageDataUrl = await tauriInvoke<string>('generate_daily_report_image', { prompt });
      appendDebugLog(debugLogs, `success source=tauri-global urlLength=${imageDataUrl.length}`);
      return { imageDataUrl, source: 'tauri-global', debugLogs };
    } catch (error) {
      appendDebugLog(
        debugLogs,
        `fail source=tauri-global message=${error instanceof Error ? error.message : String(error)}`
      );
      throw createGenerateError(error instanceof Error ? error.message : String(error), debugLogs);
    }
  }

  if (!cloudErrorMessage.trim()) {
    cloudErrorMessage = '当前环境不支持桌面端生图调用。';
  }

  try {
    appendDebugLog(debugLogs, 'try source=tauri-module');
    const tauriCore = await import('@tauri-apps/api/core');
    if (typeof tauriCore.invoke === 'function') {
      const imageDataUrl = await tauriCore.invoke<string>('generate_daily_report_image', { prompt });
      appendDebugLog(debugLogs, `success source=tauri-module urlLength=${imageDataUrl.length}`);
      return { imageDataUrl, source: 'tauri-module', debugLogs };
    }
    appendDebugLog(debugLogs, 'skip source=tauri-module invoke-missing');
    throw createGenerateError(cloudErrorMessage, debugLogs);
  } catch (error) {
    if (error instanceof Error && 'debugLogs' in error) {
      throw error;
    }
    appendDebugLog(
      debugLogs,
      `fail source=tauri-module message=${error instanceof Error ? error.message : String(error)}`
    );
    throw createGenerateError(cloudErrorMessage || (error instanceof Error ? error.message : String(error)), debugLogs);
  }
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
    incrementDailyReportGenerationCount,
    getDailyReportImages,
    addDailyReportImage,
    dailyReportImagesByDate
  } = useStore();

  const generationDateKey = getLocalDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || getLocalDateKey(new Date()));
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateDebug, setGenerateDebug] = useState<string[]>([]);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});

  const isGeneratingRef = useRef(false);
  const handledAutogenRef = useRef<string | null>(null);

  const selectedRecord = history.find((record) => record.date === selectedDate);
  const dailyImageSummary = buildDailySummaryForImage(selectedRecord);
  const dailyImagePromptData = buildDailyImagePromptData(dailyImageSummary);
  const dailyImagePromptPayload = buildDailyImagePromptPayload(dailyImageSummary);
  const dailyImagePrompt = buildDailyImagePrompt(dailyImagePromptData);
  const generatedImageUrl = generatedImageUrls[selectedImageIndex] || null;
  const selectedImageLoadFailed = generatedImageUrl ? Boolean(failedImageUrls[generatedImageUrl]) : false;

  useEffect(() => {
    const cloudImages = getDailyReportImages(selectedDate);
    if (cloudImages.length > 0) {
      const urls = cloudImages.map((item) => item.imageDataUrl).filter((item) => item.trim().length > 0).slice(-2);
      setGeneratedImageUrls(urls);
      setSelectedImageIndex(urls.length > 0 ? urls.length - 1 : 0);
      return;
    }

    const storedListRaw = localStorage.getItem(getImageListStorageKey(selectedDate));
    let storedList: string[] = [];
    if (storedListRaw) {
      try {
        const parsed = JSON.parse(storedListRaw);
        if (Array.isArray(parsed)) {
          storedList = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        storedList = [];
      }
    }
    const legacyImage = localStorage.getItem(getImageStorageKey(selectedDate));
    if (storedList.length === 0 && legacyImage && legacyImage.trim().length > 0) {
      storedList = [legacyImage];
    }
    const storedDebug = localStorage.getItem(getDebugStorageKey(selectedDate));
    const visibleImages = storedList.slice(-2);
    setGeneratedImageUrls(visibleImages);
    setSelectedImageIndex(visibleImages.length > 0 ? visibleImages.length - 1 : 0);
    setGenerateDebug(storedDebug ? storedDebug.split('\n').filter(Boolean) : []);
    setGenerateError(null);
    setFailedImageUrls({});
  }, [selectedDate, getDailyReportImages]);

  useEffect(() => {
    const dateFromQuery = searchParams.get('date');
    if (dateFromQuery && dateFromQuery !== selectedDate) {
      setSelectedDate(dateFromQuery);
    }
  }, [searchParams, selectedDate]);

  const reportDates = useMemo(() => {
    const fromHistory = history.map((record) => record.date);
    const fromCloud = Object.keys(dailyReportImagesByDate || {});
    const fromLocal = new Set<string>();

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(REPORT_IMAGE_LIST_STORAGE_PREFIX)) continue;
      const date = key.slice(REPORT_IMAGE_LIST_STORAGE_PREFIX.length);
      if (date) fromLocal.add(date);
    }

    return Array.from(new Set([...fromHistory, ...fromCloud, ...Array.from(fromLocal)])).sort((a, b) =>
      a > b ? -1 : 1
    );
  }, [history, dailyReportImagesByDate]);

  const handleGenerateReport = async (
    trigger: 'manual' | 'autogen' = 'manual'
  ): Promise<{ started: boolean; blockedReason?: 'login_required' | 'missing_record' | 'limit_reached' }> => {
    if (isGeneratingRef.current) {
      return { started: false };
    }

    // Fast-path guard: if today's report already has 2 images, block immediately.
    if (isLoggedIn && selectedDate === generationDateKey && generatedImageUrls.length >= 2) {
      const message = '今天最多生成 2 张日报图片，明天再来吧。';
      setGenerateError(message);
      showToast(message);
      return { started: false, blockedReason: 'limit_reached' };
    }

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
      return { started: false, blockedReason: eligibility.reason };
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);

    const startDebug = [
      `${debugTimestamp()} trigger=${trigger} date=${selectedDate}`,
      `${debugTimestamp()} promptPayloadLength=${dailyImagePromptPayload.length}`,
      `${debugTimestamp()} promptLength=${dailyImagePrompt.length}`
    ];

    setGenerateDebug(startDebug);
    localStorage.setItem(getDebugStorageKey(selectedDate), startDebug.join('\n'));
    localStorage.setItem(getPromptStorageKey(selectedDate), dailyImagePromptPayload);

    try {
      const result = await invokeGenerateDailyReportImage(dailyImagePrompt);
      const nextDebug = [...startDebug, ...result.debugLogs, `${debugTimestamp()} source=${result.source}`];
      const nextImages = [...generatedImageUrls, result.imageDataUrl].slice(-2);
      localStorage.setItem(getImageStorageKey(selectedDate), result.imageDataUrl);
      localStorage.setItem(getImageListStorageKey(selectedDate), JSON.stringify(nextImages));
      localStorage.setItem(getDebugStorageKey(selectedDate), nextDebug.join('\n'));
      setGeneratedImageUrls(nextImages);
      setSelectedImageIndex(Math.max(0, nextImages.length - 1));
      setGenerateDebug(nextDebug);
      addDailyReportImage(selectedDate, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageDataUrl: result.imageDataUrl,
        promptPayload: dailyImagePromptPayload,
        debugLogs: nextDebug,
        createdAt: Date.now()
      });
      incrementDailyReportGenerationCount(generationDateKey, user?.id);
    } catch (error) {
      const debugLogs = (error as GenerateDebugError).debugLogs ?? startDebug;
      localStorage.setItem(getDebugStorageKey(selectedDate), debugLogs.join('\n'));
      setGenerateDebug(debugLogs);
      setGenerateError(normalizeGenerateError(error));
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }

    return { started: true };
  };

  useEffect(() => {
    const autogen = searchParams.get('autogen');
    if (autogen !== '1') {
      handledAutogenRef.current = null;
      return;
    }

    const requestedDate = searchParams.get('date') || selectedDate;
    if (requestedDate !== selectedDate) return;

    const autogenKey = `${requestedDate}:${autogen}`;
    if (handledAutogenRef.current === autogenKey || isGeneratingRef.current) {
      return;
    }

    void (async () => {
      const result = await handleGenerateReport('autogen');
      if (!result.started && result.blockedReason !== 'limit_reached') {
        handledAutogenRef.current = null;
        return;
      }

      handledAutogenRef.current = autogenKey;
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('autogen');
      setSearchParams(nextParams, { replace: true });
    })();
  }, [searchParams, selectedDate, selectedRecord, isLoggedIn, user?.id, setSearchParams]);

  const handleDownloadReport = async () => {
    if (!generatedImageUrl) return;
    const filename = `clawdmate-report-${selectedDate}.png`;

    try {
      // Always prefer blob download to keep user in-browser and avoid navigation.
      let downloadUrl = generatedImageUrl;
      let tempObjectUrl: string | null = null;

      if (!generatedImageUrl.startsWith('data:') && !generatedImageUrl.startsWith('blob:')) {
        const response = await fetch(generatedImageUrl);
        if (!response.ok) {
          throw new Error(`download_failed_${response.status}`);
        }
        const blob = await response.blob();
        tempObjectUrl = URL.createObjectURL(blob);
        downloadUrl = tempObjectUrl;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (tempObjectUrl) {
        URL.revokeObjectURL(tempObjectUrl);
      }
      showToast('日报图片已开始下载');
    } catch (error) {
      console.error('[daily-report] download failed', error);
      showToast('下载失败：当前图片链接不支持浏览器直下');
    }
  };

  const handleShareReport = async () => {
    if (!generatedImageUrl) {
      showToast('请先生成日报图片');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedImageUrl);
      showToast('已复制图片链接');
    } catch (error) {
      console.error('[daily-report] share failed', error);
      showToast('复制失败，请稍后重试');
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5">
      <header className="flex justify-between items-end border-b border-border-main pb-4 shrink-0">
        <div className="space-y-1">
          <h3 className="font-display text-4xl text-ink font-bold leading-tight">每日复盘</h3>
        </div>
        <div className="flex gap-3">
          {generatedImageUrl ? (
            <button
              type="button"
              onClick={() => {
                void handleGenerateReport('manual');
              }}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-border-main rounded-xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
              重新生成
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleDownloadReport();
            }}
            disabled={!generatedImageUrl}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border-main rounded-xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            下载日报
          </button>
          <button
            type="button"
            onClick={() => {
              void handleShareReport();
            }}
            disabled={!generatedImageUrl}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
                      selectedImageLoadFailed ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                          <p className="text-sm font-semibold text-stone-500">这张日报图片链接已失效</p>
                          <p className="text-xs text-stone-400">可以切换到另一张，或点击“重新生成”获得新图片。</p>
                        </div>
                      ) : (
                        <img
                          src={generatedImageUrl}
                          alt={`Daily report for ${selectedDate}`}
                          className="w-full h-full object-contain"
                          onError={() => {
                            setFailedImageUrls((prev) => ({ ...prev, [generatedImageUrl]: true }));
                          }}
                        />
                      )
                    ) : isGenerating ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-5 px-8 md:px-12">
                        <div className="daily-report-loader" aria-live="polite" aria-label="正在生成日报">
                          <span className="daily-report-loader__circle" />
                          <span className="daily-report-loader__circle" />
                          <span className="daily-report-loader__circle" />
                          <span className="daily-report-loader__shadow" />
                          <span className="daily-report-loader__shadow" />
                          <span className="daily-report-loader__shadow" />
                        </div>
                        <p className="text-sm font-semibold text-stone-500">正在生成日报，请稍等</p>
                      </div>
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
                          {generateError && <p className="text-sm text-red-500 max-w-md">{generateError}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleGenerateReport('manual');
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

              {generatedImageUrls.length > 1 ? (
                <div className="flex items-center justify-center gap-2">
                  {generatedImageUrls.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        'px-3 py-1 rounded-lg border text-xs font-bold transition-all',
                        idx === selectedImageIndex
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-stone-500 border-border-main hover:text-ink'
                      )}
                    >
                      图 {idx + 1}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6 min-h-0">
          <div className="bg-paper-mist/30 border border-border-main rounded-[24px] p-5 space-y-4 max-h-full overflow-auto">
            <h4 className="text-xs font-bold text-ink uppercase tracking-widest px-2">历史日报存档</h4>

            <div className="space-y-2">
              {reportDates.length > 0 ? (
                reportDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set('date', date);
                      nextParams.delete('autogen');
                      setSearchParams(nextParams, { replace: true });
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl transition-all border text-sm font-bold bg-white',
                      selectedDate === date
                        ? 'border-primary/20 text-primary shadow-sm'
                        : 'border-border-main/70 text-stone-500 hover:border-border-main hover:text-ink'
                    )}
                  >
                    <span>{date}</span>
                    <span className="text-[10px] opacity-60">查看</span>
                  </button>
                ))
              ) : (
                <p className="text-stone-300 text-center py-8 text-xs italic">暂无已生成日报</p>
              )}
            </div>

            <div className="px-2 space-y-2 border-t border-border-main/40 pt-3">
              {generatedImageUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {generatedImageUrls.map((url, idx) => (
                    <button
                      key={`${selectedDate}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        'aspect-[3/4] max-w-[110px] rounded-lg overflow-hidden border',
                        idx === selectedImageIndex ? 'border-primary shadow-sm' : 'border-border-main/60'
                      )}
                    >
                      {failedImageUrls[url] ? (
                        <div className="w-full h-full flex items-center justify-center px-2 text-[10px] font-semibold text-stone-400 bg-stone-50">
                          链接失效
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt={`report thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setFailedImageUrls((prev) => ({ ...prev, [url]: true }));
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">该日期还没有已生成图片。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
