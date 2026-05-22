export type ColumnType = 'body' | 'footnote'

export type ColumnDef = {
  id: string
  type: ColumnType
  heightPt: number
}

export type LayoutId = 'A' | 'B'

export type LayoutDef = {
  id: LayoutId
  columns: ColumnDef[]
}

export const LAYOUT_A: LayoutDef = {
  id: 'A',
  columns: [
    { id: 'top', type: 'body', heightPt: 187 },
    { id: 'middle', type: 'body', heightPt: 187 },
    { id: 'bottom', type: 'footnote', heightPt: 167 },
  ],
}

export const LAYOUT_B: LayoutDef = {
  id: 'B',
  columns: [
    { id: 'col1', type: 'body', heightPt: 187 },
    { id: 'col2', type: 'body', heightPt: 187 },
    { id: 'col3', type: 'body', heightPt: 187 },
  ],
}

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  A: LAYOUT_A,
  B: LAYOUT_B,
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
