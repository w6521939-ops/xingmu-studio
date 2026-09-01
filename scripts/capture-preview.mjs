import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const pages = ['home', 'overview', 'script', 'character', 'storyboard', 'voice', 'final', 'settings']
const outputDirectory = path.join(process.cwd(), 'outputs', 'runtime')

app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    await mkdir(outputDirectory, { recursive: true })
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

    for (const page of pages) {
      await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), {
        query: page === 'home' ? {} : { page },
      })
      await new Promise((resolve) => setTimeout(resolve, 350))
      const image = await window.webContents.capturePage()
      await writeFile(path.join(outputDirectory, `${page}.png`), image.toPNG())
    }

    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
