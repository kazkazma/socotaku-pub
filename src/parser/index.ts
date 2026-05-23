import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { type ContentNode, type LayoutId } from '../types'
import { detectDirective, isDirectiveComment } from './directives'

export type ParseResult = {
  nodes: ContentNode[]
}

export function parseMarkdown(markdown: string): ParseResult {
  const nodes: ContentNode[] = []

  const processor = remark().use(remarkGfm)
  const root = processor.parse(markdown)
  walkNodes(root, nodes)

  return { nodes }
}

function walkNodes(node: any, nodes: ContentNode[]) {
  if (node.type === 'paragraph') {
    extractParagraphChildren(node, nodes)
    return
  }

  if (node.type === 'heading') {
    if (node.children) {
      const firstText = extractText(node)
      if (firstText.trim()) {
        nodes.push({ type: 'heading', level: node.depth, text: firstText.trim() })
      }
    }
    return
  }

  if (node.type === 'html') {
    if (isDirectiveComment(node.value)) {
      const directive = detectDirective(node.value)
      if (directive) nodes.push(directive)
    }
    return
  }

  if (node.type === 'footnoteReference') {
    nodes.push({ type: 'footnote_ref', id: node.identifier })
    return
  }

  if (node.type === 'footnoteDefinition') {
    const text = extractText(node)
    nodes.push({
      type: 'footnote_def',
      id: node.identifier,
      text: text.trim(),
    })
    return
  }

  if (node.type === 'thematicBreak') {
    return
  }

  if (node.children) {
    for (const child of node.children) {
      walkNodes(child, nodes)
    }
  }
}

function extractParagraphChildren(node: any, nodes: ContentNode[]) {
  if (!node.children || node.children.length === 0) return

  let textBuffer = ''
  const refIds: string[] = []

  for (const child of node.children) {
    if (child.type === 'text') {
      textBuffer += child.value
    } else if (child.type === 'footnoteReference') {
      textBuffer += `[${child.identifier}]`
      refIds.push(child.identifier)
    } else {
      textBuffer += extractText(child)
    }
  }

  if (textBuffer.trim()) {
    nodes.push({ type: 'paragraph', text: textBuffer.trim() })
  }
  for (const id of refIds) {
    nodes.push({ type: 'footnote_ref', id })
  }
}

function extractText(node: any): string {
  let result = ''
  if (node.type === 'text') {
    return node.value || ''
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
