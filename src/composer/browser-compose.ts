;(window as any).browserCompose = function (
  nodes: any[],
  initialLayout: string,
  templates: Record<string, any>,
  dimensions: { marginOuterPt: number; marginInnerPt: number; marginTopPt: number; marginBottomPt: number },
): any[] {
  const PAGE_LEFT = dimensions.marginOuterPt
  const PAGE_RIGHT = dimensions.marginInnerPt
  const PAGE_TOP = dimensions.marginTopPt
  const PAGE_BOTTOM = dimensions.marginBottomPt

  const composeArea = document.getElementById('compose-area')!
  const pages: any[] = []
  const pageEls: HTMLElement[] = []
  const defMap = new Map<string, string>()
  const refsPerPage = new Map<number, Array<{ refId: string; displayId: string }>>()
  // Pre-build displayId → refId lookup from all footnote_ref nodes
  const fnRefMap = new Map<string, string>()
  for (const node of nodes) {
    if (node.type === 'footnote_ref') {
      fnRefMap.set(node.displayId || node.id, node.id)
    }
  }
  let currentTemplate = templates[initialLayout]
  let pageEl = buildPageDOM(currentTemplate, composeArea)
  let pageData = createPageData(pageEl)
  pageEls.push(pageEl)

  // ── Helpers ──

  function createPageData(pageEl: HTMLElement): any {
    const colEls = Array.from(pageEl.querySelectorAll('[data-column]'))
    return {
      layoutId: pageEl.dataset.layout || '',
      columns: colEls.map((el) => ({
        def: {
          id: el.getAttribute('data-column') || '',
          type: el.getAttribute('data-col-type') || 'body',
        },
        nodes: [],
      })),
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

  function getBodyColumnDefs(pageEl: HTMLElement): HTMLElement[] {
    return Array.from(pageEl.querySelectorAll('[data-column][data-col-type="body"]'))
  }

  function getFootnoteColumnDef(pageEl: HTMLElement): HTMLElement | null {
    return pageEl.querySelector('[data-column][data-col-type="footnote"]')
  }

  function getColumnIndex(pageEl: HTMLElement, colEl: HTMLElement): number {
    return Array.from(pageEl.querySelectorAll('[data-column]')).indexOf(colEl)
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

  function recordFnRefsFromText(text: string, pageIdx: number): void {
    if (!text) return
    const matches = text.matchAll(/\[(\d+)\]/g)
    for (const match of matches) {
      const displayId = match[1]
      const refId = fnRefMap.get(displayId)
      if (refId) {
        if (!refsPerPage.has(pageIdx)) refsPerPage.set(pageIdx, [])
        const existing = refsPerPage.get(pageIdx)!
        if (!existing.some((r: any) => r.refId === refId)) {
          existing.push({ refId, displayId })
        }
      }
    }
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
    pageEl: HTMLElement,
    pageData: any,
    nextNode?: any,
  ): { placed: boolean; remainder: string | null } {
    const nodeType = node.type
    const text = node.text ?? ''
    const bodyCols = getBodyColumnDefs(pageEl)
    let fallbackCol: { el: HTMLElement; idx: number } | null = null

    // Phase 1: try to place the whole node
    for (const colEl of bodyCols) {
      const el = createElementForNode(nodeType, text)
      colEl.appendChild(el)

      if (!columnOverflows(colEl)) {
        // Node fits in this column
        if (nodeType === 'heading' && !node.isEndnoteHeading && pageEl.dataset.role !== 'endnote' && nextNode?.type === 'paragraph') {
          const prefixLen = Math.min((nextNode.text ?? '').length, bodyCharsPerLine(colEl))
          const prefixEl = createElementForNode('paragraph', nextNode.text.slice(0, prefixLen))
          colEl.appendChild(prefixEl)

          if (!columnOverflows(colEl)) {
            // heading + prefix both fit → this column has room; defer to later column
            colEl.removeChild(prefixEl)
            colEl.removeChild(el)
            if (!fallbackCol) {
              fallbackCol = { el: colEl, idx: getColumnIndex(pageEl, colEl) }
            }
            continue
          }

          // heading alone fits, prefix does not → accept here (tight fit)
          colEl.removeChild(prefixEl)
        }

        const colIdx = getColumnIndex(pageEl, colEl)
        pageData.columns[colIdx].nodes.push(node)
        recordFnRefsFromText(text, pages.length)
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
      recordFnRefsFromText(text, pages.length)
      return { placed: true, remainder: null }
    }

    // Phase 2: split and place on first column that can take a prefix
    for (const colEl of bodyCols) {
      const [first, second] = splitAt(text, colEl, nodeType)
      if (!first) continue

      const el = createElementForNode(nodeType, first)
      colEl.appendChild(el)
      const colIdx = getColumnIndex(pageEl, colEl)
      pageData.columns[colIdx].nodes.push({ ...node, text: first })
      recordFnRefsFromText(first, pages.length)
      return { placed: true, remainder: second || null }
    }

    return { placed: false, remainder: text }
  }

  function placeFootnotes(allPages: any[]): void {
    const measurer = document.createElement('div')
    measurer.style.cssText = `writing-mode:vertical-rl;font-size:9pt;height:167pt;overflow:hidden;position:absolute;left:-9999px;top:0;width:375pt;`
    document.body.appendChild(measurer)

    const pendingFootnotes: Array<{ displayId: string; text: string }> = []

    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i]
      const fnCol = page.columns.find((c: any) => c.def.type === 'footnote')
      if (!fnCol) continue

      const refs = refsPerPage.get(i) ?? []
      for (const { refId, displayId } of refs) {
        const defText = defMap.get(refId)
        if (defText) {
          pendingFootnotes.push({ displayId, text: defText })
        }
      }

      while (pendingFootnotes.length > 0) {
        const fn = pendingFootnotes[0]
        const fnText = `[${fn.displayId}] ${fn.text}`
        const testP = document.createElement('p')
        testP.textContent = fnText
        measurer.appendChild(testP)

        if (!columnOverflows(measurer)) {
          measurer.removeChild(testP)
          fnCol.nodes.push({ type: 'paragraph', text: fnText })
          pendingFootnotes.shift()
        } else {
          measurer.removeChild(testP)
          break
        }
      }

      measurer.innerHTML = ''
    }

    document.body.removeChild(measurer)
  }

  // ── Main Loop ──
  const queue = [...nodes]
  while (queue.length > 0) {
    const node = queue.shift()!
    const nodeType = node.type

    if (nodeType === 'page_break') {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
        pageEl = buildPageDOM(currentTemplate, composeArea)
        pageEls.push(pageEl)
        pageData = createPageData(pageEl)
      }
      continue
    }

    if (nodeType === 'layout_switch') {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
      }
      currentTemplate = templates[node.layout]
      pageEl = buildPageDOM(currentTemplate, composeArea)
      pageEls.push(pageEl)
      pageData = createPageData(pageEl)
      continue
    }

    if (nodeType === 'footnote_ref') {
      // Handled by recordFnRefsFromText during paragraph placement
      continue
    }

    if (nodeType === 'footnote_def') {
      if (pageEl.dataset.role === 'endnote') {
        if (node.text) {
          const text = `[${node.displayId || node.id}] ${node.text}`
          queue.unshift({ type: 'paragraph', text, isEndnote: true })
        }
      } else {
        if (node.text) defMap.set(node.id, node.text)
      }
      continue
    }

    if (nodeType === 'heading' || nodeType === 'paragraph') {
      const nextNode = queue[0] ?? null

      let result: { placed: boolean; remainder: string | null }
      if (nodeType === 'heading') {
        result = tryPlaceAndSplit(node, pageEl, pageData, nextNode)
      } else {
        result = tryPlaceAndSplit(node, pageEl, pageData)
      }

      if (result.placed) {
        if (result.remainder) {
          queue.unshift({ ...node, text: result.remainder })
        }
        continue
      }

      // Couldn't place even a prefix — push current page, retry on new page
      if (!isPageEmpty(pageData)) {
        pages.push(pageData)
        pageEl = buildPageDOM(currentTemplate, composeArea)
        pageEls.push(pageEl)
        pageData = createPageData(pageEl)
        queue.unshift(node)
        continue
      }

      // Empty page deadlock — force-place whole node (may overflow)
      const firstColEl = getBodyColumnDefs(pageEl)[0]
      if (firstColEl) {
        const el = createElementForNode(nodeType, node.text ?? '')
        firstColEl.appendChild(el)
        const colIdx = getColumnIndex(pageEl, firstColEl)
        pageData.columns[colIdx].nodes.push(node)
      }
      continue
    }
  }

  if (!isPageEmpty(pageData)) {
    pages.push(pageData)
  }

  placeFootnotes(pages)

  return pages
}
