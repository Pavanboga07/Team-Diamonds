'use strict';
/* lib/format.js — shared formatting utilities */

const Format = {
  usd(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  pct(n) {
    if (n == null) return '—';
    return Number(n).toFixed(1) + '%';
  },
  datetime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  },
  timeago(ts) {
    if (!ts) return '—';
    const diff  = Date.now() - ts;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  <  1)  return 'Just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 30)  return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },
  nanoid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  },
};
