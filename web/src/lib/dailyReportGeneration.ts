import type { DailyRecord } from '../types';

type DailyReportEligibilityInput = {
  record: DailyRecord | undefined;
  isLoggedIn: boolean;
  userId?: string | null;
  generationCount: number;
};

type DailyReportEligibilityResult =
  | { ok: true }
  | { ok: false; reason: 'login_required' | 'missing_record' | 'limit_reached'; message: string };

export function getDailyReportEligibility(
  input: DailyReportEligibilityInput
): DailyReportEligibilityResult {
  if (!input.isLoggedIn || !input.userId?.trim()) {
    return {
      ok: false,
      reason: 'login_required',
      message: '登录后才能生成日报。'
    };
  }

  if (!input.record || input.record.tasks.length === 0) {
    return {
      ok: false,
      reason: 'missing_record',
      message: '今天还没有任务记录，暂时不能生成日报。'
    };
  }

  if (input.generationCount >= 2) {
    return {
      ok: false,
      reason: 'limit_reached',
      message: '今天的日报生成次数已经用完了，每个账户每天最多生成 2 次。'
    };
  }

  return { ok: true };
}
