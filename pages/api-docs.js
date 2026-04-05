'use strict';
/* pages/api-docs.js — API documentation page */

const ApiDocsPage = (() => {
  function init() {
    document.querySelectorAll('.api-try-btn').forEach(btn => {
      btn.addEventListener('click', () => tryEndpoint(btn.dataset.endpoint));
    });
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.code-wrap')?.querySelector('pre') ?? btn.previousElementSibling;
        navigator.clipboard.writeText(pre?.textContent ?? '').then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  async function tryEndpoint(endpoint) {
    const resultEl = document.getElementById(`try-result-${endpoint}`);
    if (!resultEl) return;
    resultEl.textContent = 'Fetching…';
    resultEl.style.color = 'var(--text-muted)';
    try {
      let res;
      if (endpoint === 'quotes') {
        const sym = document.getElementById('try-symbols')?.value || 'AAPL,MSFT';
        res = await fetch(`/market/quotes?symbols=${encodeURIComponent(sym)}`);
      } else if (endpoint === 'solve') {
        const eq  = document.getElementById('try-equation')?.value  || '19689a + 42155b + 1k = 500000';
        const con = document.getElementById('try-constraints')?.value || '{"a":{"max":25},"b":{"max":11},"k":{"max":5000}}';
        res = await fetch('/solve/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equation: eq, constraints: JSON.parse(con) }),
        });
      }
      const body = await res.json();
      resultEl.textContent = JSON.stringify(body, null, 2);
      resultEl.style.color = res.ok ? 'var(--text-secondary)' : 'var(--loss)';
    } catch (err) {
      resultEl.textContent = `Error: ${err.message}`;
      resultEl.style.color = 'var(--loss)';
    }
  }

  return { init };
})();
