export const talkingHeadPipeline = Object.freeze({
  name: 'talking-head',
  displayName: '口播视频',
  description: '数字人头像 + AI 语音 + 动态字幕，适合知识分享、产品口播',
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
      displayName: '口播脚本',
      humanApproval: true,
      dependsOn: ['preflight'],
      taskFilter: (task) => task.stage === 'script',
    }),
    Object.freeze({
      name: 'avatar',
      displayName: '数字人形象',
      humanApproval: true,
      dependsOn: ['script'],
      taskFilter: (task) => task.stage === 'avatar',
    }),
    Object.freeze({
      name: 'voice',
      displayName: '语音合成',
      humanApproval: false,
      dependsOn: ['script'],
      taskFilter: (task) => task.stage === 'voice',
    }),
    Object.freeze({
      name: 'subtitle',
      displayName: '动态字幕',
      humanApproval: false,
      dependsOn: ['voice'],
      taskFilter: (task) => task.stage === 'subtitle',
    }),
    Object.freeze({
      name: 'compose',
      displayName: '视频合成',
      humanApproval: false,
      dependsOn: ['avatar', 'voice', 'subtitle'],
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

export const getTalkingHeadStages = () => talkingHeadPipeline.stages
