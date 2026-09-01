import assert from 'node:assert/strict'
import {
  createProjectSnapshot,
  getProjectSnapshotByteSize,
  readProjectSnapshot,
} from '../src/services/projectModel.js'
import { createGeneratedImageProjectFields } from '../src/services/generatedImageAssetService.js'

const generated = createGeneratedImageProjectFields({
  mediaUrl: 'manju-media://generated-image/image-mrx8y0xc-2f773d68',
  assetId: 'image-mrx8y0xc-2f773d68',
  fileName: 'storyboard-test.png',
  bytes: 2_280_310,
  sha256: 'a'.repeat(64),
})
assert.equal(generated.ok, true)

const episodes = [{ id: 1, title: '第一集' }]
const scenes = [{ id: 1, episodeId: 1, title: '月下相逢', action: '', narration: '', mainCharacterIds: [] }]
const shotWithoutImage = {
  id: 5,
  episodeId: 1,
  sceneId: 1,
  action: '林听雨触碰古钟',
  dialogue: '',
  duration: '5.4s',
  size: '全景',
  motion: '缓慢推进',
  characterIds: [],
}
const shots = [{
  ...shotWithoutImage,
  ...generated.fields,
}]
const existingProjectContent = 'x'.repeat(8_300_000)
const baseSnapshot = createProjectSnapshot({
  projectMeta: {
    localProjectId: 'local-generated-image-test',
    name: '文件化图片测试',
    genre: '古风',
    ratio: '9:16',
    duration: '30秒',
  },
  storySeed: existingProjectContent,
  episodes,
  scenes,
  characters: [],
  shots: [shotWithoutImage],
  lines: [],
  videoAssets: [],
  episodeProductions: [],
  legacyProduction: null,
})
const snapshot = createProjectSnapshot({
  projectMeta: {
    localProjectId: 'local-generated-image-test',
    name: '文件化图片测试',
    genre: '古风',
    ratio: '9:16',
    duration: '30秒',
  },
  storySeed: existingProjectContent,
  episodes,
  scenes,
  characters: [],
  shots,
  lines: [],
  videoAssets: [],
  episodeProductions: [],
  legacyProduction: null,
})
const serialized = JSON.stringify(snapshot)
assert.match(snapshot.content.shots[0].image, /^manju-media:\/\/generated-image\//u)
assert.equal(serialized.includes('data:image/'), false)
assert.equal(serialized.includes('C:\\'), false)
const baseProjectBytes = getProjectSnapshotByteSize(baseSnapshot)
const projectBytes = getProjectSnapshotByteSize(snapshot)
assert.equal(projectBytes - baseProjectBytes < 1024, true)
assert.equal(projectBytes < 10 * 1024 * 1024, true)

const fallback = {
  projectMeta: snapshot.project,
  storySeed: '',
  episodes,
  scenes,
  characters: [],
  shots: [],
  lines: [],
  videoAssets: [],
  audioTracks: [],
  subtitleCues: [],
  subtitleCuesInitialized: false,
  subtitleStyle: {},
}
const loaded = readProjectSnapshot(snapshot, fallback)
assert.equal(loaded.shots[0].image, generated.fields.image)
assert.equal(loaded.shots[0].imageSource, 'bailian-managed')
assert.equal(loaded.shots[0].imageBytes, 2_280_310)

console.log(JSON.stringify({
  passed: true,
  baseProjectBytes,
  projectBytes,
  adoptionDeltaBytes: projectBytes - baseProjectBytes,
  embeddedBase64: false,
  imageBytes: generated.fields.imageBytes,
}))
