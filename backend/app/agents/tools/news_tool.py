import httpx
import os


async def _search_news_searxng(query: str, limit: int = 6) -> list[dict]:
    """Use SearXNG news category for actual news articles."""
    INSTANCES = [
        "https://searx.be",
        "https://search.bus-hit.me",
        "https://searx.tiekoetter.com",
    ]
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    for instance in INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{instance}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": "news",
                        "language": "en",
                        "time_range": "week",
                    },
                    headers=HEADERS,
                )

            if response.status_code != 200:
                continue

            data = response.json()
            results = []

            for r in data.get("results", [])[:limit]:
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "source": r.get("engine", r.get("publishedDate", "SearXNG")),
                    "snippet": r.get("content", "")[:400],
                    "published": r.get("publishedDate", "recent"),
                })

            if results:
                return results

        except Exception as e:
            print(f"⚠️ SearXNG news {instance} failed: {e}")
            continue

    return []


async def get_financial_news(company_or_ticker: str, days: int = 7) -> dict:
    """
    Get financial news using SearXNG (real results, no key needed).
    Falls back to Tavily if key is configured.
    """
    query = f"{company_or_ticker} stock earnings financial news"

    # Try Tavily first if key exists
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    if tavily_key:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": tavily_key,
                        "query": query,
                        "max_results": 6,
                        "include_answer": False,
                        "search_depth": "basic",
                        "topic": "news",
                    },
                )
            if response.status_code == 200:
                data = response.json()
                articles = [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "source": "Tavily",
                        "snippet": r.get("content", "")[:400],
                        "published": r.get("published_date", "recent"),
                    }
                    for r in data.get("results", [])
                ]
                if articles:
                    return {
                        "success": True,
                        "company": company_or_ticker,
                        "news_count": len(articles),
                        "articles": articles,
                        "provider": "tavily",
                    }
        except Exception:
            pass

    # SearXNG fallback
    articles = await _search_news_searxng(query, limit=6)
    return {
        "success": True if articles else False,
        "company": company_or_ticker,
        "news_count": len(articles),
        "articles": articles,
        "provider": "searxng",
        "error": None if articles else "No news found. Add TAVILY_API_KEY to .env for reliable news.",
    }


async def get_sector_news(sector: str) -> dict:
    """Get news for an entire market sector."""
    query = f"{sector} sector stock market trends analysis"

    articles = await _search_news_searxng(query, limit=6)

    # Tavily fallback if SearXNG fails
    if not articles:
        tavily_key = os.getenv("TAVILY_API_KEY", "")
        if tavily_key:
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    response = await client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": tavily_key,
                            "query": query,
                            "max_results": 6,
                        },
                    )
                if response.status_code == 200:
                    data = response.json()
                    articles = [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "source": "Tavily",
                            "snippet": r.get("content", "")[:400],
                            "published": "recent",
                        }
                        for r in data.get("results", [])
                    ]
            except Exception:
                pass

    return {
        "success": True if articles else False,
        "sector": sector,
        "news_count": len(articles),
        "articles": articles,
        "provider": "searxng" if articles else "none",
    }