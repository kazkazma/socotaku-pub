import type { PageDimensions } from '../types'
import { launchHeadlessBrowser, newSizedPage, waitForFonts } from '../browser/puppeteer'

/**
 * 將 HTML 內容透過 Puppeteer 渲染為 PDF
 * （內部自行管理 browser lifecycle）
 */
export async function renderPdf(
  html: string,
  outputPath: string,
  dimensions: PageDimensions,
): Promise<void> {
  const browser = await launchHeadlessBrowser()
  try {
    const page = await newSizedPage(browser, dimensions)
    await page.setContent(html, { waitUntil: 'load' })
    await waitForFonts(page)

    // mm → inch（Puppeteer 使用 inch 為單位）
    const mmToIn = (mm: number) => (mm / 25.4).toFixed(2) + 'in'
    await page.pdf({
      path: outputPath,
      width: mmToIn(dimensions.widthMm),
      height: mmToIn(dimensions.heightMm),
      printBackground: true,
      // 邊距已內嵌在 HTML 中（page padding）
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    await page.close()
  } finally {
    await browser.close()
  }
}
