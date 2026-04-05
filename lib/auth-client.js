'use strict';
/* lib/auth-client.js — frontend authentication helper */

const AuthClient = (() => {
  const TOKEN_KEY = 'qs_auth_token';
  const USER_KEY  = 'qs_auth_user';

  function getToken()   { return localStorage.getItem(TOKEN_KEY); }
  function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
  function isLoggedIn() { return !!getToken(); }

  function save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/auth.html';
  }

  // fetch wrapper that automatically adds Authorization header
  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res  = await fetch(url, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    // if 401 anywhere, redirect to login
    if (res.status === 401) { logout(); return body; }
    return body;
  }

  // Call on every protected page load — redirects if not authenticated
  async function requireAuth() {
    if (!isLoggedIn()) { window.location.href = '/auth.html'; return null; }
    try {
      const resp = await apiFetch('/auth/me');
      if (!resp.ok) { logout(); return null; }
      save(getToken(), resp.user);
      return resp.user;
    } catch {
      logout();
      return null;
    }
  }

  return { getToken, getUser, isLoggedIn, save, logout, apiFetch, requireAuth };
})();
