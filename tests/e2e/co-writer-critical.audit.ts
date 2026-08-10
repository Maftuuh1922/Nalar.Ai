import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { jsPDF } from 'jspdf'

test.describe('Co-Writer critical research workflow', () => {
  test('long LaTeX document scrolls inside the editor panel', async ({ page }) => {
    test.setTimeout(120_000)

    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'debugger2', password: 'debug1234' },
    })
    expect(login.ok()).toBeTruthy()

    const lines = Array.from(
      { length: 400 },
      (_, index) => `Baris laporan ${index + 1}: isi pengujian scroll editor.`
    )
    const created = await page.request.post('/api/v1/co_writer/documents', {
      data: {
        title: 'Audit scroll editor',
        content: [
          '\\documentclass{article}',
          '\\begin{document}',
          '\\section{Bagian Awal Audit}',
          ...lines.slice(0, 200),
          '\\newpage',
          '\\section{Bagian Akhir Sinkron}',
          ...lines.slice(200),
          '\\end{document}',
        ].join('\n'),
      },
    })
    expect(created.ok()).toBeTruthy()
    const document = (await created.json()) as { id: string }

    try {
      await page.goto(`/co-writer/${document.id}`)
      const scroller = page.locator('.latex-editor .cm-scroller')
      await expect(scroller).toBeVisible({ timeout: 30_000 })
      const dimensions = await scroller.evaluate(element => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }))
      expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight)

      await scroller.hover()
      await page.mouse.wheel(0, 1400)
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0)

      await page.getByRole('button', { name: /Outline/i }).click()
      await page.getByText('Bagian Akhir Sinkron', { exact: true }).click()
      const pageCounter = page.getByText(/^\d+ \/ \d+$/).first()
      await expect(pageCounter).toBeVisible({ timeout: 90_000 })
      await expect
        .poll(async () => Number((await pageCounter.textContent())?.split('/')[0].trim() || 0), {
          timeout: 90_000,
        })
        .toBeGreaterThan(1)
    } finally {
      await page.request.delete(`/api/v1/co_writer/documents/${document.id}`)
    }
  })

  test('original PDF preview preserves the uploaded bytes', async ({ page }) => {
    test.setTimeout(180_000)

    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'debugger2', password: 'debug1234' },
    })
    expect(login.ok()).toBeTruthy()

    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.text('Dokumen sumber asli', 24, 32)
    pdf.setFontSize(11)
    pdf.text('Tata letak ini harus dipertahankan pada mode Asli.', 24, 48)
    const original = Buffer.from(pdf.output('arraybuffer'))
    const imported = await page.request.post('/api/v1/co_writer/import-file', {
      multipart: {
        file: {
          name: 'uji-pratinjau-asli.pdf',
          mimeType: 'application/pdf',
          buffer: original,
        },
      },
    })
    expect(imported.ok()).toBeTruthy()
    const document = (await imported.json()) as { id: string; source_format: string | null }

    try {
      expect(document.source_format).toBe('pdf')
      const source = await page.request.get(`/api/v1/co_writer/documents/${document.id}/source`)
      expect(source.ok()).toBeTruthy()
      const downloaded = await source.body()
      expect(createHash('sha256').update(downloaded).digest('hex')).toBe(
        createHash('sha256').update(original).digest('hex')
      )

      await page.goto(`/co-writer/${document.id}`)
      await expect(page.getByRole('button', { name: 'Asli', exact: true })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByRole('button', { name: 'Hasil edit', exact: true })).toBeVisible()
      await expect(page.locator('.react-pdf__Page canvas')).toBeVisible({ timeout: 60_000 })
      const canvasDensity = await page.locator('.react-pdf__Page canvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect()
        return rect.width > 0 ? (canvas as HTMLCanvasElement).width / rect.width : 0
      })
      expect(canvasDensity).toBeGreaterThanOrEqual(1.9)
      await expect(page.getByRole('button', { name: 'Unduh PDF', exact: true })).toBeEnabled()
    } finally {
      await page.request.delete(`/api/v1/co_writer/documents/${document.id}`)
    }
  })

  test('outline, versioning, agentic actions, and PDF capture stay connected', async ({ page }) => {
    test.setTimeout(180_000)

    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'debugger2', password: 'debug1234' },
    })
    expect(login.ok()).toBeTruthy()

    const created = await page.request.post('/api/v1/co_writer/documents', {
      data: {
        title: 'Audit alur tesis',
        content: [
          '\\documentclass{article}',
          '\\begin{document}',
          '\\input{bab/01-pendahuluan.tex}',
          '\\end{document}',
        ].join('\n'),
      },
    })
    expect(created.ok()).toBeTruthy()
    const document = (await created.json()) as { id: string }

    try {
      const child = await page.request.put(
        `/api/v1/co_writer/documents/${document.id}/files/bab/01-pendahuluan.tex`,
        {
          data: {
            content: [
              '\\section{Pendahuluan}',
              'Penelitian ini membahas alur penulisan tesis terpadu.',
              '\\subsection{Tujuan}',
              'Tujuan penelitian adalah mempercepat penulisan laporan.',
            ].join('\n'),
          },
        }
      )
      expect(child.ok()).toBeTruthy()

      await page.goto(`/co-writer/${document.id}`)
      await expect(page.getByText('Audit alur tesis')).toBeVisible({ timeout: 30_000 })

      await page.getByTitle('Buka panel referensi').click()
      await expect(page.getByPlaceholder(/Cari judul, penulis, tahun, DOI/i)).toBeVisible({
        timeout: 30_000,
      })
      await page.getByRole('button', { name: 'Pilih semua', exact: true }).click()
      const insertCitation = page.getByRole('button', { name: 'Sisipkan sitasi', exact: true })
      await expect(insertCitation).toBeVisible()
      const [actionBox, sidebarBox] = await Promise.all([
        insertCitation.boundingBox(),
        insertCitation.locator('xpath=ancestor::aside').boundingBox(),
      ])
      expect(actionBox).not.toBeNull()
      expect(sidebarBox).not.toBeNull()
      expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(
        sidebarBox!.y + sidebarBox!.height + 1
      )
      await page.getByRole('button', { name: 'Tutup panel', exact: true }).click()

      await page.getByRole('button', { name: /Outline/i }).click()
      await expect(page.getByText('Pendahuluan', { exact: true })).toBeVisible()
      await expect(page.getByText(/bab\/01-pendahuluan\.tex/).first()).toBeVisible()

      await page.getByText('Pendahuluan', { exact: true }).click()
      const editor = page.locator('.cm-content')
      await editor.click()
      await page.keyboard.press('Control+End')
      await page.keyboard.type('\n[[')
      const quickCite = page.locator('.dt-popup-up')
      await expect(quickCite).toBeVisible()
      const numberedReference = quickCite.getByRole('button', { name: /^\[\d+\]/ }).first()
      await expect(numberedReference).toBeVisible()
      await numberedReference.click()
      await expect(editor).toContainText(/\[\d+\]/)

      await page.getByRole('button', { name: /Riwayat versi/i }).click()
      await page.getByRole('button', { name: /Simpan checkpoint sekarang/i }).click()
      await expect(page.getByText('Checkpoint manual', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: /Riwayat versi/i }).click()

      await page.getByRole('button', { name: /Buka asisten agentic/i }).click()
      await page.getByRole('button', { name: 'Alur kerja jurnal', exact: true }).click()
      await expect(page.getByText('Gap riset & novelty', { exact: true })).toBeVisible()
      await page.getByText('Gap riset & novelty', { exact: true }).click()
      await expect(page.getByPlaceholder(/Tanya AI tentang referensi atau draf/i)).toHaveValue(
        /Petakan gap riset dan novelty/i
      )
      await expect(page.getByRole('button', { name: /Select model|Pilih model/i })).toBeVisible()
      await expect(page.getByLabel('Mode kerja AI')).toBeVisible()
      await page.getByRole('button', { name: 'Atur sumber konteks', exact: true }).click()
      await expect(page.getByText('Draf dan semua bab', { exact: true })).toBeVisible()
      await expect(page.getByText('Referensi penelitian', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Atur sumber konteks', exact: true }).click()
      await page.getByRole('button', { name: 'Cek struktur', exact: true }).click()
      await expect(page.getByText(/Hasil cek struktur/)).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: /Tutup asisten/i }).click()

      const capture = page.getByRole('button', {
        name: /Kirim halaman ini ke asisten|Send this page to the assistant/i,
      })
      await expect(capture).toBeEnabled({ timeout: 90_000 })
      await capture.click()
      await expect(page.getByText(/Gambar siap dianalisis/i)).toBeVisible()
    } finally {
      await page.request.delete(`/api/v1/co_writer/documents/${document.id}`)
    }
  })

  test('main chat exposes an evidence-oriented journal workflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'debugger2', password: 'debug1234' },
    })
    expect(login.ok()).toBeTruthy()

    await page.goto('/home')
    const journalMenu = page.getByRole('button', { name: 'Alur kerja jurnal', exact: true })
    await expect(journalMenu).toBeVisible({ timeout: 30_000 })
    await journalMenu.click()
    const workflowDialog = page.getByRole('dialog', { name: 'Asisten Pembuatan Jurnal' })
    await expect(workflowDialog).toBeVisible()
    const dialogBox = await workflowDialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(376)
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(668)
    await page.getByText('Simulasi reviewer & siap submit', { exact: true }).click()
    await expect(page.locator('textarea').first()).toHaveValue(/Bertindak sebagai reviewer jurnal/i)
    await expect(page.getByText('Jurnal', { exact: true }).first()).toBeVisible()
  })

  test('chat context popup can be moved without leaving the viewport', async ({ page }) => {
    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'debugger2', password: 'debug1234' },
    })
    expect(login.ok()).toBeTruthy()

    const created = await page.request.post('/api/v1/co_writer/documents', {
      data: {
        title: 'Audit popup konteks',
        content: '\\documentclass{article}\n\\begin{document}\nIsi.\n\\end{document}',
      },
    })
    expect(created.ok()).toBeTruthy()
    const document = (await created.json()) as { id: string }

    try {
      await page.goto(`/co-writer/${document.id}`)
      await page
        .locator('.latex-editor .cm-scroller')
        .waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: /Buka asisten agentic/i }).click()
      const contextButton = page.getByRole('button', {
        name: 'Atur sumber konteks',
        exact: true,
      })
      await expect(contextButton).toBeVisible({ timeout: 30_000 })
      await contextButton.click()

      const popup = page.getByTestId('co-writer-context-popup')
      const handle = popup.locator('[data-context-drag-handle]')
      await expect(popup).toBeVisible()
      await page.waitForTimeout(100)
      const before = await popup.boundingBox()
      const handleBox = await handle.boundingBox()
      const viewport = page.viewportSize()
      expect(before).not.toBeNull()
      expect(handleBox).not.toBeNull()
      expect(viewport).not.toBeNull()

      await page.mouse.move(
        handleBox!.x + handleBox!.width / 2,
        handleBox!.y + handleBox!.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(handleBox!.x - 100, handleBox!.y - 45)
      await page.mouse.up()

      const after = await popup.boundingBox()
      expect(after).not.toBeNull()
      expect(after!.x).toBeLessThan(before!.x - 40)
      expect(after!.y).toBeLessThan(before!.y - 10)
      expect(after!.x).toBeGreaterThanOrEqual(0)
      expect(after!.y).toBeGreaterThanOrEqual(0)
      expect(after!.x + after!.width).toBeLessThanOrEqual(viewport!.width)
      expect(after!.y + after!.height).toBeLessThanOrEqual(viewport!.height)
    } finally {
      await page.request.delete(`/api/v1/co_writer/documents/${document.id}`)
    }
  })
})
