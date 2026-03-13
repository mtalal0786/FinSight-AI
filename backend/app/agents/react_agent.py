import re
from typing import Optional, Union

from langgraph.graph import StateGraph, END
from app.agents.state.schemas import AgentState
from app.agents.nodes.router import reasoning_node
from app.agents.nodes.answerer import answerer_node
from app.agents.tools import rag_tool, finance_tool, web_tool, news_tool, alpha_vantage_tool


def extract_tickers_simple(text: str) -> list[str]:
    """Fallback ticker extractor if router doesn't detect them."""
    pattern = r'\b([A-Z]{2,5})\b'
    candidates = re.findall(pattern, text)
    exclude = {"AI", "AND", "OR", "THE", "FOR", "PDF", "API", "US", "USA", "GDP", "IPO", "ETF", "SEC"}
    return list(set(c for c in candidates if c not in exclude))[:4]


async def execute_tools(state: AgentState) -> AgentState:
    """Execute all tools in parallel conceptually, sequentially in practice."""

    rag_results = {}
    finance_results = {}
    alpha_vantage_results = {}
    web_results = {}
    news_results = {}

    tools = state.get("tools_used", ["document_search"])
    sub_queries = state.get("sub_queries", [state["user_query"]])
    doc_id = state.get("doc_id")

    # Get tickers from router or fallback to extraction
    tickers = state.get("tickers_detected") or extract_tickers_simple(state["user_query"])

    for tool_name in tools:

        # ── Document search ────────────────────────────────────────────
        if tool_name == "document_search":
            searches = []
            for sq in sub_queries:
                result = await rag_tool.search_documents(sq, doc_id=doc_id, top_k=4)
                searches.append({"sub_query": sq, "result": result})
            rag_results = {"searches": searches}

        # ── Live stock price data ──────────────────────────────────────
        elif tool_name == "stock_data":
            if tickers:
                finance_results = await finance_tool.compare_stocks(tickers)
            else:
                finance_results = {"message": "No tickers detected — mention stocks like AAPL or TSLA"}

        # ── Deep fundamentals via Alpha Vantage ───────────────────────
        elif tool_name == "stock_fundamentals":
            if tickers:
                fundamentals = {}
                for ticker in tickers[:2]:  # Max 2 (free tier limit)
                    overview = await alpha_vantage_tool.get_company_overview(ticker)
                    earnings = await alpha_vantage_tool.get_earnings(ticker)
                    fundamentals[ticker] = {"overview": overview, "earnings": earnings}
                alpha_vantage_results = {"fundamentals": fundamentals}
            else:
                alpha_vantage_results = {"message": "No tickers detected for fundamental analysis"}

        # ── Web search (Tavily → DuckDuckGo fallback) ─────────────────
        elif tool_name == "web_search":
            web_results = await web_tool.search_market_news(state["user_query"], limit=5)

        # ── Financial news ────────────────────────────────────────────
        elif tool_name == "financial_news":
            if tickers:
                articles = {}
                for ticker in tickers[:2]:
                    articles[ticker] = await news_tool.get_financial_news(ticker)
                news_results = {"by_ticker": articles}
            else:
                # Search by query topic
                news_results = await news_tool.get_financial_news(state["user_query"][:50])

        # ── Sector news ───────────────────────────────────────────────
        elif tool_name == "sector_news":
            news_results = await news_tool.get_sector_news(state["user_query"])

    return {
        **state,
        "rag_results": rag_results,
        "finance_results": finance_results,
        "alpha_vantage_results": alpha_vantage_results,
        "web_results": web_results,
        "news_results": news_results,
    }


def create_agent_graph():
    graph = StateGraph(AgentState)

    graph.add_node("router", reasoning_node)
    graph.add_node("tools", execute_tools)
    graph.add_node("answerer", answerer_node)

    graph.add_edge("router", "tools")
    graph.add_edge("tools", "answerer")
    graph.add_edge("answerer", END)

    graph.set_entry_point("router")
    return graph.compile()


agent_graph = create_agent_graph()


async def run_agentic_query(user_query: str, doc_id: Optional[Union[str, list[str]]] = None) -> dict:
    initial_state: AgentState = {
        "user_query": user_query,
        "doc_id": doc_id,
        "sub_queries": [],
        "reasoning": "",
        "tools_used": [],
        "tickers_detected": [],
        "rag_results": {},
        "finance_results": {},
        "alpha_vantage_results": {},
        "web_results": {},
        "news_results": {},
        "final_answer": "",
        "sources": [],
        "llm_calls": 0,
    }

    final_state = await agent_graph.ainvoke(initial_state)

    return {
        "query": final_state["user_query"],
        "reasoning": final_state["reasoning"],
        "sub_queries": final_state["sub_queries"],
        "tools_used": final_state["tools_used"],
        "tickers_detected": final_state.get("tickers_detected", []),
        "answer": final_state["final_answer"],
        "rag_results": final_state["rag_results"],
        "finance_results": final_state["finance_results"],
        "alpha_vantage_results": final_state["alpha_vantage_results"],
        "web_results": final_state["web_results"],
        "news_results": final_state["news_results"],
        "llm_calls": final_state["llm_calls"],
    }