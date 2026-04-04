/*
  QuantSolve API smoke test (no deps).
  Assumes the server is already running on http://localhost:3000
*/

const assert = require("assert");

const API_URL = process.env.API_URL || "http://localhost:3000/solve";
const BASE_URL = API_URL.replace(/\/solve$/, "");
const API_V2_URL = `${BASE_URL}/solve/v2`;

function key(sol) {
  return Object.keys(sol)
    .sort()
    .map((k) => `${k}=${sol[k]}`)
    .join(",");
}

function keysOf(arr) {
  return arr.map(key).sort();
}

async function post(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const requestId = res.headers.get("x-request-id");
  assert.ok(requestId && typeof requestId === "string");

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  return { status: res.status, data, requestId };
}

async function postV2(body) {
  const res = await fetch(API_V2_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const requestId = res.headers.get("x-request-id");
  assert.ok(requestId && typeof requestId === "string");

  const contentType = res.headers.get("content-type") || "";
  assert.match(contentType, /application\/json/i);
  const data = await res.json();

  assert.strictEqual(data.requestId, requestId);

  return { status: res.status, data, requestId };
}

async function getRoot() {
  const res = await fetch(`${BASE_URL}/`, { method: "GET" });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  console.log(`Running API smoke test against ${API_URL}`);

  {
    const { status, text } = await getRoot();
    assert.strictEqual(status, 200);
    assert.match(text, /QuantSolve/);
    console.log("✓ GET / serves frontend");
  }

  {
    const { status, data, requestId } = await post({ equation: "2x+3y=12", constraints: {} });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
    assert.deepStrictEqual(keysOf(data), ["x=0,y=4", "x=3,y=2", "x=6,y=0"]);
    assert.ok(requestId);
    console.log("✓ basic solve");
  }

  {
    const { status, data, requestId } = await postV2({ equation: "2x+3y=12", constraints: {} });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.data));
    assert.deepStrictEqual(keysOf(data.data), ["x=0,y=4", "x=3,y=2", "x=6,y=0"]);
    assert.strictEqual(data.message, null);
    assert.ok(requestId);
    console.log("✓ v2 basic solve envelope");
  }

  {
    const { status, data } = await post({
      equation: "2x+3y=12",
      constraints: { x: { even: true } },
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
    assert.deepStrictEqual(keysOf(data), ["x=0,y=4", "x=6,y=0"]);
    console.log("✓ constraints (even)");
  }

  {
    const { status, data } = await post({ equation: "x @ 2 = 3", constraints: {} });
    assert.strictEqual(status, 200);
    assert.strictEqual(typeof data, "string");
    assert.match(data, /Invalid equation/i);
    console.log("✓ invalid syntax returns message");
  }

  {
    const { status, data } = await postV2({ equation: "x @ 2 = 3", constraints: {} });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.ok, false);
    assert.strictEqual(data.data, null);
    assert.strictEqual(typeof data.message, "string");
    assert.match(data.message, /Invalid equation/i);
    console.log("✓ v2 invalid syntax envelope");
  }

  {
    const { status, data } = await post({ constraints: {} });
    assert.strictEqual(status, 400);
    assert.strictEqual(typeof data, "string");
    assert.match(data, /Equation is required/i);
    console.log("✓ missing equation returns 400");
  }

  {
    const { status, data } = await postV2({ constraints: {} });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.ok, false);
    assert.strictEqual(data.data, null);
    assert.strictEqual(typeof data.message, "string");
    assert.match(data.message, /Equation is required/i);
    console.log("✓ v2 missing equation returns 400 envelope");
  }

  {
    const { status, data } = await post({ equation: "x=x", constraints: {} });
    assert.strictEqual(status, 200);
    assert.strictEqual(typeof data, "string");
    assert.match(data, /Infinite solutions/i);
    console.log("✓ infinite solutions message");
  }

  console.log("\nAll API smoke tests passed.");
}

main().catch((err) => {
  console.error("API smoke test failed:");
  console.error(err);
  process.exitCode = 1;
});
