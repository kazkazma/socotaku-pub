import { type ContentNode } from '../types'

// <!-- layout: A|B|C --> 切換版面
const LAYOUT_RE = /<!--\s*layout\s*:\s*(A|B|C)\s*-->/i
// <!-- page-break --> 強制分頁
const PAGE_BREAK_RE = /<!--\s*page-break\s*-->/i
// <!-- column-break --> 強制分欄
const COLUMN_BREAK_RE = /<!--\s*column-break\s*-->/i

/**
 * 剖析 HTML 註解指令，回傳對應的 ContentNode/null
 */
export function detectDirective(html: string): ContentNode | null {
  const layoutMatch = html.match(LAYOUT_RE)
  if (layoutMatch) {
    const layout = layoutMatch[1]
    if (!layout) return null
    return {
      type: 'layout_switch',
      layout: layout.toUpperCase() as 'A' | 'B' | 'C',
    }
  }

  if (PAGE_BREAK_RE.test(html)) {
    return { type: 'page_break' }
  }

  if (COLUMN_BREAK_RE.test(html)) {
    return { type: 'column_break' }
  }

  return null
}

/** 判斷是否為支援的指令註解（供快速過濾用） */
export function isDirectiveComment(html: string): boolean {
  return LAYOUT_RE.test(html) || PAGE_BREAK_RE.test(html) || COLUMN_BREAK_RE.test(html)
}
