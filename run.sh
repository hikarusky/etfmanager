#!/usr/bin/env bash
set -e

# 스크립트가 위치한 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# uv 실행 경로 확보 (~/.local/bin 및 기본 경로)
export PATH="$HOME/.local/bin:$PATH"

echo "=================================================="
echo "🚀 KRX ETF 포트폴리오 관리 앱 실행 중..."
echo "📍 로컬 접속 URL : http://localhost:8010"
echo "📍 API 문서 (Swagger) : http://localhost:8010/docs"
echo "=================================================="

# 앱 실행
exec uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8010 "$@"
