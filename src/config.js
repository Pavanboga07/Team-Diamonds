'use strict';
/* src/config.js — shared constants */

const JWT_SECRET  = process.env.JWT_SECRET  || 'quantsolve-dev-secret-do-not-use-in-prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';

module.exports = { JWT_SECRET, JWT_EXPIRES };
