# 桌宠精灵帧动画实现方案

## 概述

在灵动岛和 Web 端添加一个像素风桌宠，根据任务状态展示不同动画。

**4 种动画状态**：
1. **idle（睡觉）**：无任务 / 所有任务暂停
2. **working（敲键盘）**：有任务正在进行
3. **alert（举牌感叹号）**：有任务超时
4. **celebrate（撒星星）**：用户完成任务（短暂显示）

---

## 第一阶段：帧图绘制

### 1.1 帧图规格

| 状态 | 文件名 | 单帧尺寸 | 帧数 | 动画循环 |
|------|--------|----------|------|----------|
| idle | sleep.png | 512×768 | 4 | 循环 |
| working | clawd-working.png | 362×724 | 6 | 循环 |
| alert | clawd-alert.png | 512×768 | 4 | 循环 |
| celebrate | clawd-celebrate.png | 362×724 | 6 | 循环 |

**精灵图排列方式**：所有帧横向排列在一张图里。

**导出要求**：
- 透明背景（PNG）
- 帧与帧紧挨着，间距均匀
- 保持像素锐利，不要抗锯齿

### 1.2 文件位置

```
pet/sprites/                    # 源文件
├── sleep.png
├── clawd-working.png
├── clawd-alert.png
└── clawd-celebrate.png

web/public/pet/sprites/         # Web 端使用的副本
├── sleep.png
├── clawd-working.png
├── clawd-alert.png
└── clawd-celebrate.png
```

---

## 第二阶段：状态逻辑

### 2.1 状态判断逻辑

```
┌─────────────────────────────────────────────────────────┐
│                      getPetStatus()                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ celebrate 触发中？       │
              │ (用户刚点击完成)         │
              └─────────────────────────┘
                     │           │
                    YES          NO
                     │           │
                     ▼           ▼
              ┌──────────┐  ┌─────────────────────────┐
              │ celebrate│  │ 检查任务状态             │
              └──────────┘  └─────────────────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │ 无任何任务？             │
                          └─────────────────────────┘
                               │           │
                              YES          NO
                               │           │
                               ▼           ▼
                          ┌────────┐  ┌─────────────────────────┐
                          │  idle  │  │ 有任何任务超时？         │
                          └────────┘  │ (倒计时结束)             │
                                      └─────────────────────────┘
                                           │           │
                                          YES          NO
                                           │           │
                                           ▼           ▼
                                      ┌────────┐  ┌─────────────────────────┐
                                      │ alert  │  │ 有任何任务正在进行？     │
                                      └────────┘  └─────────────────────────┘
                                                       │           │
                                                      YES          NO
                                                       │           │
                                                       ▼           ▼
                                                  ┌──────────┐  ┌────────┐
                                                  │ working  │  │  idle  │
                                                  └──────────┘  └────────┘
```

### 2.2 状态定义表

| 条件 | 桌宠状态 | 动画 | 触发场景 |
|------|----------|------|----------|
| 无任何任务 | `idle` | 睡觉 | 首次打开、所有任务完成/取消后 |
| 有任务正在进行（任何一个） | `working` | 敲键盘 | 任务计时中 |
| 有任务超时（主任务或并行任务任一倒计时结束） | `alert` | 举牌感叹号 | 倒计时归零 |
| 所有任务都暂停（没有进行中的，也没有超时的） | `idle` | 睡觉 | 用户手动暂停所有任务 |
| 用户点击完成按钮 | `celebrate` | 撒星星 | 完成任务后短暂显示 |

### 2.3 celebrate 特殊处理

```
用户点击完成按钮
        ↓
触发 celebrate（撒星星）
        ↓
等待 1.5 秒
        ↓
自动恢复到正常状态
        ↓
├─ 无任务 → idle
├─ 有任务超时 → alert
├─ 有任务进行中 → working
└─ 全部暂停 → idle
```

**实现方式**：
```tsx
const [celebrateTrigger, setCelebrateTrigger] = useState(false);

const handleComplete = (taskId: string) => {
  setCelebrateTrigger(true);
  // 实际完成任务的逻辑...

  setTimeout(() => {
    setCelebrateTrigger(false);
  }, 1500);
};

const getPetStatus = (): PetStatus => {
  if (celebrateTrigger) return 'celebrate';
  if (activeOrPausedTasks.length === 0) return 'idle';

  const hasAnyOvertime = activeOrPausedTasks.some(task => remainingTime(task) <= 0);
  if (hasAnyOvertime) return 'alert';

  const hasAnyRunning = activeOrPausedTasks.some(task => task.status === 'active');
  if (hasAnyRunning) return 'working';

  return 'idle';
};
```

---

## 第三阶段：嵌入位置

### 3.1 灵动岛（Dynamic Island）

**文件**：`src/components/dynamic-island/DynamicIsland.tsx`

**替换位置**：
- 无任务时的 🦀 emoji（约第 446-452 行）
- 有暂停任务时的 🦀 emoji（约第 407-409 行）

**容器尺寸**：`h-10 w-10`（40px），使用 `size="sm"`

**代码示例**：
```tsx
import { PetSprite, type PetStatus } from '../../../pet';

// 在组件内
const petStatus = getPetStatus(); // 见 2.3 的实现

// 替换 emoji
<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 shadow-[0_8px_24px_rgba(244,114,182,0.35)] overflow-hidden">
  <PetSprite status={petStatus} size="sm" />
</div>
```

### 3.2 Web Dashboard

**文件**：`web/src/pages/Dashboard.tsx`

**替换位置**：打招呼旁边的螃蟹图片（约第 211-217 行）

**容器尺寸**：`w-24 h-24`（96px），使用 `size="md"`

**代码示例**：
```tsx
import { PetSprite } from '../../pet';

// 在组件内
const petStatus = getPetStatus(); // 需要根据 Dashboard 的任务状态实现

// 替换静态图片
<div className="w-24 h-24 bg-soft-apricot/20 rounded-[4px] flex items-center justify-center border border-border-main shadow-inner">
  <PetSprite status={petStatus} size="md" />
</div>
```

---

## 第四阶段：尺寸配置

**文件**：`pet/config.ts`

```ts
export const PET_SIZES: Record<PetSize, number> = {
  sm: 0.05,   // ~25-38px → 灵动岛
  md: 0.08,   // ~40-60px → Dashboard
  lg: 0.12,   // ~60-90px → 预留
};
```

根据实际显示效果可调整缩放比例。

---

## 第五阶段：实施步骤

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | 绘制/生成帧图 | ✅ 已完成 |
| 2 | 放置图片到 `web/public/pet/sprites/` | ✅ 已完成 |
| 3 | 创建 `PetSprite.tsx` 组件 | ✅ 已完成 |
| 4 | 创建 `config.ts` 配置 | ✅ 已完成 |
| 5 | 实现状态判断逻辑 `getPetStatus()` | ⏳ 待完成 |
| 6 | 实现 celebrate 触发与恢复 | ⏳ 待完成 |
| 7 | 嵌入灵动岛 DynamicIsland | ⏳ 待完成 |
| 8 | 嵌入 Dashboard | ⏳ 待完成 |
| 9 | 测试各状态切换 | ⏳ 待完成 |

---

## 参考资料


- [CSS Sprite Animation Tutorial](https://css-tricks.com/snippets/css/using-css-sprites/)
- [Aseprite 官方文档](https://www.aseprite.org/docs/)
- [Piskel 在线编辑器](https://www.piskelapp.com)
