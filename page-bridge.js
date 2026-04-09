// page-bridge.js

window.runSQL = function(sql, tables) {
  try {
    if (typeof alasql !== "function") {
      return { success: false, error: "AlaSQL is not loaded on this page." };
    }

    const inputTables = Array.isArray(tables) ? tables : [];
    const createdNames = [];
    const previousTables = {};

    function makeSafeIdentifier(value, fallback) {
      const s = String(value || "").replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
      return s || fallback;
    }

    function makeColumnAliases(raw, fallback, used) {
      const base = String(raw || fallback || "Column").trim();
      const safe = makeSafeIdentifier(base, fallback);
      const compact = safe.replace(/_/g, "");
      const candidates = [base, safe, safe.toLowerCase(), compact, compact.toLowerCase()];
      const aliases = [];
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (!c || used.has(c)) continue;
        used.add(c);
        aliases.push(c);
      }
      return aliases;
    }

    function makeTableAliases(table, index) {
      const idx = index + 1;
      const display = table && table.displayName ? table.displayName : "";
      const id = table && table.id ? table.id : "";
      const primary = makeSafeIdentifier(display || id, `table_${idx}`);
      const aliases = [
        primary,
        `table_${idx}`,
        `table${idx}`,
        `t${idx}`
      ];
      // Allow using semantic names like "orders" when display name is "Orders Table".
      if (/_table$/i.test(primary)) {
        aliases.push(primary.replace(/_table$/i, ""));
      }
      return [...new Set(aliases.filter(Boolean))];
    }

    function coercePrimitive(value) {
      if (value === null || value === undefined) return value;
      if (typeof value !== "string") return value;

      const text = value.trim();
      if (!text) return "";

      if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
      if (/^null$/i.test(text)) return null;

      const normalized = text.replace(/,/g, "");
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        const n = Number(normalized);
        if (!Number.isNaN(n)) return n;
      }

      return value;
    }

    inputTables.forEach((table, index) => {
      const rawName = (table && (table.displayName || table.id)) || `table_${index + 1}`;
      const name = String(rawName).replace(/[^a-zA-Z0-9_]/g, "_");
      const headers = Array.isArray(table && table.headers) ? table.headers : [];
      const rows = Array.isArray(table && table.rows) ? table.rows : [];

      const data = rows.map((row) => {
        const obj = {};
        const safeRow = Array.isArray(row) ? row : [];
        const used = new Set();

        for (let i = 0; i < Math.max(headers.length, safeRow.length); i++) {
          const key = headers[i] || `Column ${i + 1}`;
          const aliases = makeColumnAliases(key, `Column_${i + 1}`, used);
          const cellValue = coercePrimitive(safeRow[i]);
          for (let j = 0; j < aliases.length; j++) {
            obj[aliases[j]] = cellValue;
          }
        }
        return obj;
      });

      const tableAliases = makeTableAliases(table, index);
      if (!tableAliases.includes(name)) {
        tableAliases.unshift(name);
      }

      tableAliases.forEach((alias) => {
        previousTables[alias] = alasql.tables[alias];
        alasql.tables[alias] = { data };
        createdNames.push(alias);
      });
    });

    let result;
    try {
      result = alasql(sql);
    } finally {
      createdNames.forEach((name) => {
        if (previousTables[name]) {
          alasql.tables[name] = previousTables[name];
        } else {
          delete alasql.tables[name];
        }
      });
    }

    return { success: true, result };

  } catch (e) {
    return { success: false, error: e.message };
  }
};


// 🔥 MESSAGE BRIDGE (NEW)

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== "RUN_SQL") return;

  const res = window.runSQL(event.data.sql, event.data.tables);

  window.postMessage({
    type: "SQL_RESULT",
    requestId: event.data.requestId,
    result: res
  }, "*");
});