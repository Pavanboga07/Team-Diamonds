/* QuantSolve — vanilla JS UI logic */

const API_URL = "http://localhost:3000/solve";
const MAX_RESULTS = 100;

/** @type {HTMLInputElement} */
const equationInput = document.getElementById("equationInput");
/** @type {HTMLButtonElement} */
const solveBtn = document.getElementById("solveBtn");

/** @type {HTMLInputElement} */
const constraintInput = document.getElementById("constraintInput");
/** @type {HTMLButtonElement} */
const addConstraintBtn = document.getElementById("addConstraintBtn");
/** @type {HTMLDivElement} */
const constraintsTags = document.getElementById("constraintsTags");
/** @type {HTMLSpanElement} */
const constraintsCount = document.getElementById("constraintsCount");

/** @type {HTMLDivElement} */
const statusLine = document.getElementById("statusLine");
/** @type {HTMLUListElement} */
const statusList = document.getElementById("statusList");

/** @type {HTMLDivElement} */
const resultsEmpty = document.getElementById("resultsEmpty");
/** @type {HTMLDivElement} */
const tableWrap = document.getElementById("tableWrap");
/** @type {HTMLTableSectionElement} */
const resultsThead = document.getElementById("resultsThead");
/** @type {HTMLTableSectionElement} */
const resultsTbody = document.getElementById("resultsTbody");
/** @type {HTMLSpanElement} */
const resultsMeta = document.getElementById("resultsMeta");

/** @type {string[]} */
let constraintStrings = [];

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function setLoading(isLoading) {
  solveBtn.disabled = isLoading;
  addConstraintBtn.disabled = isLoading;
  equationInput.disabled = isLoading;
  constraintInput.disabled = isLoading;

  solveBtn.textContent = isLoading ? "Solving..." : "Solve";
}

function clearResults() {
  resultsThead.innerHTML = "";
  resultsTbody.innerHTML = "";
  tableWrap.hidden = true;
  resultsEmpty.hidden = false;
  resultsMeta.textContent = "—";
}

function showStatusLine(message, tone = "muted") {
  statusLine.textContent = message;
  statusLine.className = `status__line status__line--${tone}`;
}

function clearStatusItems() {
  statusList.innerHTML = "";
  statusList.hidden = true;
}

function addStatusItem(kind, message) {
  statusList.hidden = false;
  const li = document.createElement("li");
  li.className = `status__item ${kind === "error" ? "status__item--error" : "status__item--warn"}`;
  li.textContent = message;
  statusList.appendChild(li);
}

function renderConstraints() {
  constraintsTags.innerHTML = "";

  for (const c of constraintStrings) {
    const tag = document.createElement("span");
    tag.className = "tag";

    const text = document.createElement("span");
    text.className = "tag__text";
    text.textContent = c;

    const remove = document.createElement("button");
    remove.className = "tag__remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove constraint ${c}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      constraintStrings = constraintStrings.filter((x) => x !== c);
      renderConstraints();
    });

    tag.appendChild(text);
    tag.appendChild(remove);
    constraintsTags.appendChild(tag);
  }

  constraintsCount.textContent = String(constraintStrings.length);
}

function addConstraintFromInput() {
  const raw = constraintInput.value;
  const normalized = normalizeWhitespace(raw);
  if (!normalized) return;

  if (constraintStrings.includes(normalized)) {
    showStatusLine("Constraint already added.", "muted");
    constraintInput.select();
    return;
  }

  constraintStrings = [...constraintStrings, normalized];
  constraintInput.value = "";
  renderConstraints();
  showStatusLine("Constraint added.", "muted");
}

/**
 * Parse a constraint string into a structured representation.
 * Supported (per spec):
 *  - x >= 5 -> { var: 'x', type: 'min', value: 5 }
 *  - y <= 3 -> { var: 'y', type: 'max', value: 3 }
 *  - z % 2 == 0 -> { var: 'z', type: 'even', value: true }
 */
function parseConstraintString(input) {
  const s = normalizeWhitespace(input);

  // even-ness pattern: z % 2 == 0
  const evenMatch = /^([A-Za-z_]\w*)\s*%\s*2\s*==\s*0$/.exec(s);
  if (evenMatch) {
    return { variable: evenMatch[1], kind: "even", value: true };
  }

  // min/max/equality pattern: x >= 5, y <= 3, a == 10
  const cmpMatch = /^([A-Za-z_]\w*)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (cmpMatch) {
    const variable = cmpMatch[1];
    const op = cmpMatch[2];
    const value = Number(cmpMatch[3]);

    if (!Number.isFinite(value)) {
      return { error: `Invalid numeric value in constraint: ${input}` };
    }

    if (op === ">=" || op === ">") return { variable, kind: "min", value };
    if (op === "<=" || op === "<") return { variable, kind: "max", value };
    return { variable, kind: "eq", value };
  }

  return {
    error:
      "Unsupported constraint format. Use examples like: x >= 5, y <= 3, z % 2 == 0",
  };
}

function ensureVarBucket(obj, variable) {
  if (!obj[variable]) obj[variable] = {};
  return obj[variable];
}

function mergeNumericBound(existing, incoming, type) {
  if (existing == null) return incoming;
  if (type === "min") return Math.max(existing, incoming);
  return Math.min(existing, incoming);
}

/**
 * Convert a list of constraint strings into the API object.
 * Example output:
 * {
 *   x: { min: 5 },
 *   y: { max: 3 },
 *   z: { even: true }
 * }
 */
function buildConstraintsObject(constraints) {
  /** @type {Record<string, any>} */
  const out = {};
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const errors = [];

  for (const raw of constraints) {
    const parsed = parseConstraintString(raw);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    const bucket = ensureVarBucket(out, parsed.variable);

    if (parsed.kind === "even") {
      if (bucket.even === false) warnings.push(`Conflicting even constraint for ${parsed.variable}.`);
      bucket.even = true;
      continue;
    }

    if (parsed.kind === "eq") {
      if (bucket.eq != null && bucket.eq !== parsed.value) {
        warnings.push(`Conflicting equality constraints for ${parsed.variable}.`);
      }
      bucket.eq = parsed.value;
      continue;
    }

    if (parsed.kind === "min") {
      bucket.min = mergeNumericBound(bucket.min, parsed.value, "min");
    }

    if (parsed.kind === "max") {
      bucket.max = mergeNumericBound(bucket.max, parsed.value, "max");
    }

    if (bucket.min != null && bucket.max != null && bucket.min > bucket.max) {
      warnings.push(`Constraint range invalid for ${parsed.variable} (min > max).`);
    }

    if (bucket.eq != null) {
      if (bucket.min != null && bucket.eq < bucket.min) {
        warnings.push(`Equality for ${parsed.variable} is below min.`);
      }
      if (bucket.max != null && bucket.eq > bucket.max) {
        warnings.push(`Equality for ${parsed.variable} is above max.`);
      }
    }
  }

  return { constraints: out, warnings, errors };
}

function extractColumns(rows) {
  const keys = new Set();
  for (const row of rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      for (const k of Object.keys(row)) keys.add(k);
    }
  }
  return Array.from(keys);
}

function renderResultsTable(data) {
  const rows = data.slice(0, MAX_RESULTS);
  const columns = extractColumns(rows);

  resultsThead.innerHTML = "";
  resultsTbody.innerHTML = "";

  if (columns.length === 0) {
    clearResults();
    resultsEmpty.textContent = "No displayable object keys found in results.";
    return;
  }

  const trh = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col;
    trh.appendChild(th);
  }
  resultsThead.appendChild(trh);

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      const value = row?.[col];

      if (value == null) {
        td.textContent = "—";
      } else if (typeof value === "object") {
        td.textContent = JSON.stringify(value);
      } else {
        td.textContent = String(value);
      }

      tr.appendChild(td);
    }
    resultsTbody.appendChild(tr);
  }

  resultsEmpty.hidden = true;
  tableWrap.hidden = false;
  resultsMeta.textContent = `${rows.length}${data.length > MAX_RESULTS ? ` of ${data.length}` : ""} rows`;
}

async function solve() {
  const equation = normalizeWhitespace(equationInput.value);

  clearStatusItems();
  clearResults();

  if (!equation) {
    showStatusLine("Please enter an equation.", "muted");
    addStatusItem("error", "Equation is required.");
    equationInput.focus();
    return;
  }

  const built = buildConstraintsObject(constraintStrings);
  if (built.errors.length) {
    showStatusLine("Fix constraint errors and try again.", "muted");
    for (const msg of built.errors) addStatusItem("error", msg);
    return;
  }

  if (built.warnings.length) {
    for (const msg of built.warnings) addStatusItem("warn", msg);
  }

  const payload = {
    equation,
    constraints: built.constraints,
  };

  setLoading(true);
  showStatusLine("Solving...", "muted");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // If backend returns non-JSON, this will throw and be handled below.
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const message = typeof body === "string" ? body : (body?.error ?? "Request failed.");
      showStatusLine("Solve failed.", "muted");
      addStatusItem("error", message);
      return;
    }

    if (Array.isArray(body)) {
      showStatusLine("Solved.", "muted");
      renderResultsTable(body);
      return;
    }

    if (typeof body === "string") {
      showStatusLine("Solver message.", "muted");
      addStatusItem("warn", body);
      return;
    }

    showStatusLine("Unexpected response.", "muted");
    addStatusItem("warn", "Response was neither an array nor a string.");
  } catch (err) {
    showStatusLine("Network / CORS error.", "muted");
    const message =
      err instanceof Error
        ? err.message
        : "Failed to call solver API.";

    addStatusItem(
      "error",
      `Could not reach ${API_URL}. If you're opening index.html directly, your backend must allow CORS (Access-Control-Allow-Origin). Details: ${message}`
    );
  } finally {
    setLoading(false);
  }
}

addConstraintBtn.addEventListener("click", addConstraintFromInput);
constraintInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addConstraintFromInput();
  }
});

solveBtn.addEventListener("click", solve);
equationInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    solve();
  }
});

// Initial render
renderConstraints();
clearResults();
showStatusLine("Ready.", "muted");
