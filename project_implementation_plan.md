# [구현 계획] ETF 포트폴리오 관리 앱 개발 계획서 (확정안)

본 계획서는 `ETF_관리앱_PRD.md`(v1.0) 요구사항과 사용자의 기술 스택 결정 사항(PostgreSQL 신규 DB 격리, pykrx 우선 수집, 모바일 웹/PWA)을 반영하여 구체화한 개발 계획서입니다.

---

## 1. 확정된 핵심 의사결정

1. **데이터베이스**: **로컬 PostgreSQL의 독립 신규 데이터베이스(`etf_portfolio`) + SQLAlchemy 2.0 (비동기 `asyncpg`)**
   - **중요 격리 규칙**: 로컬에 이미 존재하는 `stockinfo` 데이터베이스는 **절대 접근하거나 변경하지 않습니다**.
   - ETF 포트폴리오 전용 **신규 데이터베이스 `etf_portfolio`를 별도로 생성**하여 완전한 데이터 격리를 보장합니다.
   - DB 초기화 스크립트(`src/core/init_db.py`) 실행 시 `etf_portfolio` 데이터베이스의 존재 여부를 확인하고 없으면 자동 생성하거나 안내합니다.
   - 금융 데이터의 엄격한 트랜잭션 무결성, 정밀 소수점(`NUMERIC(14, 4)`), 고속 인덱싱(B-Tree, GIN) 활용.
   - 환경변수(`.env`) 기반 `DATABASE_URL` (기본값: `postgresql+asyncpg://postgres:postgres@localhost:5432/etf_portfolio`) 연동.
2. **클라이언트 UI 구현**: **옵션 A (FastAPI 백엔드 + 모바일 최적화 반응형 웹/PWA)**
   - 모바일 화면비(375px~430px)에 최적화된 직관적인 터치 UI 및 데스크톱 지원.
   - PWA(Progressive Web App) 매니페스트 지원으로 모바일 홈 화면 추가 시 네이티브 앱과 동일한 UX 제공.
   - React + Tailwind CSS 기반의 세련된 디자인 (손익 색상: 수익 빨강 `#E12343` / 손실 파랑 `#1763B6`).
3. **시세 및 마스터 수집기**: **계층형 폴백(Fallback) 수집 엔진**
   - **1순위 (Primary)**: `pykrx` (KRX 공식 일별 시세 및 ETF 마스터 정보)
   - **2순위 (Fallback)**: `FinanceDataReader` & 네이버 증권(Naver Finance) 비공식/공개 API
   - 네트워크 에러, KRX 점검, 일시 차단 발생 시 자동으로 다음 소스로 전환되어 서비스 가용성(99.5%) 보장.

---

## 2. 전체 시스템 아키텍처

```mermaid
graph TD
    subgraph Client ["Client (Mobile-First Web / PWA)"]
        UI_Home["대시보드 홈 (총손익/수익률/그룹별 소계)"]
        UI_Search["초성 검색 & 미리보기 바텀시트"]
        UI_Form["매수 등록 폼 (평단가 자동 계산)"]
        UI_Group["그룹 관리 모달 (연금/IRP/ISA 등)"]
    end

    subgraph Backend ["Backend API Service (FastAPI)"]
        Router["FastAPI Routers (/api/v1)"]
        SearchService["한글 초성 검색 엔진 (jamo 분해)"]
        CalcEngine["포트폴리오 집계 & 평단가 엔진 (Decimal)"]
        CollectorManager["데이터 수집 매니저 (Fallback Chain)"]
        Scheduler["배치 스케줄러 (16:00 / 18:00 KST 종가 수집)"]
    end

    subgraph DataSources ["Market Data Ingestion"]
        PyKRX["1순위: pykrx"]
        FDR["2순위: FinanceDataReader"]
        Naver["3순위: Naver Finance API"]
    end

    subgraph Storage ["PostgreSQL (독립 신규 DB)"]
        ExcludedDB[/"기존 stockinfo DB (접근 금지)"/]:::excluded
        DB[(신규 etf_portfolio DB)]:::active
    end

    classDef excluded fill:#ffebee,stroke:#c62828,stroke-dasharray: 5 5;
    classDef active fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;

    Client -->|REST API / JSON| Router
    Router --> SearchService
    Router --> CalcEngine
    Router --> DB
    Scheduler --> CollectorManager
    CollectorManager --> PyKRX
    PyKRX -.->|실패 시 폴백| FDR
    FDR -.->|실패 시 폴백| Naver
    CollectorManager -->|일별 종가 및 마스터 적재| DB
```

---

## 3. 세부 컴포넌트 설계

### 3.1 신규 데이터베이스 생성 및 초기화 (`src/core/init_db.py`)
- 기존 `stockinfo` 데이터베이스와의 간섭을 원천 차단하기 위해:
  1. PostgreSQL 기본 관리 DB(`postgres`)에 접속하여 `etf_portfolio` 데이터베이스 존재 여부 체크
  2. 존재하지 않을 경우 `CREATE DATABASE etf_portfolio` 실행
  3. `etf_portfolio` 데이터베이스에 접속하여 테이블 스키마 생성 및 인덱스 초기화 수행
- 환경변수(`.env.example`):
  ```env
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=postgres
  POSTGRES_DB=etf_portfolio
  DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
  ```

### 3.2 계층형 시세/마스터 수집기 (`src/collector/`)
- `CollectorStrategy` 인터페이스를 정의하고 각 수집기 구현:
  - `PyKrxCollector`: KRX 종목 목록 및 종가 수집 (`stock.get_etf_ticker_list`, `stock.get_market_ohlcv_by_ticker`)
  - `FDRCollector`: FinanceDataReader (`fdr.StockListing('ETF/KR')`)
  - `NaverFinanceCollector`: 네이버 증권 ETF 시세 API (`https://finance.naver.com/api/sise/etfItemList.nhn`)
- 수집 데이터를 `etf_portfolio`의 `etf_master` 및 `etf_price_daily` 테이블에 `UPSERT` 처리.
- 장애 발생 시 자동 전환 및 로그 기록, 재시도 큐(최대 3회, 10분 간격) 동작.

### 3.3 한글 초성 검색 엔진 (`src/services/search.py`)
- 한국어 음소 분해 알고리즘 적용 (`unicode_jamo`):
  - 예: `KODEX 200` → 초성 `ㅋㄷㅅ 200`
  - 예: `TIGER 미국S&P500` → 초성 `ㅌㅇㄱ ㅁㄱS&P500`
- PostgreSQL 인덱스 활용:
  - `ticker` (기본키/Unique Index)
  - `name_kr`, `name_chosung` (B-Tree/Trigram Index)
- 검색 우선순위 정렬 규칙:
  1. 티커 6자리 완전일치 (예: `069500`)
  2. 종목명 완전일치
  3. 종목명 접두일치
  4. 초성 일치
  5. 순자산총액(AUM) 내림차순 정렬
- 응답 속도: 인메모리 캐싱 + PostgreSQL 인덱스를 적용하여 P95 100ms 이내 처리.

### 3.4 포트폴리오 집계 및 평단가 엔진 (`src/services/portfolio.py`)
- **가중평균 평단가(PRD F-02)**:
  $$\text{신규 평단가} = \frac{(\text{기존 평단가} \times \text{기존 수량}) + (\text{신규 가격} \times \text{신규 수량})}{\text{기존 수량} + \text{신규 수량}}$$
- **소수점 정밀도**: PostgreSQL `NUMERIC(14, 4)` 및 Python `Decimal`로 보관하여 부동소수점 오차 차단, 표시는 2자리 반올림.
- **그룹 분리**: 동일 종목이라도 그룹(계좌)이 다르면 독립적인 레코드로 분리 (`UNIQUE (user_id, group_id, ticker)`).
- **종가 적용 기준(PRD F-03)**:
  - 영업일 18:00 이전 또는 공휴일: 직전 영업일 종가 적용 (`기준: MM/DD 종가` 명시)
  - 영업일 18:00 이후: 당일 확정 종가 적용

### 3.5 모바일 최적화 웹 프론트엔드 (`frontend/`)
- **디자인 시스템**: 토스(Toss) / 뱅크샐러드 스타일의 간결한 모바일 카드 UI.
- **화면 구성**:
  1. **대시보드 메인**: 총 평가금액, 평가손익, 수익률 배지, 기준일자, 계좌 그룹 탭 (전체 / 연금저축 / IRP / ISA / 일반), 그룹별 소계 카드, 보유 종목 행 (평단가, 수량, 종가, 손익).
  2. **ETF 검색 모달/페이지**: 300ms 디바운스, 초성 검색, 종목 선택 시 상세 요약(운용사, 보수, AUM) 미리보기.
  3. **매수 등록 폼**: 그룹 선택, 매수가격(3자리 콤마), 수량 입력 시 실시간 매수금액 계산, 저장 시 가중평균 자동 반영.
  4. **그룹 관리**: 계좌 그룹 추가/수정/삭제 (보유 종목 보호 다이얼로그).

---

## 4. 단계별 구현 로드맵 (Roadmap)

### Phase 1: 백엔드 환경 및 코어 도메인 모델 구축 (완료)
- [x] 프로젝트 구조 설정 및 의존성 정의 (`pyproject.toml`: `asyncpg`, `sqlalchemy`, `pydantic-settings` 등)
- [x] 신규 DB(`etf_portfolio`) 자동 생성 및 초기화 스크립트 작성 (`src/core/init_db.py`, `stockinfo` 격리 보장)
- [x] SQLAlchemy 2.0 모델 정의 (`User`, `ETFMaster`, `ETFDailyPrice`, `PortfolioGroup`, `Holding`, `Transaction`)
- [x] 금융 연산 및 가중평균 평단가 계산 단위 테스트 작성 및 통과 (`tests/test_calc.py`, 10개 테스트)
- [x] FastAPI 앱 엔트리포인트 및 헬스체크 작성 및 통과 (`src/main.py`, `tests/test_health.py`)

### Phase 2: 수집기 및 한글 검색 엔진 구현 (완료)
- [x] `pykrx` 수집기 구현 및 `FinanceDataReader` / `Naver Finance` 폴백 체인 구축 (`src/collector/`)
- [x] KRX ETF 전종목 마스터 및 종가 데이터 적재 완료 (`etf_portfolio`에 1,167개 ETF 적재)
- [x] 한글 초성 분해(`ㅋㄷㅅ`, `ㅌㅇㄱ`) 및 고속 인메모리/DB 검색 엔진 구현 (`src/services/chosung.py`, `src/services/search_service.py`)
- [x] ETF 검색 및 상세 조회 API 라우터 구현 (`/api/v1/etfs/search`, `/api/v1/etfs/{ticker}`)
- [x] 검색 정확도 및 라이브 데이터 조회 테스트 작성 및 통과 (`tests/test_search.py`, `tests/test_live_search.py`)

### Phase 3: 그룹 & 보유 종목 & 대시보드 API 완성 (완료)
- [x] 계좌 그룹 CRUD API (`/api/v1/groups`) 및 기본 그룹 5종 자동 시드
- [x] 매수 저장(가중평균 평단가 병합 로직), 수정, 삭제 API (`/api/v1/holdings`)
- [x] 대시보드 종합 집계 API (`/api/v1/dashboard`) 구현 (전체 합계 및 그룹별 소계/자산비중 계산)
- [x] 그룹 삭제 안전장치(보유 종목 존재 시 삭제 차단 및 타 그룹 이관 시 동일 종목 자동 병합)
- [x] API 전과정 라이프사이클 E2E 테스트 작성 및 통과 (`tests/test_api.py`)

### Phase 4: 모바일 최적화 웹 프론트엔드 (UI) 구현 (완료)
- [x] 모바일 퍼스트 프론트엔드 뷰포트 및 컴포넌트 구성 (`src/static/index.html`, `src/static/css/style.css`, `src/static/js/app.js`)
- [x] 대시보드 홈 (상단 요약 카드 + 그룹 탭 + 종목 리스트 + 자산 배분 비중 바)
- [x] ETF 검색 및 상세 미리보기 바텀시트 (실시간 디바운스, 초성 칩 `ㅋㄷㅅ`/`ㅌㅇㄱ`/`ㅇㅇㅅ`, 종가/AUM/보수 표시)
- [x] 매수 정보 입력 폼 (키패드 친화적 콤마 포맷, 실시간 계산, 기보유 종목 가중평균 사전 안내)
- [x] 계좌 그룹 관리 UI 및 법적 고지 배너, PWA 매니페스트/서비스워커 탑재

### Phase 5: 종가 배치 스케줄러 & 안정화 (완료)
- [x] 장 마감 후 종가 갱신 스케줄러 (`src/services/scheduler.py`: 평일 18:05 KST 자동 실행)
- [x] 수동 즉시 시세 동기화 및 상태 확인 API 라우터 (`/api/v1/sync/prices`, `/api/v1/sync/status`)
- [x] 예외 처리 및 폴백 안정성 테스트

### Phase 6: E2E 검증 및 Walkthrough 산출 (완료)
- [x] 시나리오 E2E 테스트 (신규 매수 -> 대시보드 반영 -> 추가 분할 매수 시 평단가 병합 -> 그룹별 손익 분리 검증)
- [x] 전체 자동화 테스트 23개 통과 (`tests/` 전체 23/23 PASSED)
- [x] 최종 결과 보고서(Walkthrough) 작성 완료 (`walkthrough.md`)

---

## 5. 검증 계획 (Verification Plan)

### 5.1 자동화 테스트
```bash
# 1. 금융 계산 및 평단가 병합 로직 검증
pytest tests/test_calc.py

# 2. 한글 초성 검색 정확도 및 정렬 검증
pytest tests/test_search.py

# 3. 신규 etf_portfolio DB 기반 REST API E2E 테스트
pytest tests/test_api.py
```

### 5.2 수동 시나리오 검증
1. **신규 DB 생성 및 격리 확인**:
   - `init_db` 실행 시 `stockinfo` DB에 영향 없이, 신규 `etf_portfolio` DB에만 6개 테이블 스키마가 생성되는지 확인.
2. **검색 동작**: `ㅋㄷㅅ` 입력 시 KODEX ETF 목록 표시, `069500` 입력 시 KODEX 200 최상단 노출.
3. **매수 등록 및 평단가**: 10,000원에 10주 매수 후 12,000원에 10주 추가 매수 시 평단가가 11,000원(20주)으로 자동 병합되는지 확인.
4. **계좌별 분리**: 동일 종목을 `연금저축`과 `일반계좌`에 각각 다른 가격으로 저장 시 소계와 평단가가 독립적으로 유지되는지 확인.
5. **모바일 반응형 확인**: 모바일 뷰(375px~430px) 및 데스크톱 브라우저에서 레이아웃 깨짐 없이 동작하는지 확인.
