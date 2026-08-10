import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const API = 'http://localhost:8087/api/v1'
const DOC = '8c3bc868-d950-4c5b-a910-99a2b87d3e3a'
const OUT = 'C:/Users/Administrator/Documents/project ta/latex_laporan/gambar'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 })
const page = await context.newPage()

try {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { username: 'maftuhade123@gmail.com', password: 'CHANGEME' },
  })
  if (!login.ok()) throw new Error(`Login gagal: HTTP ${login.status()}`)

  await page.goto(`${BASE}/co-writer`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/gambar-4-2-co-writer.png`, fullPage: false })

  await page.goto(`${BASE}/co-writer/${DOC}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${OUT}/gambar-4-3-co-writer-editor.png`, fullPage: false })

  const agent = page.locator('button[aria-label="Buka asisten agentic"]')
  if (await agent.isVisible().catch(() => false)) {
    await agent.click()
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${OUT}/gambar-4-8-agentic-write.png`, fullPage: false })
} finally {
  await browser.close()
}
