import { join } from 'path'
import type { TemplateRegistry, TemplatePackage, PageDimensions } from '../types'

const LAYOUT_FILES = ['layout-a.html', 'layout-b.html', 'layout-c.html']

function parseCssDimensions(css: string): PageDimensions {
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/s)
  if (!rootMatch) throw new Error('Missing :root block in base CSS')

  const root = rootMatch[1]!

  const getVal = (name: string): string => {
    const m = root.match(new RegExp(`--${name}:\\s*([^;]+)`))
    if (!m) throw new Error(`CSS variable --${name} not found in :root`)
    return m[1]!.trim()
  }

  const parsePt = (v: string): number => parseFloat(v.replace(/pt$/, ''))
  const parseMm = (v: string): number => parseFloat(v.replace(/mm$/, ''))
  const mmToPt = (mm: number): number => Math.round(mm * 72 / 25.4)

  const widthMm = parseMm(getVal('page-width'))
  const heightMm = parseMm(getVal('page-height'))

  return {
    widthPt: mmToPt(widthMm),
    heightPt: mmToPt(heightMm),
    widthMm,
    heightMm,
    marginTopPt: parsePt(getVal('margin-top')),
    marginBottomPt: parsePt(getVal('margin-bottom')),
    marginInnerPt: parsePt(getVal('margin-inner')),
    marginOuterPt: parsePt(getVal('margin-outer')),
  }
}

function extractCss(html: string): string {
  return html.match(/<style>([\s\S]*?)<\/style>/)?.[1]?.trim() ?? ''
}

function stripStyleTag(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').trim()
}

function extractLayoutId(html: string): string {
  return html.match(/data-layout="([^"]+)"/)?.[1] ?? ''
}

export async function loadTemplates(templateDir: string):
  Promise<{ registry: TemplateRegistry; dimensions: PageDimensions }> {
  const baseCss = await Bun.file(join(templateDir, 'base.css')).text()

  const templates: Record<string, TemplatePackage> = {}
  const allCssParts: string[] = [baseCss]

  for (const file of LAYOUT_FILES) {
    const raw = await Bun.file(join(templateDir, file)).text()

    const css = extractCss(raw)
    const pageHtml = stripStyleTag(raw)
    const id = extractLayoutId(raw)

    templates[id] = {
      id,
      pageHtml,
      css,
    }

    allCssParts.push(css)
  }

  const combinedCss = allCssParts.join('\n')

  return {
    registry: { baseCss, combinedCss, templates },
    dimensions: parseCssDimensions(baseCss),
  }
}
