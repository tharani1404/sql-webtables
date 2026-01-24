document.getElementById("scan").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__WEB_TABLES__ || []
  });

  document.getElementById("out").textContent =
    JSON.stringify(result[0].result.map(t => ({
      type: t.type,
      rows: t.rows.length,
      cols: t.rows[0]?.length
    })), null, 2);
};
