import json
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from app.agents.state.schemas import AgentState


ROUTER_PROMPT = """You are the routing brain of FinSight AI, a financial research platform.

User Query: {query}

Available tools:
- document_search     → Search uploaded PDFs (annual reports, 10-K, earnings, bank statements)
- stock_data          → Live price, volume, 52-week range (use when ticker symbols mentioned)
- stock_fundamentals  → Deep P/E, EPS, revenue, analyst targets (use for investment analysis)
- web_search          → Current market news and sentiment
- financial_news      → Recent news articles about a specific company
- sector_news         → Industry/sector trends

Respond ONLY with valid JSON, no markdown, no extra text:
{{
    "reasoning": "One sentence explaining your plan",
    "sub_queries": ["focused question 1", "focused question 2"],
    "tools_needed": ["tool1", "tool2"],
    "tickers_detected": ["AAPL", "TSLA"]
}}

Decision rules:
- ALWAYS include document_search if user asks about uploaded docs, reports, or analysis
- Include stock_data + stock_fundamentals for any investment or company analysis question
- Include financial_news when user wants recent updates about a company
- Include web_search for broad market questions or sentiment
- Break complex multi-part questions into 2-4 focused sub_queries
- tickers_detected: extract any stock symbols you see (empty list if none)"""


async def reasoning_node(state: AgentState) -> AgentState:
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.1,
        convert_system_message_to_human=True,
    )

    prompt = ROUTER_PROMPT.format(query=state["user_query"])
    response = llm.invoke(prompt)

    reasoning = "Defaulting to document search."
    sub_queries = [state["user_query"]]
    tools_used = ["document_search"]

    try:
        content = response.content.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()

        parsed = json.loads(content)
        reasoning = parsed.get("reasoning", reasoning)
        sub_queries = parsed.get("sub_queries", sub_queries)
        tools_used = parsed.get("tools_needed", tools_used)

        # Store detected tickers in state for use by tool executor
        tickers = parsed.get("tickers_detected", [])
        if tickers:
            state["tickers_detected"] = tickers

    except (json.JSONDecodeError, Exception) as e:
        print(f"⚠️ Router parse failed: {e}. Using fallback.")

    return {
        **state,
        "reasoning": reasoning,
        "sub_queries": sub_queries,
        "tools_used": tools_used,
        "llm_calls": state.get("llm_calls", 0) + 1,
    }