import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { type ContentNode, type LayoutId } from '../types'
import { detectDirective, isDirectiveComment } from './directives'

// <!-- style:"..." --> CSS patch 註解
const STYLE_RE = /<!--\s*style:\s*"([^"]+)"\s*-->/i

/** 剖析走訪上下文 */
type WalkContext = {
  pendingStyle: string | null
}

/** 剖析結果：ContentNode 節點串流 */
export type ParseResult = {
  nodes: ContentNode[]
}

/**
 * 將 Markdown 字串剖析為 ContentNode 串流，
 * 支援段落、標題、註腳、GFM 表格，以及 HTML 註解指令。
 */
export function parseMarkdown(markdown: string): ParseResult {
  const nodes: ContentNode[] = []
  const ctx: WalkContext = { pendingStyle: null }

  const processor = remark().use(remarkGfm)
  const root = processor.parse(markdown)
  walkNodes(root, nodes, ctx)

  return { nodes }
}

/** 遞迴走訪 MDAST，將感興趣的節點轉換為 ContentNode */
function walkNodes(node: any, nodes: ContentNode[], ctx: WalkContext) {
  // 段落：合併子文字節點，抽出註腳引用
  if (node.type === 'paragraph') {
    extractParagraphChildren(node, nodes, ctx)
    return
  }

  // 標題：取純文字內容
  if (node.type === 'heading') {
    if (node.children) {
      const firstText = extractText(node)
      if (firstText.trim()) {
        nodes.push({ type: 'heading', level: node.depth, text: firstText.trim() })
      }
    }
    return
  }

  // 區塊引用（blockquote）：合併各子段落為單一 quote 節點
  if (node.type === 'blockquote') {
    if (node.children) {
      const texts: string[] = []
      for (const child of node.children) {
        if (child.type === 'paragraph' || child.type === 'heading') {
          const text = extractText(child)
          if (text.trim()) texts.push(text.trim())
        } else if (child.children) {
          walkNodes(child, nodes, ctx)
        }
      }
      if (texts.length > 0) {
        const quote: any = { type: 'quote', text: texts.join('\n') }
        if (ctx.pendingStyle) {
          quote.style = ctx.pendingStyle
          ctx.pendingStyle = null
        }
        nodes.push(quote)
      }
    }
    return
  }

  // HTML 註解指令：版面切換 / 分頁 / 分欄，以及 style patch
  if (node.type === 'html') {
    if (isDirectiveComment(node.value)) {
      const directive = detectDirective(node.value)
      if (directive) nodes.push(directive)
    } else {
      const styleMatch = node.value.match(STYLE_RE)
      if (styleMatch) {
        ctx.pendingStyle = styleMatch[1]!
      }
    }
    return
  }

  // 註腳引用 [^id]
  if (node.type === 'footnoteReference') {
    nodes.push({ type: 'footnote_ref', id: node.identifier })
    return
  }

  // 註腳定義 [^id]: content
  if (node.type === 'footnoteDefinition') {
    const text = extractText(node)
    nodes.push({
      type: 'footnote_def',
      id: node.identifier,
      text: text.trim(),
    })
    return
  }

  // 水平線（忽略，不做任何事）
  if (node.type === 'thematicBreak') {
    return
  }

  // 其他容器節點（如區塊引用、列表）→ 繼續遞迴
  if (node.children) {
    for (const child of node.children) {
      walkNodes(child, nodes, ctx)
    }
  }
}

/**
 * 剖析段落的子節點：
 * - 純文字合併到 textBuffer
 * - 註腳引用在行內插入 [id] 標記，並另外產生 footnote_ref 節點
 */
function extractParagraphChildren(node: any, nodes: ContentNode[], ctx: WalkContext) {
  if (!node.children || node.children.length === 0) return

  let textBuffer = ''
  const refIds: string[] = []

  for (const child of node.children) {
    if (child.type === 'text') {
      textBuffer += child.value
    } else if (child.type === 'footnoteReference') {
      textBuffer += `[${child.identifier}]`
      refIds.push(child.identifier)
    } else if (child.type === 'emphasis') {
      textBuffer += `*${extractText(child)}*`
    } else if (child.type === 'strong') {
      textBuffer += `**${extractText(child)}**`
    } else if (child.type === 'html' && /^<br\s*\/?>$/i.test(child.value)) {
      textBuffer += '\n'
    } else {
      textBuffer += extractText(child)
    }
  }

  if (textBuffer.trim()) {
    const pn: any = { type: 'paragraph', text: textBuffer.trim(), refIds }
    if (ctx.pendingStyle) {
      pn.style = ctx.pendingStyle
      ctx.pendingStyle = null
    }
    nodes.push(pn)
  }
  // 在段落之後放入對應的 footnote_ref（非行內嵌入）
  for (const id of refIds) {
    nodes.push({ type: 'footnote_ref', id })
  }
}

/** 遞迴萃取節點及其子節點的全部純文字 */
function extractText(node: any): string {
  let result = ''
  if (node.type === 'text') {
    return node.value || ''
  }
  if (node.type === 'html' && /^<br\s*\/?>$/i.test(node.value)) {
    return '\n'
  }
  if (node.type === 'footnoteReference') {
    return ''
  }
  if (node.children) {
    for (const child of node.children) {
      result += extractText(child)
    }
  }
  return result
}
