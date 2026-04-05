'use strict';
/* src/middleware/authenticate.js — JWT auth middleware */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Authentication required. Please log in.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Session expired. Please log in again.' });
  }
}

module.exports = { authenticate };
