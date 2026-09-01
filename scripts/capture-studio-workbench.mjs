import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `studio-capture-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'studio-rich.png')

const snapshot = {
  format: 'manju-project',
  version: 2,
  savedAt: '2026-08-05T00:00:00.000Z',
  project: {
    localProjectId: 'local-studio-visual-test',
    name: '灯塔回响',
    genre: '悬疑',
    ratio: '9:16',
    duration: '60秒',
    episodeCount: 1,
    synopsis: '守塔人林晚发现码头油量异常，沿着旧式录音机留下的线索进入灯塔。',
  },
  content: {
    episodes: [{ id: 1, title: '潮汐密语', scenes: 2, statuses: ['剧本', '分镜'] }],
    scenes: [
      { id: 1, episodeId: 1, title: '暴雨码头', location: '旧码头', time: '深夜', weather: '暴雨', mainCharacterIds: [1, 2], status: '已完成' },
      { id: 2, episodeId: 1, title: '灯塔底层', location: '废弃灯塔', time: '深夜', weather: '潮湿', mainCharacterIds: [1], status: '当前编辑' },
    ],
    characters: [
      { id: 1, name: '林晚', role: '女主', description: '短发守塔工程师，深蓝防水工装，神情冷静。' },
      { id: 2, name: '周屿', role: '协作者', description: '码头维修员，旧雨衣，手提煤油灯。' },
      { id: 3, name: '林海生', role: '父亲', description: '失踪的老守塔人，只在录音与旧照片中出现。' },
    ],
    props: [
      { id: 1, sourceId: 'prop-recorder', name: '旧式磁带录音机', description: '锈蚀金属外壳，标签写着守一，10月17日。', appearance: '方形便携录音机，单卡槽与磨损按键。', function: '保存失踪守塔人的最后留言。', forbiddenDrift: '标签、卡槽数量和锈蚀位置保持一致。' },
      { id: 2, sourceId: 'prop-flashlight', name: '强光手电', description: '银灰金属筒身，前端宽大灯头。', function: '照亮灯塔内部并制造硬光构图。' },
      { id: 3, sourceId: 'prop-generator', name: '潮汐发电装置', description: '固定在灯塔底部的老式发电设备。', function: '解释异常油量与灯塔供电故障。' },
      { id: 4, sourceId: 'prop-radio', name: '应急无线电', description: '米灰色手持无线电，红色紧急按钮。', function: '连接码头控制室。' },
    ],
    shots: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      episodeId: 1,
      sceneId: index < 3 ? 1 : 2,
      action: [
        '林晚在码头发现小艇油量异常，抬头望向灯塔。',
        '林晚用手电检查潮湿的系缆柱。',
        '周屿递来旧式磁带录音机。',
        '林晚进入灯塔底层，发现发电装置停转。',
        '无线电传来断续的求救信号。',
        '录音机播放出父亲留下的潮汐坐标。',
      ][index],
      visualPrompt: '写实电影光影，暴雨海岛，冷蓝色调，人物与道具连续。',
      duration: `${index === 1 ? 7 : 6}s`,
      size: index % 2 ? '中近景' : '全景',
      characterIds: index === 2 ? [1, 2] : [1],
      propIds: index < 2 ? [2] : [Math.min(index, 4)],
      continuityLocked: true,
    })),
    lines: [
      { id: 1, episodeId: 1, sceneId: 1, scene: '暴雨码头', speaker: '林晚', text: '油量不对，有人来过。' },
      { id: 2, episodeId: 1, sceneId: 1, scene: '暴雨码头', speaker: '周屿', text: '这台录音机一直在等你。' },
      { id: 3, episodeId: 1, sceneId: 2, scene: '灯塔底层', speaker: '林海生', text: '潮水退到零点，门才会打开。' },
    ],
    videoAssets: [],
    episodeProductions: [],
  },
}

await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      backgroundColor: '#080c11',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    const indexPath = path.join(process.cwd(), 'dist', 'index.html')
    await window.loadFile(indexPath)
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})`)
    await window.loadFile(indexPath)
    await new Promise((resolve) => setTimeout(resolve, 700))
    const result = await window.webContents.executeJavaScript(`({
      brand: document.querySelector('.xm-brand-block strong')?.textContent.trim(),
      stageCount: document.querySelectorAll('.xm-stage-item').length,
      activeAsset: document.querySelector('.xm-asset-tabs .is-active')?.textContent.replace(/\\s+/g, ''),
      assetCardCount: document.querySelectorAll('.xm-asset-grid > button').length,
      inspectorId: document.querySelector('.xm-asset-inspector header small')?.textContent.trim(),
    })`)
    assert.equal(result.brand, '星幕工坊')
    assert.equal(result.stageCount, 5)
    assert.match(result.activeAsset, /道具卡4/)
    assert.equal(result.assetCardCount, 4)
    assert.equal(result.inspectorId, 'ID: prop-recorder')
    const image = await window.webContents.capturePage()
    await writeFile(screenshotPath, image.toPNG())
    console.log(JSON.stringify({ passed: true, screenshotPath, ...result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
