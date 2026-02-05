/***********************
 *  QUERY EXECUTION ENGINE
 ***********************/

(function() {
  'use strict';

  /**
   * Execute a query on table data
   * @param {Object} queryState - Query configuration
   * @param {Object} queryState.table - Table object with headers and rows
   * @param {Array<number>} queryState.columns - Selected column indices
   * @param {Array<Object>} queryState.filters - WHERE conditions
   * @param {Array<Object>} queryState.sort - ORDER BY conditions
   * @param {number} queryState.limit - LIMIT value
   * @param {number} queryState.offset - OFFSET value
   * @returns {Object} { results: Array, executionTime: number }
   */
  function executeQuery(queryState) {
    const startTime = performance.now();

    if (!queryState.table || !queryState.table.rows) {
      return { results: [], executionTime: 0 };
    }

    let results = [...queryState.table.rows]; // Copy to avoid mutation

    // Step 1: Apply WHERE filters
    if (queryState.filters && queryState.filters.length > 0) {
      results = filterRows(results, queryState.table.headers, queryState.filters);
    }

    // Step 2: Select columns (projection)
    if (queryState.columns && queryState.columns.length > 0) {
      results = selectColumns(results, queryState.table.headers, queryState.columns);
    } else {
      // If no columns selected, include all
      results = selectAllColumns(results, queryState.table.headers);
    }

    // Step 3: Apply ORDER BY (sorting)
    if (queryState.sort && queryState.sort.length > 0) {
      results = sortRows(results, queryState.sort);
    }

    // Step 4: Apply OFFSET
    if (queryState.offset && queryState.offset > 0) {
      results = results.slice(queryState.offset);
    }

    // Step 5: Apply LIMIT
    if (queryState.limit && queryState.limit > 0) {
      results = results.slice(0, queryState.limit);
    }

    const endTime = performance.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(3);

    return {
      results,
      executionTime: parseFloat(executionTime)
    };
  }

  /**
   * Filter rows based on WHERE conditions
   * @param {Array<Array>} rows - Table rows
   * @param {Array<string>} headers - Column headers
   * @param {Array<Object>} filters - Filter conditions
   * @returns {Array<Array>} Filtered rows
   */
  function filterRows(rows, headers, filters) {
    return rows.filter(row => {
      let result = true;
      let lastLogic = 'AND';

      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const columnIndex = filter.columnIndex;
        const operator = filter.operator;
        const value = filter.value;
        const logic = filter.logic || 'AND';

        if (columnIndex === undefined || columnIndex < 0 || columnIndex >= headers.length) {
          continue;
        }

        const cellValue = row[columnIndex];
        const filterResult = evaluateCondition(cellValue, operator, value);

        // Apply logic (AND/OR)
        if (i === 0) {
          result = filterResult;
        } else {
          if (lastLogic === 'AND') {
            result = result && filterResult;
          } else {
            result = result || filterResult;
          }
        }

        lastLogic = logic;
      }

      return result;
    });
  }

  /**
   * Evaluate a single condition
   * @param {*} cellValue - Cell value to compare
   * @param {string} operator - Comparison operator
   * @param {*} filterValue - Value to compare against
   * @returns {boolean}
   */
  function evaluateCondition(cellValue, operator, filterValue) {
    // Convert to comparable types
    const cellStr = String(cellValue || '').toLowerCase().trim();
    const filterStr = String(filterValue || '').toLowerCase().trim();

    // Try numeric comparison
    const cellNum = parseFloat(cellValue);
    const filterNum = parseFloat(filterValue);
    const isNumeric = !isNaN(cellNum) && !isNaN(filterNum) && cellStr !== '' && filterStr !== '';

    switch (operator) {
      case '=':
      case '==':
        if (isNumeric) return cellNum === filterNum;
        return cellStr === filterStr;
      
      case '!=':
      case '<>':
        if (isNumeric) return cellNum !== filterNum;
        return cellStr !== filterStr;
      
      case '>':
        if (isNumeric) return cellNum > filterNum;
        return cellStr > filterStr;
      
      case '>=':
        if (isNumeric) return cellNum >= filterNum;
        return cellStr >= filterStr;
      
      case '<':
        if (isNumeric) return cellNum < filterNum;
        return cellStr < filterStr;
      
      case '<=':
        if (isNumeric) return cellNum <= filterNum;
        return cellStr <= filterStr;
      
      case 'LIKE':
        // Simple LIKE: convert SQL pattern to regex
        const pattern = filterStr
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(cellStr);
      
      case 'NOT LIKE':
        const notPattern = filterStr
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        const notRegex = new RegExp(`^${notPattern}$`, 'i');
        return !notRegex.test(cellStr);
      
      case 'IN':
        // IN: value is array or comma-separated string
        const inValues = Array.isArray(filterValue) 
          ? filterValue 
          : String(filterValue).split(',').map(v => v.trim().toLowerCase());
        return inValues.includes(cellStr);
      
      case 'NOT IN':
        const notInValues = Array.isArray(filterValue)
          ? filterValue
          : String(filterValue).split(',').map(v => v.trim().toLowerCase());
        return !notInValues.includes(cellStr);
      
      case 'IS NULL':
        return cellValue === null || cellValue === undefined || cellStr === '';
      
      case 'IS NOT NULL':
        return cellValue !== null && cellValue !== undefined && cellStr !== '';
      
      default:
        return true; // Unknown operator, don't filter
    }
  }

  /**
   * Select specific columns (projection)
   * @param {Array<Array>} rows - Table rows
   * @param {Array<string>} headers - Column headers
   * @param {Array<number>} columnIndices - Indices of columns to select
   * @returns {Array<Object>} Objects with selected columns
   */
  function selectColumns(rows, headers, columnIndices) {
    return rows.map(row => {
      const result = {};
      columnIndices.forEach(index => {
        if (index >= 0 && index < headers.length) {
          const colName = headers[index] || `Column ${index + 1}`;
          result[colName] = row[index] || '';
        }
      });
      return result;
    });
  }

  /**
   * Select all columns
   * @param {Array<Array>} rows - Table rows
   * @param {Array<string>} headers - Column headers
   * @returns {Array<Object>} Objects with all columns
   */
  function selectAllColumns(rows, headers) {
    return rows.map(row => {
      const result = {};
      headers.forEach((header, index) => {
        result[header || `Column ${index + 1}`] = row[index] || '';
      });
      return result;
    });
  }

  /**
   * Sort rows based on ORDER BY conditions
   * @param {Array<Object>} rows - Rows as objects
   * @param {Array<Object>} sortConditions - Sort conditions
   * @returns {Array<Object>} Sorted rows
   */
  function sortRows(rows, sortConditions) {
    if (!sortConditions || sortConditions.length === 0) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      for (const condition of sortConditions) {
        const column = condition.column;
        const direction = condition.direction || 'ASC';

        if (!(column in a) || !(column in b)) {
          continue;
        }

        const aVal = a[column];
        const bVal = b[column];

        // Try numeric comparison
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        const isNumeric = !isNaN(aNum) && !isNaN(bNum) && 
                         String(aVal).trim() !== '' && String(bVal).trim() !== '';

        let comparison = 0;

        if (isNumeric) {
          comparison = aNum - bNum;
        } else {
          const aStr = String(aVal || '').toLowerCase();
          const bStr = String(bVal || '').toLowerCase();
          comparison = aStr.localeCompare(bStr);
        }

        if (comparison !== 0) {
          return direction === 'DESC' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Generate SQL string from query state (for preview)
   * @param {Object} queryState - Query configuration
   * @returns {string} SQL query string
   */
  function generateSQL(queryState) {
    if (!queryState.table) {
      return 'SELECT ...\nFROM ...';
    }

    let sql = 'SELECT ';

    // Columns
    if (queryState.columns && queryState.columns.length > 0) {
      const columnNames = queryState.columns.map(index => {
        return queryState.table.headers[index] || `Column ${index + 1}`;
      });
      sql += columnNames.join(', ');
    } else {
      sql += '*';
    }

    // FROM (use friendly name if available)
    const tableName = queryState.table.displayName || queryState.table.id;
    sql += `\nFROM ${tableName}`;

    // WHERE
    if (queryState.filters && queryState.filters.length > 0) {
      sql += '\nWHERE ';
      const conditions = queryState.filters.map((filter, index) => {
        const colName = queryState.table.headers[filter.columnIndex] || `Column ${filter.columnIndex + 1}`;
        const value = typeof filter.value === 'string' ? `'${filter.value}'` : filter.value;
        let condition = `${colName} ${filter.operator} ${value}`;
        
        if (index > 0) {
          condition = `${filter.logic || 'AND'} ${condition}`;
        }
        
        return condition;
      });
      sql += conditions.join(' ');
    }

    // ORDER BY
    if (queryState.sort && queryState.sort.length > 0) {
      sql += '\nORDER BY ';
      const sorts = queryState.sort.map(s => {
        return `${s.column} ${s.direction || 'ASC'}`;
      });
      sql += sorts.join(', ');
    }

    // LIMIT
    if (queryState.limit && queryState.limit > 0) {
      sql += `\nLIMIT ${queryState.limit}`;
    }

    // OFFSET
    if (queryState.offset && queryState.offset > 0) {
      sql += `\nOFFSET ${queryState.offset}`;
    }

    return sql;
  }

  // Expose API
  window.__QUERY_ENGINE__ = {
    executeQuery,
    generateSQL,
    filterRows,
    selectColumns,
    sortRows
  };

})();
