import { Img, AbsoluteFill, useVideoConfig, interpolate, Easing } from 'remotion'

export const ParallaxLayer = ({
  layerImage,
  maskImage,
  parallaxSpeed = 0.3,
  direction = 'horizontal',
  strength = 0.5,
  rangeStart = 0,
  rangeEnd = 1,
}) => {
  const { durationInFrames } = useVideoConfig()

  const getTransform = (frame) => {
    const total = Math.max(1, durationInFrames - 1)
    const rawProgress = frame / total
    const progress = rangeStart + (rangeEnd - rangeStart) * rawProgress
    const easedProgress = Easing.inOut(Easing.cubic)(progress)

    const offsetRange = parallaxSpeed * strength * 50
    const movement = interpolate(
      easedProgress,
      [0, 0.5, 1],
      [-offsetRange, 0, offsetRange],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )

    if (direction === 'vertical') {
      return { transform: `translateY(${movement}%) scale(${1 + parallaxSpeed * 0.1})` }
    }

    if (direction === 'diagonal') {
      return {
        transform: `translate(${movement}%, ${movement * 0.5}%) scale(${1 + parallaxSpeed * 0.1})`,
      }
    }

    return { transform: `translateX(${movement}%) scale(${1 + parallaxSpeed * 0.1})` }
  }

  return (frame) => {
    const { transform } = getTransform(frame)

    return (
      <AbsoluteFill>
        <Img
          src={layerImage}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform,
          }}
        />
        {maskImage && (
          <Img
            src={maskImage}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              mixBlendMode: 'multiply',
              opacity: 0,
            }}
          />
        )}
      </AbsoluteFill>
    )
  }
}

export const ParallaxComposition = ({
  layers = [],
  strength = 0.5,
  direction = 'horizontal',
}) => {
  const sortedLayers = [...layers].sort((a, b) => a.index - b.index)

  return (frame) => (
    <AbsoluteFill style={{ backgroundColor: '#0a2438' }}>
      {sortedLayers.map((layer) => (
        <ParallaxLayer
          key={`parallax-${layer.index}`}
          layerImage={layer.image || layer.layerImage}
          parallaxSpeed={layer.parallaxSpeed || layer.parallaxFactor || 0.3}
          direction={direction}
          strength={strength}
        />
      ))}
    </AbsoluteFill>
  )
}
