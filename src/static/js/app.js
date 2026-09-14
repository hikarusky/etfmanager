/**
 * ============================================================================
 * KRX ETF Portfolio Management App - Client Engine (app.js)
 * ============================================================================
 * 
 * [app.js 핵심 구조 & index.html 코드 라인(Line) 정밀 매핑 총괄 안내]
 * ----------------------------------------------------------------------------
 * 1. [전역 상태 & 유틸리티 / 포맷터]
 *    - state: 앱 전체 데이터 상태 관리
 *    - formatWon, formatPnlWon, formatPercent, getPnlClass:
 *      [적용: index.html 전역 금액 및 수익률/등락률 텍스트 서식화]
 *    - formatHoldingDisplayName: DC/IRP 계좌 내 채권/TDF에 '(NO위험자산)' 라벨 자동 부여
 *    - showToast:
 *      [적용: index.html L1015-L1021 #toast-container] 화면 상단 토스트 알림 메시지 팝업
 * 
 * 2. [사용자 ID & 백엔드 통신 계층]
 *    - getUserId, setUserId, updateUserHeaderDisplay:
 *      [적용: index.html L108-L111 #header-user-short-id / L133-L154 #bar-user-id-input]
 *    - detectWorkingApiBase, apiFetch: FastAPI 백엔드 포트 자동 감지 및 API 호출
 *    - showDashboardErrorBanner:
 *      [적용: index.html L130 <main> 최상단 동적 삽입] 서버 연결 실패 안내 및 재시도 배너
 * 
 * 3. [데이터 조회 & 시세 동기화]
 *    - loadDashboard: 백엔드 API에서 포트폴리오 데이터를 불러와 전체 화면 렌더링 호출
 *    - syncMarketPrices:
 *      [적용: index.html L114-L118 #btn-sync-market, #sync-icon-wrapper] 시세 새로고침 회전 애니메이션
 * 
 * 4. [화면 렌더링 (UI Rendering) 엔진]
 *    - renderHeader:
 *      [적용: index.html L96-L101 #header-base-date, #header-market-badge / L168 #card-as-of-badge]
 *    - renderSummaryCard:
 *      [적용: index.html L156-L195 메인 2 총 평가금액 대시보드 카드]
 *      (#total-valuation L174, #total-invested L182, #total-pnl L188, #total-return-badge L189)
 *    - renderGroupTabs:
 *      [적용: index.html L197-L218 메인 3 계좌 그룹 탭 바] (#group-tabs-container L212)
 *    - renderAllocationOrAccountCard:
 *      - '전체' 탭 선택 시: [적용: index.html L220-L239 메인 4 자산 배분 비중 바] (#allocation-section L225)
 *      - 개별 계좌 선택 시: [적용: index.html L241-L300 메인 5 단일 계좌 요약 카드] (#single-account-section L246, 위험자산 배너 L285)
 *    - renderHoldings:
 *      [적용: index.html L302-L340 메인 6 보유 종목 섹션]
 *      (#holdings-count-badge L313, #sort-selector L317, #holdings-list L327, #holdings-empty-state L330)
 *    - saveNewHoldingsOrder: 종목 드래그 앤 드롭 정렬 순서 서버 영구 저장
 * 
 * 5. [모달 2: 보유 종목 상세 & 거래 내역]
 *    - openHoldingDetail, closeHoldingDetail:
 *      [적용: index.html L565-L680 #modal-holding-detail]
 *      (#detail-name L590, #detail-current-price L594, #detail-pnl L610, #detail-tx-list L657 등)
 * 
 * 6. [모달 1: ETF 종목 검색 & 매수 등록 플로우]
 *    - openBuyModal, closeBuyModal, showBuyStep:
 *      [적용: index.html L381-L563 #modal-buy]
 *    - searchETFs:
 *      [적용: index.html L398-L445 Step 1 검색] (#etf-search-input L407, #search-results-list L438)
 *    - selectETFForBuy, updateBuyFormCalculations, submitBuyHolding:
 *      [적용: index.html L447-L560 Step 2 매수 입력 폼]
 *      (#existing-holding-banner L466, #form-group-pills L480, #form-total-calc L526, #btn-submit-buy L556)
 * 
 * 7. [모달 3: 보유 종목 정보 직접 수정]
 *    - openEditHoldingModal, saveEditHolding:
 *      [적용: index.html L682-L723 #modal-edit-holding] (#edit-avg-price L701, #edit-quantity L705)
 *    - deleteHolding:
 *      [적용: index.html L673 #btn-detail-delete] 종목 완전 삭제
 * 
 * 8. [모달 4 & 4.5 & 5: 계좌 관리 및 삭제 안전 확인]
 *    - openGroupsModal, renderGroupsList:
 *      [적용: index.html L725-L796 #modal-groups] (#groups-list L752, #btn-create-group L788)
 *    - openEditGroupModal, saveEditGroup:
 *      [적용: index.html L798-L878 #modal-edit-group] (#edit-group-name L821, #edit-group-palette L843)
 *    - handleDeleteGroupClick, executeDeleteGroup:
 *      [적용: index.html L880-L925 #modal-group-delete-guard] 안전 삭제 다이얼로그 (이관/영구삭제)
 * 
 * 9. [모달 6 & 이벤트 리스너 통합 설정]
 *    - openUserSettingsModal, handleApplyCustomUserId:
 *      [적용: index.html L927-L1013 #modal-user-settings] (원래 계좌 복원 L976, ID 전환 L987)
 *    - setupEventListeners: 화면 상의 모든 버튼/인풋/모달 닫기 이벤트 리스너 바인딩
 * ============================================================================
 */

// ============================================================================
// [섹션 1] 전역 애플리케이션 상태 (Global Application State)
// ============================================================================
const state = {
  dashboard: null,              // 백엔드 /api/v1/dashboard 에서 수신한 전체 대시보드 데이터
  groups: [],                   // 사용자 계좌 그룹 목록 (연금저축, IRP, ISA 등)
  activeGroupId: null,          // 현재 선택된 계좌 ID (null 이면 '전체' 포트폴리오 보기)
  currentSort: localStorage.getItem('etf_sort_preference') || 'custom', // 종목 정렬 기준
  selectedHolding: null,        // 상세 모달에서 열람 중인 보유 종목 정보
  selectedETF: null,            // 매수 등록 모달에서 선택된 ETF 마스터 정보
  editingGroup: null,           // 수정 중인 계좌 그룹 객체
  isSyncing: false,             // 현재 시세 새로고침 진행 여부 플래그
  deletePendingGroupId: null,   // 삭제 진행 대기 중인 계좌 ID
};

// ============================================================================
// [섹션 2] 유틸리티 및 포맷터 함수 (Utilities & Formatters)
// 화면의 숫자, 통화 단위(₩), 손익 색상, 퍼센트(%) 표시를 전담하는 공통 함수들
// ============================================================================

/**
 * 숫자를 한국식 세자리 콤마 문자열로 변환 (예: 1234567 -> "1,234,567")
 */
function formatNumber(val) {
  if (val === null || val === undefined) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('ko-KR');
}

/**
 * 금액 앞에 '₩ ' 기호를 붙여 변환 (예: 50000 -> "₩ 50,000")
 * [적용 위치: index.html L174 #total-valuation, L182 #total-invested, L268 #single-acc-valuation 등]
 */
function formatWon(val) {
  return `₩ ${formatNumber(val)}`;
}

/**
 * 평가손익 금액을 부호(+/-)와 함께 변환 (예: 15000 -> "₩+15,000", -8000 -> "₩-8,000")
 * [적용 위치: index.html L188 #total-pnl, L276 #single-acc-pnl-amount, L610 #detail-pnl 등]
 */
function formatPnlWon(val) {
  if (val === null || val === undefined) return '₩ 0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return '₩ 0';
  const sign = num > 0 ? '+' : '-';
  return `₩${sign}${formatNumber(Math.abs(num))}`;
}

/**
 * 소수점 2자리 백분율(%) 문자열로 변환 (예: 5.234 -> "+5.23%", -1.2 -> "-1.20%")
 * [적용 위치: index.html L189 #total-return-badge, L280 #single-acc-return-rate, L598 #detail-change-rate 등]
 */
function formatPercent(val) {
  if (val === null || val === undefined) return '0.00%';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00%';
  const fixed = num.toFixed(2);
  if (fixed === '-0.00' || fixed === '0.00') return '0.00%';
  const sign = num > 0 ? '+' : '';
  return `${sign}${fixed}%`;
}

/**
 * 손익에 따른 HEX 컬러 코드 반환 (수익: 빨강 #D0374C / 손실: 파랑 #60A5FA / 보합: 회색 #94A3B8)
 */
function getPnlColor(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num > 0) return '#D0374C'; // KRX 상승/수익 빨간색
  if (num < 0) return '#60A5FA'; // KRX 하락/손실 파란색
  return '#94A3B8'; // 보합 회색
}

/**
 * 손익에 따른 Tailwind CSS 텍스트 컬러 클래스 반환
 * [적용 위치: index.html L188 #total-pnl, L610 #detail-pnl, 카드 내부 수익률 텍스트]
 */
function getPnlClass(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return 'text-slate-400';
  const fixed = num.toFixed(2);
  if (fixed === '0.00' || fixed === '-0.00') return 'text-slate-400';
  if (num > 0) return 'text-krx-red';
  if (num < 0) return 'text-krx-blue';
  return 'text-slate-400';
}

/**
 * DC / IRP 퇴직연금 계좌에서 안전자산(TDF, 채권혼합 등)에 '(NO위험자산)' 라벨을 붙여 반환
 * [적용 위치: index.html L327 #holdings-list 종목 카드 제목, L590 #detail-name]
 */
function formatHoldingDisplayName(nameKr, groupName, accountType) {
  if (!nameKr) return '';
  const isRetirement = (accountType && ['DC', 'IRP'].includes(accountType.toUpperCase())) ||
                       (groupName && (groupName.toUpperCase().includes('DC') || groupName.toUpperCase().includes('IRP')));
  if (isRetirement) {
    const upper = nameKr.toUpperCase();
    if ((upper.includes('TDF') || nameKr.includes('채권')) && !nameKr.includes('(NO위험자산)')) {
      return `${nameKr}(NO위험자산)`;
    }
  }
  return nameKr;
}

/**
 * 화면 상단 중앙에 일시적인 토스트 알림 메시지 띄우기
 * [적용 대상 코드: index.html L1015-L1021 #toast-container 컨테이너에 동적 생성]
 * @param {string} message - 표시할 안내 문구
 * @param {'info'|'success'|'error'|'warning'} type - 알림 종류
 */
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
  
  // 2.5초 후 위로 서서히 사라지며 삭제
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================================================
// [섹션 3] 사용자 계정(User ID) 식별 및 백엔드 API 연결 계층
// ============================================================================

// 기본 계정 ID 상수 (5개 계좌, 64개 보유 종목이 등록된 기본 계정)
const DEFAULT_PRIMARY_USER_ID = 'hikarusky';

/**
 * 브라우저 로컬스토리지에 저장된 현재 활성 User ID 가져오기
 */
function getUserId() {
  const STORAGE_KEY = 'etf_portfolio_user_id';
  let uid = localStorage.getItem(STORAGE_KEY);
  if (!uid || uid === 'undefined' || uid === 'null' || uid === '88ba0ed8-3940-4f81-b21b-31b1984d0f12') {
    uid = DEFAULT_PRIMARY_USER_ID;
    localStorage.setItem(STORAGE_KEY, uid);
  }
  return uid;
}

/**
 * 새로운 User ID로 변경하고 로컬스토리지 저장 및 화면 UI 반영
 */
function setUserId(newId) {
  const STORAGE_KEY = 'etf_portfolio_user_id';
  if (!newId) return;
  localStorage.setItem(STORAGE_KEY, newId.trim());
  updateUserHeaderDisplay();
}

/**
 * 상단 헤더 및 빠른 입력 바의 User ID 텍스트 갱신
 * [적용 대상 코드: index.html L108-L111 #header-user-short-id / L142 #bar-user-id-input]
 */
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

// 백엔드 API 서버 기본 주소
let activeApiBase = window.API_BASE_URL || localStorage.getItem('ETF_API_BASE') || '';

function getInitialApiBase() {
  if (activeApiBase) return activeApiBase;
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
    return '';
  }
  return 'http://localhost:8010';
}

activeApiBase = getInitialApiBase();

/**
 * 백엔드 서버 포트(8010, 8000 등) 자동 감지 및 연결 검증
 */
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
        // ETF 포트폴리오 전용 DB 연결 확인
        if (data.database === 'etf_portfolio' || data.app?.includes('ETF')) {
          activeApiBase = base;
          localStorage.setItem('ETF_API_BASE', base);
          console.log(`[ETF API] Successfully connected to backend at: ${base || 'relative path'}`);
          return base;
        }
      }
    } catch (e) {
      // 다음 포트 후보로 계속 시도
    }
  }
  return null;
}

/**
 * 백엔드 API 비동기 호출 공통 래퍼 함수 (헤더에 X-User-Id 자동 동봉)
 */
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
    // 네트워크 실패 시 백엔드 포트 자동 재탐색
    const detected = await detectWorkingApiBase();
    if (detected !== null && detected !== activeApiBase) {
      res = await doFetch(detected);
    } else {
      throw new Error(`백엔드 서버에 연결할 수 없습니다. FastAPI 서버('uv run uvicorn src.main:app') 실행 상태를 확인해주세요.`);
    }
  }

  // 404 발생 시 포트 변경 여부 재확인
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

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }

  return null;
}

/**
 * 대시보드 데이터 로드 실패 시 메인 화면 최상단에 재시도 에러 배너 노출
 * [적용 대상 코드: index.html L130 <main> 태그 최상단에 #dashboard-error-banner 동적 생성]
 */
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
          • 다른 프로세스가 포트를 사용 중이거나 백엔드가 꺼져있을 수 있습니다.<br>
          • 터미널에서 <code class="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">uv run uvicorn src.main:app</code> 실행 여부를 확인하세요.
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

// ============================================================================
// [섹션 4] 데이터 조회 및 시세 동기화 (Data Fetching & Sync)
// ============================================================================

/**
 * 백엔드 /api/v1/dashboard 로부터 최신 포트폴리오 데이터를 불러와 전체 화면 갱신
 */
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

/**
 * 상단 시세 동기화 버튼 회전 애니메이션 시작
 * [적용 대상 코드: index.html L114-L118 #btn-sync-market, #sync-icon-wrapper]
 */
function startSyncAnimation() {
  state.isSyncing = true;
  const syncBtn = document.getElementById('btn-sync-market');
  const syncWrapper = document.getElementById('sync-icon-wrapper');

  if (syncBtn) syncBtn.disabled = true;
  if (syncWrapper) {
    syncWrapper.classList.add('animate-spin');
  }
}

/**
 * 상단 시세 동기화 버튼 회전 애니메이션 완전 정지 및 아이콘 복구
 * [적용 대상 코드: index.html L114-L118 #btn-sync-market, #sync-icon-wrapper]
 */
function stopSyncAnimation() {
  state.isSyncing = false;
  const syncBtn = document.getElementById('btn-sync-market');
  const syncWrapper = document.getElementById('sync-icon-wrapper');

  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.classList.remove('animate-spin');
  }

  if (syncWrapper) {
    syncWrapper.classList.remove('animate-spin');
    syncWrapper.style.animation = 'none';

    syncWrapper.querySelectorAll('*').forEach((el) => {
      if (el && el.classList && typeof el.classList.remove === 'function') {
        el.classList.remove('animate-spin');
      }
    });

    // 아이콘 마크업 재설정 및 회전 상태 초기화
    syncWrapper.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5"></i>';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

/**
 * [새로고침 버튼 동작] KRX 최신 시세를 수집·갱신하고 대시보드를 새로고침
 * [적용 대상 코드: index.html L114-L118 #btn-sync-market 클릭 시 호출]
 */
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
    stopSyncAnimation();
  }

  // 동기화 완료 후 대시보드 화면 최신화
  try {
    await loadDashboard();
  } catch (err) {
    console.error('loadDashboard after sync failed:', err);
  }
}

// ============================================================================
// [섹션 5] 화면 렌더링 로직 (Rendering Logic)
// state에 저장된 데이터를 읽어 index.html의 각 화면 영역에 값을 채워넣는 함수들
// ============================================================================

/**
 * 대시보드 전체 UI 컴포넌트 렌더링 총괄 실행
 */
function renderApp() {
  if (!state.dashboard) return;

  renderHeader();
  renderSummaryCard();
  renderGroupTabs();
  renderAllocationOrAccountCard();
  renderHoldings();

  if (window.lucide) lucide.createIcons();
}

/**
 * [화면 영역: 2. 상단 네비게이션 헤더]
 * 종가 기준일자(예: 09/14 종가) 및 당일/직전영업일 확정 배지 텍스트 갱신
 * [적용 대상 코드: index.html L97-L100 #header-market-badge, #header-base-date / L168 #card-as-of-badge]
 */
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

/**
 * [화면 영역: 메인 2. 총 평가금액 요약 대시보드 카드]
 * 총 평가금액, 투자원금, 평가손익, 총 수익률 수치 및 색상(+빨강/-파랑) 반영
 * [적용 대상 코드: index.html L174 #total-valuation, L182 #total-invested, L188 #total-pnl, L189 #total-return-badge]
 */
function renderSummaryCard() {
  const summary = state.dashboard.summary;
  if (!summary) return;

  // 1) 총 평가금액 & 투자원금 (index.html L174, L182)
  document.getElementById('total-valuation').textContent = formatNumber(summary.total_valuation);
  document.getElementById('total-invested').textContent = formatWon(summary.total_invested);

  // 2) 평가손익 및 수익률 배지 (index.html L188, L189)
  const pnlEl = document.getElementById('total-pnl');
  const badgeEl = document.getElementById('total-return-badge');
  const pnlNum = parseFloat(summary.total_pnl);
  const returnRateNum = parseFloat(summary.total_return_rate);

  pnlEl.textContent = formatPnlWon(pnlNum);
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

/**
 * [화면 영역: 메인 3. 계좌 그룹 필터 탭 네비게이션]
 * '전체' 탭 및 사용자의 각 계좌(연금저축, IRP, ISA 등) 버튼을 동적으로 생성
 * [적용 대상 코드: index.html L212 #group-tabs-container]
 */
function renderGroupTabs() {
  const container = document.getElementById('group-tabs-container');
  container.innerHTML = '';

  const allHoldingsCount = (state.dashboard.all_holdings || []).length;
  const isAllActive = state.activeGroupId === null;

  // 1) "전체" 탭 버튼 생성
  const allBtn = document.createElement('button');
  allBtn.className = `px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all touch-active flex items-center gap-1.5 ${
    isAllActive
      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
  }`;
  allBtn.innerHTML = `<span>전체</span><span class="text-[10px] px-1.5 py-0.2 rounded-full ${isAllActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'}">${allHoldingsCount}</span>`;
  allBtn.onclick = () => {
    state.activeGroupId = null; // '전체' 선택
    renderApp();
  };
  container.appendChild(allBtn);

  // 2) 개별 계좌 그룹 탭 버튼들 동적 생성
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
      state.activeGroupId = grp.group_id; // 특정 계좌 선택
      renderApp();
    };
    container.appendChild(btn);
  });
}

/**
 * [화면 영역: 메인 4 vs 메인 5 교체 렌더링]
 * - '전체' 탭 활성화 시: [메인 4] 자산 배분 비중 바(#allocation-section) 노출
 * - 개별 계좌 선택 시: [메인 5] 선택된 계좌 상세 카드(#single-account-section) 노출 (DC/IRP 위험자산 비중 포함)
 * [적용 대상 코드: index.html L225 #allocation-section vs L246 #single-account-section]
 */
function renderAllocationOrAccountCard() {
  const allocationSection = document.getElementById('allocation-section');
  const singleAccountSection = document.getElementById('single-account-section');

  if (state.activeGroupId === null) {
    // =======================================================================
    // [메인 4] 전체 계좌 자산 배분 비중 막대그래프 렌더링 (index.html L220-L239)
    // =======================================================================
    allocationSection.classList.remove('hidden');
    singleAccountSection.classList.add('hidden');

    const totalValuation = parseFloat(state.dashboard.summary.total_valuation || 0);
    const totalCount = (state.dashboard.all_holdings || []).length;
    document.getElementById('allocation-total-count').textContent = `총 ${totalCount}종목`; // index.html L229

    const barContainer = document.getElementById('allocation-bar'); // index.html L232
    const legendContainer = document.getElementById('allocation-legend'); // index.html L236
    barContainer.innerHTML = '';
    legendContainer.innerHTML = '';

    if (totalValuation <= 0 || state.groups.length === 0) {
      barContainer.innerHTML = '<div class="w-full h-full bg-slate-700/60 rounded-full"></div>';
      legendContainer.innerHTML = '<span class="text-slate-500 text-xs">보유 자산이 없습니다.</span>';
      return;
    }

    // 각 계좌별 비중만큼 가로 세그먼트 막대 및 하단 범례 추가
    state.groups.forEach((grp) => {
      const val = parseFloat(grp.valuation_amount || 0);
      const weight = parseFloat(grp.weight_percent || 0);
      if (val > 0) {
        // 배분 막대 세그먼트
        const seg = document.createElement('div');
        seg.className = 'h-full transition-all duration-300';
        seg.style.width = `${weight}%`;
        seg.style.backgroundColor = grp.color || '#3B82F6';
        seg.title = `${grp.name}: ${weight}%`;
        barContainer.appendChild(seg);

        // 하단 범례 알약 표시
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
    // =======================================================================
    // [메인 5] 선택된 단일 계좌 상세 요약 카드 렌더링 (index.html L241-L300)
    // =======================================================================
    allocationSection.classList.add('hidden');
    singleAccountSection.classList.remove('hidden');

    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    if (!grp) return;

    // 계좌명, 유형, 태그 색상, 비중 (index.html L250-L255)
    document.getElementById('single-acc-name').textContent = grp.name;
    document.getElementById('single-acc-type').textContent = grp.account_type;
    document.getElementById('single-acc-color-dot').style.backgroundColor = grp.color || '#3B82F6';
    document.getElementById('single-acc-weight').textContent = `비중 ${(parseFloat(grp.weight_percent) || 0).toFixed(1)}%`;
    document.getElementById('single-acc-valuation').textContent = formatWon(grp.valuation_amount); // index.html L268
    document.getElementById('single-acc-invested').textContent = formatWon(grp.invested_amount);   // index.html L272

    const pnlVal = parseFloat(grp.pnl || 0);
    const returnVal = parseFloat(grp.return_rate || 0);
    const pnlClass = getPnlClass(pnlVal);

    // 1) 수익금 (평가손익) (index.html L276 #single-acc-pnl-amount)
    const pnlAmountEl = document.getElementById('single-acc-pnl-amount');
    if (pnlAmountEl) {
      pnlAmountEl.textContent = formatPnlWon(pnlVal);
      pnlAmountEl.className = `text-xs font-bold num-tabular truncate block ${pnlClass}`;
    }

    // 2) 수익률 (index.html L280 #single-acc-return-rate)
    const returnRateEl = document.getElementById('single-acc-return-rate') || document.getElementById('single-acc-pnl');
    if (returnRateEl) {
      returnRateEl.textContent = formatPercent(returnVal);
      returnRateEl.className = `text-xs font-bold num-tabular truncate block ${pnlClass}`;
    }

    // 3) 퇴직연금(DC / IRP) 계좌의 위험자산 vs NO위험자산 비중 계산 및 배너 표시 (index.html L285-L299)
    const riskBreakdownEl = document.getElementById('single-acc-risk-breakdown');
    const riskAmountEl = document.getElementById('single-acc-risk-amount');       // index.html L289
    const nonRiskAmountEl = document.getElementById('single-acc-non-risk-amount'); // index.html L295

    const isRetirement = (grp.account_type && ['DC', 'IRP'].includes(grp.account_type.toUpperCase())) ||
                         (grp.name && (grp.name.toUpperCase().includes('DC') || grp.name.toUpperCase().includes('IRP')));

    if (riskBreakdownEl) {
      if (isRetirement) {
        let riskVal = 0;
        let nonRiskVal = 0;

        if (grp.risk_amount != null && grp.non_risk_amount != null) {
          riskVal = parseFloat(grp.risk_amount || 0);
          nonRiskVal = parseFloat(grp.non_risk_amount || 0);
        } else {
          (grp.holdings || []).forEach((h) => {
            const v = parseFloat(h.valuation_amount || 0);
            const name = h.name_kr || '';
            const isNonRisk = name.includes('(NO위험자산)') || name.includes('NO위험자산') ||
                              name.toUpperCase().includes('TDF') || name.includes('채권');
            if (isNonRisk) {
              nonRiskVal += v;
            } else {
              riskVal += v;
            }
          });
        }

        const riskRatioEl = document.getElementById('single-acc-risk-ratio');         // index.html L290
        const nonRiskRatioEl = document.getElementById('single-acc-non-risk-ratio'); // index.html L296

        let rRatioVal = 0;
        let nrRatioVal = 0;

        if (grp.risk_ratio != null && grp.non_risk_ratio != null) {
          rRatioVal = parseFloat(grp.risk_ratio || 0);
          nrRatioVal = parseFloat(grp.non_risk_ratio || 0);
        } else {
          const totalAsset = riskVal + nonRiskVal;
          if (totalAsset > 0) {
            rRatioVal = (riskVal / totalAsset) * 100;
            nrRatioVal = (nonRiskVal / totalAsset) * 100;
          }
        }

        if (riskAmountEl) riskAmountEl.textContent = formatNumber(Math.round(riskVal));
        if (riskRatioEl) riskRatioEl.textContent = `(${rRatioVal.toFixed(2)}%)`;
        if (nonRiskAmountEl) nonRiskAmountEl.textContent = formatNumber(Math.round(nonRiskVal));
        if (nonRiskRatioEl) nonRiskRatioEl.textContent = `(${nrRatioVal.toFixed(2)}%)`;
        riskBreakdownEl.classList.remove('hidden');
      } else {
        riskBreakdownEl.classList.add('hidden');
      }
    }
  }
}

// 드래그 앤 드롭 상태 변수
let draggedHoldingCard = null;
let isDraggingHolding = false;

/**
 * 선택된 계좌 필터 및 정렬 기준(평가금액순, 수익률순, 이름순 등)에 따라 종목 목록 정렬
 * [적용 대상 코드: index.html L317-L323 #sort-selector]
 */
function getSortedFilteredHoldings() {
  let list = [];
  if (state.activeGroupId === null) {
    list = [...(state.dashboard?.all_holdings || [])];
  } else {
    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    list = grp ? [...(grp.holdings || [])] : [];
  }

  // 정렬 옵션 처리
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

/**
 * [화면 영역: 메인 6. 보유 종목 리스트 섹션]
 * 보유 종목 카드 목록 동적 렌더링 (카드 클릭 시 상세 모달 #modal-holding-detail 호출)
 * 및 PC/모바일 드래그 앤 드롭 순서 변경 이벤트 핸들러 바인딩
 * [적용 대상 코드: index.html L313 #holdings-count-badge / L327 #holdings-list / L330 #holdings-empty-state]
 */
function renderHoldings() {
  const holdings = getSortedFilteredHoldings();
  const listContainer = document.getElementById('holdings-list');         // index.html L327
  const countBadge = document.getElementById('holdings-count-badge');     // index.html L313
  const emptyState = document.getElementById('holdings-empty-state');     // index.html L330

  countBadge.textContent = holdings.length;

  // 종목이 없을 때 빈 화면(Empty state) 처리 (index.html L330-L339)
  if (holdings.length === 0) {
    listContainer.innerHTML = '';
    listContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  listContainer.classList.remove('hidden');
  listContainer.innerHTML = '';

  // 각 보유 종목 카드 렌더링
  holdings.forEach((h) => {
    const pnlNum = parseFloat(h.pnl || 0);
    const returnNum = parseFloat(h.return_rate || 0);
    const changeNum = parseFloat(h.change_rate || 0) * 100;
    const pnlClass = getPnlClass(pnlNum);
    const changeClass = getPnlClass(changeNum);
    const investedAmount = h.invested_amount != null ? h.invested_amount : (parseFloat(h.avg_price || 0) * parseInt(h.quantity || 0));

    const card = document.createElement('div');
    card.className = 'holding-drag-item bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600/80 rounded-2xl p-4 transition-all shadow-sm cursor-pointer';
    card.setAttribute('draggable', 'true');
    card.dataset.holdingId = h.holding_id;

    // =======================================================================
    // [카드 내부 UI] 드래그 손잡이, 계좌 태그, 티커, 현재가, 종목명, 보유주수/평단가, 평가금액, 평가손익
    // =======================================================================
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-1.5">
          <!-- 드래그 정렬 손잡이 아이콘 -->
          <div class="drag-handle text-slate-500 hover:text-slate-300 p-1 -ml-1 rounded transition-colors" title="드래그하여 순서 변경">
            <i data-lucide="grip-vertical" class="w-4 h-4"></i>
          </div>
          <!-- 소속 계좌 태그 뱃지 -->
          <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold text-white shadow-xs" style="background-color: ${h.group_color || '#3B82F6'}">
            ${h.group_name || '기본'}
          </span>
          <!-- 6자리 종목코드 -->
          <span class="text-xs font-mono text-slate-400 font-semibold">${h.ticker}</span>
        </div>
        <!-- 현재가 및 전일대비 등락률 -->
        <div class="flex items-center gap-1 text-right">
          <span class="text-xs font-extrabold text-white num-tabular">현재가 : ${formatWon(h.close_price)}</span>
          <span class="text-[10px] font-bold num-tabular px-1 py-0.2 rounded ${changeClass} bg-slate-900/60">
            ${formatPercent(changeNum)}
          </span>
        </div>
      </div>

      <!-- 종목명 및 수량/평단가/원금 -->
      <div class="mb-3">
        <h3 class="text-sm font-bold text-white tracking-tight leading-snug line-clamp-1">${formatHoldingDisplayName(h.name_kr, h.group_name, h.account_type)}</h3>
        <p class="text-[13px] text-slate-300 num-tabular mt-1 leading-relaxed">
          <span class="whitespace-nowrap">보유 <strong class="text-white font-semibold">${formatNumber(h.quantity)}주</strong></span>
          <span class="whitespace-nowrap"> · 평단 <strong class="text-white font-semibold">${formatWon(h.avg_price)}</strong></span>
          <span class="whitespace-nowrap"> · 원금 <strong class="text-white font-semibold">${formatWon(investedAmount)}</strong></span>
        </p>
      </div>

      <!-- 평가금액 및 평가손익(수익률) 2열 요약 -->
      <div class="pt-2.5 border-t border-slate-700/60 flex justify-between items-center text-sm">
        <div>
          <span class="text-xs font-bold text-slate-100 block mb-0.5">평가금액</span>
          <span class="font-black text-white num-tabular text-base tracking-tight">${formatWon(h.valuation_amount)}</span>
        </div>
        <div class="text-right">
          <span class="text-xs font-bold text-slate-100 block mb-0.5">평가손익 (수익률)</span>
          <span class="font-black num-tabular text-base tracking-tight ${pnlClass}">
            ${formatPnlWon(pnlNum)} (${formatPercent(returnNum)})
          </span>
        </div>
      </div>
    `;

    // 카드 클릭 시 [모달 2] 상세 정보 및 거래내역 모달 열기 (index.html L565-L680 #modal-holding-detail)
    card.onclick = (e) => {
      if (isDraggingHolding) return;
      if (e.target.closest('.drag-handle')) return;
      openHoldingDetail(h);
    };

    // 데스크톱 마우스 드래그 이벤트 (순서 변경 시작/종료)
    card.addEventListener('dragstart', (e) => {
      isDraggingHolding = true;
      draggedHoldingCard = card;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', h.holding_id);
      setTimeout(() => {
        card.classList.add('is-dragging');
      }, 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedHoldingCard = null;
      setTimeout(() => {
        isDraggingHolding = false;
      }, 120);
    });

    // 모바일 터치 드래그 지원 (손잡이 터치 시)
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

/**
 * 드래그로 변경된 종목 순서를 백엔드 API에 영구 저장
 */
async function saveNewHoldingsOrder(newOrderedIds) {
  if (!newOrderedIds || newOrderedIds.length <= 1) return;

  // 1) 정렬 방식을 자동으로 '사용자 지정순'으로 전환 (index.html L317 #sort-selector)
  if (state.currentSort !== 'custom') {
    state.currentSort = 'custom';
    localStorage.setItem('etf_sort_preference', 'custom');
    const sortSel = document.getElementById('sort-selector');
    if (sortSel) sortSel.value = 'custom';
  }

  // 2) 로컬 state에 순서 즉시 반영 (낙관적 업데이트)
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

  // 3) 백엔드 API 호출로 순서 영구 저장
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

// ============================================================================
// [섹션 6] 모달 2: 보유 종목 상세 & 거래 이력 (Holding Detail Modal)
// 보유 종목 클릭 시 올라오는 바텀시트
// [적용 대상 코드: index.html L565-L680 #modal-holding-detail]
// ============================================================================

/**
 * 종목 상세 바텀시트 모달 열기 및 데이터 바인딩
 * [적용 대상 코드: index.html L574-L677 #modal-holding-detail 내 각 표시 필드]
 */
async function openHoldingDetail(holding) {
  state.selectedHolding = holding;

  // 헤더: 소속 계좌 배지, 종목코드 (index.html L577, L578)
  document.getElementById('detail-group-badge').textContent = holding.group_name || '계좌';
  document.getElementById('detail-group-badge').style.backgroundColor = holding.group_color || '#3B82F6';
  document.getElementById('detail-ticker').textContent = holding.ticker;
  // 종목명 및 현재가 (index.html L590, L594)
  document.getElementById('detail-name').textContent = formatHoldingDisplayName(holding.name_kr, holding.group_name, holding.account_type);
  document.getElementById('detail-current-price').textContent = formatWon(holding.close_price);

  // 전일 종가 대비 등락률 (index.html L598 #detail-change-rate)
  const changeNum = parseFloat(holding.change_rate || 0) * 100;
  const changeEl = document.getElementById('detail-change-rate');
  changeEl.textContent = formatPercent(changeNum);
  changeEl.className = `text-xs font-bold num-tabular ${getPnlClass(changeNum)}`;

  // 평가손익 및 수익률 (index.html L610 #detail-pnl, L611 #detail-return-rate)
  const pnlNum = parseFloat(holding.pnl || 0);
  const returnNum = parseFloat(holding.return_rate || 0);
  const pnlEl = document.getElementById('detail-pnl');
  const returnEl = document.getElementById('detail-return-rate');
  pnlEl.textContent = formatPnlWon(pnlNum);
  pnlEl.className = `text-base font-bold num-tabular ${getPnlClass(pnlNum)}`;
  returnEl.textContent = `(${formatPercent(returnNum)})`;
  returnEl.className = `text-xs font-bold num-tabular ml-1 ${getPnlClass(pnlNum)}`;

  // 평가금액, 투자원금, 수량, 평단가 (index.html L617, L621, L625, L629)
  document.getElementById('detail-valuation').textContent = formatWon(holding.valuation_amount);
  document.getElementById('detail-invested').textContent = formatWon(holding.invested_amount);
  document.getElementById('detail-qty').textContent = `${formatNumber(holding.quantity)}주`;
  document.getElementById('detail-avg-price').textContent = formatWon(holding.avg_price);

  // ETF 스펙: 운용사 정보 (index.html L638 #detail-issuer)
  document.getElementById('detail-issuer').textContent = holding.issuer || '-';

  // ETF 마스터 상세 조회 (순자산 AUM, 총보수율) (index.html L642 #detail-aum, L646 #detail-expense)
  try {
    const etfDetail = await apiFetch(`/api/v1/etfs/${holding.ticker}`);
    if (etfDetail) {
      document.getElementById('detail-aum').textContent = etfDetail.aum ? `₩ ${formatNumber(etfDetail.aum)}억` : '-';
      if (etfDetail.expense_ratio != null) {
        const expPct = parseFloat(etfDetail.expense_ratio) * 100;
        const formattedExp = expPct < 0.01 ? `${expPct.toFixed(3)}%` : `${expPct.toFixed(2)}%`;
        document.getElementById('detail-expense').textContent = formattedExp;
      } else {
        document.getElementById('detail-expense').textContent = '-';
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 과거 매수 거래 내역 리스트 채우기 (index.html L653 #detail-tx-count, L657 #detail-tx-list)
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

// ============================================================================
// [섹션 7] 모달 1: ETF 종목 검색 및 매수 등록 플로우 (Search & Buy Flow)
// 1단계: 검색(#buy-step-search) -> 2단계: 매수 정보 입력(#buy-step-form)
// [적용 대상 코드: index.html L381-L563 #modal-buy]
// ============================================================================

let searchDebounceTimer = null;

/**
 * 매수 기록 모달 열기 (종목이 미리 지정되어 있으면 바로 2단계로 진입)
 * [적용 대상 코드: index.html L386 #modal-buy]
 */
function openBuyModal(prefilledETF = null, prefilledGroupId = null) {
  const modal = document.getElementById('modal-buy');
  modal.classList.remove('hidden');

  if (prefilledETF) {
    selectETFForBuy(prefilledETF, prefilledGroupId);
  } else {
    showBuyStep('search');
    const searchInput = document.getElementById('etf-search-input'); // index.html L407
    searchInput.value = '';
    searchInput.focus();
    searchETFs('');
  }
}

function closeBuyModal() {
  document.getElementById('modal-buy').classList.add('hidden');
  state.selectedETF = null;
}

/**
 * 모달 내부 화면 전환: 'search'(1단계 검색 L401) vs 'form'(2단계 매수입력 L450)
 * [적용 대상 코드: index.html L401 #buy-step-search vs L450 #buy-step-form]
 */
function showBuyStep(step) {
  const searchStep = document.getElementById('buy-step-search'); // index.html L401
  const formStep = document.getElementById('buy-step-form');     // index.html L450
  const title = document.getElementById('buy-modal-title');       // index.html L392

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

/**
 * [모달 1 - Step 1] ETF 실시간 초성/티커/종목명 검색 실행
 * [적용 대상 코드: index.html L407 #etf-search-input / L436 #search-result-count / L438 #search-results-list]
 */
async function searchETFs(query) {
  const list = document.getElementById('search-results-list');   // index.html L438
  const countEl = document.getElementById('search-result-count'); // index.html L436
  const clearBtn = document.getElementById('btn-clear-search');  // index.html L414

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
      
      const changeNum = parseFloat(etf.change_rate || 0) * 100;
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

/**
 * [모달 1 - Step 2로 전환] 검색된 종목을 선택했을 때 매수 입력 폼으로 넘어가며 초기값 세팅
 * [적용 대상 코드: index.html L452-L463 (#form-ticker, #form-name 등) / L497 #input-buy-price / L507 #input-buy-qty]
 */
function selectETFForBuy(etf, prefilledGroupId = null) {
  state.selectedETF = etf;
  showBuyStep('form');

  // 선택 종목 요약 카드 세팅 (index.html L455-L463)
  document.getElementById('form-ticker').textContent = etf.ticker;
  document.getElementById('form-issuer').textContent = etf.issuer || '';
  document.getElementById('form-name').textContent = etf.name_kr;
  document.getElementById('form-close-price').textContent = formatWon(etf.close_price);

  // 폼 입력값 초기화 (index.html L497, L507, L535, L542)
  const priceInput = document.getElementById('input-buy-price');
  priceInput.value = formatNumber(etf.close_price);

  const qtyInput = document.getElementById('input-buy-qty');
  qtyInput.value = '1';

  const dateInput = document.getElementById('input-buy-date');
  dateInput.value = new Date().toISOString().split('T')[0];

  const memoInput = document.getElementById('input-buy-memo');
  memoInput.value = '';

  // 계좌 선택 알약 버튼들 렌더링
  renderBuyGroupPills(prefilledGroupId);
  updateBuyFormCalculations();
}

/**
 * [모달 1 - Step 2] 매수할 계좌 선택 알약(Pill) 버튼 렌더링
 * [적용 대상 코드: index.html L480 #form-group-pills]
 */
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

/**
 * [모달 1 - Step 2] 선택한 계좌에 이미 보유 중인 종목인지 확인하고 가중평균 안내 배너 노출
 * [적용 대상 코드: index.html L466-L475 #existing-holding-banner, #existing-holding-desc]
 */
function checkExistingHoldingBanner(groupId) {
  const banner = document.getElementById('existing-holding-banner'); // index.html L466
  const desc = document.getElementById('existing-holding-desc');     // index.html L472
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

/**
 * [모달 1 - Step 2] 단가와 수량을 곱해 '총 매수 예상 금액' 실시간 계산
 * [적용 대상 코드: index.html L526 #form-total-calc]
 */
function updateBuyFormCalculations() {
  const priceStr = document.getElementById('input-buy-price').value.replace(/[^0-9]/g, '');
  const qtyStr = document.getElementById('input-buy-qty').value;

  const price = parseInt(priceStr) || 0;
  const qty = parseInt(qtyStr) || 0;
  const total = price * qty;

  document.getElementById('form-total-calc').textContent = formatWon(total); // index.html L526
}

/**
 * [모달 1 - Step 2 완료 버튼] 매수 정보를 백엔드 API(/api/v1/holdings)로 전송하여 저장
 * [적용 대상 코드: index.html L556 #btn-submit-buy]
 */
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

  const submitBtn = document.getElementById('btn-submit-buy'); // index.html L556
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

// ============================================================================
// [섹션 8] 모달 3: 보유 종목 정보 직접 수정 모달 (Edit Holding Modal)
// [적용 대상 코드: index.html L682-L723 #modal-edit-holding]
// ============================================================================

/**
 * 보유 정보(평단가, 수량, 메모) 직접 수정 팝업 열기
 * [적용 대상 코드: index.html L701 #edit-avg-price, L705 #edit-quantity, L709 #edit-memo]
 */
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

/**
 * 수정한 평단가/수량/메모를 서버에 PATCH 요청으로 저장
 * [적용 대상 코드: index.html L718 #btn-save-edit-holding]
 */
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

/**
 * 종목 완전 삭제 처리
 * [적용 대상 코드: index.html L673 #btn-detail-delete]
 */
async function deleteHolding(holdingId) {
  if (!confirm('이 종목을 포트폴리오에서 삭제하시겠습니까? (거래 내역도 함께 삭제됩니다)')) {
    return;
  }

  const deleteBtn = document.getElementById('btn-detail-delete'); // index.html L673
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

// ============================================================================
// [섹션 9] 모달 4 & 4.5 & 5: 계좌 관리, 정보 수정, 안전 삭제 다이얼로그
// ============================================================================

/**
 * [모달 4.5] 계좌 정보 수정 모달 열기 (이름, 계좌 유형, 태그 색상 변경)
 * [적용 대상 코드: index.html L798-L878 #modal-edit-group]
 */
function openEditGroupModal(grp) {
  if (!grp) return;
  state.editingGroup = grp;

  const nameInput = document.getElementById('edit-group-name');               // index.html L821
  const typeSelect = document.getElementById('edit-group-type');             // index.html L826
  const colorInput = document.getElementById('edit-group-color');             // index.html L839
  const colorHex = document.getElementById('edit-group-color-hex');           // index.html L840
  const colorDot = document.getElementById('edit-group-color-dot');           // index.html L808
  const holdingsCountEl = document.getElementById('edit-group-holdings-count'); // index.html L859
  const valuationEl = document.getElementById('edit-group-valuation');       // index.html L863

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

/**
 * [모달 4.5] 수정한 계좌 정보를 서버에 저장
 * [적용 대상 코드: index.html L873 #btn-save-edit-group]
 */
async function saveEditGroup() {
  if (!state.editingGroup) return;

  const nameInput = document.getElementById('edit-group-name');   // index.html L821
  const typeSelect = document.getElementById('edit-group-type'); // index.html L826
  const colorInput = document.getElementById('edit-group-color'); // index.html L839

  const newName = nameInput.value.trim();
  if (!newName) {
    showToast('계좌명을 입력해주세요.', 'warning');
    nameInput.focus();
    return;
  }

  const newType = typeSelect.value;
  const newColor = colorInput.value;

  const saveBtn = document.getElementById('btn-save-edit-group'); // index.html L873
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

/**
 * [모달 4] 계좌 그룹 관리 바텀시트 열기
 * [적용 대상 코드: index.html L725-L796 #modal-groups]
 */
function openGroupsModal() {
  renderGroupsList();
  document.getElementById('modal-groups').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeGroupsModal() {
  document.getElementById('modal-groups').classList.add('hidden');
}

/**
 * [모달 4 내부] 등록된 전체 계좌 목록 카드 동적 렌더링
 * [적용 대상 코드: index.html L752 #groups-list]
 */
function renderGroupsList() {
  const list = document.getElementById('groups-list'); // index.html L752
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
        <!-- 계좌 수정 버튼 -->
        <button class="btn-edit-group p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors" title="계좌 수정" data-group-id="${grp.group_id}">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
        </button>
        <!-- 계좌 삭제 버튼 -->
        <button class="btn-delete-group p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="계좌 삭제" data-group-id="${grp.group_id}" data-name="${grp.name}" data-count="${(grp.holdings || []).length}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    // 행 클릭 시 수정 모달 오픈
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

/**
 * [모달 4 하단] 새 계좌 추가 폼 제출 처리
 * [적용 대상 코드: index.html L762 #new-group-name / L769 #new-group-type / L781 #new-group-color / L788 #btn-create-group]
 */
async function createNewGroup() {
  const nameInput = document.getElementById('new-group-name');   // index.html L762
  const typeSelect = document.getElementById('new-group-type'); // index.html L769
  const colorInput = document.getElementById('new-group-color'); // index.html L781

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

/**
 * [모달 5] 계좌 삭제 클릭 시 안전장치 분기 처리
 * - 보유 종목이 0개: 바로 확인 후 삭제
 * - 보유 종목이 1개 이상: [모달 5 #modal-group-delete-guard] 안전 다이얼로그 오픈 (이관 후 삭제 or 영구 삭제)
 * [적용 대상 코드: index.html L880-L925 #modal-group-delete-guard]
 */
function handleDeleteGroupClick(groupId, groupName, holdingCount) {
  state.deletePendingGroupId = groupId;

  if (holdingCount === 0) {
    if (confirm(`'${groupName}' 계좌를 삭제하시겠습니까?`)) {
      executeDeleteGroup(groupId);
    }
  } else {
    const modal = document.getElementById('modal-group-delete-guard'); // index.html L887
    document.getElementById('delete-guard-desc').innerHTML = `<strong>'${groupName}'</strong> 계좌에 <strong>${holdingCount}개</strong>의 보유 종목이 있습니다.<br>종목을 다른 계좌로 안전하게 이관하시겠습니까?`; // index.html L895

    // 이관 대상 계좌 셀렉트박스 옵션 채우기 (index.html L903 #transfer-target-group-select)
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

/**
 * 계좌 실제 삭제 API 호출 실행
 * [적용 대상 코드: index.html L906 #btn-confirm-transfer-delete / L914 #btn-confirm-force-delete]
 */
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

// ============================================================================
// [섹션 10] 이벤트 리스너 통합 설정 (Setup Event Listeners)
// HTML 요소와 JavaScript 핸들러 함수를 1:1로 연결
// ============================================================================
function setupEventListeners() {
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  // -------------------------------------------------------------------------
  // [메인 1] User ID 직접 입력 바 이벤트
  // [적용 대상 코드: index.html L142 #bar-user-id-input, L146 #btn-bar-apply-user, L150 #btn-bar-open-user-modal]
  // -------------------------------------------------------------------------
  bindClick('btn-bar-apply-user', () => {
    const barInput = document.getElementById('bar-user-id-input'); // index.html L142
    if (barInput) handleApplyCustomUserId(barInput.value);
  });

  bindClick('btn-bar-open-user-modal', openUserSettingsModal); // index.html L150

  const barInputEl = document.getElementById('bar-user-id-input');
  if (barInputEl) {
    barInputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCustomUserId(barInputEl.value);
      }
    };
  }

  // -------------------------------------------------------------------------
  // [상단 헤더 및 빠른 액션 버튼들]
  // [적용 대상 코드: index.html L114 #btn-sync-market, L121 #btn-open-groups, L737 #btn-close-groups]
  // -------------------------------------------------------------------------
  bindClick('btn-sync-market', syncMarketPrices); // index.html L114
  bindClick('btn-open-groups', openGroupsModal);   // index.html L121
  bindClick('btn-close-groups', closeGroupsModal); // index.html L737

  // 하단 플로팅 매수 버튼 & 빈 상태 매수 버튼 (index.html L367 #btn-open-buy, L336 #btn-empty-add, L206 #btn-quick-add-group)
  bindClick('btn-open-buy', () => openBuyModal());
  bindClick('btn-empty-add', () => openBuyModal());
  bindClick('btn-quick-add-group', openGroupsModal);

  // -------------------------------------------------------------------------
  // [메인 6] 정렬 셀렉트박스 변경 이벤트
  // [적용 대상 코드: index.html L317-L323 #sort-selector]
  // -------------------------------------------------------------------------
  const sortSelector = document.getElementById('sort-selector');
  if (sortSelector) {
    sortSelector.value = state.currentSort;
    sortSelector.onchange = (e) => {
      state.currentSort = e.target.value;
      localStorage.setItem('etf_sort_preference', state.currentSort);
      renderHoldings();
    };
  }

  // -------------------------------------------------------------------------
  // [메인 6] 보유 종목 리스트 데스크톱 드래그 앤 드롭 재정렬 영역 이벤트
  // [적용 대상 코드: index.html L327 #holdings-list]
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // [모달 1] ETF 검색 및 매수 등록 창 이벤트
  // [적용 대상 코드: index.html L393 #btn-close-buy-modal, L553 #btn-back-to-search, L556 #btn-submit-buy]
  // -------------------------------------------------------------------------
  bindClick('btn-close-buy-modal', closeBuyModal);
  bindClick('btn-back-to-search', () => showBuyStep('search'));
  bindClick('btn-submit-buy', submitBuyHolding);

  // 검색어 입력 시 디바운스(200ms) 검색 (index.html L407 #etf-search-input)
  const searchInput = document.getElementById('etf-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchETFs(e.target.value);
      }, 200);
    };
  }

  bindClick('btn-clear-search', () => { // index.html L414
    if (searchInput) {
      searchInput.value = '';
      searchETFs('');
      searchInput.focus();
    }
  });

  // 인기 초성 칩(ㅋㄷㅅ, ㅌㅇㄱ 등) 클릭 시 검색창 자동 반영 (index.html L423-L428 .quick-chip)
  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.onclick = () => {
      const q = chip.dataset.query;
      if (searchInput) searchInput.value = q;
      searchETFs(q);
    };
  });

  // 매수가격 및 수량 입력 시 실시간 금액 계산 (index.html L497 #input-buy-price, L507 #input-buy-qty)
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

  // 수량 빠른 추가 버튼 (+1, +10, +50, +100) (index.html L516-L519 .btn-qty-add)
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

  // '종가로 입력' 버튼 (index.html L489 #btn-use-market-price)
  bindClick('btn-use-market-price', () => {
    if (state.selectedETF && priceInput) {
      priceInput.value = formatNumber(state.selectedETF.close_price);
      updateBuyFormCalculations();
    }
  });

  // -------------------------------------------------------------------------
  // [모달 2] 보유 종목 상세 모달 내부 버튼 이벤트
  // [적용 대상 코드: index.html L580 #btn-close-detail, L665 #btn-detail-add-more, L669 #btn-detail-edit, L673 #btn-detail-delete]
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // [모달 3] 보유 정보 직접 수정 모달 버튼 이벤트
  // [적용 대상 코드: index.html L692 #btn-close-edit-holding, L715 #btn-cancel-edit-holding, L718 #btn-save-edit-holding]
  // -------------------------------------------------------------------------
  bindClick('btn-close-edit-holding', closeEditHoldingModal);
  bindClick('btn-cancel-edit-holding', closeEditHoldingModal);
  bindClick('btn-save-edit-holding', saveEditHolding);

  // -------------------------------------------------------------------------
  // [모달 4.5] 계좌 정보 수정 모달 버튼 및 컬러 팔레트 이벤트
  // [적용 대상 코드: index.html L257 #btn-edit-active-group, L811 #btn-close-edit-group, L870 #btn-cancel-edit-group, L873 #btn-save-edit-group]
  // -------------------------------------------------------------------------
  bindClick('btn-edit-active-group', () => {
    if (state.activeGroupId) {
      const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
      if (grp) openEditGroupModal(grp);
    }
  });

  bindClick('btn-close-edit-group', closeEditGroupModal);
  bindClick('btn-cancel-edit-group', closeEditGroupModal);
  bindClick('btn-save-edit-group', saveEditGroup);

  const editColorInput = document.getElementById('edit-group-color'); // index.html L839
  if (editColorInput) {
    editColorInput.oninput = (e) => {
      const c = e.target.value.toUpperCase();
      const hexEl = document.getElementById('edit-group-color-hex'); // index.html L840
      const dotEl = document.getElementById('edit-group-color-dot'); // index.html L808
      if (hexEl) hexEl.textContent = c;
      if (dotEl) dotEl.style.backgroundColor = c;
    };
  }

  // 프리셋 색상 원형 버튼 클릭 이벤트 (index.html L843-L853 #edit-group-palette)
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

  // -------------------------------------------------------------------------
  // [모달 4 & 5] 계좌 추가 및 삭제 확인 다이얼로그 이벤트
  // [적용 대상 코드: index.html L788 #btn-create-group, L921 #btn-cancel-group-delete, L906 #btn-confirm-transfer-delete, L914 #btn-confirm-force-delete]
  // -------------------------------------------------------------------------
  bindClick('btn-create-group', createNewGroup); // index.html L788
  const newGroupCol = document.getElementById('new-group-color'); // index.html L781
  if (newGroupCol) {
    newGroupCol.oninput = (e) => {
      const prev = document.getElementById('color-hex-preview'); // index.html L782
      if (prev) prev.textContent = e.target.value.toUpperCase();
    };
  }

  bindClick('btn-cancel-group-delete', () => { // index.html L921
    const guard = document.getElementById('modal-group-delete-guard'); // index.html L887
    if (guard) guard.classList.add('hidden');
    state.deletePendingGroupId = null;
  });

  // 이관 후 삭제 확정 (index.html L906)
  bindClick('btn-confirm-transfer-delete', () => {
    const sel = document.getElementById('transfer-target-group-select'); // index.html L903
    const targetGroupId = sel ? sel.value : null;
    if (state.deletePendingGroupId) {
      executeDeleteGroup(state.deletePendingGroupId, targetGroupId, false);
    }
  });

  // 영구 삭제 확정 (index.html L914)
  bindClick('btn-confirm-force-delete', () => {
    if (confirm('정말로 이 계좌의 모든 보유 종목과 거래 기록을 영구 삭제하시겠습니까?')) {
      if (state.deletePendingGroupId) {
        executeDeleteGroup(state.deletePendingGroupId, null, true);
      }
    }
  });

  // -------------------------------------------------------------------------
  // [모달 6] 사용자 계정 (User ID) 설정 모달 내부 로직
  // [적용 대상 코드: index.html L927-L1013 #modal-user-settings]
  // -------------------------------------------------------------------------
  async function openUserSettingsModal() {
    const modal = document.getElementById('modal-user-settings'); // index.html L932
    if (!modal) return;
    modal.classList.remove('hidden');

    const currentId = getUserId();
    const displayInput = document.getElementById('active-user-id-display'); // index.html L958
    const statusBadge = document.getElementById('active-user-status-badge'); // index.html L955
    const customInput = document.getElementById('input-custom-user-id');     // index.html L986
    const userSelect = document.getElementById('select-registered-users');   // index.html L997

    if (displayInput) displayInput.value = currentId;
    if (customInput) customInput.value = currentId;

    // 현재 사용자 상태 조회 (보유 계좌수 / 종목수)
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

    // DB에 등록된 계정 목록 드롭다운 채우기 (index.html L997)
    try {
      const users = await apiFetch('/api/v1/users');
      if (userSelect && Array.isArray(users)) {
        userSelect.innerHTML = users.map(u => {
          const isCurrent = (u.user_id === currentId);
          const isDef = (u.user_id === DEFAULT_PRIMARY_USER_ID);
          const tag = isDef ? ' ★[내 원래 등록계좌]' : '';
          const currentTag = isCurrent ? ' (현재 활성)' : '';
          const dataTag = u.holding_count > 0 
            ? ` - ${u.group_count}계좌/${u.holding_count}종목` 
            : (u.group_count > 0 ? ` - ${u.group_count}계좌/0종목` : ' - 빈 계정');
          const displayLabel = isDef 
            ? `${DEFAULT_PRIMARY_USER_ID}${dataTag}${tag}${currentTag}`
            : `${u.user_id.length > 12 ? u.user_id.substring(0, 8) + '...' : u.user_id}${dataTag}${tag}${currentTag}`;
          return `<option value="${u.user_id}" ${isCurrent ? 'selected' : ''}>${displayLabel}</option>`;
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

  // 사용자 설정 모달 버튼 이벤트 연결
  const btnOpenUser = document.getElementById('btn-open-user-settings'); // index.html L108
  if (btnOpenUser) btnOpenUser.onclick = openUserSettingsModal;

  const btnCloseUser = document.getElementById('btn-close-user-modal');   // index.html L946
  if (btnCloseUser) btnCloseUser.onclick = closeUserSettingsModal;

  const btnDoneUser = document.getElementById('btn-done-user-modal');     // index.html L1008
  if (btnDoneUser) btnDoneUser.onclick = closeUserSettingsModal;

  // User ID 복사 버튼 (index.html L959)
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

  // 원래 계좌(5계좌/64종목) 원클릭 복원 버튼 (index.html L976)
  const btnRestorePrimary = document.getElementById('btn-restore-primary-user');
  if (btnRestorePrimary) {
    btnRestorePrimary.onclick = () => handleApplyCustomUserId(DEFAULT_PRIMARY_USER_ID);
  }

  // 직접 입력한 User ID 적용 버튼 (index.html L987)
  const btnApplyCustom = document.getElementById('btn-apply-custom-user-id');
  if (btnApplyCustom) {
    btnApplyCustom.onclick = () => {
      const val = document.getElementById('input-custom-user-id').value;
      handleApplyCustomUserId(val);
    };
  }

  const inputCustom = document.getElementById('input-custom-user-id'); // index.html L986
  if (inputCustom) {
    inputCustom.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCustomUserId(inputCustom.value);
      }
    };
  }

  // DB 등록 목록에서 선택 변경 버튼 (index.html L1000)
  const btnSwitchSelect = document.getElementById('btn-switch-selected-user');
  if (btnSwitchSelect) {
    btnSwitchSelect.onclick = () => {
      const val = document.getElementById('select-registered-users').value;
      handleApplyCustomUserId(val);
    };
  }

  // -------------------------------------------------------------------------
  // [공통 모달 닫기] 모달 바깥 어두운 배경(backdrop) 클릭 시 닫기 처리
  // -------------------------------------------------------------------------
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

// ============================================================================
// [섹션 11] PWA Service Worker 및 앱 진입점 초기화
// ============================================================================

// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update();
    }).catch((err) => {
      console.log('Service Worker registration skipped:', err);
    });
  });
}

// 이전 캐시 정리
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key !== 'etf-portfolio-cache-v14') {
        caches.delete(key);
      }
    });
  });
}

/**
 * [앱 최초 진입점] DOM이 모두 로드되면 사용자 정보 표시, 이벤트 바인딩 및 데이터 조회 시작
 */
document.addEventListener('DOMContentLoaded', () => {
  updateUserHeaderDisplay();
  setupEventListeners();
  loadDashboard();
});
