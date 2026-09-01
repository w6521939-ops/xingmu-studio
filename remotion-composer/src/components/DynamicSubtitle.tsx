import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion'

const normalizeHexColor = (value, fallback = '#FFFFFF') =>
  /^#[0-9A-Fa-f]{6}$/u.test(String(value || '')) ? String(value) : fallback

const positionToFlex = (position) => {
  switch (position) {
    case 'top': return { justifyContent: 'flex-start', paddingTop: '6%' }
    case 'middle': return { justifyContent: 'center' }
    default: return { justifyContent: 'flex-end', paddingBottom: '6%' }
  }
}

export const DynamicSubtitle = ({ cues = [], style = {}, fps = 30, totalFrames = 0 }) => {
  const frame = useCurrentFrame()
  const currentTime = frame / fps

  const activeCue = cues.find((cue) => {
    const start = Number(cue.start) || 0
    const end = Number(cue.end) || start + 2
    return currentTime >= start && currentTime < end
  })

  if (!activeCue?.text) return null

  const cueStart = Number(activeCue.start) || 0
  const cueEnd = Number(activeCue.end) || cueStart + 2
  const cueDuration = cueEnd - cueStart
  const cueProgress = (currentTime - cueStart) / cueDuration

  const fadeInFrames = Math.min(8, Math.round(cueDuration * fps * 0.15))
  const fadeOutFrames = Math.min(8, Math.round(cueDuration * fps * 0.15))
  const localFrame = frame - Math.round(cueStart * fps)

  let opacity = 1
  if (localFrame < fadeInFrames) {
    opacity = interpolate(localFrame, [0, fadeInFrames], [0, 1], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  } else if (localFrame > Math.round(cueDuration * fps) - fadeOutFrames) {
    opacity = interpolate(localFrame, [Math.round(cueDuration * fps) - fadeOutFrames, Math.round(cueDuration * fps)], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.cubic),
    })
  }

  const color = normalizeHexColor(style.color, '#FFFFFF')
  const outlineColor = normalizeHexColor(style.outlineColor, '#102B3A')
  const fontSize = Math.min(96, Math.max(32, Number(style.fontSize) || 52))
  const position = positionToFlex(style.position || 'bottom')
  const backgroundOpacity = Math.min(90, Math.max(0, Number(style.backgroundOpacity) || 0))

  const words = String(activeCue.text).split('').slice(0, 500)
  const charsRevealed = Math.ceil(words.length * Math.min(1, cueProgress * 1.5))
  const visibleText = words.slice(0, charsRevealed).join('')

  return (
    <AbsoluteFill
      style={{
        ...position,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          maxWidth: '86%',
          padding: '8px 20px',
          borderRadius: '8px',
          backgroundColor: backgroundOpacity > 0
            ? `rgba(16, 43, 58, ${backgroundOpacity / 100})`
            : 'transparent',
          fontSize: `${fontSize}px`,
          fontWeight: style.bold !== false ? '700' : '400',
          color,
          textShadow: `2px 2px 4px rgba(0,0,0,0.8), 0 0 3px ${outlineColor}`,
          lineHeight: '1.5',
          textAlign: 'center',
          fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
        }}
      >
        {visibleText}
      </div>
    </AbsoluteFill>
  )
}
