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
  let queryState = {
    table: null,
    columns: [],
    filters: [],
    sort: [],
    limit: 100
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
        <button class="sidebar-close-btn" onclick="window.__SQL_SIDEBAR__.toggle()">×</button>
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
          <div class="query-section">
            <div class="section-title">Generated SQL</div>
            <div class="sql-preview" id="sqlPreview">SELECT ...\nFROM ...</div>
          </div>
          <button class="btn-primary" id="runBtn" disabled>▶ Run Query</button>
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

    // Clear existing
    tablesList.innerHTML = '';
    tableSelect.innerHTML = '<option value="">-- Select Table --</option>';

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
   *  LOAD TABLE COLUMNS
   ***********************/
  function loadTableColumns(table) {
    const columnsGrid = document.getElementById('columnsGrid');
    const headers = table.headers || [];
    
    queryState.table = table;
    queryState.columns = headers.map((_, i) => i); // Default: all columns

    if (headers.length === 0) {
      columnsGrid.innerHTML = '<div class="empty-text">No columns detected</div>';
      return;
    }

    columnsGrid.innerHTML = headers.map((col, index) => `
      <label class="column-checkbox">
        <input type="checkbox" checked data-column="${index}"> ${col || `Column ${index + 1}`}
      </label>
    `).join('');

    // Add change listeners
    columnsGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updateSQL);
    });

    updateSQL();
    document.getElementById('runBtn').disabled = false;
  }

  /***********************
   *  UPDATE SQL PREVIEW
   ***********************/
  function updateSQL() {
    if (!queryState.table) return;

    const checkboxes = document.querySelectorAll('#columnsGrid input[type="checkbox"]:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.column));
    
    queryState.columns = selectedIndices;

    // Use query engine to generate SQL
    if (window.__QUERY_ENGINE__) {
      const sql = window.__QUERY_ENGINE__.generateSQL(queryState);
      document.getElementById('sqlPreview').textContent = sql;
    } else {
      // Fallback if query engine not loaded
      const selectedColumns = selectedIndices.map(index => {
        return queryState.table.headers[index] || `Column ${index + 1}`;
      });
      if (selectedColumns.length === 0) {
        document.getElementById('sqlPreview').textContent = 'SELECT ...\nFROM ...';
        return;
      }
      const tableName = queryState.table.displayName || queryState.table.id;
      let sql = `SELECT ${selectedColumns.join(', ')}\nFROM ${tableName}`;
      if (queryState.limit) {
        sql += `\nLIMIT ${queryState.limit}`;
      }
      document.getElementById('sqlPreview').textContent = sql;
    }
  }

  /***********************
   *  RUN QUERY
   ***********************/
  function runQuery() {
    if (!queryState.table) return;

    // Get selected columns
    const checkboxes = document.querySelectorAll('#columnsGrid input[type="checkbox"]:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.column));
    
    // Update query state
    queryState.columns = selectedIndices;
    
    // Ensure default values
    if (!queryState.filters) queryState.filters = [];
    if (!queryState.sort) queryState.sort = [];
    if (!queryState.limit) queryState.limit = 100;
    if (!queryState.offset) queryState.offset = 0;

    // Execute query using query engine
    let results = [];
    let execTime = 0;

    if (window.__QUERY_ENGINE__) {
      const queryResult = window.__QUERY_ENGINE__.executeQuery(queryState);
      results = queryResult.results;
      execTime = queryResult.executionTime;
    } else {
      // Fallback: simple execution (old method)
      console.warn('Query engine not loaded, using fallback');
      results = queryState.table.rows.map(row => {
        const result = {};
        selectedIndices.forEach(index => {
          const colName = queryState.table.headers[index] || `Column ${index + 1}`;
          result[colName] = row[index] || '';
        });
        return result;
      });
      if (queryState.limit) {
        results = results.slice(0, queryState.limit);
      }
      execTime = 0.001;
    }

    // Display results
    displayResults(results, execTime);
    
    // Switch to results tab
    switchTab('results');
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

      // Clear any table highlight when closing sidebar
      if (highlightedElement) {
        highlightedElement.classList.remove('sql-highlighted-table');
        highlightedElement = null;
      }
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
      selectTable
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
