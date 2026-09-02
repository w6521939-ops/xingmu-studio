export const podcastRepurposePipeline = Object.freeze({
  name: 'podcast-repurpose',
  displayName: '播客再利用',
  description: '播客音频 → 转录 → 精选片段 → 短视频，适合播客内容二次分发',
  version: 1,
  stages: Object.freeze([
    Object.freeze({
      name: 'preflight',
      displayName: '环境检查',
      humanApproval: false,
      taskFilter: (task) => task.stage === 'preflight',
    }),
    Object.freeze({
      name: 'audio-import',
      displayName: '音频导入',
      humanApproval: false,
      dependsOn: ['preflight'],
      taskFilter: (task) => task.stage === 'audio-import',
    }),
    Object.freeze({
      name: 'transcription',
      displayName: '语音转文字',
      humanApproval: false,
      dependsOn: ['audio-import'],
      taskFilter: (task) => task.stage === 'transcription',
    }),
    Object.freeze({
      name: 'clip-extraction',
      displayName: '片段精选',
      humanApproval: true,
      dependsOn: ['transcription'],
      taskFilter: (task) => task.stage === 'clip-extraction',
    }),
    Object.freeze({
      name: 'subtitle',
      displayName: '字幕生成',
      humanApproval: false,
      dependsOn: ['clip-extraction'],
      taskFilter: (task) => task.stage === 'subtitle',
    }),
    Object.freeze({
      name: 'cover-image',
      displayName: '封面图',
      humanApproval: false,
      dependsOn: ['clip-extraction'],
      taskFilter: (task) => task.stage === 'cover-image',
    }),
    Object.freeze({
      name: 'compose',
      displayName: '视频合成',
      humanApproval: false,
      dependsOn: ['clip-extraction', 'subtitle', 'cover-image'],
      taskFilter: (task) => task.stage === 'compose',
    }),
    Object.freeze({
      name: 'finalize',
      displayName: '完成导出',
      humanApproval: false,
      dependsOn: ['compose'],
      taskFilter: (task) => task.stage === 'finalize',
    }),
  ]),
})

export const getPodcastRepurposeStages = () => podcastRepurposePipeline.stages
