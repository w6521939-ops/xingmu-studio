export const managedMediaStatusDetails = Object.freeze({
  'in-use': { label: '正在使用', tone: 'safe', description: '当前项目或自动保存仍在引用' },
  'recovery-protected': { label: '恢复点保护', tone: 'protected', description: '时间线恢复点仍在引用' },
  eligible: { label: '可安全清理', tone: 'eligible', description: '所有已知快照均未引用' },
  pending: { label: '暂不可处理', tone: 'pending', description: '存在写入任务或暂存状态' },
  unknown: { label: '未知文件', tone: 'unknown', description: '归属或目录结构无法确认' },
})

export const portableCompatibilityDetails = Object.freeze({
  current: {
    tone: 'current',
    icon: 'shield',
    eyebrow: 'CURRENT FORMAT',
    title: '当前便携格式，可直接导入',
    description: '已识别 Manifest V2，项目与媒体已完成完整性校验。',
    badge: '当前格式 V2',
  },
  migratable: {
    tone: 'migratable',
    icon: 'refresh',
    eyebrow: 'SAFE MIGRATION',
    title: '检测到旧版便携项目',
    description: '可在本机安全迁移 V1 → V2，然后作为新副本导入。',
    badge: '可安全迁移',
  },
  future: {
    tone: 'future',
    icon: 'clock',
    eyebrow: 'READ ONLY GUARD',
    title: '此便携项目由更新版本创建',
    description: '当前版本只能读取基础版本信息，不能安全解析项目正文或媒体。',
    badge: '只读阻断',
  },
  corrupt: {
    tone: 'corrupt',
    icon: 'warning',
    eyebrow: 'MANIFEST BLOCKED',
    title: '便携项目清单无法使用',
    description: '未执行项目读取或本机写入，请检查便携项目后重试。',
    badge: '已阻止导入',
  },
})

export const portableMigrationDetailGroups = Object.freeze([
  Object.freeze({
    title: '新增字段',
    items: Object.freeze(['V2 最低应用版本', '必需与可选能力清单', '项目与媒体结构版本']),
  }),
  Object.freeze({
    title: '保持不变',
    items: Object.freeze(['项目正文与剧情内容', '镜头视频原始字节', 'SHA-256 完整性信息']),
  }),
  Object.freeze({
    title: '不会执行',
    items: Object.freeze(['不修改来源便携包', '不覆盖当前或现有项目', '不联网、不上传、不执行包内脚本']),
  }),
])

export const validatePortableImportName = (value) => {
  const name = String(value || '').trim()
  if (!name) return { ok: false, error: '导入项目名称不能为空。' }
  if (Array.from(name).some((character) => {
    const code = character.codePointAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
  })) return { ok: false, error: '导入项目名称包含不可用的控制字符。' }
  if (Array.from(name).length > 80) return { ok: false, error: '导入项目名称最多 80 个字符。' }
  return { ok: true, name }
}

export const createInitialPortabilityState = (requestedAction = '') => ({
  tab: requestedAction === 'cleanup' ? 'cleanup' : 'portability',
  mode: requestedAction === 'import' ? 'import' : 'export',
  stage: 'overview',
  busy: false,
  error: '',
  progress: null,
  exportToken: '',
  exportSummary: null,
  exportLocation: null,
  importToken: '',
  importSummary: null,
  importCompatibility: null,
  importName: '',
  migrationDetailsOpen: false,
  result: null,
  cleanupToken: '',
  cleanupSummary: null,
  cleanupRecords: [],
  cleanupSelection: [],
  cleanupConfirm: false,
})

export const formatPortabilityBytes = (value) => {
  const bytes = Math.max(0, Number(value) || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes >= 10 * 1024 ** 2 ? 0 : 1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
