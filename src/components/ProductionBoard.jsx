import { useState, useMemo, useEffect, useRef } from 'react'

const stageConfig = [
  { name: 'preflight', displayName: '本地检查', icon: '📋' },
  { name: 'voice-assignment', displayName: '角色音色', icon: '🎙' },
  { name: 'character-images', displayName: '角色图片', icon: '👤' },
  { name: 'scene-images', displayName: '场景图片', icon: '🌅' },
  { name: 'storyboard-images', displayName: '分镜图片', icon: '🎬' },
  { name: 'voice-lines', displayName: '台词配音', icon: '🔊' },
  { name: 'shot-videos', displayName: '镜头视频', icon: '🎞' },
  { name: 'episode-exports', displayName: '自动成片', icon: '📦' },
  { name: 'finalize', displayName: '完成保存', icon: '✓' },
]

const taskKindLabels = {
  'voice-assignment': '音色匹配',
  'character-image': '角色图',
  'scene-image': '场景图',
  'storyboard-image': '分镜图',
  'voice-line': '配音',
  'shot-video': '镜头视频',
  'episode-export': '成片',
  'finalize': '保存',
}

const statusIcons = {
  pending: '○',
  running: '●',
  cooldown: '⏳',
  succeeded: '✓',
  failed: '✗',
  skipped: '⊘',
}

const statusColors = {
  pending: '#5a6b7a',
  running: '#5b9dd9',
  cooldown: '#e0a030',
  succeeded: '#5fbf6f',
  failed: '#e05050',
  skipped: '#7a8a9a',
}

const formatElapsed = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const formatCost = (cost) => {
  if (!cost && cost !== 0) return '--'
  return `${Number(cost).toFixed(4)} 元`
}

export function ProductionBoard({
  run,
  costEstimate,
  onPause,
  onResume,
  onStop,
  onMinimize,
  onApprove,
}) {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (!run) return
    if (run.status === 'running' && !startTimeRef.current) {
      startTimeRef.current = Date.now() - (run.elapsedSeconds || 0) * 1000
    }
    if (['completed', 'completed-with-errors', 'stopped', 'failed'].includes(run.status)) {
      startTimeRef.current = null
    }
  }, [run?.status])

  useEffect(() => {
    if (!startTimeRef.current) return
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTimeRef.current])

  const stages = useMemo(() => {
    if (!run?.tasks) return []
    const taskByStage = new Map()
    for (const task of run.tasks) {
      const stage = task.stage || 'preflight'
      if (!taskByStage.has(stage)) {
        taskByStage.set(stage, [])
      }
      taskByStage.get(stage).push(task)
    }
    return stageConfig.map((config) => {
      const tasks = taskByStage.get(config.name) || []
      const total = tasks.length
      const succeeded = tasks.filter((t) => t.status === 'succeeded').length
      const failed = tasks.filter((t) => t.status === 'failed').length
      const running = tasks.filter((t) => t.status === 'running').length
      const pending = tasks.filter((t) => t.status === 'pending').length
      const cooldown = tasks.filter((t) => t.status === 'cooldown').length
      const done = succeeded + failed
      const isActive = running > 0 || cooldown > 0
      const isComplete = total > 0 && done >= total
      const progress = total > 0 ? done / total : 0
      return {
        ...config,
        tasks,
        total,
        succeeded,
        failed,
        running,
        pending,
        cooldown,
        isActive,
        isComplete,
        progress,
      }
    })
  }, [run?.tasks])

  const summary = run?.summary || {}
  const totalProgress = summary.total > 0 ? (summary.completed / summary.total) * 100 : 0
  const isRunning = run?.status === 'running'
  const isPaused = ['pausing', 'paused', 'interrupted'].includes(run?.status)
  const isCooldown = run?.status === 'cooldown'
  const isTerminal = ['completed', 'completed-with-errors', 'stopped', 'failed', 'quota-stopped'].includes(run?.status)
  const showCost = costEstimate?.hasEstimates
  const usedCost = useMemo(() => {
    if (!showCost || !run?.tasks) return 0
    let total = 0
    const costByKind = {}
    for (const item of costEstimate.items) {
      costByKind[item.kind] = (costByKind[item.kind] || 0) + (item.estimatedCost || 0)
    }
    const completedByKind = {}
    for (const task of run.tasks) {
      if (task.status === 'succeeded') {
        completedByKind[task.kind] = (completedByKind[task.kind] || 0) + 1
      }
    }
    for (const [kind, count] of Object.entries(completedByKind)) {
      const unitCost = costByKind[kind] / (costEstimate.items.filter((i) => i.kind === kind).length || 1)
      total += unitCost * count
    }
    return total
  }, [showCost, run?.tasks, costEstimate])

  if (!run) {
    return (
      <div className="xm-prod-board xm-prod-board--empty">
        <p>暂无制作任务</p>
      </div>
    )
  }

  return (
    <div className="xm-prod-board" data-testid="production-board">
      <header className="xm-prod-board-header">
        <div className="xm-prod-board-title">
          <h2>制作看板</h2>
          {run.projectName && <span className="xm-prod-board-project">{run.projectName}</span>}
        </div>
        <div className="xm-prod-board-controls">
          {isRunning && (
            <button type="button" className="xm-prod-btn xm-prod-btn-pause" onClick={onPause}>
              ⏸ 暂停
            </button>
          )}
          {isPaused && (
            <button type="button" className="xm-prod-btn xm-prod-btn-resume" onClick={onResume}>
              ▶ 继续
            </button>
          )}
          {!isTerminal && (
            <button type="button" className="xm-prod-btn xm-prod-btn-stop" onClick={onStop}>
              ⏹ 停止
            </button>
          )}
          <button type="button" className="xm-prod-btn xm-prod-btn-min" onClick={onMinimize}>
            ▽ 收起
          </button>
        </div>
      </header>

      <div className="xm-prod-board-summary">
        <div className="xm-prod-progress-bar">
          <div className="xm-prod-progress-fill" style={{ width: `${totalProgress}%` }} />
          <span className="xm-prod-progress-text">
            {summary.completed || 0} / {summary.total || 0}
          </span>
        </div>
        <div className="xm-prod-board-stats">
          <span className="xm-prod-stat xm-prod-stat-time">⏱ {formatElapsed(elapsed || run.elapsedSeconds || 0)}</span>
          <span className="xm-prod-stat xm-prod-stat-succeeded">✓ {summary.succeeded || 0}</span>
          <span className="xm-prod-stat xm-prod-stat-failed">✗ {summary.failed || 0}</span>
          {summary.skipped > 0 && <span className="xm-prod-stat xm-prod-stat-skipped">⊘ {summary.skipped}</span>}
        </div>
      </div>

      {showCost && (
        <div className="xm-prod-cost-panel">
          <div className="xm-prod-cost-row">
            <span>已用费用</span>
            <strong className="xm-prod-cost-used">{formatCost(usedCost)}</strong>
          </div>
          <div className="xm-prod-cost-row">
            <span>预估总计</span>
            <strong className="xm-prod-cost-total">{formatCost(costEstimate.totalCost)}</strong>
          </div>
          <div className="xm-prod-cost-bar">
            <div
              className="xm-prod-cost-bar-fill"
              style={{
                width: `${costEstimate.totalCost > 0 ? Math.min(100, (usedCost / costEstimate.totalCost) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="xm-prod-cost-warning">实际费用以百炼账单为准</p>
        </div>
      )}

      {isCooldown && run.cooldown && (
        <div className="xm-prod-cooldown-banner">
          <span>⏳ {run.cooldown.localMessage || '冷却中'}</span>
          <small>等待 {Math.ceil((run.cooldown.milliseconds || 0) / 1000)} 秒</small>
        </div>
      )}

      <div className="xm-prod-stages">
        {stages.map((stage) => (
          <div
            key={stage.name}
            className={`xm-prod-stage ${stage.isActive ? 'is-active' : ''} ${stage.isComplete ? 'is-complete' : ''}`}
          >
            <header className="xm-prod-stage-header">
              <span className="xm-prod-stage-icon">{stage.icon}</span>
              <span className="xm-prod-stage-name">{stage.displayName}</span>
              {stage.total > 0 && (
                <span className="xm-prod-stage-count">
                  {stage.succeeded}/{stage.total}
                </span>
              )}
            </header>
            {stage.total > 0 && (
              <div className="xm-prod-stage-progress">
                <div className="xm-prod-stage-progress-fill" style={{ width: `${stage.progress * 100}%` }} />
              </div>
            )}
            {stage.tasks.length > 0 && (
              <div className="xm-prod-stage-tasks">
                {stage.tasks.slice(0, 12).map((task) => (
                  <div
                    key={task.id}
                    className={`xm-prod-task xm-prod-task--${task.status}`}
                    title={task.label || task.kind}
                  >
                    <span className="xm-prod-task-icon" style={{ color: statusColors[task.status] || '#5a6b7a' }}>
                      {statusIcons[task.status] || '○'}
                    </span>
                    <span className="xm-prod-task-label">
                      {taskKindLabels[task.kind] || task.kind}
                    </span>
                    {task.status === 'running' && task.localMessage && (
                      <small className="xm-prod-task-msg">{task.localMessage}</small>
                    )}
                    {task.status === 'failed' && task.error && (
                      <small className="xm-prod-task-msg xm-prod-task-msg--error">{task.error}</small>
                    )}
                  </div>
                ))}
                {stage.tasks.length > 12 && (
                  <small className="xm-prod-task-more">+{stage.tasks.length - 12} 个</small>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {run.status === 'completed' && (
        <div className="xm-prod-board-footer xm-prod-board-footer--done">
          <span>✓ 制作完成</span>
          <small>{summary.succeeded || 0} 项成功 · {summary.failed || 0} 项失败</small>
        </div>
      )}
      {run.status === 'completed-with-errors' && (
        <div className="xm-prod-board-footer xm-prod-board-footer--warn">
          <span>⚠ 制作完成（部分失败）</span>
          <small>{summary.succeeded || 0} 项成功 · {summary.failed || 0} 项失败</small>
        </div>
      )}
      {run.status === 'quota-stopped' && (
        <div className="xm-prod-board-footer xm-prod-board-footer--quota">
          <span>⛔ 免费额度已用完</span>
          <small>已停止生成，请在百炼控制台确认额度</small>
        </div>
      )}
      {run.status === 'stopped' && (
        <div className="xm-prod-board-footer xm-prod-board-footer--stopped">
          <span>⏹ 制作已停止</span>
          <small>{summary.succeeded || 0} 项成功 · {summary.failed || 0} 项失败</small>
        </div>
      )}
    </div>
  )
}
