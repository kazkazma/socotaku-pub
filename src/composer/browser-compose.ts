import { PAGE_DIMENSIONS } from '../types'

const PAGE_LEFT = PAGE_DIMENSIONS.marginOuterPt
const PAGE_RIGHT = PAGE_DIMENSIONS.marginInnerPt
const PAGE_TOP = PAGE_DIMENSIONS.marginTopPt
const PAGE_BOTTOM = PAGE_DIMENSIONS.marginBottomPt

;(window as any).browserCompose = function (
  nodes: any[],
  initialLayout: string,
  templates: Record<string, any>,
): any[] {

  const composeArea = document.getElementById('compose-area')!
  const pages: any[] = []
  const pageEls: HTMLElement[] = []
  const footnoteTexts: string[] = []
  let currentTemplate = templates[initialLayout]
  let pageData = createPageData(currentTemplate)
  let pageEl = buildPageDOM(currentTemplate, composeArea)
  pageEls.push(pageEl)

  // ── Helpers ──

  function createPageData(tpl: any): any {
    return {
      layoutId: tpl.manifest.id,
      columns: tpl.manifest.columns.map((c: any) => ({ def: { id: c.id, type: c.type }, nodes: [] })),
    }
  }

  function createElementFromHTML(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html.trim()
    return div.firstElementChild as HTMLElement
  }

  function buildPageDOM(tpl: any, parent: HTMLElement): HTMLElement {
    const pageEl = createElementFromHTML(tpl.pageHtml)
    pageEl.style.padding = `${PAGE_TOP}pt ${PAGE_RIGHT}pt ${PAGE_BOTTOM}pt ${PAGE_LEFT}pt`
    parent.appendChild(pageEl)
    return pageEl
  }

  function getColumnEl(pageEl: HTMLElement, colId: string): HTMLElement | null {
    return pageEl.querySelector(`[data-column='${colId}']`)
  }

  function getBodyColumnDefs(tpl: any): any[] {
    return tpl.manifest.columns.filter((c: any) => c.type === 'body')
  }

  function getFootnoteColumnDef(tpl: any): any | null {
    return tpl.manifest.columns.find((c: any) => c.type === 'footnote') ?? null
  }

  function isPageEmpty(pd: any): boolean {
    return pd.columns.every((c: any) => c.nodes.length === 0)
  }

  function createElementForNode(nodeType: string, text: string): HTMLElement {
    const el = document.createElement(nodeType === 'heading' ? 'h2' : 'p')
    el.textContent = text
    return el
  }

  function columnOverflows(colEl: HTMLElement): boolean {
    const lastChild = colEl.lastElementChild
    if (!lastChild) return false
    const colRect = colEl.getBoundingClientRect()
    const childRect = lastChild.getBoundingClientRect()
    return childRect.left < colRect.left - 1
  }

  function bodyCharsPerLine(colEl: HTMLElement): number {
    const style = getComputedStyle(colEl)
    const fontSizePx = parseFloat(style.fontSize)
    const letterSpacingPx = parseFloat(style.letterSpacing) || 0
    if (isNaN(fontSizePx)) return 15
    const inlinePx = colEl.getBoundingClientRect().height
    const charAdvancePx = fontSizePx + letterSpacingPx
    return Math.max(1, Math.floor(inlinePx / charAdvancePx))
  }

  function splitAt(text: string, colEl: HTMLElement, nodeType: string): [string, string] {
    if (!text) return ['', '']

    const testEl = createElementForNode(nodeType, text)
    colEl.appendChild(testEl)
    if (!columnOverflows(colEl)) {
      colEl.removeChild(testEl)
      return [text, '']
    }
    colEl.removeChild(testEl)

    let low = 0
    let high = text.length
    let best = 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (mid === 0) { low = 1; continue }

      const midEl = createElementForNode(nodeType, text.slice(0, mid))
      colEl.appendChild(midEl)
      if (!columnOverflows(colEl)) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
      colEl.removeChild(midEl)
    }

    return [text.slice(0, best), text.slice(best)]
  }

  function tryPlaceAndSplit(
    node: any,
    tpl: any,
    pageEl: HTMLElement,
    pageData: any,
    nextNode?: any,
  ): { placed: boolean; remainder: string | null } {
    const nodeType = node.type
    const text = node.text ?? ''
    const bodyCols = getBodyColumnDefs(tpl)
    let fallbackCol: { el: HTMLElement; idx: number } | null = null

    // Phase 1: try to place the whole node
    for (const col of bodyCols) {
      const colEl = getColumnEl(pageEl, col.id)
      if (!colEl) continue

      const el = createElementForNode(nodeType, text)
      colEl.appendChild(el)

      if (!columnOverflows(colEl)) {
        // Node fits in this column
        if (nodeType === 'heading' && nextNode?.type === 'paragraph') {
          const prefixLen = Math.min((nextNode.text ?? '').length, bodyCharsPerLine(colEl))
          const prefixEl = createElementForNode('paragraph', nextNode.text.slice(0, prefixLen))
          colEl.appendChild(prefixEl)

          if (!columnOverflows(colEl)) {
            // heading + prefix both fit → this column has room; defer to later column
            colEl.removeChild(prefixEl)
            colEl.removeChild(el)
            if (!fallbackCol) {
              fallbackCol = { el: colEl, idx: tpl.manifest.columns.indexOf(col) }
            }
            continue
          }

          // heading alone fits, prefix does not → accept here (tight fit)
          colEl.removeChild(prefixEl)
        }

        const colIdx = tpl.manifest.columns.indexOf(col)
        pageData.columns[colIdx].nodes.push(node)
        return { placed: true, remainder: null }
      }

      // Whole node does not fit in this column
      colEl.removeChild(el)
    }

    // Fallback: use deferred column for heading
    if (fallbackCol) {
      const el = createElementForNode(nodeType, text)
      fallbackCol.el.appendChild(el)
      pageData.columns[fallbackCol.idx].nodes.push(node)
      return { placed: true, remainder: null }
    }

    // Phase 2: split and place on first column that can take a prefix
    for (const col of bodyCols) {
      const colEl = getColumnEl(pageEl, col.id)
      if (!colEl) continue

      const [first, second] = splitAt(text, colEl, nodeType)
      if (!first) continue

      const el = createElementForNode(nodeType, first)
      colEl.appendChild(el)
      const colIdx = tpl.manifest.columns.indexOf(col)
      pageData.columns[colIdx].nodes.push({ type: nodeType, text: first })
      return { placed: true, remainder: second || null }
    }

    return { placed: false, remainder: text }
  }

  function placeFootnotes(allPages: any[], texts: string[], pagesEls: HTMLElement[], tpl: any): void {
    if (texts.length === 0 || !tpl) return

    for (let i = allPages.length - 1; i >= 0; i--) {
      const page = allPages[i]
      const fnCol = page.columns.find((c: any) => c.def.type === 'footnote')
      if (!fnCol) continue

      const pageEl = pagesEls[i]
      const fnColEl = getColumnEl(pageEl, fnCol.def.id)
      if (!fnColEl) continue

      for (const text of texts) {
        const newP = document.createElement('p')
        newP.textContent = text
        fnColEl.appendChild(newP)

        if (!columnOverflows(fnColEl)) {
          fnCol.nodes.push({ type: 'paragraph', text })
        } else {
          fnColEl.removeChild(newP)
        }
      }
      return
    }
  }

  // ── Main Loop ──
  const queue = [...nodes]
  while (queue.length > 0) {
    const node = queue.shift()!
    const nodeType = node.type

    if (nodeType === 'page_break') {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
        pageData = createPageData(currentTemplate)
        pageEl = buildPageDOM(currentTemplate, composeArea)
        pageEls.push(pageEl)
      }
      continue
    }

    if (nodeType === 'layout_switch') {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
      }
      currentTemplate = templates[node.layout]
      pageData = createPageData(currentTemplate)
      pageEl = buildPageDOM(currentTemplate, composeArea)
      pageEls.push(pageEl)
      continue
    }

    if (nodeType === 'footnote_ref') {
      continue
    }

    if (nodeType === 'footnote_def') {
      if (node.text) footnoteTexts.push(node.text)
      continue
    }

    if (nodeType === 'heading' || nodeType === 'paragraph') {
      const nextNode = queue[0] ?? null

      let result: { placed: boolean; remainder: string | null }
      if (nodeType === 'heading') {
        result = tryPlaceAndSplit(node, currentTemplate, pageEl, pageData, nextNode)
      } else {
        result = tryPlaceAndSplit(node, currentTemplate, pageEl, pageData)
      }

      if (result.placed) {
        if (result.remainder) {
          queue.unshift({ type: nodeType, text: result.remainder } as any)
        }
        continue
      }

      // Couldn't place even a prefix — push current page, retry on new page
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
        pageData = createPageData(currentTemplate)
        pageEl = buildPageDOM(currentTemplate, composeArea)
        pageEls.push(pageEl)
        queue.unshift(node)
        continue
      }

      // Empty page deadlock — force-place whole node (may overflow)
      const firstCol = getBodyColumnDefs(currentTemplate)[0]
      const colEl = getColumnEl(pageEl, firstCol.id)
      if (colEl) {
        const el = createElementForNode(nodeType, node.text ?? '')
        colEl.appendChild(el)
        const colIdx = currentTemplate.manifest.columns.indexOf(firstCol)
        pageData.columns[colIdx].nodes.push(node)
      }
      continue
    }
  }

  if (!isPageEmpty(pageData)) {
    pages.push(pageData)
  }

  if (currentTemplate) {
    placeFootnotes(pages, footnoteTexts, pageEls, currentTemplate)
  }

  return pages
}
