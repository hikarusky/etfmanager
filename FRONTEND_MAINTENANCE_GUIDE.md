# React 개발자를 위한 바닐라 JS 포트폴리오 앱 유지보수 가이드

이 문서는 **React 개발 경험은 풍부하지만, 순수 바닐라 자바스크립트(Vanilla JS) 기반의 경량 SPA 및 FastAPI 백엔드 구조가 낯선 개발자**를 위해 작성된 실전 유지보수 가이드입니다.

React의 주요 개념(State, Props, JSX, LifeCycle, Virtual DOM)과 본 프로젝트의 구현 방식을 1:1로 비교 매핑하여, 초보자도 쉽게 코드베이스를 파악하고 기능 추가 및 버그 수정을 진행할 수 있도록 구성되었습니다.

---

## 1. React vs 본 프로젝트 (1:1 멘탈 모델 매핑)

React에서 자연스럽게 사용하던 패턴들이 본 프로젝트에서는 순수 웹 표준(Web Standards) 기술로 어떻게 구현되어 있는지 비교한 표입니다.

| React 개념 | 본 프로젝트 (Vanilla JS) 구현 방식 | 코드 위치 / 예시 |
|---|---|---|
| **`useState(initialValue)`** | 전역 객체 `state`의 프로퍼티로 선언 | `app.js` 상단 `const state = { dashboard: null, groups: [], ... };` |
| **`setState(newValue)`** | 변수 직접 수정 후 렌더 함수 수동 호출 | `state.activeGroupId = 'grp_dc'; renderAll();` |
| **JSX Component** | HTML 문자열 템플릿 리터럴(Template Literal) 반환 함수 | `renderHoldings()`, `createHoldingCardHtml(h)` |
| **`props` 전달** | 일반 함수 인자(Arguments) 전달 | `function formatCard(item, isEditing) { ... }` |
| **`useEffect(() => {}, [])`** | `DOMContentLoaded` 이벤트 리스너 및 초기화 함수 | `window.addEventListener('DOMContentLoaded', initApp);` |
| **`onClick={handleClick}`** | `element.addEventListener('click', handler)` 또는 HTML `onclick` | `document.getElementById('btn-sync').addEventListener('click', ...)` |
| **조건부 렌더링 (`{isOpen && <Modal />}`)** | Tailwind CSS의 `classList.toggle('hidden')` | `modal.classList.remove('hidden')`, `modal.classList.add('hidden')` |
| **Virtual DOM Diffing** | 실제 브라우저 DOM 직접 변경 | `el.textContent = '...'`, `container.innerHTML = htmlString` |
| **Axios / React Query** | `fetch` 기반 커스텀 비동기 함수 `apiFetch()` | `const data = await apiFetch('/api/v1/dashboard');` |

> [!TIP]
> **핵심 차이점**: React는 상태(`state`)가 바뀌면 리액트 엔진이 자동으로 가상 DOM을 비교해 화면을 다시 그리지만(Re-render), **Vanilla JS에서는 상태를 바꾼 뒤 화면을 갱신하는 렌더 함수(예: `renderAll()`, `renderHoldings()`)를 개발자가 직접 호출해 주어야 합니다.**

---

## 2. 전체 디렉토리 및 파일 역할

```text
etf/
├── FRONTEND_MAINTENANCE_GUIDE.md  # [본 문서] 유지보수 가이드
├── GEMINI.md                     # 프로젝트 아키텍처 및 DB 격리 수칙
├── ETF_관리앱_PRD.md             # 제품 요구사항 정의서
├── pyproject.toml                # Python 의존성 정의
│
├── src/                          # 소스코드 루트
│   ├── main.py                   # FastAPI 앱 엔트리포인트 및 정적 파일 호스팅
│   │
│   ├── static/                   # ⭐️ [프론트엔드] 정적 파일 (별도 빌드 없음)
│   │   ├── index.html            # 전체 화면 골격 (Single-Page Markup & Modals)
│   │   ├── css/
│   │   │   └── style.css         # 애니메이션, 스크롤바, 특수 폰트 스타일
│   │   ├── js/
│   │   │   └── app.js            # ⭐️ 프론트엔드 핵심 로직 (State, Render, Event)
│   │   ├── manifest.json         # 모바일 PWA 설치 매니페스트
│   │   └── sw.js                 # PWA 서비스 워커
│   │
│   ├── core/                     # 백엔드 코어 설정
│   │   ├── config.py             # .env 환경설정
│   │   └── database.py           # PostgreSQL asyncpg DB 연결
│   ├── models/                   # SQLAlchemy 2.0 ORM 엔티티
│   ├── schemas/                  # Pydantic v2 DTO (요청/응답 스키마)
│   ├── collector/                # KRX 전종목 시세/마스터 수집기 (Fallback 구조)
│   ├── services/                 # 금융 계산(평단가 가중평균, 손익), 검색, 스케줄러
│   └── api/v1/                   # REST API 라우터 (/dashboard, /holdings, /groups ...)
│
└── tests/                        # 자동화 테스트 슈트 (pytest)
```

---

## 3. 프론트엔드(`app.js` & `index.html`) 아키텍처 심층 분석

### 3.1 단일 상태 관리 객체 (`state`)
`src/static/js/app.js` 최상단에 정의된 `state` 객체가 React의 Root State 역할을 합니다:

```javascript
const state = {
  activeUserId: 'hikarusky',  // 현재 활성화된 사용자 식별자
  dashboard: null,            // GET /api/v1/dashboard 전체 응답 캐시
  groups: [],                 // 계좌 그룹 목록 (DC, ISA, 연금저축 등)
  activeGroupId: null,        // 현재 선택된 계좌 필터 (null = 전체, 'grp_dc' = DC계좌)
  currentSort: 'custom',      // 보유 종목 정렬 기준 (custom, valuation_desc, return_rate_desc ...)
  isSyncing: false,           // 시세 동기화 진행 여부 (로딩 플래그)
  searchQuery: '',            // ETF 검색어
  searchResults: [],          // ETF 검색 결과 리스트
};
```

### 3.2 데이터 흐름 (Data Flow Lifecycle)
앱이 시작되어 화면이 렌더링되는 과정은 다음과 같습니다:

```mermaid
sequenceDiagram
    participant B as 브라우저 (DOMContentLoaded)
    participant JS as app.js (initApp)
    participant API as FastAPI (/api/v1/dashboard)
    participant DOM as 화면 (DOM)

    B->>JS: 페이지 로드 완료
    JS->>API: apiFetch('/api/v1/dashboard', { headers: { 'X-User-Id': 'hikarusky' } })
    API-->>JS: 요약, 계좌목록, 보유종목 데이터 반환
    JS->>JS: state.dashboard = data; state.groups = data.groups;
    JS->>DOM: renderAll() 실행
    Note over DOM: 1. renderDashboardSummary()<br/>2. renderGroupTabs()<br/>3. renderAllocationOrAccountCard()<br/>4. renderHoldings()
```

### 3.3 화면 렌더링 파이프라인
화면을 구성하는 4대 렌더링 함수입니다. 데이터가 변경되면 관련된 렌더 함수를 실행합니다:

1. **`renderDashboardSummary()`**:
   - 상단 총 평가금액, 투자원금, 총 평가손익, 총 수익률 배지를 계산하여 표시합니다.
2. **`renderGroupTabs()`**:
   - '전체', 'DC계좌', '연금저축' 등의 탭 버튼을 동적으로 생성합니다.
   - 클릭 시 `state.activeGroupId`를 변경하고 `renderAll()`을 재호출합니다.
3. **`renderAllocationOrAccountCard()`**:
   - `state.activeGroupId === null` (전체 탭): 계좌별 자산 비중 프로그레스 바 렌더링.
   - `state.activeGroupId !== null` (특정 계좌 탭): 해당 계좌의 **[평가금액], [투자원금], [수익금], [수익률]** 요약 카드 렌더링.
4. **`renderHoldings()`**:
   - 현재 선택된 계좌에 속한 ETF 보유 종목 카드들을 리스트로 출력합니다.
   - 순서 변경(드래그 앤 드롭) 및 정렬 옵션을 처리합니다.

### 3.4 모달(Modal) 제어 시스템
React에서는 모달을 열고 닫을 때 state(`isModalOpen`)를 두고 조건부 렌더링을 하지만, 본 앱에서는 **CSS 클래스(`hidden`)를 토글**하여 제어합니다:

```javascript
// 모달 열기
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

// 모달 닫기
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}
```

- 주요 모달 ID:
  - `modal-add-holding`: 종목 매수 추가 모달
  - `modal-holding-detail`: 종목 상세 / 추가 매수 / 매도 / 삭제 모달
  - `modal-manage-groups`: 계좌 그룹 관리 모달
  - `modal-user-settings`: 사용자 계정(User ID) 설정 모달

---

## 4. 백엔드(FastAPI)와의 통신 규약

프론트엔드는 모든 통신에 `src/static/js/app.js`의 `apiFetch()` 유틸리티 함수를 사용합니다.

```javascript
async function apiFetch(endpoint, options = {}) {
  // 자동으로 활성화된 User ID를 헤더에 포함
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': state.activeUserId || 'hikarusky',
    ...(options.headers || {}),
  };
  
  const response = await fetch(`${activeApiBase}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP Error ${response.status}`);
  }
  return response.json();
}
```

### 주요 REST API 엔드포인트 정리

| 메서드 | 엔드포인트 | 역할 및 설명 |
|---|---|---|
| `GET` | `/api/v1/dashboard` | 전체 포트폴리오 요약, 계좌 목록, 보유 종목 및 실시간 손익 일괄 반환 |
| `POST` | `/api/v1/holdings` | 신규 종목 매수 기록 추가 (기존 종목 있을 시 가중평균 평단가 자동 병합) |
| `PUT` | `/api/v1/holdings/{id}` | 보유 종목 수량, 평단가, 메모 직접 수정 |
| `DELETE`| `/api/v1/holdings/{id}` | 보유 종목 및 관련 거래 이력 삭제 |
| `GET` | `/api/v1/etfs/search?q=...`| KRX ETF 전종목 한글 초성/코드/명칭 고속 검색 (< 5ms) |
| `POST` | `/api/v1/sync/prices` | 네이버/FDR 시세 수집기를 통한 당일 일별 종가 즉시 동기화 |
| `GET` | `/api/v1/groups` | 사용자의 계좌 그룹 목록 조회 |
| `POST` | `/api/v1/groups` | 신규 계좌 그룹 생성 (예: ISA, IRP 등) |

---

## 5. 실전 유지보수 가이드 (How-to 실습 예제)

### 예제 1: 화면에 새로운 수치/필드 추가하기
> **시나리오**: 계좌 상세 카드에 새로운 항목을 추가하고 싶을 때

1. **HTML 마크업 추가 (`src/static/index.html`)**:
   수정할 영역을 찾아 원하는 위치에 `id`를 가진 엘리먼트를 추가합니다:
   ```html
   <div>
     <span class="text-[10px] text-slate-400 block">수익금</span>
     <span id="single-acc-pnl-amount" class="text-xs font-bold num-tabular">₩ 0</span>
   </div>
   ```

2. **JS에서 데이터 바인딩 (`src/static/js/app.js`)**:
   해당 영역을 렌더링하는 함수(예: `renderAllocationOrAccountCard`)를 찾아 엘리먼트를 업데이트합니다:
   ```javascript
   const pnlVal = parseFloat(grp.pnl || 0);
   const pnlEl = document.getElementById('single-acc-pnl-amount');
   if (pnlEl) {
     const sign = pnlVal > 0 ? '+' : (pnlVal < 0 ? '-' : '');
     pnlEl.textContent = `${sign}₩ ${formatNumber(Math.abs(pnlVal))}`;
     pnlEl.className = `text-xs font-bold num-tabular ${getPnlClass(pnlVal)}`;
   }
   ```

3. **브라우저 새로고침**: 빌드할 필요 없이 브라우저를 새로고침하면 즉시 반영됩니다.

---

### 예제 2: 새로운 버튼을 만들고 API 호출 연결하기
> **시나리오**: '캐시 새로고침' 버튼을 만들어 클릭 시 서버 API를 호출하고 대시보드를 갱신하고 싶을 때

1. **HTML에 버튼 생성**:
   ```html
   <button id="btn-refresh-cache" class="px-2 py-1 bg-slate-800 rounded text-xs text-white">
     캐시 비우기
   </button>
   ```

2. **`app.js`의 `setupEventListeners()`에 이벤트 리스너 등록**:
   ```javascript
   function setupEventListeners() {
     // ... 기존 리스너들 ...

     const refreshBtn = document.getElementById('btn-refresh-cache');
     if (refreshBtn) {
       refreshBtn.addEventListener('click', async () => {
         try {
           showToast('캐시 갱신 중...', 'info');
           await apiFetch('/api/v1/cache/clear', { method: 'POST' });
           showToast('캐시가 성공적으로 비워졌습니다.', 'success');
           await loadDashboard(); // 화면 최신 데이터로 리로드
         } catch (err) {
           showToast(err.message, 'error');
         }
       });
     }
   }
   ```

---

### 예제 3: 색상 및 스타일(Tailwind CSS) 규칙 적용
국내 금융 표준 및 본 프로젝트의 색상 가이드라인입니다:

- **수익 (이익)**:
  - 색상 코드: `#D0374C` (KRX 톤다운 Soft Red)
  - Tailwind 클래스: `text-krx-red`, 배경: `bg-red-950/60`, 테두리: `border-red-800/40`
- **손실**:
  - 색상 코드: `#60A5FA` (KRX 밝은 Vivid Blue)
  - Tailwind 클래스: `text-krx-blue`, 배경: `bg-blue-950/60`, 테두리: `border-blue-800/40`
- **숫자 고정 폭 폰트 (Tabular Numbers)**:
  - 금액이나 퍼센트 등 숫자가 흔들리지 않고 줄맞춤되도록 숫자 엘리먼트에는 반드시 `num-tabular` 클래스를 추가합니다.

---

## 6. 주의사항 및 트러블슈팅 꿀팁

### 1) JS 수정 후 브라우저에 즉시 반영되지 않을 때 (캐시 문제)
- **원인**: 브라우저가 이전 버전의 `app.js`를 캐싱하고 있을 수 있습니다.
- **해결책**:
  1. 브라우저에서 **강력 새로고침**: `Ctrl + Shift + R` (Windows) 또는 `Cmd + Shift + R` (Mac).
  2. `src/static/index.html` 하단의 스크립트 태그 버전 쿼리스트링을 올려줍니다:
     ```html
     <!-- 예: 1.0.14 -> 1.0.15 로 변경 -->
     <script src="/js/app.js?v=1.0.15"></script>
     ```

### 2) 아이콘(Lucide Icons)이 화면에 보이지 않을 때
- **원인**: 동적으로 HTML을 삽입(`innerHTML = '...'`)한 후 Lucide 아이콘 초기화 함수를 실행하지 않은 경우입니다.
- **해결책**: HTML을 동적으로 삽입한 직후 반드시 `lucide.createIcons()`를 호출해 주어야 합니다:
  ```javascript
  container.innerHTML = `<i data-lucide="trending-up" class="w-4 h-4"></i>`;
  if (window.lucide) lucide.createIcons(); // ⭐️ 필수!
  ```

### 3) 로컬 PostgreSQL DB 격리 수칙 준수
- **주의**: 기존 로컬 DB인 `stockinfo`는 절대 접근하거나 수정하지 않습니다.
- 모든 데이터는 오직 **`etf_portfolio`** 데이터베이스만을 바라보도록 `src/core/config.py`와 `.env`에 설정되어 있습니다.

---

## 7. 로컬 개발 및 테스트 실행 명령어 모음

```bash
# 1. 의존성 동기화
uv sync

# 2. FastAPI 로컬 개발 서버 실행 (코드 수정 시 자동 리로드)
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8010

# 3. 전체 자동화 테스트 슈트 실행 (28개 테스트)
uv run pytest

# 4. 특정 도메인 단위 테스트만 실행
uv run pytest tests/test_calc.py             # 금융 평단가 및 손익 계산 검증
uv run pytest tests/test_search.py           # 한글 초성 검색 엔진 검증
uv run pytest tests/test_frontend_and_sync.py # 프론트엔드 및 시세 동기화 검증
```

---

## 8. 실전 기능 개발 및 수정 쿡북 (Hands-on Code Blueprints)

실제 현업에서 기능을 추가하거나 기존 기능을 수정할 때를 가정하여, **수정해야 할 파일과 실제 코드 작성법**을 단계별로 제공합니다.

---

### 📘 시나리오 1: [UI 필터/정렬 수정] 종목 정렬에 '수익금 높은순 / 낮은순' 옵션 추가하기

보유 종목 상단의 정렬 드롭다운에 `평가손익 높은순`, `평가손익 낮은순` 2가지 옵션을 새롭게 추가하는 작업입니다.

#### 1단계: HTML 셀렉트 박스에 옵션 추가 (`src/static/index.html`)
`index.html`에서 `<select id="sort-selector">`를 찾아 신규 `<option>` 태그를 추가합니다.

```html
<!-- 파일: src/static/index.html 약 210행 -->
<select id="sort-selector" class="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500">
  <option value="custom" selected>사용자 지정순</option>
  <option value="valuation_desc">평가금액순</option>
  <option value="return_rate_desc">수익률 높은순</option>
  <option value="return_rate_asc">수익률 낮은순</option>
  <!-- ⭐️ [추가된 코드] -->
  <option value="pnl_desc">수익금 높은순</option>
  <option value="pnl_asc">수익금 낮은순</option>
  <!-- ⭐️ [여기까지] -->
  <option value="name_asc">종목명순</option>
</select>
```

#### 2단계: 정렬 로직 분기문 추가 (`src/static/js/app.js`)
`app.js`의 `getSortedFilteredHoldings()` 함수 내 `switch (state.currentSort)` 문에 `pnl_desc`와 `pnl_asc` 케이스를 추가합니다.

```javascript
// 파일: src/static/js/app.js 약 570행
function getSortedFilteredHoldings() {
  let list = [];
  if (state.activeGroupId === null) {
    list = [...(state.dashboard?.all_holdings || [])];
  } else {
    const grp = state.groups.find((g) => g.group_id === state.activeGroupId);
    list = grp ? [...(grp.holdings || [])] : [];
  }

  // Sort 분기 처리
  switch (state.currentSort) {
    case 'custom':
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      break;
    case 'valuation_desc':
      list.sort((a, b) => parseFloat(b.valuation_amount || 0) - parseFloat(a.valuation_amount || 0));
      break;
    case 'return_rate_desc':
      list.sort((a, b) => parseFloat(b.return_rate || 0) - parseFloat(a.return_rate || 0));
      break;
    case 'return_rate_asc':
      list.sort((a, b) => parseFloat(a.return_rate || 0) - parseFloat(b.return_rate || 0));
      break;

    // ⭐️ [추가된 코드: 수익금(pnl) 기준 정렬]
    case 'pnl_desc':
      list.sort((a, b) => parseFloat(b.pnl || 0) - parseFloat(a.pnl || 0));
      break;
    case 'pnl_asc':
      list.sort((a, b) => parseFloat(a.pnl || 0) - parseFloat(b.pnl || 0));
      break;
    // ⭐️ [여기까지]

    case 'name_asc':
      list.sort((a, b) => (a.name_kr || '').localeCompare(b.name_kr || '', 'ko'));
      break;
  }
  return list;
}
```
> **React와의 비교**: React였다면 `const sorted = useMemo(() => { ... }, [holdings, sortType])`로 작성했을 로직을 일반 함수 형태로 작성하고, 드롭다운 `change` 이벤트 핸들러에서 `renderHoldings()`를 호출하는 구조입니다.

---

### 📘 시나리오 2: [프론트엔드 카드 컴포넌트 확장] 종목 카드에 '자산 비중(%)' 뱃지 실시간 표시하기

현재 보고 있는 계좌의 전체 평가금액 대비 해당 종목이 차지하는 비중(%)을 계산하여 종목명 옆에 뱃지로 띄우는 작업입니다.

#### 수정 위치: `src/static/js/app.js`의 `renderHoldings()` 함수

```javascript
// 파일: src/static/js/app.js 약 620행
function renderHoldings() {
  const container = document.getElementById('holdings-list');
  // ... 생략 ...

  // 1. 현재 활성 그룹의 총 평가금액 계산 (비중 계산의 분모)
  let currentTotalValuation = 0;
  if (state.activeGroupId === null) {
    currentTotalValuation = parseFloat(state.dashboard?.summary?.total_valuation || 0);
  } else {
    const activeGrp = state.groups.find(g => g.group_id === state.activeGroupId);
    currentTotalValuation = parseFloat(activeGrp?.valuation_amount || 0);
  }

  sortedHoldings.forEach((h, index) => {
    // 2. 종목별 평가금액 및 비중(%) 계산
    const holdingValuation = parseFloat(h.valuation_amount || 0);
    const weightPercent = currentTotalValuation > 0 
      ? ((holdingValuation / currentTotalValuation) * 100).toFixed(1) 
      : '0.0';

    // 3. 카드 HTML 템플릿 리터럴에 비중 뱃지 삽입
    const card = document.createElement('div');
    card.className = 'holding-card ...';
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="min-w-0 flex-1 pr-2">
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            <span class="font-bold text-white text-sm truncate">${h.name_kr}</span>
            
            <!-- ⭐️ [추가된 코드: 비중 뱃지] -->
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-800/40 text-blue-300 font-mono font-semibold">
              비중 ${weightPercent}%
            </span>
            <!-- ⭐️ [여기까지] -->

            ${h.group_name ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">${h.group_name}</span>` : ''}
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-400">
            <span class="font-mono">${h.ticker}</span>
            <span>·</span>
            <span>${formatNumber(h.quantity)}주</span>
          </div>
        </div>
        ...
    `;
    container.appendChild(card);
  });
  
  if (window.lucide) lucide.createIcons();
}
```

---

### 📘 시나리오 3: [풀스택 신규 기능 개발] 종목별 '메모(Memo)' 실시간 인라인 편집 기능

보유 종목에 대한 투자 메모를 종목 상세 모달을 열지 않고도 카드에서 바로 확인하거나 수정할 수 있도록 프론트엔드와 백엔드를 연동하는 실전 풀스택 예제입니다.

#### 1단계: 백엔드 API 확인 (`src/api/v1/holdings.py`)
이미 백엔드에 `PUT /api/v1/holdings/{holding_id}` 엔드포인트가 `memo: str` 필드 수정을 지원하고 있습니다:
```python
# src/schemas/holding.py
class HoldingUpdateRequest(BaseModel):
    quantity: int | None = None
    avg_price: Decimal | None = None
    memo: str | None = Field(None, max_length=100) # <- 메모 필드
```

#### 2단계: 프론트엔드 카드에 메모 편집 버튼 및 텍스트 추가 (`src/static/js/app.js`)
종목 카드 마크업 내에 메모 표시 영역과 빠른 수정 버튼을 추가합니다:

```javascript
// 파일: src/static/js/app.js (renderHoldings 내부)
const memoHtml = h.memo 
  ? `<span class="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded italic">📝 ${h.memo}</span>`
  : `<span class="text-[11px] text-slate-600 hover:text-slate-400 cursor-pointer">+ 메모 추가</span>`;

// 카드 내부 원하는 위치에 삽입:
// <div class="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
//   <div class="memo-container" onclick="quickEditMemo('${h.holding_id}', '${h.memo || ''}')">
//     ${memoHtml}
//   </div>
// </div>
```

#### 3단계: 빠른 메모 수정 비동기 함수 구현 (`src/static/js/app.js`)
사용자 입력을 받아 백엔드로 `PUT` 요청을 보내고, 결과를 로컬 상태에 즉시 반영하는 함수를 작성합니다:

```javascript
// 파일: src/static/js/app.js 하단
async function quickEditMemo(holdingId, currentMemo) {
  const newMemo = prompt('종목 투자 메모를 입력하세요 (최대 100자):', currentMemo);
  if (newMemo === null) return; // 사용자가 취소 누름

  try {
    showToast('메모 저장 중...', 'info');

    // 1. 백엔드 REST API 호출
    await apiFetch(`/api/v1/holdings/${holdingId}`, {
      method: 'PUT',
      body: JSON.stringify({ memo: newMemo.trim() }),
    });

    showToast('메모가 저장되었습니다.', 'success');

    // 2. React의 Optimistic Update처럼 로컬 state 즉시 반영
    if (state.dashboard && state.dashboard.all_holdings) {
      const target = state.dashboard.all_holdings.find(h => h.holding_id === holdingId);
      if (target) target.memo = newMemo.trim();
    }
    state.groups.forEach(g => {
      const target = (g.holdings || []).find(h => h.holding_id === holdingId);
      if (target) target.memo = newMemo.trim();
    });

    // 3. UI 렌더러 재호출 (화면 갱신)
    renderHoldings();

  } catch (err) {
    console.error('quickEditMemo error:', err);
    showToast(err.message || '메모 저장에 실패했습니다.', 'error');
  }
}
```

---

### 📘 시나리오 4: [백엔드 + 프론트엔드] 새로운 계좌 통계 API 연동하기

예를 들어 백엔드에 "계좌별 월간 예상 배당금" API가 신설되었을 때 프론트엔드와 연결하는 표준 패턴입니다.

#### 1단계: 백엔드 라우터 등록 (`src/api/v1/groups.py`)
```python
# src/api/v1/groups.py
@router.get("/{group_id}/dividends")
async def get_group_expected_dividends(
    group_id: str,
    user_id: str = Header(..., alias="X-User-Id"),
    session: AsyncSession = Depends(get_session)
):
    # 비즈니스 로직 수행
    return {"group_id": group_id, "estimated_monthly_dividend": 45000}
```

#### 2단계: 프론트엔드 API 호출 및 화면 바인딩 (`src/static/js/app.js`)
```javascript
// app.js
async function loadGroupDividendInfo(groupId) {
  try {
    const data = await apiFetch(`/api/v1/groups/${groupId}/dividends`);
    const divEl = document.getElementById('single-acc-dividend');
    if (divEl) {
      divEl.textContent = formatWon(data.estimated_monthly_dividend);
    }
  } catch (err) {
    console.error('Failed to load dividend info:', err);
  }
}
```

---

## 9. 결론: 유지보수 체크리스트

코드를 수정하거나 기능을 추가한 뒤에는 다음 체크리스트를 순서대로 확인하세요:

1. **상태 변경 후 렌더 함수를 호출했는가?**
   - React와 달리 `state` 프로퍼티 수정 후 `renderAll()`, `renderHoldings()` 등을 직접 실행해야 화면에 그려집니다.
2. **동적 HTML 삽입 후 아이콘을 갱신했는가?**
   - `.innerHTML`로 아이콘 태그(`data-lucide`)를 추가했다면 반드시 `if (window.lucide) lucide.createIcons();`를 실행하세요.
3. **숫자 표시 시 `num-tabular`와 포맷터를 사용했는가?**
   - `formatWon(금액)`, `formatPercent(수익률)`, `getPnlClass(손익)` 함수를 사용하면 KRX 색상과 천 단위 콤마가 자동 처리됩니다.
4. **자동화 테스트(`uv run pytest`)가 전부 통과하는가?**
   - 수정을 마친 후 터미널에서 `uv run pytest`를 실행하여 28개 이상의 테스트가 모두 통과하는지 반드시 확인하세요.

