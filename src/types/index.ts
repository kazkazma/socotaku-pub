export type ColumnType = 'body' | 'footnote'

export type ColumnDef = {
  id: string
  type: ColumnType
}

export type LayoutId = string

export type MeasureOptions = {
  heightPt: number
  blockExtentPt: number
  colType: ColumnType
  writingMode: 'vertical-rl' | 'horizontal-tb'
}

export type ContentType =
  | 'paragraph'
  | 'heading'
  | 'footnote_ref'
  | 'footnote_def'
  | 'page_break'
  | 'layout_switch'

export type ContentNode = {
  type: ContentType
  text?: string
  level?: number
  id?: string
  layout?: LayoutId
}

export type TemplateManifestColumn = {
  id: string
  type: ColumnType
  selector: string
}

export type TemplateManifest = {
  id: string
  name?: string
  columns: TemplateManifestColumn[]
}

export type TemplatePackage = {
  id: string
  pageHtml: string
  css: string
  manifest: TemplateManifest
}

export type TemplateRegistry = {
  baseCss: string
  combinedCss: string
  templates: Record<string, TemplatePackage>
}

export type PageColumn = {
  def: ColumnDef
  nodes: ContentNode[]
}

export type Page = {
  layoutId: LayoutId
  columns: PageColumn[]
}

export const PAGE_DIMENSIONS = {
  widthPt: 516,
  heightPt: 729,
  marginTopPt: 61,
  marginBottomPt: 61,
  marginInnerPt: 80,
  marginOuterPt: 61,
} as const

export const PAGE_CONTENT_WIDTH_PT =
  PAGE_DIMENSIONS.widthPt -
  PAGE_DIMENSIONS.marginInnerPt -
  PAGE_DIMENSIONS.marginOuterPt
