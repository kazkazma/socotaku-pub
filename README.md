# socotaku-pub

`socotaku-pub` 當前是一個特化用於繁體中文直排評論刊物的發布工具。

它讓作者與編輯使用 Markdown 管理稿件，使用 HTML/CSS 管理版型，並透過瀏覽器實際測量直排欄位，輸出可校稿的 HTML 與可送印前處理的 PDF。

## 專案定位

本專案支援具有紙本排版需求的刊物製作流程，而不是將 Markdown 直接轉成一般文件 PDF。

核心需求包含：

- 多篇 Markdown 稿件合併成單一刊物
- 繁體中文直排
- 多欄排版
- 頁下注為主的註腳系統
- 可切換的客製版型
- 圖片欄與特殊頁面
- 強制分頁、分欄與局部樣式調整
- 輸出 HTML 與 PDF 供校稿、排版檢查與後續印刷流程使用

## 適用情境

本工具適合用於：

- 動漫、評論、研究向小報
- 同人誌或活動刊物
- 多作者文章集合
- 需要保留 Markdown 寫作流程，但又需要較細緻紙本排版控制的出版品

## 輸入與輸出

主要輸入：

- `content/*.md`：刊物稿件
- `content/img/*`：稿件圖片
- `templates/base.css`：全域紙張、字體、直排與頁面樣式
- `templates/layout-*.html`：頁面版型

主要輸出：

- `output/output.html`
- `output/output.pdf`

目前文章順序由 `content/*.md` 的檔名排序決定。多個 Markdown 檔案會合併成一本刊物，檔案之間會自動插入分頁。

## 基本使用

安裝依賴：

```sh
bun install
```

產生 HTML 與 PDF：

```sh
bun run start
```

開發時可使用 watch mode：

```sh
bun run dev
```

## 稿件格式

稿件放在 `content/` 目錄下，副檔名為 `.md`。

目前支援的主要內容包含：

- 標題
- 段落
- 引用
- 圖片
- 註腳
- 粗體與斜體標記
- `<br>` 換行

稿件中也可以使用 HTML 註解形式的排版指令，例如切換版型、強制分頁、強制分欄與局部樣式調整。

詳細格式見：

- `docs/markdown-format.md`

## 版型格式

版型放在 `templates/` 目錄下，檔名需符合 `layout-*.html`。

每個版型透過 HTML 定義頁面中的欄位，並透過 `data-column-kind` 標記欄位用途。

目前支援的欄位類型包含：

- `body`：正文欄
- `footnote`：頁下注欄
- `pic`：圖片欄

詳細格式見：

- `docs/template-format.md`

## 目前限制

目前本專案仍以繁體中文直排評論刊物的製作流程為主要開發目標。

目前固定使用：

- `content/` 作為稿件目錄
- `templates/` 作為版型目錄
- `output/output.html` 作為 HTML 輸出
- `output/output.pdf` 作為 PDF 輸出

列表、表格與更複雜的 Markdown 結構目前不應視為穩定支援功能。

本專案的輸出 PDF 可作為校稿與送印前處理基礎，但實際印刷規格仍需依印務需求檢查。

## 非目標

本專案不是：

- 一般用途的 Markdown PDF 產生器
- 網站產生器
- 完整替代 InDesign、Affinity Publisher 等 DTP 軟體的工具
- 所有語言、所有書寫方向皆通用的排版引擎

本專案優先服務的是繁體中文直排刊物，以及需要在 Markdown 寫作流程與紙本排版控制之間取得平衡的出版需求。
