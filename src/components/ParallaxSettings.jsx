import { useState, useCallback } from 'react'
import { separateLayers, buildParallaxConfig, estimateParallaxRenderCost } from '../services/depthMapService.js'
import './ParallaxSettings.css'

export function ParallaxSettings({ enabled, strength, direction, onChange }) {
  const [layerCount, setLayerCount] = useState(3)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleToggle = useCallback(() => {
    onChange?.({ enabled: !enabled, strength, direction })
  }, [enabled, strength, direction, onChange])

  const handleStrength = useCallback((val) => {
    onChange?.({ enabled, strength: Number(val), direction })
  }, [enabled, strength, direction, onChange])

  const handleDirection = useCallback((dir) => {
    onChange?.({ enabled, strength, direction: dir })
  }, [enabled, strength, direction, onChange])

  const previewLayers = separateLayers('placeholder', { layerCount }).layers
  const config = buildParallaxConfig(previewLayers, { strength, direction })
  const renderMs = estimateParallaxRenderCost(layerCount)

  return (
    <div className={`xm-parallax-settings ${enabled ? 'enabled' : ''}`}>
      <div className="xm-parallax-header">
        <label className="xm-parallax-toggle">
          <input type="checkbox" checked={enabled} onChange={handleToggle} />
          <span className="xm-parallax-title">2.5D 视差效果</span>
        </label>
        {enabled && (
          <span className="xm-parallax-badge">
            {layerCount} 层 · {Math.round(strength * 100)}% 强度
          </span>
        )}
      </div>

      {enabled && (
        <div className="xm-parallax-body">
          <div className="xm-parallax-row">
            <span className="xm-parallax-label">视差强度</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(strength * 100)}
              onChange={(e) => handleStrength(e.target.value / 100)}
              className="xm-parallax-slider"
            />
            <span className="xm-parallax-value">{Math.round(strength * 100)}%</span>
          </div>

          <div className="xm-parallax-row">
            <span className="xm-parallax-label">运动方向</span>
            <div className="xm-parallax-segments">
              {['horizontal', 'vertical', 'diagonal'].map((dir) => (
                <button
                  key={dir}
                  className={`xm-parallax-seg ${direction === dir ? 'active' : ''}`}
                  onClick={() => handleDirection(dir)}
                >
                  {dir === 'horizontal' ? '水平' : dir === 'vertical' ? '垂直' : '对角'}
                </button>
              ))}
            </div>
          </div>

          <div className="xm-parallax-row">
            <span className="xm-parallax-label">图层数量</span>
            <div className="xm-parallax-segments">
              {[2, 3, 5].map((n) => (
                <button
                  key={n}
                  className={`xm-parallax-seg ${layerCount === n ? 'active' : ''}`}
                  onClick={() => setLayerCount(n)}
                >
                  {n} 层
                </button>
              ))}
            </div>
          </div>

          <div className="xm-parallax-info">
            <div className="xm-parallax-info-row">
              <span>预计渲染耗时</span>
              <span>~{renderMs}ms/帧</span>
            </div>
            <div className="xm-parallax-info-row">
              <span>最深视差偏移</span>
              <span>±{Math.round(config.layers[config.layers.length - 1]?.offsetRange || 0)}px</span>
            </div>
          </div>

          <p className="xm-parallax-hint">
            开启后，分镜图片将通过 AI 深度图分层，在 Remotion 渲染时以不同速度移动，模拟 2.5D 立体效果。强度为 0% 时为平面图片。
          </p>
        </div>
      )}
    </div>
  )
}
