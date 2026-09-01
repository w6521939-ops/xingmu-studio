import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = path.join(process.cwd(), 'build')
const outputPath = path.join(outputDirectory, 'icon.png')
const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body { width: 512px; height: 512px; margin: 0; overflow: hidden; background: transparent; }
        svg { display: block; width: 512px; height: 512px; }
      </style>
    </head>
    <body>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="sky" x1="70" y1="35" x2="444" y2="477" gradientUnits="userSpaceOnUse">
            <stop stop-color="#A8E7FF" />
            <stop offset="0.5" stop-color="#43B9F8" />
            <stop offset="1" stop-color="#1288D8" />
          </linearGradient>
          <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(138 110) rotate(48) scale(284)">
            <stop stop-color="white" stop-opacity=".74" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </radialGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#0B6EA8" flood-opacity=".28" />
          </filter>
        </defs>
        <rect x="42" y="36" width="428" height="428" rx="118" fill="url(#sky)" filter="url(#shadow)" />
        <rect x="43" y="37" width="426" height="426" rx="117" fill="url(#shine)" />
        <path d="M348 108 420 180 348 252Z" fill="white" fill-opacity=".18" />
        <path d="M92 344c91-44 213-43 326 1v64H92Z" fill="#0D6DA8" fill-opacity=".16" />
        <text x="256" y="326" text-anchor="middle" fill="white" font-size="232" font-weight="800" font-family="Microsoft YaHei UI, Microsoft YaHei, sans-serif">漫</text>
        <rect x="55" y="49" width="402" height="402" rx="106" fill="none" stroke="white" stroke-opacity=".5" stroke-width="4" />
      </svg>
    </body>
  </html>
`

app.on('ready', async () => {
  try {
    await mkdir(outputDirectory, { recursive: true })
    const window = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
    const image = await window.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
    await writeFile(outputPath, image.toPNG())
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
