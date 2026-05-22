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
      const node = queue[0]

      switch (node.type) {
        case 'page_break':
          if (!isPageEmpty(currentPage)) pages.push(currentPage)
          currentPage = createPage(this.layout)
          queue.shift()
          break

        case 'layout_switch':
          if (!isPageEmpty(currentPage)) pages.push(currentPage)
          this.layout = LAYOUTS[node.layout!]
          currentPage = createPage(this.layout)
          queue.shift()
          break

        case 'footnote_ref':
          queue.shift()
          break

        case 'footnote_def':
          if (node.text) this.footnoteTexts.push(node.text)
          queue.shift()
          break

        case 'heading':
        case 'paragraph': {
          const placed = await this.tryPlace(node, currentPage)
          if (placed) {
            queue.shift()
            break
          }

          const bodyCols = getBodyColumns(currentPage)
          const [first, second] = await this.measurer.splitAt(
            node.text!,
            BODY_OPTS,
          )

          if (first) {
            for (const colIdx of bodyCols) {
              const existing = getColumnText(currentPage, colIdx)
              const combined = existing
                ? existing + '\n' + first
                : first
              if (await this.measurer.fits(combined, BODY_OPTS)) {
                currentPage.columns[colIdx].nodes.push({
                  ...node,
                  text: first,
                })
                break
              }
            }
          }

          pages.push(currentPage)
          currentPage = createPage(this.layout)

          if (second) {
            queue[0] = { ...node, text: second }
          } else {
            queue.shift()
          }
          break
        }

        default:
          queue.shift()
          break
      }
    }

    if (!isPageEmpty(currentPage)) pages.push(currentPage)

    await this.placeFootnotes(pages)

    return pages
  }

  private async tryPlace(node: ContentNode, page: Page): Promise<boolean> {
    const bodyCols = getBodyColumns(page)

    for (const colIdx of bodyCols) {
      const col = page.columns[colIdx]
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
      const fnColIdx = getFootnoteColumn(pages[i])
      if (fnColIdx === null) continue

      const fnCol = pages[i].columns[fnColIdx]
      for (const text of this.footnoteTexts) {
        const existing = fnCol.nodes.map((n) => n.text || '').join('\n')
        const combined = existing ? existing + '\n' + text : text
        if (await this.measurer.fits(combined, FOOTNOTE_OPTS)) {
          fnCol.nodes.push({ type: 'paragraph', text })
        }
      }
      return
    }
  }
}
