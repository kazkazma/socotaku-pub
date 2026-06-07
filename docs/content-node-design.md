# ContentNode 設計筆記

## 文件目的

本文記錄 ContentNode 與相關節點的設計方向，用於約束 Markdown 解析、排版輸入資料與未來功能擴充。

本文是設計筆記，不代表目前程式已完整實作。實作時應以本文作為演進方向，並避免一次性引入過度複雜的抽象。

## 核心原則

ContentNode 是排版引擎的內容輸入，不是原始 Markdown AST，也不是最終 DOM。

Parser 可以讀取並保存排版意圖，但不解析版型實體。

Composer 負責將內容節點中的排版意圖解析到目前 template 的實際 slot。

Patch directive 只存在於 parser 階段。送入 composer 前，patch 應被轉成 ContentNode 上的明確欄位。

## Node 分層

建議將排版輸入節點分為三類：

```ts
type DocumentNode =
  | ContentNode
  | FlowDirectiveNode

type ContentNode =
  | ParagraphNode
  | HeadingNode
  | QuoteNode
  | ImageNode
  | TableNode
  | ListNode
  | FootnoteDefNode

type FlowDirectiveNode =
  | PageBreakNode
  | ColumnBreakNode
  | LayoutSwitchNode

type PatchDirective =
  | StylePatchDirective
  | ImageSlotPatchDirective
```

`DocumentNode` 是送入 composer 的節點流。

`PatchDirective` 不應進入 `DocumentNode[]`。

## ContentNode

`ContentNode` 表示稿件中的內容資料。它可以被排入頁面，或作為排版過程中需要保存的稿件內容資訊。

目前可先保留既有 `text: string` 模型，避免同時牽動 inline renderer 與拆段演算法。但長期方向上，段落、標題與引用應逐步改為 inline children。

第一階段可維持：

```ts
type ParagraphNode = {
  type: "paragraph"
  text: string
  style?: string
}

type HeadingNode = {
  type: "heading"
  level: number
  text: string
  style?: string
}

type QuoteNode = {
  type: "quote"
  text: string
  style?: string
}
```

未來方向：

```ts
type ParagraphNode = {
  type: "paragraph"
  children: InlineNode[]
  style?: string
}
```

## FlowDirectiveNode

`FlowDirectiveNode` 是內容流中的排版控制節點，composer 需要看到並執行。

目前包含：

- `page_break`
- `column_break`
- `layout_switch`

這些節點會改變頁面、欄位或版型，不是某個內容節點的 metadata。

## PatchDirective

`PatchDirective` 表示從 Markdown HTML 註解讀取到的局部排版意圖。

Patch directive 不應送入 composer，而應在 parser 階段套用到下一個適用的 ContentNode。

目前設計包含：

- `style`：套用局部 CSS 到下一個可樣式化內容節點。
- `image-slot`：指定下一張圖片應進入的圖片 slot。

## Patch 裝載規則

Patch directive 應轉成 ContentNode 上的明確欄位。

例如：

```md
<!-- style:"padding-top:3em;" -->
# 標題
```

應轉成：

```ts
{
  type: "heading",
  level: 1,
  text: "標題",
  style: "padding-top:3em;"
}
```

例如：

```md
<!-- image-slot: main -->
![](img/example.png)
```

應轉成：

```ts
{
  type: "image",
  src: "...",
  alt: "",
  slotId: "main"
}
```

建議規則：

- `style` 套用到下一個 `ParagraphNode | HeadingNode | QuoteNode`。
- `image-slot` 套用到下一個 `ImageNode`。
- patch 只嘗試套用到下一個 content node；若不適用則失效。
- `FlowDirectiveNode` 會中斷 pending patch。
- 同類 patch 重複時，後者覆蓋前者。

未來可加入 warning，但第一階段以功能與資料模型清晰為優先。

## 不採用通用 Patches 槽位

不建議在所有 ContentNode 上加入：

```ts
patches?: PatchDirective[]
```

原因：

- composer 不應理解 Markdown patch directive。
- patch 語意應轉成明確欄位，例如 `style` 或 `slotId`。
- 通用 patches 槽位難以限制 patch 的適用對象。
- 容易形成第二套隱性排版語意。

## Slot 命名

版型中的內容填入位置應使用 slot 語彙，而不是 column 語彙。

設計方向：

```html
<div class="column body" data-slot-kind="body" data-slot-id="top"></div>
<div class="column footnote" data-slot-kind="footnote" data-slot-id="note"></div>
<div class="column pic" data-slot-kind="pic" data-slot-id="main"></div>
```

`data-slot-kind` 表示 slot 用途。

`data-slot-id` 表示 slot 識別。

`.column` 可保留為 CSS class，用於描述視覺排版樣式，但不再作為資料契約。

不保留 `data-column-kind` / `data-column-id` 相容。

## Page 結構命名

建議型別命名：

```ts
type SlotKind = "body" | "footnote" | "pic"

type SlotDef = {
  id: string
  kind: SlotKind
}

type PageContentSlot = {
  def: SlotDef
  nodes: ContentNode[]
}

type PageRenderChild =
  | { type: "slot"; index: number }
  | { type: "static"; html: string }

type Page = {
  layoutId: LayoutId
  slots: PageContentSlot[]
  children?: PageRenderChild[]
}
```

`Page.slots` 是頁面上可填入內容的 slot。

`Page.children` 保留頁面直屬子元素的 render 順序，包含內容 slot 與 static element。

## Image Slot

Markdown 端以 HTML 註解指定圖片 slot：

```md
<!-- image-slot: main -->
![](img/example.png)
```

Parser 只保存排版意圖：

```ts
type ImageNode = {
  type: "image"
  src: string
  alt?: string
  slotId?: string
}
```

Composer 才負責在目前 layout 中尋找：

```html
[data-slot-kind="pic"][data-slot-id="main"]
```

Parser 不應檢查 slot 是否存在，也不應知道 template 的 DOM 結構。

## InlineNode 演進方向

未來應逐步將 paragraph、heading、quote 的純文字內容改成 inline node tree。

第一批 inline node 可包含：

```ts
type InlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "strong"; children: InlineNode[] }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "footnote_ref"; id: string; displayId?: string }
```

這可移除目前以 `**`、`*`、`[n]` 字串標記再用 regex 轉回 HTML 的往返處理。

## 演進階段

### 第一階段

- 建立 `DocumentNode` / `ContentNode` / `FlowDirectiveNode` / `PatchDirective` 的責任邊界。
- 將 template contract 從 `data-column-*` 遷移到 `data-slot-*`。
- 保留目前 `text: string` 內容模型。
- 將 `style` 視為 parser 內部 patch directive。
- 新增 `image-slot` patch directive 的資料模型方向。
- `ImageNode` 加入 `slotId?: string`。

### 第二階段

- 導入最小 `InlineNode`。
- 將 footnote reference 從文字標記改為 inline node。
- 讓 composer 與 final renderer 共用 inline renderer。
- 調整拆段演算法，使其不破壞 inline node。

### 第三階段

- 加入 `TableNode`。
- 加入 `ListNode`。
- 支援 inline HTML 白名單。
- 討論 `<span>`、`<ruby>`、link 與 code 的輸出策略。

## 待後續處理

- 表格第一版的排版策略。
- 列表的資料模型與直排呈現策略。
- 正文流圖片。
- Markdown 超連結的紙本輸出策略。
- 稿件 metadata。
- 更完整的 parser warning/error 策略。
