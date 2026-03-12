import httpx
import urllib.parse


async def get_financial_news(company_or_ticker: str, days: int = 7) -> dict:
    """
    Get financial news using DuckDuckGo Instant Answer API.
    Pure httpx — no compiled packages, no DLLs.
    """
    try:
        query = f"{company_or_ticker} stock earnings financial news"

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            )

        data = response.json()
        articles = []

        if data.get("AbstractText"):
            articles.append({
                "title": data.get("Heading", company_or_ticker),
                "url": data.get("AbstractURL", ""),
                "source": data.get("AbstractSource", ""),
                "snippet": data.get("AbstractText", "")[:400],
                "published": "recent",
            })

        for topic in data.get("RelatedTopics", [])[:6]:
            if isinstance(topic, dict) and topic.get("Text"):
                articles.append({
                    "title": topic.get("Text", "")[:100],
                    "url": topic.get("FirstURL", ""),
                    "source": "DuckDuckGo",
                    "snippet": topic.get("Text", "")[:300],
                    "published": "recent",
                })

        return {
            "success": True,
            "company": company_or_ticker,
            "news_count": len(articles),
            "articles": articles,
        }

    except Exception as e:
        return {
            "success": False,
            "company": company_or_ticker,
            "error": str(e),
            "articles": [],
        }


async def get_sector_news(sector: str) -> dict:
    """Get news for an entire market sector."""
    try:
        query = f"{sector} industry sector stock market trends"

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                },
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            )

        data = response.json()
        articles = []

        if data.get("AbstractText"):
            articles.append({
                "title": data.get("Heading", sector),
                "url": data.get("AbstractURL", ""),
                "source": data.get("AbstractSource", ""),
                "snippet": data.get("AbstractText", "")[:400],
            })

        for topic in data.get("RelatedTopics", [])[:5]:
            if isinstance(topic, dict) and topic.get("Text"):
                articles.append({
                    "title": topic.get("Text", "")[:100],
                    "url": topic.get("FirstURL", ""),
                    "source": "DuckDuckGo",
                    "snippet": topic.get("Text", "")[:300],
                })

        return {
            "success": True,
            "sector": sector,
            "news_count": len(articles),
            "articles": articles,
        }

    except Exception as e:
        return {"success": False, "sector": sector, "error": str(e), "articles": []}