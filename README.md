# sql-webtables
# sql-webtables

`sql-webtables` is a browser extension project that discovers table-like data on web pages and lets you query that data with SQL.

## What it does

- Scans page content for `<table>` elements and table-like layouts.
- Normalizes extracted data so it can be queried.
- Runs SQL queries against extracted datasets using AlaSQL.
- Provides popup/sidebar UI files for interacting with query results.
- Includes sample test pages for validating extraction behavior.

## Project structure

- `manifest.json` — extension manifest and entry points.
- `content.js` / `page-bridge.js` — page integration and extraction wiring.
- `query-engine.js` — SQL execution and dataset handling.
- `popup.html`, `popup.js`, `sidebar.js`, `sidebar.css` — extension UI.
- `alasql.min.js` — embedded SQL engine.
- `test-pages/` — local HTML fixtures with different table patterns.

## Local development

1. Clone this repository.
2. Open your Chromium-based browser.
3. Go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select this project directory.
6. Open one of the files in `test-pages/` and test queries through the extension UI.

