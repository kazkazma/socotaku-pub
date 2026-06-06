import { Glob } from 'bun'
import { parseMarkdown } from './parser'
import { BrowserComposer } from './composer'
import { buildPageHtml } from './renderer/page-html'
import { renderPdf } from './renderer/pdf'
import { loadTemplates } from './templates/loader'
import { resolve, join } from 'path'

const TARGET_DPI = 300

/**
 * 主流程：讀取 Markdown → 剖析 → 排版 → 輸出 HTML → 輸出 PDF
 */
async function main() {
  // ── 目錄設定 ──
  const contentDir = resolve('content')
  const outputDir = resolve('output')
  const templateDir = resolve('templates')

  // ── 掃描 content/ 底下的所有 .md 檔案 ──
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

  // ── 逐一讀取並剖析，合併為單一節點串流 ──
  const allNodes: any[] = []
  for (let fi = 0; fi < filePaths.length; fi++) {
    const fp = filePaths[fi]!
    const fullPath = join(contentDir, fp)
    const md = await Bun.file(fullPath).text()
    const result = parseMarkdown(md, fullPath)
    // 多檔案之間插入分頁
    if (allNodes.length > 0) {
      allNodes.push({ type: 'page_break' })
    }
    // 跨檔案時為註腳加上檔案前綴，避免 id 衝突
    for (const node of result.nodes) {
      if (node.type === 'footnote_ref' || node.type === 'footnote_def') {
        node.displayId = node.id
        node.id = `${fi}:${node.id}`
      }
      // 段落的 refIds 也要前綴，轉為 fnRefs
      if (node.type === 'paragraph' && (node as any).refIds) {
        const refIds: string[] = (node as any).refIds
        node.fnRefs = refIds.map((id: string) => ({
          refId: `${fi}:${id}`,
          displayId: id,
        }))
      }
    }
    allNodes.push(...result.nodes)
  }

  // ── 載入樣板與 CSS ──
  console.log('Loading templates...')
  const { registry, dimensions } = await loadTemplates(templateDir)

  // ── 初始化瀏覽器端排版引擎 ──
  console.log('Initializing composer...')
  const composer = await BrowserComposer.create(registry, dimensions)
  let pages: any[]
  try {
    console.log('Composing pages...')
    pages = await composer.compose(allNodes)
    console.log(`Generated ${pages.length} page(s)`)
  } finally {
    await composer.close()
  }

  // ── 列出前三頁的欄位統計（快速檢查用） ──
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

  // ── 輸出 HTML ──
  const { html: fullHtml } = buildPageHtml(pages, dimensions, registry.combinedCss)
  const htmlPath = join(outputDir, 'output.html')
  await Bun.write(htmlPath, fullHtml)
  console.log(`HTML written to ${htmlPath}`)

  // ── 輸出 PDF（自行管理 browser lifecycle） ──
  const outputPath = join(outputDir, 'output.pdf')
  console.log('Rendering PDF...')
  await renderPdf(fullHtml, outputPath, dimensions, TARGET_DPI / 96)

  console.log(`Done: ${outputPath}`)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})


