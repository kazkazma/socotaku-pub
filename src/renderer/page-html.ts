import type { Page, PageDimensions } from '../types'

/**
 * 將 Pages 陣列渲染為完整的 HTML 字串（可選擇嵌入 CSS）
 */
export function buildPageHtml(
  pages: Page[],
  dimensions: PageDimensions,
  cssContent?: string,
): { html: string } {
  const pageDivs = pages.map((page, i) => renderPage(page, i + 1, dimensions))

  let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
</head>
<body>
${pageDivs.join('\n')}
</body>
</html>`

  if (cssContent) {
    html = html.replace(
      '</head>',
      `<style>${cssContent}</style></head>`,
    )
  }

  return { html }
}

/** 將單一 Page 渲染為 HTML 字串，含 page-number 與邊距設定 */
function renderPage(
  page: Page,
  pageNum: number,
  dim: PageDimensions,
): string {
  const layoutId = page.layoutId
  // 左頁/右頁交錯邊距（奇數頁＝左頁）
  const isLeft = pageNum % 2 === 1
  const marginLeft = isLeft
    ? dim.marginOuterPt
    : dim.marginInnerPt
  const marginRight = isLeft
    ? dim.marginInnerPt
    : dim.marginOuterPt

  const columnsHtml = page.columns
    .map((col) => renderColumn(col))
    .join('\n')

  const pageStyle = [
    `width:${dim.widthPt}pt`,
    `height:${dim.heightPt}pt`,
    `padding:${dim.marginTopPt}pt ${marginRight}pt ${dim.marginBottomPt}pt ${marginLeft}pt`,
    'page-break-after:always',
    'overflow:hidden',
    'position:relative',
  ].join(';')

  const pageNumStyle = [
    'position:absolute',
    'bottom:61pt',
    'font-size:9pt',
    isLeft ? 'left:32pt' : 'right:32pt',
  ].join(';')

  return `<div class="page layout-${layoutId.toLowerCase()}" style="${pageStyle}">
<div class="page-content">${columnsHtml}</div>
<span class="page-number" style="${pageNumStyle}">${pageNum}</span>
</div>`
}

/** 將單一欄位的節點列表渲染為 HTML */
function renderColumn(col: any): string {
  const isBody = col.def.type === 'body'
  const content = col.nodes
    .map((node: any) => {
      if (node.type === 'heading') {
        const cls = node.isEndnoteHeading ? ' class="endnote-heading"' : ''
        return `<h2${cls}>${escapeHtml(node.text || '')}</h2>`
      }
      const html = replaceFnMarkers(escapeHtml(node.text || ''), isBody)
      const pCls = node.isEndnote ? ' class="endnote-text"' : ''
      return `<p${pCls}>${html}</p>`
    })
    .join('\n')

  const colClass = `column ${col.def.type} ${col.def.id}`

  return `<div class="${colClass}">
${content}
</div>`
}

/**
 * 將文字中的 [n] 註腳標記轉換為 SVG 圓形數字圖示
 * @param wrapInSpan 正文中包 <span class="footnote-ref">，註腳欄內只給 SVG
 */
function replaceFnMarkers(text: string, wrapInSpan: boolean): string {
  return text.replace(/\[(\w+)\]/g, (match, id) => {
    const n = parseInt(id, 10)
    if (isNaN(n)) {
      return wrapInSpan ? `<span class="footnote-ref">${match}</span>` : match
    }
    const svg = `<svg viewBox="0 0 20 20" width="8pt" height="8pt" style="writing-mode:horizontal-tb"><circle cx="10" cy="10" r="9" fill="currentColor"/><text x="10" y="13.5" text-anchor="middle" font-size="11" fill="white">${n}</text></svg>`
    return wrapInSpan ? `<span class="footnote-ref">${svg}</span>` : svg
  })
}

/** HTML 跳脫（& < > " '） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
