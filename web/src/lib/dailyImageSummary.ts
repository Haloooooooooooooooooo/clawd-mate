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
  '今天也没有浪费 🌿',
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
  let scene = `Clawd在温柔的小桌前认真完成“${title}”，桌上放着纸张、文具和暖色小台灯，场景生活化且细节柔和。`;

  if (/(英语|单词|背词|词汇|english|vocab)/.test(normalized)) {
    scene = `Clawd坐在草地上的小垫子上翻单词卡，旁边放着铅笔和小本子，像在认真背“${title}”。`;
  } else if (/(作业|练习|题目|刷题|习题|homework)/.test(normalized)) {
    scene = `Clawd趴在木质小桌前写字做题，桌上摊开纸张和文具，像在认真完成“${title}”。`;
  } else if (/(代码|编程|开发|coding|code|bug|agent)/.test(normalized)) {
    scene = `Clawd坐在电脑前敲代码，屏幕发出柔和微光，桌边散落便签，像在专注处理“${title}”。`;
  } else if (/(笔记|整理|复盘|总结|回顾)/.test(normalized)) {
    scene = `Clawd坐在小桌旁整理纸张和便签，把内容一张张归类摆好，像在处理“${title}”。`;
  } else if (/(阅读|看书|读书|文章|书)/.test(normalized)) {
    scene = `Clawd坐在树下或窗边看书，手边有打开的书页和小杯子，像在安静完成“${title}”。`;
  } else if (/(画|设计|海报|插画|ui|界面|logo)/.test(normalized)) {
    scene = `Clawd站在画板前涂涂画画，旁边摆着颜料和小样稿，像在创作“${title}”。`;
  } else if (/(运动|跑步|散步|锻炼|健身)/.test(normalized)) {
    scene = `Clawd在蜿蜒的小路上慢跑或活动身体，周围是草地和小树，像在完成“${title}”。`;
  } else if (/(吃饭|午饭|晚饭|早餐|做饭)/.test(normalized)) {
    scene = `Clawd坐在小餐桌前吃饭或准备食物，桌上有餐盘和热气，像在完成“${title}”。`;
  } else if (/(打扫|收拾|清理|房间)/.test(normalized)) {
    scene = `Clawd拿着小扫帚或收纳盒整理小屋，把散落物品一点点归位，像在处理“${title}”。`;
  }

  if (status === 'cancelled') {
    return `${scene} 这个场景放在画面角落区域，Clawd动作停下来稍微休息或有一点点遗憾，但整体依然温和，不消极。`;
  }

  return `${scene} 这个场景更明亮，Clawd动作积极投入，画面有轻微成就感。`;
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
    .map((task, index) => {
      const statusLabel = task.status === 'completed' ? '已完成' : '已取消';
      return `${index + 1}. ${task.time}，${statusLabel}，${task.title}，${task.duration}分钟：\n${inferTaskScene(task.title, task.status)}`;
    })
    .join('\n\n');
}

export function buildDailyImagePrompt(data: DailyImagePromptData | null): string {
  if (!data) {
    return '生成一张温柔治愈的像素风竖版插画，表现“今天暂无任务记录”的轻松留白生活场景。';
  }

  const taskBlock = buildDailyTaskBlock(data);

  return `生成一张“治愈系像素插画”，用于小红书发布，必须是竖版构图。

【画面比例】
竖版 4:5（1024x1365 或 1200x1600）

【主角设定】
主角是一只橙色像素小宠物 Clawd（参考图片：/clawd.png）。
保持角色造型一致。
在同一张画面里出现多个 Clawd，每个 Clawd 分别对应一个今日任务场景。

【整体风格】
像素风 + 扁平漫画风。
低饱和、小清新配色：奶油色、浅绿色、暖橙色。
整体温柔治愈，带轻微纸张质感，适合小红书分享。

【构图】
做成竖向“生活地图”构图。
上中下分层，小路连接不同任务场景。
有草地、小桥、小桌子、小屋、树、石阶等元素。
有前景、中景、背景层次。
顶部留出标题留白，底部留出总结卡片空间。

【今日数据】
日期：${data.date}
完成 ${data.completed_count} 项，取消 ${data.cancelled_count} 项，总专注 ${data.focus_time} 分钟

【任务场景】
${taskBlock}

【任务标签规则】
每个任务旁边用轻量小气泡标注：时间 + 任务名称。
不要做成 UI 面板，不要做成表格，不要复杂信息卡片。

【标题文案】
今天也有在认真生活

【副标题】
不完美的一天，也很可爱呀

【底部小结卡片】
手账贴纸风，小巧、温柔、可爱。
内容：
今日小结
完成 ${data.completed_count} 项
取消 ${data.cancelled_count} 项
专注 ${data.focus_time} 分钟
${data.summary_text}

【限制】
不要 UI 面板、不要图表、不要写实、不要高饱和、不要科技感海报风。

【要求】
角色一致，场景分区清晰，留白自然，画面适合小红书发布。`;
}
