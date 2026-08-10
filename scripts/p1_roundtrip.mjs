import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const API = 'http://localhost:8087/api/v1'
const DOC = '6bbd2753-bc5b-429f-bec9-edd51952b0a1'
const MARKER = ` RT-${Date.now().toString(36)}`

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } })
const page = await ctx.newPage()
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const getMd = async () => {
  const res = await page.request.get(`${API}/co_writer/documents/${DOC}/md`)
  const data = await res.json()
  return data.markdown ?? ''
}

try {
  const loginRes = await page.request.post(`${API}/auth/login`, {
    data: { username: 'maftuhade123@gmail.com', password: 'CHANGEME' },
  })
  check('login', loginRes.ok())

  await page.goto(`${BASE}/co-writer/${DOC}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  const firstPar = page.locator('[data-block-kind="p"]').first()
  await firstPar.waitFor({ state: 'attached', timeout: 20000 })
  await firstPar.click()
  await page.keyboard.press('End')
  await page.keyboard.type(MARKER)
  await page.waitForTimeout(300)

  // Tunggu autosave (debounce 1.5s + save/convert)
  let saved = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    const md = await getMd()
    if (md.includes(MARKER)) { saved = true; break }
  }
  check('autosave: marker tersimpan di backend', saved)

  // Reload → blok harus memuat marker
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const domText = await page.locator('[data-block-kind="p"]').first().innerText().catch(() => '')
  check('reload: marker muncul kembali di editor', domText.includes(MARKER), `blok="${domText.slice(0, 60)}..."`)

  // Cleanup: hapus marker dari blok
  await page.locator('[data-block-kind="p"]').first().click()
  await page.keyboard.press('End')
  for (let i = 0; i < MARKER.length + 2; i++) await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)
  let cleaned = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    const md = await getMd()
    if (!md.includes(MARKER)) { cleaned = true; break }
  }
  check('cleanup: marker terhapus dari backend', cleaned)

  await page.screenshot({ path: 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\opencode\\p1_roundtrip.png' })
} catch (e) {
  check('script crash', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter(r => !r.pass)
console.log(`\n== ${results.length - failed.length}/${results.length} PASS ==`)
process.exit(failed.length ? 1 : 0)
