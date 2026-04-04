/**
 * STEP 5 — Constraint Engine
 *
 * Constraints object format (from frontend):
 * {
 *   x: { min?: number, max?: number, even?: boolean, eq?: number }
 * }
 *
 * This module validates/normalizes constraints and provides helpers for pruning.
 */

/** @typedef {{ min?: number, max?: number, even?: boolean, eq?: number }} VarConstraint */
/** @typedef {Record<string, VarConstraint>} Constraints */

function assertInt(n, label) {
  if (!Number.isSafeInteger(n)) throw new Error(`${label} must be a safe integer.`);
}

function normalizeVarConstraint(variable, c) {
  /** @type {VarConstraint} */
  const out = {};

  if (c == null) return out;
  if (typeof c !== "object") throw new Error(`Constraint for ${variable} must be an object.`);

  if (c.min != null) {
    assertInt(c.min, `${variable}.min`);
    out.min = c.min;
  }
  if (c.max != null) {
    assertInt(c.max, `${variable}.max`);
    out.max = c.max;
  }
  if (c.eq != null) {
    assertInt(c.eq, `${variable}.eq`);
    out.eq = c.eq;
  }
  if (c.even != null) {
    out.even = Boolean(c.even);
  }

  // Global rule: non-negative values only.
  if (out.min == null || out.min < 0) out.min = 0;
  if (out.max != null && out.max < 0) {
    // If max < 0 but values must be >= 0, domain becomes empty.
    out.max = -1;
  }
  if (out.eq != null && out.eq < 0) {
    out.eq = -1;
  }

  // If eq is present, it overrides min/max.
  if (out.eq != null) {
    out.min = out.eq;
    out.max = out.eq;
  }

  if (out.min != null && out.max != null && out.min > out.max) {
    throw new Error(`Invalid constraint range for ${variable}: min > max.`);
  }

  if (out.even && out.min != null && out.max != null && out.max >= 0) {
    // Domain can still be empty but we'll let domain calculation handle it.
  }

  return out;
}

/**
 * Normalize full constraints map.
 * @param {Constraints | undefined | null} constraints
 * @returns {Constraints}
 */
function normalizeConstraints(constraints) {
  if (constraints == null) return {};
  if (typeof constraints !== "object") throw new Error("constraints must be an object.");

  /** @type {Constraints} */
  const out = {};
  for (const [variable, c] of Object.entries(constraints)) {
    out[variable] = normalizeVarConstraint(variable, c);
  }
  return out;
}

/**
 * Compute allowed integer domain for a variable, optionally capped by a maximum.
 * @param {string} variable
 * @param {Constraints} constraints
 * @param {number} hardMax A cap computed from remaining/a (>= 0)
 */
function domainFor(variable, constraints, hardMax) {
  const c = constraints[variable] ?? {};

  const min = c.min ?? 0;
  const max = c.max != null ? Math.min(c.max, hardMax) : hardMax;

  if (max < min) return { min: 1, max: 0, step: 1 }; // empty

  const even = Boolean(c.even);
  if (!even) return { min, max, step: 1 };

  // Adjust to even min.
  let adjMin = min;
  if (adjMin % 2 !== 0) adjMin += 1;

  // Adjust max downward to even max.
  let adjMax = max;
  if (adjMax % 2 !== 0) adjMax -= 1;

  if (adjMax < adjMin) return { min: 1, max: 0, step: 2 }; // empty
  return { min: adjMin, max: adjMax, step: 2 };
}

/**
 * Check whether a fully-assigned solution satisfies constraints.
 * @param {Record<string, number>} solution
 * @param {Constraints} constraints
 */
function satisfiesAll(solution, constraints) {
  for (const [variable, c] of Object.entries(constraints)) {
    if (!c) continue;
    const value = solution[variable];
    if (value == null) continue; // variables not in equation may be ignored

    if (c.min != null && value < c.min) return false;
    if (c.max != null && value > c.max) return false;
    if (c.eq != null && value !== c.eq) return false;
    if (c.even && value % 2 !== 0) return false;
  }
  return true;
}

module.exports = {
  normalizeConstraints,
  domainFor,
  satisfiesAll,
};
