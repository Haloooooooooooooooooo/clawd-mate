import { useState, useEffect } from 'react'
import { type PetStatus, type PetSize, PET_ANIMATIONS, PET_SIZES } from './config'

export interface PetSpriteProps {
  status: PetStatus
  size?: PetSize
  className?: string
  scaleMultiplier?: number
}

// 精灵图路径（放在 public 目录下，直接用绝对路径访问）
const SPRITE_IMAGES: Record<PetStatus, string> = {
  idle: '/pet/sprites/sleep.png',
  working: '/pet/sprites/clawd-working.png',
  alert: '/pet/sprites/clawd-alert.png',
  celebrate: '/pet/sprites/clawd-celebrate.png',
}

export function PetSprite({
  status,
  size = 'md',
  className = '',
  scaleMultiplier = 1,
}: PetSpriteProps) {
  const config = PET_ANIMATIONS[status]
  const scale = PET_SIZES[size] * scaleMultiplier

  // 计算精灵图总宽度
  const totalWidth = config.frameWidth * config.frameCount

  // 显示尺寸 = 当前状态的单帧尺寸
  const displayWidth = config.frameWidth * scale
  const displayHeight = config.frameHeight * scale

  // 精灵图缩放后的总宽度
  const scaledTotalWidth = totalWidth * scale

  // 用 state 控制当前帧
  const [currentFrame, setCurrentFrame] = useState(0)

  useEffect(() => {
    const frameInterval = (config.duration * 1000) / config.frameCount

    const timer = setInterval(() => {
      if (config.loop) {
        setCurrentFrame((prev) => (prev + 1) % config.frameCount)
      } else {
        setCurrentFrame((prev) => {
          if (prev < config.frameCount - 1) {
            return prev + 1
          }
          return prev
        })
      }
    }, frameInterval)

    // 状态切换时重置帧
    setCurrentFrame(0)

    return () => clearInterval(timer)
  }, [status, config.duration, config.frameCount, config.loop])

  // 计算背景位置
  const backgroundPositionX = -(currentFrame * config.frameWidth * scale)

  // 构建 style
  const style: React.CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    backgroundImage: `url(${SPRITE_IMAGES[status]})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${scaledTotalWidth}px ${displayHeight}px`,
    backgroundPosition: `${backgroundPositionX}px 0`,
    // 保持像素锐利
    imageRendering: 'pixelated',
  }

  // 构建类名
  const classNames = ['pet-sprite', className].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      style={style}
      role="img"
      aria-label={`桌宠状态: ${status}`}
    />
  )
}
