import type { Page } from '../types'

/**
 * 將 Pages 陣列渲染為完整的 HTML 字串（可選擇嵌入 CSS）
 */
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

/** 依 slots 順序渲染 page 的主體 HTML（保留 static 在 template 中的位置） */
function renderSlots(page: Page): string {
  if (!page.slots || page.slots.length === 0) {
    return page.columns.map((col) => renderColumn(col)).join('\n')
  }

  return page.slots
    .map((slot) => {
      if (slot.type === 'static') return slot.html
      const col = page.columns[slot.index]
      return col ? renderColumn(col) : ''
    })
    .join('\n')
}

/** 將單一 Page 渲染為 HTML 字串，含 page-number */
function renderPage(
  page: Page,
  pageNum: number,
): string {
  const layoutId = page.layoutId
  const side = pageNum % 2 === 1 ? 'left' : 'right'
  const bodyHtml = renderSlots(page)

  return `<div class="page ${layoutId} ${side}">
${bodyHtml}
<span class="page-number ${side}">${pageNum}</span>
</div>`
}

/** 將單一欄位的節點列表渲染為 HTML */
function renderColumn(col: any): string {
  const isBody = col.def.type === 'body'
  const content = col.nodes
    .map((node: any) => {
      if (node.type === 'heading') {
        const tag = `h${Math.min(node.level || 2, 6)}`
        return `<${tag}>${escapeHtml(node.text || '').replace(/\n/g, '<br>')}</${tag}>`
      }
      if (node.type === 'image') {
        if (node.src) {
          return `<div class="pic-wrapper"><img src="${node.src}" alt="${escapeHtml(node.alt || '')}" class="pic-image"></div>`
        }
        return ''
      }
      const html = applyInlineFormatting(replaceFnMarkers(escapeHtml(node.text || '').replace(/\n/g, '<br>'), isBody))
      const classes = [node.isEndnote ? 'endnote-text' : '', node.continues ? 'continues' : '', node.type === 'quote' ? 'quote' : ''].filter(Boolean)
      const pCls = classes.length ? ` class="${classes.join(' ')}"` : ''
      const styleAttr = node.style ? ` style="${node.style}"` : ''
      return `<p${pCls}${styleAttr}>${html}</p>`
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

/** 將 *italic* 與 **bold** 轉為 HTML 標籤 */
function applyInlineFormatting(html: string): string {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
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
