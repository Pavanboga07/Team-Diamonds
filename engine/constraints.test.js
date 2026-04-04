const assert = require("assert");
const { normalizeConstraints, domainFor, satisfiesAll } = require("./constraints");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("normalizes min to >= 0", () => {
  const c = normalizeConstraints({ x: { min: -5 } });
  assert.deepStrictEqual(c, { x: { min: 0 } });
});

test("eq overrides min/max", () => {
  const c = normalizeConstraints({ x: { min: 0, max: 10, eq: 7 } });
  assert.deepStrictEqual(c, { x: { min: 7, max: 7, eq: 7 } });
});

test("domainFor respects hardMax and even", () => {
  const c = normalizeConstraints({ x: { min: 1, even: true } });
  const d = domainFor("x", c, 7);
  assert.deepStrictEqual(d, { min: 2, max: 6, step: 2 });
});

test("satisfiesAll checks even/min/max/eq", () => {
  const c = normalizeConstraints({ x: { min: 2, max: 6, even: true }, y: { eq: 1 } });

  assert.strictEqual(satisfiesAll({ x: 4, y: 1 }, c), true);
  assert.strictEqual(satisfiesAll({ x: 5, y: 1 }, c), false);
  assert.strictEqual(satisfiesAll({ x: 8, y: 1 }, c), false);
  assert.strictEqual(satisfiesAll({ x: 4, y: 2 }, c), false);
});

console.log("\nAll constraints tests passed.");
