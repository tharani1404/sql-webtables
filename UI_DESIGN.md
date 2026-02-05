# SQL Web Tables - UI Design Specification

## Overview
A dual-mode interface supporting both visual query builder and direct SQL input, with future JOIN support.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 SQL Query Builder                    [Visual] [SQL] [Help]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ TABLES ───────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Table 1: [Dropdown: Select Table ▼]                      │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │ 📊 Table: "Users" (semantic)                    │    │ │
│  │  │ Columns: [☑ id] [☑ name] [☑ email] [☐ age]       │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  │                                                           │ │
│  │  [+ Add Table]  (for JOINs - future)                    │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ JOINS ─────────────────────────────────────────────────┐ │
│  │  (Collapsed by default, expands when 2+ tables added)   │ │
│  │                                                           │ │
│  │  Table 1: [Users ▼]                                     │ │
│  │    Column: [id ▼]                                       │ │
│  │    ──── JOIN [INNER ▼] ────                             │ │
│  │  Table 2: [Orders ▼]                                    │ │
│  │    Column: [user_id ▼]                                   │ │
│  │                                                           │ │
│  │  [+ Add Join]                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ FILTERS (WHERE) ───────────────────────────────────────┐ │
│  │                                                           │ │
│  │  [Column ▼] [Operator ▼] [Value] [AND/OR ▼]            │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │ name = 'John' AND age > 25                       │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  │                                                           │ │
│  │  [+ Add Filter]                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ SORTING (ORDER BY) ────────────────────────────────────┐ │
│  │                                                           │ │
│  │  [Column ▼] [ASC ▼] [+ Add Sort]                        │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │ name ASC, age DESC                               │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ OPTIONS ────────────────────────────────────────────────┐ │
│  │  Limit: [100]  Offset: [0]  Distinct: [☐]              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ GENERATED SQL ──────────────────────────────────────────┐ │
│  │  SELECT id, name, email                                 │ │
│  │  FROM Users                                              │ │
│  │  WHERE name = 'John' AND age > 25                        │ │
│  │  ORDER BY name ASC, age DESC                             │ │
│  │  LIMIT 100                                               │ │
│  │                                                           │ │
│  │  [📋 Copy SQL] [🔄 Refresh] [✏️ Edit in SQL Mode]      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [▶ Run Query]  [💾 Save Query]  [📊 Export Results]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📊 QUERY RESULTS                                               │
├─────────────────────────────────────────────────────────────────┤
│  Rows: 42  |  Execution time: 0.05s                            │
│                                                                 │
│  ┌─────┬──────────┬───────────────────┬─────┐                │
│  │ id  │ name     │ email             │ age │                │
│  ├─────┼──────────┼───────────────────┼─────┤                │
│  │ 1   │ John     │ john@example.com  │ 30  │                │
│  │ 2   │ Jane     │ jane@example.com  │ 25  │                │
│  └─────┴──────────┴───────────────────┴─────┘                │
│                                                                 │
│  [⬅ Prev] [1] [2] [3] [Next ➡]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## SQL Mode Toggle

When user clicks **[SQL]** tab:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 SQL Query Builder                    [Visual] [SQL] [Help]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ SQL EDITOR ──────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  SELECT u.id, u.name, o.total                            │ │
│  │  FROM Users u                                             │ │
│  │  INNER JOIN Orders o ON u.id = o.user_id                 │ │
│  │  WHERE u.age > 25                                        │ │
│  │  ORDER BY o.total DESC                                   │ │
│  │  LIMIT 100                                                │ │
│  │                                                           │ │
│  │  (Syntax highlighting, auto-complete)                    │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ AVAILABLE TABLES ───────────────────────────────────────┐ │
│  │  📊 Users (semantic) - columns: id, name, email, age   │ │
│  │  📊 Orders (semantic) - columns: id, user_id, total     │ │
│  │  📊 Products (repeated-div) - columns: name, price      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [▶ Run Query]  [🔄 Validate]  [📋 Format SQL]  [← Visual]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. **Table Selection**
- Dropdown showing all detected tables
- Table type badge (semantic/repeated-div/grid-flex)
- Column checkboxes with search/filter
- Preview table structure on hover

### 2. **JOIN Support (Future)**
- **Visual JOIN Builder:**
  - Add multiple tables
  - Select join type (INNER, LEFT, RIGHT, FULL)
  - Drag-and-drop column matching
  - Visual connection lines
  
- **SQL Mode:**
  - Auto-complete table/column names
  - Syntax validation
  - Visual table relationship hints

### 3. **Filter Builder**
- Column dropdown (filtered by selected tables)
- Operator dropdown: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `BETWEEN`
- Value input (with type detection)
- AND/OR logic grouping
- Nested conditions support

### 4. **SQL Preview**
- Always visible in Visual mode
- Real-time updates as user builds query
- Syntax highlighting
- Copy button
- "Edit in SQL Mode" button

### 5. **Mode Switching**
- **Visual → SQL:** Pre-fills SQL editor with generated query
- **SQL → Visual:** Parses SQL and populates visual builder (if possible)
- Warns if SQL can't be fully represented visually

---

## Component Structure

```
QueryBuilder/
├── ModeToggle.jsx          (Visual/SQL switcher)
├── VisualBuilder/
│   ├── TableSelector.jsx   (Table dropdown + column checkboxes)
│   ├── JoinBuilder.jsx     (JOIN visual builder - future)
│   ├── FilterBuilder.jsx   (WHERE clause builder)
│   ├── SortBuilder.jsx     (ORDER BY builder)
│   └── OptionsPanel.jsx    (LIMIT, OFFSET, DISTINCT)
├── SqlEditor/
│   ├── CodeEditor.jsx      (Monaco/Codemirror with SQL syntax)
│   ├── TableReference.jsx  (Available tables sidebar)
│   └── SqlValidator.jsx    (Syntax validation)
├── SqlPreview.jsx          (Generated SQL display)
├── QueryRunner.jsx         (Execute query)
└── ResultsViewer.jsx       (Display results table)
```

---

## Implementation Phases

### Phase 1: Basic Visual Builder
- [x] Table detection
- [ ] Table selector dropdown
- [ ] Column selection
- [ ] Basic WHERE filters
- [ ] SQL generation
- [ ] Query execution

### Phase 2: Enhanced Visual Builder
- [ ] Advanced filters (LIKE, IN, BETWEEN)
- [ ] Sorting (ORDER BY)
- [ ] LIMIT/OFFSET
- [ ] SQL preview improvements
- [ ] Results pagination

### Phase 3: SQL Mode
- [ ] SQL editor with syntax highlighting
- [ ] Auto-complete
- [ ] SQL validation
- [ ] Visual ↔ SQL mode conversion

### Phase 4: JOIN Support
- [ ] Multi-table selection
- [ ] Visual JOIN builder
- [ ] JOIN type selection
- [ ] Column matching UI
- [ ] JOIN SQL generation

### Phase 5: Advanced Features
- [ ] Aggregations (COUNT, SUM, AVG, etc.)
- [ ] GROUP BY
- [ ] HAVING clause
- [ ] Subqueries
- [ ] Save/load queries
- [ ] Export results

---

## UI/UX Best Practices

1. **Progressive Disclosure:** Hide advanced features until needed
2. **Real-time Feedback:** Update SQL preview as user builds query
3. **Error Handling:** Show clear errors with suggestions
4. **Keyboard Shortcuts:** 
   - `Ctrl+Enter` to run query
   - `Ctrl+/` to toggle comment
   - `Tab` for auto-complete
5. **Responsive Design:** Works on different screen sizes
6. **Accessibility:** ARIA labels, keyboard navigation

---

## Example User Flows

### Flow 1: Simple SELECT
1. Select table from dropdown
2. Check columns to include
3. Click "Run Query"
4. View results

### Flow 2: Filtered Query
1. Select table
2. Select columns
3. Add filter: `age > 25`
4. Add sort: `name ASC`
5. Run query

### Flow 3: JOIN Query (Future)
1. Select first table
2. Click "+ Add Table"
3. Select second table
4. Configure JOIN (columns, type)
5. Select columns from both tables
6. Add filters
7. Run query

### Flow 4: SQL Mode
1. Click "SQL" tab
2. Type SQL query
3. Use auto-complete for table/column names
4. Click "Run Query"
5. View results

---

## Technical Considerations

- **SQL Generation:** Build SQL from visual builder state
- **SQL Parsing:** Parse SQL to populate visual builder (optional)
- **Query Validation:** Validate before execution
- **Error Messages:** User-friendly error handling
- **Performance:** Optimize for large result sets
- **Security:** Sanitize user inputs, prevent SQL injection
