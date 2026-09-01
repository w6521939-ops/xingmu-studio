import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

export const loadTestProject = async (window, page = 'home', snapshot = createTestUserProjectSnapshot()) => {
  const entry = path.join(process.cwd(), 'dist', 'index.html')
  await window.loadFile(entry)
  await window.webContents.executeJavaScript(
    `localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})`,
  )
  await window.loadFile(entry, { query: { page } })
  if (['script', 'storyboard', 'voice'].includes(page)) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    await window.webContents.executeJavaScript(`(() => {
      const page = ${JSON.stringify(page)}
      if (page === 'script') {
        Array.from(document.querySelectorAll('.context-list > button')).find((button) => button.textContent.includes('场景 03'))?.click()
      } else if (page === 'storyboard') {
        Array.from(document.querySelectorAll('.scene-switcher > button')).find((button) => button.textContent.includes('场景 03'))?.click()
      } else {
        const sceneSelect = document.querySelectorAll('.dialogue-title select')[1]
        if (sceneSelect) {
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sceneSelect, '3')
          sceneSelect.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    })()`)
  }
}
