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
    const cols = pageEl.querySelectorAll('.column')
    cols.forEach((col) => {
      const colRect = col.getBoundingClientRect()
      const children = col.querySelectorAll('p, h2')

      // Use Range to measure actual text bounding boxes
      let textLeft = Infinity
      let textRight = -Infinity
      let textBottom = -Infinity
      let textTop = Infinity

      children.forEach((child) => {
        const range = document.createRange()
        range.selectNodeContents(child)
        const rects = range.getClientRects()
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]
          if (r.left < textLeft) textLeft = r.left
          if (r.right > textRight) textRight = r.right
          if (r.bottom > textBottom) textBottom = r.bottom
          if (r.top < textTop) textTop = r.top
        }
        range.detach()
      })

      // Content block extent = how far content extends in block direction (RTL for vertical-rl)
      // Measured from column's right edge to content's leftmost extent
      const contentBlockExtent = textRight !== -Infinity ? colRect.right - textLeft : 0

      // Overflow checks
      let blockOverflow = false
      let blockOverflowPx = 0
      let inlineOverflow = false
      let inlineOverflowPx = 0

      if (textLeft !== Infinity) {
        // Block overflow: content extends past column's left edge
        if (textLeft < colRect.left - 0.5) {
          blockOverflow = true
          blockOverflowPx = colRect.left - textLeft
        }
        // Inline overflow: content extends past column's bottom edge
        if (textBottom > colRect.bottom + 0.5) {
          inlineOverflow = true
          inlineOverflowPx = textBottom - colRect.bottom
        }
      }

      report.push({
        page: pi + 1,
        col: col.className,
        colW: Math.round(colRect.width),
        colH: Math.round(colRect.height),
        colLeft: Math.round(colRect.left),
        colRight: Math.round(colRect.right),
        textLeft: Math.round(textLeft),
        textRight: Math.round(textRight),
        textTop: Math.round(textTop),
        textBottom: Math.round(textBottom),
        contentBlockExtent: Math.round(contentBlockExtent),
        blockUtilPct: colRect.width > 0
          ? ((contentBlockExtent / colRect.width) * 100).toFixed(1)
          : 'N/A',
        blockOverflow,
        blockOverflowPx: Math.round(blockOverflowPx),
        inlineOverflow,
        inlineOverflowPx: Math.round(inlineOverflowPx),
        nodes: children.length,
        textLen: (col.textContent || '').length,
      })
    })
  })

  return report
})

// == Print ==
const withContent = results.filter(r => r.nodes > 0)
const blockOverflow = results.filter(r => r.blockOverflow)
const inlineOverflow = results.filter(r => r.inlineOverflow)

console.log(`\n=== Text Range-Based Overflow Report ===`)
console.log(`Total columns: ${results.length}`)
console.log(`Columns with content: ${withContent.length}`)

if (blockOverflow.length === 0 && inlineOverflow.length === 0) {
  console.log(`\n✅ ALL COLUMNS PASS - No overflow detected`)
} else {
  if (blockOverflow.length > 0) {
    console.log(`\n❌ BLOCK OVERFLOW (${blockOverflow.length} columns):`)
    for (const f of blockOverflow) {
      console.log(`  P${f.page} ${f.col}: ${f.blockOverflowPx}px past left edge`)
    }
  }
  if (inlineOverflow.length > 0) {
    console.log(`\n❌ INLINE OVERFLOW (${inlineOverflow.length} columns):`)
    for (const f of inlineOverflow) {
      console.log(`  P${f.page} ${f.col}: ${f.inlineOverflowPx}px past bottom`)
    }
  }
}

// Sort by block utilization
const sorted = [...withContent].sort((a, b) => Number(b.blockUtilPct) - Number(a.blockUtilPct))

console.log(`\n=== Block utilization (all columns) ===`)
for (const u of sorted) {
  const mark = u.blockOverflow ? ' ❌' : u.inlineOverflow ? ' ↕' : ''
  console.log(
    `P${String(u.page).padStart(2)} ${u.col.padEnd(25)} ` +
    `block:${u.blockUtilPct.padStart(6)}% ` +
    `(${String(u.contentBlockExtent).padStart(4)}/${String(u.colW).padStart(4)}px) ` +
    `text:[L${String(u.textLeft).padStart(4)},R${String(u.textRight).padStart(4)},` +
    `T${String(u.textTop).padStart(4)},B${String(u.textBottom).padStart(4)}] ` +
    `nodes:${String(u.nodes).padStart(2)} chars:${String(u.textLen).padStart(4)}` +
    mark
  )
}

// Summary stats
if (!blockOverflow.length && !inlineOverflow.length) {
  const utilAvg = withContent.length > 0
    ? withContent.reduce((s, r) => s + Number(r.blockUtilPct), 0) / withContent.length
    : 0
  const minCol = sorted.length > 0 ? sorted[sorted.length - 1] : null
  const maxCol = sorted.length > 0 ? sorted[0] : null

  console.log(`\n=== Summary ===`)
  console.log(`Average block utilization: ${utilAvg.toFixed(1)}%`)
  if (minCol) console.log(`Min block util: ${minCol.blockUtilPct}% (P${minCol.page} ${minCol.col})`)
  if (maxCol) console.log(`Max block util: ${maxCol.blockUtilPct}% (P${maxCol.page} ${maxCol.col})`)
}

await browser.close()
