# 版型格式

## 文件目的

本文描述 `templates/layout-*.html` 作為頁面版型時的外部格式與目前設計意圖。

本文件以當前版型系統的實作狀況為基準，避免將尚未穩定的方向過度規格化。未來若版型系統擴充，本文也應同步更新。

## 基本規則

- 版型檔案放在 `templates/` 目錄下。
- 版型檔名需符合 `layout-*.html`。
- 版型檔名去除 `.html` 後即為 layout id。
- 稿件可透過 `<!-- layout: layout-id -->` 指令切換版型。
- 每個版型檔可包含 HTML 結構與一段 `<style>`。

例如：

```text
templates/layout-a.html
```

對應稿件中的：

```md
<!-- layout: layout-a -->
```

## 版型 ID

layout id 由檔名決定。

例如：

- `layout-a.html` 對應 `layout-a`
- `layout-b-body.html` 對應 `layout-b-body`
- `layout-a-uica-1.html` 對應 `layout-a-uica-1`

layout id 會用於稿件中的 `layout` 指令，也會出現在輸出頁面的 class 中。

## 檔案結構

目前版型檔通常包含：

```html
<style>
.layout-a .column.top {
  height: 66mm;
}
</style>

<div class="layout-a">
  <div class="column body top" data-slot-kind="body" data-slot-id="top"></div>
  <div class="column footnote bottom" data-slot-kind="footnote" data-slot-id="bottom"></div>
</div>
```

載入版型時，`<style>` 內的 CSS 會被抽出並合併到全域輸出 CSS；去除 `<style>` 後的 HTML 會作為頁面結構使用。

## 根容器

目前每個 layout 使用單一根容器，例如：

```html
<div class="layout-a">
  ...
</div>
```

單一根容器有利於隔離樣式、保留版型結構，也可能有助於未來製作單一版型檔案本身的預覽。

建議根容器包含與 layout id 相同的 class，以降低不同版型 CSS 之間的碰撞風險。根容器可以包含其他 class，不限制只能有 layout id class。

## Slot 標記

可被自動填入內容的位置需標記 `data-slot-kind` 與 `data-slot-id`：

```html
<div class="column body top" data-slot-kind="body" data-slot-id="top"></div>
```

`data-slot-kind` 表示 slot 用途。

`data-slot-id` 表示 slot 識別。單一 layout 內的 `data-slot-id` 應保持唯一，否則會造成自動填文與 slot 定位上的困難。

目前 slot 元素通常也會包含 `.column` class，並套用 `base.css` 中的共通欄位樣式。這些共通樣式預設服務於直書欄位；特殊版型可依需求 override，例如章節標題頁或橫書區塊。

`.column` 是 CSS class，用於描述視覺排版樣式，不作為資料契約。資料契約以 `data-slot-kind` 與 `data-slot-id` 為準。

## Slot 類型

設計方向中的 `data-slot-kind` 包含：

- `body`：正文 slot，放置標題、段落、引用等主要文字內容。
- `footnote`：頁下注 slot，放置頁下注內容。
- `pic`：圖片 slot，放置圖片。

## Slot 順序

排版引擎會依版型 DOM 中 slot 出現的順序建立頁面資料。

正文內容會依 `data-slot-kind="body"` slot 的 DOM 順序流入。若需要控制正文流動順序，應調整版型中的 body slot 順序。

## CSS 規則

版型 CSS 建議寫在版型檔案的 `<style>` 中。

建議以根容器 class 作為 selector 前綴，降低不同版型間的樣式碰撞：

```css
.layout-a .column.top {
  height: 66mm;
}
```

出版尺寸建議使用穩定的實體單位：

- 頁面、欄位、間距等尺寸優先使用 `mm`。
- 字級與行距可使用 `pt`。
- 避免讓版型尺寸依賴 viewport 單位或不穩定的外部資源。

## base.css 與 Layout CSS

`templates/base.css` 負責全域頁面與共通樣式，例如：

- 紙張尺寸
- 頁面邊距
- 字體設定
- 直排共通樣式
- 頁碼樣式
- body、footnote、pic 等共通 slot/欄位樣式

`templates/layout-*.html` 則負責單一版型的局部結構，例如：

- slot 組合
- slot 高度與寬度
- slot 間距
- 特殊圖片欄
- 特定頁型的局部 override

## 頁面模式

目前可透過 `data-page-mode="endnote"` 表示尾注/endnote 頁面：

```html
<div class="layout-b-endnote" data-page-mode="endnote">
  <div class="column body top" data-slot-kind="body" data-slot-id="top"></div>
  <div class="column body middle" data-slot-kind="body" data-slot-id="middle"></div>
  <div class="column body bottom" data-slot-kind="body" data-slot-id="bottom"></div>
</div>
```

在 endnote 模式下，註腳定義會作為正文內容排入 `body` slot，而不是排入頁下注 slot。

## 圖片 Slot

圖片 slot 使用 `data-slot-kind="pic"`：

```html
<div class="column pic" data-slot-kind="pic" data-slot-id="main"></div>
```

未來稿件可透過圖片 slot 指令指定目標圖片 slot：

```md
<!-- image-slot: main -->
![](img/example.png)
```

該指令應對應目前版型中的：

```html
[data-slot-kind="pic"][data-slot-id="main"]
```

若同一版型存在多個 `pic` slot，圖片分配應透過 `data-slot-id` 明確指定。

## 靜態元素

版型中非欄位元素可作為靜態元素保留，例如裝飾、標題框、固定圖樣或其他不由稿件自動填入的內容。

目前靜態元素的複雜結構尚未完整規格化。新增靜態元素時，建議保持結構單純，並避免依賴過深或過度動態的巢狀關係。

## 新增版型建議

- 檔名使用 `layout-*.html`。
- 根容器 class 建議包含 layout id。
- slot 需標記 `data-slot-kind` 與 `data-slot-id`。
- 單一 layout 內的 `data-slot-id` 應唯一。
- 版型 CSS 建議以前綴 selector 限定在根容器下。
- slot 尺寸優先使用 `mm`，字級與行距可使用 `pt`。
- 特殊頁面、特殊圖片欄與特殊橫書區塊應透過版型處理，而不是依賴大量稿件內 style patch。

## 目前不視為穩定支援

以下項目目前不應視為穩定版型契約：

- 未指定 `data-slot-id` 時的多圖片 slot 自動分配策略
- 複雜 static slot 結構
- 表格專用欄位
- 版型 metadata
- 跨頁或 spread 版型
- 版型檔案本身的獨立預覽
- 自動版型驗證

## 未來方向

### 多圖片 Slot

未來應支援多個圖片 slot，讓稿件可指定圖片進入特定圖片 slot 或版型區域。

### 表格版型

表格支援可能需要專用欄位或特殊版型，以便控制橫排表格、獨立表格區塊或 SVG 表格輸出。

### 版型 Metadata

未來可考慮在版型檔中描述 metadata，例如版型用途、預期欄位、是否支援圖片、是否支援註腳等。

### Static Slot 規格

未來可將靜態元素與欄位順序正式規格化，使裝飾元素、固定標題框與其他靜態區塊能更穩定地保留。

### 版型驗證工具

未來可加入版型驗證，檢查欄位 id 是否重複、欄位類型是否有效、版型是否缺少必要欄位，以及 CSS 尺寸是否可能造成排版問題。

### 欄位容量與溢出警告

未來可加入更明確的欄位容量與溢出檢查，協助判斷特定版型是否適合目前稿件內容。

### 跨頁版型

未來可討論 spread 或左右頁成對設計，用於需要跨頁視覺或對頁排版的刊物頁面。
