import { VIDEO_MODES, videoModeLabels, videoModeDescriptions, getVideoModeConfig } from '../services/realVideoService.js'
import { isStockFootageConfigured } from '../services/stockFootageService.js'
import './VideoModeSelector.css'

export function VideoModeSelector({ mode, onChange, disabled }) {
  const config = getVideoModeConfig(mode)
  const stockAvailable = isStockFootageConfigured()

  return (
    <div className="xm-mode-selector">
      <div className="xm-mode-label">制作模式</div>
      <div className="xm-mode-options">
        {Object.values(VIDEO_MODES).map((m) => {
          const cfg = getVideoModeConfig(m)
          const active = (mode || VIDEO_MODES.IMAGE_ANIMATION) === m
          return (
            <button
              key={m}
              className={`xm-mode-card ${active ? 'active' : ''}`}
              onClick={() => !disabled && onChange?.(m)}
              disabled={disabled}
            >
              <span className="xm-mode-title">{videoModeLabels[m]}</span>
              <span className="xm-mode-desc">{videoModeDescriptions[m]}</span>
              {m === VIDEO_MODES.REAL_VIDEO && !stockAvailable && (
                <span className="xm-mode-badge warn">未配置素材库 Key</span>
              )}
              {m === VIDEO_MODES.REAL_VIDEO && stockAvailable && (
                <span className="xm-mode-badge ok">素材库可用</span>
              )}
            </button>
          )
        })}
      </div>
      {mode === VIDEO_MODES.REAL_VIDEO && (
        <div className="xm-mode-info">
          <div className="xm-mode-info-row">
            <span>批量生成</span>
            <span>{config.supportsMultiShot ? '支持' : '不支持'}</span>
          </div>
          <div className="xm-mode-info-row">
            <span>镜头衔接</span>
            <span>{config.continuityMode === 'last-frame' ? '尾帧连续' : '无'}</span>
          </div>
          <div className="xm-mode-info-row">
            <span>素材库 B-roll</span>
            <span>{config.supportsStockFootage && stockAvailable ? '可用' : '不可用'}</span>
          </div>
          <div className="xm-mode-info-row">
            <span>单镜头时长</span>
            <span>{config.defaultShotDuration}s（上限 {config.maxShotDuration}s）</span>
          </div>
        </div>
      )}
    </div>
  )
}
