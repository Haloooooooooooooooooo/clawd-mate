/**
 * 桌宠占位组件
 *
 * 当帧图未准备好时，用 CSS 简单动画占位
 * 可以让你先测试组件结构和状态切换逻辑
 */

import { type PetStatus, type PetSize, PET_SIZES } from './config'
import './PetPlaceholder.css'

export interface PetPlaceholderProps {
  status: PetStatus
  size?: PetSize
  className?: string
}

const STATUS_LABELS: Record<PetStatus, string> = {
  idle: '💤',
  working: '⌨️',
  alert: '⚠️',
  celebrate: '🎉',
}

export function PetPlaceholder({ status, size = 'md', className = '' }: PetPlaceholderProps) {
  const scale = PET_SIZES[size]
  const baseSize = 32 * scale

  return (
    <div
      className={`pet-placeholder pet-placeholder-${status} ${className}`}
      style={{
        width: baseSize,
        height: baseSize,
      }}
      role="img"
      aria-label={`桌宠状态: ${status}`}
    >
      <span className="pet-placeholder-emoji">{STATUS_LABELS[status]}</span>
    </div>
  )
}
