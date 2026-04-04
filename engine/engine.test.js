const assert = require("assert");
const { solveEquation } = require("./engine");

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

test("returns array of solutions for 2x+3y=12", () => {
  const out = solveEquation("2x+3y=12", null, { maxResults: 200 });
  assert.ok(Array.isArray(out));
  assert.deepStrictEqual(sortedKeys(out), ["x=0,y=4", "x=3,y=2", "x=6,y=0"]);
});

test("applies constraints (x even)", () => {
  const out = solveEquation("2x+3y=12", { x: { even: true } });
  assert.ok(Array.isArray(out));
  assert.deepStrictEqual(sortedKeys(out), ["x=0,y=4", "x=6,y=0"]);
});

test("detects infinite solutions for x=x", () => {
  const out = solveEquation("x=x");
  assert.strictEqual(typeof out, "string");
  assert.match(out, /Infinite solutions/i);
});

test("detects inconsistent equation x=x+1", () => {
  const out = solveEquation("x=x+1");
  assert.strictEqual(typeof out, "string");
  assert.match(out, /No solutions: the equation is inconsistent/i);
});

test("returns invalid equation for syntax errors", () => {
  const out = solveEquation("x @ 2 = 3");
  assert.strictEqual(typeof out, "string");
  assert.match(out, /Invalid equation/i);
});

test("reports division by zero", () => {
  const out = solveEquation("x/0=1");
  assert.strictEqual(typeof out, "string");
  assert.match(out, /Division by zero/i);
});

console.log("\nAll engine tests passed.");
