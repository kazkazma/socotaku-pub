import puppeteer from 'puppeteer'
import type { PageDimensions } from '../types'

export async function renderPdf(
  html: string,
  outputPath: string,
  dimensions: PageDimensions,
): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 800, height: 1100 })

  await page.setContent(html, { waitUntil: 'load' })

  try {
    await page.evaluate(() =>
      Promise.race([
        (document as any).fonts.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('fonts timeout')), 5000),
        ),
      ]),
    )
  } catch {
    // fonts may not be installed; render with fallback
  }

  const mmToIn = (mm: number) => (mm / 25.4).toFixed(2) + 'in'
  await page.pdf({
    path: outputPath,
    width: mmToIn(dimensions.widthMm),
    height: mmToIn(dimensions.heightMm),
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })

  await browser.close()
}
