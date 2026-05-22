import { type ContentNode, type Page, type LayoutId, LAYOUTS } from '../types'
import { Measurer, type MeasureOptions } from './measurer'
import { createPage, getBodyColumns, getFootnoteColumn, isPageEmpty, getColumnText } from './page-builder'

const BODY_OPTS: MeasureOptions = {
  heightPt: 187,
  fontSizePt: 11,
  lineHeightPt: 19.8,
  letterSpacingPt: 0.7,
  writingMode: 'vertical-rl',
}

const FOOTNOTE_OPTS: MeasureOptions = {
  heightPt: 167,
  fontSizePt: 9,
  lineHeightPt: 14.4,
  letterSpacingPt: 0.3,
  writingMode: 'vertical-rl',
}

export class PageComposer {
  private measurer: Measurer
  private layout = LAYOUTS.A
  private footnoteTexts: string[] = []

  constructor(measurer: Measurer, initialLayout: LayoutId = 'A') {
    this.measurer = measurer
    this.layout = LAYOUTS[initialLayout]
  }

  async compose(nodes: ContentNode[]): Promise<Page[]> {
    const pages: Page[] = []
    let currentPage = createPage(this.layout)
    const queue: ContentNode[] = [...nodes]

    while (queue.length > 0) {
      const node = queue[0]!
      const nodeType = node.type

      if (nodeType === 'page_break') {
        if (!isPageEmpty(currentPage)) pages.push(currentPage)
        currentPage = createPage(this.layout)
        queue.shift()
        continue
      }

      if (nodeType === 'layout_switch') {
        if (!isPageEmpty(currentPage)) pages.push(currentPage)
        this.layout = LAYOUTS[node.layout!]
        currentPage = createPage(this.layout)
        queue.shift()
        continue
      }

      if (nodeType === 'footnote_ref') {
        queue.shift()
        continue
      }

      if (nodeType === 'footnote_def') {
        if (node.text) this.footnoteTexts.push(node.text)
        queue.shift()
        continue
      }

      if (nodeType === 'heading' || nodeType === 'paragraph') {
        const placed = await this.tryPlace(node, currentPage)
        if (placed) {
          queue.shift()
          continue
        }

        const [first, second] = await this.measurer.splitAt(
          node.text ?? '',
          BODY_OPTS,
        )

        if (first) {
          const bodyCols = getBodyColumns(currentPage)
          for (const colIdx of bodyCols) {
            const col = currentPage.columns[colIdx]
            if (!col) continue
            const existing = getColumnText(currentPage, colIdx)
            if (await this.measurer.fits(
              existing ? existing + '\n' + first : first,
              BODY_OPTS,
            )) {
              col.nodes.push({ type: nodeType, text: first } as ContentNode)
              break
            }
          }
        }

        pages.push(currentPage)
        currentPage = createPage(this.layout)

        if (second) {
          queue[0] = { type: nodeType, text: second } as ContentNode
        } else {
          queue.shift()
        }
        continue
      }

      queue.shift()
    }

    if (!isPageEmpty(currentPage)) pages.push(currentPage)

    await this.placeFootnotes(pages)

    return pages
  }

  private async tryPlace(node: ContentNode, page: Page): Promise<boolean> {
    const bodyCols = getBodyColumns(page)

    for (const colIdx of bodyCols) {
      const col = page.columns[colIdx]
      if (!col) continue
      const existing = getColumnText(page, colIdx)
      const combined = existing
        ? existing + '\n' + (node.text || '')
        : node.text || ''

      if (await this.measurer.fits(combined, BODY_OPTS)) {
        col.nodes.push(node)
        return true
      }
    }

    return false
  }

  private async placeFootnotes(pages: Page[]): Promise<void> {
    if (this.footnoteTexts.length === 0) return

    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i]
      if (!page) continue
      const fnColIdx = getFootnoteColumn(page)
      if (fnColIdx === null) continue

      const fnCol = page.columns[fnColIdx]
      if (!fnCol) continue

      for (const text of this.footnoteTexts) {
        const existing = fnCol.nodes.map((n) => n.text || '').join('\n')
        const combined = existing ? existing + '\n' + text : text
        if (await this.measurer.fits(combined, FOOTNOTE_OPTS)) {
          fnCol.nodes.push({ type: 'paragraph', text } as ContentNode)
        }
      }
      return
    }
  }
}
