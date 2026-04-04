# QuantSolve

Constraint-based equation solver (whole-number, non-negative solutions) with a vanilla JS dashboard and a Node.js + Express API.

## Run

### 1) Backend

```bash
npm install
npm start
```

Server: `http://localhost:3000`

Open the dashboard at: `http://localhost:3000`

### 2) Frontend

Open `index.html` in your browser.

- The frontend calls `http://localhost:3000/solve` when opened via `file://`.
- If you later serve the frontend via `http(s)`, it will call the same-origin `/solve` automatically.

Tip: You can skip `file://` entirely by using `http://localhost:3000` (served by Express).

## API

- `POST /solve` returns either a JSON array (solutions) or a plain text message (no solutions / invalid / warnings).
- `POST /solve/v2` always returns a JSON envelope `{ ok, data, message, requestId }`.

## Quick tests

Engine/unit tests:
```bash
npm run test:engine
```

API smoke test (server must be running):
```bash
npm run smoke:api
```
