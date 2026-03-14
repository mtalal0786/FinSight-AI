import httpx
import os
import json
from typing import Optional


# ── SearXNG ───────────────────────────────────────────────────────────────────
# Free, open-source meta-search engine with public instances.
# No API key needed. Results are real web results.
SEARXNG_INSTANCES = [
    "https://searx.be",
    "https://search.bus-hit.me",
    "https://searx.tiekoetter.com",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "application/json",
}


async def _searxng_search(query: str, limit: int = 6) -> list[dict]:
    """
    Search via SearXNG public instances — proper web results, no API key.
    Tries multiple instances for reliability.
    """
    for instance in SEARXNG_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{instance}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": "general,news",
                        "engines": "google,bing,duckduckgo",
                        "language": "en",
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
                    "snippet": r.get("content", r.get("snippet", ""))[:400],
                    "source": r.get("engine", "searxng"),
                    "published": r.get("publishedDate", ""),
                })

            if results:
                return results

        except Exception as e:
            print(f"⚠️ SearXNG instance {instance} failed: {e}")
            continue

    return []


async def _google_cse_search(query: str, limit: int = 6) -> list[dict]:
    """
    Google Custom Search Engine — 100 free queries/day.
    Set GOOGLE_CSE_KEY and GOOGLE_CSE_ID in .env to enable.
    Get free key: https://programmablesearchengine.google.com/
    """
    api_key = os.getenv("GOOGLE_CSE_KEY", "")
    cse_id = os.getenv("GOOGLE_CSE_ID", "")

    if not api_key or not cse_id:
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": api_key,
                    "cx": cse_id,
                    "q": query,
                    "num": min(limit, 10),
                },
            )

        if response.status_code != 200:
            return []

        data = response.json()
        results = []

        for item in data.get("items", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", "")[:400],
                "source": "Google",
                "published": item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time", ""),
            })

        return results

    except Exception as e:
        print(f"⚠️ Google CSE error: {e}")
        return []


async def _tavily_search(query: str, limit: int = 6) -> Optional[dict]:
    """Tavily — best quality results, needs free key from tavily.com"""
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": limit,
                    "include_answer": True,
                    "search_depth": "advanced",
                },
            )

        if response.status_code != 200:
            return None

        data = response.json()
        results = [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", "")[:400],
                "source": "Tavily",
                "published": r.get("published_date", ""),
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
        print(f"⚠️ Tavily error: {e}")
        return None


async def search_market_news(query: str, limit: int = 6) -> dict:
    """
    Priority chain:
    1. Tavily (if TAVILY_API_KEY set — best quality)
    2. Google CSE (if GOOGLE_CSE_KEY + GOOGLE_CSE_ID set — 100/day free)
    3. SearXNG public instances (no key, real web results, tries 3 instances)
    """
    # 1. Tavily
    tavily = await _tavily_search(query, limit)
    if tavily and tavily.get("success") and tavily.get("results"):
        return tavily

    # 2. Google CSE
    google_results = await _google_cse_search(query, limit)
    if google_results:
        return {
            "success": True,
            "provider": "google_cse",
            "query": query,
            "answer": google_results[0]["snippet"] if google_results else None,
            "results": google_results,
        }

    # 3. SearXNG (free fallback — no key needed)
    searx_results = await _searxng_search(query, limit)
    if searx_results:
        return {
            "success": True,
            "provider": "searxng",
            "query": query,
            "answer": searx_results[0]["snippet"] if searx_results else None,
            "results": searx_results,
        }

    # All failed
    return {
        "success": False,
        "provider": "none",
        "query": query,
        "answer": None,
        "results": [],
        "error": "All search providers failed. Add TAVILY_API_KEY to .env for reliable results.",
    }


async def get_market_sentiment(topic: str) -> dict:
    """Get market sentiment for a company or sector."""
    query = f"{topic} stock market outlook analysis latest news"
    return await search_market_news(query, limit=6)