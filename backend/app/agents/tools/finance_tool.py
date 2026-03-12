import httpx
from typing import Optional


YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


async def get_stock_data(ticker: str) -> dict:
    """Fetch live stock data via Yahoo Finance public API — no pandas needed."""
    ticker = ticker.upper().strip()

    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1mo"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=YAHOO_HEADERS)

        if response.status_code != 200:
            return {"success": False, "ticker": ticker, "error": f"HTTP {response.status_code}"}

        data = response.json()
        chart = data.get("chart", {})
        error = chart.get("error")

        if error:
            return {"success": False, "ticker": ticker, "error": error.get("description", "Unknown error")}

        result = chart.get("result", [])
        if not result:
            return {"success": False, "ticker": ticker, "error": "No data returned — check ticker symbol"}

        meta = result[0].get("meta", {})

        return {
            "success": True,
            "ticker": ticker,
            "company_name": meta.get("longName", ticker),
            "currency": meta.get("currency", "USD"),
            "current_price": meta.get("regularMarketPrice"),
            "previous_close": meta.get("previousClose"),
            "day_high": meta.get("regularMarketDayHigh"),
            "day_low": meta.get("regularMarketDayLow"),
            "volume": meta.get("regularMarketVolume"),
            "52week_high": meta.get("fiftyTwoWeekHigh"),
            "52week_low": meta.get("fiftyTwoWeekLow"),
            "exchange": meta.get("exchangeName"),
            "market_state": meta.get("marketState"),
        }

    except httpx.TimeoutException:
        return {"success": False, "ticker": ticker, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "ticker": ticker, "error": str(e)}


async def get_stock_summary(ticker: str) -> dict:
    """Get richer financial summary — P/E, market cap, etc."""
    ticker = ticker.upper().strip()

    try:
        url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=summaryDetail,defaultKeyStatistics,financialData"

        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=YAHOO_HEADERS)

        if response.status_code != 200:
            return {"success": False, "ticker": ticker, "error": f"HTTP {response.status_code}"}

        data = response.json()
        result = data.get("quoteSummary", {}).get("result", [])

        if not result:
            return {"success": False, "ticker": ticker, "error": "No summary data available"}

        summary = result[0]
        detail = summary.get("summaryDetail", {})
        stats = summary.get("defaultKeyStatistics", {})
        financial = summary.get("financialData", {})

        def raw(obj: dict, key: str):
            return obj.get(key, {}).get("raw") if isinstance(obj.get(key), dict) else obj.get(key)

        return {
            "success": True,
            "ticker": ticker,
            "market_cap": raw(detail, "marketCap"),
            "pe_ratio": raw(detail, "trailingPE"),
            "forward_pe": raw(detail, "forwardPE"),
            "dividend_yield": raw(detail, "dividendYield"),
            "beta": raw(detail, "beta"),
            "profit_margin": raw(financial, "profitMargins"),
            "revenue_growth": raw(financial, "revenueGrowth"),
            "earnings_growth": raw(financial, "earningsGrowth"),
            "debt_to_equity": raw(financial, "debtToEquity"),
            "return_on_equity": raw(financial, "returnOnEquity"),
            "52week_change": raw(stats, "52WeekChange"),
            "shares_outstanding": raw(stats, "sharesOutstanding"),
        }

    except Exception as e:
        return {"success": False, "ticker": ticker, "error": str(e)}


async def compare_stocks(tickers: list[str]) -> dict:
    """Compare multiple stocks side by side."""
    results = {}
    for ticker in tickers[:5]:
        price_data = await get_stock_data(ticker)
        summary_data = await get_stock_summary(ticker)

        results[ticker] = {
            **({k: v for k, v in price_data.items() if k != "success"} if price_data["success"] else {"error": price_data.get("error")}),
            **({k: v for k, v in summary_data.items() if k not in ("success", "ticker")} if summary_data["success"] else {}),
        }

    return {
        "success": True,
        "comparison": results,
        "tickers_compared": len(results),
    }