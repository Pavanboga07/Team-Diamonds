'use strict';
/**
 * components/layout.js
 * Renders the shared sidebar + topbar shell into the page.
 * Each page calls Layout.init({ page, breadcrumb }) on DOMContentLoaded.
 */

const Layout = (() => {
  const NAV = [
    { section: 'Tools' },
    { id: 'solver',    label: 'Equation Solver', icon: 'Σ',  href: '/pages/solver.html',    badge: null },
    { section: 'Market' },
    { id: 'market',    label: 'Live Market',      icon: '📈', href: '/pages/market.html',    badge: { text:'LIVE', cls:'live' } },
    { section: 'Portfolio' },
    { id: 'optimizer', label: 'Optimizer',        icon: '📊', href: '/pages/optimizer.html', badge: null },
    { id: 'watchlist', label: 'Watchlist',        icon: '👁', href: '/pages/watchlist.html', badge: null },
    { section: 'Analysis' },
    { id: 'history',   label: 'History',          icon: '📋', href: '/pages/history.html',   badge: null },
    { id: 'compare',   label: 'Compare',          icon: '⚖',  href: '/pages/compare.html',   badge: null },
    { section: 'Developer' },
    { id: 'api-docs',  label: 'API Docs',         icon: '🔌', href: '/pages/api-docs.html',  badge: null },
  ];

  function renderSidebar(activePage) {
    let html = `
      <div class="sidebar__brand">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#1B64F2"/>
          <path d="M7 22L12 15L16 18L22 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="22" cy="10" r="2.5" fill="#4ADE80"/>
        </svg>
        <div>
          <div class="sidebar__brand-name">QuantSolve</div>
          <div class="sidebar__brand-tag">PORTFOLIO ENGINE</div>
        </div>
      </div>
      <div class="sidebar__nav">`;

    for (const item of NAV) {
      if (item.section) {
        html += `<div class="nav-section-label">${item.section}</div>`;
        continue;
      }
      const active = item.id === activePage ? ' nav-item--active' : '';
      const badgeHtml = item.badge
        ? `<span style="margin-left:auto;font-size:9px;background:#DCFCE7;color:#16A34A;padding:1px 5px;border-radius:10px;font-weight:700">${item.badge.text}</span>`
        : '';
      html += `
        <a href="${item.href}" class="nav-item${active}" data-page="${item.id}">
          <span class="nav-item__icon">${item.icon}</span>
          <span class="nav-item__label">${item.label}</span>
          ${badgeHtml}
        </a>`;
    }

    html += `</div>`;
    return html;
  }

  function renderTopbar(breadcrumb, badge) {
    const badgeHtml = badge !== false ? `
      <span class="badge badge--live" id="liveBadge">
        <span class="badge__dot"></span>Live Data
      </span>
      <span class="badge badge--engine">Integer-Linear Solver</span>` : '';

    return `
      <div class="topbar__left">
        <a href="/pages/solver.html" class="topbar__brand" style="text-decoration:none;color:inherit">QuantSolve</a>
        <span class="topbar__sep">/</span>
        <span class="topbar__breadcrumb">${breadcrumb}</span>
      </div>
      <div class="topbar__right">${badgeHtml}</div>`;
  }

  function init({ page, breadcrumb, showBadge = true }) {
    const sidebar = document.getElementById('sidebar');
    const topbar  = document.getElementById('topbar');
    if (sidebar) sidebar.innerHTML = renderSidebar(page);
    if (topbar)  topbar.innerHTML  = renderTopbar(breadcrumb, showBadge);
  }

  return { init };
})();
