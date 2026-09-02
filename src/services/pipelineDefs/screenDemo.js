export const screenDemoPipeline = Object.freeze({
  name: 'screen-demo',
  displayName: '屏幕录制演示',
  description: '屏幕录制 + AI 旁白 + 标注动画，适合产品演示、教程制作',
  version: 1,
  stages: Object.freeze([
    Object.freeze({
      name: 'preflight',
      displayName: '环境检查',
      humanApproval: false,
      taskFilter: (task) => task.stage === 'preflight',
    }),
    Object.freeze({
      name: 'script',
      displayName: '旁白脚本',
      humanApproval: true,
      dependsOn: ['preflight'],
      taskFilter: (task) => task.stage === 'script',
    }),
    Object.freeze({
      name: 'narration',
      displayName: '旁白配音',
      humanApproval: false,
      dependsOn: ['script'],
      taskFilter: (task) => task.stage === 'narration',
    }),
    Object.freeze({
      name: 'recording',
      displayName: '屏幕录制',
      humanApproval: true,
      dependsOn: ['script'],
      taskFilter: (task) => task.stage === 'recording',
    }),
    Object.freeze({
      name: 'annotation',
      displayName: '标注动画',
      humanApproval: false,
      dependsOn: ['recording', 'narration'],
      taskFilter: (task) => task.stage === 'annotation',
    }),
    Object.freeze({
      name: 'subtitle',
      displayName: '字幕烧录',
      humanApproval: false,
      dependsOn: ['narration'],
      taskFilter: (task) => task.stage === 'subtitle',
    }),
    Object.freeze({
      name: 'compose',
      displayName: '视频合成',
      humanApproval: false,
      dependsOn: ['recording', 'narration', 'annotation', 'subtitle'],
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

export const getScreenDemoStages = () => screenDemoPipeline.stages
