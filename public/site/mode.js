// Day / night mode: runs before the page is painted, so a saved choice never flashes the other palette.
// No saved choice = automatic: the stylesheet follows the visitor's device (prefers-color-scheme).
try {
  const saved = localStorage.getItem('gaut-mode');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.mode = saved;
} catch { /* storage may be blocked: stay on automatic */ }
