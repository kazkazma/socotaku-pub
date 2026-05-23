import type { Page } from 'puppeteer'
import type { ContentNode, LayoutId, TemplateRegistry } from '../types'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class BrowserComposer {
  private page: Page
  private registry: TemplateRegistry
  private initialized = false

  constructor(page: Page, registry: TemplateRegistry) {
    this.page = page
    this.registry = registry
  }

  async init(): Promise<void> {
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
    const composeJs = await buildResult.outputs[0].text()

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<style>${this.registry.combinedCss}</style>
</head>
<body>
<div id="compose-area" style="position:relative;"></div>
<script>${composeJs}</script>
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
        return fn(params.nodes, params.initialLayout, params.templates)
      },
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        initialLayout,
        templates: this.registry.templates,
      },
    )

    return pages
  }
}
