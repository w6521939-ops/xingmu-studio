import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parseManagedVoiceAssetUrl, resolveManagedVoiceAssetId } from '../src/services/managedVoiceAssetService.js'
import { createOneClickProductionPlan } from '../src/services/oneClickProductionPlanService.js'

const demoDirectory = path.join(process.cwd(), 'outputs', 'interview-demo', 'lighthouse-echo')
const projectFileName = (await readdir(demoDirectory)).find((name) => name.endsWith('.manju'))
assert.ok(projectFileName)
const snapshot = JSON.parse(await readFile(path.join(demoDirectory, projectFileName), 'utf8'))
const managedLines = snapshot.content.lines.filter((line) => String(line.audio || '').startsWith('manju-media://voice/'))
assert.equal(managedLines.length, 3)
assert.equal(managedLines.every((line) => !line.audioAssetId), true)
assert.equal(resolveManagedVoiceAssetId(managedLines[0]).startsWith('voice-line-'), true)
assert.equal(parseManagedVoiceAssetUrl('file:///audio.wav'), null)

const plan = createOneClickProductionPlan(snapshot)
const exportTask = plan.tasks.find((task) => task.kind === 'episode-export')
assert.ok(exportTask)
assert.equal(exportTask.request.items.length, 3)
assert.equal(exportTask.request.items.every((item) => item.audioAssetId.startsWith('voice-line-')), true)
assert.equal(exportTask.request.items.every((item) => item.lineId), true)

console.log(JSON.stringify({
  passed: true,
  managedVoiceLines: managedLines.length,
  exportItemsWithAudio: exportTask.request.items.filter((item) => item.audioAssetId).length,
}))
