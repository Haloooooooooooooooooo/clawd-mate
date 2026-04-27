# 桌宠精灵帧动画实现方案

## 概述

在灵动岛和 Web 端添加一个像素风桌宠，根据任务状态展示不同动画。

**4 种动画状态**：
1. **idle（睡觉）**：没有任务时
2. **working（敲键盘）**：任务进行中
3. **alert（举牌感叹号）**：倒计时结束
4. **celebrate（撒星星）**：任务完成

---

## 第一阶段：帧图绘制


### 1.1 帧图规格

| 状态 | 建议帧数 | 尺寸建议 | 动画循环 |
|------|----------|----------|----------|
| 睡觉 idle | 4-6 帧 | 32×32 或 48×48 | 循环播放 |
| 敲键盘 working | 6-8 帧 | 32×32 或 48×48 | 循环播放 |
| 举牌感叹号 alert | 4-6 帧 | 32×48（需要举牌空间） | 循环 |
| 撒星星 celebrate | 6-8 帧 | 48×48（需要星星空间） | 播放一次 |

**像素尺寸建议**：保持 2 的幂次方（16/32/64），方便渲染和缩放。

### 1.2 工具推荐

- **Aseprite**（推荐，约 $20）：专业像素动画工具，可直接导出精灵图
- **Piskel**（免费在线）：https://www.piskelapp.com
- **Pixelorama**（免费开源）：类似 Aseprite

### 1.3 精灵图排列方式

将所有帧**横向排列**在一张图里：

```
clawd-idle.png (睡觉):
┌────┬────┬────┬────┐
│帧1 │帧2 │帧3 │帧4 │
└────┴────┴────┴────┘
总宽度 = 单帧宽度 × 帧数
```

**导出要求**：
- 透明背景（PNG）
- 帧与帧紧挨着，不要间距
- 保持像素锐利，不要抗锯齿

### 1.4 文件命名与位置

```
pet/
├── sprites/
│   ├── clawd-idle.png      # 睡觉动画帧图
│   ├── clawd-working.png   # 敲键盘动画帧图
│   ├── clawd-alert.png     # 举牌感叹号帧图
│   └── clawd-celebrate.png # 撒星星动画帧图
└── README.md               # 本文档
```

---

## 第二阶段：代码实现

### 2.1 组件结构

```
pet/
├── PetSprite.tsx      # 桌宠精灵动画组件
├── PetSprite.css      # 动画样式
├── sprites/           # 帧图资源
└── index.ts           # 导出入口
```

### 2.2 PetSprite 组件接口

```tsx
type PetStatus = 'idle' | 'working' | 'alert' | 'celebrate'

interface PetSpriteProps {
  status: PetStatus
  size?: 'sm' | 'md' | 'lg'  // 16px / 32px / 48px
  className?: string
}
```

### 2.3 CSS 动画原理

```css
.pet-sprite {
  width: 32px;           /* 单帧宽度 */
  height: 32px;          /* 单帧高度 */
  background-repeat: no-repeat;
  image-rendering: pixelated;  /* 保持像素锐利 */
}

.pet-idle {
  background-image: url('./sprites/clawd-idle.png');
  animation: play-frames 0.8s steps(4) infinite;
}

@keyframes play-frames {
  from { background-position: 0 0; }
  to   { background-position: -128px 0; }  /* 总宽度 = 32 × 4帧 */
}
```

**关键点**：
- `steps(N)` = 帧数，让动画逐帧跳跃而不是平滑过渡
- `background-position` 的终点 = 单帧宽度 × 帧数
- `infinite` = 循环播放，去掉则播放一次

---

## 第三阶段：状态联动

### 3.1 状态触发逻辑

| 桌宠状态 | 触发条件 |
|----------|----------|
| idle | 无正在进行中的任务 |
| working | 有任务正在进行（计时中） |
| alert | 倒计时结束/任务超时 |
| celebrate | 任务标记完成（播放一次后回到 idle） |

### 3.2 与现有代码集成（未来）

当帧图准备好后，在以下位置嵌入：

- `src/components/dynamic-island/CollapsedView.tsx`：缩小版桌宠
- `src/components/dynamic-island/ExpandedView.tsx`：正常尺寸桌宠
- `src/stores/taskStore.ts`：添加 petStatus 状态

---

## 实施步骤

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | 绘制帧图 | ⏳ 待完成 |
| 2 | 放置图片到 `pet/sprites/` | ⏳ 待完成 |
| 3 | 创建 `PetSprite.tsx` 组件 | ⏳ 待完成 |
| 4 | 创建 `PetSprite.css` 样式 | ⏳ 待完成 |
| 5 | 嵌入 DynamicIsland 组件 | ⏳ 待完成 |
| 6 | 连接 taskStore 状态 | ⏳ 待完成 |

---

## 参考资料

- [CSS Sprite Animation Tutorial](https://css-tricks.com/snippets/css/using-css-sprites/)
- [Aseprite 官方文档](https://www.aseprite.org/docs/)
- [Piskel 在线编辑器](https://www.piskelapp.com)
