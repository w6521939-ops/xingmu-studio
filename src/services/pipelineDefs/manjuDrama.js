import { oneClickProductionStageDefinitions } from '../oneClickProductionPlanService.js'

export const manjuDramaPipeline = Object.freeze({
  name: 'manju-drama',
  displayName: '漫剧制作',
  description: '从剧本自动补齐角色图、场景图、分镜图、配音和镜头视频，最后合成每集 MP4',
  stages: Object.freeze([
    Object.freeze({
      name: 'preflight',
      displayName: '本地检查',
      humanApproval: false,
      taskFilter: (task) => task.stage === 'preflight',
    }),
    Object.freeze({
      name: 'voice-assignment',
      displayName: '角色音色',
      humanApproval: false,
      dependsOn: ['preflight'],
      taskFilter: (task) => task.stage === 'voice-assignment',
    }),
    Object.freeze({
      name: 'character-images',
      displayName: '角色图片',
      humanApproval: false,
      dependsOn: ['voice-assignment'],
      taskFilter: (task) => task.stage === 'character-images',
    }),
    Object.freeze({
      name: 'scene-images',
      displayName: '场景图片',
      humanApproval: false,
      dependsOn: ['voice-assignment'],
      taskFilter: (task) => task.stage === 'scene-images',
    }),
    Object.freeze({
      name: 'storyboard-images',
      displayName: '分镜图片',
      humanApproval: false,
      dependsOn: ['character-images', 'scene-images'],
      taskFilter: (task) => task.stage === 'storyboard-images',
    }),
    Object.freeze({
      name: 'voice-lines',
      displayName: '台词配音',
      humanApproval: false,
      dependsOn: ['voice-assignment'],
      taskFilter: (task) => task.stage === 'voice-lines',
    }),
    Object.freeze({
      name: 'shot-videos',
      displayName: '镜头视频',
      humanApproval: false,
      dependsOn: ['storyboard-images', 'voice-lines'],
      taskFilter: (task) => task.stage === 'shot-videos',
    }),
    Object.freeze({
      name: 'episode-exports',
      displayName: '自动成片',
      humanApproval: false,
      dependsOn: ['shot-videos', 'voice-lines'],
      taskFilter: (task) => task.stage === 'episode-exports',
    }),
    Object.freeze({
      name: 'finalize',
      displayName: '完成保存',
      humanApproval: false,
      dependsOn: ['episode-exports'],
      taskFilter: (task) => task.stage === 'finalize',
    }),
  ]),
})

export const getStageDefinitions = () => manjuDramaPipeline.stages

export const getStageByTaskKind = (taskKind) => {
  for (const stage of manjuDramaPipeline.stages) {
    if (stage.taskFilter({ stage: stage.name, kind: taskKind })) return stage
  }
  return null
}

export const resolveStageOrder = () => manjuDramaPipeline.stages.map((stage) => stage.name)

export const isStageReady = (stageName, completedStages) => {
  const stage = manjuDramaPipeline.stages.find((s) => s.name === stageName)
  if (!stage) return false
  if (!stage.dependsOn) return true
  return stage.dependsOn.every((dep) => completedStages.has(dep))
}
