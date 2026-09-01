import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  inspectPortableManifestCompatibility,
  portableProjectFormat,
  portableProjectVersion,
  portableRequiredFeatures,
  validatePortableManifestV2,
} from '../electron/portableManifestCompatibilityService.js'
import {
  migratePortableManifestToCurrent,
  migratePortableManifestV1ToV2,
} from '../electron/portableManifestMigrationRegistry.js'
import {
  importPortableProjectAsCopy,
  inspectPortableProjectFolder,
} from '../electron/projectPortabilityService.js'

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'manju-manifest-v2-test-'))
const projectText = JSON.stringify({
  format: 'manju-project',
  version: 1,
  savedAt: '2026-07-23T00:00:00.000Z',
  project: { localProjectId: 'local-v1-fixture', name: '旧版兼容测试项目' },
  content: { episodes: [], scenes: [], characters: [], shots: [], lines: [], audioTracks: [], videoAssets: [] },
}, null, 2)

const createV1Manifest = (overrides = {}) => ({
  format: portableProjectFormat,
  version: 1,
  createdAt: '2026-07-23T00:00:00.000Z',
  appVersion: '1.31.0',
  project: { name: '旧版兼容测试项目', sourceLocalProjectId: 'local-v1-fixture' },
  projectFile: { path: 'project.manju', bytes: Buffer.byteLength(projectText), sha256: sha256(projectText) },
  media: [],
  missingMedia: [],
  complete: true,
  ...overrides,
})

const writeBundle = async (bundleRoot, manifest, includeProject = true) => {
  await mkdir(bundleRoot, { recursive: true })
  await writeFile(path.join(bundleRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  if (includeProject) {
    await writeFile(path.join(bundleRoot, 'project.manju'), projectText, 'utf8')
    await writeFile(path.join(bundleRoot, 'README.txt'), '漫剧创作便携项目', 'utf8')
  }
}

try {
  const sourceV1 = createV1Manifest()
  const sourceBytes = JSON.stringify(sourceV1)
  const migratedV2 = migratePortableManifestV1ToV2(sourceV1)
  assert.equal(migratedV2.version, portableProjectVersion)
  assert.deepEqual(migratedV2.compatibility.requiredFeatures, [...portableRequiredFeatures])
  assert.equal(migratedV2.projectSchemaVersion, 1)
  assert.equal(migratedV2.mediaSchemaVersion, 1)
  assert.equal(JSON.stringify(sourceV1), sourceBytes, '纯函数迁移不能修改 V1 输入')
  validatePortableManifestV2(migratedV2)
  assert.deepEqual(migratePortableManifestToCurrent(migratedV2).manifest, migratedV2, 'V2 再迁移必须保持幂等')

  const unknownOptional = structuredClone(migratedV2)
  unknownOptional.compatibility.optionalFeatures = ['future-diagnostics']
  const optionalCompatibility = inspectPortableManifestCompatibility(unknownOptional)
  assert.equal(optionalCompatibility.status, 'current')
  assert.deepEqual(optionalCompatibility.unknownOptionalFeatures, ['future-diagnostics'])

  const unknownRequired = structuredClone(migratedV2)
  unknownRequired.compatibility.requiredFeatures.push('execute-bundle-script')
  const requiredCompatibility = inspectPortableManifestCompatibility(unknownRequired)
  assert.equal(requiredCompatibility.status, 'corrupt')
  assert.equal(requiredCompatibility.errorCode, 'MANIFEST_REQUIRED_FEATURE_UNSUPPORTED')

  for (const invalidVersion of [undefined, 0, -1, 1.5, '2']) {
    const invalid = createV1Manifest({ version: invalidVersion })
    assert.equal(inspectPortableManifestCompatibility(invalid).status, 'corrupt')
  }

  const performanceManifest = createV1Manifest({
    media: Array.from({ length: 100 }, (_, index) => ({
      kind: 'shot-video',
      assetId: `shot-video-performance-${String(index).padStart(3, '0')}`,
      fileName: `镜头-${index}.mp4`,
      path: `media/shot-videos/shot-video-performance-${String(index).padStart(3, '0')}/video.mp4`,
      bytes: 1024 + index,
      sha256: 'a'.repeat(64),
    })),
  })
  const timings = Array.from({ length: 30 }, () => {
    const startedAt = performance.now()
    migratePortableManifestV1ToV2(performanceManifest)
    return performance.now() - startedAt
  }).sort((a, b) => a - b)
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1]
  assert.ok(p95 < 50, `100 项媒体的 V1 → V2 迁移 P95 应低于 50 ms，实际 ${p95.toFixed(2)} ms`)

  const legacyRoot = path.join(tempRoot, 'legacy.manju-bundle')
  await writeBundle(legacyRoot, sourceV1)
  const legacyManifestBefore = await readFile(path.join(legacyRoot, 'manifest.json'))
  const legacyInspection = await inspectPortableProjectFolder({ bundleRoot: legacyRoot })
  assert.equal(legacyInspection.compatibility.status, 'migratable')
  assert.equal(legacyInspection.manifest.version, portableProjectVersion)
  const imported = await importPortableProjectAsCopy({
    inspection: legacyInspection,
    mediaRoot: path.join(tempRoot, 'imported-media'),
    displayName: '旧版迁移导入副本',
  })
  assert.equal(imported.migration.sourceVersion, 1)
  assert.equal(imported.migration.targetVersion, portableProjectVersion)
  assert.equal(imported.migration.sourceUntouched, true)
  assert.deepEqual(await readFile(path.join(legacyRoot, 'manifest.json')), legacyManifestBefore)

  const changedRoot = path.join(tempRoot, 'changed.manju-bundle')
  await writeBundle(changedRoot, createV1Manifest())
  const changedInspection = await inspectPortableProjectFolder({ bundleRoot: changedRoot })
  await writeFile(path.join(changedRoot, 'manifest.json'), `${JSON.stringify(createV1Manifest(), null, 2)}\n`, 'utf8')
  await assert.rejects(importPortableProjectAsCopy({
    inspection: changedInspection,
    mediaRoot: path.join(tempRoot, 'changed-import-media'),
    displayName: '来源变化测试',
  }), /验证后发生变化/u)
  await assert.rejects(stat(path.join(tempRoot, 'changed-import-media')), (error) => error?.code === 'ENOENT')

  const futureRoot = path.join(tempRoot, 'future.manju-bundle')
  await writeBundle(futureRoot, {
    format: portableProjectFormat,
    version: 3,
    appVersion: '1.40.0',
    project: { name: '未来版本只读测试' },
  }, false)
  await mkdir(path.join(futureRoot, 'project.manju'))
  await mkdir(path.join(futureRoot, 'media', 'unexpected-layout'), { recursive: true })
  const futureInspection = await inspectPortableProjectFolder({ bundleRoot: futureRoot })
  assert.equal(futureInspection.compatibility.status, 'future')
  assert.equal(futureInspection.compatibility.canImport, false)
  assert.equal(futureInspection.envelopeOnly, true)
  assert.equal('snapshot' in futureInspection, false, '未来版本不能读取项目正文')
  assert.equal('files' in futureInspection, false, '未来版本不能读取媒体清单')

  const corruptRoot = path.join(tempRoot, 'corrupt.manju-bundle')
  await writeBundle(corruptRoot, { format: portableProjectFormat, version: 0 }, false)
  const corruptInspection = await inspectPortableProjectFolder({ bundleRoot: corruptRoot })
  assert.equal(corruptInspection.compatibility.status, 'corrupt')
  assert.equal(corruptInspection.compatibility.canImport, false)
  assert.equal(corruptInspection.envelopeOnly, true)

  console.log(JSON.stringify({
    passed: true,
    portableProjectVersion,
    legacyMigration: `${imported.migration.sourceVersion}->${imported.migration.targetVersion}`,
    migrationP95Ms: Number(p95.toFixed(2)),
    futureEnvelopeOnly: futureInspection.envelopeOnly,
    sourceUntouched: true,
    paidCalls: 0,
  }))
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
