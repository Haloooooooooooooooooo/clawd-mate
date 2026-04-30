import { useEffect, useState } from 'react';
import { type PetSize, type PetStatus, PET_ANIMATIONS, PET_SIZES } from './config';

export interface PetSpriteProps {
  status: PetStatus;
  size?: PetSize;
  className?: string;
  scaleMultiplier?: number;
}

const SPRITE_IMAGES: Record<PetStatus, string> = {
  idle: '/pet/sprites/sleep.png',
  working: '/pet/sprites/clawd-working.png',
  alert: '/pet/sprites/clawd-alert.png',
  celebrate: '/pet/sprites/clawd-celebrate.png'
};

export function PetSprite({
  status,
  size = 'md',
  className = '',
  scaleMultiplier = 1
}: PetSpriteProps) {
  const config = PET_ANIMATIONS[status];
  const scale = PET_SIZES[size] * scaleMultiplier;
  const totalWidth = config.frameWidth * config.frameCount;
  const displayWidth = config.frameWidth * scale;
  const displayHeight = config.frameHeight * scale;
  const scaledTotalWidth = totalWidth * scale;
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const frameInterval = (config.duration * 1000) / config.frameCount;
    const timer = window.setInterval(() => {
      if (config.loop) {
        setCurrentFrame((prev) => (prev + 1) % config.frameCount);
      } else {
        setCurrentFrame((prev) => (prev < config.frameCount - 1 ? prev + 1 : prev));
      }
    }, frameInterval);

    setCurrentFrame(0);
    return () => window.clearInterval(timer);
  }, [status, config.duration, config.frameCount, config.loop]);

  const backgroundPositionX = -(currentFrame * config.frameWidth * scale);
  const style: React.CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    backgroundImage: `url(${SPRITE_IMAGES[status]})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${scaledTotalWidth}px ${displayHeight}px`,
    backgroundPosition: `${backgroundPositionX}px 0`,
    imageRendering: 'pixelated'
  };

  const classNames = ['pet-sprite', className].filter(Boolean).join(' ');

  return <div className={classNames} style={style} role="img" aria-label={`桌宠状态: ${status}`} />;
}
