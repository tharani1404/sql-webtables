/***********************
 *  SEMANTIC TABLES
 ***********************/
function detectSemanticTables() {
  const results = [];

  document.querySelectorAll("table").forEach((table, i) => {

    const rows = [...table.querySelectorAll("tr")].map(tr =>
      [...tr.querySelectorAll("th, td")]
        .map(td => cleanText(td.innerText || td.textContent))
    );

    const nonEmptyRows = rows.filter(r => r.some(c => c));

    if (nonEmptyRows.length === 0) return;

    results.push({
      id: "semantic-" + i,
      type: "semantic",
      root: table,
      confidence: 1.0,
      headers: nonEmptyRows[0],
      rows: nonEmptyRows
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
 *  REPEATED DIV TABLES
 ***********************/
function detectRepeatedDivTables() {
  const results = [];
  const parents = [...document.querySelectorAll("div, li, section, article")];

  parents.forEach((parent, idx) => {
    if (!isVisible(parent)) return;

    const children = [...parent.children].filter(isVisible);
    if (children.length < 3) return;
    if (!sameTag(children)) return;

    const rows = children
      .map(row => extractDivRow(row))
      .filter(r => r.length >= 2);

    if (rows.length < 3) return;
    if (!similarLengths(rows)) return;

    results.push({
      id: "repeated-" + idx,
      type: "repeated-div",
      root: parent,
      confidence: 0.7,
      headers: [],
      rows
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

    const maxCols = Math.max(...grid.map(r => r.length));
    if (maxCols < 2) return;

    results.push({
      id: "grid-" + idx,
      type: "grid-flex",
      root: el,
      confidence: 0.6,
      headers: [],
      rows: grid
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

  console.log("Detected tables:", tables);
  window.__WEB_TABLES__ = tables;
}

scanPage();
function highlightTables(tables) {
  tables.forEach(t => {
    const r = t.root.getBoundingClientRect();
    const box = document.createElement("div");

    box.style.position = "fixed";
    box.style.top = r.top + "px";
    box.style.left = r.left + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
    box.style.border = 
      t.type === "semantic" ? "3px solid lime" :
      t.type === "repeated-div" ? "3px solid orange" :
      "3px solid cyan";

    box.style.zIndex = 999999;
    box.style.pointerEvents = "none";

    const label = document.createElement("div");
    label.textContent = t.type;
    label.style.background = "black";
    label.style.color = "white";
    label.style.fontSize = "12px";
    label.style.position = "absolute";
    label.style.top = "0";
    label.style.left = "0";
    label.style.padding = "2px 4px";

    box.appendChild(label);
    document.body.appendChild(box);
  });
}
highlightTables(tables);


/***********************
 *  HELPERS
 ***********************/
function isVisible(el) {
  const r = el.getBoundingClientRect();
  return !!(r.width > 5 && r.height > 5);
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


