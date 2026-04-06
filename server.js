'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { requestLogging }          = require('./src/middleware/requestLogging');
const { createSolveRouter }       = require('./src/routes/solve');
const { createMarketRouter }      = require('./src/routes/market');
const { createIndiaMarketRouter } = require('./src/routes/india-market');
const { createRiskRouter }        = require('./src/routes/risk');
const { createHistoryRouter }     = require('./src/routes/history');
const { solveEquation, solveSystem } = require('./engine');   // WASM shim (falls back to JS)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function createApp() {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  }));

  app.use(requestLogging());
  app.use(express.json({ limit: '256kb' }));

  // Root → Equation Solver (new multi-page entry point)
  app.get('/', (req, res) => res.redirect('/pages/solver.html'));

  // Serve all static files (pages/, components/, lib/, app.css, style.css, etc.)
  app.use(express.static(path.join(__dirname), { index: false }));

  // API routes
  app.use(createIndiaMarketRouter());
  app.use(createRiskRouter());
  app.use(createHistoryRouter());
  app.use(createSolveRouter({ solveEquation, solveSystem }));
  app.use(createMarketRouter());

  // Error handler
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const message   = err instanceof Error ? err.message : 'Unknown error';
    const requestId = req.requestId || res.getHeader('x-request-id') || null;
    if (req.path === '/solve/v2') {
      return res.status(400).json({ ok: false, requestId, data: null, message: `Bad Request: ${message}` });
    }
    return res.status(400).send(`Bad Request: ${message}`);
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`QuantSolve backend listening on http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
