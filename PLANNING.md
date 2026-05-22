# Socotaku 裝幀排版工具 — 專案規劃書

## 專案定位

TypeScript + Bun 命令列工具，輸入 Markdown 稿件，套用特定已知版型，輸出 PDF。

### 目標讀者
- 評論集、散文集等純文字為主的書籍
- 版型 A：二欄內文 + 腳註欄（直排）
- 版型 B：三欄純內文（直排）

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
    Renderer（每頁 HTML → Vivliostyle → PDF）
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
| `<!-- page-break -->` | 強制換頁 | 從下一頁開始接續內容 |
| `<!-- title: ... -->` | 設定章節標題（對應 H1） | 用於目錄 |

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
│   └── sample/
│       ├── book.md          ← 範例稿件
│       └── chapter1.md
├── templates/               ← 版型 CSS 樣式
│   ├── base.css             ← 共同樣式（字型、行距、顏色）
│   ├── layout-a.css         ← 版型 A：二欄+腳註
│   └── layout-b.css         ← 版型 B：三欄
├── src/
│   ├── index.ts             ← CLI 入口
│   ├── parser/              ← Markdown 解析模組
│   │   ├── index.ts         ← parse() 主函式
│   │   └── directives.ts    ← 解析 HTML 註解指令
│   ├── types/               ← 共用型別定義
│   │   ├── layout.ts        ← 版型、欄位、頁面型別
│   │   ├── content.ts       ← ContentNode、Directive 型別
│   │   └── index.ts         ← 匯出
│   ├── composer/            ← 分頁引擎
│   │   ├── index.ts         ← PageComposer class
│   │   ├── page-builder.ts  ← 單頁組成邏輯
│   │   └── measurer.ts      ← 隱藏 DOM 量高度
│   ├── renderer/            ← 渲染與輸出
│   │   ├── index.ts         ← render() 主函式
│   │   ├── page-html.ts     ← 單頁→HTML template 拼接
│   │   └── pdf.ts           ← Playwright → PDF
│   └── server/              ← 開發預覽伺服器（未來）
│       └── index.ts
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
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'footnote_ref'; id: string }          // [^fn1]
  | { type: 'footnote_def'; id: string; text: string }  // [^fn1]: ...
  | { type: 'page_break' }
  | { type: 'layout_switch'; layout: 'A' | 'B' }
```

### 2. Types（`src/types/`）

共用型別定義：

```typescript
// 欄位配置
type ColumnDef = {
  id: string
  type: 'body' | 'footnote'
  heightPt: number
  afterGapPt: number        // 與下一欄的間距
}

// 版型
type LayoutDef = {
  id: 'A' | 'B'
  columns: ColumnDef[]
}

// 單頁
type Page = {
  columns: PageColumn[]
}

type PageColumn = {
  def: ColumnDef
  nodes: ContentNode[]
}
```

### 3. Composer（`src/composer/`）

**PageComposer**：核心分頁引擎

```
輸入：ContentNode[] + LayoutDef
輸出：Page[]
```

演算法：
```
for each node in ContentNode[]:
  if node 是 page_break → 建立新頁面
  if node 是 layout_switch → 更新 LayoutDef
  if node 是 body 節點（paragraph, heading）:
    找當前頁面哪個 body 欄還有空間
    if 欄空間足夠 → 放入該欄
    else → 量測 node 高度，二分切割，前半塞入，後半留到下一欄/下一頁
  if node 是 footnote_ref:
    記錄到當前頁的腳註收集區
  if node 是 footnote_def:
    暫存，頁面結束時填入頁尾
```

**Measurer**：隱藏 DOM 量高度

```typescript
class Measurer {
  private container: HTMLElement  // 隱藏 div

  // 量測一段文字在指定欄位佔多少高度
  measure(text: string, columnHeight: number): number
  // 二分搜尋找到從哪裡切
  splitAt(text: string, maxHeight: number): [string, string]
}
```

注意事項：
- 必須等字型載入 `document.fonts.ready`
- 使用 `writing-mode: vertical-rl` 模擬直排
- 每個欄位獨立測量（不同字級 11pt vs 9pt、不同樣式）

### 4. Renderer（`src/renderer/`）

Page → HTML → PDF：

```typescript
class Renderer {
  // Page[] → 拼接成完整的 HTML
  renderToHtml(pages: Page[], layout: LayoutDef): string
  
  // HTML → PDF（Playwright）
  async renderToPdf(html: string, outputPath: string): Promise<void>
}
```

**page-html.ts** — 單頁 HTML 模板：
- 從 `templates/` 載入對應的 CSS
- 每頁用 `@page` 設定尺寸
- 直排 `writing-mode: vertical-rl`
- column 區塊使用 flexbox/grid 定位
- 頁碼左右交錯

**pdf.ts**：
- Playwright 啟動 headless Chromium
- 載入 HTML，設定列印參數
- `page.pdf()` 輸出 PDF
- 字型需內嵌或指定

---

## 技術棧

| 工具 | 用途 |
|------|------|
| **Bun** | Runtime + 套件管理 + 測試執行 |
| **TypeScript** | 開發語言 |
| **Playwright** | Headless Chromium → PDF 輸出 |
| **Vivliostyle Core** | CSS 排版引擎（處理 @page、直排） |
| **remark** | Markdown 解析 |
| **TypeScript types** | 專案型別定義 |

---

## 開發階段

### Phase 1 — 核心管道（本階段）

```
Markdown → Parser → Composer → Renderer → PDF
```

1. 建立專案結構與套件
2. 實作 Parser（Markdown + `<!-- -->` 指令解析）
3. 實作型別定義（Layout、ContentNode、Page）
4. 實作 Measurer（隱藏 DOM 量高度）
5. 實作 PageComposer（分頁演算法）
6. 實作 Renderer（HTML 模板 + Playwright PDF）
7. 整合 CLI 指令
8. 測試：範例稿件產出 PDF

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
bun init                    # 初始化專案（已執行則跳過）
bun add playwright          # PDF 輸出
bun add remark remark-html  # Markdown 解析
bun add @vivliostyle/core   # CSS 排版引擎
bun add --dev typescript @types/bun

bun run src/index.ts        # 執行
bun run --watch src/index.ts # 開發模式
```

---

## 備註

- 本專案目標是「部分替代 Adobe InDesign」——針對已知版型自動化排版
- 不追求通用排版軟體的所有功能
- 優先確保：直排品質、字距精準、腳註對應、跨頁流暢
