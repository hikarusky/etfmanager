# KRX ETF 포트폴리오 관리 앱 - 화면별 기능 및 동작 가이드

이 문서는 **KRX ETF 포트폴리오 관리 애플리케이션**을 처음 사용하는 사용자와 개발자를 위한 종합 가이드입니다.  
화면 UI 구조와 실제 동작 코드가 서로 어떻게 연결되어 있는지 각 코드의 **정확한 라인 번호(Line Number)**와 함께 상세히 설명합니다.

> 💡 **소스 파일 기본 위치 안내 (공통)**
> 본 가이드에서 참조하는 프론트엔드 파일의 로컬 저장 위치는 다음과 같습니다:
> - **기본 디렉토리**: `file:///Users/hongjunyong/Desktop/etf/src/static/` (`src/static/`)
> - **HTML 파일**: `index.html` (`src/static/index.html`)
> - **JavaScript 파일**: `js/app.js` (`src/static/js/app.js`)
> 
> *이후 본문 및 매핑 표에서는 위 전체 경로를 반복하지 않고 `index.html L...`, `app.js L...` 형태로 간결하게 표기합니다.*

---

## 1. 앱 소개 및 핵심 특징

- **목적**: 연금저축, IRP, DC, ISA, 일반 위탁계좌 등 여러 증권사에 흩어져 있는 국내 상장 ETF(약 1,000종)를 마이데이터 연동 없이 **직접 입력한 매수 기록과 한국거래소(KRX) 일별 확정 종가**를 바탕으로 통합 관리·손익 계산·시각화하는 모바일 최적화 웹앱입니다.
- **주요 특징**:
  1. **초고속 한글 초성 검색**: `ㅋㄷㅅ` 입력 시 `KODEX`, `ㅌㅇㄱ` 입력 시 `TIGER` 등 실시간 초성 검색 지원
  2. **가중평균 평단가 자동 계산**: 동일 종목을 여러 번 나누어 분할 매수해도 평단가를 가중평균으로 자동 계산
  3. **계좌별 분리 및 통합 관리**: 전체 자산 배분 비중뿐 아니라 개별 계좌별 손익을 분리하여 확인 가능
  4. **퇴직연금(DC/IRP) 위험자산 한도 진단**: 주식형 위험자산(70% 한도)과 채권·국채·미국채·TDF 등 안전자산 비중을 실시간 분리 집계
  5. **드래그 앤 드롭 정렬**: 보유 종목 카드를 마우스나 터치로 끌어서 원하는 순서로 자유롭게 배치

---

## 2. 전체 화면 구조도 (Layout Map)

```text
┌─────────────────────────────────────────────────────────────┐
│ [헤더] KRX ETF 포트폴리오 | 기준: 09/14 종가 | [계정][새로고침][설정]│
├─────────────────────────────────────────────────────────────┤
│ [User ID 빠른 전환 바] User ID: [ hikarusky (5계좌/66종목) ▼] [조회] [⚙]│
├─────────────────────────────────────────────────────────────┤
│ [총 평가금액 요약 카드]                                      │
│  총 평가금액: ₩ 45,820,000  (종가 확정)                     │
│  투자원금: ₩ 40,000,000  |  평가손익: +₩5,820,000 (+14.55%)  │
├─────────────────────────────────────────────────────────────┤
│ [계좌 탭 바] [전체(64)] [연금저축(12)] [IRP(8)] [ISA(15)] [+추가] │
├─────────────────────────────────────────────────────────────┤
│ (선택 1: '전체' 탭) ──▶ [자산 배분 비중 가로 막대그래프 & 범례]     │
│ (선택 2: 개별계좌)  ──▶ [계좌 상세 요약 & 위험자산(DC/IRP) 비중 배너] │
├─────────────────────────────────────────────────────────────┤
│ [보유 종목 헤더] 보유 종목 (64)        [정렬: 사용자지정순 ▼]       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [::] [연금저축] 069500              현재가: ₩ 35,400 (+0.45%) │ │
│ │ KODEX 200                                               │ │
│ │ 보유 100주 · 평단 ₩ 32,000 · 원금 ₩ 3,200,000             │ │
│ │ 평가금액: ₩ 3,540,000   | 평가손익: +₩340,000 (+10.63%)   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ (보유 종목 카드 목록 스크롤 & 마우스/터치 드래그로 순서 변경 가능)  │
├─────────────────────────────────────────────────────────────┤
│ [투자 유의사항 푸터] 본 서비스는 투자자문·매매권유가 아닙니다...      │
├─────────────────────────────────────────────────────────────┤
│ [하단 고정 플로팅 버튼]  [ + ETF 매수 기록하기 ]               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. app.js ↔ index.html 코드 라인 정밀 매핑 요약 (Quick Reference)

각 화면의 기능 및 UI 요소가 `index.html`의 어느 코드 라인에 작성되어 있고, `app.js`의 어느 함수와 라인에서 동작을 제어하는지 한눈에 확인할 수 있는 정밀 매핑 테이블입니다.

| 영역 | 기능 및 UI 요소 | `index.html` 코드 라인 | `app.js` 담당 함수 및 라인 |
|---|---|---|---|
| **상단 헤더** | • 기준일자 종가 배지 (`#header-market-badge`, `#header-base-date`)<br>• 시세 새로고침 버튼 (`#btn-sync-market`, `#sync-icon-wrapper`)<br>• 사용자 ID 뱃지 (`#header-user-short-id`) | L97-L100<br>L114-L118<br>L108-L111 | `renderHeader() L420-L439`<br>`syncMarketPrices() L378-L405`<br>`updateUserHeaderDisplay() L259-L285` |
| **User ID 바** | • 등록된 User ID 드롭다운 선택창 (`#bar-user-id-select`)<br>• 조회 버튼 (`#btn-bar-apply-user`) | L132-L156 (선택창: L142, 버튼: L148) | `loadRegisteredUsers() L287-L334`<br>`switchUser() L336-L364` |
| **총 평가금액 카드** | • 총 평가금액 (`#total-valuation`)<br>• 투자원금 (`#total-invested`)<br>• 평가손익 및 수익률 (`#total-pnl`, `#total-return-badge`) | L156-L195<br>(L174, L182, L188, L189) | `renderSummaryCard() L441-L466` |
| **계좌 탭 바** | • '전체' 및 개별 계좌 필터 탭 (`#group-tabs-container`)<br>• 빠른 계좌 추가 버튼 (`#btn-quick-add-group`) | L197-L218<br>(컨테이너: L212, 버튼: L206) | `renderGroupTabs() L468-L508` |
| **자산 배분 바** | • '전체' 탭 선택 시 가로 누적 비중 막대 (`#allocation-section`, `#allocation-bar`, `#allocation-legend`) | L220-L239<br>(막대: L232, 범례: L236) | `renderAllocationOrAccountCard() L514-L556` |
| **단일 계좌 요약** | • 개별 계좌 탭 선택 시 요약 카드 (`#single-account-section`)<br>• 퇴직연금(DC/IRP) 위험자산 70% 비중 배너 (`#single-acc-risk-breakdown`) | L241-L300<br>(요약: L268-L280, 배너: L285-L299) | `renderAllocationOrAccountCard() L558-L646` |
| **보유 종목 리스트** | • 정렬 드롭다운 (`#sort-selector`)<br>• 종목 카드 목록 동적 렌더링 (`#holdings-list`)<br>• 드래그 앤 드롭 순서 변경 및 서버 영구 저장 | L302-L340<br>(정렬: L317, 목록: L327, 빈상태: L330) | `renderHoldings() L695-L840`<br>`getSortedFilteredHoldings() L652-L693`<br>`saveNewHoldingsOrder() L842-L893` |
| **하단 고정 버튼** | • `[+ ETF 매수 기록하기]` 플로팅 버튼 (`#btn-open-buy`) | L359-L373 (버튼: L367) | `openBuyModal() L984-L997` |
| **[모달 1] 매수 등록** | • Step 1 종목 검색 (`#buy-step-search`, `#etf-search-input`)<br>• Step 2 매수 입력 폼 (`#buy-step-form`, `#form-total-calc`, `#btn-submit-buy`) | L381-L563<br>(Step1: L398-L445, Step2: L447-L560) | `searchETFs() L1021`<br>`selectETFForBuy() L1080`<br>`updateBuyFormCalculations() L1158`<br>`submitBuyHolding() L1169` |
| **[모달 2] 종목 상세** | • 종목 시세, 손익, AUM/보수, 매수 거래 이력 (`#detail-tx-list`), 삭제 버튼 | L565-L680<br>(이력: L657, 삭제버튼: L673) | `openHoldingDetail() L895-L974`<br>`deleteHolding() L1279` |
| **[모달 3] 종목 수정** | • 평단가, 수량, 메모 직접 수정 (`#edit-avg-price`, `#edit-quantity`) | L682-L723<br>(평단가: L701, 수량: L705) | `saveEditHolding() L1242-L1277` |
| **[모달 4, 4.5] 계좌 관리** | • 계좌 목록 및 신규 계좌 추가 (`#groups-list`, `#btn-create-group`)<br>• 계좌명/유형 및 8가지 컬러 팔레트 수정 (`#edit-group-palette`) | L725-L796 (목록: L752, 추가: L788)<br>L798-L878 (이름: L821, 색상: L843) | `renderGroupsList() L1412-L1463`<br>`createNewGroup() L1465-L1496`<br>`saveEditGroup() L1352-L1399` |
| **[모달 5] 삭제 확인** | • 계좌 삭제 안전 다이얼로그 (다른 계좌로 이관 후 삭제 or 영구 삭제) | L880-L925<br>(이관삭제: L906, 강제삭제: L914) | `handleDeleteGroupClick() L1498-L1524`<br>`executeDeleteGroup() L1526-L1555` |
| **[모달 6] 계정 설정** | • 내 원래 계좌(5개/64종목) 즉시 복원 (`#btn-restore-primary-user`)<br>• User ID 직접 입력 전환 및 DB 계정 선택<br>• 선택한 계정 영구 삭제 (`#btn-delete-selected-user`) | L932-L1020<br>(원클릭복원: L978, ID입력: L988, 선택: L999, 삭제: L1006) | `openUserSettingsModal() L2247-L2285`<br>`handleApplyCustomUserId() L2289-L2311`<br>`btnDeleteSelect L2379-L2413` |
| **토스트 알림** | • 상단 팝업 알림 메시지 카드 (`#toast-container`) | L1015-L1021 | `showToast() L78-L110` |

---

## 4. 메인 화면 영역별 상세 설명 (HTML 라인 및 JS 동작 매핑)

### 4.1 상단 네비게이션 헤더 (Header)
- **화면 위치**: 화면 맨 위 고정 바
- **HTML 코드 위치**: `index.html L83-L125`
  - 기준 일자 배지: `L97-L100` (`#header-market-badge`, `#header-base-date`)
  - 사용자 ID 버튼: `L108-L111` (`#btn-open-user-settings`, `#header-user-short-id`)
  - 시세 새로고침 버튼: `L114-L118` (`#btn-sync-market`, `#sync-icon-wrapper`)
  - 계좌 관리 설정 버튼: `L121-L123` (`#btn-open-groups`)
- **담당 JS 코드**: `app.js L420-L439` (`renderHeader()`), `L378-L405` (`syncMarketPrices()`)

#### 주요 기능
1. **시세 기준일자 배지 (`index.html L97-L100`)**:
   - `renderHeader()`가 호출될 때 백엔드에서 받은 `base_date`를 파싱하여 `기준: 09/14 종가` 형태로 표시합니다.
   - 당일 18시 이후 시세가 마감되었으면 초록색 점(`당일 종가 확정`), 장중이나 휴일인 경우 주황색 점(`직전 영업일 종가`)으로 자동 구분됩니다.
2. **User ID 단축 표시 (`index.html L110`)**:
   - 현재 활성화된 사용자의 아이디 앞자리를 보여줍니다. 기본 계정인 경우 `내 계정`으로 표기됩니다.
3. **시세 새로고침 버튼 (`index.html L114`)**:
   - 클릭 시 `syncMarketPrices()`가 실행되며 동기화가 진행되는 동안 아이콘이 360도 회전합니다. KRX 최신 시세를 즉시 재수집한 뒤 완료 알림 토스트를 띄웁니다.
4. **계좌 관리 설정 버튼 (`index.html L121`)**:
   - 클릭 시 [모달 4] 계좌 그룹 관리 창을 엽니다.

---

### 4.2 User ID 선택 및 빠른 전환 바 (`#user-identity-bar`)
- **화면 위치**: 상단 헤더 바로 아래 위치한 카드 형태의 바
- **HTML 코드 위치**: `index.html L132-L156`
  - 선택창(드롭다운): `L142` (`#bar-user-id-select`)
  - 조회 버튼: `L148` (`#btn-bar-apply-user`)
  - 계정 관리 버튼: `L152` (`#btn-bar-open-user-modal`)
- **담당 JS 코드**: `app.js L287-L334` (`loadRegisteredUsers()`), `L336-L364` (`switchUser()`), `L2247-L2285` (`openUserSettingsModal()`)

#### 주요 기능
- DB 테이블에 등록된 모든 User ID 목록을 드롭다운(`select`)으로 자동 조회하여 각 계정의 계좌수 및 보유종목수(예: `hikarusky (5계좌 / 66종목) ★[기본]`)와 함께 나열합니다.
- 사용자가 드롭다운에서 특정 계정을 선택(`onchange`)하면 즉시 `switchUser()`가 실행되어 활성 사용자를 변경하고, 해당 사용자가 보유한 계좌 목록과 포트폴리오를 화면에 새로 조회합니다.
- **[조회]** 버튼 클릭 시에도 현재 선택된 User ID의 데이터를 즉시 새로고침합니다.
- 우측 설정 아이콘(`⚙`)을 누르면 신규 계정 생성, 계정 삭제 및 세부 설정을 할 수 있는 계정 상세 모달([모달 6])이 열립니다.

---

### 4.3 총 평가금액 요약 대시보드 카드 (Total Valuation Card)
- **화면 위치**: 메인 화면 상단 대형 요약 카드
- **HTML 코드 위치**: `index.html L156-L195`
  - 종가 확정 배지: `L168` (`#card-as-of-badge`)
  - 총 평가금액: `L174` (`#total-valuation`)
  - 투자원금: `L182` (`#total-invested`)
  - 평가손익: `L188` (`#total-pnl`)
  - 총 수익률: `L189` (`#total-return-badge`)
- **담당 JS 코드**: `app.js L441-L466` (`renderSummaryCard()`)

#### 주요 기능
- **총 평가금액 (`index.html L174`)**: 현재 보유한 모든 ETF의 `현재 종가 × 수량` 합계 금액을 표시합니다.
- **투자원금 (`index.html L182`)**: `매수 평단가 × 수량`의 전체 원금 합계입니다.
- **평가손익 및 수익률 (`index.html L188, L189`)**:
  - `(총 평가금액 - 총 투자원금)` 및 수익률을 계산합니다.
  - 국내 금융 관행에 맞춰 **수익(+)인 경우 빨간색(`text-krx-red`)**, **손실(-)인 경우 파란색(`text-krx-blue`)**으로 자동 서식화됩니다.

---

### 4.4 계좌 필터 탭 바 (`#group-tabs-container`)
- **화면 위치**: 대시보드 요약 카드 바로 아래의 가로 스크롤 탭 메뉴
- **HTML 코드 위치**: `index.html L197-L218`
  - 빠른 계좌 추가 버튼: `L206` (`#btn-quick-add-group`)
  - 탭 컨테이너: `L212` (`#group-tabs-container`)
- **담당 JS 코드**: `app.js L468-L508` (`renderGroupTabs()`)

#### 주요 기능
- 기본 **'전체'** 탭과 사용자가 생성한 개별 계좌(연금저축, IRP, DC, ISA 등) 탭들이 나열됩니다.
- 탭을 클릭하면 `state.activeGroupId`가 변경되면서 화면 전체(배분 막대, 요약 수치, 종목 리스트)가 해당 계좌 기준으로 즉시 필터링됩니다.
- 우측 상단의 `+ 계좌 추가` 버튼을 누르면 계좌 추가 모달이 바로 열립니다.

---

### 4.5 자산 배분 비중 막대그래프 vs 개별 계좌 요약 카드
탭 선택 상태에 따라 화면 중앙의 요약 섹션이 두 가지 모드로 자동 전환됩니다.

#### A. '전체' 탭이 선택된 경우: 자산 배분 비중 바 (`#allocation-section`)
- **HTML 코드 위치**: `index.html L220-L239`
  - 보유 종목 수: `L229` (`#allocation-total-count`)
  - 배분 바 막대: `L232` (`#allocation-bar`)
  - 계좌별 범례: `L236` (`#allocation-legend`)
- **담당 JS 코드**: `app.js L514-L556` (`renderAllocationOrAccountCard()`)
- **동작**:
  - 각 계좌별 평가금액 비중(%)을 계산하여 가로 누적 프로그레스 바 형태로 색상별로 채워줍니다.
  - 하단에는 각 계좌명과 비중(예: `연금저축 42.5%`, `IRP 28.1%`)이 알약 형태로 나열됩니다.

#### B. 개별 계좌(예: 연금저축, IRP)가 선택된 경우: 단일 계좌 요약 카드 (`#single-account-section`)
- **HTML 코드 위치**: `index.html L241-L300`
  - 계좌명/유형: `L251, L252` (`#single-acc-name`, `#single-acc-type`)
  - 비중/수정버튼: `L255, L257` (`#single-acc-weight`, `#btn-edit-active-group`)
  - 평가금액/투자원금: `L268, L272` (`#single-acc-valuation`, `#single-acc-invested`)
  - 수익금/수익률: `L276, L280` (`#single-acc-pnl-amount`, `#single-acc-return-rate`)
  - 퇴직연금 위험자산 배너: `L285-L299` (`#single-acc-risk-breakdown`)
- **담당 JS 코드**: `app.js L558-L646` (`renderAllocationOrAccountCard()`)
- **동작**:
  - 해당 계좌만의 평가금액, 투자원금, 수익금, 수익률을 4열 그리드로 요약합니다.
  - **퇴직연금(DC / IRP) 계좌 전용 위험자산 진단 배너**:
    - 퇴직연금 계좌는 법적으로 주식형 등 위험자산을 최대 70%까지만 담을 수 있습니다.
    - 종목명에 **채권, 국채, 미국채, TDF**가 포함된 종목(예: `ACE 미국30년국채액티브`, `TIGER 미국S&P500미국채혼합50`, `TIGER 미국채10년선물`, `RISE TDF2050액티브 적격`, `KODEX 종합채권` 등)을 자동으로 'NO위험자산(안전자산)'으로 판별합니다.
    - **위험자산 비중(%)과 안전자산 비중(%)**을 실시간 계산하여 배너에 표시하므로 70% 한도 초과 여부를 한눈에 점검할 수 있습니다.
  - 우측의 `수정` 버튼을 누르면 계좌명 및 색상을 즉시 변경할 수 있습니다.

---

### 4.6 보유 종목 리스트 & 드래그 앤 드롭 재정렬 (`#holdings-list`)
- **화면 위치**: 메인 콘텐츠의 하단 본문 영역
- **HTML 코드 위치**: `index.html L302-L340`
  - 종목 개수 뱃지: `L313` (`#holdings-count-badge`)
  - 정렬 드롭다운: `L317-L323` (`#sort-selector`)
  - 카드 목록 컨테이너: `L327` (`#holdings-list`)
  - 미등록 빈 상태 안내: `L330-L339` (`#holdings-empty-state`, `#btn-empty-add`)
- **담당 JS 코드**: `app.js L695-L840` (`renderHoldings()`), `L652-L693` (`getSortedFilteredHoldings()`), `L842-L893` (`saveNewHoldingsOrder()`)

#### 주요 기능
1. **정렬 드롭다운 (`index.html L317`)**:
   - `사용자 지정순`, `평가금액순`, `수익률 높은순`, `수익률 낮은순`, `종목명순`으로 실시간 정렬할 수 있습니다.
2. **카드 UI 내용**:
   - 소속 계좌 배지, 종목코드(티커), 현재 종가, 전일대비 등락률
   - 종목명, 보유 수량, 매수 평단가, 투자 원금
   - 평가금액 및 평가손익(수익률)
3. **자유로운 드래그 앤 드롭 (순서 변경)**:
   - 각 카드 좌측의 손잡이(`grip-vertical` 아이콘)를 클릭/터치한 상태로 위아래로 끌면 종목 순서를 바꿀 수 있습니다.
   - 드래그가 끝나면 `saveNewHoldingsOrder()`가 백엔드 API(`/api/v1/holdings/reorder`)를 호출하여 변경된 순서를 서버에 즉시 영구 저장합니다.
4. **상세 조회 연결**:
   - 카드의 아무 곳이나 터치/클릭하면 [모달 2] 상세 정보 창이 열립니다.

---

### 4.7 하단 플로팅 액션바 (`#btn-open-buy`)
- **화면 위치**: 스마트폰 화면 맨 아래에 항상 떠 있는 고정 바
- **HTML 코드 위치**: `index.html L359-L373` (`#btn-open-buy` L367)
- **담당 JS 코드**: `app.js L984-L997` (`openBuyModal()`)
- **동작**:
  - `[+ ETF 매수 기록하기]` 버튼을 누르면 [모달 1] 매수 등록 바텀시트가 아래에서 부드럽게 올라옵니다.

---

## 5. 팝업 모달 & 바텀시트 상세 가이드

### 5.1 [모달 1] ETF 매수 등록 모달 (`#modal-buy`)
종목을 검색하고 매수 내역을 포트폴리오에 등록하는 2단계 프로세스 창입니다.
- **HTML 코드 위치**: `index.html L381-L563`

#### Step 1: 종목 검색 (`index.html L398-L445 #buy-step-search`)
- **초성 검색 지원 (`index.html L407 #etf-search-input`)**: 검색창에 `ㅋㄷㅅ`를 입력하면 `searchETFs()`(`app.js L1021`)가 백엔드 초성 분해 엔진을 통해 실시간 검색 결과를 가져옵니다.
- **인기 운용사 칩 (`index.html L423-L428 .quick-chip`)**: `ㅋㄷㅅ`, `ㅌㅇㄱ`, `ㅇㅇㅅ`, `SOL`, `RISE`, `S&P500` 클릭 시 검색창에 즉시 입력됩니다.
- **검색 결과 리스트 (`index.html L438 #search-results-list`)**: 클릭 시 Step 2 폼으로 전환됩니다.

#### Step 2: 매수 정보 입력 폼 (`index.html L447-L560 #buy-step-form`)
- **선택 종목 카드 (`index.html L452-L463`)**: 티커, 운용사, 종목명, 기준 종가를 보여줍니다.
- **기존 보유 경고 배너 (`index.html L466-L475 #existing-holding-banner`)**: 이미 보유 중인 경우 가중평균 평단가 합산 알림을 표시합니다.
- **계좌 선택 알약 (`index.html L480 #form-group-pills`)**: 매수할 계좌를 선택합니다.
- **매수가격 및 종가입력 (`index.html L488, L497`)**: `#input-buy-price`에 가격을 적거나 `#btn-use-market-price`를 눌러 종가로 채웁니다.
- **수량 입력 (`index.html L507, L516-L519`)**: `+1`, `+10`, `+50`, `+100` 버튼으로 손쉽게 수량을 더합니다.
- **실시간 총액 계산 (`index.html L526 #form-total-calc`)**: `updateBuyFormCalculations()`(`app.js L1158`)가 `가격 × 수량`을 실시간 계산합니다.
- **매수 등록 완료 (`index.html L556 #btn-submit-buy`)**: `submitBuyHolding()`(`app.js L1169`)가 백엔드 `/api/v1/holdings`로 전송하여 저장합니다.

---

### 5.2 [모달 2] 보유 종목 상세 및 매수 내역 (`#modal-holding-detail`)
보유 종목 카드를 클릭했을 때 나타나는 상세 정보 창입니다.
- **HTML 코드 위치**: `index.html L565-L680`
- **담당 JS 코드**: `app.js L895-L974` (`openHoldingDetail()`)

- **종목 시세 & 손익 카드 (`index.html L590-L631`)**: 현재가, 전일대비 등락률, 평가손익, 평가금액, 투자원금, 보유수량, 매수평단가를 종합 표시합니다.
- **ETF 추가 스펙 (`index.html L634-L648`)**: 운용사명, 순자산총액(AUM, 억원 단위), 총보수율(%)을 서버에서 실시간 조회하여 보여줍니다.
- **과거 매수 거래 이력 (`index.html L651-L659 #detail-tx-list`)**: 과거에 언제, 몇 주를, 얼마에 매수했는지 거래 내역 목록을 날짜순으로 나열합니다.
- **하단 조작 버튼 (`index.html L665-L675`)**:
  - `+ 추가 매수` (`#btn-detail-add-more` L665): 해당 종목 정보가 채워진 상태로 매수 모달을 엽니다.
  - `수정` (`#btn-detail-edit` L669): 평단가/수량을 직접 수정할 수 있는 [모달 3]을 엽니다.
  - `삭제` (`#btn-detail-delete` L673): `deleteHolding()`(`app.js L1279`)를 호출하여 종목을 삭제합니다.

---

### 5.3 [모달 3] 보유 종목 직접 수정 창 (`#modal-edit-holding`)
- **HTML 코드 위치**: `index.html L682-L723`
- **담당 JS 코드**: `app.js L1228-L1277` (`saveEditHolding()`)
- **기능**: 과거 거래내역을 일일이 입력하지 않고, **수정할 평단가(원, `#edit-avg-price` L701)**와 **보유수량(주, `#edit-quantity` L705)**, **메모(`#edit-memo` L709)**를 직접 입력하여 즉시 덮어쓰기 수정합니다.

---

### 5.4 [모달 4 & 4.5] 계좌 그룹 관리 및 수정 (`#modal-groups`, `#modal-edit-group`)
- **계좌 목록 및 추가 (`index.html L725-L796 #modal-groups`)**:
  - 등록 계좌 목록: `L752 #groups-list`
  - 계좌 추가 폼: `L762 #new-group-name`, `L769 #new-group-type`, `L781 #new-group-color`, `L788 #btn-create-group`
  - 담당 JS: `app.js L1401-L1496` (`openGroupsModal()`, `renderGroupsList()`, `createNewGroup()`)
- **계좌 정보 수정 (`index.html L798-L878 #modal-edit-group`)**:
  - 계좌명/유형: `L821 #edit-group-name`, `L826 #edit-group-type`
  - 8가지 원형 컬러 팔레트: `L843-L853 #edit-group-palette`
  - 담당 JS: `app.js L1313-L1399` (`openEditGroupModal()`, `saveEditGroup()`)

---

### 5.5 [모달 5] 계좌 삭제 안전 확인 다이얼로그 (`#modal-group-delete-guard`)
- **HTML 코드 위치**: `index.html L880-L925`
- **담당 JS 코드**: `app.js L1498-L1555` (`handleDeleteGroupClick()`, `executeDeleteGroup()`)
- **2가지 선택지**:
  1. **다른 계좌로 종목 일괄 이관 후 삭제 (권장)**: `L903 #transfer-target-group-select`에서 대상 계좌를 고른 후 `L906 #btn-confirm-transfer-delete` 클릭
  2. **모든 종목과 함께 영구 삭제**: `L914 #btn-confirm-force-delete` 클릭

---

### 5.6 [모달 6] 사용자 계정(User ID) 설정 창 (`#modal-user-settings`)
- **HTML 코드 위치**: `index.html L932-L1020`
- **담당 JS 코드**: `app.js L2247-L2285` (`openUserSettingsModal()`), `L2289-L2311` (`handleApplyCustomUserId()`), `L2379-L2413` (`btnDeleteSelect`)
- **주요 기능**:
  1. 현재 활성 ID 확인 & 복사: `L958 #active-user-id-display`, `L959 #btn-copy-user-id`
  2. **내 원래 등록 계좌(5계좌/64종목) 원클릭 복원**: `L978 #btn-restore-primary-user`
  3. User ID 직접 입력 전환: `L988 #input-custom-user-id`, `L989 #btn-apply-custom-user-id` (신규 ID 입력 시 기본 5개 계좌 자동 준비)
  4. DB 등록 계정 선택 드롭다운: `L999 #select-registered-users`, `L1003 #btn-switch-selected-user` (선택 시 해당 계정으로 즉시 전환)
  5. **선택한 계정 영구 삭제**: `L1006 #btn-delete-selected-user`
     - 드롭다운에서 선택한 불필요한 User ID를 백엔드 `DELETE /api/v1/users/{user_id}` API로 삭제합니다.
     - 안전장치: 기본 계정(`hikarusky`)은 삭제가 금지되어 있으며, 현재 사용 중인 계정을 삭제한 경우 기본 계정으로 자동 복귀합니다.

---

## 6. 핵심 금융 계산 규칙 (Business Logic)

| 계산 항목 | 공식 및 처리 규칙 | 비고 |
|---|---|---|
| **가중평균 평단가** | $$\text{신규 평단가} = \frac{(\text{기존 평단가} \times \text{기존 수량}) + (\text{신규 매수가} \times \text{신규 수량})}{\text{기존 수량} + \text{신규 수량}}$$ | 동일 계좌 내 동일 종목 추가 매수 시 자동 계산 |
| **평가금액** | $\text{기준 종가} \times \text{보유 수량}$ | 소수점 버림 처리 |
| **투자원금** | $\text{매수 평단가} \times \text{보유 수량}$ | - |
| **평가손익** | $\text{평가금액} - \text{투자원금}$ | 수익(+): 빨간색 (`#D0374C`)<br>손실(-): 파란색 (`#60A5FA`) |
| **수익률(%)** | $\frac{\text{평가손익}}{\text{투자원금}} \times 100$ | 소수점 둘째 자리 반올림 |
| **종가 기준 시점** | • 평일 18:00 이전 또는 휴일: **직전 영업일 종가**<br>• 평일 18:00 이후: **당일 확정 종가** | 한국거래소(KRX) 공식 마감 기준 |
| **퇴직연금 위험자산 / NO위험자산 판정** | • 종목명에 `'채권'`, `'국채'`, `'미국채'`, `'TDF'`가 포함된 경우: **`NO위험자산(안전자산)`**으로 자동 판정 및 종목명 뒤 `(NO위험자산)` 라벨 부착<br>• 그 외 주식형 등 일반 ETF: **`위험자산`**으로 분류<br>• DC/IRP 계좌의 **위험자산 비중(70% 한도) 및 안전자산 비중(최소 30% 의무)**을 실시간 계산 | `portfolio_calc.py format_holding_name()`<br>`dashboard_service.py`<br>`app.js formatHoldingDisplayName()` |

---

## 7. 개발 및 실행 가이드

### 백엔드 서버 구동
```bash
# 가상환경 동기화
uv sync

# FastAPI 백엔드 서버 구동 (기본 포트 8010)
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8010
```

### 접속 주소
브라우저에서 `http://localhost:8010` 접속 시 모바일 반응형 웹 UI가 실행됩니다.

---

## 8. 자주 묻는 질문 (FAQ)

**Q. 포트폴리오 데이터가 안 보이고 "연결 오류" 배너가 뜹니다.**  
A. 백엔드 FastAPI 서버가 실행되어 있는지 확인하세요. 터미널에서 `uv run uvicorn src.main:app --port 8010`을 실행한 뒤 배너의 `[서버 재연결 및 다시 시도]` 버튼을 누르면 정상 복구됩니다.

**Q. 내가 등록했던 5개 계좌와 종목들이 갑자기 사라졌어요.**  
A. 브라우저 캐시 삭제 등으로 User ID가 초기화되었을 수 있습니다. 상단의 사용자 버튼(`User`)을 누른 후 **`[내 원래 계좌(5개)로 즉시 복원]`** 버튼을 클릭하면 원래 데이터가 즉시 다시 로드됩니다.

**Q. 종목 순서를 바꾸고 싶은데 어떻게 하나요?**  
A. 보유 종목 카드의 왼쪽 손잡이 아이콘(`::`)을 잡고 원하는 위치로 위아래로 끌어다 놓으면 순서가 자동으로 저장됩니다.
