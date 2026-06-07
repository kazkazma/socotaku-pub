import { join } from "path";
import { Glob } from "bun";
import type {
  TemplateRegistry,
  TemplatePackage,
  PageDimensions,
} from "../types";

/** 動態掃描 templates/ 下所有 layout-*.html */
async function findLayoutFiles(templateDir: string): Promise<string[]> {
  const glob = new Glob("layout-*.html");
  const files: string[] = [];
  for await (const file of glob.scan(templateDir)) {
    files.push(file);
  }
  return files.sort();
}

/**
 * 從 base.css 的 :root 變數中解析頁面尺寸與邊距
 * 全部以 mm 為單位（字級 pt 除外）
 */
function parseCssDimensions(css: string): PageDimensions {
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/s);
  if (!rootMatch) throw new Error("Missing :root block in base CSS");

  const root = rootMatch[1]!;

  const getVal = (name: string): string => {
    const m = root.match(new RegExp(`--${name}:\\s*([^;]+)`));
    if (!m) throw new Error(`CSS variable --${name} not found in :root`);
    return m[1]!.trim();
  };

  const parseMm = (v: string): number => {
    v = v.trim();
    if (v.endsWith("pt")) {
      return parseFloat(v) * 25.4 / 72;
    }
    return parseFloat(v.replace(/mm$/, ""));
  };

  return {
    widthMm: parseMm(getVal("page-width")),
    heightMm: parseMm(getVal("page-height")),
    marginTopMm: parseMm(getVal("margin-top")),
    marginBottomMm: parseMm(getVal("margin-bottom")),
    marginInnerMm: parseMm(getVal("margin-inner")),
    marginOuterMm: parseMm(getVal("margin-outer")),
  };
}

/** 從樣板 HTML 中萃取出 <style> 標籤內的 CSS */
function extractCss(html: string): string {
  return html.match(/<style>([\s\S]*?)<\/style>/)?.[1]?.trim() ?? "";
}

/** 移除 HTML 中的 <style> 標籤，留下純頁面結構 */
function stripStyleTag(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, "").trim();
}

/** 從檔名取得版面 ID（例如 "layout-a"） */
function layoutIdFromFilename(filePath: string): string {
  return filePath.replace(/\.html$/, "")
}

/**
 * 載入所有樣板：
 * - base.css → 全域 CSS + 尺寸變數
 * - layout-*.html → 動態掃描各版面 HTML 結構 + 各自 CSS
 * - 合併為 TemplateRegistry，並回解析出的 PageDimensions
 */
export async function loadTemplates(
  templateDir: string,
): Promise<{ registry: TemplateRegistry; dimensions: PageDimensions }> {
  const baseCss = await Bun.file(join(templateDir, "base.css")).text();

  const templates: Record<string, TemplatePackage> = {};
  const allCssParts: string[] = [baseCss];

  const layoutFiles = await findLayoutFiles(templateDir)

  for (const file of layoutFiles) {
    const raw = await Bun.file(join(templateDir, file)).text()

    const css = extractCss(raw)
    const pageHtml = stripStyleTag(raw)
    const id = layoutIdFromFilename(file)

    templates[id] = {
      id,
      pageHtml,
      css,
    }

    allCssParts.push(css)
  }

  const combinedCss = allCssParts.join("\n");

  return {
    registry: { baseCss, combinedCss, templates },
    dimensions: parseCssDimensions(baseCss),
  };
}
