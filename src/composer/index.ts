import type { Browser, Page } from 'puppeteer'
import type { ContentNode, LayoutId, TemplateRegistry, PageDimensions } from '../types'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { launchHeadlessBrowser, newSizedPage, waitForFonts } from '../browser/puppeteer'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * BrowserComposer：將內容節點串流送入瀏覽器端排版引擎，
 * 利用真實的 CSS 排版引擎（vertical-rl）計算分欄與分頁。
 *
 * 使用方式：
 * ```ts
 * const composer = await BrowserComposer.create(registry, dimensions)
 * const pages = await composer.compose(nodes)
 * await composer.close()
 * ```
 */
export class BrowserComposer {
  private browser: Browser
  private page: Page
  private registry: TemplateRegistry
  private dimensions: PageDimensions
  private initialized = false

  private constructor(
    browser: Browser,
    page: Page,
    registry: TemplateRegistry,
    dimensions: PageDimensions,
  ) {
    this.browser = browser
    this.page = page
    this.registry = registry
    this.dimensions = dimensions
  }

  /**
   * 建立 BrowserComposer 實例：
   * 1. 啟動無頭瀏覽器、開新分頁、設 viewport
   * 2. 用 Bun.build 將 browser-compose.ts 打包為 IIFE
   * 3. 建立含 CSS + 排版腳本的 HTML 頁面
   * 4. 等待字型載入（逾時 5 秒仍可繼續）
   */
  static async create(
    registry: TemplateRegistry,
    dimensions: PageDimensions,
  ): Promise<BrowserComposer> {
    const browser = await launchHeadlessBrowser()
    try {
      const page = await newSizedPage(browser, dimensions)

      const entrypoint = resolve(__dirname, 'browser-compose.ts')
      const buildResult = await Bun.build({
        entrypoints: [entrypoint],
        target: 'browser',
        format: 'iife',
        minify: false,
      })
      if (!buildResult.success) {
        console.error('Compose script bundle errors:', buildResult.logs)
        throw new Error('Failed to bundle browser-compose.ts')
      }
      const composeJs = await buildResult.outputs[0]!.text()

      const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<style>${registry.combinedCss}</style>
</head>
<body>
<div id="compose-area" style="position:relative;"></div>
<script>${composeJs}</script>
</body>
</html>`

      await page.setContent(html, { waitUntil: 'load' })
      await waitForFonts(page)

      const composer = new BrowserComposer(browser, page, registry, dimensions)
      composer.initialized = true
      return composer
    } catch (err) {
      await browser.close()
      throw err
    }
  }

  /** 關閉排版用的瀏覽器 */
  async close(): Promise<void> {
    await this.browser.close()
  }

  /**
   * 執行排版：將節點串流序列化後傳入瀏覽器端的 browserCompose 函式，
   * 回傳排版完成的頁面陣列。
   */
  async compose(
    nodes: ContentNode[],
    initialLayout: LayoutId = 'A',
  ): Promise<any[]> {
    if (!this.initialized) throw new Error('BrowserComposer not initialized')

    const pages = await this.page.evaluate(
      (params) => {
        const fn = (window as any).browserCompose
        if (typeof fn !== 'function') {
          throw new Error('browserCompose is not defined on window')
        }
        return fn(params.nodes, params.initialLayout, params.templates, params.dimensions)
      },
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        initialLayout,
        templates: this.registry.templates,
        dimensions: this.dimensions,
      },
    )

    return pages
  }
}
