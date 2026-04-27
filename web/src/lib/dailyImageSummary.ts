import type {
  DailyImagePromptData,
  DailyImageTaskInput,
  DailyRecord,
  DailySummaryForImage,
  DailySummaryTimelineItem,
  Task
} from '../types';
import { getTaskActualDurationSeconds } from './taskTime';

const summaryList = [
  '今天也没有浪费',
  '已经很棒了，继续慢慢来',
  '每一点努力都算数',
  '普通的一天，但很充实',
  '今天也在认真生活',
  '小小进步也值得开心',
  '已经比昨天更好了',
  '慢慢走，但没有停下',
  '今天也向前走了一点点',
  '努力的痕迹都留下了'
] as const;

function formatFinishedAt(task: Pick<Task, 'endTime' | 'createdAt'>): string {
  const timestamp = task.endTime ?? task.createdAt;
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function toTimelineItem(task: Task): DailySummaryTimelineItem | null {
  if (task.status !== 'done' && task.status !== 'cancelled') {
    return null;
  }

  return {
    title: task.title,
    status: task.status,
    finishedAt: formatFinishedAt(task),
    actualMinutes: Math.floor(getTaskActualDurationSeconds(task) / 60)
  };
}

function pickSummaryText(date: string) {
  const seed = Array.from(date).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return summaryList[seed % summaryList.length];
}

function toPromptTask(item: DailySummaryTimelineItem): DailyImageTaskInput {
  return {
    time: item.finishedAt,
    status: item.status === 'done' ? 'completed' : 'cancelled',
    title: item.title,
    duration: item.actualMinutes
  };
}

function inferTaskScene(title: string, status: DailyImageTaskInput['status']) {
  const normalized = title.trim().toLowerCase();
  let scene = `Clawd 在温柔的小桌前认真处理“${title}”，桌面有纸张、文具和柔和小灯。`;

  if (/(英语|单词|背词|词汇|english|vocab)/.test(normalized)) {
    scene = `Clawd 坐在草地小垫子上翻单词卡，身边有铅笔和小本子，在认真背“${title}”。`;
  } else if (/(作业|练习|题目|刷题|习题|homework)/.test(normalized)) {
    scene = `Clawd 趴在木质小桌前写字做题，桌上摊开纸张和文具，在认真完成“${title}”。`;
  } else if (/(代码|编程|开发|coding|code|bug|agent)/.test(normalized)) {
    scene = `Clawd 坐在电脑前专注敲代码，屏幕有柔和微光，在处理“${title}”。`;
  } else if (/(笔记|整理|复盘|总结|回顾)/.test(normalized)) {
    scene = `Clawd 坐在圆桌旁整理纸张和便签，把内容一张张分类，处理“${title}”。`;
  } else if (/(阅读|看书|读书|文章|书籍)/.test(normalized)) {
    scene = `Clawd 坐在树下或草地野餐垫上安静看书，身边有几本书和小杯子，在完成“${title}”。`;
  } else if (/(设计|海报|插画|ui|界面|logo)/.test(normalized)) {
    scene = `Clawd 站在画板前创作，旁边摆着色卡和草稿，在处理“${title}”。`;
  } else if (/(运动|跑步|散步|锻炼|健身)/.test(normalized)) {
    scene = `Clawd 在花草围绕的小路上慢跑或活动身体，完成“${title}”。`;
  } else if (/(吃饭|午饭|晚饭|早饭|做饭)/.test(normalized)) {
    scene = `Clawd 坐在小餐桌前吃饭或准备食物，桌上有餐盘和热气，在完成“${title}”。`;
  } else if (/(打扫|收拾|清理|房间)/.test(normalized)) {
    scene = `Clawd 拿着小扫帚或收纳盒整理小屋，把物品一点点归位，处理“${title}”。`;
  }

  if (status === 'cancelled') {
    return `${scene} 这个场景放在地图角落区域，Clawd 动作停下来稍作休息，带一点点遗憾，但不要消极。`;
  }

  return `${scene} 这个场景更明亮，Clawd 动作积极投入，体现完成任务的状态。`;
}

export function buildDailySummaryForImage(record: DailyRecord | undefined): DailySummaryForImage | null {
  if (!record) return null;

  const timeline = record.tasks
    .map(toTimelineItem)
    .filter((item): item is DailySummaryTimelineItem => Boolean(item));

  return {
    date: record.date,
    overview: {
      completedCount: timeline.filter((item) => item.status === 'done').length,
      cancelledCount: timeline.filter((item) => item.status === 'cancelled').length,
      totalFocusMinutes: timeline
        .filter((item) => item.status === 'done')
        .reduce((sum, item) => sum + item.actualMinutes, 0)
    },
    timeline
  };
}

export function buildDailyImagePromptPayload(summary: DailySummaryForImage | null): string {
  if (!summary) {
    return '日期：暂无记录';
  }

  const timelineLines =
    summary.timeline.length > 0
      ? summary.timeline
          .map((item) => {
            const statusLabel = item.status === 'done' ? '完成' : '取消';
            return `${item.finishedAt}，${statusLabel}，${item.title}，${item.actualMinutes} 分钟`;
          })
          .join('\n')
      : '暂无任务记录';

  return [
    `日期：${summary.date}`,
    `完成 ${summary.overview.completedCount} 项，取消 ${summary.overview.cancelledCount} 项，总实际专注时长 ${summary.overview.totalFocusMinutes} 分钟。`,
    '',
    '时间线：',
    timelineLines
  ].join('\n');
}

export function buildDailyImagePromptData(summary: DailySummaryForImage | null): DailyImagePromptData | null {
  if (!summary) return null;

  return {
    date: summary.date,
    completed_count: summary.overview.completedCount,
    cancelled_count: summary.overview.cancelledCount,
    focus_time: summary.overview.totalFocusMinutes,
    tasks: summary.timeline.map(toPromptTask),
    summary_text: pickSummaryText(summary.date)
  };
}

export function buildDailyTaskBlock(data: DailyImagePromptData | null): string {
  if (!data || data.tasks.length === 0) {
    return '今天没有明确任务场景，画面以温柔生活地图和轻松留白为主。';
  }

  return data.tasks
    .map((task) => {
      const statusLabel = task.status === 'completed' ? '已完成' : '已取消';
      return `${task.time}，${statusLabel}，${task.title}，${task.duration}分钟：${inferTaskScene(
        task.title,
        task.status
      )}`;
    })
    .join('\n');
}

export function buildDailyImagePrompt(data: DailyImagePromptData | null): string {
  if (!data) {
    return '生成一张温柔治愈的像素插画，主角严格参考 png/clawd.png 中的橙色像素角色，画面表现今天暂无任务记录的轻松生活地图场景。';
  }

  const taskBlock = buildDailyTaskBlock(data);

  return `生成一张治愈系像素插画，用于小红书竖版分享。

主角必须严格参考我提供的图片 png/clawd.png：
- 所有角色都必须是同一个 Clawd
- 不允许改成其他动物或重新设计角色
- 角色造型（轮廓、比例、颜色、眼睛）必须完全一致，不允许风格化或细节变化

整体风格：
- 像素角色 + 柔和手绘场景
- 低饱和奶油色、浅绿色、暖橙色
- 温柔治愈，轻微纸张质感

画面构图：
- 竖版生活地图
- 多个任务场景分布在同一张地图中
- 每个任务一个独立区域，每个区域都有 Clawd 在做对应事情，动作必须不同
- 用小路连接各区域
- 有前景、中景、背景层次，并存在遮挡关系（例如树遮挡桌子的一部分）
- 顶部留标题空间，底部留总结区域

任务场景：
${taskBlock}

标题：
今天也有在认真生活

副标题：
不完美的一天，也很可爱呀

底部左侧为“今日小结”卡片，内容：
今日小结
完成 ${data.completed_count} 项
取消 ${data.cancelled_count} 项
专注 ${data.focus_time} 分钟

底部右侧为小尺寸便利贴标语：
${data.summary_text}

要求：
不要 UI 界面、不要图表、不要科技感、不要高饱和。
重点是统一角色、场景叙事感、温柔生活氛围。`;
}
