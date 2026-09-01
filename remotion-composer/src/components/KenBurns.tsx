import { Img, AbsoluteFill, useVideoConfig, interpolate, Easing } from 'remotion'

const motionPresets = {
  'zoom-in': (strength, progress) => ({
    scale: interpolate(progress, [0, 1], [1, 1 + strength], { easing: Easing.inOut(Easing.cubic) }),
    translateX: 0,
    translateY: 0,
  }),
  'zoom-out': (strength, progress) => ({
    scale: interpolate(progress, [0, 1], [1 + strength, 1], { easing: Easing.inOut(Easing.cubic) }),
    translateX: 0,
    translateY: 0,
  }),
  'pan-left': (strength, progress) => {
    const scale = 1 + strength * 0.6
    const maxOffset = strength * 100
    return {
      scale,
      translateX: interpolate(progress, [0, 1], [maxOffset, -maxOffset]),
      translateY: 0,
    }
  },
  'pan-right': (strength, progress) => {
    const scale = 1 + strength * 0.6
    const maxOffset = strength * 100
    return {
      scale,
      translateX: interpolate(progress, [0, 1], [-maxOffset, maxOffset]),
      translateY: 0,
    }
  },
  'pan-up': (strength, progress) => {
    const scale = 1 + strength * 0.6
    const maxOffset = strength * 100
    return {
      scale,
      translateX: 0,
      translateY: interpolate(progress, [0, 1], [maxOffset, -maxOffset]),
    }
  },
  'pan-down': (strength, progress) => {
    const scale = 1 + strength * 0.6
    const maxOffset = strength * 100
    return {
      scale,
      translateX: 0,
      translateY: interpolate(progress, [0, 1], [-maxOffset, maxOffset]),
    }
  },
  none: () => ({ scale: 1, translateX: 0, translateY: 0 }),
}

export const KenBurns = ({ image, motionEffect = 'none', motionStrength = 0.12, rangeStart = 0, rangeEnd = 1, width, height }) => {
  const { durationInFrames, fps } = useVideoConfig()

  const getProgress = (frame) => {
    const total = Math.max(1, durationInFrames - 1)
    const raw = frame / total
    return rangeStart + (rangeEnd - rangeStart) * raw
  }

  return (frame) => {
    const progress = getProgress(frame)
    const preset = motionPresets[motionEffect] || motionPresets.none
    const { scale, translateX, translateY } = preset(motionStrength, progress)

    return (
      <AbsoluteFill>
        <Img
          src={image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          }}
        />
      </AbsoluteFill>
    )
  }
}
