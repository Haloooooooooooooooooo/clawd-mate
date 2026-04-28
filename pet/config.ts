export type PetStatus = 'idle' | 'working' | 'alert' | 'celebrate'

export interface PetAnimationConfig {
  frameCount: number
  frameWidth: number
  frameHeight: number
  duration: number
  loop: boolean
}

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
    loop: true,
  },
}

export type PetSize = 'sm' | 'md' | 'lg'

export const PET_SIZES: Record<PetSize, number> = {
  sm: 0.1,
  md: 0.08,
  lg: 0.12,
}
