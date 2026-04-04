# QuantSolve — API Testing (Step 9)

Endpoint:
- `POST http://localhost:3000/solve`
- `POST http://localhost:3000/solve/v2`

Request body:
```json
{
  "equation": "2x+3y=12",
  "constraints": {
    "x": { "min": 0, "max": 10, "even": true }
  }
}
```

Response shape:
- **Success (solutions found):** JSON array of solution objects
- **Other cases (no solutions / invalid equation / warnings):** plain text string

`/solve/v2` response shape (always JSON):
- `ok: true` + `data: [...]` when solutions are found
- `ok: false` + `message: "..."` when no solutions / invalid equation / warnings
- Includes `requestId` for correlation

Notes:
- Solution ordering is not guaranteed.
- Current engine phase supports **linear equations** and (for now) **positive coefficients** after normalization.

---

## Start the server

```bash
npm start
```

---

## PowerShell examples

### 1) Basic solve

```powershell
$body = @{ equation = '2x+3y=12'; constraints = @{} } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve' -ContentType 'application/json' -Body $body
```

Expected: JSON array with these solutions (order may vary):
- `{ x: 0, y: 4 }`
- `{ x: 3, y: 2 }`
- `{ x: 6, y: 0 }`

### 1b) Basic solve (v2 envelope)

```powershell
$body = @{ equation = '2x+3y=12'; constraints = @{} } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve/v2' -ContentType 'application/json' -Body $body
```

Expected: JSON object like:
- `ok: true`
- `data: [ {x:0,y:4}, {x:3,y:2}, {x:6,y:0} ]` (order may vary)

### 2) With constraints (x even)

```powershell
$body = @{ equation = '2x+3y=12'; constraints = @{ x = @{ even = $true } } } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve' -ContentType 'application/json' -Body $body
```

Expected: JSON array containing:
- `{ x: 0, y: 4 }`
- `{ x: 6, y: 0 }`

### 3) Invalid syntax

```powershell
$body = @{ equation = 'x @ 2 = 3'; constraints = @{} } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve' -ContentType 'application/json' -Body $body
```

Expected: plain text string starting with `Invalid equation:`

### 4) Inconsistent / infinite

```powershell
$body = @{ equation = 'x=x+1'; constraints = @{} } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve' -ContentType 'application/json' -Body $body

$body = @{ equation = 'x=x'; constraints = @{} } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/solve' -ContentType 'application/json' -Body $body
```

Expected:
- `x=x+1` → `No solutions: the equation is inconsistent.`
- `x=x` → `Infinite solutions: the equation is always true.`

---

## curl examples

### 1) Basic solve

```bash
curl -s -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -d '{"equation":"2x+3y=12","constraints":{}}'
```

### 2) With constraints

```bash
curl -s -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -d '{"equation":"2x+3y=12","constraints":{"x":{"even":true}}}'
```

---

## Optional: automated smoke test

Run (in another terminal while the server is running):

```bash
node scripts/api-smoke.js
```
