'use strict';
/* src/db/db.js — SQLite connection + schema bootstrap */

const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(__dirname, '../../quantsolve.db');
const db      = new Database(DB_PATH);

// Improve write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    name       TEXT    NOT NULL,
    password   TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol     TEXT    NOT NULL,
    added_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS history (
    id           TEXT    PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tickers      TEXT    NOT NULL,   -- JSON array
    budget       REAL    NOT NULL,
    max_leftover REAL    NOT NULL,
    equation     TEXT,
    source       TEXT,
    total        INTEGER,
    best_pct     REAL,
    portfolios   TEXT,               -- JSON array (top 10)
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

module.exports = db;
