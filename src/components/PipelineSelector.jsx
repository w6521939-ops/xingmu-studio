import { useMemo } from 'react'
import { listPipelineSummaries } from '../services/pipelineDefs/index.js'
import './PipelineSelector.css'

export function PipelineSelector({ activePipeline, onChange }) {
  const pipelines = useMemo(() => listPipelineSummaries(), [])

  return (
    <div className="xm-pipeline-selector">
      <div className="xm-pipeline-label">制作管线</div>
      <div className="xm-pipeline-list">
        {pipelines.map((p) => {
          const active = activePipeline === p.name
          return (
            <button
              key={p.name}
              className={`xm-pipeline-card ${active ? 'active' : ''}`}
              onClick={() => onChange?.(p.name)}
            >
              <div className="xm-pipeline-name">{p.displayName}</div>
              <div className="xm-pipeline-desc">{p.description}</div>
              <div className="xm-pipeline-meta">
                <span className="xm-pipeline-stages">{p.stageCount} 阶段</span>
                {p.approvalGates.length > 0 && (
                  <span className="xm-pipeline-gates">
                    审批门：{p.approvalGates.join('、')}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
