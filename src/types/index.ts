// ============================================================
// 1. 頁面尺寸與邊距（無外部依賴）
// ============================================================

/** 頁面尺寸與邊距（同時包含 pt 與 mm 單位） */
export type PageDimensions = {
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  marginTopPt: number;
  marginBottomPt: number;
  marginInnerPt: number;
  marginOuterPt: number;
};

// ============================================================
// 2. 欄位與版面定義
// ============================================================

/** 欄位類型：正文欄或註腳欄 */
export type ColumnType = "body" | "footnote";

/** 欄位定義：識別 ID 與類型 */
export type ColumnDef = {
  id: string;
  type: ColumnType;
};

/** 版面 ID（字串別名） */
export type LayoutId = string;

/** 版面定義：版面 ID + 組成欄位 */
export type LayoutDef = {
  id: LayoutId;
  columns: ColumnDef[];
};

// ============================================================
// 3. 內容節點（Discriminated Union）
// ============================================================

/** 內容節點類型列舉 */
export type ContentType =
  | "paragraph"       // 段落
  | "heading"         // 標題
  | "footnote_ref"    // 註腳引用標記（正文中的 [n]）
  | "footnote_def"    // 註腳定義內容
  | "page_break"      // 分頁指令
  | "column_break"    // 分欄指令
  | "layout_switch";  // 切換版面指令

/** 基底節點（共用 type 欄位） */
type BaseNode = { type: ContentType };

/** 註腳引用資訊 */
export type FnRef = {
  refId: string;     // 內部唯一識別碼（跨檔案前綴後）
  displayId: string; // 顯示用編號
};

/** 段落節點：含純文字內容 */
type ParagraphNode = BaseNode & {
  type: "paragraph";
  text: string; // 段落文字
  continues?: boolean; // 自動分欄/分頁拆段後，此片段後方仍接續同一原始段落
  refIds?: string[]; // 原始註腳識別碼（parser 階段用）
  fnRefs?: FnRef[]; // 段落中的註腳引用（refId → displayId）
};

/** 標題節點：含文字與層級 */
type HeadingNode = BaseNode & {
  type: "heading";
  text: string;   // 標題文字
  level: number;  // 標題層級（1-6）
};

/** 註腳引用：標記正文中的 [n] */
type FootnoteRefNode = BaseNode & {
  type: "footnote_ref";
  id: string;         // 內部唯一識別碼
  displayId?: string; // 顯示用編號（跨檔案時與 id 分離）
};

/** 註腳定義：對應 [^id] 的定義內容 */
type FootnoteDefNode = BaseNode & {
  type: "footnote_def";
  id: string;         // 內部唯一識別碼
  text: string;       // 定義文字
  displayId?: string; // 顯示用編號（跨檔案時與 id 分離）
};

/** 分頁指令（無承載資料） */
type PageBreakNode = BaseNode & { type: "page_break" };

/** 分欄指令（無承載資料） */
type ColumnBreakNode = BaseNode & { type: "column_break" };

/** 版面切換指令：指定目標版面 ID */
type LayoutSwitchNode = BaseNode & {
  type: "layout_switch";
  layout: LayoutId; // 目標版面 ID（A / B / C）
};

/** 內容節點：排版引擎的基本處理單元（discriminated union） */
export type ContentNode =
  | ParagraphNode
  | HeadingNode
  | FootnoteRefNode
  | FootnoteDefNode
  | PageBreakNode
  | ColumnBreakNode
  | LayoutSwitchNode;

// ============================================================
// 4. 樣板系統
// ============================================================

/** 單一樣板套件：HTML 結構 + CSS */
export type TemplatePackage = {
  id: string;
  pageHtml: string;
  css: string;
};

/** 樣板登錄表：彙整所有樣板與 CSS */
export type TemplateRegistry = {
  baseCss: string;
  combinedCss: string;
  templates: Record<string, TemplatePackage>;
};

// ============================================================
// 5. 頁面資料結構
// ============================================================

/** 頁面中的一個欄位：定義 + 已分配的節點 */
export type PageColumn = {
  def: ColumnDef;
  nodes: ContentNode[];
};

/** 頁面 slot：保留 .page direct child 的原始順序 */
export type PageSlot =
  | { type: "column"; index: number }
  | { type: "static"; html: string };

/** 單一頁面：所採用的版面 ID + 各欄內容 */
export type Page = {
  layoutId: LayoutId;
  columns: PageColumn[];
  slots?: PageSlot[];
};
