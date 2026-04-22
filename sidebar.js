/***********************
 *  SQL QUERY BUILDER SIDEBAR
 ***********************/

(function() {
  'use strict';

  // Check if sidebar already exists
  if (document.getElementById('sql-query-sidebar')) {
    return;
  }

  let sidebarOpen = false;
  let selectedTable = null;
  let highlightedElement = null;
  let lastWorkHeaderSignature = '';
  let lastResults = [];
  let queryState = {
    table: null,
    columns: [],
    filters: [],
    sort: [],
    limit: 100,
    offset: 0,
    join: {
      enabled: false,
      rightTable: null,
      leftColumnIndex: 0,
      rightColumnIndex: 0,
      type: 'INNER'
    },
    groupBy: {
      enabled: false,
      groupIndices: [],
      aggregates: []
    }
  };

  /***********************
   *  CREATE SIDEBAR
   ***********************/
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'sql-query-sidebar';
    sidebar.className = 'sql-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>🔍 SQL Query Builder</h2>
      </div>
      <div class="sidebar-tabs">
        <button class="sidebar-tab active" data-tab="tables">📊 Tables</button>
        <button class="sidebar-tab" data-tab="query">🔍 Query</button>
        <button class="sidebar-tab" data-tab="results">📈 Results</button>
      </div>
      <div class="sidebar-content">
        <div class="tab-content active" id="tablesTab">
          <div class="tables-list" id="tablesList">
            <div class="empty-state">
              <div class="empty-icon">📊</div>
              <div class="empty-text">Scanning for tables...</div>
            </div>
          </div>
        </div>
        <div class="tab-content" id="queryTab">
          <div class="query-section">
            <div class="section-title">Select Table</div>
            <select class="dropdown" id="tableSelect">
              <option value="">-- Select Table --</option>
            </select>
          </div>
          <div class="query-section">
            <div class="section-title">Select Columns</div>
            <div class="columns-grid" id="columnsGrid"></div>
          </div>
          <div class="query-section" id="joinSection">
            <div class="section-title">Join (optional)</div>
            <label class="inline-check">
              <input type="checkbox" id="joinEnabled"> Join with another table (INNER JOIN)
            </label>
            <p class="hint-text" id="joinHint" style="display: none;">
              Need at least 2 detected tables on this page to use JOIN.
            </p>
            <div id="joinControls" class="join-controls" style="display: none;">
              <label class="mini-label">Join type</label>
              <select class="dropdown" id="joinTypeSelect">
                <option value="INNER">INNER JOIN</option>
                <option value="LEFT OUTER">LEFT OUTER JOIN</option>
              </select>
              <label class="mini-label">Right table</label>
              <select class="dropdown" id="joinRightSelect">
                <option value="">— Select table —</option>
              </select>
              <label class="mini-label">Left column (from selected table)</label>
              <select class="dropdown" id="joinLeftCol"></select>
              <label class="mini-label">Right column (from joined table)</label>
              <select class="dropdown" id="joinRightCol"></select>
            </div>
          </div>
          <div class="query-section" id="whereSection">
            <div class="section-title">Filter (WHERE, optional)</div>
            <label class="mini-label">Column</label>
            <select class="dropdown" id="whereColumn">
              <option value="">-- No filter --</option>
            </select>
            <label class="mini-label">Operator</label>
            <select class="dropdown" id="whereOperator">
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="LIKE">LIKE</option>
              <option value="NOT LIKE">NOT LIKE</option>
            </select>
            <label class="mini-label">Value</label>
            <input type="text" id="whereValue" class="dropdown" style="margin-bottom: 0;" placeholder="e.g. 100 or 'Alice'">
          </div>
          <div class="query-section" id="orderBySection">
            <div class="section-title">Order by (optional)</div>
            <label class="mini-label">Column</label>
            <select class="dropdown" id="orderColumn">
              <option value="">-- No ordering --</option>
            </select>
            <label class="mini-label">Direction</label>
            <select class="dropdown" id="orderDirection">
              <option value="ASC">ASC</option>
              <option value="DESC">DESC</option>
            </select>
          </div>
          <div class="query-section">
            <div class="section-title">Generated SQL</div>
            <div class="sql-preview" id="sqlPreview">SELECT ...\nFROM ...</div>
          </div>
          <button class="btn-primary" id="runBtn" disabled>▶ Run Query</button>
          <button class="btn-primary btn-secondary" id="clearAllBtn">🗑 Clear All</button>
          <div class="query-section">
            <div class="section-title">Run SQL Directly</div>
            <textarea id="sqlEditor" class="sql-editor" placeholder="SELECT * FROM Table 1;"></textarea>
            <button class="btn-primary btn-secondary" id="runSqlBtn">▶ Run SQL</button>
            <div id="sqlMessage" class="hint-text" style="margin-top: 8px;"></div>
          </div>
          <div class="query-section">
            <div class="section-title">Table Export</div>
            <div class="action-row">
              <button class="btn-primary btn-secondary" id="saveTableCsvBtn">Save Table CSV</button>
            </div>
          </div>
        </div>
        <div class="tab-content" id="resultsTab">
          <div class="empty-state" id="emptyResults">
            <div class="empty-icon">📊</div>
            <div class="empty-text">No results yet.<br>Run a query to see results here.</div>
          </div>
          <div class="results-section" id="resultsSection" style="display: none;">
            <div class="results-header">
              <div><strong>Query Results</strong></div>
              <div>Rows: <span id="rowCount">0</span> | Time: <span id="execTime">0.00s</span></div>
            </div>
            <div class="action-row">
              <button class="btn-primary btn-secondary" id="copyResultsBtn">Copy Results</button>
              <button class="btn-primary btn-secondary" id="saveResultsCsvBtn">Save Results CSV</button>
            </div>
            <div id="resultsMessage" class="hint-text" style="margin-top: 6px;"></div>
            <div class="results-container">
              <table class="results-table" id="resultsTable"></table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    setupEventListeners();
    loadTables();
  }

  /***********************
   *  CREATE TOGGLE BUTTON
   ***********************/
  function createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sql-sidebar-toggle';
    toggleBtn.className = 'sql-sidebar-toggle';
    toggleBtn.innerHTML = '🔍';
    toggleBtn.title = 'Toggle SQL Query Builder';
    toggleBtn.onclick = () => window.__SQL_SIDEBAR__.toggle();
    document.body.appendChild(toggleBtn);
  }

  /***********************
   *  SETUP EVENT LISTENERS
   ***********************/
  function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
      });
    });

    // Table selection
    document.getElementById('tableSelect').addEventListener('change', handleTableSelect);
    
    // Run query button
    document.getElementById('runBtn').addEventListener('click', runQuery);

    const joinEnabled = document.getElementById('joinEnabled');
    const joinRightSelect = document.getElementById('joinRightSelect');
    joinEnabled.addEventListener('change', () => {
      document.getElementById('joinControls').style.display = joinEnabled.checked ? 'block' : 'none';
      refreshJoinAndGroupUi();
    });
    joinRightSelect.addEventListener('change', () => {
      populateJoinColumnSelects();
      refreshJoinAndGroupUi();
    });
    document.getElementById('joinLeftCol').addEventListener('change', refreshJoinAndGroupUi);
    document.getElementById('joinRightCol').addEventListener('change', refreshJoinAndGroupUi);
    document.getElementById('joinTypeSelect').addEventListener('change', refreshJoinAndGroupUi);

    const whereColumn = document.getElementById('whereColumn');
    const whereOperator = document.getElementById('whereOperator');
    const whereValue = document.getElementById('whereValue');
    whereColumn.addEventListener('change', updateSQL);
    whereOperator.addEventListener('change', updateSQL);
    whereValue.addEventListener('input', updateSQL);

    const orderColumn = document.getElementById('orderColumn');
    const orderDirection = document.getElementById('orderDirection');
    orderColumn.addEventListener('change', updateSQL);
    orderDirection.addEventListener('change', updateSQL);

    document.getElementById('runSqlBtn').addEventListener('click', runDirectSQL);
    document.getElementById('copyResultsBtn').addEventListener('click', copyResultsToClipboard);
    document.getElementById('saveResultsCsvBtn').addEventListener('click', saveResultsCsv);
    document.getElementById('saveTableCsvBtn').addEventListener('click', saveCurrentTableCsv);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllSelections);
  }

  function refreshJoinAndGroupUi() {
    const headers = getWorkHeaders();
    const signature = headers.join('\x1f');
    if (signature !== lastWorkHeaderSignature) {
      buildSelectColumnsGrid(headers, true);
      lastWorkHeaderSignature = signature;
    }
    updateSQL();
  }

  function populateJoinRightSelect() {
    const sel = document.getElementById('joinRightSelect');
    const joinEnabled = document.getElementById('joinEnabled');
    const joinHint = document.getElementById('joinHint');
    const tables = window.__WEB_TABLES__ || [];
    const currentId = queryState.table ? queryState.table.id : '';
    const prev = sel.value;
    let eligibleCount = 0;
    sel.innerHTML = '<option value="">— Select table —</option>';
    tables.forEach((t) => {
      if (t.id === currentId) return;
      eligibleCount += 1;
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.displayName || t.id;
      sel.appendChild(opt);
    });
    if (prev && sel.querySelector(`option[value="${prev}"]`)) {
      sel.value = prev;
    }
    const canJoin = eligibleCount > 0;
    joinEnabled.disabled = !canJoin;
    if (!canJoin) {
      joinEnabled.checked = false;
      document.getElementById('joinControls').style.display = 'none';
    }
    joinHint.style.display = canJoin ? 'none' : 'block';
  }

  function populateJoinColumnSelects() {
    const leftSel = document.getElementById('joinLeftCol');
    const rightSel = document.getElementById('joinRightSelect');
    const joinRightCol = document.getElementById('joinRightCol');
    const tables = window.__WEB_TABLES__ || [];
    const left = queryState.table;
    const right = tables.find((t) => t.id === rightSel.value);
    const prevLeft = leftSel.value;
    const prevRight = joinRightCol.value;

    leftSel.innerHTML = '';
    const lh = (left && left.headers) ? left.headers : [];
    lh.forEach((h, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h || `Column ${i + 1}`;
      leftSel.appendChild(opt);
    });
    if (prevLeft && leftSel.querySelector(`option[value="${prevLeft}"]`)) {
      leftSel.value = prevLeft;
    }

    joinRightCol.innerHTML = '';
    const rh = (right && right.headers) ? right.headers : [];
    rh.forEach((h, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h || `Column ${i + 1}`;
      joinRightCol.appendChild(opt);
    });
    if (prevRight && joinRightCol.querySelector(`option[value="${prevRight}"]`)) {
      joinRightCol.value = prevRight;
    }
  }

  function getJoinConfigFromUi() {
    const joinEnabled = document.getElementById('joinEnabled').checked;
    const rightId = document.getElementById('joinRightSelect').value;
    const tables = window.__WEB_TABLES__ || [];
    const rightTable = joinEnabled && rightId ? tables.find((t) => t.id === rightId) : null;
    const leftCol = parseInt(document.getElementById('joinLeftCol').value, 10);
    const rightCol = parseInt(document.getElementById('joinRightCol').value, 10);
    return {
      enabled: joinEnabled && !!rightTable,
      rightTable,
      leftColumnIndex: Number.isFinite(leftCol) ? leftCol : 0,
      rightColumnIndex: Number.isFinite(rightCol) ? rightCol : 0,
      type: document.getElementById('joinTypeSelect').value || 'INNER'
    };
  }

  function getWorkHeaders() {
    if (!queryState.table || !window.__QUERY_ENGINE__) {
      return queryState.table && queryState.table.headers ? [...queryState.table.headers] : [];
    }
    const join = getJoinConfigFromUi();
    const wh = window.__QUERY_ENGINE__.getWorkingRowsAndHeaders({
      table: queryState.table,
      join
    });
    return wh.headers && wh.headers.length ? wh.headers : (queryState.table.headers || []);
  }

  function getCurrentSelectedColumnIndices() {
    const checks = document.querySelectorAll('#columnsGrid input[type="checkbox"]:checked');
    return Array.from(checks).map((cb) => parseInt(cb.dataset.column, 10)).filter((i) => Number.isFinite(i));
  }

  function getWhereOrderState() {
    const whereColumn = document.getElementById('whereColumn');
    const whereOperator = document.getElementById('whereOperator');
    const whereValue = document.getElementById('whereValue');
    const orderColumn = document.getElementById('orderColumn');
    const orderDirection = document.getElementById('orderDirection');
    return {
      whereColumn: whereColumn ? whereColumn.value : '',
      whereOperator: whereOperator ? whereOperator.value : '=',
      whereValue: whereValue ? whereValue.value : '',
      orderColumn: orderColumn ? orderColumn.value : '',
      orderDirection: orderDirection ? orderDirection.value : 'ASC'
    };
  }

  function applyWhereOrderState(headersLength, state) {
    const whereColumn = document.getElementById('whereColumn');
    const whereOperator = document.getElementById('whereOperator');
    const whereValue = document.getElementById('whereValue');
    const orderColumn = document.getElementById('orderColumn');
    const orderDirection = document.getElementById('orderDirection');

    if (!state) return;
    if (whereColumn && state.whereColumn && Number(state.whereColumn) < headersLength) {
      whereColumn.value = state.whereColumn;
    }
    if (whereOperator && state.whereOperator) {
      whereOperator.value = state.whereOperator;
    }
    if (whereValue && typeof state.whereValue === 'string') {
      whereValue.value = state.whereValue;
    }
    if (orderColumn && state.orderColumn && Number(state.orderColumn) < headersLength) {
      orderColumn.value = state.orderColumn;
    }
    if (orderDirection && state.orderDirection) {
      orderDirection.value = state.orderDirection;
    }
  }

  function buildSelectColumnsGrid(headers, preserveSelection) {
    const columnsGrid = document.getElementById('columnsGrid');
    if (!columnsGrid) return;
    const prevSelected = preserveSelection ? getCurrentSelectedColumnIndices() : [];

    columnsGrid.innerHTML = headers.map((col, index) => `
      <label class="column-checkbox">
        <input type="checkbox" ${!preserveSelection || prevSelected.includes(index) ? 'checked' : ''} data-column="${index}"> ${col || `Column ${index + 1}`}
      </label>
    `).join('');

    columnsGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updateSQL);
    });

    const whereColumn = document.getElementById('whereColumn');
    const orderColumn = document.getElementById('orderColumn');
    if (whereColumn && orderColumn) {
      const prevWhereOrder = getWhereOrderState();
      whereColumn.innerHTML = '<option value="">-- No filter --</option>';
      orderColumn.innerHTML = '<option value="">-- No ordering --</option>';
      headers.forEach((col, index) => {
        const text = col || `Column ${index + 1}`;
        const optWhere = document.createElement('option');
        optWhere.value = String(index);
        optWhere.textContent = text;
        whereColumn.appendChild(optWhere);

        const optOrder = document.createElement('option');
        optOrder.value = String(index);
        optOrder.textContent = text;
        orderColumn.appendChild(optOrder);
      });
      applyWhereOrderState(headers.length, prevWhereOrder);
    }
  }

  function getCurrentGroupSelections() {
    const grid = document.getElementById('groupByGrid');
    const selections = {
      grouped: {},
      aggregates: {}
    };
    if (!grid) return selections;

    grid.querySelectorAll('.groupby-chk').forEach((chk) => {
      selections.grouped[chk.dataset.col] = chk.checked;
    });
    grid.querySelectorAll('.groupby-agg').forEach((sel) => {
      selections.aggregates[sel.dataset.col] = sel.value;
    });
    return selections;
  }

  function applyGroupSelections(grid, selections) {
    if (!grid || !selections) return;
    grid.querySelectorAll('.groupby-chk').forEach((chk) => {
      if (selections.grouped[chk.dataset.col] === true) {
        chk.checked = true;
      }
    });
    grid.querySelectorAll('.groupby-agg').forEach((sel) => {
      const chosen = selections.aggregates[sel.dataset.col];
      if (chosen) {
        sel.value = chosen;
      }
    });
    grid.querySelectorAll('.groupby-row').forEach((row) => {
      const chk = row.querySelector('.groupby-chk');
      const agg = row.querySelector('.groupby-agg');
      if (chk && agg) {
        agg.disabled = chk.checked;
        if (chk.checked) agg.value = '';
      }
    });
  }

  function buildGroupByGrid(headersOverride, preserveSelection) {
    const grid = document.getElementById('groupByGrid');
    if (!grid || !queryState.table) return;

    const prev = preserveSelection ? getCurrentGroupSelections() : null;
    const headers = headersOverride || getWorkHeaders();
    if (!headers.length) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = headers.map((h, i) => `
      <div class="groupby-row" data-col="${i}">
        <span class="groupby-name" title="${escapeHtml(h)}">${escapeHtml(h)}</span>
        <label class="groupby-g">
          <input type="checkbox" class="groupby-chk" data-col="${i}"> Group
        </label>
        <select class="groupby-agg dropdown" data-col="${i}">
          <option value="">—</option>
          <option value="SUM">SUM</option>
          <option value="AVG">AVG</option>
          <option value="MIN">MIN</option>
          <option value="MAX">MAX</option>
          <option value="COUNT">COUNT</option>
        </select>
      </div>
    `).join('');

    grid.querySelectorAll('.groupby-chk').forEach((chk) => {
      chk.addEventListener('change', () => {
        const col = parseInt(chk.dataset.col, 10);
        const row = grid.querySelector(`.groupby-row[data-col="${col}"]`);
        const agg = row && row.querySelector('.groupby-agg');
        if (agg) {
          agg.disabled = chk.checked;
          if (chk.checked) agg.value = '';
        }
        updateSQL();
      });
    });
    grid.querySelectorAll('.groupby-agg').forEach((sel) => {
      sel.addEventListener('change', updateSQL);
    });

    if (prev) {
      applyGroupSelections(grid, prev);
    }
  }

  function collectQueryState() {
    if (!queryState.table) return null;

    const join = getJoinConfigFromUi();
    const headers = getWorkHeaders();

    const checkboxes = document.querySelectorAll('#columnsGrid input[type="checkbox"]:checked');
    const selectedIndices = Array.from(checkboxes).map((cb) => parseInt(cb.dataset.column, 10));

    const filters = [];
    const whereColumn = document.getElementById('whereColumn');
    const whereOperator = document.getElementById('whereOperator');
    const whereValue = document.getElementById('whereValue');
    if (whereColumn && whereOperator && whereValue) {
      const colIdx = parseInt(whereColumn.value, 10);
      const val = whereValue.value;
      if (Number.isFinite(colIdx) && colIdx >= 0 && colIdx < headers.length && val && val.trim() !== '') {
        filters.push({
          columnIndex: colIdx,
          operator: whereOperator.value || '=',
          value: val,
          logic: 'AND'
        });
      }
    }

    const sort = [];
    const orderColumn = document.getElementById('orderColumn');
    const orderDirection = document.getElementById('orderDirection');
    if (orderColumn && orderDirection) {
      const colIdx = parseInt(orderColumn.value, 10);
      if (Number.isFinite(colIdx) && colIdx >= 0 && colIdx < headers.length) {
        const colName = headers[colIdx] || `Column ${colIdx + 1}`;
        sort.push({
          column: colName,
          direction: (orderDirection.value || 'ASC').toUpperCase()
        });
      }
    }

    return {
      table: queryState.table,
      columns: selectedIndices,
      filters,
      sort,
      limit: queryState.limit,
      offset: queryState.offset || 0,
      join,
      groupBy: {
        enabled: false,
        groupIndices: [],
        aggregates: []
      }
    };
  }

  /***********************
   *  TAB SWITCHING
   ***********************/
  function switchTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  /***********************
   *  LOAD TABLES
   ***********************/
  function loadTables() {
    const tables = window.__WEB_TABLES__ || [];
    const tablesList = document.getElementById('tablesList');
    const tableSelect = document.getElementById('tableSelect');

    // Remember what was selected before reload
    const previouslySelectedId =
      (selectedTable && selectedTable.id) ||
      (tableSelect && tableSelect.value) ||
      '';

    // Clear existing
    tablesList.innerHTML = '';
    tableSelect.innerHTML = '<option value=\"\">-- Select Table --</option>';

    if (tables.length === 0) {
      tablesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-text">No tables detected on this page.</div>
        </div>
      `;
      return;
    }

    // Create table cards
    tables.forEach((table, index) => {
      // Assign a friendly display name if not already present
      if (!table.displayName) {
        table.displayName = `Table ${index + 1}`;
      }

      const card = createTableCard(table, index);
      tablesList.appendChild(card);

      // Add to dropdown
      const option = document.createElement('option');
      option.value = table.id;
      option.textContent = `${table.displayName} (${table.type})`;
      tableSelect.appendChild(option);
    });

    // Restore selection in dropdown if possible
    if (previouslySelectedId) {
      const optionExists = !!tableSelect.querySelector(`option[value=\"${previouslySelectedId}\"]`);
      tableSelect.value = optionExists ? previouslySelectedId : '';
    }
  }

  /***********************
   *  CREATE TABLE CARD
   ***********************/
  function createTableCard(table, index) {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.dataset.tableId = table.id;
    
    const headers = table.headers || [];
    const rowCount = table.rows ? table.rows.length : 0;
    const colCount = headers.length || (table.rows && table.rows[0] ? table.rows[0].length : 0);
    const preview = headers.slice(0, 4).join(', ') || 'No headers';
    const displayName = table.displayName || table.id;

    card.innerHTML = `
      <div class="table-header">
        <span class="table-name">${displayName}</span>
        <span class="table-badge badge-${table.type}">${table.type}</span>
      </div>
      <div class="table-info">${colCount} columns • ${rowCount} rows</div>
      <div class="table-preview">${preview}</div>
    `;

    // Single-click: just select & highlight table, stay on current tab
    card.addEventListener('click', () => {
      focusTable(table);
    });

    // Double-click: open query builder for this table
    card.addEventListener('dblclick', () => {
      selectTable(table);
      switchTab('query');
    });

    return card;
  }

  /***********************
   *  FOCUS TABLE (shared selection logic)
   ***********************/
  function focusTable(table) {
    if (!table) return;

    selectedTable = table;

    // Update UI selection
    document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-table-id="${table.id}"]`)?.classList.add('selected');

    // Sync dropdown
    const tableSelect = document.getElementById('tableSelect');
    if (tableSelect) {
      tableSelect.value = table.id;
    }

    // Highlight corresponding table on the page
    highlightTableInPage(table);
  }

  /***********************
   *  SELECT TABLE (for querying)
   ***********************/
  function selectTable(table) {
    if (!table) return;

    // Focus & highlight first
    focusTable(table);

    // Load columns for query builder
    loadTableColumns(table);
  }

  /***********************
   *  HANDLE TABLE SELECT
   ***********************/
  function handleTableSelect(e) {
    const tableId = e.target.value;
    if (!tableId) return;

    const tables = window.__WEB_TABLES__ || [];
    const table = tables.find(t => t.id === tableId);
    if (table) {
      selectTable(table);
      switchTab('query');
    }
  }

  /***********************
   *  HIGHLIGHT TABLE IN PAGE
   ***********************/
  function highlightTableInPage(table) {
    if (!table || !table.root) return;

    // Remove previous highlight
    if (highlightedElement && highlightedElement !== table.root) {
      highlightedElement.classList.remove('sql-highlighted-table');
    }

    highlightedElement = table.root;
    highlightedElement.classList.add('sql-highlighted-table');

    // Bring table into view
    try {
      table.root.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch (e) {
      table.root.scrollIntoView();
    }
  }

  /***********************
   *  OPEN QUERY TAB FOR TABLE ID
   ***********************/
  function openQueryForTableId(tableId) {
    if (!tableId) return;
    const tables = window.__WEB_TABLES__ || [];
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    selectTable(table);
    // Ensure the dropdown reflects the selected table
    const tableSelect = document.getElementById('tableSelect');
    if (tableSelect) {
      tableSelect.value = tableId;
    }
    switchTab('query');
  }

  /***********************
   *  LOAD TABLE COLUMNS
   ***********************/
  function loadTableColumns(table) {
    const headers = table.headers || [];
    
    queryState.table = table;
    queryState.columns = headers.map((_, i) => i); // Default: all columns
    lastWorkHeaderSignature = '';

    if (headers.length === 0) {
      document.getElementById('columnsGrid').innerHTML = '<div class="empty-text">No columns detected</div>';
      return;
    }

    populateJoinRightSelect();
    populateJoinColumnSelects();
    document.getElementById('columnsGrid').style.display = 'grid';

    buildSelectColumnsGrid(getWorkHeaders(), false);
    lastWorkHeaderSignature = getWorkHeaders().join('\x1f');
    updateSQL();
    document.getElementById('runBtn').disabled = false;
  }

  /***********************
   *  UPDATE SQL PREVIEW
   ***********************/
  function updateSQL() {
    if (!queryState.table) return;

    const qs = collectQueryState();
    if (!qs) return;
    queryState.columns = qs.columns;

    // Use query engine to generate SQL
    if (window.__QUERY_ENGINE__) {
      const sql = window.__QUERY_ENGINE__.generateSQL(qs, {
        tables: window.__WEB_TABLES__ || []
      });
      document.getElementById('sqlPreview').textContent = sql;
    } else {
      // Fallback if query engine not loaded
      const selectedColumns = qs.columns.map(index => {
        return queryState.table.headers[index] || `Column ${index + 1}`;
      });
      if (selectedColumns.length === 0) {
        document.getElementById('sqlPreview').textContent = 'SELECT ...\nFROM ...';
        return;
      }
      const tableName = queryState.table.displayName || queryState.table.id;
      let sql = `SELECT ${selectedColumns.length ? selectedColumns.join(', ') : '*'}\nFROM ${tableName}`;
      if (queryState.limit) {
        sql += `\nLIMIT ${queryState.limit}`;
      }
      document.getElementById('sqlPreview').textContent = sql;
    }
  }

  /***********************
   *  RUN QUERY
   ***********************/
  async function runQuery() {
    if (!queryState.table) return;

    const qs = collectQueryState();
    if (!qs) return;
    queryState.columns = qs.columns;

    // Ensure default values
    if (!qs.filters) qs.filters = [];
    if (!qs.sort) qs.sort = [];
    if (!qs.limit) qs.limit = 100;
    if (!qs.offset) qs.offset = 0;

    // Execute query using the same SQL engine path as direct SQL (AlaSQL)
    if (window.__QUERY_ENGINE__) {
      const sql = window.__QUERY_ENGINE__.generateSQL(qs, {
        tables: window.__WEB_TABLES__ || []
      });
      const out = await window.__QUERY_ENGINE__.executeSQL(sql, {
        tables: window.__WEB_TABLES__ || [],
        selectedTable: queryState.table
      });
      if (out.kind === 'error') {
        const msg = document.getElementById('sqlMessage');
        if (msg) msg.textContent = out.message || 'SQL execution failed.';
        return;
      }
      displayResults(out.results || [], out.executionTime || 0);
      switchTab('results');
      return;
    } else {
      // Fallback: simple execution (old method)
      console.warn('Query engine not loaded, using fallback');
      let results = [];
      let execTime = 0;
      results = queryState.table.rows.map(row => {
        const result = {};
        qs.columns.forEach(index => {
          const colName = queryState.table.headers[index] || `Column ${index + 1}`;
          result[colName] = row[index] || '';
        });
        return result;
      });
      if (qs.limit) {
        results = results.slice(0, qs.limit);
      }
      execTime = 0.001;
      // Display results
      displayResults(results, execTime);
      // Switch to results tab
      switchTab('results');
      return;
    }
  }

  /***********************
   *  DISPLAY RESULTS
   ***********************/
  function displayResults(results, execTime) {
    const emptyResults = document.getElementById('emptyResults');
    const resultsSection = document.getElementById('resultsSection');
    const resultsTable = document.getElementById('resultsTable');
    const rowCount = document.getElementById('rowCount');
    const execTimeEl = document.getElementById('execTime');

    if (results.length === 0) {
      emptyResults.style.display = 'block';
      resultsSection.style.display = 'none';
      lastResults = [];
      return;
    }

    emptyResults.style.display = 'none';
    resultsSection.style.display = 'block';

    // Get column names
    const columns = Object.keys(results[0]);

    // Create table
    let html = '<thead><tr>';
    columns.forEach(col => {
      html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    results.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        html += `<td>${escapeHtml(row[col] || '')}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';

    resultsTable.innerHTML = html;
    rowCount.textContent = results.length;
    execTimeEl.textContent = `${execTime}s`;
    lastResults = Array.isArray(results) ? results : [];
  }

  function escapeCsv(value) {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function makeCsvFromObjects(rows) {
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const lines = [cols.map(escapeCsv).join(',')];
    rows.forEach((row) => {
      lines.push(cols.map((c) => escapeCsv(row[c])).join(','));
    });
    return lines.join('\n');
  }

  function makeCsvFromTable(table) {
    if (!table) return '';
    const headers = table.headers || [];
    const rows = table.rows || [];
    const lines = [headers.map(escapeCsv).join(',')];
    rows.forEach((row) => {
      const vals = headers.map((_, i) => row[i]);
      lines.push(vals.map(escapeCsv).join(','));
    });
    return lines.join('\n');
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function showResultsMessage(text) {
    const el = document.getElementById('resultsMessage');
    if (!el) return;
    el.textContent = text || '';
  }

  async function copyResultsToClipboard() {
    if (!lastResults.length) {
      showResultsMessage('No results to copy.');
      return;
    }
    const csv = makeCsvFromObjects(lastResults);
    try {
      await navigator.clipboard.writeText(csv);
      showResultsMessage('Copied to clipboard.');
    } catch (e) {
      console.warn('Clipboard write failed:', e);
      showResultsMessage('Clipboard copy failed.');
    }
  }

  function saveResultsCsv() {
    if (!lastResults.length) return;
    const csv = makeCsvFromObjects(lastResults);
    downloadTextFile('query-results.csv', csv, 'text/csv;charset=utf-8');
  }

  function saveCurrentTableCsv() {
    if (!queryState.table) return;
    const csv = makeCsvFromTable(queryState.table);
    const base = (queryState.table.displayName || queryState.table.id || 'table').replace(/[^a-z0-9_\-]/gi, '_');
    downloadTextFile(`${base}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function syncAfterMutation() {
    if (window.__WEB_TABLES__) {
      loadTables();
    }
    updateSQL();
  }

  function setSqlMessage(text, type) {
    const msg = document.getElementById('sqlMessage');
    if (!msg) return;
    msg.textContent = text || '';
    msg.style.color = type === 'error' ? '#b91c1c' : '';
  }

  function formatDirectSqlErrorMessage(rawMessage, sqlText) {
    const msg = String(rawMessage || '').trim();
    if (!msg) return 'SQL execution failed.';

    const normalized = msg.replace(/\s+/g, ' ').trim();
    const nearMatch = normalized.match(/\bnear\b\s+["'`]?([^"'`\s,;()]+)["'`]?/i);
    const lineColMatch = normalized.match(/\bline\s+(\d+)\s*(?:[,;]?\s*(?:col|column)\s+(\d+))?/i);
    const expectedMatch = normalized.match(/\bexpected\b[:\s]+(.+)$/i);

    const details = [];
    if (lineColMatch) {
      const ln = lineColMatch[1];
      const col = lineColMatch[2];
      details.push(col ? `line ${ln}, column ${col}` : `line ${ln}`);
    }
    if (nearMatch) {
      details.push(`near "${nearMatch[1]}"`);
    }
    if (expectedMatch) {
      details.push(`expected ${expectedMatch[1]}`);
    }

    if (/syntax|parse|unexpected token|unexpected end|expected/i.test(normalized)) {
      return `SQL syntax error${details.length ? ` (${details.join(', ')})` : ''}: ${msg}`;
    }
    if (/no such table|table .* does not exist|unknown table/i.test(normalized)) {
      return `Table error: ${msg}`;
    }
    if (/no such column|unknown column|column .* not found|cannot resolve column/i.test(normalized)) {
      return `Column error: ${msg}`;
    }
    if (/timed out waiting for sql engine response/i.test(normalized)) {
      return 'SQL engine timed out. Try a simpler query or re-open the page.';
    }
    if (/alasql is not loaded/i.test(normalized)) {
      return 'SQL engine is unavailable on this page. Refresh the page and try again.';
    }

    // Fallback: include first SQL line context for easier debugging.
    const firstLine = String(sqlText || '').split(/\r?\n/).find((line) => line.trim()) || '';
    return firstLine
      ? `SQL error: ${msg} | Query starts with: ${firstLine.slice(0, 80)}`
      : `SQL error: ${msg}`;
  }

  async function runDirectSQL() {
    const editor = document.getElementById('sqlEditor');

    if (!window.__QUERY_ENGINE__) {
      setSqlMessage('Query engine not loaded.', 'error');
      return;
    }

    const sql = (editor.value || '').trim();
    if (!sql) {
      setSqlMessage('Enter SQL first.', 'error');
      return;
    }

    setSqlMessage('', 'info');

    try {
      const out = await window.__QUERY_ENGINE__.executeSQL(sql, {
        tables: window.__WEB_TABLES__ || [],
        selectedTable: queryState.table
      });

      if (out.kind === 'error') {
        setSqlMessage(formatDirectSqlErrorMessage(out.message, sql), 'error');
        return;
      }

      if (out.kind === 'query') {
        displayResults(out.results || [], out.executionTime || 0);
        switchTab('results');
        setSqlMessage(out.message || 'Query executed.', 'info');
        return;
      }

      setSqlMessage(out.message || 'Mutation executed.', 'info');
      syncAfterMutation();
    } catch (err) {
      setSqlMessage(formatDirectSqlErrorMessage(err && err.message, sql), 'error');
    }
  }

  function clearAllSelections() {
    selectedTable = null;
    lastWorkHeaderSignature = '';
    lastResults = [];
    queryState = {
      table: null,
      columns: [],
      filters: [],
      sort: [],
      limit: 100,
      offset: 0,
      join: {
        enabled: false,
        rightTable: null,
        leftColumnIndex: 0,
        rightColumnIndex: 0,
        type: 'INNER'
      },
      groupBy: {
        enabled: false,
        groupIndices: [],
        aggregates: []
      }
    };

    if (highlightedElement) {
      highlightedElement.classList.remove('sql-highlighted-table');
      highlightedElement = null;
    }

    document.querySelectorAll('.table-card').forEach((c) => c.classList.remove('selected'));

    const tableSelect = document.getElementById('tableSelect');
    if (tableSelect) tableSelect.value = '';

    const columnsGrid = document.getElementById('columnsGrid');
    if (columnsGrid) {
      columnsGrid.innerHTML = '';
      columnsGrid.style.display = 'grid';
    }

    const joinEnabled = document.getElementById('joinEnabled');
    const joinControls = document.getElementById('joinControls');
    const joinTypeSelect = document.getElementById('joinTypeSelect');
    const joinRightSelect = document.getElementById('joinRightSelect');
    const joinLeftCol = document.getElementById('joinLeftCol');
    const joinRightCol = document.getElementById('joinRightCol');
    if (joinEnabled) joinEnabled.checked = false;
    if (joinControls) joinControls.style.display = 'none';
    if (joinTypeSelect) joinTypeSelect.value = 'INNER';
    if (joinRightSelect) joinRightSelect.innerHTML = '<option value="">— Select table —</option>';
    if (joinLeftCol) joinLeftCol.innerHTML = '';
    if (joinRightCol) joinRightCol.innerHTML = '';

    const groupByEnabled = document.getElementById('groupByEnabled');
    const groupByGrid = document.getElementById('groupByGrid');
    const groupByHint = document.getElementById('groupByHint');
    if (groupByEnabled) groupByEnabled.checked = false;
    if (groupByGrid) {
      groupByGrid.innerHTML = '';
      groupByGrid.style.display = 'none';
    }
    if (groupByHint) groupByHint.style.display = 'none';

    const whereColumn = document.getElementById('whereColumn');
    const whereOperator = document.getElementById('whereOperator');
    const whereValue = document.getElementById('whereValue');
    if (whereColumn) whereColumn.innerHTML = '<option value="">-- No filter --</option>';
    if (whereOperator) whereOperator.value = '=';
    if (whereValue) whereValue.value = '';

    const orderColumn = document.getElementById('orderColumn');
    const orderDirection = document.getElementById('orderDirection');
    if (orderColumn) orderColumn.innerHTML = '<option value="">-- No ordering --</option>';
    if (orderDirection) orderDirection.value = 'ASC';

    const runBtn = document.getElementById('runBtn');
    const sqlPreview = document.getElementById('sqlPreview');
    const sqlEditor = document.getElementById('sqlEditor');
    const sqlMessage = document.getElementById('sqlMessage');
    if (runBtn) runBtn.disabled = true;
    if (sqlPreview) sqlPreview.textContent = 'SELECT ...\nFROM ...';
    if (sqlEditor) sqlEditor.value = '';
    if (sqlMessage) sqlMessage.textContent = '';

    const resultsMessage = document.getElementById('resultsMessage');
    const resultsTable = document.getElementById('resultsTable');
    const emptyResults = document.getElementById('emptyResults');
    const resultsSection = document.getElementById('resultsSection');
    const rowCount = document.getElementById('rowCount');
    const execTimeEl = document.getElementById('execTime');
    if (resultsMessage) resultsMessage.textContent = '';
    if (resultsTable) resultsTable.innerHTML = '';
    if (emptyResults) emptyResults.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
    if (rowCount) rowCount.textContent = '0';
    if (execTimeEl) execTimeEl.textContent = '0.00s';
    populateJoinRightSelect();
  }

  /***********************
   *  UTILITY FUNCTIONS
   ***********************/
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /***********************
   *  TOGGLE SIDEBAR
   ***********************/
  function toggle() {
    sidebarOpen = !sidebarOpen;
    const sidebar = document.getElementById('sql-query-sidebar');
    const mainContent = document.body;
    const toggleBtn = document.getElementById('sql-sidebar-toggle');

    if (sidebarOpen) {
      sidebar.classList.add('open');
      mainContent.style.marginRight = '400px';
      toggleBtn.classList.add('sidebar-open');
    } else {
      sidebar.classList.remove('open');
      mainContent.style.marginRight = '0';
      toggleBtn.classList.remove('sidebar-open');
    }
  }

  /***********************
   *  UPDATE TABLES (called from content.js)
   ***********************/
  function updateTables(tables) {
    loadTables();
  }

  /***********************
   *  INITIALIZE
   ***********************/
  function init() {
    // CSS is already injected via manifest.json, so we don't need to load it here
    
    // Create sidebar and toggle button
    createSidebar();
    createToggleButton();

    // Expose API
    window.__SQL_SIDEBAR__ = {
      toggle,
      updateTables,
      selectTable,
      openQueryForTableId
    };

    // Load tables if already available
    if (window.__WEB_TABLES__) {
      loadTables();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
