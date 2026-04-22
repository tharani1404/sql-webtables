/***********************
 *  SEMANTIC TABLES
 ***********************/
function injectScript(file) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file);
    script.onload = function () {
      this.remove();
      resolve();
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// 🔥 Ensure correct order (VERY IMPORTANT)
(async function initAlaSQL() {
  await injectScript('alasql.min.js');
  await injectScript('page-bridge.js');
  console.log("✅ AlaSQL + Bridge loaded in page");
})();


function detectSemanticTables() {
  const results = [];

  document.querySelectorAll("table").forEach((table, i) => {
    // Never treat extension UI/result tables as page tables
    if (table.closest("#sql-query-sidebar") || table.closest("#sql-sidebar-toggle")) return;

    // Basic check: skip if table is completely hidden
    const style = getComputedStyle(table);
    if (style.display === "none" || style.visibility === "hidden") return;

    const trs = [...table.querySelectorAll("tr")];
    
    const rows = trs.map(tr =>
      [...tr.querySelectorAll("th, td")]
        .map(td => cleanText(td.innerText || td.textContent))
    );

    const nonEmptyRows = rows.filter(r => r.some(c => c));
    
    // Only skip if completely empty
    if (nonEmptyRows.length === 0) return;

    const hasExplicitHeader =
      !!table.querySelector("thead") ||
      !!table.querySelector("tr th");

    const headers = hasExplicitHeader
      ? (nonEmptyRows[0] || [])
      : [];
    const dataRows = hasExplicitHeader
      ? nonEmptyRows.slice(1)
      : nonEmptyRows;

    results.push({
      id: "semantic-" + i,
      type: "semantic",
      root: table,
      confidence: 1.0,
      headers,
      rows: dataRows
    });
  });

  return results;
}


function extractSemanticHeaders(table, rows) {
  const ths = table.querySelectorAll("th");
  if (ths.length >= rows[0].length) {
    return [...ths].slice(0, rows[0].length).map(th => cleanText(th.innerText));
  }
  return rows[0];
}


/***********************
 *  INDEXEDDB STORAGE
 ***********************/
const SQL_WEBTABLES_DB_NAME = "sql_webtables_db";
const SQL_WEBTABLES_DB_VERSION = 1;
const SQL_WEBTABLES_TABLE_STORE = "tables";

function openTablesDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported in this environment.");
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(SQL_WEBTABLES_DB_NAME, SQL_WEBTABLES_DB_VERSION);

    request.onerror = () => {
      console.warn("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SQL_WEBTABLES_TABLE_STORE)) {
        const store = db.createObjectStore(SQL_WEBTABLES_TABLE_STORE, { keyPath: "id" });
        store.createIndex("by_page", "pageUrl", { unique: false });
        store.createIndex("by_tableId", "tableId", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function saveTablesToIndexedDB(tables) {
  try {
    const db = await openTablesDB();
    const tx = db.transaction(SQL_WEBTABLES_TABLE_STORE, "readwrite");
    const store = tx.objectStore(SQL_WEBTABLES_TABLE_STORE);
    const pageUrl = window.location.href;
    const now = Date.now();

    tables.forEach((table) => {
      const record = {
        id: `${pageUrl}::${table.id}`,
        pageUrl,
        tableId: table.id,
        type: table.type,
        headers: table.headers || [],
        rows: table.rows || [],
        createdAt: now,
      };
      store.put(record);
    });

    tx.oncomplete = () => {
      db.close();
    };
  } catch (err) {
    // Failing to persist should never break page behavior
    console.warn("Error saving tables to IndexedDB:", err);
  }
}

/***********************
 *  TABLE UI HELPERS
 ***********************/
function normalizeTableHeaders(table) {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const existingHeaders = Array.isArray(table.headers) ? table.headers : [];
  const maxCols = rows.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    existingHeaders.length
  );

  if (!table.headers || !Array.isArray(table.headers)) {
    table.headers = [];
  }

  for (let i = 0; i < maxCols; i++) {
    const current = table.headers[i];
    if (!current || !String(current).trim()) {
      table.headers[i] = `Column ${i + 1}`;
    }
  }

  return table.headers;
}

function ensureTableDisplayName(table, index) {
  if (!table) return;
  if (!table.displayName || !String(table.displayName).trim()) {
    table.displayName = `Table ${index + 1}`;
  }
}

function attachTableActionIcon(table) {
  if (!table || !table.root) return;
  if (table.root.dataset.sqlWebtablesEnhanced === "1") return;

  table.root.dataset.sqlWebtablesEnhanced = "1";

  // Ensure the root is a positioning context, but avoid overriding non-static positions
  const style = getComputedStyle(table.root);
  if (style.position === "static") {
    table.root.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.className = "sql-table-overlay";
  // Position the icon at the top-right, slightly outside the table
  overlay.style.position = "absolute";
  overlay.style.top = "-10px";
  overlay.style.right = "-10px";
  overlay.style.zIndex = "2147483646";
  overlay.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.className = "sql-table-run-btn";
  button.type = "button";
  const displayName = table.displayName || table.id || "Table";
  button.title = `Run SQL query for ${displayName}`;
  button.style.padding = "4px 6px";
  button.style.fontSize = "11px";
  button.style.borderRadius = "4px";
  button.style.border = "1px solid #2563eb";
  button.style.background = "#2563eb";
  button.style.color = "#ffffff";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";

  // Use magnifying glass emoji icon
  button.textContent = "🔍";

  button.addEventListener("click", () => {
    try {
      if (!window.__SQL_SIDEBAR__) {
        console.warn("SQL sidebar not available yet.");
        return;
      }

      // Ensure sidebar is open
      const sidebarEl = document.getElementById("sql-query-sidebar");
      const isOpen = sidebarEl && sidebarEl.classList.contains("open");
      if (!isOpen) {
        window.__SQL_SIDEBAR__.toggle();
      }

      // Open the query tab for this specific table
      if (typeof window.__SQL_SIDEBAR__.openQueryForTableId === "function") {
        window.__SQL_SIDEBAR__.openQueryForTableId(table.id);
      }
    } catch (e) {
      console.warn("Error handling SQL table action button click:", e);
    }
  });

  overlay.appendChild(button);

  table.root.appendChild(overlay);
}

/***********************
 *  REPEATED DIV TABLES
 ***********************/
function detectRepeatedDivTables() {
  const results = [];
  const parents = [...document.querySelectorAll("div, li, section, article")];

  parents.forEach((parent, idx) => {
    if (!isVisible(parent)) return;
    
    // Skip if inside a table (already handled by semantic detection)
    if (parent.closest("table")) return;

    const children = [...parent.children].filter(isVisible);
    if (children.length < 3) return;
    if (!sameTag(children)) return;

    // Check if this is a horizontal scrolling gallery (like Netflix recommendations)
    // These are NOT tables - they're lists/galleries
    const style = getComputedStyle(parent);
    const isHorizontalScroll = 
      style.overflowX === "auto" || 
      style.overflowX === "scroll" ||
      style.overflow === "auto" ||
      style.overflow === "scroll";
    
    // Check if children are arranged horizontally (gallery pattern)
    const firstRect = children[0]?.getBoundingClientRect();
    const lastRect = children[children.length - 1]?.getBoundingClientRect();
    if (firstRect && lastRect) {
      const isHorizontalLayout = Math.abs(lastRect.left - firstRect.left) > Math.abs(lastRect.top - firstRect.top);
      // If horizontal layout with scrolling, it's likely a gallery, not a table
      if (isHorizontalLayout && (isHorizontalScroll || children.length > 10)) {
        return; // Skip horizontal galleries
      }
    }

    const rows = children
      .map(row => extractDivRow(row))
      .filter(r => r.length >= 2);

    // Require at least 3-4 rows for a valid repeated-div table
    if (rows.length < 4) return;
    if (!similarLengths(rows)) return;
    
    // Additional validation: ensure it has tabular structure (multiple columns)
    const avgCols = rows.reduce((s, r) => s + r.length, 0) / rows.length;
    if (avgCols < 2) return;
    
    // Check that rows are arranged vertically (table pattern, not horizontal list)
    const firstRowRect = children[0]?.getBoundingClientRect();
    const secondRowRect = children[1]?.getBoundingClientRect();
    if (firstRowRect && secondRowRect) {
      const verticalSpacing = Math.abs(secondRowRect.top - firstRowRect.top);
      const horizontalSpacing = Math.abs(secondRowRect.left - firstRowRect.left);
      // If items are mostly horizontal (like a gallery), skip
      if (horizontalSpacing > verticalSpacing * 2 && children.length > 5) {
        return; // Likely a horizontal gallery, not a table
      }
    }

    // Skip if this is part of our extension UI
    if (parent.closest("#sql-query-sidebar") || parent.closest("#sql-sidebar-toggle")) {
      return;
    }

    // Extract headers from first row, data rows from the rest
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    results.push({
      id: "repeated-" + idx,
      type: "repeated-div",
      root: parent,
      confidence: 0.7,
      headers: headers,
      rows: dataRows
    });
  });

  return results;
}

function extractDivRow(rowEl) {
  let cells = [...rowEl.children].filter(isVisible);

  if (cells.length < 2) {
    cells = [...rowEl.querySelectorAll("span, div, p")].filter(isVisible);
  }

  return cells
    .map(c => cleanText(c.innerText))
    .filter(Boolean);
}

function sameTag(nodes) {
  return nodes.every(n => n.tagName === nodes[0].tagName);
}

function similarLengths(rows) {
  const avg = rows.reduce((s, r) => s + r.length, 0) / rows.length;
  return rows.every(r => Math.abs(r.length - avg) <= 1);
}

/***********************
 *  GRID / FLEX TABLES
 ***********************/
function detectGridFlexTables() {
  const results = [];

  document.querySelectorAll("*").forEach((el, idx) => {
    if (!isVisible(el)) return;
    
    // Skip if inside a table (already handled by semantic detection)
    if (el.closest("table")) return;

    const style = getComputedStyle(el);
    if (!["grid", "inline-grid", "flex", "inline-flex"].includes(style.display)) return;

    const children = [...el.children].filter(c =>
      isVisible(c) && cleanText(c.innerText)
    );

    if (children.length < 6) return;

    const cells = children.map(c => ({
      el: c,
      text: cleanText(c.innerText),
      rect: c.getBoundingClientRect()
    }));

    const rowClusters = clusterBy(cells, "top", 8);
    if (rowClusters.length < 2) return;

    const grid = rowClusters.map(row =>
      clusterBy(row, "left", 10).map(col => col[0].text)
    );

    const maxCols = Math.max(0, ...grid.map(r => r.length));
    if (maxCols < 2) return;

    // Skip if this is part of our extension UI
    if (el.closest("#sql-query-sidebar") || el.closest("#sql-sidebar-toggle")) {
      return;
    }

    // Extract headers from first row, data rows from the rest
    const headers = grid[0] || [];
    const dataRows = grid.slice(1);

    results.push({
      id: "grid-" + idx,
      type: "grid-flex",
      root: el,
      confidence: 0.6,
      headers: headers,
      rows: dataRows
    });
  });

  return results;
}

function clusterBy(items, axis, threshold) {
  const sorted = [...items].sort((a, b) => a.rect[axis] - b.rect[axis]);
  const clusters = [];

  sorted.forEach(item => {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(last[0].rect[axis] - item.rect[axis]) > threshold) {
      clusters.push([item]);
    } else {
      last.push(item);
    }
  });

  return clusters;
}

/***********************
 *  SCAN PIPELINE
 ***********************/
function scanPage() {
  const tables = [
    ...detectSemanticTables(),
    ...detectRepeatedDivTables(),
    ...detectGridFlexTables()
  ];

  // Normalize headers, attach per-table action icons, and persist snapshot
  tables.forEach((table, index) => {
    ensureTableDisplayName(table, index);
    normalizeTableHeaders(table);
    attachTableActionIcon(table);
  });

  saveTablesToIndexedDB(tables);

  console.log("Detected tables:", tables);
  window.__WEB_TABLES__ = tables;
  
  // Notify sidebar that tables are ready
  if (window.__SQL_SIDEBAR__) {
    window.__SQL_SIDEBAR__.updateTables(tables);
  }
}


// Initial scan
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanPage);
} else {
  scanPage();
}


/***********************
 *  HELPERS
 ***********************/
function isVisible(el) {
  if (!el) return false;
  
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  
  const r = el.getBoundingClientRect();
  return !!(r.width > 0 && r.height > 0);
}

function cleanText(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

let scanTimeout = null;

const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanPage, 700);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});


