import {
  createSubtitleCuesFromTimeline,
  normalizeSubtitleStyle,
  parseSrt,
  resolveSubtitleCueAtTime,
  serializeSrt,
} from '../src/services/subtitleService.js'

const source = `\uFEFF1
00:00:00,250 --> 00:00:01,500
第一条字幕

2
00:00:01.600 --> 00:00:03.200
第二条字幕
第二行

3
00:00:09,500 --> 00:00:12,000
超出时间线会被裁剪`

const parsed = parseSrt(source, 10)
const serialized = serializeSrt(parsed)
const roundTrip = parseSrt(serialized, 10)
const timelineCues = createSubtitleCuesFromTimeline([
  { id: 'timeline-1', start: 0, end: 2, subtitle: '镜头字幕', shot: { id: 1 } },
  { id: 'timeline-2', start: 2, end: 4, subtitle: '', shot: { id: 2 } },
])
const style = normalizeSubtitleStyle({
  fontSize: 200,
  color: '#35a7d8',
  outlineColor: 'invalid',
  backgroundOpacity: -20,
  position: 'top',
  bold: false,
})
let invalidRejected = false
try {
  parseSrt('not an srt', 10)
} catch {
  invalidRejected = true
}

const passed = parsed.length === 3
  && parsed[0].start === 0.25
  && parsed[1].text === '第二条字幕\n第二行'
  && parsed[2].end === 10
  && serialized.includes('00:00:01,600 --> 00:00:03,200')
  && roundTrip.length === 3
  && resolveSubtitleCueAtTime(parsed, 2)?.id === parsed[1].id
  && timelineCues.length === 1
  && timelineCues[0].sourceItemId === 'timeline-1'
  && style.fontSize === 96
  && style.color === '#35A7D8'
  && style.outlineColor === '#102B3A'
  && style.backgroundOpacity === 0
  && style.position === 'top'
  && style.bold === false
  && invalidRejected

console.log(JSON.stringify({ passed, parsed, serialized, timelineCues, style, invalidRejected }))
if (!passed) process.exitCode = 1
