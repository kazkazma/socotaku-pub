import type { Page } from 'puppeteer'
import { PAGE_CONTENT_WIDTH_PT } from '../types'

const COLUMN_BLOCK_WIDTH = PAGE_CONTENT_WIDTH_PT

export type MeasureOptions = {
  heightPt: number
  fontSizePt: number
  lineHeightPt: number
  letterSpacingPt: number
  writingMode: 'vertical-rl' | 'horizontal-tb'
}

const PT_TO_PX = 96 / 72

export class Measurer {
  private page: Page
  private initialized = false

  constructor(page: Page) {
    this.page = page
  }

  async init(cssContent: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<style>${cssContent}
</style>
</head>
<body>
  <div id="measurer" style="position:absolute;left:-9999px;top:0;visibility:hidden;">
    <div id="m-col" class="column body"></div>
  </div>
</body>
</html>`

    await this.page.setContent(html, { waitUntil: 'load' })
    try {
      await this.page.evaluate(() =>
        Promise.race([
          (document as any).fonts.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('fonts timeout')), 5000),
          ),
        ]),
      )
    } catch {
      // fonts not installed; proceed with fallback
    }
    this.initialized = true
  }

  private async measure(
    text: string,
    opts: MeasureOptions,
  ): Promise<{ contentExtentPx: number; limitExtentPx: number }> {
    if (!this.initialized) throw new Error('Measurer not initialized')

    return this.page.evaluate(
      ({ text, opts, columnWidthPt }) => {
        const col = document.getElementById('m-col')!
        col.style.writingMode = opts.writingMode
        col.style.fontSize = `${opts.fontSizePt}pt`
        col.style.lineHeight = `${opts.lineHeightPt}pt`
        col.style.letterSpacing = `${opts.letterSpacingPt}pt`
        col.style.overflow = 'hidden'

        if (opts.writingMode === 'vertical-rl') {
          col.style.height = `${opts.heightPt}pt`
          col.style.width = `${columnWidthPt}pt`
        } else {
          col.style.width = `${opts.heightPt}pt`
          col.style.height = 'auto'
        }

        col.textContent = text

        let contentExtentPx: number
        let limitExtentPx: number

        if (opts.writingMode === 'vertical-rl') {
          contentExtentPx = col.scrollWidth
          limitExtentPx = col.clientWidth
        } else {
          contentExtentPx = col.scrollHeight
          limitExtentPx = col.clientHeight
        }

        col.textContent = ''
        return { contentExtentPx, limitExtentPx }
      },
      { text, opts, columnWidthPt: COLUMN_BLOCK_WIDTH },
    )
  }

  async fits(text: string, opts: MeasureOptions): Promise<boolean> {
    const { contentExtentPx, limitExtentPx } = await this.measure(text, opts)
    return contentExtentPx <= limitExtentPx
  }

  async splitAt(
    text: string,
    opts: MeasureOptions,
  ): Promise<[string, string]> {
    if (!text) return ['', '']

    if (await this.fits(text, opts)) return [text, '']

    let low = 0
    let high = text.length
    let best = 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const { contentExtentPx, limitExtentPx } = await this.measure(
        text.slice(0, mid),
        opts,
      )

      if (contentExtentPx <= limitExtentPx) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return [text.slice(0, best), text.slice(best)]
  }

  async totalHeight(text: string, opts: MeasureOptions): Promise<number> {
    if (!text) return 0
    const { contentExtentPx } = await this.measure(text, opts)
    return contentExtentPx / PT_TO_PX
  }
}
