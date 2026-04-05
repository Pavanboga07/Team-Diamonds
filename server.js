const express = require("express");
const cors = require("cors");
const path = require("path");

const { requestLogging }         = require('./src/middleware/requestLogging');
const { createSolveRouter }      = require('./src/routes/solve');
const { createMarketRouter }     = require('./src/routes/market');
const { createAuthRouter }       = require('./src/routes/auth');
const { createUserDataRouter }   = require('./src/routes/user-data');
const { createIndiaMarketRouter }= require('./src/routes/india-market');

const { solveEquation } = require('./engine/engine');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function createApp() {
  const app = express();

  // Allow requests from file:// (opening index.html directly) and localhost.
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
    })
  );

  // Request logging (minimal, structured)
  app.use(requestLogging());

  app.use(express.json({ limit: "256kb" }));

  // Redirect root → landing page
  app.get("/", (req, res) => res.redirect("/landing.html"));

  // Serve all static frontend files (landing.html, app.html, app.css, lib/, pages/, etc.)
  app.use(express.static(path.join(__dirname), {
    index: false, // don't auto-serve index.html; we handle root above
  }));

  app.use(createAuthRouter());
  app.use(createUserDataRouter());
  app.use(createIndiaMarketRouter());
  app.use(createSolveRouter({ solveEquation }));
  app.use(createMarketRouter());

  // Minimal error handler (e.g., malformed JSON)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    const requestId = req.requestId || res.getHeader("x-request-id") || null;

    if (req.path === "/solve/v2") {
      return res.status(400).json({
        ok: false,
        requestId,
        data: null,
        message: `Bad Request: ${message}`,
      });
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
