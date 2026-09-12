# KRX ETF 포트폴리오 관리 서비스

국내 거래소(KRX)에 상장된 ETF(1,100여 종)를 대상으로, 복수 계좌(연금저축, IRP, DC, ISA, 일반위탁)에 분산된 포트폴리오를 마이데이터 연동 없이 수기 매수 기록과 자동 수집된 일별 종가 시세를 기반으로 통합 관리하는 서비스입니다.

---

## 🌟 주요 기능

1. **전 계좌 통합 대시보드 (Mobile-First Web / PWA)**:
   - 총 평가금액, 투자원금, 평가손익, 수익률(%) 실시간 집계.
   - 계좌 유형별 자산 배분 비중(%) 시각화.
   - 국내 증시 표준 색상 규칙 준수 (수익: 빨간색 `#E12343` / 손실: 파란색 `#1763B6`).
2. **분할 매수 시 가중평균 평단가 자동 계산**:
   - 동일 계좌에 추가 매수 시 수량 가중평균 방식으로 평단가 자동 병합.
   - 부동소수점 오차 방지를 위해 `Decimal` 및 PostgreSQL `NUMERIC` 적용.
3. **KRX 전종목 한글 초성 고속 검색 엔진 (< 5ms)**:
   - `ㅋㄷㅅ` (KODEX), `ㅌㅇㄱ` (TIGER), `ㅇㅇㅅ` (ACE), `SOL`, `RISE` 등 주요 브랜드 초성/명칭/코드 검색.
   - 1,167개 ETF 전종목 인메모리 캐싱 및 우선순위 정렬.
4. **계층형 시세 수집기 및 자동 스케줄러**:
   - `pykrx` $\rightarrow$ `FinanceDataReader` $\rightarrow$ `네이버 증권 API` 자동 폴백(Fallback).
   - 평일 18:05 KST 일별 확정 종가 자동 수집 및 UI 수동 새로고침 버튼 지원.
5. **계좌 삭제 안전장치**:
   - 보유 종목이 있는 계좌 삭제 시 타 계좌 일괄 이관(자동 평단가 병합) 또는 명시적 삭제 보호.

---

## 🔒 데이터베이스 격리 수칙

- **격리 규칙**: 로컬 PostgreSQL의 기존 `stockinfo` DB는 절대로 접근하거나 수정하지 않습니다.
- **전용 DB**: 본 프로젝트는 신규 생성된 독립 데이터베이스 **`etf_portfolio`**만을 사용합니다.

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1. 패키지 설치
```bash
uv sync
```

### 2. 신규 데이터베이스 생성 및 테이블 초기화
```bash
uv run python -m src.core.init_db
```

### 3. ETF 마스터 및 초기 시세 수집
```bash
uv run python -m src.collector.manager --init
```

### 4. 웹 서버 실행
```bash
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```
- **웹 앱 접속**: [http://localhost:8000/](http://localhost:8000/)
- **Swagger API 문서**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **헬스체크 및 DB 격리 확인**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🧪 테스트 실행

```bash
# 전체 테스트 실행 (23개)
uv run pytest tests/ -v

# 금융 계산 및 평단가 병합 로직 검증
uv run pytest tests/test_calc.py

# 한글 초성 검색 엔진 검증
uv run pytest tests/test_search.py

# REST API 및 프론트엔드 서빙 검증
uv run pytest tests/test_api.py tests/test_frontend_and_sync.py
```

---

## 📚 관련 개발 및 유지보수 가이드

- **프론트엔드 유지보수 가이드**: [FRONTEND_MAINTENANCE_GUIDE.md](file:///Users/hongjunyong/Desktop/etf/FRONTEND_MAINTENANCE_GUIDE.md) (React 개발자를 위한 바닐라 JS 및 상태 관리 가이드)
- **아키텍처 및 DB 격리 수칙**: [GEMINI.md](file:///Users/hongjunyong/Desktop/etf/GEMINI.md)
- **제품 요구사항 정의서**: [ETF_관리앱_PRD.md](file:///Users/hongjunyong/Desktop/etf/ETF_관리앱_PRD.md)
