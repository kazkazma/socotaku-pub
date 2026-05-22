import { type Page, type LayoutId, PAGE_DIMENSIONS } from '../types'

export function buildPageHtml(
  pages: Page[],
  layoutId: LayoutId,
): { html: string } {
  const pageDivs = pages.map((page, i) => renderPage(page, i + 1, layoutId))

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
</head>
<body>
${pageDivs.join('\n')}
</body>
</html>`

  return { html }
}

function renderPage(
  page: Page,
  pageNum: number,
  layoutId: LayoutId,
): string {
  const isLeft = pageNum % 2 === 0
  const marginLeft = isLeft
    ? PAGE_DIMENSIONS.marginOuterPt
    : PAGE_DIMENSIONS.marginInnerPt
  const marginRight = isLeft
    ? PAGE_DIMENSIONS.marginInnerPt
    : PAGE_DIMENSIONS.marginOuterPt

  const columnsHtml = page.columns
    .filter((c) => c.nodes.length > 0)
    .map((col) => renderColumn(col))
    .join('\n')

  const pageStyle = [
    `width:${PAGE_DIMENSIONS.widthPt}pt`,
    `height:${PAGE_DIMENSIONS.heightPt}pt`,
    `padding:${PAGE_DIMENSIONS.marginTopPt}pt ${marginRight}pt ${PAGE_DIMENSIONS.marginBottomPt}pt ${marginLeft}pt`,
    'page-break-after:always',
    'overflow:hidden',
    'position:relative',
  ].join(';')

  const pageNumStyle = [
    'position:absolute',
    `bottom:72pt`,
    'font-size:9pt',
    isLeft ? `left:${PAGE_DIMENSIONS.marginOuterPt}pt` : `right:${PAGE_DIMENSIONS.marginInnerPt}pt`,
  ].join(';')

  return `<div class="page layout-${layoutId.toLowerCase()}" style="${pageStyle}">
<div class="page-content">${columnsHtml}</div>
<span class="page-number" style="${pageNumStyle}">${pageNum}</span>
</div>`
}

function renderColumn(col: any): string {
  const height =
    col.def.type === 'footnote'
      ? 167
      : 187
  const fontSize = col.def.type === 'footnote' ? '9pt' : '11pt'
  const lineHeight = col.def.type === 'footnote' ? '1.6' : '19.8pt'
  const letterSpacing = col.def.type === 'footnote' ? '0.3pt' : '0.7pt'

  let marginTop = 0
  if (col.def.type === 'body') {
    if (col.def.id !== 'top' && col.def.id !== 'col1') {
      marginTop = col.def.id === 'bottom' ? 44 : 22
    }
  }

  const content = col.nodes
    .map((node: any) => {
      if (node.type === 'heading') {
        return `<h2>${escapeHtml(node.text || '')}</h2>`
      }
      return `<p>${escapeHtml(node.text || '')}</p>`
    })
    .join('\n')

  const colClass = `column ${col.def.type} ${col.def.id}`
  const colStyle = [
    `writing-mode:vertical-rl`,
    `height:${height}pt`,
    `font-size:${fontSize}`,
    `line-height:${lineHeight}`,
    `letter-spacing:${letterSpacing}`,
    `margin-top:${marginTop}pt`,
    'width:100%',
  ].join(';')

  return `<div class="${colClass}" style="${colStyle}">
${content}
</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
