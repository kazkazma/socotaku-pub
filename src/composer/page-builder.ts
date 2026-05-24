import { type Page, type LayoutDef, type ContentNode } from '../types'

// 根據版面定義建立空白頁面
export function createPage(layout: LayoutDef): Page {
  return {
    layoutId: layout.id,
    columns: layout.columns.map((def) => ({
      def,
      nodes: [],
    })),
  }
}

// 取得所有正文欄的索引
export function getBodyColumns(page: Page): number[] {
  return page.columns
    .map((c, i) => ({ type: c.def.type, idx: i }))
    .filter((c) => c.type === 'body')
    .map((c) => c.idx)
}

// 取得註腳欄索引（若無則回傳 null）
export function getFootnoteColumn(page: Page): number | null {
  const idx = page.columns.findIndex((c) => c.def.type === 'footnote')
  return idx >= 0 ? idx : null
}

// 檢查頁面是否完全空白
export function isPageEmpty(page: Page): boolean {
  return page.columns.every((c) => c.nodes.length === 0)
}

// 取得指定欄位的節點列表（安全存取，越界回傳 []）
export function getColumnNodes(page: Page, colIdx: number): ContentNode[] {
  return page.columns[colIdx]?.nodes ?? []
}

// 將指定欄位的文字串接為單一字串（僅段落/標題/註腳定義有 text）
export function getColumnText(page: Page, colIdx: number): string {
  const col = page.columns[colIdx]
  if (!col) return ''
  return col.nodes
    .map((n) => ('text' in n ? n.text : ''))
    .join('\n')
}
