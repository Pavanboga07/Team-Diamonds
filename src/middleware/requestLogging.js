const { randomUUID } = require("crypto");

function getRequestId(req) {
  const existing = req.header("x-request-id");
  if (existing && typeof existing === "string") return existing.slice(0, 128);
  return randomUUID();
}

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function requestLogging() {
  return (req, res, next) => {
    const requestId = getRequestId(req);
    const start = nowMs();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      const durationMs = nowMs() - start;
      const log = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(log));
    });

    next();
  };
}

module.exports = { requestLogging };
