import uuid
from sqlalchemy import String, TypeDecorator
from sqlalchemy.orm import DeclarativeBase


class StringUUID(TypeDecorator):
    """
    Store UUID as character varying(255) in PostgreSQL,
    while accepting and returning uuid.UUID or str transparently in Python.
    """
    impl = String(255)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return uuid.UUID(str(value))
        except (ValueError, TypeError):
            return str(value)


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 Base declarative class."""
    pass
