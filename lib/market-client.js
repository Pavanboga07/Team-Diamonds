'use strict';
/* lib/market-client.js — shared market data API client */

const MarketClient = {
  async fetchQuotes(symbols) {
    const url  = `/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`;
    const res  = await fetch(url, { method: 'GET' });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      throw new Error(body?.message || `Quotes request failed (HTTP ${res.status})`);
    }
    return body; // { ok, data:{AAPL:{price,name,...},...}, source, warning, requestId }
  },
};
