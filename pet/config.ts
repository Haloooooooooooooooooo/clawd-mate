// 桌宠状态类型
export type PetStatus = 'idle' | 'working' | 'alert' | 'celebrate'

// 动画配置
export interface PetAnimationConfig {
  frameCount: number      // 帧数
  frameWidth: number      // 单帧宽度 (px)
  frameHeight: number     // 单帧高度 (px)
  duration: number        // 动画时长 (秒)
  loop: boolean           // 是否循环
}

// 各状态的动画配置
export const PET_ANIMATIONS: Record<PetStatus, PetAnimationConfig> = {
  idle: {
    frameCount: 4,
    frameWidth: 512,
    frameHeight: 768,
    duration: 0.8,
    loop: true,
  },
  working: {
    frameCount: 6,
    frameWidth: 362,
    frameHeight: 724,
    duration: 0.6,
    loop: true,
  },
  alert: {
    frameCount: 4,
    frameWidth: 512,
    frameHeight: 768,
    duration: 0.6,
    loop: true,
  },
  celebrate: {
    frameCount: 6,
    frameWidth: 362,
    frameHeight: 724,
    duration: 0.8,
    loop: true,       // 循环播放
  },
}

// 尺寸缩放比例（原图很大，需要缩小显示）
export type PetSize = 'sm' | 'md' | 'lg'

export const PET_SIZES: Record<PetSize, number> = {
  sm: 0.05,   // ~25-38px（灵动岛紧凑模式）
  md: 0.08,   // ~40-60px（正常显示）
  lg: 0.12,   // ~60-90px（大尺寸）
}
