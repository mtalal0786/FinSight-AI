import httpx
import os
from app.core.config import settings

# New – use the validated settings object
key = settings.ALPHA_VANTAGE_KEY or "demo"



BASE_URL = "https://www.alphavantage.co/query"


# def get_key() -> str:
#     return os.getenv("ALPHA_VANTAGE_KEY", "demo")  # "demo" works for testing


async def get_company_overview(ticker: str) -> dict:
    """
    Get deep fundamental data — revenue, EPS, P/E, sector, description.
    Free key at alphavantage.co (25 calls/day free tier).
    """
    ticker = ticker.upper().strip()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(BASE_URL, params={
                "function": "OVERVIEW",
                "symbol": ticker,
                "apikey": key,
            })

        data = response.json()

        if "Note" in data:
            return {"success": False, "ticker": ticker, "error": "Alpha Vantage rate limit hit. Try again in a minute."}

        if not data.get("Symbol"):
            return {"success": False, "ticker": ticker, "error": "Ticker not found in Alpha Vantage"}

        return {
            "success": True,
            "ticker": ticker,
            "company_name": data.get("Name"),
            "description": data.get("Description", "")[:500],
            "sector": data.get("Sector"),
            "industry": data.get("Industry"),
            "market_cap": data.get("MarketCapitalization"),
            "pe_ratio": data.get("PERatio"),
            "peg_ratio": data.get("PEGRatio"),
            "eps": data.get("EPS"),
            "revenue_ttm": data.get("RevenueTTM"),
            "gross_profit_ttm": data.get("GrossProfitTTM"),
            "dividend_yield": data.get("DividendYield"),
            "52week_high": data.get("52WeekHigh"),
            "52week_low": data.get("52WeekLow"),
            "analyst_target_price": data.get("AnalystTargetPrice"),
            "beta": data.get("Beta"),
        }
    except Exception as e:
        return {"success": False, "ticker": ticker, "error": str(e)}


async def get_earnings(ticker: str) -> dict:
    """Get last 4 quarters of earnings data."""
    ticker = ticker.upper().strip()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(BASE_URL, params={
                "function": "EARNINGS",
                "symbol": ticker,
                "apikey": key,
            })

        data = response.json()

        if "Note" in data:
            return {"success": False, "ticker": ticker, "error": "Rate limit hit"}

        quarterly = data.get("quarterlyEarnings", [])[:4]
        annual = data.get("annualEarnings", [])[:3]

        return {
            "success": True,
            "ticker": ticker,
            "quarterly_earnings": quarterly,
            "annual_earnings": annual,
        }
    except Exception as e:
        return {"success": False, "ticker": ticker, "error": str(e)}