import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  generateBailianScript,
  generateBailianImage,
  getBailianImageDryRun,
  getBailianScriptDryRun,
} from '../electron/bailianProviderService.js'
import { exportTimelineVideo, getFfmpegExecutablePath } from '../electron/videoExportService.js'
import { generateBailianVoice } from '../electron/bailianTtsService.js'
import { createShotVideoProjectKey, prepareLocalShotVideoFromPath } from '../electron/shotVideoAssetService.js'
import { resolveManagedVoiceAssetPath } from '../electron/voiceAssetService.js'

const workspaceRoot = process.cwd()
const outputRoot = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo')
const keyFile = path.join(workspaceRoot, 'key.txt')
const workspaceFile = path.join(workspaceRoot, 'workspace.txt')
const statePath = path.join(outputRoot, 'run-state.json')
const scriptResultPath = path.join(outputRoot, '01-script-result.json')
const curatedScriptPath = path.join(outputRoot, '02-production-script.json')
const canonicalRoot = path.join(outputRoot, 'canonical')
const execute = process.argv.includes('--execute')
const execFileAsync = promisify(execFile)
const ffmpegPath = getFfmpegExecutablePath({ isPackaged: false, resourcesPath: '', projectDirectory: workspaceRoot })
const projectLocalId = 'local-lighthouse-echo-interview-demo'
const appDataRoot = path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'), '星幕工坊')
const voiceMediaRoot = path.join(appDataRoot, 'media', 'voices')
const shotVideoMediaRoot = path.join(appDataRoot, 'media', 'shot-videos')

const readTrimmed = async (filePath) => (await readFile(filePath, 'utf8')).trim()
const exists = async (filePath) => stat(filePath).then(() => true).catch(() => false)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const readState = async () => {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return {
      version: 1,
      project: '灯塔回响',
      createdAt: new Date().toISOString(),
      freeTierGuard: 'BAILIAN_FREE_TIER_CONFIRMED=1 required for real generation',
      steps: {},
    }
  }
}

const saveState = async (state) => {
  state.updatedAt = new Date().toISOString()
  await writeJson(statePath, state)
}

const scriptRequest = {
  confirmed: true,
  genre: '悬疑科幻漫剧',
  ratio: '9:16',
  duration: '15秒',
  theme: [
    '项目名固定为《灯塔回响》。只写一集15秒竖屏面试演示，必须恰好1个section、3个shot，每镜5秒。',
    '主角林晚，28岁中国女性灯塔维修员，短黑发被雨打湿，深海军蓝防水工装，旧黄铜吊坠；身份、发型、服装全程不变。',
    '唯一场景是暴雨夜的废弃海岛灯塔，外部石阶与底层机房空间连续。核心道具是银灰色强光手电和贴有“守一，10月17日”纸签的旧磁带录音机。',
    '镜头1：林晚冒雨登上灯塔石阶，旁白“父亲失踪的第七年，灯塔又亮了。”',
    '镜头2：她进入底层机房，发现录音机并低声说“这盘磁带，怎么会在这里？”',
    '镜头3：录音机自行启动，父亲录音说“林晚，别上楼。”暖灯同时亮起，她猛然望向螺旋楼梯，形成悬念钩子。',
    'visualStyle必须是电影级写实3D动画、冷青暴雨、暖钨丝灯对比、统一角色与道具连续性。不要增加第二角色出镜，不要增加镜头。',
  ].join(''),
}

const canonicalRequests = [
  {
    purpose: 'character',
    size: '1536*1024',
    entityId: 'C01',
    name: '林晚角色定妆卡',
    prompt: 'Character turnaround reference sheet, Lin Wan, 28-year-old Chinese female lighthouse maintenance engineer, short rain-soaked black hair, focused dark eyes, navy waterproof work jacket with reflective piping, black cargo pants, worn brass pendant, full body front three-quarter and profile views, neutral gray studio background, cinematic realistic 3D animation, identity lock, no text, no extra character.',
    references: [],
  },
  {
    purpose: 'scene',
    size: '1536*1024',
    entityId: 'P01-P02',
    name: '关键道具设定卡',
    prompt: 'Production prop reference sheet showing exactly two separate objects: a compact silver-gray high-power flashlight with worn grip, and an old rust-speckled magnetic cassette recorder with a cream paper label reading 守一，10月17日, orthographic product views, neutral gray background, cinematic realistic 3D asset design, no hands, no extra objects.',
    references: [],
  },
  {
    purpose: 'scene',
    size: '1536*1024',
    entityId: 'SC01',
    name: '废弃灯塔场景设定卡',
    prompt: 'Environment concept reference sheet of an abandoned island lighthouse during a violent rainy night, continuous exterior wet stone stairs leading into the lower mechanical room, rusted spiral staircase inside, peeling white walls, puddles, cold cyan storm light outside contrasted with one dormant tungsten lamp inside, cinematic realistic 3D animation, vertical composition guide, no people, no text.',
    references: [],
  },
]

const curateThreeShotScript = (script) => {
  const section = script.sections?.[0]
  if (!section || !Array.isArray(section.shots) || section.shots.length < 3) {
    throw new Error('模型剧本没有返回可用的三个镜头')
  }
  const shots = section.shots.slice(0, 3).map((shot, index) => ({
    ...shot,
    id: `S01-${String(index + 1).padStart(2, '0')}`,
    time: `${index * 5}-${(index + 1) * 5}秒`,
  }))
  return {
    ...script,
    title: '灯塔回响',
    logline: '父亲失踪七年后，灯塔维修员林晚在暴雨夜重返废弃灯塔，却从一台旧录音机里听见了父亲阻止她上楼的声音。',
    theme: '失踪真相、亲情执念与未知警告。',
    visualStyle: '电影级写实3D动画，冷青暴雨与暖钨丝灯对比，湿润材质，高反差体积光，竖屏悬疑短剧。',
    styleBible: {
      rendering: 'cinematic realistic 3D animation',
      palette: 'cold cyan storm exterior, warm tungsten interior accent',
      framing: '9:16 vertical, center-safe character and prop composition',
      forbiddenDrift: ['不得改变林晚的脸型、短黑发、工装或吊坠', '不得改变手电与录音机外观', '不得增加出镜角色', '不得改成日间或晴天'],
    },
    characters: [{
      id: 'C01',
      name: '林晚',
      identity: '28岁中国女性灯塔维修员，父亲失踪事件的调查者',
      appearance: '清瘦椭圆脸，深色眼睛，短黑发被雨打湿贴在额前，神情克制警觉',
      costume: '深海军蓝防水工装外套带细反光条，黑色工装裤，防水工作靴，胸前佩戴旧黄铜吊坠',
      voice: '低沉克制的年轻女声，紧张时仍保持清晰',
      forbiddenDrift: ['脸型不变', '短黑发不变', '深海军蓝工装不变', '旧黄铜吊坠始终存在'],
    }],
    props: [
      {
        id: 'P01',
        name: '银灰色强光手电',
        appearance: '短筒银灰金属外壳，黑色磨损防滑握把，冷白圆形光束',
        storyFunction: '林晚在暴雨与黑暗机房中的唯一主动光源',
        forbiddenDrift: ['始终为银灰短筒', '冷白光', '不得变成提灯或手机'],
      },
      {
        id: 'P02',
        name: '旧磁带录音机',
        appearance: '米灰色便携磁带录音机，边角有锈斑，正面透明磁带窗，贴有“守一，10月17日”奶油色纸签',
        storyFunction: '播放父亲留下的警告，触发结尾悬念',
        forbiddenDrift: ['纸签文字不变', '米灰机身与锈斑不变', '不得变成现代数字设备'],
      },
    ],
    scenes: [
      {
        id: 'SC01',
        name: '废弃海岛灯塔外部石阶',
        time: '暴雨深夜',
        weather: '强风暴雨与海雾',
        layout: '湿滑石阶沿黑色礁石盘旋上升，通往灯塔底层铁门',
        lighting: '冷青月光与手电冷白光，远处灯塔顶端异常微光',
        palette: '冷青、深蓝、湿黑',
      },
      {
        id: 'SC02',
        name: '灯塔底层机房',
        time: '同一暴雨深夜，紧接外部石阶',
        weather: '门外暴雨，室内漏水',
        layout: '剥落白墙、积水地面、旧控制柜与通向上层的锈蚀螺旋楼梯',
        lighting: '手电冷白光为主，结尾一盏暖钨丝灯突然点亮',
        palette: '冷青灰、锈褐、单点暖橙',
      },
    ],
    sections: [{ ...section, id: 'S01', durationSeconds: 15, shots }],
    productionContract: {
      ratio: '9:16',
      totalDurationSeconds: 15,
      shotCount: 3,
      referenceOrder: ['character:C01', 'prop:P01-P02', 'scene:SC01'],
      adjacentFrameContinuity: true,
      explicitFirstAndLastFrameForEveryVideo: true,
    },
  }
}

const canonicalFileNames = ['character-c01.png', 'props-p01-p02.png', 'scene-sc01.png']

const frameRequests = [
  {
    entityId: 'F01',
    name: '镜头一首帧',
    prompt: '9:16 vertical center-safe cinematic frame, violent rainy night on the wet stone stairs below an abandoned island lighthouse. Lin Wan is centered in the lower third, climbing upward toward camera-right, full body visible, holding the locked silver-gray flashlight with a cold white beam. Her face, short wet black hair, navy waterproof work jacket, black cargo pants and brass pendant exactly match the character reference. Cold cyan storm palette, realistic 3D animation, dramatic rain, no text, no extra people, no duplicate person, no split screen.',
  },
  {
    entityId: 'F02',
    name: '镜头一末帧与镜头二首帧',
    prompt: '9:16 vertical center-safe cinematic frame at the threshold of the abandoned lighthouse lower mechanical room. Lin Wan has just pushed the rusty door open and stands centered, seen in three-quarter profile, the locked silver-gray flashlight beam entering the dark room. Wet navy work jacket, short wet black hair and brass pendant exactly match reference. Behind her the stormy stairs remain visible, ahead are peeling walls and the spiral staircase. Cold cyan light, realistic 3D animation, no text, no extra people, no duplicate person, no split screen.',
  },
  {
    entityId: 'F03',
    name: '镜头二末帧与镜头三首帧',
    prompt: '9:16 vertical center-safe cinematic medium close frame inside the lighthouse lower mechanical room. Lin Wan kneels centered beside the locked old cassette recorder, touching its cream label reading 守一，10月17日 with one hand while holding the locked silver-gray flashlight in the other. Her face, short wet black hair, navy work jacket and brass pendant exactly match reference. The recorder is prominent in foreground, spiral stairs in background, cold flashlight lighting, realistic 3D animation, no extra people, no duplicate limbs, no split screen.',
  },
  {
    entityId: 'F04',
    name: '镜头三末帧',
    prompt: '9:16 vertical center-safe cinematic suspense ending frame inside the same lighthouse room. The locked old cassette recorder is running in foreground, its cream label 守一，10月17日 visible. A single warm tungsten bulb suddenly illuminates the rusty spiral staircase. Lin Wan stands centered and sharply turns upward in alarm, flashlight beam tilted toward the stairs; her face, short wet black hair, navy work jacket and brass pendant exactly match reference. Cold cyan shadows with warm orange lamp contrast, realistic 3D animation, no extra people, no duplicate person, no split screen.',
  },
]

const voiceLines = [
  { id: 'line-01', speaker: '旁白', text: '父亲失踪的第七年，灯塔又亮了。', voiceId: 'Cherry' },
  { id: 'line-02', speaker: '林晚', text: '这盘磁带，怎么会在这里？', voiceId: 'Cherry' },
  { id: 'line-03', speaker: '父亲录音', text: '林晚，别上楼。', voiceId: 'Ethan' },
]

const videoPrompts = [
  'Maintain exact identity, clothing, flashlight and lighthouse continuity between the supplied first and last frames. Lin Wan steadily climbs the wet stone stairs through violent rain while the camera slowly pushes forward and rises with her. Natural coat and hair movement, flashlight beam sweeps across puddles, cinematic realistic 3D animation. End exactly at the doorway pose in the last frame. No extra people, no duplicate limbs, no speaking, no subtitles, no text.',
  'Maintain exact identity, clothing, props and room continuity between the supplied first and last frames. Lin Wan crosses the lighthouse doorway, sweeps the flashlight across peeling walls, notices the old cassette recorder, approaches and kneels beside it. Smooth medium tracking shot into a gentle push-in, cinematic realistic 3D animation. End exactly at the recorder pose in the last frame. No extra people, no duplicate limbs, no speaking, no subtitles, no text.',
  'Maintain exact identity, clothing, flashlight, cassette recorder and spiral staircase continuity between the supplied first and last frames. The cassette reels begin turning by themselves, the warm tungsten bulb flickers on, and Lin Wan recoils then sharply looks up toward the spiral stairs as her flashlight beam tilts upward. Suspenseful slow pull-back, cold cyan shadows and warm lamp contrast, cinematic realistic 3D animation. End exactly at the alarmed pose in the last frame. No extra people, no duplicate limbs, no lip movement, no subtitles, no text.',
]

const toJpeg = async (sourcePath, targetPath, { portrait = false } = {}) => {
  await mkdir(path.dirname(targetPath), { recursive: true })
  const filter = portrait
    ? 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280'
    : "scale='min(1024,iw)':-2"
  await execFileAsync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
    '-vf', filter, '-frames:v', '1', '-q:v', '4', targetPath,
  ])
  return targetPath
}

const imageDataUrl = async (filePath) => `data:image/jpeg;base64,${(await readFile(filePath)).toString('base64')}`

const prepareCanonicalReferences = async () => {
  const referenceRoot = path.join(canonicalRoot, 'references')
  const names = ['01-character.jpg', '02-props.jpg', '03-scene.jpg']
  const references = []
  for (let index = 0; index < canonicalFileNames.length; index += 1) {
    const sourcePath = path.join(canonicalRoot, canonicalFileNames[index])
    const targetPath = path.join(referenceRoot, names[index])
    if (!(await exists(targetPath))) await toJpeg(sourcePath, targetPath)
    references.push({
      id: canonicalRequests[index].entityId,
      name: canonicalRequests[index].name,
      dataUrl: await imageDataUrl(targetPath),
    })
  }
  return references
}

const generateFrames = async ({ state, apiHost }) => {
  const frameRoot = path.join(outputRoot, 'frames')
  await mkdir(frameRoot, { recursive: true })
  const references = await prepareCanonicalReferences()
  state.steps.frames ||= { ok: false, assets: [] }
  for (let index = 0; index < frameRequests.length; index += 1) {
    const frame = frameRequests[index]
    const targetPath = path.join(frameRoot, `f${String(index + 1).padStart(2, '0')}.jpg`)
    const existing = state.steps.frames.assets[index]
    if (existing?.ok && await exists(targetPath)) continue
    const request = {
      purpose: 'storyboard',
      size: '1536*1024',
      entityId: frame.entityId,
      name: frame.name,
      prompt: frame.prompt,
      references,
      confirmed: true,
    }
    const result = await generateBailianImage({
      request,
      workspaceRoot,
      keyCandidates: [{ filePath: keyFile, label: 'project key.txt' }],
      apiHost,
      allowPaidGeneration: true,
    })
    if (!result.ok) throw new Error(`${frame.name}生成失败：${result.error || '未知错误'}`)
    const sourcePath = path.join(workspaceRoot, result.image.localPath)
    await toJpeg(sourcePath, targetPath, { portrait: true })
    state.steps.frames.assets[index] = {
      ok: true,
      completedAt: new Date().toISOString(),
      entityId: frame.entityId,
      name: frame.name,
      prompt: frame.prompt,
      referenceOrder: references.map((reference) => reference.id),
      model: result.model,
      requestId: result.requestId,
      taskId: result.taskId,
      usage: result.usage,
      image: result.image,
      savedCopy: path.relative(workspaceRoot, targetPath).split(path.sep).join('/'),
      bytes: (await stat(targetPath)).size,
    }
    await writeJson(path.join(frameRoot, `f${String(index + 1).padStart(2, '0')}.json`), result)
    await saveState(state)
  }
  state.steps.frames.ok = state.steps.frames.assets.length === frameRequests.length
    && state.steps.frames.assets.every((asset) => asset?.ok)
  state.steps.frames.completedAt = new Date().toISOString()
  await saveState(state)
}

const generateVoices = async ({ state, apiHost }) => {
  const audioRoot = path.join(outputRoot, 'audio')
  await mkdir(audioRoot, { recursive: true })
  state.steps.voices ||= { ok: false, assets: [] }
  const projectKey = createShotVideoProjectKey(projectLocalId)
  for (let index = 0; index < voiceLines.length; index += 1) {
    const line = voiceLines[index]
    const targetPath = path.join(audioRoot, `${line.id}.wav`)
    const existing = state.steps.voices.assets[index]
    if (existing?.ok && await exists(targetPath)) continue
    const result = await generateBailianVoice({
      request: { confirmed: true, lineId: line.id, text: line.text, voiceId: line.voiceId },
      keyCandidates: [{ filePath: keyFile, label: 'project key.txt' }],
      apiHost,
      allowPaidGeneration: true,
      voiceMediaRoot,
      projectLocalId,
    })
    if (!result.ok) throw new Error(`${line.speaker}配音生成失败：${result.error || '未知错误'}`)
    const managedPath = resolveManagedVoiceAssetPath({ mediaRoot: voiceMediaRoot, projectKey, assetId: result.asset.id })
    await copyFile(managedPath, targetPath)
    state.steps.voices.assets[index] = {
      ok: true,
      completedAt: new Date().toISOString(),
      ...line,
      model: result.model,
      requestId: result.requestId,
      usage: result.usage,
      asset: result.asset,
      mediaUrl: result.mediaUrl,
      savedCopy: path.relative(workspaceRoot, targetPath).split(path.sep).join('/'),
    }
    await writeJson(path.join(audioRoot, `${line.id}.json`), result)
    await saveState(state)
  }
  state.steps.voices.ok = state.steps.voices.assets.length === voiceLines.length
    && state.steps.voices.assets.every((asset) => asset?.ok)
  state.steps.voices.completedAt = new Date().toISOString()
  await saveState(state)
}

const parseApiKey = (value) => {
  const normalized = String(value || '').trim().replace(/^DASHSCOPE_API_KEY\s*=\s*/u, '').replace(/^['"]|['"]$/gu, '')
  if (!normalized.startsWith('sk-')) throw new Error('key.txt 不是有效的百炼 API Key')
  return normalized
}

const requestJson = async (url, key, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 1000) } }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`)
  return data
}

const trustedAlibabaUrl = (value) => {
  const url = new URL(String(value || ''))
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || !(host === 'aliyuncs.com' || host.endsWith('.aliyuncs.com') || host === 'alicdn.com' || host.endsWith('.alicdn.com'))) {
    throw new Error('视频结果地址不在受信任的阿里云域名')
  }
  return url.toString()
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const generateVideos = async ({ state, apiHost }) => {
  const videoRoot = path.join(outputRoot, 'video')
  await mkdir(videoRoot, { recursive: true })
  state.steps.videos ||= { ok: false, assets: [] }
  const key = parseApiKey(await readTrimmed(keyFile))
  const endpoint = `${apiHost}/api/v1/services/aigc/video-generation/video-synthesis`
  for (let index = 0; index < videoPrompts.length; index += 1) {
    const sequence = String(index + 1).padStart(2, '0')
    const targetPath = path.join(videoRoot, `shot-${sequence}.mp4`)
    const resultPath = path.join(videoRoot, `shot-${sequence}.json`)
    const submitPath = path.join(videoRoot, `shot-${sequence}-submit.json`)
    const firstFramePath = path.join(outputRoot, 'frames', `f${sequence}.jpg`)
    const lastFramePath = path.join(outputRoot, 'frames', `f${String(index + 2).padStart(2, '0')}.jpg`)
    const entry = state.steps.videos.assets[index] || { ok: false, index: index + 1 }
    if (entry.ok && await exists(targetPath)) continue
    if (!entry.taskId) {
      const body = {
        model: 'wan2.7-i2v-2026-04-25',
        input: {
          prompt: videoPrompts[index],
          negative_prompt: 'extra people, duplicate person, duplicate limbs, identity drift, costume change, prop change, subtitles, text, watermark, logo, low quality, flicker',
          media: [
            { type: 'first_frame', url: await imageDataUrl(firstFramePath) },
            { type: 'last_frame', url: await imageDataUrl(lastFramePath) },
          ],
        },
        parameters: { resolution: '720P', duration: 5, prompt_extend: true, watermark: false },
      }
      const submitted = await requestJson(endpoint, key, {
        method: 'POST',
        headers: { 'X-DashScope-Async': 'enable' },
        body,
      })
      await writeJson(submitPath, submitted)
      entry.taskId = submitted?.output?.task_id || ''
      entry.requestId = submitted?.request_id || ''
      entry.model = body.model
      entry.prompt = videoPrompts[index]
      entry.firstFrame = path.relative(workspaceRoot, firstFramePath).split(path.sep).join('/')
      entry.lastFrame = path.relative(workspaceRoot, lastFramePath).split(path.sep).join('/')
      entry.submittedAt = new Date().toISOString()
      if (!entry.taskId) throw new Error(`镜头${index + 1}视频任务缺少 task_id`)
      state.steps.videos.assets[index] = entry
      await saveState(state)
    }
    const deadline = Date.now() + 30 * 60 * 1000
    let taskResult
    while (Date.now() < deadline) {
      taskResult = await requestJson(`${apiHost}/api/v1/tasks/${encodeURIComponent(entry.taskId)}`, key)
      entry.taskStatus = taskResult?.output?.task_status || 'UNKNOWN'
      entry.lastPolledAt = new Date().toISOString()
      state.steps.videos.assets[index] = entry
      await saveState(state)
      if (['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'].includes(entry.taskStatus)) break
      await wait(15000)
    }
    await writeJson(resultPath, taskResult || { output: { task_status: 'TIMEOUT' } })
    if (entry.taskStatus !== 'SUCCEEDED') {
      throw new Error(`镜头${index + 1}视频任务结束于 ${entry.taskStatus || 'TIMEOUT'}：${taskResult?.output?.message || ''}`)
    }
    const videoUrl = trustedAlibabaUrl(taskResult?.output?.video_url)
    const download = await fetch(videoUrl)
    if (!download.ok) throw new Error(`镜头${index + 1}视频下载失败（HTTP ${download.status}）`)
    const buffer = Buffer.from(await download.arrayBuffer())
    if (!buffer.length) throw new Error(`镜头${index + 1}视频文件为空`)
    await writeFile(targetPath, buffer)
    entry.ok = true
    entry.completedAt = new Date().toISOString()
    entry.usage = taskResult?.usage || null
    entry.savedCopy = path.relative(workspaceRoot, targetPath).split(path.sep).join('/')
    entry.bytes = buffer.length
    entry.sha256 = sha256(buffer)
    state.steps.videos.assets[index] = entry
    await saveState(state)
  }
  state.steps.videos.ok = state.steps.videos.assets.length === videoPrompts.length
    && state.steps.videos.assets.every((asset) => asset?.ok)
  state.steps.videos.completedAt = new Date().toISOString()
  await saveState(state)
}

const prepareManagedVideos = async (state) => {
  for (let index = 0; index < state.steps.videos.assets.length; index += 1) {
    const entry = state.steps.videos.assets[index]
    if (entry.managedAsset?.id) continue
    const sequence = String(index + 1).padStart(2, '0')
    const prepared = await prepareLocalShotVideoFromPath({
      sourcePath: path.join(outputRoot, 'video', `shot-${sequence}.mp4`),
      projectLocalId,
      mediaRoot: shotVideoMediaRoot,
      ffmpegPath,
      assetId: `shot-video-lighthouse-${sequence}`,
    })
    prepared.asset.source = 'bailian-download'
    entry.managedAsset = prepared.asset
    entry.mediaUrl = prepared.mediaUrl
    await saveState(state)
  }
}

const subtitleCues = [
  { id: 'subtitle-01', sourceItemId: 'timeline-1', start: 0.2, end: 4.6, text: '父亲失踪的第七年，灯塔又亮了。' },
  { id: 'subtitle-02', sourceItemId: 'timeline-2', start: 5.4, end: 9.6, text: '这盘磁带，怎么会在这里？' },
  { id: 'subtitle-03', sourceItemId: 'timeline-3', start: 10.7, end: 13.8, text: '林晚，别上楼。' },
]

const buildFinalVideo = async (state) => {
  const outputPath = path.join(outputRoot, '灯塔回响-15秒面试演示.mp4')
  if (!state.steps.finalVideo?.ok || !(await exists(outputPath))) {
    const items = voiceLines.map((line, index) => {
      const sequence = String(index + 1).padStart(2, '0')
      return {
        duration: 5,
        subtitle: line.text,
        videoFilePath: path.join(outputRoot, 'video', `shot-${sequence}.mp4`),
        audioFilePath: path.join(outputRoot, 'audio', `${line.id}.wav`),
        voiceOffsetSeconds: index === 2 ? 0.55 : 0.25,
        shot: {
          videoAssetId: state.steps.videos.assets[index].managedAsset.id,
          transition: 'cut',
          transitionIn: 'cut',
          transitionOut: 'cut',
        },
      }
    })
    const progress = []
    const result = await exportTimelineVideo({
      ffmpegPath,
      outputPath,
      width: 1080,
      height: 1920,
      transition: 'cut',
      subtitlesEnabled: true,
      subtitleCues,
      subtitleStyle: {
        fontSize: 58,
        color: '#FFFFFF',
        outlineColor: '#0B1D2A',
        backgroundOpacity: 24,
        position: 'bottom',
        bold: true,
      },
      items,
      onProgress: (event) => progress.push(event),
    })
    await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', outputPath, '-f', 'null', '-'])
    const buffer = await readFile(outputPath)
    state.steps.finalVideo = {
      ok: true,
      completedAt: new Date().toISOString(),
      result,
      progress,
      output: path.relative(workspaceRoot, outputPath).split(path.sep).join('/'),
      bytes: buffer.length,
      sha256: sha256(buffer),
    }
    await writeJson(path.join(outputRoot, '03-final-export.json'), state.steps.finalVideo)
    await saveState(state)
  }
  return outputPath
}

const projectImageFields = (asset) => ({
  image: asset.image.mediaUrl,
  imageStatus: '已完成',
  imageSource: 'bailian-managed',
  imageAssetId: asset.image.assetId,
  imageBytes: asset.image.bytes,
  imageSha256: asset.image.sha256,
  imageFileName: asset.image.fileName,
  imageError: '',
})

const createProjectSnapshot = async (state) => {
  const script = JSON.parse(await readFile(curatedScriptPath, 'utf8'))
  const frameBuffers = await Promise.all([1, 2, 3].map((number) => (
    readFile(path.join(outputRoot, 'frames', `f${String(number).padStart(2, '0')}.jpg`))
  )))
  const frameDataUrls = frameBuffers.map((buffer) => `data:image/jpeg;base64,${buffer.toString('base64')}`)
  const characterAsset = state.steps.canonical.assets[0]
  const propAsset = state.steps.canonical.assets[1]
  const sceneAsset = state.steps.canonical.assets[2]
  const shots = script.sections[0].shots.map((shot, index) => ({
    id: index + 1,
    sourceId: shot.id,
    episodeId: 1,
    sceneId: index === 0 ? 1 : 2,
    variant: index + 1,
    action: shot.action,
    dialogue: shot.dialogue,
    sound: shot.sound,
    duration: '5.0s',
    size: index === 2 ? '特写转全景' : index === 1 ? '中景转特写' : '全景',
    motion: shot.camera,
    visualPrompt: videoPrompts[index],
    characterIds: [1],
    propIds: index === 0 ? [1] : [1, 2],
    continuity: shot.continuity,
    costume: script.characters[0].costume,
    continuityLocked: true,
    image: frameDataUrls[index],
    imageStatus: '已完成',
    imageSource: 'bailian-managed-copy',
    imageFileName: `f${String(index + 1).padStart(2, '0')}.jpg`,
    imageBytes: state.steps.frames.assets[index].bytes,
    imageSha256: sha256(frameBuffers[index]),
    imageError: '',
    videoAssetId: state.steps.videos.assets[index].managedAsset.id,
    videoOffsetSeconds: 0,
    videoDurationPolicy: 'fit-timeline',
    videoContinuitySourceShotId: index > 0 ? index : 0,
    voiceSourceShotId: index + 1,
    voiceOffsetSeconds: index === 2 ? 0.55 : 0.25,
    motionEffect: 'none',
    motionStrength: 12,
    transition: 'cut',
    transitionIn: 'cut',
    transitionOut: 'cut',
    transitionDuration: 0.25,
    motionRangeStart: 0,
    motionRangeEnd: 1,
  }))
  const lines = voiceLines.map((line, index) => ({
    id: index + 1,
    episodeId: 1,
    sceneId: index === 0 ? 1 : 2,
    scene: index === 0 ? '废弃海岛灯塔外部石阶' : '灯塔底层机房',
    speaker: line.speaker,
    text: line.text,
    emotion: index === 2 ? '低沉警告' : index === 1 ? '震惊低语' : '克制旁白',
    duration: `${state.steps.voices.assets[index].asset.duration.toFixed(1)}s`,
    status: '已配音',
    variant: index === 2 ? 2 : 1,
    sourceShotId: index + 1,
    audio: state.steps.voices.assets[index].mediaUrl,
    audioStatus: '已完成',
    audioSource: 'bailian-managed',
    audioFileName: `${line.id}.wav`,
    audioError: '',
    audioAttempt: 1,
  }))
  return {
    format: 'manju-project',
    version: 2,
    savedAt: new Date().toISOString(),
    project: {
      localProjectId: projectLocalId,
      name: '灯塔回响',
      genre: '悬疑科幻',
      ratio: '9:16',
      duration: '15秒',
      episodeCount: 1,
      synopsis: script.logline,
    },
    content: {
      episodes: [{ id: 1, title: '灯塔回响', scenes: 2, variant: 1, statuses: ['剧本', '角色', '分镜', '配音', '视频'], next: '已完成' }],
      scenes: script.scenes.map((scene, index) => ({
        id: index + 1,
        sourceId: scene.id,
        episodeId: 1,
        title: scene.name,
        location: scene.name,
        time: scene.time,
        weather: scene.weather,
        layout: scene.layout,
        lighting: scene.lighting,
        palette: scene.palette,
        mainCharacterIds: [1],
        status: '已完成',
        action: index === 0 ? '林晚冒雨登塔' : '林晚发现录音机并听见警告',
        narration: index === 0 ? voiceLines[0].text : '',
        ...projectImageFields(sceneAsset),
      })),
      characters: [{
        id: 1,
        sourceId: 'C01',
        name: '林晚',
        role: script.characters[0].identity,
        variant: 1,
        tone: script.characters[0].voice,
        relation: '主角',
        appearance: script.characters[0].appearance,
        costume: script.characters[0].costume,
        forbiddenDrift: script.characters[0].forbiddenDrift,
        voiceId: 'Cherry',
        ...projectImageFields(characterAsset),
      }],
      props: script.props.map((prop, index) => ({
        id: index + 1,
        sourceId: prop.id,
        name: prop.name,
        description: prop.appearance,
        appearance: prop.appearance,
        function: prop.storyFunction,
        forbiddenDrift: prop.forbiddenDrift,
        ...projectImageFields(propAsset),
      })),
      shots,
      videoAssets: state.steps.videos.assets.map((entry) => entry.managedAsset),
      lines,
      episodeProductions: [{
        episodeId: 1,
        audioTracks: [],
        subtitleCues,
        subtitleCuesInitialized: true,
        subtitleStyle: { fontSize: 58, color: '#FFFFFF', outlineColor: '#0B1D2A', backgroundOpacity: 24, position: 'bottom', bold: true },
      }],
    },
  }
}

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  }))
  return nested.flat()
}

const saveProjectAndIndex = async (state, finalVideoPath) => {
  const projectPath = path.join(outputRoot, '灯塔回响.manju')
  const snapshot = await createProjectSnapshot(state)
  await writeJson(projectPath, snapshot)
  const projectStorageRoot = path.join(appDataRoot, 'projects')
  const autosavePath = path.join(projectStorageRoot, 'autosave.manju')
  await mkdir(projectStorageRoot, { recursive: true })
  if (await exists(autosavePath)) {
    try {
      const current = JSON.parse(await readFile(autosavePath, 'utf8'))
      if (current?.project?.localProjectId !== projectLocalId) {
        await copyFile(autosavePath, path.join(outputRoot, `previous-autosave-${Date.now()}.manju`))
      }
    } catch {
      await copyFile(autosavePath, path.join(outputRoot, `previous-autosave-${Date.now()}.manju`))
    }
  }
  await copyFile(projectPath, autosavePath)
  const recentsPath = path.join(projectStorageRoot, 'recent-projects.json')
  let recents = []
  try { recents = JSON.parse(await readFile(recentsPath, 'utf8')) } catch { recents = [] }
  const resolvedProjectPath = path.resolve(projectPath)
  recents = [
    { path: resolvedProjectPath, name: '灯塔回响', episodeCount: 1, updatedAt: new Date().toISOString() },
    ...(Array.isArray(recents) ? recents.filter((item) => path.resolve(item.path || '') !== resolvedProjectPath) : []),
  ].slice(0, 8)
  await writeJson(recentsPath, recents)
  state.steps.project = {
    ok: true,
    completedAt: new Date().toISOString(),
    projectPath: path.relative(workspaceRoot, projectPath).split(path.sep).join('/'),
    autosavePath,
    recentsPath,
  }
  await saveState(state)
  const artifactIndexPath = path.join(outputRoot, 'artifact-index.json')
  const files = (await listFiles(outputRoot)).filter((filePath) => filePath !== artifactIndexPath)
  const artifacts = await Promise.all(files.map(async (filePath) => {
    const buffer = await readFile(filePath)
    return {
      path: path.relative(outputRoot, filePath).split(path.sep).join('/'),
      bytes: buffer.length,
      sha256: sha256(buffer),
    }
  }))
  await writeJson(artifactIndexPath, {
    version: 1,
    project: '灯塔回响',
    generatedAt: new Date().toISOString(),
    freeTierGuard: 'User-confirmed console setting: free quota exhausted means stop',
    models: ['qwen3.7-plus', 'wan2.7-image-pro', 'qwen3-tts-flash', 'wan2.7-i2v-2026-04-25'],
    finalVideo: path.relative(outputRoot, finalVideoPath).split(path.sep).join('/'),
    projectFile: path.relative(outputRoot, projectPath).split(path.sep).join('/'),
    artifacts,
  })
  return { projectPath, artifactIndexPath }
}

const generateCanonicalAssets = async ({ state, apiHost }) => {
  await mkdir(canonicalRoot, { recursive: true })
  state.steps.canonical ||= { ok: false, assets: [] }
  for (let index = 0; index < canonicalRequests.length; index += 1) {
    const request = canonicalRequests[index]
    const existing = state.steps.canonical.assets[index]
    const targetPath = path.join(canonicalRoot, canonicalFileNames[index])
    if (existing?.ok && await exists(targetPath)) continue
    const result = await generateBailianImage({
      request: { ...request, confirmed: true },
      workspaceRoot,
      keyCandidates: [{ filePath: keyFile, label: 'project key.txt' }],
      apiHost,
      allowPaidGeneration: true,
    })
    if (!result.ok) throw new Error(`${request.name}生成失败：${result.error || '未知错误'}`)
    const sourcePath = path.join(workspaceRoot, result.image.localPath)
    await copyFile(sourcePath, targetPath)
    state.steps.canonical.assets[index] = {
      ok: true,
      completedAt: new Date().toISOString(),
      entityId: request.entityId,
      name: request.name,
      model: result.model,
      requestId: result.requestId,
      taskId: result.taskId,
      usage: result.usage,
      image: result.image,
      savedCopy: path.relative(workspaceRoot, targetPath).split(path.sep).join('/'),
    }
    await writeJson(path.join(canonicalRoot, `${path.parse(canonicalFileNames[index]).name}.json`), result)
    await saveState(state)
  }
  state.steps.canonical.ok = state.steps.canonical.assets.length === canonicalRequests.length
    && state.steps.canonical.assets.every((asset) => asset?.ok)
  state.steps.canonical.completedAt = new Date().toISOString()
  await saveState(state)
}

const main = async () => {
  await mkdir(outputRoot, { recursive: true })
  const workspaceId = await readTrimmed(workspaceFile)
  const apiHost = `https://${workspaceId}.cn-beijing.maas.aliyuncs.com`
  const dryRun = {
    generatedAt: new Date().toISOString(),
    outputRoot,
    script: getBailianScriptDryRun({ request: scriptRequest, apiHost }),
    canonicalAssets: canonicalRequests.map((request) => getBailianImageDryRun({ request, apiHost })),
    frames: frameRequests.map((frame) => getBailianImageDryRun({
      apiHost,
      request: {
        purpose: 'storyboard',
        size: '1536*1024',
        entityId: frame.entityId,
        name: frame.name,
        prompt: frame.prompt,
        references: ['C01', 'P01-P02', 'SC01'].map((id) => ({ id, dataUrl: 'data:image/jpeg;base64,/9j/2Q==' })),
      },
    })),
    plannedArtifacts: [
      '01-script-result.json', '02-production-script.json', 'run-state.json',
      'canonical/character-c01.jpg', 'canonical/props-p01-p02.jpg', 'canonical/scene-sc01.jpg',
      'frames/f01.jpg', 'frames/f02.jpg', 'frames/f03.jpg', 'frames/f04.jpg',
      'audio/line-01.wav', 'audio/line-02.wav', 'audio/line-03.wav',
      'video/shot-01.mp4', 'video/shot-02.mp4', 'video/shot-03.mp4',
      '灯塔回响-15秒面试演示.mp4', '灯塔回响.manju', 'artifact-index.json',
    ],
  }
  await writeJson(path.join(outputRoot, '00-dry-run.json'), dryRun)
  if (!execute) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      outputRoot,
      plannedRequestCount: { script: 1, canonicalImages: 3, storyboardFrames: 4, voices: 3, videos: 3 },
    }, null, 2))
    return
  }
  if (process.env.BAILIAN_FREE_TIER_CONFIRMED !== '1') {
    throw new Error('真实生成已锁定：仅在确认“免费额度用完即停”后设置 BAILIAN_FREE_TIER_CONFIRMED=1')
  }
  if (!(await exists(keyFile))) throw new Error('缺少 key.txt')
  const state = await readState()
  if (!state.steps.script?.ok || !(await exists(curatedScriptPath)) || state.steps.script.curationVersion !== 2) {
    let result
    if (state.steps.script?.ok && await exists(scriptResultPath)) {
      result = JSON.parse(await readFile(scriptResultPath, 'utf8'))
    } else {
      result = await generateBailianScript({
        request: scriptRequest,
        workspaceRoot,
        keyCandidates: [{ filePath: keyFile, label: 'project key.txt' }],
        apiHost,
        allowPaidGeneration: true,
      })
      if (!result.ok) throw new Error(result.error || '剧本生成失败')
      await writeJson(scriptResultPath, result)
    }
    const curated = curateThreeShotScript(result.script)
    await writeJson(curatedScriptPath, curated)
    state.steps.script = {
      ok: true,
      curationVersion: 2,
      completedAt: new Date().toISOString(),
      model: result.model,
      requestId: result.requestId,
      usage: result.usage,
      artifact: result.artifact,
      output: path.relative(workspaceRoot, curatedScriptPath).split(path.sep).join('/'),
      sha256: sha256(JSON.stringify(curated)),
    }
    await saveState(state)
  }
  await generateCanonicalAssets({ state, apiHost })
  await generateFrames({ state, apiHost })
  await generateVoices({ state, apiHost })
  await generateVideos({ state, apiHost })
  await prepareManagedVideos(state)
  const finalVideoPath = await buildFinalVideo(state)
  const saved = await saveProjectAndIndex(state, finalVideoPath)
  console.log(JSON.stringify({ ok: true, phase: 'complete', statePath, finalVideoPath, ...saved }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
