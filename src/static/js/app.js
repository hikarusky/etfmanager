/**
 * KRX ETF Portfolio Management App - Client Engine
 */

// Global Application State
const state = {
  dashboard: null,
  groups: [],
  activeGroupId: null, // null means "전체"
  currentSort: 'valuation_desc',
  selectedHolding: null,
  selectedETF: null,
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
  if (num > 0) return '#E12343'; // Korean Red
  if (num < 0) return '#1763B6'; // Korean Blue
  return '#94A3B8'; // Neutral Gray
}

function getPnlClass(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num > 0) return 'text-krx-red';
  if (num < 0) return 'text-krx-blue';
  return 'text-slate-400';
}

function showToast(message, type = 'info') {
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
  
  toast.className = `p-3 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md animate-slide-up pointer-events-auto transition-all ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;
  
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Data Fetching & Sync
async function loadDashboard() {
  try {
    const res = await fetch('/api/v1/dashboard');
    if (!res.ok) throw new Error('대시보드 데이터를 불러오지 못했습니다.');
    state.dashboard = await res.json();
    state.groups = state.dashboard.groups || [];
    renderApp();
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function syncMarketPrices() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  
  const refreshIcon = document.getElementById('icon-refresh');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');
  showToast('KRX 일별 종가 시세를 갱신 중입니다...', 'info');

  try {
    const res = await fetch('/api/v1/sync/prices', { method: 'POST' });
    const result = await res.json();
    
    if (result.status === 'success') {
      showToast(`시세 동기화 완료 (${result.count}건 갱신)`, 'success');
    } else {
      showToast(result.message || '시세 동기화 결과가 없습니다.', 'warning');
    }
    await loadDashboard();
  } catch (err) {
    console.error(err);
    showToast('시세 동기화 중 오류가 발생했습니다.', 'error');
  } finally {
    state.isSyncing = false;
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
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
      <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'}">${grp.holdings.length}</span>
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

    const pnlEl = document.getElementById('single-acc-pnl');
    const pnlVal = parseFloat(grp.pnl || 0);
    const returnVal = parseFloat(grp.return_rate || 0);
    pnlEl.textContent = formatPercent(returnVal);
    pnlEl.className = `text-xs font-bold num-tabular ${getPnlClass(pnlVal)}`;
  }
}

function getSortedFilteredHoldings() {
  let list = [];
  if (state.activeGroupId === null) {
    list = [...(state.dashboard.all_holdings || [])];
  } else {
    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    list = grp ? [...grp.holdings] : [];
  }

  // Sort
  switch (state.currentSort) {
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
    listContainer.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  listContainer.innerHTML = '';

  holdings.forEach((h) => {
    const pnlNum = parseFloat(h.pnl || 0);
    const returnNum = parseFloat(h.return_rate || 0);
    const changeNum = parseFloat(h.change_rate || 0);
    const pnlClass = getPnlClass(pnlNum);
    const changeClass = getPnlClass(changeNum);

    const card = document.createElement('div');
    card.className = 'bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600/80 rounded-2xl p-4 transition-all shadow-sm cursor-pointer touch-active';
    
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-1.5">
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
        <p class="text-[11px] text-slate-400 num-tabular mt-0.5">
          보유 <strong class="text-slate-200">${formatNumber(h.quantity)}주</strong> · 평단 <strong class="text-slate-200">${formatWon(h.avg_price)}</strong>
        </p>
      </div>

      <div class="pt-2.5 border-t border-slate-700/60 flex justify-between items-center text-xs">
        <div>
          <span class="text-[10px] text-slate-400 block">평가금액</span>
          <span class="font-extrabold text-white num-tabular text-sm">${formatWon(h.valuation_amount)}</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400 block">평가손익 (수익률)</span>
          <span class="font-extrabold num-tabular text-sm ${pnlClass}">
            ${pnlNum > 0 ? '+' : ''}${formatWon(pnlNum)} (${formatPercent(returnNum)})
          </span>
        </div>
      </div>
    `;

    card.onclick = () => openHoldingDetail(h);
    listContainer.appendChild(card);
  });
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
    const res = await fetch(`/api/v1/etfs/${holding.ticker}`);
    if (res.ok) {
      const etfDetail = await res.json();
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
    const res = await fetch(`/api/v1/etfs/search?q=${encodeURIComponent(query)}&limit=25`);
    if (!res.ok) throw new Error('검색 실패');
    const results = await res.json();

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

    const res = await fetch('/api/v1/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '매수 등록에 실패했습니다.');
    }

    const savedHolding = await res.json();
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
    const res = await fetch(`/api/v1/holdings/${state.selectedHolding.holding_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avg_price: avgPrice,
        quantity: quantity,
        memo: memo ? memo.trim() : null,
      }),
    });

    if (!res.ok) throw new Error('수정에 실패했습니다.');
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

  try {
    const res = await fetch(`/api/v1/holdings/${holdingId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('삭제에 실패했습니다.');
    showToast('종목이 삭제되었습니다.', 'success');
    closeHoldingDetail();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
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
    item.className = 'p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center';
    
    item.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${grp.color || '#3B82F6'}"></span>
        <div>
          <span class="text-xs font-bold text-white block">${grp.name}</span>
          <span class="text-[10px] text-slate-400">${grp.account_type} · ${grp.holdings.length}종목</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-delete-group p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700" data-group-id="${grp.group_id}" data-name="${grp.name}" data-count="${grp.holdings.length}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll('.btn-delete-group').forEach((btn) => {
    btn.onclick = () => {
      handleDeleteGroupClick(btn.dataset.groupId, btn.dataset.name, parseInt(btn.dataset.count));
    };
  });
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
    const res = await fetch('/api/v1/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        account_type: typeSelect.value,
        color: colorInput.value,
        sort_order: state.groups.length + 1,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '계좌 추가 실패');
    }

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
      url += `transfer_to_group_id=${transferToGroupId}`;
    } else if (forceDelete) {
      url += `force_delete_holdings=true`;
    }

    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '계좌 삭제 실패');
    }

    showToast('계좌가 성공적으로 삭제되었습니다.', 'success');
    document.getElementById('modal-group-delete-guard').classList.add('hidden');
    if (state.activeGroupId === groupId) state.activeGroupId = null;
    await loadDashboard();
    renderGroupsList();

  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Top Navigation Actions
  document.getElementById('btn-sync-market').onclick = syncMarketPrices;
  document.getElementById('btn-open-groups').onclick = openGroupsModal;
  document.getElementById('btn-close-groups').onclick = closeGroupsModal;

  // Floating Action Button & Empty state add button
  document.getElementById('btn-open-buy').onclick = () => openBuyModal();
  document.getElementById('btn-empty-add').onclick = () => openBuyModal();
  document.getElementById('btn-quick-add-group').onclick = openGroupsModal;

  // Sort Selector
  document.getElementById('sort-selector').onchange = (e) => {
    state.currentSort = e.target.value;
    renderHoldings();
  };

  // Search & Buy Modal Events
  document.getElementById('btn-close-buy-modal').onclick = closeBuyModal;
  document.getElementById('btn-back-to-search').onclick = () => showBuyStep('search');
  document.getElementById('btn-submit-buy').onclick = submitBuyHolding;

  // Debounced Search Input
  const searchInput = document.getElementById('etf-search-input');
  searchInput.oninput = (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchETFs(e.target.value);
    }, 200);
  };

  document.getElementById('btn-clear-search').onclick = () => {
    searchInput.value = '';
    searchETFs('');
    searchInput.focus();
  };

  // Quick Chosung Chips
  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.onclick = () => {
      const q = chip.dataset.query;
      searchInput.value = q;
      searchETFs(q);
    };
  });

  // Price & Qty Form input events
  const priceInput = document.getElementById('input-buy-price');
  priceInput.oninput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = raw ? parseInt(raw).toLocaleString('ko-KR') : '';
    updateBuyFormCalculations();
  };

  const qtyInput = document.getElementById('input-buy-qty');
  qtyInput.oninput = updateBuyFormCalculations;

  document.querySelectorAll('.btn-qty-add').forEach((btn) => {
    btn.onclick = () => {
      const add = parseInt(btn.dataset.add);
      const cur = parseInt(qtyInput.value) || 0;
      qtyInput.value = cur + add;
      updateBuyFormCalculations();
    };
  });

  document.getElementById('btn-use-market-price').onclick = () => {
    if (state.selectedETF) {
      priceInput.value = formatNumber(state.selectedETF.close_price);
      updateBuyFormCalculations();
    }
  };

  // Holding Detail Sheet Events
  document.getElementById('btn-close-detail').onclick = closeHoldingDetail;
  document.getElementById('btn-detail-add-more').onclick = () => {
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
  };
  document.getElementById('btn-detail-edit').onclick = openEditHoldingModal;
  document.getElementById('btn-detail-delete').onclick = () => {
    if (state.selectedHolding) {
      deleteHolding(state.selectedHolding.holding_id);
    }
  };

  // Holding Direct Edit Modal Events
  document.getElementById('btn-close-edit-holding').onclick = closeEditHoldingModal;
  document.getElementById('btn-cancel-edit-holding').onclick = closeEditHoldingModal;
  document.getElementById('btn-save-edit-holding').onclick = saveEditHolding;

  // Group Create & Delete Guard Events
  document.getElementById('btn-create-group').onclick = createNewGroup;
  document.getElementById('new-group-color').oninput = (e) => {
    document.getElementById('color-hex-preview').textContent = e.target.value.toUpperCase();
  };

  document.getElementById('btn-cancel-group-delete').onclick = () => {
    document.getElementById('modal-group-delete-guard').classList.add('hidden');
    state.deletePendingGroupId = null;
  };

  document.getElementById('btn-confirm-transfer-delete').onclick = () => {
    const targetGroupId = document.getElementById('transfer-target-group-select').value;
    if (state.deletePendingGroupId) {
      executeDeleteGroup(state.deletePendingGroupId, targetGroupId, false);
    }
  };

  document.getElementById('btn-confirm-force-delete').onclick = () => {
    if (confirm('정말로 이 계좌의 모든 보유 종목과 거래 기록을 영구 삭제하시겠습니까?')) {
      if (state.deletePendingGroupId) {
        executeDeleteGroup(state.deletePendingGroupId, null, true);
      }
    }
  };

  // Close modals on background click
  window.onclick = (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeBuyModal();
      closeHoldingDetail();
      closeEditHoldingModal();
      closeGroupsModal();
      document.getElementById('modal-group-delete-guard').classList.add('hidden');
    }
  };
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('Service Worker registration skipped:', err);
    });
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadDashboard();
});
