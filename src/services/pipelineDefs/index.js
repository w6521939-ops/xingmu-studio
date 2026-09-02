export { manjuDramaPipeline, getStageDefinitions, getStageByTaskKind, resolveStageOrder, isStageReady } from './manjuDrama.js'
export { talkingHeadPipeline, getTalkingHeadStages } from './talkingHead.js'
export { screenDemoPipeline, getScreenDemoStages } from './screenDemo.js'
export { podcastRepurposePipeline, getPodcastRepurposeStages } from './podcastRepurpose.js'
export { PipelineRunner, PIPELINE_STATES, createPipelineRunner } from './pipelineRunner.js'

import { manjuDramaPipeline } from './manjuDrama.js'
import { talkingHeadPipeline } from './talkingHead.js'
import { screenDemoPipeline } from './screenDemo.js'
import { podcastRepurposePipeline } from './podcastRepurpose.js'

export const availablePipelines = Object.freeze([
  manjuDramaPipeline,
  talkingHeadPipeline,
  screenDemoPipeline,
  podcastRepurposePipeline,
])

export function getPipelineByName(name) {
  return availablePipelines.find((p) => p.name === name) || null
}

export function listPipelineSummaries() {
  return availablePipelines.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    stageCount: p.stages.length,
    approvalGates: p.stages.filter((s) => s.humanApproval).map((s) => s.displayName),
  }))
}
