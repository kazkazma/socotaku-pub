import puppeteer from 'puppeteer'
import { resolve } from 'path'

const htmlPath = resolve('output/output.html')
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 800, height: 1100 })
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' })

const results = await page.evaluate(() => {
  const pages = document.querySelectorAll('.page')
  const report: any[] = []

  pages.forEach((pageEl, pi) => {
    const cols = pageEl.querySelectorAll('.column.body')
    const pageText: any[] = []

    cols.forEach((col) => {
      const range = document.createRange()
      const children = col.querySelectorAll('p, h2')
      let textLeft = Infinity, textRight = -Infinity

      children.forEach((child) => {
        range.selectNodeContents(child)
        const rects = range.getClientRects()
        for (let i = 0; i < rects.length; i++) {
          if (rects[i].left < textLeft) textLeft = rects[i].left
          if (rects[i].right > textRight) textRight = rects[i].right
        }
      })

      const colRect = col.getBoundingClientRect()
      const contentExtent = textRight !== -Infinity ? colRect.right - textLeft : 0
      const utilPct = colRect.width > 0 ? (contentExtent / colRect.width) * 100 : 0
      const nodeTypes: string[] = []
      children.forEach((c) => nodeTypes.push(c.tagName))
      const hasHeading = nodeTypes.includes('H2')

      pageText.push({
        id: col.className,
        nodes: children.length,
        chars: (col.textContent || '').length,
        utilPct,
        hasHeading,
        nodeTypes: nodeTypes.join(','),
        contentExtent: Math.round(contentExtent),
        colWidth: Math.round(colRect.width),
      })
    })

    // Check pair imbalance (top vs middle)
    const bodyCols = cols.length
    if (bodyCols >= 2) {
      const util0 = pageText[0]?.utilPct ?? 0
      const util1 = pageText[1]?.utilPct ?? 0
      const imbalance = util1 > 0 ? Math.abs(util0 - util1) : 0
      pageText.push({ type: 'pair', topUtil: util0, midUtil: util1, imbalance })
    }

    report.push({ page: pi + 1, cols: pageText })
  })

  return report
})

// ── Summary ──
const articlePages = results.filter(r => r.page >= 4 && r.page <= 37)

console.log(`\n=== 第三篇文章 (P4-P37) 不方正/沒填滿分析 ===\n`)

// List extreme imbalance pages
const imbalanced = articlePages
  .map(r => {
    const pair = r.cols.find((c: any) => c.type === 'pair')
    return pair ? { page: r.page, ...pair } : null
  })
  .filter(Boolean)
  .sort((a: any, b: any) => b.imbalance - a.imbalance)

console.log(`--- 同一頁內 top/middle 欄利用率差異 (sorted worst) ---`)
for (const p of imbalanced.slice(0, 10)) {
  console.log(
    `P${String(p.page).padStart(2)}: top=${p.topUtil.toFixed(1)}%  middle=${p.midUtil.toFixed(1)}%  diff=${p.imbalance.toFixed(1)}% ⚠️`
  )
}

// List all low-util top columns
console.log(`\n--- Top column 利用率 <70% (不方正) ---`)
let totalTopUtil = 0, topCount = 0
for (const r of articlePages) {
  const topCol = r.cols.find((c: any) => c.id?.includes('top'))
  if (topCol && topCol.chars > 0) {
    totalTopUtil += topCol.utilPct
    topCount++
    if (topCol.utilPct < 70) {
      console.log(
        `P${String(r.page).padStart(2)}: ${topCol.utilPct.toFixed(1)}% ` +
        `(${topCol.chars} chars, ${topCol.nodes} nodes, ${topCol.hasHeading ? 'has H2' : 'no H2'})` +
        (topCol.utilPct < 20 ? ' ❌' : '')
      )
    }
  }
}

// Summary stats
const midCols = articlePages.map(r => r.cols.find((c: any) => c.id?.includes('middle'))).filter(Boolean)
let totalMidUtil = 0, midCount = 0
for (const m of midCols) {
  if (m.chars > 0) { totalMidUtil += m.utilPct; midCount++ }
}
const avgTopUtil = totalTopUtil / topCount
const avgMidUtil = totalMidUtil / midCount

console.log(`\n=== 統計 ===`)
console.log(`Top 欄平均利用率: ${avgTopUtil.toFixed(1)}% (${topCount} columns)`)
console.log(`Middle 欄平均利用率: ${avgMidUtil.toFixed(1)}% (${midCount} columns)`)

// Pages where both columns have 0 nodes (completely empty)
const emptyPages = results.filter(r => {
  const bodyCols = r.cols.filter((c: any) => c.id?.includes('body'))
  return bodyCols.length > 0 && bodyCols.every((c: any) => c.chars === 0)
})
if (emptyPages.length > 0) {
  console.log(`\n完全空白的頁面: P${emptyPages.map(p => p.page).join(', P')}`)
}

await browser.close()
