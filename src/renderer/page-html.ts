import { type Page, PAGE_DIMENSIONS } from '../types'

export function buildPageHtml(
  pages: Page[],
  cssContent?: string,
): { html: string } {
  const pageDivs = pages.map((page, i) => renderPage(page, i + 1))

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

function renderPage(
  page: Page,
  pageNum: number,
): string {
  const layoutId = page.layoutId
  const isLeft = pageNum % 2 === 0
  const marginLeft = isLeft
    ? PAGE_DIMENSIONS.marginOuterPt
    : PAGE_DIMENSIONS.marginInnerPt
  const marginRight = isLeft
    ? PAGE_DIMENSIONS.marginInnerPt
    : PAGE_DIMENSIONS.marginOuterPt

  const columnsHtml = page.columns
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
  const content = col.nodes
    .map((node: any) => {
      if (node.type === 'heading') {
        return `<h2>${escapeHtml(node.text || '')}</h2>`
      }
      return `<p>${escapeHtml(node.text || '')}</p>`
    })
    .join('\n')

  const colClass = `column ${col.def.type} ${col.def.id}`

  return `<div class="${colClass}">
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
