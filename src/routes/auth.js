'use strict';
/* src/routes/auth.js — register / login / me */

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/db');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function createAuthRouter() {
  const router = express.Router();

  /* POST /auth/register */
  router.post('/auth/register', (req, res) => {
    const { email, name, password } = req.body ?? {};
    if (!email || !name || !password)
      return res.status(400).json({ ok: false, message: 'Email, name, and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters.' });

    try {
      const hash   = bcrypt.hashSync(password, 10);
      const result = db
        .prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)')
        .run(email.trim().toLowerCase(), name.trim(), hash);

      const user  = { id: result.lastInsertRowid, email: email.trim().toLowerCase(), name: name.trim() };
      const token = makeToken(user);
      return res.status(201).json({ ok: true, token, user });
    } catch (err) {
      if (err.message.includes('UNIQUE'))
        return res.status(409).json({ ok: false, message: 'An account with this email already exists.' });
      console.error('register error:', err);
      return res.status(500).json({ ok: false, message: 'Registration failed. Please try again.' });
    }
  });

  /* POST /auth/login */
  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password)
      return res.status(400).json({ ok: false, message: 'Email and password are required.' });

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.trim().toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });

    const payload = { id: user.id, email: user.email, name: user.name };
    return res.json({ ok: true, token: makeToken(payload), user: payload });
  });

  /* GET /auth/me — verify token, return current user */
  router.get('/auth/me', (req, res) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer '))
      return res.status(401).json({ ok: false, message: 'Not authenticated.' });
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      return res.json({ ok: true, user: { id: payload.id, email: payload.email, name: payload.name } });
    } catch {
      return res.status(401).json({ ok: false, message: 'Token expired or invalid.' });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
