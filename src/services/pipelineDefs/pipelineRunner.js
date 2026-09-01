import { manjuDramaPipeline, getStageDefinitions, isStageReady } from './manjuDrama.js'

const PIPELINE_STATE = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COOLDOWN: 'cooldown',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  INTERRUPTED: 'interrupted',
  FAILED: 'failed',
})

export class PipelineRunner {
  constructor(options = {}) {
    this.pipeline = options.pipeline || manjuDramaPipeline
    this.state = PIPELINE_STATE.IDLE
    this.currentStage = null
    this.completedStages = new Set()
    this.checkpoints = new Map()
    this.tasks = []
    this.listeners = new Set()
    this.pauseRequested = false
    this.stopRequested = false
  }

  on(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event, data = {}) {
    const payload = { type: event, pipeline: this.pipeline.name, state: this.state, currentStage: this.currentStage, ...data }
    for (const listener of this.listeners) {
      try { listener(payload) } catch { /* listener errors are non-fatal */ }
    }
  }

  getState() {
    return {
      state: this.state,
      currentStage: this.currentStage,
      completedStages: Array.from(this.completedStages),
      pipelineName: this.pipeline.name,
      pipelineDisplayName: this.pipeline.displayName,
    }
  }

  loadTasks(tasks) {
    this.tasks = Array.isArray(tasks) ? tasks : []
  }

  getTasksForStage(stageName) {
    return this.tasks.filter((task) => task.stage === stageName && task.status === 'pending')
  }

  getCheckpoint(stageName) {
    return this.checkpoints.get(stageName) || null
  }

  saveCheckpoint(stageName, taskResults = []) {
    this.checkpoints.set(stageName, {
      stageName,
      savedAt: new Date().toISOString(),
      taskResults,
    })
  }

  restoreFromCheckpoint(stageName) {
    const checkpoint = this.checkpoints.get(stageName)
    if (!checkpoint) return null
    for (const result of checkpoint.taskResults) {
      const task = this.tasks.find((t) => t.id === result.taskId)
      if (task && task.status === 'pending') {
        task.status = result.status || 'succeeded'
      }
    }
    return checkpoint
  }

  async run(options = {}) {
    const { onTaskExecute, onStageApproval } = options
    if (this.state !== PIPELINE_STATE.IDLE && this.state !== PIPELINE_STATE.INTERRUPTED) {
      return { ok: false, error: `管线当前状态为 ${this.state}，无法启动` }
    }

    this.state = PIPELINE_STATE.RUNNING
    this.pauseRequested = false
    this.stopRequested = false
    this.emit('pipeline:start')

    const stages = getStageDefinitions()

    for (const stage of stages) {
      if (this.stopRequested) {
        this.state = PIPELINE_STATE.STOPPED
        this.emit('pipeline:stop')
        return { ok: false, stopped: true, completedStages: Array.from(this.completedStages) }
      }

      if (this.pauseRequested) {
        this.state = PIPELINE_STATE.PAUSED
        this.emit('pipeline:pause', { stage: stage.name })
        return { ok: false, paused: true, pausedAtStage: stage.name }
      }

      if (stage.dependsOn && !stage.dependsOn.every((dep) => this.completedStages.has(dep))) {
        continue
      }

      if (!isStageReady(stage.name, this.completedStages)) {
        continue
      }

      this.currentStage = stage.name
      this.emit('stage:start', { stage: stage.name, displayName: stage.displayName })

      const stageTasks = this.getTasksForStage(stage.name)
      const taskResults = []

      for (const task of stageTasks) {
        if (this.stopRequested) break
        if (this.pauseRequested) break

        if (task.status !== 'pending') continue

        task.status = 'running'
        this.emit('task:start', { task })

        try {
          if (typeof onTaskExecute === 'function') {
            const result = await onTaskExecute(task)
            task.status = result?.ok ? 'succeeded' : 'failed'
            task.result = result
            taskResults.push({ taskId: task.id, status: task.status, result })
            this.emit('task:done', { task, result })
          } else {
            task.status = 'succeeded'
            taskResults.push({ taskId: task.id, status: 'succeeded' })
            this.emit('task:done', { task })
          }
        } catch (error) {
          task.status = 'failed'
          task.error = error instanceof Error ? error.message : String(error)
          taskResults.push({ taskId: task.id, status: 'failed', error: task.error })
          this.emit('task:failed', { task, error: task.error })
        }
      }

      this.saveCheckpoint(stage.name, taskResults)
      this.completedStages.add(stage.name)
      this.emit('stage:done', { stage: stage.name, taskCount: taskResults.length })

      if (stage.humanApproval && typeof onStageApproval === 'function') {
        this.state = PIPELINE_STATE.AWAITING_APPROVAL
        this.emit('stage:approval', { stage: stage.name })
        const approval = await onStageApproval(stage, taskResults)
        if (!approval?.approved) {
          this.state = PIPELINE_STATE.PAUSED
          this.emit('pipeline:pause', { stage: stage.name, reason: 'approval_rejected' })
          return { ok: false, paused: true, pausedAtStage: stage.name, reason: 'approval_rejected' }
        }
        this.state = PIPELINE_STATE.RUNNING
      }
    }

    this.state = PIPELINE_STATE.COMPLETED
    this.currentStage = null
    this.emit('pipeline:done')
    return { ok: true, completedStages: Array.from(this.completedStages) }
  }

  pause() {
    if (this.state !== PIPELINE_STATE.RUNNING) return false
    this.pauseRequested = true
    return true
  }

  resume(options = {}) {
    if (this.state !== PIPELINE_STATE.PAUSED && this.state !== PIPELINE_STATE.INTERRUPTED) {
      return false
    }
    this.state = PIPELINE_STATE.IDLE
    this.pauseRequested = false
    this.emit('pipeline:resume')
    return this.run(options)
  }

  stop() {
    if (![PIPELINE_STATE.RUNNING, PIPELINE_STATE.PAUSED, PIPELINE_STATE.COOLDOWN, PIPELINE_STATE.AWAITING_APPROVAL].includes(this.state)) {
      return false
    }
    this.stopRequested = true
    return true
  }

  reset() {
    this.state = PIPELINE_STATE.IDLE
    this.currentStage = null
    this.completedStages = new Set()
    this.checkpoints = new Map()
    this.pauseRequested = false
    this.stopRequested = false
    this.emit('pipeline:reset')
  }

  getProgress() {
    const totalStages = this.pipeline.stages.length
    const completedStages = this.completedStages.size
    const totalTasks = this.tasks.length
    const completedTasks = this.tasks.filter((t) => ['succeeded', 'failed', 'skipped'].includes(t.status)).length
    return {
      stageProgress: totalStages ? completedStages / totalStages : 0,
      taskProgress: totalTasks ? completedTasks / totalTasks : 0,
      completedStages,
      totalStages,
      completedTasks,
      totalTasks,
      currentStage: this.currentStage,
      state: this.state,
    }
  }
}

export const PIPELINE_STATES = PIPELINE_STATE

export const createPipelineRunner = (options) => new PipelineRunner(options)
