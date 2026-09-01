import assert from 'node:assert/strict'
import {
  buildAssetLibraryIndex,
  filterAssetLibraryIndex,
  getDataUrlByteSize,
  isAssetFileCompatible,
  removeProjectAsset,
  replaceProjectAsset,
  summarizeAssetLibrary,
} from '../src/services/assetLibraryService.js'

const imageData = 'data:image/png;base64,aGVsbG8='
const audioData = 'data:audio/wav;base64,d29ybGQ='
const collections = {
  episodes: [{ id: 1, title: '雨夜' }],
  scenes: [{ id: 2, episodeId: 1, title: '旧车站' }],
  characters: [{ id: 3, name: '林夏', role: '主角', image: imageData, imageFileName: 'lin-xia.png', imageSource: 'local' }],
  shots: [{ id: 4, episodeId: 1, sceneId: 2, action: '林夏回头', image: imageData, imageFileName: 'shot-04.png', imageSource: 'local' }],
  lines: [{ id: 5, episodeId: 1, sceneId: 2, speaker: '林夏', text: '你终于来了。', emotion: '克制', duration: '1.8s', audio: audioData, audioFileName: 'line-05.wav', audioSource: 'local' }],
  audioTracks: [
    { id: 6, kind: 'bgm', name: '雨夜主题', fileName: 'rain.wav', audio: audioData, start: 0, duration: 8, waveform: [0.2, 0.8] },
    { id: 7, kind: 'sfx', name: '雷声', fileName: 'thunder.wav', audio: '', start: 3, duration: 1, waveform: [] },
  ],
}

const assets = buildAssetLibraryIndex(collections)
const summary = summarizeAssetLibrary(assets)

assert.equal(assets.length, 5)
assert.equal(summary.total, 5)
assert.equal(summary.byKind['character-image'], 1)
assert.equal(summary.byKind['shot-image'], 1)
assert.equal(summary.byKind['voice-audio'], 1)
assert.equal(summary.byKind.bgm, 1)
assert.equal(summary.byKind.sfx, 1)
assert.equal(summary.byHealth.ready, 4)
assert.equal(summary.byHealth.missing, 1)
assert.equal(summary.totalBytes, 20)
assert.equal(getDataUrlByteSize(imageData), 5)
assert.equal(filterAssetLibraryIndex(assets, { query: '旧车站' }).length, 2)
assert.equal(filterAssetLibraryIndex(assets, { kind: 'voice-audio' })[0].fileName, 'line-05.wav')
assert.equal(filterAssetLibraryIndex(assets, { health: 'missing' })[0].name, '雷声')
assert.equal(isAssetFileCompatible('shot-image', { name: 'frame.PNG', type: '' }), true)
assert.equal(isAssetFileCompatible('voice-audio', { name: 'voice.txt', type: 'text/plain' }), false)

const characterAsset = assets.find((asset) => asset.kind === 'character-image')
const replaced = replaceProjectAsset({
  asset: characterAsset,
  dataUrl: 'data:image/webp;base64,bmV3',
  fileName: 'lin-xia-new.webp',
  ...collections,
})
assert.equal(replaced.ok, true)
assert.equal(replaced.characters[0].imageFileName, 'lin-xia-new.webp')
assert.equal(collections.characters[0].imageFileName, 'lin-xia.png')

const voiceAsset = assets.find((asset) => asset.kind === 'voice-audio')
const removedVoice = removeProjectAsset({ asset: voiceAsset, ...collections })
assert.equal(removedVoice.ok, true)
assert.equal(removedVoice.lines[0].audio, '')
assert.equal(removedVoice.lines[0].status, '未配音')

const sfxAsset = assets.find((asset) => asset.kind === 'sfx')
const removedTrack = removeProjectAsset({ asset: sfxAsset, ...collections })
assert.equal(removedTrack.ok, true)
assert.deepEqual(removedTrack.audioTracks.map((track) => track.id), [6])

console.log('ASSET_LIBRARY_SERVICE_PASS=22')
