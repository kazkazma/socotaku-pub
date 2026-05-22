import { type ContentNode } from '../types'

const LAYOUT_RE = /<!--\s*layout\s*:\s*(A|B)\s*-->/i
const PAGE_BREAK_RE = /<!--\s*page-break\s*-->/i

export function detectDirective(html: string): ContentNode | null {
  if (LAYOUT_RE.test(html)) {
    const match = html.match(LAYOUT_RE)!
    return {
      type: 'layout_switch',
      layout: match[1].toUpperCase() as 'A' | 'B',
    }
  }

  if (PAGE_BREAK_RE.test(html)) {
    return { type: 'page_break' }
  }

  return null
}

export function isDirectiveComment(html: string): boolean {
  return LAYOUT_RE.test(html) || PAGE_BREAK_RE.test(html)
}
