from typing import TypedDict, Optional, Union, List


class AgentState(TypedDict):
    # Input
    user_query: str
    doc_id: Optional[Union[str, List[str]]]   # ← change this line

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