# ETF 포트폴리오 관리 앱 개발 가이드 (GEMINI.md)

이 문서는 ETF 포트폴리오 관리 애플리케이션의 아키텍처, 데이터 모델, 핵심 비즈니스 로직, 개발 규칙 및 실행 방법을 정의한 프로젝트 레퍼런스 가이드입니다.

---

## 1. 프로젝트 개요 (Project Overview)

- **목적**: 국내 여러 증권사에 분산된 연금저축, IRP, ISA, 일반 위탁계좌의 ETF(KRX 상장 약 1,000종)를 마이데이터 연동 없이, **사용자 매수 기록 + 자동 수집된 일별 종가**를 기반으로 통합 관리·손익 계산·시각화하는 서비스.
- **주요 대상**: 연금 ETF 적립식 투자자 및 멀티 계좌 운용 투자자.
- **핵심 가치**:
  - 계좌 유형별 손익 분리 및 전체 포트폴리오 통합 조회
  - 분할 매수 시 가중평균 평단가 자동 계산
  - 한국거래소(KRX) 상장 ETF 전종목 한글 초성/코드/명칭 고속 검색 (< 300ms)

---

## 2. 기술 스택 (Tech Stack)

| 계층 | 기술 | 역할 및 비고 |
|---|---|---|
| **Language** | Python 3.12+ | 패키지 및 환경 관리: `uv` |
| **Backend Framework** | FastAPI | 비동기 REST API, 자동 OpenAPI 문서화 |
| **Database & ORM** | PostgreSQL + SQLAlchemy 2.0 (`asyncpg`) | **전용 신규 DB `etf_portfolio` 사용 (기존 `stockinfo` DB 접근 금지)** |
| **Market Collector** | `pykrx` (1순위) $\rightarrow$ `FinanceDataReader` & 네이버 금융 API (폴백) | 별도 유료 키 없이 안정적인 시세 수집 파이프라인 |
| **Search Engine** | `jamo` (유니코드 한글 음소 분해) | 초성 검색 (`ㅋㄷㅅ` $\rightarrow$ `KODEX`) 및 DB/인메모리 인덱싱 |
| **Frontend** | Mobile-First Web / PWA (React + Tailwind CSS) | 모바일 뷰포트(375~430px) 최적화 카드형 터치 UI |
| **Test Framework** | `pytest`, `pytest-asyncio`, `httpx` | 단위/통합/시나리오 테스트 |

---

## 3. 데이터베이스 격리 규칙 (Database Isolation Rule)

> [!CAUTION]
> **기존 DB 격리 수칙**: 로컬 PostgreSQL 인스턴스에 존재하는 기존 `stockinfo` 데이터베이스는 **어떠한 경우에도 조회, 수정, 삭제하지 않습니다.**
> - 본 프로젝트는 오직 **신규 생성된 `etf_portfolio` 데이터베이스**만을 사용합니다.
> - `src/core/init_db.py` 스크립트를 통해 `etf_portfolio` 데이터베이스가 없을 시 안전하게 신규 생성합니다.

---

## 4. 시스템 아키텍처 및 디렉토리 구조

```text
etf/
├── ETF_관리앱_PRD.md            # 제품 요구사항 정의서 (v1.0)
├── project_implementation_plan.md # 상세 구현 계획서
├── GEMINI.md                    # 본 프로젝트 가이드 문서
├── pyproject.toml               # Python 프로젝트 메타데이터 및 의존성
├── .env.example                 # 환경변수 템플릿 (DATABASE_URL 등)
├── src/
│   ├── __init__.py
│   ├── main.py                  # FastAPI 앱 엔트리포인트 및 미들웨어
│   ├── core/                    # 설정(config), DB 세션, 예외 처리
│   │   ├── config.py            # pydantic-settings 기반 환경설정
│   │   ├── database.py          # asyncpg + SQLAlchemy 비동기 엔진
│   │   ├── init_db.py           # etf_portfolio DB 신규 생성 및 테이블 초기화
│   │   └── exceptions.py
│   ├── models/                  # SQLAlchemy 2.0 ORM 엔티티 (PostgreSQL)
│   │   ├── user.py
│   │   ├── etf_master.py
│   │   ├── price_daily.py
│   │   ├── group.py
│   │   ├── holding.py
│   │   └── transaction.py
│   ├── schemas/                 # Pydantic v2 DTOs (Request / Response)
│   ├── collector/               # 계층형 시세/마스터 수집 파이프라인
│   │   ├── base.py              # Collector 인터페이스
│   │   ├── pykrx_collector.py   # 1순위: pykrx 수집기
│   │   ├── fdr_collector.py     # 2순위: FinanceDataReader 수집기
│   │   ├── naver_collector.py   # 3순위: 네이버 증권 API 수집기
│   │   └── manager.py           # Fallback Chain 실행 및 스케줄러
│   ├── services/                # 비즈니스 도메인 서비스
│   │   ├── search_service.py    # 한글 초성 분해 및 ETF 고속 검색
│   │   ├── portfolio_service.py # 평단가 가중평균 및 손익/수익률 집계 엔진
│   │   ├── group_service.py     # 계좌 그룹 관리 및 삭제 정책 처리
│   │   └── holding_service.py   # 보유 등록/수정/삭제 및 거래 이력 생성
│   └── api/v1/                  # REST API 라우터
│       ├── etfs.py              # /api/v1/etfs
│       ├── holdings.py          # /api/v1/holdings
│       ├── groups.py            # /api/v1/groups
│       └── dashboard.py         # /api/v1/dashboard
├── frontend/                    # 모바일 반응형 웹 UI
└── tests/                       # 자동화 테스트 슈트
    ├── test_calc.py             # 금융 계산 및 평단가 병합 단위 테스트
    ├── test_search.py           # 초성 검색 및 우선순위 정렬 테스트
    └── test_api.py              # API 통합 E2E 테스트
```

---

## 5. 데이터베이스 모델 (PostgreSQL Schema)

1. **`user`**: 사용자 (익명 디바이스 ID 지원)
   - `user_id` (PK, UUID), `device_id` (VARCHAR), `created_at` (TIMESTAMP WITH TIME ZONE)
2. **`etf_master`**: KRX ETF 전종목 마스터
   - `ticker` (PK, VARCHAR(6)), `name_kr` (VARCHAR), `name_en` (VARCHAR), `name_chosung` (VARCHAR), `issuer` (VARCHAR), `index_name` (VARCHAR), `expense_ratio` (NUMERIC(6,4)), `aum` (BIGINT), `asset_class` (VARCHAR), `listed_at` (DATE), `status` (VARCHAR)
   - **인덱스**: `name_kr`, `name_chosung` 인덱스 생성
3. **`etf_price_daily`**: 일별 종가 및 등락률
   - `ticker` (PK, FK), `base_date` (PK, DATE), `close_price` (NUMERIC(14,2)), `prev_close` (NUMERIC(14,2)), `change_rate` (NUMERIC(6,4)), `volume` (BIGINT)
4. **`portfolio_group`**: 계좌 유형별 그룹 (연금저축, IRP, DC, ISA, 일반)
   - `group_id` (PK, UUID), `user_id` (FK), `name` (VARCHAR(50)), `account_type` (VARCHAR(20)), `color` (VARCHAR(10)), `sort_order` (INT), `created_at` (TIMESTAMP WITH TIME ZONE)
5. **`holding`**: 계좌별 보유 종목
   - `holding_id` (PK, UUID), `user_id` (FK), `group_id` (FK), `ticker` (FK), `avg_price` (NUMERIC(14,4)), `quantity` (INT), `memo` (VARCHAR(100)), `created_at`, `updated_at`
   - **Unique 제약**: `(user_id, group_id, ticker)`
6. **`transaction`**: 매수/매도 거래 이력
   - `tx_id` (PK, UUID), `holding_id` (FK), `tx_type` (VARCHAR(10), BUY/SELL), `price` (NUMERIC(14,2)), `quantity` (INT), `traded_at` (DATE), `created_at`

---

## 6. 핵심 비즈니스 로직 및 규칙 (Business Logic & Rules)

### 6.1 가중평균 평단가 자동 병합 (PRD F-02)
- 동일 그룹에 동일 종목 매수 추가 시:
  $$\text{신규 평단가} = \frac{(\text{기존 평단가} \times \text{기존 수량}) + (\text{신규 매수가} \times \text{신규 수량})}{\text{기존 수량} + \text{신규 수량}}$$
- `NUMERIC(14, 4)` 정밀도로 저장하고 화면 표시는 소수점 둘째 자리 반올림.
- 동일 종목이라도 그룹이 다르면 별개의 보유 레코드로 완전 분리 관리.

### 6.2 손익 및 수익률 계산 규칙 (PRD F-03)
- **평가금액** = 기준 종가 $\times$ 수량
- **매수금액** = 평단가 $\times$ 수량
- **평가손익** = 평가금액 $-$ 매수금액
- **수익률(%)** = $\frac{\text{기준 종가} - \text{평단가}}{\text{평단가}} \times 100$
- **국내 손익 표시 관행**:
  - 수익 ($+$): **빨간색 (`#E12343`)**
  - 손실 ($-$): **파란색 (`#1763B6`)**
  - 색상뿐만 아니라 부호($+$, $-$)를 항상 병기하여 접근성 보장.

### 6.3 종가 적용 시점 규칙
- 당일 18:00 이전 / 주말 / 공휴일: 직전 영업일 확정 종가 적용
- 당일 18:00 이후: 당일 확정 종가 적용
- 모든 화면 상단에 `기준: MM/DD 종가` 일자 명시 필수.

### 6.4 한글 초성 검색 규칙 (PRD F-01)
- 유니코드 자모 분해를 통해 한글 종목명의 초성 추출 (`KODEX 200` $\rightarrow$ `ㅋㄷㅅ 200`).
- 검색 정렬 우선순위:
  1. 6자리 종목코드 완전일치
  2. 종목명 완전일치
  3. 종목명 접두일치
  4. 초성 일치
  5. 순자산총액(AUM) 내림차순

---

## 7. 개발 및 실행 가이드 (Development & Commands)

### 7.1 환경 변수 설정 (`.env`)
```bash
# 로컬 PostgreSQL 전용 신규 DB 접속 정보 (기존 stockinfo DB 사용 안 함)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/etf_portfolio
```

### 7.2 의존성 설치 및 환경 실행
```bash
# 가상환경 생성 및 의존성 설치 (uv 사용)
uv sync

# etf_portfolio 신규 DB 확인/생성 및 테이블 초기화
uv run python -m src.core.init_db

# ETF 마스터 데이터 및 초기 시세 수집 실행
uv run python -m src.collector.manager --init

# FastAPI 백엔드 개발 서버 실행
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8010
```

### 7.3 테스트 실행
```bash
# 전체 테스트 실행
uv run pytest -v

# 금융 계산 도메인 로직 검증
uv run pytest tests/test_calc.py

# 초성 검색 엔진 검증
uv run pytest tests/test_search.py

# REST API 엔드포인트 검증
uv run pytest tests/test_api.py
```

---

## 8. 코딩 및 설계 지침 (Guidelines for AI & Developers)

1. **DB 격리 보장**: 기존의 `stockinfo` 데이터베이스는 절대로 참조하거나 변경하지 않으며, 모든 연결은 오직 `etf_portfolio` 데이터베이스로만 한정합니다.
2. **정밀도 유지**: 모든 금융 금액 및 수익률 계산은 부동소수점 오차를 방지하기 위해 반드시 Python `decimal.Decimal` 모듈과 PostgreSQL `NUMERIC` 타입을 사용합니다.
3. **단일 진실 공급원 (Single Source of Truth)**: 금액 계산은 항상 백엔드에서 수행하며 클라이언트는 표시만 담당합니다.
4. **방어적 폴백**: 시세 데이터 수집 시 `pykrx` 실패 시 예외를 던지지 않고 자동으로 `FinanceDataReader` $\rightarrow$ `Naver Finance`로 폴백하도록 구현합니다.
5. **그룹 삭제 안전장치**: 사용자가 그룹을 삭제할 때 보유 종목이 존재하면 강제 삭제되지 않도록 타 그룹 이관 또는 명시적 삭제 선택 다이얼로그를 제공합니다.
6. **컴플라이언스 고지**: 대시보드 및 상세 페이지 하단에 `"본 서비스는 투자 정보 제공 도구이며 투자자문·매매 권유가 아닙니다"` 고지를 상시 노출합니다.
