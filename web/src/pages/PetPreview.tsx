/**
 * 桌宠预览页面
 * 访问 /app/pet 查看
 */

import { useState } from 'react'
import { PetSprite, type PetStatus, PET_ANIMATIONS } from '../../../pet'

const ALL_STATUS: PetStatus[] = ['idle', 'working', 'alert', 'celebrate']

const STATUS_INFO: Record<PetStatus, { label: string; desc: string }> = {
  idle: { label: '睡觉', desc: '无任务时' },
  working: { label: '敲键盘', desc: '任务进行中' },
  alert: { label: '举牌感叹号', desc: '倒计时结束' },
  celebrate: { label: '撒星星', desc: '任务完成' },
}

export default function PetPreviewPage() {
  const [status, setStatus] = useState<PetStatus>('idle')
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md')

  const config = PET_ANIMATIONS[status]

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold text-white">桌宠动画预览</h1>
        <p className="mb-6 text-gray-400">
          当前状态：<strong className="text-white">{STATUS_INFO[status].label}</strong> ({STATUS_INFO[status].desc})
        </p>

        {/* 桌宠显示区域 */}
        <div className="mb-6 flex min-h-[200px] items-center justify-center rounded-xl bg-[#16213e] p-12">
          <PetSprite status={status} size={size} />
        </div>

        {/* 状态切换 */}
        <div className="mb-4">
          <label className="mr-3 text-gray-400">状态：</label>
          {ALL_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`mr-2 rounded-md px-4 py-2 text-sm text-white transition-colors ${
                status === s ? 'bg-[#e94560]' : 'bg-[#0f3460] hover:bg-[#1a4a7a]'
              }`}
            >
              {STATUS_INFO[s].label}
            </button>
          ))}
        </div>

        {/* 尺寸切换 */}
        <div className="mb-8">
          <label className="mr-3 text-gray-400">尺寸：</label>
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`mr-2 rounded-md px-4 py-2 text-sm text-white transition-colors ${
                size === s ? 'bg-[#e94560]' : 'bg-[#0f3460] hover:bg-[#1a4a7a]'
              }`}
            >
              {s === 'sm' ? '小' : s === 'md' ? '中' : '大'}
            </button>
          ))}
        </div>

        {/* 配置信息 */}
        <div className="rounded-lg bg-[#0f3460] p-4 text-sm text-gray-400">
          <p className="mb-2 font-medium text-gray-300">当前帧图信息：</p>
          <table>
            <tbody>
              <tr>
                <td className="pr-4">单帧尺寸：</td>
                <td>{config.frameWidth} × {config.frameHeight} px</td>
              </tr>
              <tr>
                <td className="pr-4">帧数：</td>
                <td>{config.frameCount} 帧</td>
              </tr>
              <tr>
                <td className="pr-4">动画时长：</td>
                <td>{config.duration}s</td>
              </tr>
              <tr>
                <td className="pr-4">循环：</td>
                <td>{config.loop ? '是' : '否（播放一次）'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
