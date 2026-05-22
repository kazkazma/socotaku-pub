import { type Page, type LayoutDef, type LayoutId } from '../types'

export function createPage(layout: LayoutDef): Page {
  return {
    layoutId: layout.id,
    columns: layout.columns.map((def) => ({
      def,
      nodes: [],
    })),
  }
}

export function getBodyColumns(page: Page): number[] {
  return page.columns
    .map((c, i) => ({ type: c.def.type, idx: i }))
    .filter((c) => c.type === 'body')
    .map((c) => c.idx)
}

export function getFootnoteColumn(page: Page): number | null {
  const idx = page.columns.findIndex((c) => c.def.type === 'footnote')
  return idx >= 0 ? idx : null
}

export function isPageEmpty(page: Page): boolean {
  return page.columns.every((c) => c.nodes.length === 0)
}

export function getColumnText(page: Page, colIdx: number): string {
  const col = page.columns[colIdx]
  if (!col) return ''
  return col.nodes
    .map((n) => n.text || '')
    .join('\n')
}
