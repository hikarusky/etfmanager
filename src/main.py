from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.v1.dashboard import router as dashboard_router
from src.api.v1.etfs import router as etfs_router
from src.api.v1.groups import router as groups_router
from src.api.v1.holdings import router as holdings_router
from src.api.v1.sync import router as sync_router
from src.core.config import settings
from src.services.scheduler import market_scheduler

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    market_scheduler.start()
    yield
    market_scheduler.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="국내 상장 ETF 포트폴리오 관리 서비스 (전 계좌 통합 조회 및 평단가/손익 자동 계산)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware for Web / Mobile client access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(groups_router, prefix=settings.API_V1_STR)
app.include_router(holdings_router, prefix=settings.API_V1_STR)
app.include_router(etfs_router, prefix=settings.API_V1_STR)
app.include_router(sync_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint to verify service and database isolation status."""
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "database": settings.POSTGRES_DB,
        "isolation_verified": "stockinfo" not in settings.DATABASE_URL.lower(),
    }


# Mount Mobile Web / PWA Frontend at root
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
