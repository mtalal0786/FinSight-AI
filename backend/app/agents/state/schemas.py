from typing import TypedDict


class AgentState(TypedDict):
    # Input
    user_query: str
    doc_id: str | None

    # Routing
    sub_queries: list[str]
    reasoning: str
    tools_used: list[str]
    tickers_detected: list[str]

    # Tool results
    rag_results: dict
    finance_results: dict
    alpha_vantage_results: dict
    web_results: dict
    news_results: dict

    # Output
    final_answer: str
    sources: list[dict]

    # Meta
    llm_calls: int