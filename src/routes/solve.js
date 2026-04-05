const express = require("express");

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateSolveBody(body) {
  const { equation, equations, constraints, mode } = body ?? {};

  // Accept either a single equation string or an array of equations
  const isSystem = Array.isArray(equations);
  const isSingle = typeof equation === "string" && equation.trim().length > 0;

  if (!isSingle && !isSystem) {
    return { ok: false, status: 400, message: "equation (string) or equations (array) is required." };
  }

  if (isSingle && equation.length > 5000) {
    return { ok: false, status: 400, message: "Equation is too long." };
  }

  if (isSystem) {
    if (equations.length === 0)   return { ok: false, status: 400, message: "equations array must not be empty." };
    if (equations.length > 50)    return { ok: false, status: 400, message: "Too many equations (max 50)." };
    for (const eq of equations) {
      if (typeof eq !== "string" || !eq.trim()) {
        return { ok: false, status: 400, message: "All equations must be non-empty strings." };
      }
    }
  }

  if (constraints != null && !isPlainObject(constraints)) {
    return { ok: false, status: 400, message: "constraints must be an object." };
  }
  if (constraints && Object.keys(constraints).length > 50) {
    return { ok: false, status: 400, message: "Too many constrained variables." };
  }

  const validModes = [undefined, null, 'financial', 'general', 'complex'];
  if (mode != null && !validModes.includes(mode)) {
    return { ok: false, status: 400, message: `Invalid mode '${mode}'. Use 'financial', 'complex', or 'general'.` };
  }

  return {
    ok: true,
    equation: isSingle ? equation : null,
    equations: isSystem ? equations : null,
    constraints: constraints ?? {},
    mode: mode ?? "general",
    isSystem,
  };
}

function createSolveRouter({ solveEquation, solveSystem }) {
  if (typeof solveEquation !== "function") {
    throw new Error("createSolveRouter requires solveEquation");
  }

  const router = express.Router();

  function runSolver(validation, maxResults) {
    const opts = {
      maxResults,
      mode: validation.mode,
    };

    if (validation.isSystem) {
      return solveSystem
        ? solveSystem(validation.equations, validation.constraints, opts)
        : "System solving is not available.";
    }
    return solveEquation(validation.equation, validation.constraints, opts);
  }

  // Backward-compatible endpoint: array OR string message
  router.post("/solve", (req, res) => {
    const validation = validateSolveBody(req.body);
    if (!validation.ok) {
      return res.status(validation.status).send(validation.message);
    }

    const result = runSolver(validation, 500);

    if (Array.isArray(result)) return res.status(200).json(result);
    return res.status(200).send(result);
  });

  // v2 endpoint: consistent JSON envelope
  router.post("/solve/v2", (req, res) => {
    const requestId = req.requestId || res.getHeader("x-request-id") || null;
    const validation = validateSolveBody(req.body);

    if (!validation.ok) {
      return res.status(validation.status).json({
        ok: false, requestId, data: null, message: validation.message,
      });
    }

    const result = runSolver(validation, 500);

    if (Array.isArray(result)) {
      return res.status(200).json({
        ok: true,
        requestId,
        data: result,
        message: null,
        meta: {
          count: result.length,
          isSystem: validation.isSystem,
          mode: validation.mode,
        },
      });
    }

    return res.status(200).json({
      ok: false, requestId, data: null, message: result,
    });
  });

  return router;
}

module.exports = { createSolveRouter };
