/***********************
 *  QUERY EXECUTION ENGINE
 ***********************/

(function() {
  'use strict';
  // 🔥 NEW: helper to run SQL via page (AlaSQL)
  function runSQLViaPage(sqlText, tables) {
    return new Promise((resolve, reject) => {
      const requestId = `sql-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeoutMs = 8000;
      let timeoutId = null;

      function cleanup() {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        window.removeEventListener("message", handler);
      }

      function handler(event) {
        if (event.source !== window) return;
        if (!event.data || event.data.type !== "SQL_RESULT") return;
        if (event.data.requestId !== requestId) return;

        cleanup();
        resolve(event.data.result);
      }

      window.addEventListener("message", handler);
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for SQL engine response"));
      }, timeoutMs);

      const safeTables = (Array.isArray(tables) ? tables : []).map((table, index) => ({
        id: (table && table.id) || `table_${index + 1}`,
        displayName: table && table.displayName ? table.displayName : undefined,
        headers: Array.isArray(table && table.headers) ? table.headers : [],
        rows: Array.isArray(table && table.rows) ? table.rows : []
      }));

      window.postMessage({
        type: "RUN_SQL",
        requestId,
        sql: sqlText,
        tables: safeTables
      }, "*");
    });
  }

  /**
   * Execute SQL (NOW USES ALASQL VIA PAGE)
   */
  async function executeSQL(sqlText, context) {
    const startTime = performance.now();

    function normalizeQualifiedBracketSyntax(inputSql) {
      // Accept legacy/pasted form like [table_2.OrderID] by rewriting to [table_2].[OrderID].
      return String(inputSql || '').replace(/\[([^\[\]]+\.[^\[\]]+)\]/g, (match, qualified) => {
        const parts = qualified.split('.');
        if (parts.length < 2) return match;
        return parts.map((p) => `[${p.replace(/]/g, ']]')}]`).join('.');
      });
    }

    const sql = normalizeQualifiedBracketSyntax(
      String(sqlText || '').trim().replace(/;\s*$/, '')
    );
    const tables = (context && context.tables) || [];

    if (!sql) {
      return { kind: 'query', results: [], executionTime: 0, message: 'Empty SQL.' };
    }

    try {
      // 🔥 CALL PAGE (AlaSQL)
      const res = await runSQLViaPage(sql, tables);

      const endTime = performance.now();

      if (!res || !res.success) {
        return {
          kind: 'error',
          message: res?.error || 'SQL execution failed'
        };
      }

      return {
        kind: 'query',
        results: res.result || [],
        executionTime: parseFloat(((endTime - startTime) / 1000).toFixed(3)),
        message: 'Query executed (AlaSQL)'
      };

    } catch (err) {
      return {
        kind: 'error',
        message: err.message
      };
    }
  }

  // ====== EVERYTHING BELOW UNCHANGED ======

  function sanitizeIdentifier(name) {
    const s = String(name || 't').replace(/[^a-zA-Z0-9_]/g, '_');
    return s || 't';
  }

  function splitCSV(input) {
    const out = [];
    let current = '';
    let quote = null;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if ((ch === "'" || ch === '"')) {
        if (!quote) quote = ch;
        else if (quote === ch) quote = null;
        current += ch;
        continue;
      }
      if (ch === ',' && !quote) {
        out.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) out.push(current.trim());
    return out;
  }

  function parseValue(raw) {
    const v = String(raw || '').trim();
    if (/^'.*'$/.test(v) || /^".*"$/.test(v)) {
      return v.slice(1, -1);
    }
    if (/^null$/i.test(v)) return null;
    if (/^true$/i.test(v)) return true;
    if (/^false$/i.test(v)) return false;
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }

  function stripTrailingSemicolon(sql) {
    return String(sql || '').trim().replace(/;\s*$/, '');
  }

  function parseSqlIdentifier(name) {
    const n = String(name || '').trim();
    if ((n.startsWith('"') && n.endsWith('"')) || (n.startsWith("'") && n.endsWith("'"))) {
      return n.slice(1, -1);
    }
    if (n.startsWith('[') && n.endsWith(']')) {
      return n.slice(1, -1);
    }
    return n;
  }

  function getJoinComparable(value) {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  function joinTables(leftTable, rightTable, leftColIndex, rightColIndex, joinType) {
    const leftAlias = sanitizeIdentifier(leftTable.displayName || leftTable.id || 'left');
    const rightAlias = sanitizeIdentifier(rightTable.displayName || rightTable.id || 'right');
    const lh = leftTable.headers || [];
    const rh = rightTable.headers || [];
    const leftHeaders = lh.map((h, i) => `${leftAlias}.${h || 'col' + (i + 1)}`);
    const rightHeaders = rh.map((h, i) => `${rightAlias}.${h || 'col' + (i + 1)}`);
    const headers = leftHeaders.concat(rightHeaders);
    const rows = [];
    const lrows = leftTable.rows || [];
    const rrows = rightTable.rows || [];

    const rightIndex = new Map();
    for (let ri = 0; ri < rrows.length; ri++) {
      const rrow = rrows[ri];
      const key = getJoinComparable(rrow[rightColIndex]);
      if (key === null) continue;
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key).push(rrow);
    }

    const leftOuter = String(joinType || 'INNER').toUpperCase().includes('OUTER');
    for (let li = 0; li < lrows.length; li++) {
      const lrow = lrows[li];
      const key = getJoinComparable(lrow[leftColIndex]);
      if (key === null) {
        if (leftOuter) {
          rows.push(lrow.concat(new Array(rh.length).fill('')));
        }
        continue;
      }
      const matches = rightIndex.get(key);
      if (matches && matches.length) {
        for (let m = 0; m < matches.length; m++) {
          rows.push(lrow.concat(matches[m]));
        }
      } else if (leftOuter) {
        rows.push(lrow.concat(new Array(rh.length).fill('')));
      }
    }
    return { headers, rows };
  }

  function getWorkingRowsAndHeaders(queryState) {
    const left = queryState.table;
    if (!left || !left.rows) {
      return { headers: [], rows: [] };
    }

    const join = queryState.join;
    if (join && join.enabled && join.rightTable) {
      const li = join.leftColumnIndex;
      const ri = join.rightColumnIndex;
      const lh = left.headers || [];
      const rh = join.rightTable.headers || [];
      if (
        li >= 0 && li < lh.length &&
        ri >= 0 && ri < rh.length
      ) {
        return joinTables(left, join.rightTable, li, ri, join.type || 'INNER');
      }
    }

    return {
      headers: left.headers ? [...left.headers] : [],
      rows: [...left.rows]
    };
  }

  function executeQuery(queryState) {
    const startTime = performance.now();
    if (!queryState.table || !queryState.table.rows) {
      return { results: [], executionTime: 0 };
    }

    const wh = getWorkingRowsAndHeaders(queryState);
    let headers = wh.headers;
    let rows = wh.rows;

    if (!headers.length && rows.length) {
      const w = Math.max(...rows.map((r) => r.length));
      headers = [];
      for (let i = 0; i < w; i++) headers.push(`Column ${i + 1}`);
    }

    const filters = Array.isArray(queryState.filters) ? queryState.filters : [];
    if (filters.length > 0) {
      rows = rows.filter((row) => {
        let ok = true;
        for (let i = 0; i < filters.length; i++) {
          const f = filters[i];
          if (f.columnIndex === undefined || f.columnIndex < 0 || f.columnIndex >= headers.length) continue;
          const cell = row[f.columnIndex];
          const raw = String(f.value ?? "");
          const asNumber = Number(raw);
          const cellNum = Number(cell);
          const bothNumeric = !Number.isNaN(asNumber) && !Number.isNaN(cellNum) && raw.trim() !== "";

          const left = bothNumeric ? cellNum : String(cell ?? "").toLowerCase();
          const right = bothNumeric ? asNumber : raw.toLowerCase();
          let pass = true;

          switch (String(f.operator || "=").toUpperCase()) {
            case "=":
            case "==":
              pass = left === right;
              break;
            case "!=":
            case "<>":
              pass = left !== right;
              break;
            case ">":
              pass = left > right;
              break;
            case ">=":
              pass = left >= right;
              break;
            case "<":
              pass = left < right;
              break;
            case "<=":
              pass = left <= right;
              break;
            case "LIKE": {
              const pattern = String(raw).replace(/%/g, ".*").replace(/_/g, ".");
              pass = new RegExp(`^${pattern}$`, "i").test(String(cell ?? ""));
              break;
            }
            default:
              pass = true;
          }

          if (i === 0) {
            ok = pass;
          } else {
            const logic = String(f.logic || "AND").toUpperCase();
            ok = logic === "OR" ? (ok || pass) : (ok && pass);
          }
        }
        return ok;
      });
    }

    const selected = Array.isArray(queryState.columns) && queryState.columns.length
      ? queryState.columns
      : headers.map((_, i) => i);

    let results = rows.map((row) => {
      const out = {};
      selected.forEach((idx) => {
        const key = headers[idx] || `Column ${idx + 1}`;
        out[key] = row[idx];
      });
      return out;
    });

    const sortList = Array.isArray(queryState.sort) ? queryState.sort : [];
    if (sortList.length > 0) {
      results.sort((a, b) => {
        for (let i = 0; i < sortList.length; i++) {
          const s = sortList[i];
          const key = s.column;
          const dir = String(s.direction || "ASC").toUpperCase() === "DESC" ? -1 : 1;
          const av = a[key];
          const bv = b[key];

          const an = Number(av);
          const bn = Number(bv);
          const bothNumeric = !Number.isNaN(an) && !Number.isNaN(bn);
          const cmp = bothNumeric
            ? (an - bn)
            : String(av ?? "").localeCompare(String(bv ?? ""), undefined, { sensitivity: "base" });
          if (cmp !== 0) return cmp * dir;
        }
        return 0;
      });
    }

    const offset = Number(queryState.offset) || 0;
    const limit = Number(queryState.limit) || 0;
    if (offset > 0) results = results.slice(offset);
    if (limit > 0) results = results.slice(0, limit);

    const endTime = performance.now();
    return {
      results,
      executionTime: parseFloat(((endTime - startTime) / 1000).toFixed(3))
    };
  }

  function quoteIdentifier(name) {
    const value = String(name || '');
    return `[${value.replace(/]/g, ']]')}]`;
  }

  function quoteQualifiedIdentifier(name) {
    const value = String(name || '');
    if (value.includes('.')) {
      return value.split('.').map((part) => quoteIdentifier(part)).join('.');
    }
    return quoteIdentifier(value);
  }

  function toSqlLiteral(value) {
    if (value === null || value === undefined) return 'NULL';
    const raw = String(value).trim();
    if (!raw) return "''";
    if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
    if (/^(true|false)$/i.test(raw)) return raw.toLowerCase();
    return `'${raw.replace(/'/g, "''")}'`;
  }

  function resolveTableAlias(table, tables) {
    const list = Array.isArray(tables) ? tables : [];
    const idx = list.findIndex((t) => t && table && t.id === table.id);
    return idx >= 0 ? `table_${idx + 1}` : 'table_1';
  }

  function generateSQL(queryState, context) {
    if (!queryState || !queryState.table) {
      return "SELECT ...\nFROM ...";
    }
    const tables = (context && context.tables) || [];
    const leftAlias = resolveTableAlias(queryState.table, tables);
    const leftHeaders = Array.isArray(queryState.table.headers) ? queryState.table.headers : [];

    const join = queryState.join || {};
    const hasJoin = !!(join.enabled && join.rightTable);
    const rightAlias = hasJoin ? resolveTableAlias(join.rightTable, tables) : '';
    const rightHeaders = hasJoin && Array.isArray(join.rightTable.headers) ? join.rightTable.headers : [];

    const workHeaders = hasJoin
      ? leftHeaders
          .map((h, i) => `${leftAlias}.${h || 'col' + (i + 1)}`)
          .concat(rightHeaders.map((h, i) => `${rightAlias}.${h || 'col' + (i + 1)}`))
      : leftHeaders;

    let sql = "SELECT ";
    if (Array.isArray(queryState.columns) && queryState.columns.length > 0) {
      const cols = queryState.columns.map((index) => {
        const col = workHeaders[index] || `Column ${index + 1}`;
        return quoteQualifiedIdentifier(col);
      });
      sql += cols.join(", ");
    } else {
      sql += "*";
    }

    sql += `\nFROM ${quoteIdentifier(leftAlias)}`;

    if (hasJoin) {
      const joinType = (join.type || 'INNER').toUpperCase();
      const li = Number.isFinite(join.leftColumnIndex) ? join.leftColumnIndex : 0;
      const ri = Number.isFinite(join.rightColumnIndex) ? join.rightColumnIndex : 0;
      const leftCol = `${leftAlias}.${leftHeaders[li] || `col${li + 1}`}`;
      const rightCol = `${rightAlias}.${rightHeaders[ri] || `col${ri + 1}`}`;
      sql += `\n${joinType} JOIN ${quoteIdentifier(rightAlias)} ON ${quoteQualifiedIdentifier(leftCol)} = ${quoteQualifiedIdentifier(rightCol)}`;
    }

    if (Array.isArray(queryState.filters) && queryState.filters.length > 0) {
      sql += "\nWHERE ";
      const conditions = queryState.filters.map((filter, index) => {
        const colName = workHeaders[filter.columnIndex] || `Column ${filter.columnIndex + 1}`;
        const expr = `${quoteQualifiedIdentifier(colName)} ${filter.operator} ${toSqlLiteral(filter.value)}`;
        if (index === 0) return expr;
        return `${filter.logic || "AND"} ${expr}`;
      });
      sql += conditions.join(" ");
    }

    if (Array.isArray(queryState.sort) && queryState.sort.length > 0) {
      const sorts = queryState.sort.map((s) => `${quoteQualifiedIdentifier(s.column)} ${s.direction || "ASC"}`);
      sql += `\nORDER BY ${sorts.join(", ")}`;
    }

    if (queryState.limit && queryState.limit > 0) {
      sql += `\nLIMIT ${queryState.limit}`;
    }
    if (queryState.offset && queryState.offset > 0) {
      sql += `\nOFFSET ${queryState.offset}`;
    }

    return sql;
  }

  window.__QUERY_ENGINE__ = {
    executeQuery,
    executeSQL,
    generateSQL,
    getWorkingRowsAndHeaders,
    joinTables
  };

})();