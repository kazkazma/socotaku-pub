// 瀏覽器端執行的排版組合引擎（經 Bun.build 打包注入）
(window as any).browserCompose = function (
  nodes: any[],
  initialLayout: string,
  templates: Record<string, any>,
  dimensions: {
    marginOuterPt: number;
    marginInnerPt: number;
    marginTopPt: number;
    marginBottomPt: number;
  },
): any[] {
  const PAGE_LEFT = dimensions.marginOuterPt;
  const PAGE_RIGHT = dimensions.marginInnerPt;
  const PAGE_TOP = dimensions.marginTopPt;
  const PAGE_BOTTOM = dimensions.marginBottomPt;

  const composeArea = document.getElementById("compose-area")!;
  const pages: any[] = [];
  const pageEls: HTMLElement[] = [];
  const defMap = new Map<string, string>();
  const refsPerPage = new Map<
    number,
    Array<{ refId: string; displayId: string }>
  >();
  let currentTemplate = templates[initialLayout];
  let pageEl = buildPageDOM(currentTemplate, composeArea);
  let pageData = createPageData(pageEl, currentTemplate.id);
  pageEls.push(pageEl);

  // ── 輔助函式 ──

  // 從 pageEl 的 DOM 結構建立頁面資料物件
  function createPageData(pageEl: HTMLElement, layoutId: string): any {
    const colEls: HTMLElement[] = Array.from(
      pageEl.querySelectorAll("[data-column-id]"),
    );

    const columns = colEls.map((el) => ({
      def: {
        id: el.dataset.columnId || "",
        type: el.dataset.columnKind || "body",
      },
      nodes: [],
    }));

    // 依 .page direct child 順序建立 slots（保留 static 位置）
    const slots = Array.from(pageEl.children).map((child) => {
      if ("columnKind" in (child as HTMLElement).dataset) {
        const index = colEls.indexOf(child as HTMLElement);
        if (index === -1) {
          throw new Error(
            "Column child has data-column-kind but no data-column-id",
          );
        }
        return { type: "column", index };
      }
      return { type: "static", html: (child as HTMLElement).outerHTML };
    });

    return {
      layoutId,
      columns,
      slots,
      _nextBodyCol: 0, // 下一個嘗試放置的正文欄索引
    };
  }

  // 從 HTML 字串建立 DOM 元素
  function createElementFromHTML(html: string): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = html.trim();
    return div.firstElementChild as HTMLElement;
  }

  // 建立頁面 DOM 並填入邊距 padding
  function buildPageDOM(tpl: any, parent: HTMLElement): HTMLElement {
    const pageEl = createElementFromHTML(tpl.pageHtml);
    pageEl.style.padding = `${PAGE_TOP}pt ${PAGE_RIGHT}pt ${PAGE_BOTTOM}pt ${PAGE_LEFT}pt`;
    parent.appendChild(pageEl);
    return pageEl;
  }

  // 取得所有正文欄元素
  function getBodyColumnDefs(pageEl: HTMLElement): HTMLElement[] {
    return Array.from(pageEl.querySelectorAll('[data-column-kind="body"]'));
  }

  // 計算某欄位在頁面中的索引
  function getColumnIndex(pageEl: HTMLElement, colEl: HTMLElement): number {
    return Array.from(pageEl.querySelectorAll("[data-column-id]")).indexOf(
      colEl,
    );
  }

  // 檢查頁面資料是否為空
  function isPageEmpty(pd: any): boolean {
    return pd.columns.every((c: any) => c.nodes.length === 0);
  }

  // HTML 跳脫（& < > " '）
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 建立註腳引用標記的 SVG HTML
  function renderFnRefHtml(id: string): string {
    return `<span class="footnote-ref"><svg viewBox="0 0 20 20" width="8pt" height="8pt" style="writing-mode:horizontal-tb"><circle cx="10" cy="10" r="9" fill="currentColor"/><text x="10" y="13.5" text-anchor="middle" font-size="11" fill="white">${id}</text></svg></span>`;
  }

  // 將文字中的 [n] 數字標記替換為 SVG 註腳符號，並將 \n 轉為 <br>
  function replaceFnRefs(text: string): string {
    return escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/\[(\d+)\]/g, (_, id) => renderFnRefHtml(id));
  }

  // 將 *italic* 與 **bold** 轉為 HTML 標籤
  function applyInlineFormatting(html: string): string {
    return html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  // 為節點建立對應的 DOM 元素
  function createElementForNode(
    nodeType: string,
    text: string,
    node?: any,
  ): HTMLElement {
    const el = document.createElement(nodeType === "heading" ? `h${Math.min(node?.level || 2, 6)}` : "p");
    const hasFnRefs = /\[\d+\]/.test(text) && (nodeType === "paragraph" || nodeType === "quote");
    const hasInlineMarkers = text.includes('*');
    if (hasFnRefs || hasInlineMarkers || text.includes('\n')) {
      let html: string;
      if (hasFnRefs) {
        html = replaceFnRefs(text);
      } else {
        html = escapeHtml(text).replace(/\n/g, '<br>');
      }
      if (hasInlineMarkers) {
        html = applyInlineFormatting(html);
      }
      el.innerHTML = html;
    } else {
      el.textContent = text;
    }
    if (node?.isEndnote) el.classList.add("endnote-text");
    if (node?.continues) el.classList.add("continues");
    if (nodeType === "quote") el.classList.add("quote");
    if (node?.style) el.style.cssText = node.style;

    return el;
  }

  // 檢查欄位內容是否溢出（最後子元素的 left < 欄位 left）
  function columnOverflows(colEl: HTMLElement): boolean {
    const lastChild = colEl.lastElementChild;
    if (!lastChild) return false;
    const colRect = colEl.getBoundingClientRect();
    const childRect = lastChild.getBoundingClientRect();
    return childRect.left < colRect.left - 1;
  }

  // 從文字中掃描註腳引用標記 [n]，記錄到 refsPerPage
  function recordFnRefsFromText(
    text: string,
    pageIdx: number,
    fnRefs?: any[],
  ): void {
    if (!text) return;
    const matches = text.matchAll(/\[(\d+)\]/g);
    for (const match of matches) {
      const displayId = match[1]!;
      const refId = fnRefs?.find((r: any) => r.displayId === displayId)?.refId;
      if (refId) {
        if (!refsPerPage.has(pageIdx)) refsPerPage.set(pageIdx, []);
        const existing = refsPerPage.get(pageIdx)!;
        if (!existing.some((r: any) => r.refId === refId)) {
          existing.push({ refId, displayId });
        }
      }
    }
  }

  // 計算每行可容納字數（以 inline 方向高度 ÷ 字元 advance）
  function bodyCharsPerLine(colEl: HTMLElement): number {
    const style = getComputedStyle(colEl);
    const fontSizePx = parseFloat(style.fontSize);
    const letterSpacingPx = parseFloat(style.letterSpacing) || 0;
    if (isNaN(fontSizePx)) return 15;
    const inlinePx = colEl.getBoundingClientRect().height;
    const charAdvancePx = fontSizePx + letterSpacingPx;
    return Math.max(1, Math.floor(inlinePx / charAdvancePx));
  }

  // 二分法拆分文字：在 colEl 中測試可容納的前綴長度
  function splitAt(
    text: string,
    colEl: HTMLElement,
    nodeType: string,
    node?: any,
  ): [string, string] {
    if (!text) return ["", ""];

    // 先測試整段能否容納
    const testEl = createElementForNode(nodeType, text, node);
    colEl.appendChild(testEl);
    if (!columnOverflows(colEl)) {
      colEl.removeChild(testEl);
      return [text, ""];
    }
    colEl.removeChild(testEl);

    // 二分搜尋最大可容納前綴長度
    let low = 0;
    let high = text.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mid === 0) {
        low = 1;
        continue;
      }

      const isPrefix = mid < text.length;
      const midNode = nodeType === "paragraph" && isPrefix ? { ...node, continues: true } : node;
      const midEl = createElementForNode(nodeType, text.slice(0, mid), midNode);
      colEl.appendChild(midEl);
      if (!columnOverflows(colEl)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
      colEl.removeChild(midEl);
    }

    // 調整切分位置，避免破壞行內標記 (**bold** / *italic* / [n])
    best = adjustSplitPos(text, best);

    return [text.slice(0, best), text.slice(best)];
  }

  // 將切分位置倒退至不成對標記之前，確保兩半格式完整
  function adjustSplitPos(text: string, pos: number): number {
    if (pos <= 0 || pos >= text.length) return pos;

    // Bold **：跳過已配對的 **，若狀態為開啟則退回開 ** 前
    let inBold = false;
    let lastBoldOpen = -1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '*' && i + 1 < text.length && text[i + 1] === '*') {
        inBold = !inBold;
        if (inBold) lastBoldOpen = i;
        i++;
      }
    }
    if (inBold && lastBoldOpen >= 0) return lastBoldOpen;

    // Italic *：跳過 ** 後掃單 *
    let inItalic = false;
    let lastItalicOpen = -1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '*') {
        if (i + 1 < text.length && text[i + 1] === '*') {
          i++;
          continue;
        }
        inItalic = !inItalic;
        if (inItalic) lastItalicOpen = i;
      }
    }
    if (inItalic && lastItalicOpen >= 0) return lastItalicOpen;

    // Footnote ref [n]：若 pos 落在括號中間則退回 [
    for (let i = Math.max(0, pos - 5); i < pos; i++) {
      if (text[i] === '[' && text.slice(i, pos).match(/^\[\d*$/) && !text.slice(i).match(/^\[\d+\]/)) {
        return i;
      }
    }

    return pos;
  }

  function tryPlaceAndSplit(
    node: any,
    pageEl: HTMLElement,
    pageData: any,
    nextNode?: any,
  ): { placed: boolean; remainder: string | null } {
    const nodeType = node.type;
    const text = node.text ?? "";
    const bodyCols = getBodyColumnDefs(pageEl);
    const startIdx = Math.min(pageData._nextBodyCol ?? 0, bodyCols.length - 1);
    let fallbackCol: { el: HTMLElement; idx: number } | null = null;

    for (let bci = startIdx; bci < bodyCols.length; bci++) {
      const colEl = bodyCols[bci]!;
      // 嘗試將整個節點放入此欄
      const el = createElementForNode(nodeType, text, node);
      colEl.appendChild(el);

      if (!columnOverflows(colEl)) {
        // 節點可放入此欄
        // 標題特殊處理：若標題 + 下一段第一行都能放入，則延遲到後面的欄位
        if (
          nodeType === "heading" &&
          pageEl.dataset.pageMode !== "endnote" &&
          nextNode?.type === "paragraph"
        ) {
          const prefixLen = Math.min(
            (nextNode.text ?? "").length,
            bodyCharsPerLine(colEl),
          );
          const prefixEl = createElementForNode(
            "paragraph",
            nextNode.text.slice(0, prefixLen),
            node,
          );
          colEl.appendChild(prefixEl);

          if (!columnOverflows(colEl)) {
            // 標題 + 前綴都放得下 → 此欄還有空間，延遲到後面的欄位
            colEl.removeChild(prefixEl);
            colEl.removeChild(el);
            if (!fallbackCol) {
              fallbackCol = { el: colEl, idx: getColumnIndex(pageEl, colEl) };
            }
            continue;
          }

          // 標題可放但前綴放不下 → 就在此欄接受（緊密排版）
          colEl.removeChild(prefixEl);
        }

        pageData._nextBodyCol = bci;
        const colIdx = getColumnIndex(pageEl, colEl);
        pageData.columns[colIdx].nodes.push(node);
        recordFnRefsFromText(text, pages.length, node.fnRefs);
        return { placed: true, remainder: null };
      }

      // 整段放不下 → 移除嘗試拆分
      colEl.removeChild(el);

      const [first, second] = splitAt(text, colEl, nodeType, node);
      if (first) {
        pageData._nextBodyCol = bci;
        const splitNode = {
          ...node,
          text: first,
          continues: nodeType === "paragraph" || nodeType === "quote",
        };
        const splitEl = createElementForNode(nodeType, first, splitNode);
        colEl.appendChild(splitEl);
        const colIdx = getColumnIndex(pageEl, colEl);
        pageData.columns[colIdx].nodes.push(splitNode);
        recordFnRefsFromText(first, pages.length, node.fnRefs);
        return { placed: true, remainder: second || null };
      }
      // 連前綴都放不下 → 嘗試下一欄
    }

    // 若先前有延遲的標題欄位，使用該欄作為 fallback
    if (fallbackCol) {
      const el = createElementForNode(nodeType, text, node);
      fallbackCol.el.appendChild(el);
      pageData._nextBodyCol = fallbackCol.idx;
      pageData.columns[fallbackCol.idx].nodes.push(node);
      recordFnRefsFromText(text, pages.length, node.fnRefs);
      return { placed: true, remainder: null };
    }

    return { placed: false, remainder: text };
  }

  // 在已組好的頁面中填入註腳（使用隱藏 measurer 模擬垂直排版來測試空間）
  function placeFootnotes(allPages: any[]): void {
    const measurer = document.createElement("div");
    measurer.style.cssText = `writing-mode:vertical-rl;font-size:9pt;height:167pt;overflow:hidden;position:absolute;left:-9999px;top:0;width:375pt;`;
    document.body.appendChild(measurer);

    const pendingFootnotes: Array<{ displayId: string; text: string }> = [];

    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i];
      const fnCol = page.columns.find((c: any) => c.def.type === "footnote");
      if (!fnCol) continue;

      // 收集此頁所有註腳引用對應的定義文字
      const refs = refsPerPage.get(i) ?? [];
      for (const { refId, displayId } of refs) {
        const defText = defMap.get(refId);
        if (defText) {
          pendingFootnotes.push({ displayId, text: defText });
        }
      }

      // 逐一塞入註腳欄，直到空間不足為止
      while (pendingFootnotes.length > 0) {
        const fn = pendingFootnotes[0]!;
        const fnText = `[${fn.displayId}] ${fn.text}`;
        const testP = document.createElement("p");
        testP.textContent = fnText;
        measurer.appendChild(testP);

        if (!columnOverflows(measurer)) {
          measurer.removeChild(testP);
          fnCol.nodes.push({ type: "paragraph", text: fnText });
          pendingFootnotes.shift();
        } else {
          measurer.removeChild(testP);
          break; // 空間不足，等下一頁
        }
      }

      measurer.innerHTML = "";
    }

    document.body.removeChild(measurer);
  }

  // ── 主迴圈：逐節點處理，分配到各頁各欄 ──
  const queue = [...nodes];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const nodeType = node.type;

    // 分頁指令：將當前頁面封存，建立新頁
    if (nodeType === "page_break") {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData);
        pageEl = buildPageDOM(currentTemplate, composeArea);
        pageEls.push(pageEl);
        pageData = createPageData(pageEl, currentTemplate.id);
      }
      continue;
    }

    // 分欄指令：移動到下一個正文欄；若已到最後一欄則換頁
    if (nodeType === "column_break") {
      const bodyCols = getBodyColumnDefs(pageEl);
      if (pageData._nextBodyCol < bodyCols.length - 1) {
        pageData._nextBodyCol++;
      } else {
        if (!isPageEmpty(pageData)) {
          pages.push(pageData);
          pageEl = buildPageDOM(currentTemplate, composeArea);
          pageEls.push(pageEl);
          pageData = createPageData(pageEl, currentTemplate.id);
        }
      }
      continue;
    }

    // 版面切換指令：封存當前頁，載入新版面
    if (nodeType === "layout_switch") {
      if (!isPageEmpty(pageData)) {
        pages.push(pageData);
      }
      currentTemplate = templates[node.layout];
      pageEl = buildPageDOM(currentTemplate, composeArea);
      pageEls.push(pageEl);
      pageData = createPageData(pageEl, currentTemplate.id);
      continue;
    }

    // 註腳引用：已在 recordFnRefsFromText 中處理（掃描段落文字中的 [n] 標記）
    if (nodeType === "footnote_ref") {
      continue;
    }

    // 註腳定義：endnote 模式下直接插入為段落；一般模式下存入 defMap 供後續擺放
    if (nodeType === "footnote_def") {
      if (pageEl.dataset.pageMode === "endnote") {
        if (node.text) {
          const text = `[${node.displayId || node.id}] ${node.text}`;
          queue.unshift({ type: "paragraph", text, isEndnote: true });
        }
      } else {
        if (node.text) defMap.set(node.id, node.text);
      }
      continue;
    }

    // 標題、段落或引文：嘗試放入當前頁面，必要時拆分
    if (nodeType === "heading" || nodeType === "paragraph" || nodeType === "quote") {
      const nextNode = queue[0] ?? null;

      let result: { placed: boolean; remainder: string | null };
      if (nodeType === "heading") {
        result = tryPlaceAndSplit(node, pageEl, pageData, nextNode);
      } else {
        result = tryPlaceAndSplit(node, pageEl, pageData);
      }

      if (result.placed) {
        // 成功放置，若有剩餘文字則放回佇列前端繼續處理
        if (result.remainder) {
          queue.unshift({ ...node, text: result.remainder });
        }
        continue;
      }

      // 完全無法放置（連前綴都放不下）→ 換新頁重試
      if (!isPageEmpty(pageData)) {
        pages.push(pageData);
        pageEl = buildPageDOM(currentTemplate, composeArea);
        pageEls.push(pageEl);
        pageData = createPageData(pageEl, currentTemplate.id);
        queue.unshift(node);
        continue;
      }

      // 空頁面也放不下（死結）→ 強制放入，允許溢出
      const firstColEl = getBodyColumnDefs(pageEl)[0];
      if (firstColEl) {
        const el = createElementForNode(nodeType, node.text ?? "", node);
        firstColEl.appendChild(el);
        const colIdx = getColumnIndex(pageEl, firstColEl);
        pageData.columns[colIdx].nodes.push(node);
      }
      continue;
    }
  }

  // 處理最後一頁
  if (!isPageEmpty(pageData)) {
    pages.push(pageData);
  }

  // 在已組好的頁面中填入註腳
  placeFootnotes(pages);

  return pages;
};
