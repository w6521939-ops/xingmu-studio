import { useState, useEffect, useCallback } from 'react'
import {
  listAvailableProviders,
  resolveActiveProviderId,
  providerCapabilityIds,
} from '../services/providers/index.js'
import './ProviderSettings.css'

const capabilityLabels = {
  script: '剧本',
  image: '图片',
  voice: '配音',
  video: '视频',
}

const capabilityIcons = {
  script: '\u{1F4DD}',
  image: '\u{1F5BC}',
  voice: '\u{1F3A4}',
  video: '\u{1F3AC}',
}

export function ProviderSettings({ activeProviders = {}, onChange }) {
  const [providers, setProviders] = useState({})
  const [resolved, setResolved] = useState({})

  const refresh = useCallback(() => {
    const map = {}
    const resolvedMap = {}
    for (const cap of providerCapabilityIds) {
      map[cap] = listAvailableProviders(cap)
      resolvedMap[cap] = resolveActiveProviderId(cap, activeProviders[cap])
    }
    setProviders(map)
    setResolved(resolvedMap)
  }, [activeProviders])

  useEffect(() => { refresh() }, [refresh])

  const handleSelect = (capability, providerId) => {
    onChange?.({ ...activeProviders, [capability]: providerId })
  }

  return (
    <div className="xm-provider-settings">
      <div className="xm-provider-header">
        <h3>AI 服务商</h3>
        <button className="xm-provider-refresh" onClick={refresh}>刷新</button>
      </div>
      <p className="xm-provider-hint">
        为每个能力域选择服务商。仅显示已配置 API Key 的可用 Provider。
        未配置的 Provider 需在环境变量中设置对应的 Key。
      </p>

      {providerCapabilityIds.map((cap) => {
        const list = providers[cap] || []
        const activeId = activeProviders[cap] || resolved[cap]
        const hasAvailable = list.length > 0

        return (
          <div key={cap} className="xm-provider-row">
            <div className="xm-provider-label">
              <span className="xm-provider-icon">{capabilityIcons[cap]}</span>
              <span>{capabilityLabels[cap]}</span>
            </div>

            {hasAvailable ? (
              <div className="xm-provider-options">
                {list.map((p) => (
                  <button
                    key={p.providerId}
                    className={`xm-provider-chip ${activeId === p.providerId ? 'active' : ''}`}
                    onClick={() => handleSelect(cap, p.providerId)}
                    title={p.model}
                  >
                    <span className="xm-chip-name">{p.displayName}</span>
                    <span className="xm-chip-model">{p.model}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="xm-provider-empty">
                没有可用的 Provider，请配置对应的 API Key
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
