export function buildDepthMapPayload(imageUrl, options = {}) {
  return {
    imageUrl,
    model: options.model || 'depth-anything-v2',
    outputFormat: 'png',
    outputWidth: options.width || 1920,
    outputHeight: options.height || 1080,
    normalize: true,
    invertDepth: options.invert || false,
  }
}

export function separateLayers(depthMapUrl, options = {}) {
  const {
    layerCount = 3,
    thresholds = null,
    blurRadius = 2,
  } = options

  const defaultThresholds = _computeThresholds(layerCount)
  const finalThresholds = thresholds || defaultThresholds

  const layers = []
  for (let i = 0; i < layerCount; i++) {
    const minDepth = finalThresholds[i]
    const maxDepth = i < layerCount - 1 ? finalThresholds[i + 1] : 1.0
    layers.push({
      index: i,
      name: _layerName(i, layerCount),
      depthMin: minDepth,
      depthMax: maxDepth,
      blurRadius,
      parallaxFactor: _parallaxFactor(i, layerCount),
      maskType: 'range',
    })
  }

  return {
    ok: true,
    depthMapUrl,
    layerCount,
    layers,
  }
}

export function buildParallaxConfig(layers, options = {}) {
  const { strength = 0.5, direction = 'horizontal' } = options
  const clampedStrength = Math.max(0, Math.min(1, strength))

  return {
    enabled: clampedStrength > 0,
    strength: clampedStrength,
    direction,
    layerCount: layers.length,
    layers: layers.map((layer) => ({
      ...layer,
      parallaxSpeed: layer.parallaxFactor * clampedStrength,
      offsetRange: layer.parallaxFactor * clampedStrength * 50,
    })),
  }
}

export function estimateParallaxRenderCost(layerCount) {
  const perLayerMs = 15
  const baseMs = 50
  return baseMs + layerCount * perLayerMs
}

function _computeThresholds(layerCount) {
  const thresholds = []
  for (let i = 0; i < layerCount; i++) {
    thresholds.push(i / layerCount)
  }
  return thresholds
}

function _layerName(index, total) {
  if (index === 0) return 'background'
  if (index === total - 1) return 'foreground'
  if (total <= 3) return 'midground'
  return `layer-${index}`
}

function _parallaxFactor(index, total) {
  const t = total > 1 ? index / (total - 1) : 0
  return 0.2 + t * 0.8
}
