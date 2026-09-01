export const shotMotionOptions = [
  { value: 'none', label: '静止' },
  { value: 'zoom-in', label: '缓慢推进' },
  { value: 'zoom-out', label: '缓慢拉远' },
  { value: 'pan-left', label: '向左平移' },
  { value: 'pan-right', label: '向右平移' },
  { value: 'pan-up', label: '向上平移' },
  { value: 'pan-down', label: '向下平移' },
]

export const shotTransitionOptions = [
  { value: 'cut', label: '直接切换' },
  { value: 'fade', label: '淡入淡出' },
]

const validMotionEffects = new Set(shotMotionOptions.map((option) => option.value))
const validTransitions = new Set(shotTransitionOptions.map((option) => option.value))
const clampUnit = (value, fallback) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback))

const inferLegacyMotionEffect = (value) => {
  const motion = String(value || '')
  if (/拉远/u.test(motion)) return 'zoom-out'
  if (/推进|推近|前移|变焦/u.test(motion)) return 'zoom-in'
  if (/左/u.test(motion)) return 'pan-left'
  if (/右|水平摇移|跟拍/u.test(motion)) return 'pan-right'
  if (/上/u.test(motion)) return 'pan-up'
  if (/下/u.test(motion)) return 'pan-down'
  return 'none'
}

export const normalizeShotMotionSettings = (shot = {}) => ({
  motionEffect: validMotionEffects.has(shot.motionEffect)
    ? shot.motionEffect
    : inferLegacyMotionEffect(shot.motion),
  motionStrength: Math.round(Math.min(25, Math.max(5, Number(shot.motionStrength) || 12))),
  transition: validTransitions.has(shot.transition) ? shot.transition : 'fade',
  transitionDuration: Number(Math.min(0.8, Math.max(0.1, Number(shot.transitionDuration) || 0.25)).toFixed(2)),
})

export const normalizeShotMotionRange = (shot = {}) => {
  const motionRangeStart = clampUnit(shot.motionRangeStart, 0)
  const motionRangeEnd = Math.max(motionRangeStart, clampUnit(shot.motionRangeEnd, 1))
  return {
    motionRangeStart: Number(motionRangeStart.toFixed(6)),
    motionRangeEnd: Number(motionRangeEnd.toFixed(6)),
  }
}

export const normalizeShotTransitionEdges = (shot = {}) => {
  const { transition } = normalizeShotMotionSettings(shot)
  return {
    transitionIn: validTransitions.has(shot.transitionIn) ? shot.transitionIn : transition,
    transitionOut: validTransitions.has(shot.transitionOut) ? shot.transitionOut : transition,
  }
}

export const getShotMotionLabel = (value) => shotMotionOptions.find((option) => option.value === value)?.label || '静止'

export const resolveShotMotionPreviewStyle = (shot, progress, duration = 3) => {
  const settings = normalizeShotMotionSettings(shot)
  const motionRange = normalizeShotMotionRange(shot)
  const transitionEdges = normalizeShotTransitionEdges(shot)
  const localRatio = Math.min(1, Math.max(0, Number(progress) || 0))
  const ratio = motionRange.motionRangeStart
    + (motionRange.motionRangeEnd - motionRange.motionRangeStart) * localRatio
  const strength = settings.motionStrength / 100
  const overscan = (strength / (1 + strength)) * 50
  let scale = 1
  let translateX = 0
  let translateY = 0

  if (settings.motionEffect === 'zoom-in') scale = 1 + strength * ratio
  if (settings.motionEffect === 'zoom-out') scale = 1 + strength * (1 - ratio)
  if (settings.motionEffect.startsWith('pan-')) scale = 1 + strength
  if (settings.motionEffect === 'pan-left') translateX = overscan * (1 - ratio * 2)
  if (settings.motionEffect === 'pan-right') translateX = overscan * (ratio * 2 - 1)
  if (settings.motionEffect === 'pan-up') translateY = overscan * (1 - ratio * 2)
  if (settings.motionEffect === 'pan-down') translateY = overscan * (ratio * 2 - 1)

  let opacity = 1
  if (transitionEdges.transitionIn === 'fade' || transitionEdges.transitionOut === 'fade') {
    const seconds = Math.max(0.5, Number(duration) || 3)
    const fadeRatio = Math.min(1 / 3, settings.transitionDuration / seconds)
    if (fadeRatio > 0 && transitionEdges.transitionIn === 'fade') opacity = Math.min(opacity, localRatio / fadeRatio)
    if (fadeRatio > 0 && transitionEdges.transitionOut === 'fade') opacity = Math.min(opacity, (1 - localRatio) / fadeRatio)
  }

  return {
    transform: `scale(${scale.toFixed(4)}) translate3d(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%, 0)`,
    opacity: Number(Math.max(0, opacity).toFixed(3)),
  }
}
