/**
 * Market Data Route — GET /market/quotes?symbols=AAPL,MSFT,NVDA
 *
 * Strategy:
 *  1. Try Yahoo Finance v7 (no API key). If it succeeds → use it.
 *  2. If Yahoo times out or returns bad data → fall back to static demo data.
 *
 * Cache: 30-second in-memory TTL to avoid rate limits.
 */

const https = require("https");
const express = require("express");

// ---------------------------------------------------------------------------
// Static fallback data (always up-to-date enough for a hackathon demo)
// ---------------------------------------------------------------------------
const STATIC_QUOTES = {
  AAPL:  { symbol: "AAPL",  price: 196.89, changePercent:  1.23, name: "Apple Inc.",              sector: "Technology",   currency: "USD", source: "static" },
  MSFT:  { symbol: "MSFT",  price: 421.55, changePercent:  0.87, name: "Microsoft Corporation",   sector: "Technology",   currency: "USD", source: "static" },
  NVDA:  { symbol: "NVDA",  price: 875.40, changePercent:  2.41, name: "NVIDIA Corporation",      sector: "Technology",   currency: "USD", source: "static" },
  GOOGL: { symbol: "GOOGL", price: 162.30, changePercent: -0.34, name: "Alphabet Inc.",           sector: "Technology",   currency: "USD", source: "static" },
  AMZN:  { symbol: "AMZN",  price: 193.60, changePercent:  1.05, name: "Amazon.com Inc.",         sector: "Consumer",     currency: "USD", source: "static" },
  TSLA:  { symbol: "TSLA",  price: 251.20, changePercent: -1.78, name: "Tesla, Inc.",             sector: "Automotive",   currency: "USD", source: "static" },
  META:  { symbol: "META",  price: 512.75, changePercent:  0.62, name: "Meta Platforms Inc.",     sector: "Technology",   currency: "USD", source: "static" },
  NFLX:  { symbol: "NFLX",  price: 628.90, changePercent:  1.94, name: "Netflix Inc.",            sector: "Entertainment",currency: "USD", source: "static" },
  AMD:   { symbol: "AMD",   price: 178.45, changePercent: -0.91, name: "Advanced Micro Devices",  sector: "Technology",   currency: "USD", source: "static" },
  INTC:  { symbol: "INTC",  price: 22.80,  changePercent: -2.15, name: "Intel Corporation",       sector: "Technology",   currency: "USD", source: "static" },
  JPM:   { symbol: "JPM",   price: 235.60, changePercent:  0.45, name: "JPMorgan Chase & Co.",    sector: "Finance",      currency: "USD", source: "static" },
  BAC:   { symbol: "BAC",   price: 41.30,  changePercent:  0.22, name: "Bank of America Corp.",   sector: "Finance",      currency: "USD", source: "static" },
  V:     { symbol: "V",     price: 294.80, changePercent:  0.78, name: "Visa Inc.",               sector: "Finance",      currency: "USD", source: "static" },
  MA:    { symbol: "MA",    price: 481.20, changePercent:  0.55, name: "Mastercard Inc.",         sector: "Finance",      currency: "USD", source: "static" },
  SPY:   { symbol: "SPY",   price: 523.40, changePercent:  0.61, name: "SPDR S&P 500 ETF",       sector: "ETF",          currency: "USD", source: "static" },
  QQQ:   { symbol: "QQQ",   price: 446.90, changePercent:  0.84, name: "Invesco QQQ Trust",       sector: "ETF",          currency: "USD", source: "static" },
  PYPL:  { symbol: "PYPL",  price: 62.40,  changePercent: -0.67, name: "PayPal Holdings Inc.",    sector: "Finance",      currency: "USD", source: "static" },
  UBER:  { symbol: "UBER",  price: 71.85,  changePercent:  1.32, name: "Uber Technologies",       sector: "Technology",   currency: "USD", source: "static" },
  SHOP:  { symbol: "SHOP",  price: 78.90,  changePercent:  2.08, name: "Shopify Inc.",            sector: "Technology",   currency: "USD", source: "static" },
  COIN:  { symbol: "COIN",  price: 224.60, changePercent:  3.45, name: "Coinbase Global Inc.",    sector: "Finance",      currency: "USD", source: "static" },
  PLTR:  { symbol: "PLTR",  price: 24.70,  changePercent:  1.67, name: "Palantir Technologies",   sector: "Technology",   currency: "USD", source: "static" },
  WMT:   { symbol: "WMT",   price: 68.40,  changePercent:  0.31, name: "Walmart Inc.",            sector: "Consumer",     currency: "USD", source: "static" },
  JNJ:   { symbol: "JNJ",   price: 152.30, changePercent: -0.18, name: "Johnson & Johnson",       sector: "Healthcare",   currency: "USD", source: "static" },
  DIS:   { symbol: "DIS",   price: 98.70,  changePercent:  0.93, name: "Walt Disney Company",     sector: "Entertainment",currency: "USD", source: "static" },
};


// ---------------------------------------------------------------------------
// Simple in-memory cache
// ---------------------------------------------------------------------------
const cache = new Map(); // key → { data, expires }

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs = 30_000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Symbol validation
// ---------------------------------------------------------------------------
const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

function validateSymbols(raw) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, message: "symbols query param is required." };
  }

  const symbols = raw
    .toUpperCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (symbols.length === 0) {
    return { ok: false, message: "At least one symbol is required." };
  }
  if (symbols.length > 6) {
    return { ok: false, message: "Maximum 6 symbols allowed." };
  }

  for (const s of symbols) {
    if (!SYMBOL_RE.test(s)) {
      return { ok: false, message: `Invalid symbol format: ${s}` };
    }
  }

  return { ok: true, symbols };
}

// ---------------------------------------------------------------------------
// Yahoo Finance fetch (unofficial, no API key)
// ---------------------------------------------------------------------------
function fetchYahooQuotes(symbols, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const csv = symbols.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${csv}&fields=regularMarketPrice,longName,currency`;

    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Yahoo returned HTTP ${res.statusCode}`));
        }

        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            const result = parsed?.quoteResponse?.result;
            if (!Array.isArray(result) || result.length === 0) {
              return reject(new Error("Yahoo returned empty result."));
            }

            /** @type {Record<string, any>} */
            const data = {};
            for (const item of result) {
              const sym = item.symbol?.toUpperCase();
              const price = item.regularMarketPrice;
              if (!sym || typeof price !== "number") continue;
              data[sym] = {
                symbol: sym,
                price,
                name: item.longName || item.shortName || sym,
                currency: item.currency || "USD",
                source: "live",
              };
            }

            if (Object.keys(data).length === 0) {
              return reject(new Error("No valid price data from Yahoo."));
            }

            resolve(data);
          } catch (e) {
            reject(new Error("Failed to parse Yahoo response."));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Yahoo Finance request timed out."));
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Get static fallback for a list of symbols
// ---------------------------------------------------------------------------
function getStaticFallback(symbols) {
  /** @type {Record<string, any>} */
  const data = {};
  const missing = [];

  for (const sym of symbols) {
    if (STATIC_QUOTES[sym]) {
      data[sym] = STATIC_QUOTES[sym];
    } else {
      missing.push(sym);
    }
  }

  return { data, missing };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function createMarketRouter() {
  const router = express.Router();

  router.get("/market/quotes", async (req, res) => {
    const requestId = req.requestId || res.getHeader("x-request-id") || null;

    const validation = validateSymbols(req.query.symbols);
    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        requestId,
        data: null,
        message: validation.message,
      });
    }

    const { symbols } = validation;
    const cacheKey = symbols.slice().sort().join(",");

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({
        ok: true,
        requestId,
        data: cached.data,
        source: cached.source,
        cachedAt: cached.cachedAt,
        message: null,
      });
    }

    let finalData = {};
    let source = "live";
    let warning = null;

    // Try Yahoo Finance live
    try {
      const liveData = await fetchYahooQuotes(symbols);

      // Validate all requested symbols came back
      const missingFromLive = symbols.filter((s) => !liveData[s]);
      if (missingFromLive.length > 0) {
        // For missing ones, try static fallback
        const { data: staticData, missing: stillMissing } = getStaticFallback(missingFromLive);
        finalData = { ...liveData, ...staticData };

        if (stillMissing.length > 0) {
          return res.status(422).json({
            ok: false,
            requestId,
            data: null,
            message: `Could not find price data for: ${stillMissing.join(", ")}. Try common tickers like AAPL, MSFT, NVDA, GOOGL, AMZN, TSLA.`,
          });
        }

        warning = `Live prices unavailable for ${missingFromLive.join(", ")}; using demo prices.`;
        source = "mixed";
      } else {
        finalData = liveData;
        source = "live";
      }
    } catch (liveErr) {
      // Yahoo failed entirely — use static fallback
      console.warn("[market] Yahoo Finance unavailable:", liveErr.message, "— using static demo data.");

      const { data: staticData, missing: stillMissing } = getStaticFallback(symbols);
      if (stillMissing.length > 0) {
        return res.status(422).json({
          ok: false,
          requestId,
          data: null,
          message: `Live market data unavailable and no demo data for: ${stillMissing.join(", ")}. Try: AAPL, MSFT, NVDA, GOOGL, AMZN, TSLA, META, NFLX, AMD, JPM.`,
        });
      }

      finalData = staticData;
      source = "static";
      warning = "Live market data unavailable. Prices shown are static demo values.";
    }

    const payload = {
      data: finalData,
      source,
      cachedAt: Date.now(),
    };
    setCache(cacheKey, payload);

    return res.status(200).json({
      ok: true,
      requestId,
      data: finalData,
      source,
      cachedAt: payload.cachedAt,
      message: null,
      warning: warning || null,
    });
  });

  return router;
}

module.exports = { createMarketRouter };
