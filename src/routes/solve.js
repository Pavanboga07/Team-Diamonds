const express = require("express");

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateSolveBody(body) {
  const { equation, constraints } = body ?? {};

  if (typeof equation !== "string" || equation.trim().length === 0) {
    return { ok: false, status: 400, message: "Equation is required." };
  }
  if (equation.length > 5000) {
    return { ok: false, status: 400, message: "Equation is too long." };
  }

  if (constraints != null && !isPlainObject(constraints)) {
    return { ok: false, status: 400, message: "constraints must be an object." };
  }

  if (constraints && Object.keys(constraints).length > 50) {
    return { ok: false, status: 400, message: "Too many constrained variables." };
  }

  return { ok: true, equation, constraints: constraints ?? {} };
}

function createSolveRouter({ solveEquation }) {
  if (typeof solveEquation !== "function") {
    throw new Error("createSolveRouter requires solveEquation");
  }

  const router = express.Router();

  // Backward-compatible endpoint: array OR string message
  router.post("/solve", (req, res) => {
    const validation = validateSolveBody(req.body);
    if (!validation.ok) {
      return res.status(validation.status).send(validation.message);
    }

    const result = solveEquation(validation.equation, validation.constraints, {
      maxResults: 500,
    });

    if (Array.isArray(result)) {
      return res.status(200).json(result);
    }

    return res.status(200).send(result);
  });

  // v2 endpoint: consistent JSON envelope
  router.post("/solve/v2", (req, res) => {
    const requestId = req.requestId || res.getHeader("x-request-id") || null;
    const validation = validateSolveBody(req.body);

    if (!validation.ok) {
      return res.status(validation.status).json({
        ok: false,
        requestId,
        data: null,
        message: validation.message,
      });
    }

    const result = solveEquation(validation.equation, validation.constraints, {
      maxResults: 500,
    });

    if (Array.isArray(result)) {
      return res.status(200).json({
        ok: true,
        requestId,
        data: result,
        message: null,
        meta: { count: result.length },
      });
    }

    return res.status(200).json({
      ok: false,
      requestId,
      data: null,
      message: result,
    });
  });

  return router;
}

module.exports = { createSolveRouter };
