class ETFPortfolioException(Exception):
    """Base exception for ETF Portfolio application."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class EntityNotFoundException(ETFPortfolioException):
    """Raised when a requested entity does not exist."""
    pass


class DuplicateEntityException(ETFPortfolioException):
    """Raised when an entity already exists (e.g. duplicate group name)."""
    pass


class GroupDeletionConflictException(ETFPortfolioException):
    """Raised when attempting to delete a group that still contains active holdings."""
    pass


class InvalidCalculationException(ETFPortfolioException):
    """Raised when invalid inputs are provided for financial calculation."""
    pass
