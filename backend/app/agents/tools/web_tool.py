import httpx
import os
import urllib.parse


async def _ddg_search(query: str, limit: int = 5) -> list[dict]:
    """
    DuckDuckGo search via their HTML endpoint — pure httpx, no compiled packages.
    """
    try:
        encoded = urllib.parse.quote(query)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            # DuckDuckGo instant answer API
            response = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers=headers,
            )

        data = response.json()
        results = []

        # Abstract (main answer)
        if data.get("AbstractText"):
            results.append({
                "title": data.get("Heading", "DuckDuckGo Result"),
                "url": data.get("AbstractURL", ""),
                "snippet": data.get("AbstractText", "")[:400],
                "source": data.get("AbstractSource", ""),
            })

        # Related topics
        for topic in data.get("RelatedTopics", [])[:limit]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({
                    "title": topic.get("Text", "")[:80],
                    "url": topic.get("FirstURL", ""),
                    "snippet": topic.get("Text", "")[:400],
                    "source": "DuckDuckGo",
                })

        return results[:limit]

    except Exception as e:
        print(f"⚠️ DDG search error: {e}")
        return []


async def _tavily_search(query: str, limit: int = 5) -> dict:
    """Search using Tavily API (best quality, needs free key from tavily.com)."""
    tavily_key = os.getenv("TAVILY_API_KEY", "")

    if not tavily_key:
        return {"success": False, "provider": "tavily", "error": "No TAVILY_API_KEY in .env"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": query,
                    "max_results": limit,
                    "include_answer": True,
                    "search_depth": "advanced",
                },
            )
        data = response.json()
        results = [
            {
                "title": r.get("title"),
                "url": r.get("url"),
                "snippet": r.get("content", "")[:400],
                "source": "Tavily",
            }
            for r in data.get("results", [])
        ]
        return {
            "success": True,
            "provider": "tavily",
            "query": query,
            "answer": data.get("answer"),
            "results": results,
        }
    except Exception as e:
        return {"success": False, "provider": "tavily", "error": str(e)}


async def search_market_news(query: str, limit: int = 5) -> dict:
    """
    Smart search with automatic fallback chain:
    1. Tavily (best, needs free API key)
    2. DuckDuckGo Instant Answer API (free, no key, pure HTTP)
    """
    # Try Tavily first if key exists
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    if tavily_key:
        result = await _tavily_search(query, limit)
        if result["success"]:
            return result

    # Fallback: DuckDuckGo pure HTTP
    results = await _ddg_search(query, limit)
    return {
        "success": True,
        "provider": "duckduckgo",
        "query": query,
        "answer": results[0]["snippet"] if results else None,
        "results": results,
    }


async def get_market_sentiment(topic: str) -> dict:
    """Get market sentiment for a company or sector."""
    query = f"{topic} stock market sentiment outlook analysis 2025"
    return await search_market_news(query, limit=6)