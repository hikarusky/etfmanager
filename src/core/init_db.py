import asyncio
import uuid
import asyncpg
from sqlalchemy import select

from src.core.config import settings
from src.core.database import AsyncSessionLocal, engine
from src.models import Base, PortfolioGroup, User

DEFAULT_GROUPS = [
    {"group_id": "grp_pension", "name": "연금저축", "account_type": "연금저축", "color": "#4A90E2", "sort_order": 1},
    {"group_id": "grp_irp", "name": "IRP", "account_type": "IRP", "color": "#50E3C2", "sort_order": 2},
    {"group_id": "grp_dc", "name": "DC", "account_type": "DC", "color": "#F5A623", "sort_order": 3},
    {"group_id": "grp_isa", "name": "ISA", "account_type": "ISA", "color": "#9013FE", "sort_order": 4},
    {"group_id": "grp_general", "name": "일반위탁", "account_type": "일반", "color": "#7ED321", "sort_order": 5},
]


async def ensure_database_exists() -> None:
    """
    Connect to PostgreSQL maintenance database and ensure 'etf_portfolio' exists.
    CRITICAL: 'stockinfo' database is strictly forbidden from being accessed.
    """
    # Strict isolation check
    if "stockinfo" in settings.POSTGRES_DB.lower() or "stockinfo" in settings.DATABASE_URL.lower():
        raise RuntimeError("CRITICAL ERROR: Connection to 'stockinfo' is forbidden!")

    print(f"Connecting to PostgreSQL server at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}...")
    sys_conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        database="postgres",
    )

    try:
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.POSTGRES_DB,
        )
        if not exists:
            print(f"Database '{settings.POSTGRES_DB}' does not exist. Creating it now...")
            await sys_conn.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}"')
            print(f"Successfully created database '{settings.POSTGRES_DB}'.")
        else:
            print(f"Database '{settings.POSTGRES_DB}' already exists.")
    finally:
        await sys_conn.close()


async def init_tables_and_seeds() -> None:
    """Create all schema tables in 'etf_portfolio' and seed initial user and groups."""
    print(f"Initializing tables in '{settings.POSTGRES_DB}'...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        await conn.execute(text("ALTER TABLE holding ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 NOT NULL;"))
        await conn.execute(text("ALTER TABLE etf_master ALTER COLUMN expense_ratio TYPE NUMERIC(10, 6);"))
    print("Tables initialized successfully.")

    # Seed default user and groups if none exist
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).limit(1))
        default_user = result.scalars().first()

        if not default_user:
            default_user = User(
                user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                device_id="default_local_user",
            )
            session.add(default_user)
            await session.flush()
            print(f"Created default user: {default_user.user_id}")

            for group_data in DEFAULT_GROUPS:
                group = PortfolioGroup(
                    group_id=group_data["group_id"],
                    user_id=default_user.user_id,
                    name=group_data["name"],
                    account_type=group_data["account_type"],
                    color=group_data["color"],
                    sort_order=group_data["sort_order"],
                )
                session.add(group)
            await session.commit()
            print("Seeded default account groups (연금저축, IRP, DC, ISA, 일반위탁).")
        else:
            print(f"Default user already exists: {default_user.user_id}")


async def main() -> None:
    print("=" * 60)
    print(" ETF Portfolio DB Initializer")
    print(f" Target DB: {settings.POSTGRES_DB}")
    print(" [ISOLATION NOTICE] 'stockinfo' DB is untouched and protected.")
    print("=" * 60)
    await ensure_database_exists()
    await init_tables_and_seeds()
    print("=" * 60)
    print(" Database setup completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
