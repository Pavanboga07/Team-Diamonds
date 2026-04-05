/* ═══════════════════════════════════════════════════════════════════════════
   QuantSolve Portfolio Dashboard — Frontend Logic
   Flow: ticker input → /market/quotes → equation builder → /solve/v2 → render
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── API Config ─────────────────────────────────────────────────────────────
const API_BASE =
  location.protocol === "http:" || location.protocol === "https:"
    ? location.origin
    : "http://localhost:3000";

const API_QUOTES    = `${API_BASE}/market/quotes`;
const API_SOLVE_V2  = `${API_BASE}/solve/v2`;

const MAX_TICKERS       = 6;
const MIN_TICKERS       = 2;
const MAX_RESULTS_SHOW  = 100;
const MAX_SHARES_CAP    = 500;   // prevent solver blowup on cheap stocks

// Single-letter variable names for the solver (tokenizer limitation)
// Tickers map to a,b,c,d,e,f; cash uses 'k'
const TICKER_VARS = ['a','b','c','d','e','f'];
const CASH_VAR    = 'k';

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const tickerInput     = /** @type {HTMLInputElement}  */ (document.getElementById("tickerInput"));
const tickerTagsEl    = document.getElementById("tickerTags");
const budgetInput     = /** @type {HTMLInputElement}  */ (document.getElementById("budgetInput"));
const maxLeftoverInput= /** @type {HTMLInputElement}  */ (document.getElementById("maxLeftoverInput"));
const generateBtn     = document.getElementById("generateBtn");
const quickTickers    = document.querySelectorAll(".quick-ticker");

const kpiStrip        = document.getElementById("kpiStrip");
const kpiBudget       = document.getElementById("kpiBudget");
const kpiInvested     = document.getElementById("kpiInvested");
const kpiCash         = document.getElementById("kpiCash");
const kpiCount        = document.getElementById("kpiCount");

const statusDot       = document.getElementById("statusDot");
const statusText      = document.getElementById("statusText");
const statusBar       = document.getElementById("statusBar");
const statusMeta      = document.getElementById("statusMeta");
const statusRequestId = document.getElementById("statusRequestId");
const liveBadge       = document.getElementById("liveBadge");

const resultsCard     = document.getElementById("resultsCard");
const resultsMeta     = document.getElementById("resultsMeta");
const sourceBadge     = document.getElementById("sourceBadge");
const portfolioThead  = document.getElementById("portfolioThead");
const portfolioTbody  = document.getElementById("portfolioTbody");

const equationDisplay    = document.getElementById("equationDisplay");
const constraintsDisplay = document.getElementById("constraintsDisplay");
const pricesDisplay      = document.getElementById("pricesDisplay");

const emptyState      = document.getElementById("emptyState");
const solverMath      = document.getElementById("solverMath");

// ─── State ───────────────────────────────────────────────────────────────────
/** @type {string[]} */
let selectedTickers = [];
/** @type {Record<string, { symbol: string, price: number, name: string, currency: string, source: string }>} */
let liveQuotes = {};
/** @type {Array<Record<string, number>>} */
let portfolios = [];

// ─── Formatting helpers ──────────────────────────────────────────────────────
const fmtUSD = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n) =>
  n == null ? "—" : Number(n).toFixed(1) + "%";

// ─── Status helpers ──────────────────────────────────────────────────────────
/**
 * @param {'idle'|'loading'|'success'|'error'|'warn'} state
 * @param {string} message
 */
function setStatus(state, message) {
  statusDot.className = `status-dot status-dot--${state}`;
  statusText.textContent = message;
}

function setRequestId(id) {
  if (id) {
    statusMeta.hidden = false;
    statusRequestId.textContent = `req-${id}`;
  } else {
    statusMeta.hidden = true;
    statusRequestId.textContent = "";
  }
}

// ─── Live badge ──────────────────────────────────────────────────────────────
function updateDataSourceBadge(source) {
  if (source === "live") {
    liveBadge.className = "badge badge--live";
    liveBadge.innerHTML = `<span class="badge__dot"></span>Live Data`;
  } else if (source === "static") {
    liveBadge.className = "badge badge--live badge--static";
    liveBadge.innerHTML = `<span class="badge__dot"></span>Demo Prices`;
  } else {
    liveBadge.className = "badge badge--live badge--static";
    liveBadge.innerHTML = `<span class="badge__dot"></span>Mixed Prices`;
  }
}

// ─── Ticker management ───────────────────────────────────────────────────────
function renderTickerChips() {
  tickerTagsEl.innerHTML = "";
  for (const sym of selectedTickers) {
    const chip = document.createElement("span");
    chip.className = "ticker-chip";
    chip.setAttribute("data-ticker", sym);

    const label = document.createElement("span");
    label.textContent = sym;

    const removeBtn = document.createElement("button");
    removeBtn.className = "ticker-chip__remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${sym}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeTicker(sym));

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    tickerTagsEl.appendChild(chip);
  }

  // Update quick-ticker button states
  quickTickers.forEach((btn) => {
    const t = btn.dataset.ticker;
    if (selectedTickers.includes(t)) {
      btn.classList.add("is-active");
      btn.disabled = true;
    } else if (selectedTickers.length >= MAX_TICKERS) {
      btn.classList.remove("is-active");
      btn.disabled = true;
    } else {
      btn.classList.remove("is-active");
      btn.disabled = false;
    }
  });
}

function addTicker(raw) {
  const sym = raw.toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, "");
  if (!sym) return;
  if (sym.length > 10) {
    setStatus("warn", `Symbol "${sym}" is too long.`);
    return;
  }
  if (selectedTickers.includes(sym)) {
    tickerInput.value = "";
    return;
  }
  if (selectedTickers.length >= MAX_TICKERS) {
    setStatus("warn", `Maximum ${MAX_TICKERS} tickers allowed.`);
    return;
  }
  selectedTickers = [...selectedTickers, sym];
  tickerInput.value = "";
  renderTickerChips();
}

function removeTicker(sym) {
  selectedTickers = selectedTickers.filter((t) => t !== sym);
  renderTickerChips();
}

// ─── Loading state ───────────────────────────────────────────────────────────
function setLoading(isLoading, message = "Solving...") {
  generateBtn.disabled = isLoading;
  tickerInput.disabled = isLoading;
  budgetInput.disabled = isLoading;
  maxLeftoverInput.disabled = isLoading;

  if (isLoading) {
    generateBtn.classList.add("is-loading");
    generateBtn.querySelector(".btn__text").textContent = message;
  } else {
    generateBtn.classList.remove("is-loading");
    generateBtn.querySelector(".btn__text").textContent = "Generate Portfolios";
  }
}

// ─── Input validation ────────────────────────────────────────────────────────
function validateInputs() {
  if (selectedTickers.length < MIN_TICKERS) {
    return { ok: false, message: `Please add at least ${MIN_TICKERS} stock tickers.` };
  }
  if (selectedTickers.length > MAX_TICKERS) {
    return { ok: false, message: `Maximum ${MAX_TICKERS} tickers allowed.` };
  }

  const budgetRaw = parseFloat(budgetInput.value);
  if (!Number.isFinite(budgetRaw) || budgetRaw < 1) {
    return { ok: false, message: "Please enter a valid budget (≥ $1)." };
  }
  if (budgetRaw > 999_999) {
    return { ok: false, message: "Budget must be under $999,999." };
  }

  const leftoverRaw = parseFloat(maxLeftoverInput.value);
  if (!Number.isFinite(leftoverRaw) || leftoverRaw < 0) {
    return { ok: false, message: "Max leftover cash must be ≥ $0." };
  }
  if (leftoverRaw >= budgetRaw) {
    return { ok: false, message: "Max leftover must be less than the budget." };
  }

  return {
    ok: true,
    budgetUsd: budgetRaw,
    maxLeftoverUsd: leftoverRaw,
  };
}

// ─── Fetch quotes ────────────────────────────────────────────────────────────
async function fetchQuotes(tickers) {
  const symbols = tickers.join(",");
  const url = `${API_QUOTES}?symbols=${encodeURIComponent(symbols)}`;

  const res = await fetch(url, { method: "GET" });
  const body = await res.json();

  if (!res.ok || !body.ok) {
    throw new Error(body?.message || `Quotes request failed (HTTP ${res.status})`);
  }

  return body; // { data, source, warning, requestId }
}

// ─── Portfolio equation builder ──────────────────────────────────────────────
/**
 * Returns the single-letter variable assigned to a ticker at a given index.
 * The tokenizer only supports single-char identifiers, so we use a,b,c,d,e,f.
 * @param {number} idx 0-based index into selectedTickers
 */
function toVarName(idx) {
  return "abcdef"[idx];
}

/**
 * Build the equation and constraints from quotes + settings.
 *
 * IMPORTANT: The tokenizer only supports single-letter variable names.
 * We map tickers → a,b,c,d,e,f and cash → k.
 *
 * @param {string[]} tickers
 * @param {Record<string, {price: number}>} quotes
 * @param {number} budgetUsd
 * @param {number} maxLeftoverUsd
 */
function buildPortfolioPayload(tickers, quotes, budgetUsd, maxLeftoverUsd) {
  const budgetCents      = Math.round(budgetUsd * 100);
  const maxLeftoverCents = Math.round(maxLeftoverUsd * 100);

  const equationParts = [];
  const constraints   = {};
  const priceMap      = {};   // ticker → { varName, priceCents, maxShares }

  tickers.forEach((ticker, idx) => {
    const price      = quotes[ticker].price;
    const priceCents = Math.round(price * 100);
    const varName    = toVarName(idx);  // 'a','b','c',...

    if (priceCents <= 0) {
      throw new Error(`Invalid price for ${ticker}: $${price}`);
    }

    equationParts.push(`${priceCents}${varName}`);  // implicit multiply: "19689a"

    // Cap shares to prevent solver search blow-up on cheap stocks
    const maxShares = Math.min(
      Math.floor(budgetCents / priceCents),
      MAX_SHARES_CAP
    );
    constraints[varName] = { max: maxShares };
    priceMap[ticker] = { varName, priceCents, maxShares };
  });

  // Cash variable (single letter 'k') carries the remainder
  equationParts.push(`1${CASH_VAR}`);  // "1k"
  constraints[CASH_VAR] = { max: maxLeftoverCents };

  const equation = `${equationParts.join(" + ")} = ${budgetCents}`;

  return { equation, constraints, budgetCents, maxLeftoverCents, priceMap };
}

// ─── Sort portfolios ─────────────────────────────────────────────────────────
/**
 * Sort: most invested first, then least cash, then stable lex.
 * @param {Array<Record<string,number>>} portfolios
 * @param {number} budgetCents
 */
function sortPortfolios(portfolios, budgetCents) {
  return portfolios.slice().sort((a, b) => {
    const cashA = a[CASH_VAR] ?? 0;
    const cashB = b[CASH_VAR] ?? 0;
    const investedA = budgetCents - cashA;
    const investedB = budgetCents - cashB;
    if (investedB !== investedA) return investedB - investedA;
    if (cashA !== cashB) return cashA - cashB;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}

// ─── Render KPI strip ────────────────────────────────────────────────────────
/**
 * @param {number} budgetUsd
 * @param {Array<Record<string,number>>} sorted
 * @param {number} budgetCents
 * @param {number} total total portfolios from engine
 */
function renderKPIs(budgetUsd, sorted, budgetCents, total) {
  const best = sorted[0];
  const bestCashCents = best?.[CASH_VAR] ?? budgetCents;
  const bestInvestedCents = budgetCents - bestCashCents;

  kpiBudget.textContent   = fmtUSD(budgetUsd);
  kpiInvested.textContent = fmtUSD(bestInvestedCents / 100);
  kpiCash.textContent     = fmtUSD(bestCashCents / 100);
  kpiCount.textContent    = String(total);

  kpiStrip.hidden = false;
}

// ─── Render results table ────────────────────────────────────────────────────
/**
 * @param {string[]} tickers
 * @param {Array<Record<string,number>>} sorted     displayed portfolios (≤100)
 * @param {number} budgetCents
 * @param {Record<string,{price:number}>} quotes
 * @param {number} total                            total from solver
 * @param {string} source                           'live'|'static'|'mixed'
 */
function renderTable(tickers, sorted, budgetCents, quotes, total, source) {
  portfolioThead.innerHTML = "";
  portfolioTbody.innerHTML = "";

  // ── Header ──
  const trh = document.createElement("tr");

  const thNum = document.createElement("th");
  thNum.className = "col--number";
  thNum.textContent = "#";
  trh.appendChild(thNum);

  for (const ticker of tickers) {
    const th = document.createElement("th");
    th.className = "col--shares";
    th.textContent = `${ticker} Shares`;
    trh.appendChild(th);
  }

  const thInvested = document.createElement("th");
  thInvested.className = "col--money";
  thInvested.textContent = "Invested";
  trh.appendChild(thInvested);

  const thCash = document.createElement("th");
  thCash.className = "col--money";
  thCash.textContent = "Cash Left";
  trh.appendChild(thCash);

  const thPct = document.createElement("th");
  thPct.className = "col--pct";
  thPct.textContent = "% Invested";
  trh.appendChild(thPct);

  portfolioThead.appendChild(trh);

  // ── Rows ──
  const displayed = sorted.slice(0, MAX_RESULTS_SHOW);

  for (let i = 0; i < displayed.length; i++) {
    const row = displayed[i];
    const tr = document.createElement("tr");
    if (i === 0) tr.classList.add("row--best");

    const cashCents     = row[CASH_VAR] ?? 0;
    const investedCents = budgetCents - cashCents;
    const pctInvested   = budgetCents > 0 ? (investedCents / budgetCents) * 100 : 0;

    // Row number
    const tdNum = document.createElement("td");
    tdNum.className = "col--number";
    tdNum.textContent = String(i + 1);
    tr.appendChild(tdNum);

    // Shares per ticker
    tickers.forEach((ticker, idx) => {
      const varName = toVarName(idx);
      const shares  = row[varName] ?? 0;
      const td = document.createElement("td");
      td.className = "col--shares";
      td.textContent = String(shares);
      tr.appendChild(td);
    });

    // Invested $
    const tdInvested = document.createElement("td");
    tdInvested.className = "col--money td--invested";
    tdInvested.textContent = fmtUSD(investedCents / 100);
    tr.appendChild(tdInvested);

    // Cash left $  — solver stores it in variable CASH_VAR ('k')
    const tdCash = document.createElement("td");
    tdCash.className = "col--money td--cash";
    tdCash.textContent = fmtUSD(cashCents / 100);
    tr.appendChild(tdCash);

    // % invested with inline bar
    const tdPct = document.createElement("td");
    tdPct.className = "col--pct td--pct";
    tdPct.innerHTML = `
      <div class="pct-bar">
        <div class="pct-bar__track">
          <div class="pct-bar__fill" style="width:${Math.min(pctInvested, 100).toFixed(1)}%"></div>
        </div>
        <span class="pct-text">${fmtPct(pctInvested)}</span>
      </div>`;
    tr.appendChild(tdPct);

    portfolioTbody.appendChild(tr);
  }

  // ── Meta ──
  const showing = displayed.length;
  resultsMeta.textContent =
    total > MAX_RESULTS_SHOW
      ? `Showing ${showing} of ${total} portfolios`
      : `${showing} portfolio${showing !== 1 ? "s" : ""} found`;

  sourceBadge.textContent = source === "live" ? "Live Prices" : "Demo Prices";
  sourceBadge.className   = source === "live" ? "source-badge source-badge--live" : "source-badge source-badge--static";

  resultsCard.hidden = false;
  emptyState.hidden  = true;
}

// ─── Render advanced panel ───────────────────────────────────────────────────
function renderMathPanel(equation, constraints, priceMap, tickers) {
  equationDisplay.textContent = equation;
  constraintsDisplay.textContent = JSON.stringify(constraints, null, 2);

  const lines = tickers.map((t, idx) => {
    const pm    = priceMap[t];
    const price = liveQuotes[t]?.price;
    const varName = toVarName(idx);
    return `${varName} = ${t}  →  $${price?.toFixed(2)} = ${pm.priceCents} cents  [max ${pm.maxShares} shares]`;
  });
  lines.push(`${CASH_VAR} = cash  [max ${constraints[CASH_VAR]?.max ?? 0} cents leftover]`);
  pricesDisplay.textContent = lines.join("\n");
}

// ─── MAIN Generate flow ──────────────────────────────────────────────────────
async function generatePortfolios() {
  // 1. Validate inputs
  const validation = validateInputs();
  if (!validation.ok) {
    setStatus("warn", validation.message);
    return;
  }
  const { budgetUsd, maxLeftoverUsd } = validation;

  // 2. Reset UI
  resultsCard.hidden = true;
  kpiStrip.hidden    = true;
  emptyState.hidden  = true;
  setRequestId(null);
  setLoading(true, "Fetching live prices…");
  setStatus("loading", `Fetching quotes for ${selectedTickers.join(", ")}…`);

  try {
    // 3. Fetch market quotes
    let quotesResp;
    try {
      quotesResp = await fetchQuotes(selectedTickers);
    } catch (err) {
      setStatus("error", `Could not load prices: ${err.message}`);
      setLoading(false);
      return;
    }

    liveQuotes = quotesResp.data;
    const source  = quotesResp.source || "static";
    const warning = quotesResp.warning;
    const reqId   = quotesResp.requestId;

    setRequestId(reqId);
    updateDataSourceBadge(source);

    // Build price status text
    const priceStr = selectedTickers
      .map((t) => `${t} ${fmtUSD(liveQuotes[t]?.price)}`)
      .join(" · ");
    setStatus("loading", `Prices loaded — ${priceStr}`);

    if (warning) {
      setStatus("warn", warning + " Generating portfolios…");
    }

    // 4. Build equation + constraints
    let payload;
    try {
      payload = buildPortfolioPayload(selectedTickers, liveQuotes, budgetUsd, maxLeftoverUsd);
    } catch (err) {
      setStatus("error", `Equation build failed: ${err.message}`);
      setLoading(false);
      return;
    }

    const { equation, constraints, budgetCents, priceMap } = payload;

    // Render math panel early (for judges watching)
    renderMathPanel(equation, constraints, priceMap, selectedTickers);

    setLoading(true, "Generating portfolios…");
    setStatus("loading", "Running integer-linear solver…");

    // 5. Call /solve/v2
    let solveResp;
    try {
      const res = await fetch(API_SOLVE_V2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equation, constraints }),
      });
      solveResp = await res.json();
      setRequestId(solveResp.requestId || null);
    } catch (err) {
      setStatus("error", `Solver unreachable: ${err.message}`);
      setLoading(false);
      return;
    }

    if (!solveResp.ok) {
      const msg = solveResp.message || "Solver returned an error.";
      setStatus("error", msg);
      emptyState.hidden = false;
      emptyState.querySelector(".empty-state__desc").textContent = msg;
      setLoading(false);
      return;
    }

    if (!Array.isArray(solveResp.data) || solveResp.data.length === 0) {
      setStatus("warn", "No feasible portfolios found. Try increasing budget or max leftover cash.");
      const desc = `No whole-share portfolios fit your constraints. Equation: ${equation}`;
      emptyState.hidden = false;
      emptyState.querySelector(".empty-state__desc").textContent = desc;
      setLoading(false);
      return;
    }

    // 6. Sort + render
    const total   = solveResp.data.length;
    const sorted  = sortPortfolios(solveResp.data, budgetCents);

    renderKPIs(budgetUsd, sorted, budgetCents, total);
    renderTable(selectedTickers, sorted, budgetCents, liveQuotes, total, source);

    const investedStr = fmtUSD((budgetCents - (sorted[0][CASH_VAR] ?? 0)) / 100);
    const warningNote = warning ? ` ⚠ ${warning}` : "";
    setStatus(
      "success",
      `${total} portfolio${total !== 1 ? "s" : ""} found · Best: ${investedStr} invested · ${priceStr}${warningNote}`
    );

  } finally {
    setLoading(false);
  }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

// Ticker input — Enter or comma to add
tickerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = tickerInput.value.replace(",", "").trim();
    if (val) addTicker(val);
  } else if (e.key === "Backspace" && tickerInput.value === "" && selectedTickers.length > 0) {
    // Remove last ticker on backspace when input empty
    removeTicker(selectedTickers[selectedTickers.length - 1]);
  }
});

// Also add on blur (when user tabs away)
tickerInput.addEventListener("blur", () => {
  const val = tickerInput.value.trim();
  if (val) {
    addTicker(val);
  }
});

// Quick-add popular tickers
quickTickers.forEach((btn) => {
  btn.addEventListener("click", () => {
    addTicker(btn.dataset.ticker);
  });
});

// Generate button
generateBtn.addEventListener("click", generatePortfolios);

// Enter on budget/leftover also triggers generate
[budgetInput, maxLeftoverInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      generatePortfolios();
    }
  });
});

// ─── Init ────────────────────────────────────────────────────────────────────
renderTickerChips();
setStatus("idle", "Select tickers and a budget to generate portfolios.");
emptyState.hidden  = false;
resultsCard.hidden = true;
kpiStrip.hidden    = true;
statusMeta.hidden  = true;
