'use strict';
/**
 * System Solver — Gaussian Elimination
 *
 * Solves a system of linear equations using Gaussian elimination with
 * partial pivoting. Returns:
 *  - A unique solution: { x: 1, y: 2, ... }
 *  - "Infinite solutions exist" if the system is underdetermined
 *  - "No valid solution exists" if the system is inconsistent
 *
 * Input: array of normalised equations
 *   Each: { coefficients: { x: 10, y: 20 }, constant: 100 }
 */

const { formatNum, round } = require('./polynomial');

/**
 * Gaussian elimination with partial pivoting.
 * @param {number[][]} A  augmented matrix [rows × (cols+1)], last col is RHS
 * @returns {{ type: 'unique'|'infinite'|'none', solution?: number[] }}
 */
function gaussianElimination(A) {
  const rows = A.length;
  const cols = A[0].length - 1; // number of unknowns

  // Deep clone
  const M = A.map(row => [...row]);

  let pivotRow = 0;
  const pivotCols = [];

  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // Find pivot (max abs value)
    let maxVal = Math.abs(M[pivotRow][col]);
    let maxIdx = pivotRow;
    for (let r = pivotRow + 1; r < rows; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) { maxVal = v; maxIdx = r; }
    }

    if (maxVal < 1e-12) continue; // no pivot in this column → free variable

    // Swap rows
    [M[pivotRow], M[maxIdx]] = [M[maxIdx], M[pivotRow]];
    pivotCols.push(col);

    // Scale pivot row
    const scale = M[pivotRow][col];
    for (let c = col; c <= cols; c++) M[pivotRow][c] /= scale;

    // Eliminate column
    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let c = col; c <= cols; c++) {
        M[r][c] -= factor * M[pivotRow][c];
      }
    }

    pivotRow++;
  }

  // Check consistency: any row of the form [0 0 ... 0 | non-zero] ?
  for (let r = pivotRow; r < rows; r++) {
    if (Math.abs(M[r][cols]) > 1e-9) {
      return { type: 'none' };
    }
  }

  // Under-determined?
  if (pivotCols.length < cols) {
    return { type: 'infinite' };
  }

  // Extract solution from pivot rows
  const solution = new Array(cols).fill(0);
  for (let i = 0; i < pivotCols.length; i++) {
    solution[pivotCols[i]] = M[i][cols];
  }

  return { type: 'unique', solution };
}

/**
 * Solve a system of linear equations.
 *
 * @param {Array<{ coefficients: Record<string,number>, constant: number }>} normalizedEqs
 * @param {{ integerOnly?: boolean, nonNegativeOnly?: boolean }} opts
 * @returns {{ ok: boolean, type: string, solutions?: Array<Record<string,number>>, message?: string }}
 */
function solveSystem(normalizedEqs, opts = {}) {
  if (!normalizedEqs || normalizedEqs.length === 0) {
    return { ok: false, message: 'No equations provided.' };
  }

  // Collect all variable names (consistent ordering)
  const varSet = new Set();
  for (const eq of normalizedEqs) {
    for (const v of Object.keys(eq.coefficients)) varSet.add(v);
  }
  const vars = [...varSet].sort();

  if (vars.length === 0) {
    // All trivial equations
    const allTrue = normalizedEqs.every(eq => Math.abs(eq.constant) < 1e-9);
    return allTrue
      ? { ok: true, type: 'infinite', message: 'Infinite solutions exist' }
      : { ok: true, type: 'none', message: 'No valid solution exists' };
  }

  // Build augmented matrix
  const matrix = normalizedEqs.map(eq => {
    const row = vars.map(v => eq.coefficients[v] ?? 0);
    row.push(eq.constant);
    return row;
  });

  const result = gaussianElimination(matrix);

  if (result.type === 'none') {
    return { ok: true, type: 'none', message: 'No valid solution exists' };
  }

  if (result.type === 'infinite') {
    return { ok: true, type: 'infinite', message: 'Infinite solutions exist' };
  }

  // Unique solution — build named result
  const sol = {};
  for (let i = 0; i < vars.length; i++) {
    sol[vars[i]] = round(result.solution[i], 8);
  }

  // Apply filters for financial / integer mode
  if (opts.nonNegativeOnly) {
    const hasNeg = Object.values(sol).some(v => v < -1e-9);
    if (hasNeg) {
      return { ok: true, type: 'none', message: 'No non-negative solution exists' };
    }
  }
  if (opts.integerOnly) {
    const hasNonInt = Object.values(sol).some(v => Math.abs(v - Math.round(v)) > 1e-6);
    if (hasNonInt) {
      return { ok: true, type: 'none', message: 'No non-negative integer solution exists' };
    }
    for (const v of Object.keys(sol)) sol[v] = Math.round(sol[v]);
  }

  return { ok: true, type: 'unique', solutions: [sol] };
}

module.exports = { solveSystem, gaussianElimination };
