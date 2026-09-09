/**
 * KRX ETF Portfolio Management App - Client Engine
 */

// Global Application State
const state = {
  dashboard: null,
  groups: [],
  activeGroupId: null, // null means "전체"
  currentSort: localStorage.getItem('etf_sort_preference') || 'custom',
  selectedHolding: null,
  selectedETF: null,
  editingGroup: null,
  isSyncing: false,
  deletePendingGroupId: null,
};

// Utilities & Formatters
function formatNumber(val) {
  if (val === null || val === undefined) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('ko-KR');
}

function formatWon(val) {
  return `₩ ${formatNumber(val)}`;
}

function formatPercent(val) {
  if (val === null || val === undefined) return '0.00%';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00%';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function getPnlColor(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num > 0) return '#D0374C'; // Toned-down Soft Red
  if (num < 0) return '#60A5FA'; // Bright Vivid Blue for Loss
  return '#94A3B8'; // Neutral Gray
}

function getPnlClass(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num > 0) return 'text-krx-red';
  if (num < 0) return 'text-krx-blue';
  return 'text-slate-400';
}

function showToast(message, type = 'info', customClass = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  let bgClass = 'bg-slate-800 border-slate-700 text-white';
  let icon = 'info';
  
  if (type === 'success') {
    bgClass = 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200';
    icon = 'check-circle';
  } else if (type === 'error') {
    bgClass = 'bg-red-950/90 border-red-700/80 text-red-200';
    icon = 'alert-circle';
  } else if (type === 'warning') {
    bgClass = 'bg-amber-950/90 border-amber-700/80 text-amber-200';
    icon = 'alert-triangle';
  }
  
  const widthClass = customClass || 'w-fit min-w-[224px] max-w-[320px]';
  toast.className = `py-2 px-3.5 rounded-xl border shadow-xl flex items-center justify-center gap-2 text-xs font-semibold backdrop-blur-md animate-slide-up pointer-events-auto transition-all ${widthClass} ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="truncate text-center">${message}</span>
  `;
  
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Default user ID with user's registered portfolio (5 groups, 64 holdings)
const DEFAULT_PRIMARY_USER_ID = 'hikarusky';

// API Base URL & Client Device Identity Management
function getUserId() {
  const STORAGE_KEY = 'etf_portfolio_user_id';
  let uid = localStorage.getItem(STORAGE_KEY);
  if (!uid || uid === 'undefined' || uid === 'null' || uid === '88ba0ed8-3940-4f81-b21b-31b1984d0f12') {
    uid = DEFAULT_PRIMARY_USER_ID;
    localStorage.setItem(STORAGE_KEY, uid);
  }
  return uid;
}

function setUserId(newId) {
  const STORAGE_KEY = 'etf_portfolio_user_id';
  if (!newId) return;
  localStorage.setItem(STORAGE_KEY, newId.trim());
  updateUserHeaderDisplay();
}

function updateUserHeaderDisplay() {
  const uid = getUserId();
  const badge = document.getElementById('header-user-short-id');
  if (badge) {
    if (uid === DEFAULT_PRIMARY_USER_ID) {
      badge.textContent = '내 계정';
      badge.className = 'font-mono text-[11px] text-emerald-400 font-semibold';
    } else {
      badge.textContent = uid.substring(0, 6) + '..';
      badge.className = 'font-mono text-[11px] text-blue-400 font-medium';
    }
  }
  const barInput = document.getElementById('bar-user-id-input');
  if (barInput && !barInput.matches(':focus')) {
    barInput.value = uid;
  }
}

let activeApiBase = window.API_BASE_URL || localStorage.getItem('ETF_API_BASE') || '';

function getInitialApiBase() {
  if (activeApiBase) return activeApiBase;
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
    return '';
  }
  return 'http://localhost:8010';
}

activeApiBase = getInitialApiBase();

async function detectWorkingApiBase() {
  const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
  const candidates = [
    '',
    currentOrigin,
    activeApiBase,
    'http://localhost:8010',
    'http://127.0.0.1:8010',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8001',
    'http://127.0.0.1:8001'
  ];
  const uniqueCandidates = [...new Set(candidates.filter((c) => c !== undefined && c !== null))];

  for (const base of uniqueCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${base}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        // Verify it is indeed our ETF Portfolio API service
        if (data.database === 'etf_portfolio' || data.app?.includes('ETF')) {
          activeApiBase = base;
          localStorage.setItem('ETF_API_BASE', base);
          console.log(`[ETF API] Successfully connected to backend at: ${base || 'relative path'}`);
          return base;
        }
      }
    } catch (e) {
      // Continue probe next candidate
    }
  }
  return null;
}

async function apiFetch(endpoint, options = {}) {
  const userId = getUserId();
  const headers = {
    'Accept': 'application/json',
    'X-User-Id': userId,
    ...(options.headers || {})
  };

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const doFetch = (base) => fetch(`${base}${endpoint}`, { ...options, headers, body });

  let res;
  try {
    res = await doFetch(activeApiBase);
  } catch (err) {
    // Network error or connection refused - attempt automatic fallback detection
    const detected = await detectWorkingApiBase();
    if (detected !== null && detected !== activeApiBase) {
      res = await doFetch(detected);
    } else {
      throw new Error(`백엔드 서버에 연결할 수 없습니다. FastAPI 서버('uv run uvicorn src.main:app') 실행 상태를 확인해주세요.`);
    }
  }

  // Handle port conflict or 404 (specifically when dashboard endpoint fails to find data)
  if (res.status === 404 && endpoint.includes('/dashboard')) {
    const detected = await detectWorkingApiBase();
    if (detected !== null && detected !== activeApiBase) {
      res = await doFetch(detected);
    }
  }

  if (!res.ok) {
    let errorDetail = `서버 오류가 발생했습니다 (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}
    throw new Error(errorDetail);
  }

  // Handle 204 No Content or empty responses
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }

  return null;
}

function showDashboardErrorBanner(errorMessage) {
  let errorBanner = document.getElementById('dashboard-error-banner');
  const main = document.querySelector('main');
  if (!main) return;

  if (!errorBanner) {
    errorBanner = document.createElement('div');
    errorBanner.id = 'dashboard-error-banner';
    main.insertBefore(errorBanner, main.firstChild);
  }

  errorBanner.className = 'p-4 rounded-2xl bg-red-950/80 border border-red-800/80 text-white space-y-3 animate-fade-in shadow-xl';
  errorBanner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="p-2 rounded-xl bg-red-900/60 text-red-300 flex-shrink-0 mt-0.5">
        <i data-lucide="alert-circle" class="w-5 h-5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-bold text-red-100">대시보드 데이터를 불러오지 못했습니다</h3>
        <p class="text-xs text-red-300 mt-1 leading-relaxed break-words">${errorMessage}</p>
        <p class="text-[11px] text-slate-400 mt-1.5 leading-normal">
          • 다른 프로세스가 8000번 포트를 사용 중이거나 백엔드가 꺼져있을 수 있습니다.<br>
          • 터미널에서 <code class="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">uv run uvicorn src.main:app --port 8000</code> 실행 여부를 확인하세요.
        </p>
      </div>
    </div>
    <div class="flex gap-2 pt-1 border-t border-red-900/50">
      <button id="btn-retry-dashboard" class="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5">
        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
        <span>서버 재연결 및 다시 시도</span>
      </button>
    </div>
  `;

  document.getElementById('btn-retry-dashboard').onclick = () => {
    loadDashboard(true);
  };

  if (window.lucide) lucide.createIcons();
}

function removeDashboardErrorBanner() {
  const banner = document.getElementById('dashboard-error-banner');
  if (banner) banner.remove();
}

// Data Fetching & Sync
async function loadDashboard(isRetry = false) {
  const baseDateEl = document.getElementById('header-base-date');
  if (baseDateEl && !state.dashboard) {
    baseDateEl.textContent = '기준: 연결중...';
  }

  try {
    const data = await apiFetch('/api/v1/dashboard');
    removeDashboardErrorBanner();
    state.dashboard = data;
    state.groups = data.groups || [];
    renderApp();
    if (isRetry) {
      showToast('대시보드 데이터를 성공적으로 불러왔습니다.', 'success');
    }
  } catch (err) {
    console.error('loadDashboard failed:', err);
    showToast(err.message, 'error');
    showDashboardErrorBanner(err.message);
    if (baseDateEl) baseDateEl.textContent = '기준: 연결 오류';
  }
}

function startSyncAnimation() {
  state.isSyncing = true;
  const syncBtn = document.getElementById('btn-sync-market');
  const syncWrapper = document.getElementById('sync-icon-wrapper');

  if (syncBtn) syncBtn.disabled = true;
  if (syncWrapper) {
    syncWrapper.classList.add('animate-spin');
  }
}

function stopSyncAnimation() {
  state.isSyncing = false;
  const syncBtn = document.getElementById('btn-sync-market');
  const syncWrapper = document.getElementById('sync-icon-wrapper');

  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.classList.remove('animate-spin');
  }

  if (syncWrapper) {
    // 1. animate-spin 클래스 및 인라인 애니메이션 제거
    syncWrapper.classList.remove('animate-spin');
    syncWrapper.style.animation = 'none';

    // 2. 내부 요소의 모든 animate-spin 클래스 안전하게 제거
    syncWrapper.querySelectorAll('*').forEach((el) => {
      if (el && el.classList && typeof el.classList.remove === 'function') {
        el.classList.remove('animate-spin');
      }
    });

    // 3. 아이콘 마크업을 초기 태그로 리셋하고 Lucide로 깨끗하게 재렌더링하여 회전 상태 완전 초기화
    syncWrapper.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5"></i>';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

async function syncMarketPrices() {
  if (state.isSyncing) return;
  startSyncAnimation();
  showToast('KRX 종가 시세 갱신 중...', 'info', 'w-[224px]');

  try {
    const result = await apiFetch('/api/v1/sync/prices', { method: 'POST' });
    
    if (result && result.status === 'success') {
      showToast(`시세 동기화 완료 (${result.count || 0}건)`, 'success', 'w-[224px]');
    } else {
      showToast(result?.message || '시세 동기화 결과가 없습니다.', 'warning');
    }
  } catch (err) {
    console.error('syncMarketPrices failed:', err);
    showToast(err.message || '시세 동기화 중 오류가 발생했습니다.', 'error');
  } finally {
    // 시세 동기화가 완료되면 즉시 회전 애니메이션 완전 정지
    stopSyncAnimation();
  }

  // 동기화 완료 및 화살표 정지 후 대시보드 데이터 최신화
  try {
    await loadDashboard();
  } catch (err) {
    console.error('loadDashboard after sync failed:', err);
  }
}

// Rendering Logic
function renderApp() {
  if (!state.dashboard) return;

  renderHeader();
  renderSummaryCard();
  renderGroupTabs();
  renderAllocationOrAccountCard();
  renderHoldings();

  if (window.lucide) lucide.createIcons();
}

function renderHeader() {
  const summary = state.dashboard.summary;
  const baseDateEl = document.getElementById('header-base-date');
  const marketBadge = document.getElementById('header-market-badge');
  const cardBadge = document.getElementById('card-as-of-badge');

  if (summary && summary.base_date) {
    const parts = summary.base_date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : summary.base_date;
    baseDateEl.textContent = `기준: ${formattedDate} 종가`;
    
    if (summary.is_today_close) {
      marketBadge.className = 'inline-flex items-center gap-1 font-medium text-emerald-400';
      if (cardBadge) cardBadge.textContent = '당일 종가 확정';
    } else {
      marketBadge.className = 'inline-flex items-center gap-1 font-medium text-amber-400';
      if (cardBadge) cardBadge.textContent = '직전 영업일 종가';
    }
  }
}

function renderSummaryCard() {
  const summary = state.dashboard.summary;
  if (!summary) return;

  // Total Valuation
  document.getElementById('total-valuation').textContent = formatNumber(summary.total_valuation);
  document.getElementById('total-invested').textContent = formatWon(summary.total_invested);

  // Profit/Loss & Return Rate
  const pnlEl = document.getElementById('total-pnl');
  const badgeEl = document.getElementById('total-return-badge');
  const pnlNum = parseFloat(summary.total_pnl);
  const returnRateNum = parseFloat(summary.total_return_rate);

  const sign = pnlNum > 0 ? '+' : '';
  pnlEl.textContent = `${sign}₩ ${formatNumber(pnlNum)}`;
  pnlEl.className = `text-sm font-bold num-tabular ${getPnlClass(pnlNum)}`;

  badgeEl.textContent = formatPercent(returnRateNum);
  if (pnlNum > 0) {
    badgeEl.className = 'text-xs px-1.5 py-0.5 rounded font-bold num-tabular bg-red-950/60 text-krx-red border border-red-800/40';
  } else if (pnlNum < 0) {
    badgeEl.className = 'text-xs px-1.5 py-0.5 rounded font-bold num-tabular bg-blue-950/60 text-krx-blue border border-blue-800/40';
  } else {
    badgeEl.className = 'text-xs px-1.5 py-0.5 rounded font-bold num-tabular bg-slate-800 text-slate-400';
  }
}

function renderGroupTabs() {
  const container = document.getElementById('group-tabs-container');
  container.innerHTML = '';

  const allHoldingsCount = (state.dashboard.all_holdings || []).length;
  const isAllActive = state.activeGroupId === null;

  // 1. "전체" Tab
  const allBtn = document.createElement('button');
  allBtn.className = `px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all touch-active flex items-center gap-1.5 ${
    isAllActive
      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
  }`;
  allBtn.innerHTML = `<span>전체</span><span class="text-[10px] px-1.5 py-0.2 rounded-full ${isAllActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'}">${allHoldingsCount}</span>`;
  allBtn.onclick = () => {
    state.activeGroupId = null;
    renderApp();
  };
  container.appendChild(allBtn);

  // 2. Groups Tabs
  state.groups.forEach((grp) => {
    const isActive = state.activeGroupId === grp.group_id;
    const btn = document.createElement('button');
    btn.className = `px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all touch-active flex items-center gap-1.5 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
    }`;
    btn.innerHTML = `
      <span class="w-2 h-2 rounded-full" style="background-color: ${grp.color || '#3B82F6'}"></span>
      <span>${grp.name}</span>
      <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'}">${(grp.holdings || []).length}</span>
    `;
    btn.onclick = () => {
      state.activeGroupId = grp.group_id;
      renderApp();
    };
    container.appendChild(btn);
  });
}

function renderAllocationOrAccountCard() {
  const allocationSection = document.getElementById('allocation-section');
  const singleAccountSection = document.getElementById('single-account-section');

  if (state.activeGroupId === null) {
    // Show Stacked Allocation Bar
    allocationSection.classList.remove('hidden');
    singleAccountSection.classList.add('hidden');

    const totalValuation = parseFloat(state.dashboard.summary.total_valuation || 0);
    const totalCount = (state.dashboard.all_holdings || []).length;
    document.getElementById('allocation-total-count').textContent = `총 ${totalCount}종목`;

    const barContainer = document.getElementById('allocation-bar');
    const legendContainer = document.getElementById('allocation-legend');
    barContainer.innerHTML = '';
    legendContainer.innerHTML = '';

    if (totalValuation <= 0 || state.groups.length === 0) {
      barContainer.innerHTML = '<div class="w-full h-full bg-slate-700/60 rounded-full"></div>';
      legendContainer.innerHTML = '<span class="text-slate-500 text-xs">보유 자산이 없습니다.</span>';
      return;
    }

    state.groups.forEach((grp) => {
      const val = parseFloat(grp.valuation_amount || 0);
      const weight = parseFloat(grp.weight_percent || 0);
      if (val > 0) {
        // Bar segment
        const seg = document.createElement('div');
        seg.className = 'h-full transition-all duration-300';
        seg.style.width = `${weight}%`;
        seg.style.backgroundColor = grp.color || '#3B82F6';
        seg.title = `${grp.name}: ${weight}%`;
        barContainer.appendChild(seg);

        // Legend pill
        const leg = document.createElement('div');
        leg.className = 'flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-750 text-slate-300';
        leg.innerHTML = `
          <span class="w-2 h-2 rounded-full" style="background-color: ${grp.color || '#3B82F6'}"></span>
          <span>${grp.name}</span>
          <span class="font-bold text-white num-tabular">${weight.toFixed(1)}%</span>
        `;
        legendContainer.appendChild(leg);
      }
    });
  } else {
    // Show Single Account Detail Card
    allocationSection.classList.add('hidden');
    singleAccountSection.classList.remove('hidden');

    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    if (!grp) return;

    document.getElementById('single-acc-name').textContent = grp.name;
    document.getElementById('single-acc-type').textContent = grp.account_type;
    document.getElementById('single-acc-color-dot').style.backgroundColor = grp.color || '#3B82F6';
    document.getElementById('single-acc-weight').textContent = `비중 ${(parseFloat(grp.weight_percent) || 0).toFixed(1)}%`;
    document.getElementById('single-acc-valuation').textContent = formatWon(grp.valuation_amount);
    document.getElementById('single-acc-invested').textContent = formatWon(grp.invested_amount);

    const pnlVal = parseFloat(grp.pnl || 0);
    const returnVal = parseFloat(grp.return_rate || 0);
    const pnlClass = getPnlClass(pnlVal);

    // 1. 수익금 (평가손익)
    const pnlAmountEl = document.getElementById('single-acc-pnl-amount');
    if (pnlAmountEl) {
      const sign = pnlVal > 0 ? '+' : (pnlVal < 0 ? '-' : '');
      const formattedAmount = pnlVal !== 0 ? `${sign}₩ ${formatNumber(Math.abs(pnlVal))}` : '₩ 0';
      pnlAmountEl.textContent = formattedAmount;
      pnlAmountEl.className = `text-xs font-bold num-tabular truncate block ${pnlClass}`;
    }

    // 2. 수익률
    const returnRateEl = document.getElementById('single-acc-return-rate') || document.getElementById('single-acc-pnl');
    if (returnRateEl) {
      returnRateEl.textContent = formatPercent(returnVal);
      returnRateEl.className = `text-xs font-bold num-tabular truncate block ${pnlClass}`;
    }
  }
}

let draggedHoldingCard = null;
let isDraggingHolding = false;

function getSortedFilteredHoldings() {
  let list = [];
  if (state.activeGroupId === null) {
    list = [...(state.dashboard?.all_holdings || [])];
  } else {
    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    list = grp ? [...(grp.holdings || [])] : [];
  }

  // Sort
  switch (state.currentSort) {
    case 'custom':
      list.sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      break;
    case 'valuation_desc':
      list.sort((a, b) => parseFloat(b.valuation_amount) - parseFloat(a.valuation_amount));
      break;
    case 'return_rate_desc':
      list.sort((a, b) => parseFloat(b.return_rate) - parseFloat(a.return_rate));
      break;
    case 'return_rate_asc':
      list.sort((a, b) => parseFloat(a.return_rate) - parseFloat(b.return_rate));
      break;
    case 'name_asc':
      list.sort((a, b) => a.name_kr.localeCompare(b.name_kr));
      break;
    default:
      list.sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      break;
  }
  return list;
}

function renderHoldings() {
  const holdings = getSortedFilteredHoldings();
  const listContainer = document.getElementById('holdings-list');
  const countBadge = document.getElementById('holdings-count-badge');
  const emptyState = document.getElementById('holdings-empty-state');

  countBadge.textContent = holdings.length;

  if (holdings.length === 0) {
    listContainer.innerHTML = '';
    listContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  listContainer.classList.remove('hidden');
  listContainer.innerHTML = '';

  holdings.forEach((h) => {
    const pnlNum = parseFloat(h.pnl || 0);
    const returnNum = parseFloat(h.return_rate || 0);
    const changeNum = parseFloat(h.change_rate || 0);
    const pnlClass = getPnlClass(pnlNum);
    const changeClass = getPnlClass(changeNum);
    const investedAmount = h.invested_amount != null ? h.invested_amount : (parseFloat(h.avg_price || 0) * parseInt(h.quantity || 0));

    const card = document.createElement('div');
    card.className = 'holding-drag-item bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600/80 rounded-2xl p-4 transition-all shadow-sm cursor-pointer';
    card.setAttribute('draggable', 'true');
    card.dataset.holdingId = h.holding_id;

    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-1.5">
          <div class="drag-handle text-slate-500 hover:text-slate-300 p-1 -ml-1 rounded transition-colors" title="드래그하여 순서 변경">
            <i data-lucide="grip-vertical" class="w-4 h-4"></i>
          </div>
          <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold text-white shadow-xs" style="background-color: ${h.group_color || '#3B82F6'}">
            ${h.group_name || '기본'}
          </span>
          <span class="text-xs font-mono text-slate-400 font-semibold">${h.ticker}</span>
        </div>
        <div class="flex items-center gap-1 text-right">
          <span class="text-xs font-extrabold text-white num-tabular">${formatWon(h.close_price)}</span>
          <span class="text-[10px] font-bold num-tabular px-1 py-0.2 rounded ${changeClass} bg-slate-900/60">
            ${formatPercent(changeNum)}
          </span>
        </div>
      </div>

      <div class="mb-3">
        <h3 class="text-sm font-bold text-white tracking-tight leading-snug line-clamp-1">${h.name_kr}</h3>
        <p class="text-[13px] text-slate-300 num-tabular mt-1 leading-relaxed">
          <span class="whitespace-nowrap">보유 <strong class="text-white font-semibold">${formatNumber(h.quantity)}주</strong></span>
          <span class="whitespace-nowrap"> · 평단 <strong class="text-white font-semibold">${formatWon(h.avg_price)}</strong></span>
          <span class="whitespace-nowrap"> · 원금 <strong class="text-white font-semibold">${formatWon(investedAmount)}</strong></span>
        </p>
      </div>

      <div class="pt-2.5 border-t border-slate-700/60 flex justify-between items-center text-sm">
        <div>
          <span class="text-[12px] text-slate-400 block">평가금액</span>
          <span class="font-extrabold text-white num-tabular text-sm">${formatWon(h.valuation_amount)}</span>
        </div>
        <div class="text-right">
          <span class="text-[12px] text-slate-400 block">평가손익 (수익률)</span>
          <span class="font-extrabold num-tabular text-sm ${pnlClass}">
            ${pnlNum > 0 ? '+' : ''}${formatWon(pnlNum)} (${formatPercent(returnNum)})
          </span>
        </div>
      </div>
    `;

    // Click handler to open detail modal
    card.onclick = (e) => {
      if (isDraggingHolding) return;
      if (e.target.closest('.drag-handle')) return;
      openHoldingDetail(h);
    };

    // Desktop Mouse Drag Start
    card.addEventListener('dragstart', (e) => {
      isDraggingHolding = true;
      draggedHoldingCard = card;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', h.holding_id);
      setTimeout(() => {
        card.classList.add('is-dragging');
      }, 0);
    });

    // Desktop Mouse Drag End
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedHoldingCard = null;
      setTimeout(() => {
        isDraggingHolding = false;
      }, 120);
    });

    // Mobile Touch Drag Support via drag-handle
    const dragHandle = card.querySelector('.drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('touchstart', (e) => {
        isDraggingHolding = true;
        draggedHoldingCard = card;
        card.classList.add('is-dragging');
      }, { passive: true });

      dragHandle.addEventListener('touchmove', (e) => {
        if (!draggedHoldingCard) return;
        const touch = e.touches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elemBelow) return;
        const targetCard = elemBelow.closest('.holding-drag-item');
        if (targetCard && targetCard !== draggedHoldingCard && targetCard.parentNode === listContainer) {
          const rect = targetCard.getBoundingClientRect();
          const nextElement = (touch.clientY - rect.top) / (rect.bottom - rect.top) > 0.5 ? targetCard.nextSibling : targetCard;
          if (nextElement !== draggedHoldingCard) {
            listContainer.insertBefore(draggedHoldingCard, nextElement);
          }
        }
      }, { passive: true });

      dragHandle.addEventListener('touchend', async () => {
        if (!draggedHoldingCard) return;
        card.classList.remove('is-dragging');
        draggedHoldingCard = null;
        setTimeout(() => {
          isDraggingHolding = false;
        }, 120);

        const cards = Array.from(listContainer.querySelectorAll('.holding-drag-item'));
        const newOrderedIds = cards.map((c) => c.dataset.holdingId).filter(Boolean);
        await saveNewHoldingsOrder(newOrderedIds);
      });
    }

    listContainer.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

async function saveNewHoldingsOrder(newOrderedIds) {
  if (!newOrderedIds || newOrderedIds.length <= 1) return;

  // 1. Switch to custom sort if not already
  if (state.currentSort !== 'custom') {
    state.currentSort = 'custom';
    localStorage.setItem('etf_sort_preference', 'custom');
    const sortSel = document.getElementById('sort-selector');
    if (sortSel) sortSel.value = 'custom';
  }

  // 2. Map holding_id to new sort_order and update local state immediately
  const orderMap = new Map();
  newOrderedIds.forEach((id, idx) => orderMap.set(id, idx));

  if (state.dashboard && state.dashboard.all_holdings) {
    state.dashboard.all_holdings.forEach((h) => {
      if (orderMap.has(h.holding_id)) {
        h.sort_order = orderMap.get(h.holding_id);
      }
    });
  }

  if (state.groups) {
    state.groups.forEach((g) => {
      if (g.holdings) {
        g.holdings.forEach((h) => {
          if (orderMap.has(h.holding_id)) {
            h.sort_order = orderMap.get(h.holding_id);
          }
        });
        g.holdings.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      }
    });
  }

  // 3. Persist to backend API
  try {
    await apiFetch('/api/v1/holdings/reorder', {
      method: 'PATCH',
      body: {
        group_id: state.activeGroupId,
        holding_ids: newOrderedIds,
      },
    });
    showToast('종목 순서가 저장되었습니다.', 'success');
  } catch (err) {
    console.error('Failed to save holding order:', err);
    showToast('종목 순서 저장에 실패했습니다.', 'error');
    await loadDashboard();
  }
}

// Holding Detail Modal
async function openHoldingDetail(holding) {
  state.selectedHolding = holding;

  document.getElementById('detail-group-badge').textContent = holding.group_name || '계좌';
  document.getElementById('detail-group-badge').style.backgroundColor = holding.group_color || '#3B82F6';
  document.getElementById('detail-ticker').textContent = holding.ticker;
  document.getElementById('detail-name').textContent = holding.name_kr;
  document.getElementById('detail-current-price').textContent = formatWon(holding.close_price);

  const changeNum = parseFloat(holding.change_rate || 0);
  const changeEl = document.getElementById('detail-change-rate');
  changeEl.textContent = formatPercent(changeNum);
  changeEl.className = `text-xs font-bold num-tabular px-2 py-0.5 rounded ${getPnlClass(changeNum)} bg-slate-800`;

  const pnlNum = parseFloat(holding.pnl || 0);
  const returnNum = parseFloat(holding.return_rate || 0);
  const pnlEl = document.getElementById('detail-pnl');
  const returnEl = document.getElementById('detail-return-rate');
  pnlEl.textContent = `${pnlNum > 0 ? '+' : ''}${formatWon(pnlNum)}`;
  pnlEl.className = `text-base font-bold num-tabular ${getPnlClass(pnlNum)}`;
  returnEl.textContent = `(${formatPercent(returnNum)})`;
  returnEl.className = `text-xs font-bold num-tabular ml-1 ${getPnlClass(pnlNum)}`;

  document.getElementById('detail-valuation').textContent = formatWon(holding.valuation_amount);
  document.getElementById('detail-invested').textContent = formatWon(holding.invested_amount);
  document.getElementById('detail-qty').textContent = `${formatNumber(holding.quantity)}주`;
  document.getElementById('detail-avg-price').textContent = formatWon(holding.avg_price);

  // ETF Master Info
  document.getElementById('detail-issuer').textContent = holding.issuer || '-';

  // Fetch full ETF detail for AUM and Expense ratio
  try {
    const etfDetail = await apiFetch(`/api/v1/etfs/${holding.ticker}`);
    if (etfDetail) {
      document.getElementById('detail-aum').textContent = etfDetail.aum ? `₩ ${formatNumber(etfDetail.aum)}억` : '-';
      document.getElementById('detail-expense').textContent = etfDetail.expense_ratio ? `${(parseFloat(etfDetail.expense_ratio) * 100).toFixed(2)}%` : '-';
    }
  } catch (e) {
    console.error(e);
  }

  // Transactions list
  const txList = document.getElementById('detail-tx-list');
  const txCount = document.getElementById('detail-tx-count');
  txList.innerHTML = '';
  const txs = holding.transactions || [];
  txCount.textContent = `${txs.length}건`;

  if (txs.length === 0) {
    txList.innerHTML = '<div class="text-xs text-slate-500 py-2 text-center">거래 내역이 없습니다.</div>';
  } else {
    txs.forEach((tx) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center p-2 rounded-lg bg-slate-800/80 border border-slate-750 text-xs';
      const totalAmount = parseFloat(tx.price) * parseInt(tx.quantity);
      row.innerHTML = `
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${tx.tx_type === 'BUY' ? 'bg-red-950/60 text-krx-red border border-red-800/30' : 'bg-blue-950/60 text-krx-blue'}">${tx.tx_type === 'BUY' ? '매수' : '매도'}</span>
            <span class="text-slate-300 font-semibold num-tabular">${tx.traded_at}</span>
          </div>
          <span class="text-[11px] text-slate-400 num-tabular mt-0.5 block">${formatNumber(tx.quantity)}주 @ ${formatWon(tx.price)}</span>
        </div>
        <span class="font-bold text-white num-tabular">${formatWon(totalAmount)}</span>
      `;
      txList.appendChild(row);
    });
  }

  document.getElementById('modal-holding-detail').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeHoldingDetail() {
  document.getElementById('modal-holding-detail').classList.add('hidden');
  state.selectedHolding = null;
}

// Search & Buy Flow (F-01, F-02)
let searchDebounceTimer = null;

function openBuyModal(prefilledETF = null, prefilledGroupId = null) {
  const modal = document.getElementById('modal-buy');
  modal.classList.remove('hidden');

  if (prefilledETF) {
    selectETFForBuy(prefilledETF, prefilledGroupId);
  } else {
    showBuyStep('search');
    const searchInput = document.getElementById('etf-search-input');
    searchInput.value = '';
    searchInput.focus();
    searchETFs('');
  }
}

function closeBuyModal() {
  document.getElementById('modal-buy').classList.add('hidden');
  state.selectedETF = null;
}

function showBuyStep(step) {
  const searchStep = document.getElementById('buy-step-search');
  const formStep = document.getElementById('buy-step-form');
  const title = document.getElementById('buy-modal-title');

  if (step === 'search') {
    searchStep.classList.remove('hidden');
    formStep.classList.add('hidden');
    title.textContent = 'ETF 매수 기록 - 종목 검색';
  } else {
    searchStep.classList.add('hidden');
    formStep.classList.remove('hidden');
    title.textContent = 'ETF 매수 등록';
  }
  if (window.lucide) lucide.createIcons();
}

async function searchETFs(query) {
  const list = document.getElementById('search-results-list');
  const countEl = document.getElementById('search-result-count');
  const clearBtn = document.getElementById('btn-clear-search');

  if (!query || !query.trim()) {
    clearBtn.classList.add('hidden');
    countEl.textContent = '0건';
    list.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">종목명, 코드(069500), 초성(ㅋㄷㅅ)을 입력하세요.</div>';
    return;
  }

  clearBtn.classList.remove('hidden');
  list.innerHTML = '<div class="py-6 text-center text-slate-400 text-xs"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto mb-1 text-blue-400"></i>검색 중...</div>';
  if (window.lucide) lucide.createIcons();

  try {
    const results = await apiFetch(`/api/v1/etfs/search?q=${encodeURIComponent(query)}&limit=25`);
    countEl.textContent = `${results.length}건`;

    if (results.length === 0) {
      list.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">일치하는 ETF를 찾지 못했습니다.</div>';
      return;
    }

    list.innerHTML = '';
    results.forEach((etf) => {
      const item = document.createElement('div');
      item.className = 'p-3 rounded-xl bg-slate-800/70 hover:bg-slate-750 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer flex justify-between items-center touch-active';
      
      const changeNum = parseFloat(etf.change_rate || 0);
      const changeClass = getPnlClass(changeNum);

      item.innerHTML = `
        <div class="flex-1 pr-3">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-xs font-mono font-bold text-blue-400">${etf.ticker}</span>
            <span class="text-[11px] text-slate-400">${etf.issuer || ''}</span>
          </div>
          <h4 class="text-sm font-bold text-white tracking-tight line-clamp-1">${etf.name_kr}</h4>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="text-sm font-extrabold text-white num-tabular block">${formatWon(etf.close_price)}</span>
          <span class="text-[11px] font-bold num-tabular ${changeClass}">
            ${formatPercent(changeNum)}
          </span>
        </div>
      `;

      item.onclick = () => selectETFForBuy(etf);
      list.appendChild(item);
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="py-6 text-center text-red-400 text-xs">검색 중 오류가 발생했습니다.</div>';
  }
}

function selectETFForBuy(etf, prefilledGroupId = null) {
  state.selectedETF = etf;
  showBuyStep('form');

  // Fill ETF summary
  document.getElementById('form-ticker').textContent = etf.ticker;
  document.getElementById('form-issuer').textContent = etf.issuer || '';
  document.getElementById('form-name').textContent = etf.name_kr;
  document.getElementById('form-close-price').textContent = formatWon(etf.close_price);

  // Fill form inputs
  const priceInput = document.getElementById('input-buy-price');
  priceInput.value = formatNumber(etf.close_price);

  const qtyInput = document.getElementById('input-buy-qty');
  qtyInput.value = '1';

  const dateInput = document.getElementById('input-buy-date');
  dateInput.value = new Date().toISOString().split('T')[0];

  const memoInput = document.getElementById('input-buy-memo');
  memoInput.value = '';

  // Render Account selector pills
  renderBuyGroupPills(prefilledGroupId);
  updateBuyFormCalculations();
}

function renderBuyGroupPills(prefilledGroupId = null) {
  const container = document.getElementById('form-group-pills');
  container.innerHTML = '';

  let activeId = prefilledGroupId || (state.activeGroupId !== null ? state.activeGroupId : (state.groups[0]?.group_id || null));

  state.groups.forEach((grp) => {
    const isSelected = grp.group_id === activeId;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all touch-active ${
      isSelected
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
    }`;
    pill.dataset.groupId = grp.group_id;
    pill.innerHTML = `
      <span class="w-2 h-2 rounded-full" style="background-color: ${grp.color || '#3B82F6'}"></span>
      <span>${grp.name}</span>
    `;
    pill.onclick = () => {
      container.querySelectorAll('button').forEach((b) => {
        b.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all touch-active bg-slate-800 text-slate-300 hover:bg-slate-750';
      });
      pill.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all touch-active bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400';
      checkExistingHoldingBanner(grp.group_id);
    };
    container.appendChild(pill);
  });

  if (activeId) checkExistingHoldingBanner(activeId);
}

function checkExistingHoldingBanner(groupId) {
  const banner = document.getElementById('existing-holding-banner');
  const desc = document.getElementById('existing-holding-desc');
  if (!state.selectedETF) return;

  const targetGroup = state.groups.find((g) => g.group_id === groupId);
  const existing = targetGroup?.holdings?.find((h) => h.ticker === state.selectedETF.ticker);

  if (existing) {
    banner.classList.remove('hidden');
    desc.innerHTML = `현재 <strong>${existing.group_name}</strong> 계좌에 <strong>${formatNumber(existing.quantity)}주</strong> (평단 ${formatWon(existing.avg_price)}) 보유 중입니다.<br>추가 매수 시 <strong>가중평균 평단가</strong>로 자동 합산 계산됩니다.`;
    if (window.lucide) lucide.createIcons();
  } else {
    banner.classList.add('hidden');
  }
}

function updateBuyFormCalculations() {
  const priceStr = document.getElementById('input-buy-price').value.replace(/[^0-9]/g, '');
  const qtyStr = document.getElementById('input-buy-qty').value;

  const price = parseInt(priceStr) || 0;
  const qty = parseInt(qtyStr) || 0;
  const total = price * qty;

  document.getElementById('form-total-calc').textContent = formatWon(total);
}

async function submitBuyHolding() {
  if (!state.selectedETF) return;

  const selectedPill = document.querySelector('#form-group-pills button.bg-blue-600');
  const groupId = selectedPill?.dataset.groupId;
  if (!groupId) {
    showToast('매수할 계좌 그룹을 선택해주세요.', 'warning');
    return;
  }

  const priceStr = document.getElementById('input-buy-price').value.replace(/[^0-9]/g, '');
  const qtyStr = document.getElementById('input-buy-qty').value;
  const dateStr = document.getElementById('input-buy-date').value;
  const memo = document.getElementById('input-buy-memo').value;

  const price = parseFloat(priceStr);
  const qty = parseInt(qtyStr);

  if (!price || price <= 0) {
    showToast('유효한 매수가격을 입력해주세요.', 'warning');
    return;
  }
  if (!qty || qty <= 0) {
    showToast('매수 수량을 1주 이상 입력해주세요.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-buy');
  submitBtn.disabled = true;
  submitBtn.textContent = '등록 중...';

  try {
    const payload = {
      ticker: state.selectedETF.ticker,
      group_id: groupId,
      price: price,
      quantity: qty,
      traded_at: dateStr || null,
      memo: memo ? memo.trim() : null,
    };

    const savedHolding = await apiFetch('/api/v1/holdings', {
      method: 'POST',
      body: payload,
    });

    showToast(`${savedHolding.name_kr} 매수 기록이 저장되었습니다 (평단 ${formatWon(savedHolding.avg_price)})`, 'success');
    closeBuyModal();
    await loadDashboard();

  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '매수 등록 완료';
  }
}

// Holding Direct Edit Modal
function openEditHoldingModal() {
  if (!state.selectedHolding) return;
  const modal = document.getElementById('modal-edit-holding');
  document.getElementById('edit-avg-price').value = Math.round(parseFloat(state.selectedHolding.avg_price));
  document.getElementById('edit-quantity').value = state.selectedHolding.quantity;
  document.getElementById('edit-memo').value = state.selectedHolding.memo || '';
  modal.classList.remove('hidden');
}

function closeEditHoldingModal() {
  document.getElementById('modal-edit-holding').classList.add('hidden');
}

async function saveEditHolding() {
  if (!state.selectedHolding) return;

  const avgPrice = parseFloat(document.getElementById('edit-avg-price').value);
  const quantity = parseInt(document.getElementById('edit-quantity').value);
  const memo = document.getElementById('edit-memo').value;

  if (isNaN(avgPrice) || avgPrice <= 0) {
    showToast('평단가를 올바르게 입력해주세요.', 'warning');
    return;
  }
  if (isNaN(quantity) || quantity <= 0) {
    showToast('수량을 1주 이상 입력해주세요.', 'warning');
    return;
  }

  try {
    await apiFetch(`/api/v1/holdings/${state.selectedHolding.holding_id}`, {
      method: 'PATCH',
      body: {
        avg_price: avgPrice,
        quantity: quantity,
        memo: memo ? memo.trim() : null,
      },
    });

    showToast('보유 정보가 수정되었습니다.', 'success');
    closeEditHoldingModal();
    closeHoldingDetail();
    await loadDashboard();

  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function deleteHolding(holdingId) {
  if (!confirm('이 종목을 포트폴리오에서 삭제하시겠습니까? (거래 내역도 함께 삭제됩니다)')) {
    return;
  }

  const deleteBtn = document.getElementById('btn-detail-delete');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  try {
    await apiFetch(`/api/v1/holdings/${holdingId}`, { method: 'DELETE' });
    showToast('종목이 삭제되었습니다.', 'success');
    closeHoldingDetail();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
      // If already deleted on server, sync UI gracefully
      showToast('종목이 삭제되었습니다.', 'success');
      closeHoldingDetail();
      await loadDashboard();
    } else {
      showToast(err.message || '종목 삭제에 실패했습니다.', 'error');
    }
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

// Group Edit Modal
function openEditGroupModal(grp) {
  if (!grp) return;
  state.editingGroup = grp;

  const nameInput = document.getElementById('edit-group-name');
  const typeSelect = document.getElementById('edit-group-type');
  const colorInput = document.getElementById('edit-group-color');
  const colorHex = document.getElementById('edit-group-color-hex');
  const colorDot = document.getElementById('edit-group-color-dot');
  const holdingsCountEl = document.getElementById('edit-group-holdings-count');
  const valuationEl = document.getElementById('edit-group-valuation');

  nameInput.value = grp.name || '';
  typeSelect.value = grp.account_type || '일반';
  
  const color = grp.color || '#3B82F6';
  colorInput.value = color;
  colorHex.textContent = color.toUpperCase();
  colorDot.style.backgroundColor = color;

  const hCount = (grp.holdings || []).length;
  holdingsCountEl.textContent = `${hCount}종목`;
  valuationEl.textContent = formatWon(grp.valuation_amount || 0);

  document.getElementById('modal-edit-group').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 100);
}

function closeEditGroupModal() {
  document.getElementById('modal-edit-group').classList.add('hidden');
  state.editingGroup = null;
}

async function saveEditGroup() {
  if (!state.editingGroup) return;

  const nameInput = document.getElementById('edit-group-name');
  const typeSelect = document.getElementById('edit-group-type');
  const colorInput = document.getElementById('edit-group-color');

  const newName = nameInput.value.trim();
  if (!newName) {
    showToast('계좌명을 입력해주세요.', 'warning');
    nameInput.focus();
    return;
  }

  const newType = typeSelect.value;
  const newColor = colorInput.value;

  const saveBtn = document.getElementById('btn-save-edit-group');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }

  try {
    await apiFetch(`/api/v1/groups/${state.editingGroup.group_id}`, {
      method: 'PATCH',
      body: {
        name: newName,
        account_type: newType,
        color: newColor,
      },
    });

    showToast(`'${newName}' 계좌 정보가 수정되었습니다.`, 'success');
    closeEditGroupModal();
    await loadDashboard();
    renderGroupsList();

  } catch (err) {
    console.error('Failed to update group:', err);
    showToast(err.message || '계좌 정보 수정에 실패했습니다.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '수정 저장';
    }
}
}

// Group Management Modal
function openGroupsModal() {
  renderGroupsList();
  document.getElementById('modal-groups').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeGroupsModal() {
  document.getElementById('modal-groups').classList.add('hidden');
}

function renderGroupsList() {
  const list = document.getElementById('groups-list');
  list.innerHTML = '';

  state.groups.forEach((grp) => {
    const item = document.createElement('div');
    item.className = 'group-item p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 flex justify-between items-center cursor-pointer transition-all group';
    
    item.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0 pointer-events-none">
        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${grp.color || '#3B82F6'}"></span>
        <div class="truncate">
          <span class="text-xs font-bold text-white block truncate group-hover:text-blue-400 transition-colors">${grp.name}</span>
          <span class="text-[10px] text-slate-400">${grp.account_type} · ${(grp.holdings || []).length}종목</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <button class="btn-edit-group p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors" title="계좌 수정" data-group-id="${grp.group_id}">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
        </button>
        <button class="btn-delete-group p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="계좌 삭제" data-group-id="${grp.group_id}" data-name="${grp.name}" data-count="${(grp.holdings || []).length}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    // Click on item opens edit modal
    item.onclick = (e) => {
      if (e.target.closest('.btn-delete-group')) return;
      openEditGroupModal(grp);
    };

    list.appendChild(item);
  });

  list.querySelectorAll('.btn-edit-group').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const grp = state.groups.find((g) => g.group_id === btn.dataset.groupId);
      if (grp) openEditGroupModal(grp);
    };
  });

  list.querySelectorAll('.btn-delete-group').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleDeleteGroupClick(btn.dataset.groupId, btn.dataset.name, parseInt(btn.dataset.count));
    };
  });

  if (window.lucide) lucide.createIcons();
}

async function createNewGroup() {
  const nameInput = document.getElementById('new-group-name');
  const typeSelect = document.getElementById('new-group-type');
  const colorInput = document.getElementById('new-group-color');

  const name = nameInput.value.trim();
  if (!name) {
    showToast('계좌명을 입력해주세요.', 'warning');
    return;
  }

  try {
    await apiFetch('/api/v1/groups', {
      method: 'POST',
      body: {
        name: name,
        account_type: typeSelect.value,
        color: colorInput.value,
        sort_order: state.groups.length + 1,
      },
    });

    showToast(`'${name}' 계좌가 추가되었습니다.`, 'success');
    nameInput.value = '';
    await loadDashboard();
    renderGroupsList();

  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

function handleDeleteGroupClick(groupId, groupName, holdingCount) {
  state.deletePendingGroupId = groupId;

  if (holdingCount === 0) {
    if (confirm(`'${groupName}' 계좌를 삭제하시겠습니까?`)) {
      executeDeleteGroup(groupId);
    }
  } else {
    // Open Group Delete Guard Modal
    const modal = document.getElementById('modal-group-delete-guard');
    document.getElementById('delete-guard-desc').innerHTML = `<strong>'${groupName}'</strong> 계좌에 <strong>${holdingCount}개</strong>의 보유 종목이 있습니다.<br>종목을 다른 계좌로 안전하게 이관하시겠습니까?`;

    const select = document.getElementById('transfer-target-group-select');
    select.innerHTML = '';
    state.groups
      .filter((g) => g.group_id !== groupId)
      .forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.group_id;
        opt.textContent = `${g.name} (${g.account_type})`;
        select.appendChild(opt);
      });

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

async function executeDeleteGroup(groupId, transferToGroupId = null, forceDelete = false) {
  try {
    let url = `/api/v1/groups/${groupId}?`;
    if (transferToGroupId) {
      url += `target_group_id=${transferToGroupId}&transfer_to_group_id=${transferToGroupId}`;
    } else if (forceDelete) {
      url += `delete_holdings=true&force_delete_holdings=true`;
    }

    await apiFetch(url, { method: 'DELETE' });

    showToast('계좌가 성공적으로 삭제되었습니다.', 'success');
    document.getElementById('modal-group-delete-guard').classList.add('hidden');
    if (state.activeGroupId === groupId) state.activeGroupId = null;
    await loadDashboard();
    renderGroupsList();

  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
      showToast('계좌가 삭제되었습니다.', 'success');
      document.getElementById('modal-group-delete-guard').classList.add('hidden');
      if (state.activeGroupId === groupId) state.activeGroupId = null;
      await loadDashboard();
      renderGroupsList();
    } else {
      showToast(err.message, 'error');
    }
  }
}

// Event Listeners Setup
function setupEventListeners() {
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  // User ID Direct Input Bar Events
  bindClick('btn-bar-apply-user', () => {
    const barInput = document.getElementById('bar-user-id-input');
    if (barInput) handleApplyCustomUserId(barInput.value);
  });

  bindClick('btn-bar-open-user-modal', openUserSettingsModal);

  const barInputEl = document.getElementById('bar-user-id-input');
  if (barInputEl) {
    barInputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCustomUserId(barInputEl.value);
      }
    };
  }

  // Top Navigation Actions
  bindClick('btn-sync-market', syncMarketPrices);
  bindClick('btn-open-groups', openGroupsModal);
  bindClick('btn-close-groups', closeGroupsModal);

  // Floating Action Button & Empty state add button
  bindClick('btn-open-buy', () => openBuyModal());
  bindClick('btn-empty-add', () => openBuyModal());
  bindClick('btn-quick-add-group', openGroupsModal);

  // Sort Selector
  const sortSelector = document.getElementById('sort-selector');
  if (sortSelector) {
    sortSelector.value = state.currentSort;
    sortSelector.onchange = (e) => {
      state.currentSort = e.target.value;
      localStorage.setItem('etf_sort_preference', state.currentSort);
      renderHoldings();
    };
  }

  // Holdings List Desktop Drag & Drop Reordering
  const listContainer = document.getElementById('holdings-list');
  if (listContainer) {
    listContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedHoldingCard) return;

      const targetCard = e.target.closest('.holding-drag-item');
      if (!targetCard || targetCard === draggedHoldingCard || targetCard.parentNode !== listContainer) return;

      const rect = targetCard.getBoundingClientRect();
      const nextElement = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5 ? targetCard.nextSibling : targetCard;
      if (nextElement !== draggedHoldingCard) {
        listContainer.insertBefore(draggedHoldingCard, nextElement);
      }
    });

    listContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!draggedHoldingCard) return;

      const cards = Array.from(listContainer.querySelectorAll('.holding-drag-item'));
      const newOrderedIds = cards.map((c) => c.dataset.holdingId).filter(Boolean);
      await saveNewHoldingsOrder(newOrderedIds);
    });
  }

  // Search & Buy Modal Events
  bindClick('btn-close-buy-modal', closeBuyModal);
  bindClick('btn-back-to-search', () => showBuyStep('search'));
  bindClick('btn-submit-buy', submitBuyHolding);

  // Debounced Search Input
  const searchInput = document.getElementById('etf-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchETFs(e.target.value);
      }, 200);
    };
  }

  bindClick('btn-clear-search', () => {
    if (searchInput) {
      searchInput.value = '';
      searchETFs('');
      searchInput.focus();
    }
  });

  // Quick Chosung Chips
  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.onclick = () => {
      const q = chip.dataset.query;
      if (searchInput) searchInput.value = q;
      searchETFs(q);
    };
  });

  // Price & Qty Form input events
  const priceInput = document.getElementById('input-buy-price');
  if (priceInput) {
    priceInput.oninput = (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = raw ? parseInt(raw).toLocaleString('ko-KR') : '';
      updateBuyFormCalculations();
    };
  }

  const qtyInput = document.getElementById('input-buy-qty');
  if (qtyInput) {
    qtyInput.oninput = updateBuyFormCalculations;
  }

  document.querySelectorAll('.btn-qty-add').forEach((btn) => {
    btn.onclick = () => {
      const add = parseInt(btn.dataset.add);
      const cur = parseInt(qtyInput ? qtyInput.value : 0) || 0;
      if (qtyInput) {
        qtyInput.value = cur + add;
        updateBuyFormCalculations();
      }
    };
  });

  bindClick('btn-use-market-price', () => {
    if (state.selectedETF && priceInput) {
      priceInput.value = formatNumber(state.selectedETF.close_price);
      updateBuyFormCalculations();
    }
  });

  // Holding Detail Sheet Events
  bindClick('btn-close-detail', closeHoldingDetail);
  bindClick('btn-detail-add-more', () => {
    if (state.selectedHolding) {
      const etfStub = {
        ticker: state.selectedHolding.ticker,
        name_kr: state.selectedHolding.name_kr,
        issuer: state.selectedHolding.issuer,
        close_price: state.selectedHolding.close_price,
      };
      const grpId = state.selectedHolding.group_id;
      closeHoldingDetail();
      openBuyModal(etfStub, grpId);
    }
  });
  bindClick('btn-detail-edit', openEditHoldingModal);
  bindClick('btn-detail-delete', () => {
    if (state.selectedHolding) {
      deleteHolding(state.selectedHolding.holding_id);
    }
  });

  // Holding Direct Edit Modal Events
  bindClick('btn-close-edit-holding', closeEditHoldingModal);
  bindClick('btn-cancel-edit-holding', closeEditHoldingModal);
  bindClick('btn-save-edit-holding', saveEditHolding);

  // Group Direct Edit Modal Events
  bindClick('btn-edit-active-group', () => {
    if (state.activeGroupId) {
      const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
      if (grp) openEditGroupModal(grp);
    }
  });

  bindClick('btn-close-edit-group', closeEditGroupModal);
  bindClick('btn-cancel-edit-group', closeEditGroupModal);
  bindClick('btn-save-edit-group', saveEditGroup);

  const editColorInput = document.getElementById('edit-group-color');
  if (editColorInput) {
    editColorInput.oninput = (e) => {
      const c = e.target.value.toUpperCase();
      const hexEl = document.getElementById('edit-group-color-hex');
      const dotEl = document.getElementById('edit-group-color-dot');
      if (hexEl) hexEl.textContent = c;
      if (dotEl) dotEl.style.backgroundColor = c;
    };
  }

  document.querySelectorAll('#edit-group-palette button').forEach((btn) => {
    btn.onclick = () => {
      const c = btn.dataset.color;
      const colInput = document.getElementById('edit-group-color');
      const hexEl = document.getElementById('edit-group-color-hex');
      const dotEl = document.getElementById('edit-group-color-dot');
      if (colInput) colInput.value = c;
      if (hexEl) hexEl.textContent = c.toUpperCase();
      if (dotEl) dotEl.style.backgroundColor = c;
    };
  });

  // Group Create & Delete Guard Events
  bindClick('btn-create-group', createNewGroup);
  const newGroupCol = document.getElementById('new-group-color');
  if (newGroupCol) {
    newGroupCol.oninput = (e) => {
      const prev = document.getElementById('color-hex-preview');
      if (prev) prev.textContent = e.target.value.toUpperCase();
    };
  }

  bindClick('btn-cancel-group-delete', () => {
    const guard = document.getElementById('modal-group-delete-guard');
    if (guard) guard.classList.add('hidden');
    state.deletePendingGroupId = null;
  });

  bindClick('btn-confirm-transfer-delete', () => {
    const sel = document.getElementById('transfer-target-group-select');
    const targetGroupId = sel ? sel.value : null;
    if (state.deletePendingGroupId) {
      executeDeleteGroup(state.deletePendingGroupId, targetGroupId, false);
    }
  });

  bindClick('btn-confirm-force-delete', () => {
    if (confirm('정말로 이 계좌의 모든 보유 종목과 거래 기록을 영구 삭제하시겠습니까?')) {
      if (state.deletePendingGroupId) {
        executeDeleteGroup(state.deletePendingGroupId, null, true);
      }
    }
  });

  // User Settings Modal Logic
  async function openUserSettingsModal() {
    const modal = document.getElementById('modal-user-settings');
    if (!modal) return;
    modal.classList.remove('hidden');

    const currentId = getUserId();
    const displayInput = document.getElementById('active-user-id-display');
    const statusBadge = document.getElementById('active-user-status-badge');
    const customInput = document.getElementById('input-custom-user-id');
    const userSelect = document.getElementById('select-registered-users');

    if (displayInput) displayInput.value = currentId;
    if (customInput) customInput.value = currentId;

    // Fetch current user status
    try {
      const meRes = await apiFetch('/api/v1/users/me');
      if (statusBadge) {
        statusBadge.textContent = `${meRes.group_count}계좌 / ${meRes.holding_count}종목 보유`;
        if (meRes.holding_count > 0) {
          statusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium';
        } else {
          statusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 font-medium';
        }
      }
    } catch (err) {
      if (statusBadge) statusBadge.textContent = '조회 실패';
    }

    // Populate registered users dropdown
    try {
      const users = await apiFetch('/api/v1/users');
      if (userSelect && Array.isArray(users)) {
        userSelect.innerHTML = users.map(u => {
          const isCurrent = (u.user_id === currentId);
          const isDef = (u.user_id === DEFAULT_PRIMARY_USER_ID);
          const tag = isDef ? ' ★[내 원래 등록계좌]' : '';
          const currentTag = isCurrent ? ' (현재 활성)' : '';
          const dataTag = u.holding_count > 0 ? ` - ${u.group_count}계좌/${u.holding_count}종목` : ' - 빈 계정';
          return `<option value="${u.user_id}" ${isCurrent ? 'selected' : ''}>${u.user_id.substring(0, 8)}...${dataTag}${tag}${currentTag}</option>`;
        }).join('');
      }
    } catch (err) {
      console.error('Failed to load users list', err);
    }
  }

  function closeUserSettingsModal() {
    const modal = document.getElementById('modal-user-settings');
    if (modal) modal.classList.add('hidden');
  }

  async function handleApplyCustomUserId(inputVal) {
    if (!inputVal || !inputVal.trim()) {
      showToast('User ID를 입력해주세요.', 'warning');
      return;
    }
    try {
      const res = await apiFetch('/api/v1/users/resolve', {
        method: 'POST',
        body: { input_id: inputVal.trim() }
      });
      const resolvedId = res.resolved_user_id;
      setUserId(resolvedId);
      closeUserSettingsModal();
      showToast(`User ID 적용 완료 (${res.group_count}계좌, ${res.holding_count}종목)`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast(`User ID 적용 실패: ${err.message}`, 'error');
    }
  }

  // User Settings Events
  const btnOpenUser = document.getElementById('btn-open-user-settings');
  if (btnOpenUser) btnOpenUser.onclick = openUserSettingsModal;

  const btnCloseUser = document.getElementById('btn-close-user-modal');
  if (btnCloseUser) btnCloseUser.onclick = closeUserSettingsModal;

  const btnDoneUser = document.getElementById('btn-done-user-modal');
  if (btnDoneUser) btnDoneUser.onclick = closeUserSettingsModal;

  const btnCopyUser = document.getElementById('btn-copy-user-id');
  if (btnCopyUser) {
    btnCopyUser.onclick = () => {
      const val = document.getElementById('active-user-id-display').value;
      if (navigator.clipboard && val) {
        navigator.clipboard.writeText(val).then(() => {
          showToast('User ID가 복사되었습니다', 'success');
        }).catch(() => {
          showToast(val, 'info');
        });
      } else {
        showToast(val, 'info');
      }
    };
  }

  const btnRestorePrimary = document.getElementById('btn-restore-primary-user');
  if (btnRestorePrimary) {
    btnRestorePrimary.onclick = () => handleApplyCustomUserId(DEFAULT_PRIMARY_USER_ID);
  }

  const btnApplyCustom = document.getElementById('btn-apply-custom-user-id');
  if (btnApplyCustom) {
    btnApplyCustom.onclick = () => {
      const val = document.getElementById('input-custom-user-id').value;
      handleApplyCustomUserId(val);
    };
  }

  const inputCustom = document.getElementById('input-custom-user-id');
  if (inputCustom) {
    inputCustom.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCustomUserId(inputCustom.value);
      }
    };
  }

  const btnSwitchSelect = document.getElementById('btn-switch-selected-user');
  if (btnSwitchSelect) {
    btnSwitchSelect.onclick = () => {
      const val = document.getElementById('select-registered-users').value;
      handleApplyCustomUserId(val);
    };
  }

  // Close modals on background click (handling nested modals correctly)
  window.onclick = (e) => {
    if (!e.target.classList.contains('modal-backdrop')) return;

    if (e.target.id === 'modal-user-settings') {
      closeUserSettingsModal();
    } else if (e.target.id === 'modal-edit-group') {
      closeEditGroupModal();
    } else if (e.target.id === 'modal-group-delete-guard') {
      document.getElementById('modal-group-delete-guard').classList.add('hidden');
    } else if (e.target.id === 'modal-groups') {
      closeGroupsModal();
    } else if (e.target.id === 'modal-edit-holding') {
      closeEditHoldingModal();
    } else if (e.target.id === 'modal-holding-detail') {
      closeHoldingDetail();
    } else if (e.target.id === 'modal-buy') {
      closeBuyModal();
    } else {
      closeUserSettingsModal();
      closeBuyModal();
      closeHoldingDetail();
      closeEditHoldingModal();
      closeEditGroupModal();
      closeGroupsModal();
      document.getElementById('modal-group-delete-guard').classList.add('hidden');
    }
  };
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update();
    }).catch((err) => {
      console.log('Service Worker registration skipped:', err);
    });
  });
}

// Clear stale service worker caches
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key !== 'etf-portfolio-cache-v14') {
        caches.delete(key);
      }
    });
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateUserHeaderDisplay();
  setupEventListeners();
  loadDashboard();
});
