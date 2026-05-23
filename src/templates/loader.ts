import { resolve, join } from 'path'
import type { TemplateRegistry, TemplatePackage } from '../types'

const PACKAGE_DIRS = ['layout-a', 'layout-b']

export async function loadTemplates(templateDir: string): Promise<TemplateRegistry> {
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

  return { baseCss, combinedCss, templates }
}
