const assert = require("assert");
const { tokenizeEquation } = require("./tokenizer");
const { parseEquation } = require("./parser");
const { normalizeEquation } = require("./normalizer");
const { solveNormalized } = require("./solver");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function solutionKey(sol) {
  return Object.keys(sol)
    .sort()
    .map((k) => `${k}=${sol[k]}`)
    .join(",");
}

function sortedKeys(solutions) {
  return solutions.map(solutionKey).sort();
}

function normalizeAndSolve(equationStr) {
  const tokens = tokenizeEquation(equationStr);
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);
  return solveNormalized(norm);
}

function normalizeAndSolveWithConstraints(equationStr, constraints) {
  const tokens = tokenizeEquation(equationStr);
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);
  return solveNormalized(norm, constraints);
}

test("solves 1-variable equation 5x=20", () => {
  const sols = normalizeAndSolve("5x=20");
  assert.deepStrictEqual(sortedKeys(sols), ["x=4"]);
});

test("returns empty for 1-variable no-solution 4x=3", () => {
  const sols = normalizeAndSolve("4x=3");
  assert.deepStrictEqual(sols, []);
});

test("solves 2-variable equation 2x+3y=12 (non-negative ints)", () => {
  const sols = normalizeAndSolve("2x+3y=12");
  assert.deepStrictEqual(sortedKeys(sols), ["x=0,y=4", "x=3,y=2", "x=6,y=0"]);
});

test("solves 3-variable equation 2x+3y+5z=10", () => {
  const sols = normalizeAndSolve("2x+3y+5z=10");
  assert.deepStrictEqual(sortedKeys(sols), [
    "x=0,y=0,z=2",
    "x=1,y=1,z=1",
    "x=2,y=2,z=0",
    "x=5,y=0,z=0",
  ]);
});

test("rejects negative coefficients for now (Step 6 handles edge cases)", () => {
  const tokens = tokenizeEquation("x-y=0");
  const parsed = parseEquation(tokens);
  const norm = normalizeEquation(parsed.equation);
  assert.throws(() => solveNormalized(norm), /positive coefficients only/);
});

test("applies min/max constraints during solving", () => {
  const sols = normalizeAndSolveWithConstraints("2x+3y=12", {
    x: { min: 3 },
    y: { max: 2 },
  });

  assert.deepStrictEqual(sortedKeys(sols), ["x=3,y=2", "x=6,y=0"]);
});

test("applies even constraint (x even)", () => {
  const sols = normalizeAndSolveWithConstraints("2x+3y=12", {
    x: { even: true },
  });

  assert.deepStrictEqual(sortedKeys(sols), ["x=0,y=4", "x=6,y=0"]);
});

test("eq constraint pins variable", () => {
  const sols = normalizeAndSolveWithConstraints("2x+3y=12", {
    x: { eq: 3 },
  });

  assert.deepStrictEqual(sortedKeys(sols), ["x=3,y=2"]);
});

console.log("\nAll solver tests passed.");
