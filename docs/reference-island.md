# Open Island 灵动岛设计参考

> 来源：https://github.com/Octane0411/open-vibe-island
> 整理时间：2026-04-22

---

## 一、颜色系统

### 背景与边框

| 用途 | 颜色值 | CSS 等价 |
|------|--------|----------|
| 主背景 | `Color.black` | `#000000` |
| 边框（收起态） | `white.opacity(0.04)` | `rgba(255,255,255,0.04)` |
| 边框（展开态） | `white.opacity(0.07)` | `rgba(255,255,255,0.07)` |
| 卡片背景 | `white.opacity(0.04-0.06)` | `rgba(255,255,255,0.04-0.06)` |
| 按钮背景 | `white.opacity(0.08)` | `rgba(255,255,255,0.08)` |
| 悬停高亮 | `white.opacity(0.05-0.06)` | `rgba(255,255,255,0.05-0.06)` |

### 文字颜色

| 用途 | 颜色值 | CSS 等价 |
|------|--------|----------|
| 主文字（标题） | `white.opacity(0.9)` | `rgba(255,255,255,0.9)` |
| 次文字（副标题） | `white.opacity(0.6-0.62)` | `rgba(255,255,255,0.6)` |
| 弱文字（时间戳） | `white.opacity(0.35-0.45)` | `rgba(255,255,255,0.35)` |
| 极弱文字 | `white.opacity(0.25)` | `rgba(255,255,255,0.25)` |

### 状态颜色

| 状态 | 颜色值 | RGB | 用途 |
|------|--------|-----|------|
| 运行中 | `#6E9FFF` | `rgb(110,159,255)` | working blue |
| 空闲/活跃 | `#42E86B` | `rgb(66,232,107)` | idle green |
| 等待审批 | `orange` | - | 需要用户操作 |
| 等待回答 | `yellow` | - | 问题待回复 |
| 完成 | `#49DB76` | `rgb(73,219,118)` | 成功完成 |

### 用量百分比颜色

| 百分比 | 颜色 |
|--------|------|
| < 70% | 绿色 `green.opacity(0.95)` |
| 70-90% | 橙色 `orange.opacity(0.95)` |
| >= 90% | 红色 `red.opacity(0.95)` |

### 特殊颜色

| 用途 | 颜色值 |
|------|--------|
| 代码块背景 | `white.opacity(0.08)` |
| 分隔线 | `white.opacity(0.04)` |
| 审批卡片背景 | `rgb(28,20,8)` (深橙色调) |
| 审批卡片边框 | `orange.opacity(0.18)` |

---

## 二、字体系统

### 字号层级

| 元素 | 字号 | 字重 | CSS 等价 |
|------|------|------|----------|
| 会话标题 | 14-15pt | semibold | `font-size: 14-15px; font-weight: 600` |
| 副标题/活动 | 11.5pt | medium | `font-size: 11.5px; font-weight: 500` |
| 时间戳/标签 | 11pt | medium | `font-size: 11px; font-weight: 500` |
| Badge 小标签 | 9pt | semibold | `font-size: 9px; font-weight: 600` |
| 用量百分比 | 12pt | bold | `font-size: 12px; font-weight: 700` |
| 用量标签(5h/7d) | 11pt | semibold | `font-size: 11px; font-weight: 600` |
| 按钮文字 | 11.5pt | semibold | `font-size: 11.5px; font-weight: 600` |
| 卡片内代码 | 13pt | semibold + monospaced | `font-size: 13px; font-weight: 600; font-family: monospace` |
| Header 控制按钮 | 10pt | semibold | `font-size: 10px; font-weight: 600` |

### 文字样式

- 行高：通常 1.0-1.2（紧凑）
- 字间距：标题使用 `tracking-wide` 或 `letter-spacing: 0.02em`
- 大写标签：`text-transform: uppercase; letter-spacing: 0.15-0.28em`

---

## 三、圆角系统

### NotchShape 参数

| 状态 | 顶部圆角 | 底部圆角 | 说明 |
|------|----------|----------|------|
| 收起态 | 6pt | 20pt | 顶部小圆角+底部大圆角=胶囊形 |
| 展开态 | 22pt | 36pt | 更圆润的展开形态 |

### 其他圆角

| 元素 | 圆角 |
|------|------|
| 会话卡片（普通） | 22pt |
| 会话卡片（可操作） | 24pt |
| 操作按钮 | 14pt |
| 小按钮/徽章 | Capsule（全圆角） |
| 代码块 | 18pt |
| 内部卡片 | 10-18pt |

---

## 四、间距系统

### 外层间距

| 位置 | 数值 | 说明 |
|------|------|------|
| 面板阴影水平内边距 | 28pt | 展开态两侧留白 |
| 面板阴影底部内边距 | 14pt | 展开态底部留白 |
| 外层水平边距 | 28pt | 内容区域两侧 |

### 内层间距

| 位置 | 数值 |
|------|------|
| 内容水平边距 | 18pt |
| 内容垂直边距 | 14pt |
| 会话行间距 | 6pt |
| 图标与文字间距 | 14pt |
| 按钮间距 | 8pt |
| Header 水平边距 | 18pt |
| Header 顶部边距 | 2pt |
| 子元素间距（VStack） | 4-8pt |

### 内边距

| 元素 | padding |
|------|---------|
| 会话行 | 14-16pt 水平, 14pt 垂直 |
| 按钮 | 10-12pt 水平, 12pt 垂直 |
| Badge | 7pt 水平, 3.5pt 垂直 |
| 代码块 | 14pt 水平, 12pt 垂直 |

---

## 五、尺寸系统

### 收起态尺寸

| 属性 | 数值 | 说明 |
|------|------|------|
| 刘海宽度 | 224pt（默认） | 从系统获取实际值 |
| 刘海高度 | 38pt（默认） | 从 safeAreaInsets.top 获取 |
| 收起态高度 | = 刘海高度 | 与刘海齐平 |
| 侧边宽度 | `max(0, notchHeight - 12) + 10` | 图标区域 |
| 数量徽章宽度 | `26 + max(0, digits-1) * 8` | 根据数字位数动态 |

### 展开态尺寸

| 属性 | 数值 |
|------|------|
| 面板宽度 | 680-740pt（响应式） |
| 最大列表高度 | 560pt |
| 最大可见行数 | 6 行 |
| 空状态高度 | 108pt |
| 审批卡片高度 | ~310pt |
| 问题卡片高度 | 110-420pt |
| 完成卡片高度 | 210-400pt |

### 图标尺寸

| 元素 | 尺寸 |
|------|------|
| 品牌图标 | 14pt（收起态） |
| 状态点 | 9pt |
| Header 控制按钮 | 22pt × 22pt |
| 小图标（Badge内） | 7.5pt |

---

## 六、阴影系统

### 面板阴影

```css
/* 收起态 */
box-shadow: 0 18px 60px rgba(0,0,0,0.48);

/* 展开态 */
box-shadow: 0 24px 80px rgba(0,0,0,0.52);
```

### 卡片阴影

```css
/* 悬停时 */
box-shadow: 0 8px 24px rgba(0,0,0,0.24);
```

---

## 七、动画系统

### 过渡动画

| 动画类型 | 参数 | 用途 |
|----------|------|------|
| 打开动画 | `spring(response: 0.42, dampingFraction: 0.8)` | 收起→展开 |
| 关闭动画 | `smooth(duration: 0.3)` | 展开→收起 |
| 弹出动画 | `spring(response: 0.3, dampingFraction: 0.5)` | 通知弹出 |
| 悬停缩放 | `spring(response: 0.38, dampingFraction: 0.8)` | 鼠标悬停 |

### 数值参考

- 收起态悬停缩放：1.0 → 1.015（轻微放大）
- 状态切换时长：0.15-0.22s

---

## 八、布局结构

### 收起态布局

```
┌──────────────────────────────────────────────────────────────┐
│  [图标]      [中间黑色区域 - 可显示工具名]       [数量徽章]  │
│   ←sideWidth→                                 ←动态宽度→    │
│                                                              │
│  整体高度 = notchHeight (刘海高度)                           │
│  整体宽度 = notchWidth + expansionWidth                      │
└──────────────────────────────────────────────────────────────┘
```

**关键点：**
- 左侧图标区域宽度：`max(0, notchHeight - 12) + 10`
- 中间区域：刘海物理遮挡，外接显示器时可显示活动文字
- 右侧徽章：显示会话数量，颜色根据状态变化

### 展开态布局

```
┌──────────────────────────────────────────────────────────────┐
│ Header (高度 = notchHeight)                                  │
│ ┌────────────────┬──────────────┬──────────────────────────┐│
│ │ 左侧用量区域   │  刘海区域    │  右侧用量+按钮           ││
│ │ Claude 5h 68%  │              │  Codex 🔇 ⚙️            ││
│ └────────────────┴──────────────┴──────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│ Content Area                                                 │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 会话卡片 1                                               ││
│ │ ┌────────────────────────────────────────────────────┐  ││
│ │ │ [●]  会话标题                    [Badge] [Badge]   │  ││
│ │ │      副标题/命令预览                                │  ││
│ │ │      活动状态文字                                   │  ││
│ │ │      [子任务列表...]                                │  ││
│ │ │      [权限审批区域] ← 如果需要                      │  ││
│ │ └────────────────────────────────────────────────────┘  ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 会话卡片 2...                                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ (最大高度 560pt，超出可滚动)                                │
└──────────────────────────────────────────────────────────────┘
```

### Header 详细结构（刘海屏）

```
刘海屏时，Header 分左右两区，避开中间刘海：

┌──────────────────────────────────────────────────────────────┐
│ 左侧区域       │  刘海区域  │  右侧区域                      │
│ (避让 12pt)    │            │  (避让 12pt)                   │
│                │            │                                │
│ Claude         │            │  Codex 45% 🔇 ⚙️              │
│ 5h 68% | 7d 32%│            │                                │
│                │            │                                │
│ ← 计算宽度 →   │            │  ← 计算宽度 →                 │
└──────────────────────────────────────────────────────────────┘

左可见区域 = 左侧刘海边界 - 内容左边距 - 12pt安全边距
右可见区域 = 内容右边距 - 右侧刘海边界 - 12pt安全边距
中间间隙 = 内容宽度 - 左可见区域 - 右可见区域
```

---

## 九、交互行为

### 收起态交互

| 交互 | 行为 |
|------|------|
| 悬停 | 轻微放大 (scale: 1.015)，显示悬停高亮 |
| 点击 | 打开展开态 |
| 悬停延迟打开 | 延迟 0.5s 后自动打开（可配置） |

### 展开态交互

| 交互 | 行为 |
|------|------|
| 点击外部区域 | 关闭展开态 |
| 鼠标移出 | 可配置自动收起 |
| 点击会话行 | 跳转到对应终端/IDE |

### 会话卡片交互

| 交互 | 行为 |
|------|------|
| 悬停 | 背景高亮 + 显示底部边框 |
| 点击 | 跳转或展开详情 |
| 点击 inactive 行 | 先展开详情，再点击跳转 |

---

## 十、组件层级

```
IslandPanelView
├── NotchShape (背景形状)
├── headerRow
│   ├── 左侧：品牌图标 + 状态指示器
│   ├── 中间：黑色区域（刘海遮挡）
│   └── 右侧：数量徽章
├── openedContent
│   ├── installHooksHint (可选)
│   ├── sessionBootstrapPlaceholder (可选)
│   ├── emptyState (可选)
│   └── sessionList
│       └── IslandSessionRow (多个)
│           ├── 状态点
│           ├── 标题区
│           ├── Badge 组
│           ├── 子任务列表 (可选)
│           └── actionableBody (可选)
│               ├── approvalActionBody
│               ├── questionActionBody
│               └── completionActionBody
└── MenuBarContentView (菜单栏内容)
```

---

## 十一、特殊模式

### 通知卡片模式

当有需要用户操作的会话时（权限审批/问题回答/完成），进入通知模式：

```
┌──────────────────────────────────────────────────────────────┐
│ Header (正常)                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 单个可操作会话卡片                                       ││
│ │ (高度自适应，无滚动)                                     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ [查看全部 N 个会话] (如果有多个)                            │
└──────────────────────────────────────────────────────────────┘
```

### 空闲边缘模式

当没有活跃会话时，可配置显示一条极细的黑线：

```
┌──────────────────────────────────────────────────────────────┐
│  ══════════════════════════════════════════════════════════  │
│  (高度 4pt 的黑色胶囊条，悬停时可点击打开)                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 十二、关键代码片段参考

### NotchShape 实现

```swift
struct NotchShape: Shape {
    var topCornerRadius: CGFloat
    var bottomCornerRadius: CGFloat

    func path(in rect: CGRect) -> Path {
        let topR = min(topCornerRadius, rect.width / 4, rect.height / 4)
        let botR = min(bottomCornerRadius, rect.width / 4, rect.height / 2)

        var path = Path()

        // 从左上角开始
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))

        // 左上角凹陷曲线
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + topR, y: rect.minY + topR),
            control: CGPoint(x: rect.minX + topR, y: rect.minY)
        )

        // 左边向下
        path.addLine(to: CGPoint(x: rect.minX + topR, y: rect.maxY - botR))

        // 左下圆角
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + topR + botR, y: rect.maxY),
            control: CGPoint(x: rect.minX + topR, y: rect.maxY)
        )

        // 底边
        path.addLine(to: CGPoint(x: rect.maxX - topR - botR, y: rect.maxY))

        // 右下圆角
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX - topR, y: rect.maxY - botR),
            control: CGPoint(x: rect.maxX - topR, y: rect.maxY)
        )

        // 右边向上
        path.addLine(to: CGPoint(x: rect.maxX - topR, y: rect.minY + topR))

        // 右上角凹陷曲线
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY),
            control: CGPoint(x: rect.maxX - topR, y: rect.minY)
        )

        // 顶边回到起点
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))

        path.closeSubpath()
        return path
    }
}
```

### 刘海尺寸获取

```swift
extension NSScreen {
    var notchSize: CGSize {
        guard safeAreaInsets.top > 0 else {
            return CGSize(width: 224, height: 38) // 默认值
        }

        let notchHeight = safeAreaInsets.top
        let leftPadding = auxiliaryTopLeftArea?.width ?? 0
        let rightPadding = auxiliaryTopRightArea?.width ?? 0
        let notchWidth = frame.width - leftPadding - rightPadding + 4

        return CGSize(width: notchWidth, height: notchHeight)
    }

    var islandClosedHeight: CGFloat {
        if safeAreaInsets.top > 0 {
            return safeAreaInsets.top
        }
        return topStatusBarHeight // 非刘海屏用状态栏高度
    }
}
```

---

## 十三、设计原则总结

1. **黑色为主**：背景纯黑，通过不同透明度的白色创建层次
2. **极简边框**：边框透明度极低 (4-7%)，几乎不可见但增加质感
3. **状态颜色鲜明**：蓝/绿/橙/黄四种状态色，一眼识别
4. **字体紧凑**：小字号 + 中等字重，信息密度高但不拥挤
5. **圆角柔和**：底部大圆角营造胶囊感，顶部小圆角贴合刘海
6. **动画克制**：Spring 动画自然流畅，时长控制在 0.3-0.4s
7. **层级分明**：Header 固定，内容可滚动，卡片有清晰边界
