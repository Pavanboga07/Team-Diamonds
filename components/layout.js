'use strict';
/**
 * components/layout.js — shared sidebar + topbar for all pages
 * Each page calls Layout.init({ page, breadcrumb }) on load.
 */

const Layout = (() => {
  const NAV = [
    { section: 'Tools' },
    { id: 'solver',    label: 'Equation Solver',      icon: '∑',  href: '/pages/solver.html' },
    { section: 'Market' },
    { id: 'market',    label: 'Live Market',           icon: '📈', href: '/pages/market.html',    badge: 'LIVE' },
    { section: 'Portfolio' },
    { id: 'planner',   label: 'Budget Planner',        icon: '🎯', href: '/pages/planner.html' },
    { id: 'watchlist', label: 'Watchlist',             icon: '👁', href: '/pages/watchlist.html' },
    { section: 'Analysis' },
    { id: 'history',   label: 'History',               icon: '📋', href: '/pages/history.html' },
    { id: 'compare',   label: 'Compare',               icon: '⚖',  href: '/pages/compare.html' },
    { section: 'Developer' },
    { id: 'api-docs',  label: 'API Reference',         icon: '{}', href: '/pages/api-docs.html' },
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
          <div class="sidebar__brand-tag">FINTECH ENGINE</div>
        </div>
      </div>
      <div class="sidebar__nav">`;

    for (const item of NAV) {
      if (item.section) {
        html += `<div class="nav-section-label">${item.section}</div>`;
        continue;
      }
      const isActive = item.id === activePage;
      const activeClass = isActive ? ' active' : '';
      const badgeHtml = item.badge
        ? `<span class="nav-live-badge">${item.badge}</span>`
        : '';
      html += `
        <a href="${item.href}" class="nav-item${activeClass}" data-page="${item.id}" aria-current="${isActive ? 'page' : 'false'}">
          <span class="nav-item__icon">${item.icon}</span>
          <span class="nav-item__label">${item.label}</span>
          ${badgeHtml}
        </a>`;
    }

    html += `</div>
      <div class="sidebar__footer">
        <div class="usage-pill">v2.0 · Integer Solver</div>
      </div>`;
    return html;
  }

  function renderTopbar(breadcrumb, showBadge) {
    const badges = showBadge ? `
      <span class="badge badge--live" id="liveBadge"><span class="badge__dot"></span>Live Data</span>
      <span class="badge badge--engine">Integer-Linear Solver</span>` : '';
    return `
      <div class="topbar__left">
        <a href="/pages/solver.html" class="topbar__brand" style="text-decoration:none">QuantSolve</a>
        <span class="topbar__sep">/</span>
        <span class="topbar__breadcrumb">${breadcrumb}</span>
      </div>
      <div class="topbar__right">${badges}</div>`;
  }

  function init({ page, breadcrumb, showBadge = true }) {
    const sidebar = document.getElementById('sidebar');
    const topbar  = document.getElementById('topbar');
    if (sidebar) sidebar.innerHTML = renderSidebar(page);
    if (topbar)  topbar.innerHTML  = renderTopbar(breadcrumb, showBadge);
  }

  return { init };
})();
