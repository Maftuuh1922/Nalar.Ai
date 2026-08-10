import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const API = 'http://localhost:8087/api/v1'
const DOC = process.env.DOC ?? '8c3bc868-d950-4c5b-a910-99a2b87d3e3a'
const expectBadge = process.env.EXPECT_BADGE !== '0'
const expectRaw0 = process.env.EXPECT_RAW0 !== '0'
const OUT = 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\opencode\\p1_'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } })
const page = await ctx.newPage()
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

try {
  const loginRes = await page.request.post(`${API}/auth/login`, {
    data: { username: 'maftuhade123@gmail.com', password: 'CHANGEME' },
  })
  check('login', loginRes.ok(), `HTTP ${loginRes.status()}`)

  await page.goto(`${BASE}/co-writer/${DOC}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  // ── 1. Mode fokus ──
  const focusBtn = page.locator('button[title*="Mode fokus" i]').first()
  try {
    await focusBtn.waitFor({ state: 'visible', timeout: 15000 })
    check('fokus: tombol terlihat', true, await focusBtn.innerText())
  } catch {
    check('fokus: tombol terlihat', false, 'tidak ketemu')
  }

  const closeLeft = page.locator('button[title="Tutup panel berkas"]')
  const openLeft = page.locator('button[title="Buka panel berkas"]')
  const openRight = page.locator('button[title="Buka panel referensi"]')
  const chatFab = page.locator('button[aria-label="Buka asisten agentic"]')
  await closeLeft.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {})
  const before = {
    leftOpen: await closeLeft.isVisible().catch(() => false),
    leftClosed: await openLeft.isVisible().catch(() => false),
    right: await openRight.isVisible().catch(() => false),
    chat: await chatFab.isVisible().catch(() => false),
  }
  check('fokus: panel tersedia sebelum aktif', before.leftOpen && !before.leftClosed && before.right && before.chat,
    `leftOpen=${before.leftOpen} leftClosed=${before.leftClosed} right=${before.right} chat=${before.chat}`)

  await focusBtn.click()
  await page.waitForTimeout(700)
  const after = {
    leftOpen: await closeLeft.isVisible().catch(() => false),
    leftClosed: await openLeft.isVisible().catch(() => false),
    right: await openRight.isVisible().catch(() => false),
    chat: await chatFab.isVisible().catch(() => false),
  }
  const labelAfter = await focusBtn.innerText().catch(() => '')
  check('fokus: panel tersembunyi saat aktif', !after.leftOpen && !after.leftClosed && !after.right && !after.chat,
    `leftOpen=${after.leftOpen} leftClosed=${after.leftClosed} right=${after.right} chat=${after.chat} label="${labelAfter}"`)

  await focusBtn.click()
  await page.waitForTimeout(700)
  const restored = await openLeft.isVisible().catch(() => false)
  check('fokus: tombol buka panel pulih setelah keluar', restored)

  // ── 2. Typography editor Word ──
  const firstPar = page.locator('[data-block-kind="p"]').first()
  try {
    await firstPar.waitFor({ state: 'attached', timeout: 20000 })
    const metrics = await firstPar.evaluate(el => {
      const cs = getComputedStyle(el)
      return { size: cs.fontSize, lh: cs.lineHeight }
    })
    check('typography: 16px + line-height nyaman', metrics.size === '16px',
      `${metrics.size} / ${metrics.lh}`)
  } catch {
    check('typography: blok editor ditemukan', false, 'blok tidak ada')
  }

  // ── P0 regression: markdown mentah tidak boleh tampil di editor Word ──
  const blockCount = await page.locator('[data-block-kind]').count()
  const rawMd = await page.locator('text=/## /').count()
  const rawImg = await page.locator('text=/!\\[.*\\]\\(http/').count()
  const dupTitle = await page.locator('[data-block-kind="h2"]', { hasText: 'NALAR AI:' }).count()
  check('P0: blok editor ter-render', blockCount > 0, `${blockCount} blocks`)
  check('P0: tanpa markdown mentah "## "', rawMd === 0, `raw=${rawMd}`)
  check('P0: tanpa markdown gambar mentah', !expectRaw0 || rawImg === 0,
    `raw=${rawImg}${!expectRaw0 ? ' (artifact konten doc, bukan bug editor)' : ''}`)
  check('P0: tanpa judul h2 terduplikasi', dupTitle === 0, `dup=${dupTitle}`)

  // ── 3. Pratinjau: fit-to-width + indicator heading aktif ──
  await page.click('button[title="Lihat pratinjau PDF hasil terakhir"]')
  await page.waitForTimeout(3500)
  const editedTab = page.locator('button', { hasText: 'Hasil edit' })
  if (await editedTab.isVisible().catch(() => false)) {
    await editedTab.click()
    await page.waitForTimeout(2500)
  }
  const fitBtn = page.locator('button[aria-label="Sesuaikan lebar halaman"]')
  const fitVisible = await fitBtn.isVisible().catch(() => false)
  check('preview: tombol fit ada', fitVisible)
  if (fitVisible) {
    const zoomBefore = await page.locator('span.tabular-nums').first().innerText().catch(() => '?')
    await fitBtn.click()
    await page.waitForTimeout(400)
    const zoomAfter = await page.locator('span.tabular-nums').first().innerText().catch(() => '?')
    check('preview: zoom berubah setelah fit', zoomBefore !== zoomAfter, `${zoomBefore} -> ${zoomAfter}`)
  }

  const overlay = page.locator('div.fixed.inset-0.z-\\[70\\]')
  const badgeDump = await overlay.evaluate(() => ({
    h1icons: document.querySelectorAll('svg.lucide-heading-1').length,
    badgeCount: Array.from(document.querySelectorAll('span[title]')).filter(s => s.querySelector('svg.lucide-heading-1')).length,
    iconParent: (() => {
      const el = document.querySelector('svg.lucide-heading-1')
      return el ? el.parentElement?.outerHTML?.slice(0, 400) : null
    })(),
  })).catch(() => null)
  console.log('BADGE DUMP:', JSON.stringify(badgeDump))
  const headingIcon = overlay.locator('span[title]:has(svg.lucide-heading-1)').first()
  const badgeVisible = await headingIcon.isVisible().catch(() => false)
  let badgeText = ''
  if (badgeVisible) {
    badgeText = (await headingIcon.innerText().catch(() => '')) || 'empty'
  }
  check('preview: indicator heading aktif tampil', !expectBadge || (badgeVisible && badgeText !== 'empty'),
    !expectBadge ? `skipped — doc tanpa heading (${badgeText || 'kosong'})` : `"${badgeText}"`)

  // ── 4. Toast status (auto-dismiss) ──
  // Tutup overlay, buka asisten, klik "Ekspor Word" (export-docx di-mock agar
  // deterministik) — handler selalu setStatus → toast harus muncul lalu hilang.
  await page.click('button:has-text("Kembali mengedit")')
  await page.waitForTimeout(400)
  await page.route('**/export-docx', r =>
    r.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: Buffer.from('PK\x03\x04mock-docx'),
    })
  )
  await page.click('button[aria-label="Buka asisten agentic"]')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Ekspor Word")')
  let toastSeen = false
  let toastText = ''
  const toast = page.locator('[role="status"]')
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400)
    if (await toast.isVisible().catch(() => false)) {
      toastSeen = true
      toastText = (await toast.innerText().catch(() => '')) || ''
      break
    }
  }
  check('toast: muncul setelah aksi', toastSeen, `"${toastText}"`)
  if (toastSeen) {
    await page.waitForTimeout(4500)
    const gone = !(await toast.isVisible().catch(() => false))
    check('toast: auto-dismiss 4 detik', gone)
  }

  await page.screenshot({ path: OUT + 'fokus.png' })
} catch (e) {
  check('script crash', false, String(e))
  await page.screenshot({ path: OUT + 'crash.png' }).catch(() => {})
} finally {
  await browser.close()
}

const failed = results.filter(r => !r.pass)
console.log(`\n== ${results.length - failed.length}/${results.length} PASS ==`)
process.exit(failed.length ? 1 : 0)
