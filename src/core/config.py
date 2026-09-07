from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "ETF Portfolio Manager"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    APP_ENV: str = "development"

    # PostgreSQL Database Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "etf_portfolio"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/etf_portfolio"

    @field_validator("POSTGRES_DB", "DATABASE_URL")
    @classmethod
    def validate_database_isolation(cls, v: str) -> str:
        """
        CRITICAL ISOLATION RULE:
        Prevent any connection to the existing 'stockinfo' database.
        """
        if "stockinfo" in v.lower():
            raise ValueError(
                "Access to 'stockinfo' database is strictly prohibited! "
                "Use 'etf_portfolio' database instead."
            )
        return v


settings = Settings()
