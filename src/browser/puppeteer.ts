import puppeteer, { type Browser, type Page } from 'puppeteer'
import type { PageDimensions } from '../types'

const VIEWPORT_BUFFER = 100

/** 使用預設選項啟動無頭瀏覽器 */
export async function launchHeadlessBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
}

/** 根據頁面尺寸計算 viewport（頁面尺寸 + buffer，避免 scrollbar 干擾測量） */
export function getViewport(dimensions: PageDimensions) {
  return {
    width: Math.ceil(dimensions.widthPt) + VIEWPORT_BUFFER,
    height: Math.ceil(dimensions.heightPt) + VIEWPORT_BUFFER,
  }
}

/** 開新分頁並設好 viewport */
export async function newSizedPage(
  browser: Browser,
  dimensions: PageDimensions,
): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport(getViewport(dimensions))
  return page
}

/** 等待字型載入（逾時 5 秒，失敗則靜默繼續） */
export async function waitForFonts(page: Page): Promise<void> {
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
    // 字型未安裝時使用 fallback
  }
}
