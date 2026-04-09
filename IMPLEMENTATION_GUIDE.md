# Sidebar Implementation Guide

## ✅ What's Done (So Far)

1. ✅ **Table detection pipeline**
   - `content.js` detects:
     - Semantic `<table>` elements
     - Repeated `<div>`-based tables
     - CSS grid / flex-based tables
   - All detected tables are stored in `window.__WEB_TABLES__` with:
     - `id`, `type`, `headers`, `rows`, and a reference to the DOM `root` element
2. ✅ **Sidebar UI & styling**
   - `sidebar.js` implements the SQL Query Builder sidebar
   - `sidebar.css` provides the full layout and visual design
   - Sidebar is toggled via a floating 🔍 button in the bottom‑right
3. ✅ **Communication between detector and sidebar**
   - After each scan, `content.js` calls `window.__SQL_SIDEBAR__.updateTables(tables)` (if available)
   - Sidebar reads from `window.__WEB_TABLES__` to render the list of detected tables
4. ✅ **Table selection, highlighting, and naming**
   - Each detected table gets a user‑friendly `displayName` (`Table 1`, `Table 2`, …)
   - Clicking a table card:
     - Highlights the corresponding table DOM element on the page
     - Scrolls it smoothly into view
     - Syncs the dropdown selection
   - Double‑clicking a table card:
     - Opens the Query tab
     - Loads columns and enables query building
   - Selecting a table from the dropdown behaves like an explicit “use for query” and opens the Query tab
5. ✅ **Query engine integration**
   - `query-engine.js` provides:
     - `executeQuery(queryState)` to run queries on in‑memory table data
     - `generateSQL(queryState)` to build a human‑readable SQL string
   - SQL preview uses:
     - Selected column headers
     - Friendly table name (`displayName` if available, otherwise `id`)

---


## Current Features

### ✅ Working:
- Sidebar toggle (open/close)
- Table detection display
- Table selection
- Column selection
- SQL preview generation
- Basic query execution
- Results display

###  Next Steps (To Implement):
- Filter builder (WHERE clause)
- Sorting (ORDER BY)
- LIMIT/OFFSET options
- SQL mode (direct SQL input)
- JOIN support
- Export results

---



##  Future Plan

This section summarizes the planned work, so it’s clear what has been completed and what comes next.

### Phase 1: Polish Current Flow (Short Term)
1. **Interaction UX**
   - Fine‑tune single vs double‑click behavior on table cards
   - Add small hint text in the Tables tab (e.g., “Single‑click to highlight, double‑click to build a query”)
   - Improve highlight styling for accessibility (contrast, focus states)

2. **Table metadata**
   - Allow user to rename `Table 1`, `Table 2`, … to custom names
   - Persist chosen names per page 

3. **Robustness**
   - Handle tables with no headers more gracefully (auto‑generated column names)
   - Better error messages when `window.__WEB_TABLES__` is empty or malformed

### Phase 2: Enhanced Query Builder (Core Features)
1. **Filter Builder (WHERE clause)**
   - Add a “Filters” section in the Query tab
   - UI for:
     - Column selection
     - Operator (`=`, `!=`, `>`, `<`, `LIKE`, etc.)
     - Value input
     - AND/OR chaining between multiple conditions
   - Wire this into `queryState.filters` and `query-engine.js::filterRows`

2. **Sorting (ORDER BY)**
   - Add a “Sort” section in the Query tab
   - Choose one or more columns + ASC/DESC direction
   - Feed into `queryState.sort` and `query-engine.js::sortRows`

3. **Limit/Offset Controls**
   - Inputs for LIMIT and OFFSET (already supported in `queryState`)
   - Make them visible and editable in the UI

### Phase 3: Advanced Power-User Features
1. **SQL Mode**
   - Optional text editor where advanced users can type SQL directly
   - Parse and map the SQL to the in‑memory data model where possible

2. **Multi‑table / JOIN Support**
   - UI to select multiple detected tables
   - Basic JOIN builder (INNER / LEFT JOIN) based on matching column names

3. **Export & Sharing**
   - Export results as CSV / JSON
   - “Copy as table” and “Copy as SQL” to clipboard

---



