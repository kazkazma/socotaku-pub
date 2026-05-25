# Socotaku 裝幀排版工具 — 專案規劃書

## 專案定位

TypeScript + Bun 命令列工具，輸入 Markdown 稿件，套用特定已知版型，輸出 PDF。

### 目標讀者
- 評論集、散文集等純文字為主的書籍
- 版型 A：二欄內文 + 腳註欄（直排）
- 版型 B：三欄純內文（直排）
- 版型 C：三欄內文 + Endnote（直排）

### 核心流程

```
Markdown + HTML 註解指令
        │
        ▼
    Parser（解析內容與版型指令）
        │
        ▼
    Page Composer（分頁引擎：切割內容到各欄各頁）
        │
        ▼
    Renderer（每頁 HTML → Puppeteer → PDF）
```

---

## 版型規格

### 共同設定

| 項目 | 數值 |
|------|------|
| 開本 | JIS B5（182 × 257mm） |
| 書寫方向 | 直排（vertical-rl） |
| 內/外/上/下 | 80pt / 61pt / 61pt / 61pt |
| 內文字級 | 11pt |
| 內文字型 | Noto Serif TC |
| 行間距 | 19.8pt（1.8 倍） |
| 字距 | 0.7pt |
| 每欄容量 | ~18 行 × 16 字 |
| 引文字型 | 標楷體, Times New Roman |
| H2 標題 | 14pt |
| 頁碼 | 左右交錯，離地 72pt |

### 版型 A — 二欄 + 腳註

```
┌──────────────────────┐
│    天  61pt          │
├──────────────────────┤
│  上欄  187pt (16字)  │  ← 內文
├──────────────────────┤
│  欄間距  22pt        │
├──────────────────────┤
│  中欄  187pt (16字)  │  ← 內文
├──────────────────────┤
│  與腳註欄間距  44pt  │
├──────────────────────┤
│  腳註欄  167pt       │  ← 9pt 腳註
├──────────────────────┤
│    地  61pt          │
└──────────────────────┘
```

**求和驗算**：61 + 187 + 22 + 187 + 44 + 167 + 61 = 729pt ≈ 257mm ✓

### 版型 B — 三欄純內文

```
┌──────────────────────┐
│    天  61pt          │
├──────────────────────┤
│  欄1  187pt (16字)   │  ← 內文
├──────────────────────┤
│  欄間距  22pt        │
├──────────────────────┤
│  欄2  187pt (16字)   │  ← 內文
├──────────────────────┤
│  欄間距  22pt        │
├──────────────────────┤
│  欄3  187pt (16字)   │  ← 內文
├──────────────────────┤
│    地  61pt          │
└──────────────────────┘
```

### 版型 C — 三欄純內文 + Endnote 模式

與版型 B 結構相同，但 `data-role="endnote"` 標記告訴 renderer 將腳註定義渲染為文末注（endnote）段落而非頁尾腳註。

```
┌──────────────────────┐
│    天  61pt          │
├──────────────────────┤
│  欄1  187pt (16字)   │  ← 內文
├──────────────────────┤
│  欄間距  22pt        │
├──────────────────────┤
│  欄2  187pt (16字)   │  ← 內文
├──────────────────────┤
│  欄間距  22pt        │
├──────────────────────┤
│  欄3  187pt (16字)   │  ← 內文 / Endnote
├──────────────────────┤
│    地  61pt          │
└──────────────────────┘
```

---

## 輸入格式

### HTML 註解指令

全部以 `<!-- ... -->` 控制，純 Markdown 預覽時完全隱藏。

```markdown
<!-- layout: A -->
<!-- title: 第一章 我的評論 -->

內文內文[^fn1]...

<!-- page-break -->

## H2 標題

下一頁內容...

[^fn1]: 這是腳註內容說明。
```

### 支援的指令

| 指令 | 範例 | 用途 |
|------|------|------|
| `<!-- layout: A -->` | 切換至版型 A | 可在一本書中任意切換 |
| `<!-- layout: B -->` | 切換至版型 B | 無腳註的三欄模式 |
| `<!-- layout: C -->` | 切換至版型 C | 三欄 + endnote 模式 |
| `<!-- page-break -->` | 強制換頁 | 從下一頁開始接續內容 |
| `<!-- column-break -->` | 強制換欄 | 當前欄結束，跳到下一欄 |
| `<!-- title: ... -->` | 設定章節標題（對應 H1） | 尚未實作 |

### 腳註語法

- 標準 Markdown 腳註 `[^fn]` / `[^fn]: 內容`
- 腳註內容收集後填入該頁的腳註欄
- 若腳註內容超過腳註欄高度，溢到下一頁的腳註欄繼續

---

## 目錄結構

```
socotaku-pub/
├── PLANNING.md              ← 本文件（開發規格書）
├── content/                 ← Markdown 稿件目錄
│   ├── 00-intro.md          ← 範例稿件（Layout A）
│   └── 01-chapter.md        ← 範例稿件（Layout B → C）
├── templates/               ← 版型 HTML + CSS
│   ├── base.css             ← 共同樣式（字型、行距、顏色）
│   ├── layout-a.html        ← 版型 A：二欄+腳註（DOM + 內嵌樣式）
│   ├── layout-b.html        ← 版型 B：三欄
│   └── layout-c.html        ← 版型 C：三欄 + Endnote
├── src/
│   ├── index.ts             ← CLI 入口
│   ├── parser/              ← Markdown 解析模組
│   │   ├── index.ts         ← parse() 主函式
│   │   └── directives.ts    ← 解析 HTML 註解指令
│   ├── types/
│   │   └── index.ts         ← 共用型別定義
│   ├── composer/            ← 分頁引擎（瀏覽器端執行）
│   │   ├── index.ts         ← BrowserComposer class（Puppeteer orchestrator）
│   │   ├── browser-compose.ts  ← 排版演算法（Bun.build → IIFE，注入瀏覽器）
│   │   └── page-builder.ts  ← 單頁組成邏輯（Node.js 端輔助）
│   ├── renderer/            ← 渲染與輸出
│   │   ├── index.ts         ← 匯出
│   │   ├── page-html.ts     ← 單頁→HTML template 拼接
│   │   └── pdf.ts           ← Puppeteer → PDF
│   ├── templates/
│   │   └── loader.ts        ← 載入 templates/*.html、base.css
│   └── browser/
│       └── puppeteer.ts     ← Puppeteer launch/viewport/font 工具
├── output/                  ← PDF 輸出目錄
├── package.json
├── tsconfig.json
└── README.md
```

---

## 模組職責

### 1. Parser（`src/parser/`）

```
輸入：Markdown 字串
輸出：{
  directives: Directive[]     → layout switch, page-break
  content: ContentNode[]      → 段落、標題、腳註標記、腳註定義
}
```

使用 `remark` 生態系：
- `remark-parse` — Markdown → MDAST
- `remark-html-comment` 或自訂 plugin — 解析 `<!-- ... -->`
- 轉換 MDAST 為自訂的 `ContentNode[]`

ContentNode 型別：
```typescript
type ContentNode =
  | { type: 'paragraph'; text: string; continues?: boolean; fnRefs?: FnRef[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'footnote_ref'; id: string; displayId?: string }
  | { type: 'footnote_def'; id: string; text: string; displayId?: string }
  | { type: 'page_break' }
  | { type: 'column_break' }
  | { type: 'layout_switch'; layout: 'A' | 'B' | 'C' }
```

### 2. Types（`src/types/`）

共用型別定義：

```typescript
// 欄位配置（無 heightPt/afterGapPt，由模板 CSS + PageDimensions 控制）
type ColumnDef = {
  id: string
  type: 'body' | 'footnote'
}

// 版型
type LayoutDef = {
  id: LayoutId
  columns: ColumnDef[]
}

// 單頁
type Page = {
  layoutId: LayoutId
  columns: PageColumn[]
}

type PageColumn = {
  def: ColumnDef
  nodes: ContentNode[]
}

// 腳註參照
type FnRef = {
  refId: string     // 加檔案前綴避免衝突
  displayId: string // 原始 id，用於顯示
}
```

### 3. Composer（`src/composer/`）

分頁引擎在 Puppeteer 瀏覽器內執行。

```
Node.js 端：BrowserComposer class
  - create() → 啟動瀏覽器、Bun.build(browser-compose.ts)、注入頁面
  - compose() → page.evaluate() 呼叫瀏覽器端的排版函式
  - close() → 關閉瀏覽器

瀏覽器端：browser-compose.ts
  - 被 Bun.build 打包為 IIFE，掛在 window.browserCompose
  - 直接操作真實 DOM 量測文字高度與 overflow
  - 貪婪演算法：逐節點填入當前欄，overflow 則 splitAt()
```

演算法：
```
for each node in ContentNode[]:
  if node 是 page_break → 完成當前頁 → 建立新頁面
  if node 是 column_break → 強制換欄
  if node 是 layout_switch → 更新 currentTemplate
  if node 是 body 節點（paragraph, heading）:
    嘗試放入當前欄（append DOM → 檢查 overflow）
    if overflow → tryPlaceAndSplit():
      二分搜尋 + DOM 操作找到切割點
      前半放入當前欄，後半加入 queue 處理
      若所有欄已滿 → 換頁
  if node 是 footnote_ref:
    記錄 refId → refsPerPage 收集區
  if node 是 footnote_def:
    暫存於 defMap
頁面結束時 → placeFootnotes() 填入腳註欄
```

**splitAt()**：直接在 DOM 中進行二分搜尋。

```typescript
function splitAt(text: string, colEl: HTMLElement, nodeType: string, node?: any): [string, string] {
  // 在 colEl 中建臨時元素
  // 每次插入前半段文字 → 檢查 overflow
  // 二分逼近直到找到最長不溢出長度
  // 移除臨時元素
  return [firstPart, remainder]
}
```

注意事項：
- 使用 `writing-mode: vertical-rl` 真實直排
- 等 `document.fonts.ready` 後才開始
- 每個欄位的 font-size 由模板 CSS 決定
- 支援孤兒行預防（保留至少 2 行在當前頁）

### 4. Renderer（`src/renderer/`）

Page → HTML → PDF（獨立函式）：

```typescript
// Page[] → 拼接成完整的 HTML
function buildPageHtml(pages: Page[], dimensions: PageDimensions, cssContent?: string): { html: string }

// HTML → PDF（Puppeteer）
async function renderPdf(html: string, outputPath: string, dimensions: PageDimensions): Promise<void>
```

**page-html.ts**：
- 從 `templates/` 載入版型 HTML（含嵌入 `<style>`）
- 每頁獨立 `<div class="page">`，交替 left/right margins
- 直排 `writing-mode: vertical-rl`
- 腳註標記渲染為 SVG circle badges（inline SVG）
- 頁碼 `data-page-number` 離地 72pt

**pdf.ts**：
- Puppeteer 啟動 headless Chromium
- `page.setContent()` 載入 HTML
- `page.pdf()` 輸出 PDF（尺寸參數由 `PageDimensions` 計算）
- 字型依賴系統安裝或 `@font-face`

---

## 技術棧

| 工具 | 用途 |
|------|------|
| **Bun** | Runtime + 套件管理 + 打包（`Bun.build`） |
| **TypeScript** | 開發語言 |
| **Puppeteer** | Headless Chromium → PDF 輸出 |
| **remark** + **remark-gfm** | Markdown 解析（含 GFM 腳註） |
| **TypeScript types** | 專案型別定義 |

---

## 開發階段

### Phase 1 — 核心管道（本階段完成）

```
Markdown → Parser → Composer → Renderer → PDF
```

1. ✅ 建立專案結構與套件
2. ✅ 實作 Parser（Markdown + `<!-- -->` 指令解析）
3. ✅ 實作型別定義（Layout、ContentNode、Page、FnRef）
4. ✅ 實作 Composer（瀏覽器端分頁演算法）
5. ✅ 實作 Renderer（HTML 模板 + Puppeteer PDF）
6. ✅ 整合 CLI 指令
7. ⬜ 測試：範例稿件產出 PDF

### Phase 2 — 預覽與反覆
- 開發預覽伺服器（即時看到排版結果）
- 支援 `bun --watch`
- CSS 微調迭代

### Phase 3 — 進階功能
- 插圖支援
- 外部 book.yaml 控制
- 字距行級微調
- 出血設定

---

## 開發指令

```bash
bun install                 # 安裝相依套件
bun run src/index.ts        # 執行
bun run --watch src/index.ts # 開發模式

bun add puppeteer           # 新增 Puppeteer
bun add remark remark-gfm   # 新增 Markdown 解析
```

---

## 備註

- 本專案目標是「部分替代 Adobe InDesign」——針對已知版型自動化排版
- 不追求通用排版軟體的所有功能
- 優先確保：直排品質、字距精準、腳註對應、跨頁流暢
