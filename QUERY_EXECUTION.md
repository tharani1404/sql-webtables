# Query Execution Architecture

## Current Implementation (Simplified)

### How It Works Now:

**We're NOT actually parsing SQL!** Instead:

1. **SQL Preview**: We generate SQL as a **display string** for the user to see
2. **Direct Execution**: We execute queries **directly on JavaScript data structures**

### Current Flow:

```
User selects columns → JavaScript filters table.rows → Results displayed
```

**Code in `sidebar.js` (runQuery function):**
```javascript
// Get selected columns
const checkboxes = document.querySelectorAll('#columnsGrid input[type="checkbox"]:checked');
const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.column));

// Directly manipulate JavaScript array
let results = queryState.table.rows.map(row => {
  const result = {};
  selectedIndices.forEach(index => {
    const colName = queryState.table.headers[index];
    result[colName] = row[index] || '';
  });
  return result;
});

// Apply LIMIT
if (queryState.limit) {
  results = results.slice(0, queryState.limit);
}
```

### Why This Approach?

**Pros:**
- ✅ Simple and fast
- ✅ No SQL parser needed
- ✅ Works well for basic SELECT queries
- ✅ No external dependencies

**Cons:**
- ❌ Can't handle complex SQL (WHERE, JOIN, GROUP BY, etc.)
- ❌ SQL preview is just for display (not actually executed)
- ❌ Limited to what we manually implement

---

## Options for SQL Execution

### Option 1: Custom Query Engine (Recommended) ⭐

Build a JavaScript query engine that:
- Parses visual builder state (not SQL string)
- Executes on in-memory data
- Supports: SELECT, WHERE, ORDER BY, LIMIT, JOIN

**Pros:**
- Full control
- No external dependencies
- Fast execution
- Can add features incrementally

**Cons:**
- Need to implement each SQL feature
- More code to maintain

### Option 2: SQL Parser + Executor

Use a library like:
- **AlaSQL** - SQL database in JavaScript
- **SQL.js** - SQLite compiled to JavaScript
- **node-sql-parser** - SQL parser

**Pros:**
- Full SQL support
- Less code to write
- Standard SQL syntax

**Cons:**
- External dependency
- Larger bundle size
- May be overkill for simple queries

### Option 3: Hybrid Approach (Best for Your Project)

1. **Visual Builder** → Direct execution (current approach)
2. **SQL Mode** → Parse SQL and execute

**Pros:**
- Best of both worlds
- Simple queries = fast execution
- Complex queries = SQL parser
- User can choose

**Cons:**
- Need to implement both paths

---

## Recommended: Custom Query Engine

Let's build a proper query engine that:
1. Takes query state (table, columns, filters, sort, limit)
2. Executes on JavaScript arrays
3. Supports all common SQL operations

### Architecture:

```
Query State → Query Engine → Results
```

**Query State:**
```javascript
{
  table: tableObject,
  columns: [0, 1, 2],        // Column indices
  filters: [                 // WHERE conditions
    { column: 0, operator: '>', value: 25, logic: 'AND' }
  ],
  sort: [                    // ORDER BY
    { column: 1, direction: 'ASC' }
  ],
  limit: 100,
  offset: 0
}
```

**Query Engine Functions:**
- `selectColumns()` - Project columns
- `filterRows()` - Apply WHERE clause
- `sortRows()` - Apply ORDER BY
- `limitRows()` - Apply LIMIT/OFFSET
- `executeQuery()` - Orchestrate all operations

---

## Implementation Plan

### Phase 1: Enhanced Query Engine (Current)
- ✅ Column selection
- ✅ LIMIT
- 🚧 WHERE filters (next)
- 🚧 ORDER BY (next)
- 🚧 OFFSET

### Phase 2: Advanced Features
- JOIN support
- Aggregations (COUNT, SUM, AVG)
- GROUP BY
- HAVING

### Phase 3: SQL Mode
- SQL parser
- Convert SQL → Query State
- Execute via query engine

---

## Next Steps

1. **Create `query-engine.js`** - Proper query execution engine
2. **Update `sidebar.js`** - Use query engine instead of direct manipulation
3. **Add filter support** - WHERE clause execution
4. **Add sorting** - ORDER BY execution

Would you like me to implement the proper query engine?
