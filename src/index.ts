import { Glob } from 'bun'
import { parseMarkdown } from './parser'
import { BrowserComposer } from './composer'
import { buildPageHtml } from './renderer/page-html'
import { renderPdf } from './renderer/pdf'
import { loadTemplates } from './templates/loader'
import puppeteer from 'puppeteer'
import { resolve, join } from 'path'

async function main() {
  const contentDir = resolve('content')
  const outputDir = resolve('output')
  const templateDir = resolve('templates')

  const glob = new Glob('*.md')
  const filePaths: string[] = []
  for await (const file of glob.scan(contentDir)) {
    filePaths.push(file)
  }
  filePaths.sort()

  if (filePaths.length === 0) {
    console.error('No .md files found in content/')
    process.exit(1)
  }

  console.log(`Reading ${filePaths.length} Markdown file(s)...`)

  const allNodes: any[] = []
  for (const fp of filePaths) {
    const md = await Bun.file(join(contentDir, fp)).text()
    const result = parseMarkdown(md)
    if (allNodes.length > 0) {
      allNodes.push({ type: 'page_break' })
    }
    allNodes.push(...result.nodes)
  }

  console.log('Loading templates...')
  const registry = await loadTemplates(templateDir)

  console.log('Launching Puppeteer...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const bwPage = await browser.newPage()
  await bwPage.setViewport({ width: 800, height: 1100 })

  const composer = new BrowserComposer(bwPage, registry)
  await composer.init()
  console.log('Composing pages...')
  const pages = await composer.compose(allNodes, 'A')
  console.log(`Generated ${pages.length} page(s)`)

  for (let pi = 0; pi < pages.length && pi < 3; pi++) {
    const p = pages[pi]
    if (!p) continue
    for (const col of p.columns) {
      const charCount = col.nodes.reduce(
        (sum: number, n: any) => sum + (n.text?.length || 0),
        0,
      )
      const preview = col.nodes[0]?.text?.slice(0, 30) || '(empty)'
      console.log(
        `  P${pi + 1}.${col.def.id}: ${col.nodes.length}nodes ${charCount}chars | "${preview}..."`,
      )
    }
  }

  const { html: fullHtml } = buildPageHtml(pages, registry.combinedCss)
  const htmlPath = join(outputDir, 'output.html')
  await Bun.write(htmlPath, fullHtml)
  console.log(`HTML written to ${htmlPath}`)

  const outputPath = join(outputDir, 'output.pdf')

  console.log('Rendering PDF...')
  await renderPdf(fullHtml, outputPath)

  await browser.close()
  console.log(`Done: ${outputPath}`)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
