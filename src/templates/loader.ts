import { resolve, join } from 'path'
import type { TemplateRegistry, TemplatePackage, PageDimensions } from '../types'

const PACKAGE_DIRS = ['layout-a', 'layout-b']

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

export async function loadTemplates(templateDir: string):
  Promise<{ registry: TemplateRegistry; dimensions: PageDimensions }> {
  const baseCss = await Bun.file(join(templateDir, 'base', 'style.css')).text()

  const templates: Record<string, TemplatePackage> = {}
  const allCssParts: string[] = [baseCss]

  for (const dir of PACKAGE_DIRS) {
    const dirPath = join(templateDir, dir)
    const manifest = await Bun.file(join(dirPath, 'manifest.json')).json()
    const pageHtml = await Bun.file(join(dirPath, 'page.html')).text()
    const css = await Bun.file(join(dirPath, 'style.css')).text()
    templates[manifest.id] = {
      id: manifest.id,
      pageHtml,
      css,
      manifest,
    }

    allCssParts.push(css)
  }

  const combinedCss = allCssParts.join('\n')

  return {
    registry: { baseCss, combinedCss, templates },
    dimensions: parseCssDimensions(baseCss),
  }
}
