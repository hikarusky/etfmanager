from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP


def calculate_weighted_average_price(
    current_avg_price: Decimal | float | int,
    current_quantity: int,
    new_price: Decimal | float | int,
    new_quantity: int,
) -> Decimal:
    """
    Calculate new weighted average unit price (PRD F-02).
    Formula: ((current_avg * current_qty) + (new_price * new_qty)) / (current_qty + new_qty)
    Preserves 4 decimal places of precision.
    """
    c_price = Decimal(str(current_avg_price))
    n_price = Decimal(str(new_price))
    c_qty = current_quantity
    n_qty = new_quantity

    if c_qty < 0 or n_qty <= 0:
        raise ValueError("Quantities must be non-negative and new_quantity must be > 0.")
    if c_price < 0 or n_price <= 0:
        raise ValueError("Prices must be non-negative and new_price must be > 0.")

    total_qty = c_qty + n_qty
    if total_qty == 0:
        return Decimal("0.0000")

    total_cost = (c_price * c_qty) + (n_price * n_qty)
    new_avg = total_cost / Decimal(str(total_qty))
    return new_avg.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_holding_metrics(
    avg_price: Decimal | float | int,
    quantity: int,
    close_price: Decimal | float | int,
) -> dict:
    """
    Calculate holding financial metrics (PRD F-03):
    - invested_amount (매수금액)
    - valuation_amount (평가금액)
    - pnl (평가손익)
    - return_rate (수익률 %)
    """
    price_avg = Decimal(str(avg_price))
    price_close = Decimal(str(close_price))
    qty = Decimal(str(quantity))

    invested_amount = (price_avg * qty).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    valuation_amount = (price_close * qty).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    pnl = valuation_amount - invested_amount

    if price_avg > 0 and qty > 0:
        return_rate = ((price_close - price_avg) / price_avg * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        return_rate = Decimal("0.00")

    return {
        "avg_price": price_avg,
        "quantity": quantity,
        "close_price": price_close,
        "invested_amount": invested_amount,
        "valuation_amount": valuation_amount,
        "pnl": pnl,
        "return_rate": return_rate,
        "color_code": get_pnl_color(pnl),
    }


def calculate_portfolio_totals(holdings_metrics: list[dict]) -> dict:
    """
    Aggregate portfolio or group totals from individual holding metrics.
    """
    total_invested = Decimal("0")
    total_valuation = Decimal("0")

    for m in holdings_metrics:
        total_invested += m["invested_amount"]
        total_valuation += m["valuation_amount"]

    total_pnl = total_valuation - total_invested
    if total_invested > 0:
        total_return_rate = ((total_valuation - total_invested) / total_invested * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        total_return_rate = Decimal("0.00")

    return {
        "total_invested": total_invested,
        "total_valuation": total_valuation,
        "total_pnl": total_pnl,
        "total_return_rate": total_return_rate,
        "color_code": get_pnl_color(total_pnl),
    }


def get_pnl_color(amount: Decimal | float | int) -> str:
    """
    Korean standard color conventions:
    Profit (+): Red (#D0374C)
    Loss (-): Blue (#60A5FA)
    Neutral (0): Gray (#666666)
    """
    val = Decimal(str(amount))
    if val > 0:
        return "#D0374C"
    elif val < 0:
        return "#60A5FA"
    return "#666666"


def format_currency_krw(amount: Decimal | float | int) -> str:
    """Format KRW amount with commas and 원 suffix."""
    val = int(Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return f"{val:,}원"


def format_rate_percent(rate: Decimal | float | int) -> str:
    """Format return rate with sign and % suffix (e.g. +12.18%, -3.45%)."""
    val = Decimal(str(rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if val > 0:
        return f"+{val:.2f}%"
    return f"{val:.2f}%"


def is_today_close_confirmed(now: datetime | None = None) -> bool:
    """
    Determine if today's closing price is confirmed.
    Rule: Monday-Friday after 18:00 KST is confirmed.
    Weekends or before 18:00: Previous business day close applies.
    """
    if now is None:
        now = datetime.now()

    # 0: Monday, 4: Friday, 5: Saturday, 6: Sunday
    if now.weekday() >= 5:
        return False

    return (now.hour > 18) or (now.hour == 18 and now.minute >= 0)
