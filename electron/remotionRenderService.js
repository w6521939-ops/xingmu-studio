import { spawn } from 'node:child_process'
import path from 'node:path'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const remotionProjectRoot = path.resolve(process.cwd(), 'remotion-composer')

const normalizeTimelineForRemotion = (items = [], audioTracks = [], subtitleCues = [], subtitleStyle = {}) => ({
  items: items.map((item) => ({
    id: item.index != null ? String(item.index) : '',
    duration: Number(item.duration) || 3,
    image: typeof item.image === 'string'
      ? item.image
      : item.image?.dataUrl || '',
    videoPath: item.videoPath || '',
    transition: item.transition || 'fade',
    transitionDuration: item.transitionDuration || 0.25,
    transitionIn: item.transitionIn || item.transition || 'fade',
    transitionOut: item.transitionOut || item.transition || 'fade',
    shot: {
      motionEffect: item.motionEffect || 'none',
      motionStrength: item.motionStrength || 12,
      motionRangeStart: item.motionRangeStart || 0,
      motionRangeEnd: item.motionRangeEnd || 1,
    },
    subtitle: item.subtitle || '',
    audio: item.audio?.dataUrl || '',
  })),
  audioTracks: audioTracks.map((track) => ({
    start: Number(track.start) || 0,
    duration: Number(track.duration) || 1,
    volume: Number(track.volume) || 0,
    fadeIn: Number(track.fadeIn) || 0,
    fadeOut: Number(track.fadeOut) || 0,
    audio: typeof track.audio === 'string'
      ? track.audio
      : track.audio?.dataUrl || '',
  })),
  subtitleCues: (Array.isArray(subtitleCues) ? subtitleCues : []).map((cue) => ({
    start: Number(cue.start) || 0,
    end: Number(cue.end) || 0,
    text: String(cue.text || ''),
  })),
  subtitleStyle: {
    fontSize: Number(subtitleStyle.fontSize) || 52,
    color: subtitleStyle.color || '#FFFFFF',
    outlineColor: subtitleStyle.outlineColor || '#102B3A',
    backgroundOpacity: Number(subtitleStyle.backgroundOpacity) || 0,
    position: subtitleStyle.position || 'bottom',
    bold: subtitleStyle.bold !== false,
  },
})

export async function exportWithRemotion({
  outputPath,
  items,
  width = 1080,
  height = 1920,
  transition = 'fade',
  subtitlesEnabled = true,
  subtitleCues = [],
  subtitleStyle = {},
  audioTracks = [],
  onProgress = () => undefined,
  signal,
}) {
  if (!outputPath) throw new Error('缺少导出路径')

  const normalized = normalizeTimelineForRemotion(items, audioTracks, subtitlesEnabled ? subtitleCues : [], subtitleStyle)
  const totalDuration = normalized.items.reduce((sum, item) => sum + item.duration, 0)
  const totalFrames = Math.max(1, Math.round(totalDuration * 30))
  const fps = 30

  onProgress({ phase: 'preparing', percent: 5, message: '正在准备 Remotion 渲染' })

  const propsPath = await mkdtemp(path.join(tmpdir(), 'manju-remotion-'))
  const propsFile = path.join(propsPath, 'props.json')
  await writeFile(propsFile, JSON.stringify(normalized), 'utf8')

  onProgress({ phase: 'bundling', percent: 15, message: '正在打包 Remotion 项目' })

  try {
    await new Promise((resolve, reject) => {
      const args = [
        'run',
        'remotion',
        'render',
        'manju-drama',
        outputPath,
        `--props=${propsFile}`,
        `--width=${width}`,
        `--height=${height}`,
        `--frames=0-${totalFrames}`,
        `--fps=${fps}`,
        '--codec=h264',
        '--crf=20',
        '--pixel-format=yuv420p',
        '--concurrency=2',
        '--log=error',
      ]

      const child = spawn('npx', args, {
        cwd: remotionProjectRoot,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stderr = ''
      let settled = false
      const cancel = () => {
        if (!settled) {
          settled = true
          child.kill('SIGKILL')
        }
      }
      signal?.addEventListener('abort', cancel, { once: true })

      child.stdout.on('data', (chunk) => {
        const text = String(chunk)
        const match = /(\d+)%/.exec(text)
        if (match) {
          const percent = 15 + Math.round(Number(match[1]) * 0.75)
          onProgress({ phase: 'rendering', percent, message: `Remotion 渲染 ${match[1]}%` })
        }
      })
      child.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-8000)
      })
      child.on('error', (error) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', cancel)
        reject(error)
      })
      child.on('close', (code) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', cancel)
        if (code === 0) resolve()
        else reject(new Error(stderr.trim().split(/\r?\n/u).slice(-8).join('\n') || `Remotion 渲染退出码 ${code}`))
      })
    })

    onProgress({ phase: 'done', percent: 100, message: 'Remotion 渲染完成' })
    return { ok: true, outputPath, engine: 'remotion' }
  } finally {
    await rm(propsPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

export const isRemotionAvailable = async () => {
  try {
    const packageJsonPath = path.join(remotionProjectRoot, 'package.json')
    await readFile(packageJsonPath, 'utf8')
    return true
  } catch {
    return false
  }
}
